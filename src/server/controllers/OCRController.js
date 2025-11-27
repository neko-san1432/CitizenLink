const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const Tesseract = require('tesseract.js');
const IDVerificationService = require('../services/IDVerificationService');

// Try to load Sharp, but make it optional
let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  console.warn('[OCR] Sharp not available, will skip image preprocessing');
}

class OCRController {
  /**
   * Detect ID type from extracted text
   */
  detectIdType(text) {
    const normalized = text.toUpperCase();
    
    if (normalized.includes('PHILIPPINE POSTAL CORPORATION') || 
        normalized.includes('POSTAL IDENTITY CARD') ||
        normalized.includes('PHLPOST') ||
        normalized.includes('POSTAL ID')) {
      return 'philpost';
    }
    
    if (normalized.includes('PAMBANSANG PAGKAKAKILANLAN') ||
        normalized.includes('PHILIPPINE IDENTIFICATION CARD') ||
        normalized.includes('REPUBLIKA NG PILIPINAS') && normalized.includes('PAGKAKAKILANLAN')) {
      return 'philid';
    }
    
    if (normalized.includes('DRIVER\'S LICENSE') ||
        normalized.includes('DRIVERS LICENSE') ||
        normalized.includes('LAND TRANSPORTATION OFFICE') ||
        normalized.includes('LTO') ||
        normalized.includes('NON-PROFESSIONAL') ||
        normalized.includes('PROFESSIONAL')) {
      return 'drivers_license';
    }
    
    return 'unknown';
  }

  /**
   * Combine multiple OCR results to get the best text extraction
   */
  combineOcrResults(results) {
    if (results.length === 0) return '';
    if (results.length === 1) return results[0].text;
    
    // Extract unique lines from all results
    const allLines = new Set();
    results.forEach(result => {
      const lines = result.text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 2); // Filter out very short lines
      lines.forEach(line => allLines.add(line));
    });
    
    // Sort by length (longer lines are usually more complete)
    return Array.from(allLines)
      .sort((a, b) => b.length - a.length)
      .join('\n');
  }

  /**
   * Parse extracted text to find relevant ID fields based on ID type
   */
  parseIdFields(text, idType = 'unknown') {
    // Auto-detect if not provided
    if (idType === 'unknown') {
      idType = this.detectIdType(text);
    }
    
    // Use format-specific parsers
    switch (idType) {
      case 'philid':
        return this.parsePhilId(text);
      case 'philpost':
        return this.parsePhilPost(text);
      case 'drivers_license':
        return this.parseDriversLicense(text);
    }

    return {};
  }

  /**
   * Helper: Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Helper: Find field value by looking for a label
   */
  findFieldByLabel(lines, labels, valuePattern = null) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      for (const label of labels) {
        const lineUpper = line.toUpperCase();
        const labelUpper = label.toUpperCase();
        
        // Check if label appears in line with word boundaries
        const labelRegex = new RegExp(`(^|[^A-Z])${labelUpper.replace(/\s+/g, '\\s+')}($|[^A-Z])`, 'i');
        if (labelRegex.test(line)) {
          const match = line.match(labelRegex);
          const labelEndIndex = match.index + match[0].length - (match[2] ? 1 : 0);
          let value = line.substring(labelEndIndex).replace(/[:.\\/]/g, '').trim();
          
          // Check if value looks like another label
          const labelKeywords = ['LAST', 'NAME', 'FIRST', 'GIVEN', 'MIDDLE', 'NAMES', 'PANGALAN', 'APILYEDO', 'APELYIDO', 'GITNANG'];
          const valueWords = value.toUpperCase().split(/\s+/);
          const hasLabelKeyword = valueWords.some(w => labelKeywords.includes(w));
          
          // Use next line if value is empty or looks like a label
          if ((value.length < 2 || hasLabelKeyword) && i + 1 < lines.length) {
             value = lines[i + 1].trim();
          }
          
          // Clean value
          let cleaned = value.replace(/[^A-Z0-9\s.-]/gi, '').trim();
          cleaned = cleaned.replace(/^(oy|Yr|sh|w|a|i|d|v|J|ju|fa|Ra|pn)\s+/i, '').trim();
          cleaned = cleaned.replace(/\s+(Yr|oy|sh|w|a|i|d|v|J)$/i, '').trim();
          cleaned = cleaned.replace(/\s+\d+$/g, '').trim();
          
          // If still too short, try next line
          if (cleaned.length < 3 && i + 1 < lines.length) {
            value = lines[i + 1].trim();
            cleaned = value.replace(/[^A-Z0-9\s.-]/gi, '').trim();
            cleaned = cleaned.replace(/^(oy|Yr|sh|w|a|i|d|v|J|ju|fa|Ra|pn)\s+/i, '').trim();
            cleaned = cleaned.replace(/\s+(Yr|oy|sh|w|a|i|d|v|J)$/i, '').trim();
            cleaned = cleaned.replace(/\s+\d+$/g, '').trim();
          }
          
          
          // Validate if pattern provided
          if (valuePattern && !valuePattern.test(cleaned.toUpperCase())) {
            console.log(`[OCR] Label "${label}" matched but value "${cleaned}" failed pattern validation`);
            continue;
          }
          
          console.log(`[OCR] Matched field "${label}" -> "${cleaned}"`);
          return cleaned;
        }
      }
    }
    return null;
  }

  /**
   * Helper: Clean and validate name fields
   */
  cleanAndValidateName(value) {
    if (!value) return null;
    
    const EXCLUDED_WORDS = [
        'REPUBLIKA', 'PILIPINAS', 'PHILIPPINES', 'PAGKAKAKILANLAN', 
        'LAST', 'NAME', 'GIVEN', 'APILYEDO', 'MGA', 'PANGALAN', 
        'GITNANG', 'MIDDLE', 'SEX', 'DATE', 'BIRTH', 'ADDRESS',
        'TIRAHAN', 'LALAKI', 'BABAE', 'MALE', 'FEMALE',
        'HALALAN', 'KOMISYON', 'PHILSYS', 'CARD', 'NUMBER',
        'ID', 'ISSUE', 'ISSUING', 'AUTHORITY', 'NAMAS', 'IZ',
        'PUBLIKA', 'PILIPINA', 'OO', '00', 'REPUBLIC', 'PHILIPPINE',
        'EPUBLIKA'
    ];

    // Check for digits - names should not have numbers (except maybe suffixes like 3rd, but rare on IDs)
    if (/\d/.test(value)) return null;

    // Normalize: Uppercase, remove non-name chars (keep letters, spaces, dots, dashes)
    let cleaned = value.toUpperCase().replace(/[^A-Z\s.-]/g, ' ').trim();
    cleaned = cleaned.replace(/\s+/g, ' '); // Collapse spaces

    // Must have at least 2 letters
    const letterCount = (cleaned.match(/[A-Z]/g) || []).length;
    if (letterCount < 2) return null;

    // Check against excluded words
    const words = cleaned.split(' ');
    const isExcluded = words.some(word => {
        return EXCLUDED_WORDS.some(excluded => {
            if (word === excluded) return true;
            // Fuzzy match for longer words
            if (excluded.length > 4) {
                return this.levenshteinDistance(word, excluded) <= 2;
            }
            return false;
        });
    });

    if (isExcluded) return null;
    
    // Strict regex checks for headers
    if (/REPUBLIKA|PILIPINAS|PHILIPPINES|PHILSYS|PUBLIKA/i.test(cleaned)) return null;

    return cleaned;
  }

  /**
   * Parse Philippine National ID (PhilID)
   */
  parsePhilId(text) {
    console.log('[OCR] DEBUG MARKER: parsePhilId started');

    const fields = {
      lastName: null,
      firstName: null,
      middleName: null,
      birthDate: null,
      sex: null,
      address: null,
      idNumber: null
    };

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // PhilSys Card Number (PCN)
    const idMatch = text.match(/(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})/);
    if (idMatch) fields.idNumber = idMatch[1].replace(/[\s-]/g, '');

    // Label-based extraction
    fields.lastName = this.findFieldByLabel(lines, ['Apelyido', 'Apilyedo', 'Apalyida', 'Apalyido', 'Last Name'], /^[A-Z\s.-]+$/);
    fields.firstName = this.findFieldByLabel(lines, ['Mga Pangalan', 'Given Names', 'Pangalan'], /^[A-Z\s.-]+$/);
    fields.middleName = this.findFieldByLabel(lines, ['Gitnang Apelyido', 'Gitnang Apilyedo', 'witnang', 'Middle Name'], /^[A-Z\s.-]+$/);
    fields.address = this.findFieldByLabel(lines, ['Tirahan', 'Address', 'Nrahan'], null);

    // Validate and clean extracted names immediately
    fields.lastName = this.cleanAndValidateName(fields.lastName);
    fields.firstName = this.cleanAndValidateName(fields.firstName);
    fields.middleName = this.cleanAndValidateName(fields.middleName);

    // Date of Birth
    const dateMatch = text.match(/([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i);
    if (dateMatch) {
      fields.birthDate = this.parseDateString(dateMatch[0]);
    } else {
      const dobRaw = this.findFieldByLabel(lines, ['Petsa ng Kapanganakan', 'Date of Birth', 'falsa ng']);
      if (dobRaw) fields.birthDate = this.parseDateString(dobRaw);
    }
    
    // Fallback to heuristic if label-based failed
    let nameLines = [];
    if (!fields.lastName || !fields.firstName) {
        console.log('[OCR] Label-based extraction failed for names, trying heuristic fallback...');

        // Find lines that look like names
        nameLines = lines.map(l => this.cleanAndValidateName(l)).filter(l => l !== null);
        
        // Filter out address if already found
        if (fields.address) {
            const addrUpper = fields.address.toUpperCase();
            nameLines = nameLines.filter(l => !addrUpper.includes(l) && !l.includes(addrUpper));
        }

        console.log('[OCR] Potential name lines found via heuristic:', nameLines);
        
        if (nameLines.length > 0) {
             if (!fields.lastName && nameLines.length >= 1) fields.lastName = nameLines[0];
             if (!fields.firstName && nameLines.length >= 2) fields.firstName = nameLines[1];
             if (!fields.middleName && nameLines.length >= 3) fields.middleName = nameLines[2];
        }
    }

    // Sex/Gender
    if (text.match(/\bMALE\b/i) || text.match(/\bLALAKI\b/i)) fields.sex = 'Male';
    else if (text.match(/\bFEMALE\b/i) || text.match(/\bBABAE\b/i)) fields.sex = 'Female';

    console.log('[OCR] Extracted PhilID fields (raw):', fields);
    
    // Format to the requested JSON structure
    const formatted = {
      full_name: {
        value: [fields.firstName, fields.middleName, fields.lastName].filter(Boolean).join(' '),
        confidence: fields.firstName && fields.lastName ? 0.9 : 0.0
      },
      sex: {
        value: fields.sex || "",
        confidence: fields.sex ? 0.9 : 0.0
      },
      date_of_birth: {
        value: fields.birthDate || "",
        confidence: fields.birthDate ? 0.9 : 0.0
      },
      address: {
        value: fields.address || "",
        confidence: fields.address ? 0.8 : 0.0
      },
      public_id_number: {
        value: fields.idNumber || "",
        confidence: fields.idNumber ? 0.95 : 0.0
      },
      issue_date: {
        value: "",
        confidence: 0.0
      },
      face_region_detected: {
        value: false,
        confidence: 0.0
      },
      signature_region_detected: {
        value: false,
        confidence: 0.0
      },
      qr_code_data: {
        value: "",
        confidence: 0.0
      }
    };

    // Log to file for debugging (Always run this)
    try {
        const debugLog = `
[${new Date().toISOString()}]
Raw Lines: ${JSON.stringify(lines, null, 2)}
Extracted Fields: ${JSON.stringify(fields, null, 2)}
Name Lines (Heuristic): ${JSON.stringify(nameLines, null, 2)}
`;
        fs.writeFileSync('C:/Users/User/Documents/Projects/acads/CitizenLink/ocr-debug.log', debugLog);
    } catch (e) { console.error('Failed to write debug log', e); }

    return formatted;
  }

  /**
   * Parse Postal ID
   */
  parsePhilPost(text) {
    const fields = {
      lastName: null,
      firstName: null,
      middleName: null,
      address: null,
      idNumber: null,
      birthDate: null
    };

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // PRN number
    const prnMatch = text.match(/([A-Z]\d{3}[\s-]?\d{4}[\s-]?\d{4})/);
    if (prnMatch) fields.idNumber = prnMatch[1];

    fields.address = this.findFieldByLabel(lines, ['Address', 'Tirahan'], null);
    
    // Dates
    const dates = text.match(/\d{4}[-/]\d{2}[-/]\d{2}/g);
    if (dates && dates.length >= 1) fields.birthDate = this.parseDateString(dates[0]);

    return this.cleanFields(fields);
  }

  /**
   * Parse Driver's License
   */
  parseDriversLicense(text) {
    const fields = {
      lastName: null,
      firstName: null,
      middleName: null,
      address: null,
      idNumber: null,
      birthDate: null,
      agency: 'LTO'
    };

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // License number
    const licMatch = text.match(/([A-Z]\d{2}-?\d{2}-?\d{6})/);
    if (licMatch) fields.idNumber = licMatch[1];

    // Dates
    const dates = text.match(/\d{4}[-/]\d{2}[-/]\d{2}/g);
    if (dates && dates.length > 0) fields.birthDate = this.parseDateString(dates[0]);

    // Sex
    if (text.match(/\bM\b/) || text.match(/\bMale\b/i)) fields.sex = 'Male';
    else if (text.match(/\bF\b/) || text.match(/\bFemale\b/i)) fields.sex = 'Female';

    return this.cleanFields(fields);
  }

  /**
   * Helper: Parse date string in various formats
   */
  parseDateString(dateStr) {
    if (!dateStr) return null;
    
    try {
      // Handle format: "JULY 14, 2004" or "14 Aug 80"
      const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
                         'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
      const monthAbbr = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 
                         'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      
      // Try parsing "MONTH DAY, YEAR" format
      const monthDayYearMatch = dateStr.match(/([A-Z]+)\s+(\d{1,2}),?\s+(\d{2,4})/i);
      if (monthDayYearMatch) {
        const monthName = monthDayYearMatch[1].toUpperCase();
        const day = monthDayYearMatch[2].padStart(2, '0');
        let year = monthDayYearMatch[3];
        
        // Handle 2-digit years
        if (year.length === 2) {
          const yearNum = parseInt(year);
          year = yearNum > 50 ? `19${year}` : `20${year}`;
        }
        
        let monthIndex = monthNames.indexOf(monthName);
        if (monthIndex === -1) {
          monthIndex = monthAbbr.findIndex(m => monthName.startsWith(m));
        }
        
        if (monthIndex !== -1) {
          const month = (monthIndex + 1).toString().padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
      
      // Handle numeric formats: YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY
      const parts = dateStr.split(/[-/]/);
      if (parts.length === 3) {
        let year, month, day;
        if (parts[0].length === 4) {
          // YYYY-MM-DD format
          [year, month, day] = parts;
        } else {
          // MM-DD-YYYY or DD-MM-YYYY
          if (parseInt(parts[0]) > 12) {
            // DD-MM-YYYY
            [day, month, year] = parts;
          } else {
            // MM-DD-YYYY
            [month, day, year] = parts;
          }
        }
        
        // Handle 2-digit years
        if (year.length === 2) {
          const yearNum = parseInt(year);
          year = yearNum > 50 ? `19${year}` : `20${year}`;
        }
        
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Helper: Clean fields object by removing null/empty values
   */
  cleanFields(fields) {
    const cleaned = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== null && value !== '' && value !== undefined) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  /**
   * Detect and crop ID card from image
   */
  async detectAndCropCard(imagePath) {
    if (!sharp) return imagePath;

    try {
      console.log('[OCR] Attempting to detect and crop card...');
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      // Strategy 1: Trim uniform background (e.g. scanning against white/black background)
      const trimmedBuffer = await image.clone()
        .trim({ threshold: 50 }) // Higher threshold for noisier backgrounds
        .toBuffer();
        
      const trimmedMeta = await sharp(trimmedBuffer).metadata();
      
      // Check if trimming did anything significant
      const widthRatio = trimmedMeta.width / metadata.width;
      const heightRatio = trimmedMeta.height / metadata.height;
      
      let finalBuffer = trimmedBuffer;
      let usedStrategy = 'trim';
      
      if (widthRatio > 0.95 && heightRatio > 0.95) {
         console.log('[OCR] Trimming ineffective, using original image.');
         // Smart crop proved unreliable with complex backgrounds, so we skip it
         return imagePath;
      }
      
      // Save to new temp file
      const parsedPath = path.parse(imagePath);
      const cropPath = path.join(parsedPath.dir, `${parsedPath.name}_cropped${parsedPath.ext}`);
      
      await sharp(finalBuffer).toFile(cropPath);
      
      console.log(`[OCR] Card cropped using ${usedStrategy}. Saved to: ${cropPath}`);
      return cropPath;
      
    } catch (error) {
      console.warn('[OCR] Card detection failed, using original image:', error.message);
      return imagePath;
    }
  }

  async processId(req, res) {
    let intermediateFiles = [];
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      console.log('[OCR] Received file:', {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path
      });

      // Check if file is an image
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          error: 'File must be an image (JPEG, PNG, etc.)'
        });
      }

      // Enhanced image preprocessing with Sharp for better OCR accuracy
      let processedImagePath = null;
      let workingPath = file.path;
      
      if (sharp) {
        try {
          // 1. Detect and Crop Card
          const croppedPath = await this.detectAndCropCard(file.path);
          if (croppedPath !== file.path) {
             workingPath = croppedPath;
             intermediateFiles.push(workingPath);
          }

          // 2. Preprocess for OCR (Resize, Binarize, etc.)
          const metadata = await sharp(workingPath).metadata();
          console.log('[OCR] Processing image:', { width: metadata.width, height: metadata.height });
          
          // Scale up image if it's too small (minimum 1500px width for better OCR)
          const minWidth = 1500;
          const scaleFactor = metadata.width < minWidth ? minWidth / metadata.width : 1;
          const targetWidth = Math.round(metadata.width * scaleFactor);
          const targetHeight = Math.round(metadata.height * scaleFactor);
          
          // Create enhanced preprocessing pipeline
          let pipeline = sharp(workingPath)
            .resize(targetWidth, targetHeight, {
              kernel: sharp.kernel.lanczos3,
              fit: 'fill'
            })
            .greyscale() // Convert to grayscale
            .normalize({ // Enhance contrast
              lower: 5,
              upper: 95
            })
            .modulate({ // Adjust brightness and saturation
              brightness: 1.1,
              saturation: 1.2
            })
            .sharpen({
              sigma: 1.5,
              m1: 1.0,
              m2: 2.0,
              x1: 10,
              y2: 10,
              y3: 20,
            });

          // Save processed image
          processedImagePath = path.join(path.dirname(file.path), `processed_${path.basename(file.path)}`);
          await pipeline.toFile(processedImagePath);
          intermediateFiles.push(processedImagePath);
          
          console.log('[OCR] Image preprocessed and saved to:', processedImagePath);
        } catch (err) {
          console.error('[OCR] Preprocessing failed:', err);
          // Fallback to original if processing fails
          processedImagePath = file.path;
        }
      } else {
        processedImagePath = file.path;
      }

      // Perform OCR
      console.log('[OCR] Starting Tesseract recognition...');
      const worker = await Tesseract.createWorker('eng');
      
      // Configure Tesseract for ID cards
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-.,/ ',
        preserve_interword_spaces: '1',
      });

      const { data: { text, confidence } } = await worker.recognize(processedImagePath);
      await worker.terminate();

      console.log(`[OCR] Recognition complete. Confidence: ${confidence}%`);
      
      // Clean up temp files
      try {
        for (const p of intermediateFiles) {
            if (fs.existsSync(p)) await fsPromises.unlink(p).catch(() => {});
        }
      } catch (e) { console.error('[OCR] Cleanup error:', e); }

      // Parse fields
      const idType = this.detectIdType(text);
      console.log(`[OCR] Detected ID type: ${idType}`);
      
      const fields = this.parseIdFields(text, idType);
      
      return res.json({
        success: true,
        idType,
        fields,
        confidence,
        message: 'ID processed successfully'
      });

    } catch (error) {
      console.error('[OCR] Processing error:', error);
      
      // Clean up on error
      try {
        for (const p of intermediateFiles) {
            if (fs.existsSync(p)) await fsPromises.unlink(p).catch(() => {});
        }
      } catch (e) {}

      return res.status(500).json({
        success: false,
        error: 'Failed to process ID',
        message: error.message
      });
    }
  }
}

const ocrController = new OCRController();

// Bind methods to ensure 'this' context is preserved
module.exports = {
  processId: ocrController.processId.bind(ocrController)
};
