const ComplaintRepository = require('../repositories/ComplaintRepository');
const Database = require('../config/database');

/**
* DuplicationDetectionService
* Detects duplicate and similar complaints using multiple algorithms
*/
class DuplicationDetectionService {

  constructor() {
    this.complaintRepo = new ComplaintRepository();
    this.supabase = Database.getClient();
  }
  /**
  * Main method to detect potential duplicates for a complaint
  * @param {string} complaintId - The complaint to check
  * @returns {Promise<Array>} Array of potential duplicates with scores
  */
  async detectDuplicates(complaintId) {
    try {
      const complaint = await this.complaintRepo.findById(complaintId);
      if (!complaint) {
        throw new Error('Complaint not found');
      }
      // Convert Complaint model to plain object for similarity algorithms
      const complaintData = complaint.toJSON ? complaint.toJSON() : complaint;
      
      // Run multiple detection algorithms
      const [
        textMatches,
        locationMatches,
        temporalMatches
      ] = await Promise.all([
        this.findTextSimilarity(complaintData),
        this.findLocationSimilarity(complaintData),
        this.findTemporalSimilarity(complaintData)
      ]);
      // Merge and score results
      const merged = this.mergeAndScore(textMatches, locationMatches, temporalMatches);
      // Save results to database
      await this.saveSimilarityResults(complaintId, merged);
      return merged;
    } catch (error) {
      console.error('[DUPLICATION] Detection error:', error);
      throw error;
    }
  }
  /**
  * Find complaints with similar text content
  * Uses Levenshtein distance and keyword matching
  */
  async findTextSimilarity(complaint) {
    const { data: candidates, error } = await this.supabase
      .from('complaints')
      .select('*')
      .neq('id', complaint.id)
      .eq('category', complaint.category) // Same category
      .gte('submitted_at', this.getTimeThreshold(30)) // Last 30 days
      .limit(50);
    if (error) {
      console.error('[DUPLICATION] Text similarity error:', error);
      return [];
    }
    return candidates.map(candidate => {
      const titleScore = this.calculateTextSimilarity(
        complaint.title.toLowerCase(),
        candidate.title.toLowerCase()
      );
      const descScore = this.calculateTextSimilarity(
        complaint.descriptive_su.toLowerCase(),
        candidate.descriptive_su.toLowerCase()
      );
      const keywordScore = this.calculateKeywordOverlap(
        `${complaint.title  } ${  complaint.descriptive_su}`,
        `${candidate.title  } ${  candidate.descriptive_su}`
      );
      const textScore = (titleScore * 0.4 + descScore * 0.4 + keywordScore * 0.2);

      return {
        complaint_id: candidate.id,
        score: textScore,
        factors: {
          titleSimilarity: titleScore,
          descriptionSimilarity: descScore,
          keywordOverlap: keywordScore
        },
        method: 'text'
      };
    }).filter(result => result.score > 0.5); // Only return significant matches
  }
  /**
  * Find complaints in similar geographic locations
  */
  async findLocationSimilarity(complaint) {
    if (!complaint.latitude || !complaint.longitude) {
      return [];
    }
    // Search within 1km radius
    const radiusKm = 1.0;
    const { data: candidates, error } = await this.supabase
      .from('complaints')
      .select('*')
      .neq('id', complaint.id)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .gte('submitted_at', this.getTimeThreshold(90)) // Last 90 days
      .limit(100);
    if (error) {
      console.error('[DUPLICATION] Location similarity error:', error);
      return [];
    }
    return candidates.map(candidate => {
      const distance = this.calculateDistance(
        complaint.latitude,
        complaint.longitude,
        candidate.latitude,
        candidate.longitude
      );
      // Score decreases with distance
      let locationScore = 0;
      if (distance <= 0.05) locationScore = 1.0;      // Within 50m: perfect match
      else if (distance <= 0.1) locationScore = 0.9;  // Within 100m: very high
      else if (distance <= 0.25) locationScore = 0.75; // Within 250m: high
      else if (distance <= 0.5) locationScore = 0.5;  // Within 500m: medium
      else if (distance <= 1.0) locationScore = 0.25; // Within 1km: low
      else return null;
      return {
        complaint_id: candidate.id,
        score: locationScore,
        factors: {
          distanceKm: distance,
          sameStreet: this.isSameStreet(complaint.location_text, candidate.location_text)
        },
        method: 'location'
      };
    }).filter(result => result !== null);
  }
  /**
  * Find complaints submitted within similar time period
  */
  async findTemporalSimilarity(complaint) {
    // Check for complaints within 7 days
    const beforeDate = new Date(complaint.submitted_at);
    beforeDate.setDate(beforeDate.getDate() - 7);
    const afterDate = new Date(complaint.submitted_at);
    afterDate.setDate(afterDate.getDate() + 7);
    const { data: candidates, error } = await this.supabase
      .from('complaints')
      .select('*')
      .neq('id', complaint.id)
      .eq('category', complaint.category)
      .gte('submitted_at', beforeDate.toISOString())
      .lte('submitted_at', afterDate.toISOString())
      .limit(50);
    if (error) {
      console.error('[DUPLICATION] Temporal similarity error:', error);
      return [];
    }
    return candidates.map(candidate => {
      const timeDiff = Math.abs(
        new Date(complaint.submitted_at) - new Date(candidate.submitted_at)
      ) / (1000 * 60 * 60 * 24); // Days
      // Score decreases with time difference
      let temporalScore = 0;
      if (timeDiff <= 1) temporalScore = 1.0;      // Same day
      else if (timeDiff <= 3) temporalScore = 0.8; // Within 3 days
      else if (timeDiff <= 7) temporalScore = 0.5; // Within week
      else return null;
      return {
        complaint_id: candidate.id,
        score: temporalScore,
        factors: {
          daysDifference: timeDiff
        },
        method: 'temporal'
      };
    }).filter(result => result !== null);
  }
  /**
  * Merge results from different algorithms and calculate final score
  */
  mergeAndScore(textMatches, locationMatches, temporalMatches) {
    const allMatches = new Map();
    // Combine all matches
    [...textMatches, ...locationMatches, ...temporalMatches].forEach(match => {
      if (!allMatches.has(match.complaint_id)) {
        allMatches.set(match.complaint_id, {
          complaint_id: match.complaint_id,
          scores: { text: 0, location: 0, temporal: 0 },
          factors: {}
        });
      }
      const existing = allMatches.get(match.complaint_id);
      existing.scores[match.method] = match.score;
      existing.factors = { ...existing.factors, ...match.factors };
    });
    // Calculate weighted final score
    const results = Array.from(allMatches.values()).map(match => {
      // Weighted scoring: text (40%), location (40%), temporal (20%)
      const finalScore =
        match.scores.text * 0.4 +
        match.scores.location * 0.4 +
        match.scores.temporal * 0.2;
      // Determine confidence level
      let confidence = 'low';
      if (finalScore >= 0.85) confidence = 'very_high';
      else if (finalScore >= 0.75) confidence = 'high';
      else if (finalScore >= 0.60) confidence = 'medium';
      return {
        similar_complaint_id: match.complaint_id,
        similarity_score: finalScore,
        confidence,
        similarity_factors: {
          textScore: match.scores.text,
          locationScore: match.scores.location,
          temporalScore: match.scores.temporal,
          ...match.factors
        }
      };
    });
    // Sort by score descending
    return results.sort((a, b) => b.similarity_score - a.similarity_score);
  }
  /**
  * Save similarity results to database
  */
  async saveSimilarityResults(complaintId, results) {
    const records = results.map(result => ({
      complaint_id: complaintId,
      similar_complaint_id: result.similar_complaint_id,
      similarity_score: result.similarity_score,
      similarity_factors: result.similarity_factors,
      detected_at: new Date().toISOString()
    }));
    if (records.length === 0) return;
    const { error } = await this.supabase
      .from('complaint_similarities')
      .upsert(records, {
        onConflict: 'complaint_id,similar_complaint_id',
        ignoreDuplicates: false
      });
    if (error) {
      console.error('[DUPLICATION] Save error:', error);
    }
  }
  /**
  * Calculate text similarity using Levenshtein distance
  */
  calculateTextSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }
  /**
  * Levenshtein distance algorithm
  */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {

      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }
  /**
  * Calculate keyword overlap between two texts
  */
  calculateKeywordOverlap(text1, text2) {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were']);
    const words1 = text1.toLowerCase().split(/\W+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    const words2 = text2.toLowerCase().split(/\W+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(word => set2.has(word)));
    const union = new Set([...set1, ...set2]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  /**
  * Calculate distance between two geographic points (Haversine formula)
  * Returns distance in kilometers
  */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
  * Check if two locations are on the same street
  */
  isSameStreet(location1, location2) {
    if (!location1 || !location2) return false;

    const normalize = str => str.toLowerCase()
      .replace(/street|st\.|road|rd\.|avenue|ave\./gi, '')
      .trim();
    const loc1 = normalize(location1);
    const loc2 = normalize(location2);
    return loc1.includes(loc2) || loc2.includes(loc1);
  }
  /**
  * Get timestamp threshold (X days ago)
  */
  getTimeThreshold(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }
}

module.exports = DuplicationDetectionService;
