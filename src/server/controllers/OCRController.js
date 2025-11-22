const path = require('path');
const { promises: fs } = require('fs');
const Tesseract = require('tesseract.js');

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
        (normalized.includes('REPUBLIKA NG PILIPINAS') && normalized.includes('PAGKAKAKILANLAN'))) {
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
      default:
        return this.parseGenericId(text);
    }
  }

  /**
   * Parse Philippine National ID (PhilID)
   * Format: Apelyido/Last Name, Mga Pangalan/Given Names, Gitnang Apelyido/Middle Name
   */
  parsePhilId(text) {
    const fields = {
      firstName: null,
      lastName: null,
      middleName: null,
      addressLine1: null,
      addressLine2: null,
      barangay: null,
      sex: null,
      idNumber: null,
      birthDate: null,
      expiryDate: null
    };

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const normalizedText = text.replace(/\s+/g, ' ').trim();

    // Extract PhilID number (XXXX-XXXX-XXXX-XXXX)
    const idMatch = normalizedText.match(/\b(\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4})\b/);
    if (idMatch) {
      fields.idNumber = idMatch[1].replace(/\s+/g, '-');
    }

    // Extract names - PhilID uses label/value format
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
      
      // Last Name / Apelyido
      if (line.match(/(?:Apelyido|Last\s*Name)/i) && nextLine) {
        const value = nextLine.trim();
        if (value && value.length > 1 && !value.match(/^(REPUBLIKA|PAMBANSANG|Philippine)/i)) {
          fields.lastName = value;
        }
      }
      
      // Given Names / Mga Pangalan
      if (line.match(/(?:Mga\s*Pangalan|Given\s*Names)/i) && nextLine) {
        const value = nextLine.trim();
        if (value && value.length > 1 && !value.match(/^(REPUBLIKA|PAMBANSANG|Philippine)/i)) {
          const parts = value.split(/\s+/);
          if (parts.length >= 2) {
            fields.firstName = parts[0];
            fields.middleName = parts.slice(1).join(' ');
          } else {
            fields.firstName = value;
          }
        }
      }
      
      // Middle Name / Gitnang Apelyido
      if (line.match(/(?:Gitnang\s*Apelyido|Middle\s*Name)/i) && nextLine) {
        const value = nextLine.trim();
        if (value && value.length > 1 && !value.match(/^(REPUBLIKA|PAMBANSANG|Philippine)/i)) {
          fields.middleName = value;
        }
      }
      
      // Date of Birth / Petsa ng Kapanganakan
      if (line.match(/(?:Petsa\s*ng\s*Kapanganakan|Date\s*of\s+Birth|Birthday)/i) && nextLine) {
        const dateMatch = nextLine.match(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2}|[A-Z]+\s+\d{1,2},\s+\d{4})\b/);
        if (dateMatch) {
          fields.birthDate = this.parseDateString(dateMatch[1]);
        }
      }
      
      // Address / Tirahan
      if (line.match(/(?:Tirahan|Address)/i) && nextLine) {
        const value = nextLine.trim();
        if (value && value.length > 5 && !value.match(/^(REPUBLIKA|PAMBANSANG|Philippine)/i)) {
          // Extract barangay from address
          const barangayMatch = value.match(/(?:Brgy|Barangay|Zone)\s*([A-Z0-9\s]+)/i);
          if (barangayMatch) {
            fields.barangay = barangayMatch[1].trim();
          }
          fields.addressLine1 = value;
        }
      }
    }

    return this.cleanFields(fields);
  }

  /**
   * Parse PhilPost (Postal ID)
   * Format: First Name, Middle Name, Surname, Suffix
   */
  parsePhilPost(text) {
    const fields = {
      firstName: null,
      lastName: null,
      middleName: null,
      addressLine1: null,
      addressLine2: null,
      barangay: null,
      sex: null,
      idNumber: null,
      birthDate: null,
      expiryDate: null
    };

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const normalizedText = text.replace(/\s+/g, ' ').trim();

    // Extract PRN (Postal Registration Number)
    const prnMatch = normalizedText.match(/\b(PRN\s*)?(\d{12,})\b/i);
    if (prnMatch) {
      fields.idNumber = prnMatch[2] || prnMatch[1];
    }

    // Extract name - PhilPost format: "First Name, Middle Name, Surname, Suffix" or "SURNAME, FIRSTNAME MIDDLENAME"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
      
      // Look for name field label
      if (line.match(/(?:First\s*Name|Middle\s*Name|Surname|Suffix)/i)) {
        // Name might be on same line or next line
        const nameLine = nextLine && nextLine.length > 5 ? nextLine : line;
        const nameMatch = nameLine.match(/([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s*,\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)/);
        if (nameMatch) {
          // Format: LASTNAME, FIRSTNAME MIDDLENAME
          fields.lastName = nameMatch[1].trim();
          const firstParts = nameMatch[2].trim().split(/\s+/);
          fields.firstName = firstParts[0] || null;
          fields.middleName = firstParts.slice(1).join(' ') || null;
        } else {
          // Format: FIRSTNAME MIDDLENAME LASTNAME (all caps)
          const allCapsMatch = nameLine.match(/^([A-Z]{2,})\s+([A-Z]{2,})\s+([A-Z]{2,})$/);
          if (allCapsMatch) {
            fields.firstName = allCapsMatch[1];
            fields.middleName = allCapsMatch[2];
            fields.lastName = allCapsMatch[3];
          }
        }
      }
      
      // Extract address - PhilPost format: Street, Barangay, City
      if (line.match(/(?:Address|Tirahan)/i) || nextLine.match(/^\d+\s+[A-Z]/)) {
        const addressLine = nextLine && nextLine.match(/^\d+/) ? nextLine : line;
        if (addressLine && addressLine.length > 5) {
          const parts = addressLine.split(',').map(p => p.trim());
          if (parts.length >= 1) fields.addressLine1 = parts[0];
          if (parts.length >= 2) {
            // Check if it's barangay
            if (parts[1].match(/(?:Brgy|Barangay)/i)) {
              fields.barangay = parts[1].replace(/(?:Brgy|Barangay)\s*/i, '').trim();
            } else {
              fields.addressLine2 = parts[1];
            }
          }
          if (parts.length >= 3) {
            // Usually city
            fields.addressLine2 = (fields.addressLine2 || '') + ', ' + parts[2];
          }
        }
      }
      
      // Extract birthdate
      if (line.match(/(?:\d{1,2}\s+[A-Z]{3}\s+\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/)) {
        const dateMatch = line.match(/(\d{1,2}\s+[A-Z]{3}\s+\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/);
        if (dateMatch && !fields.birthDate) {
          fields.birthDate = this.parseDateString(dateMatch[1]);
        }
      }
      
      // Extract expiry date
      if (line.match(/(?:Valid\s+Until|Expires?)/i) && nextLine) {
        const dateMatch = nextLine.match(/(\d{1,2}\s+[A-Z]{3}\s+\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/);
        if (dateMatch) {
          fields.expiryDate = this.parseDateString(dateMatch[1]);
        }
      }
    }

    return this.cleanFields(fields);
  }

  /**
   * Parse Driver's License
   * Format: Last Name, First Name, Middle Name
   */
  parseDriversLicense(text) {
    const fields = {
      firstName: null,
      lastName: null,
      middleName: null,
      addressLine1: null,
      addressLine2: null,
      barangay: null,
      sex: null,
      idNumber: null,
      birthDate: null,
      expiryDate: null
    };

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const normalizedText = text.replace(/\s+/g, ' ').trim();

    // Extract License Number
    const licenseMatch = normalizedText.match(/(?:License\s*No|License\s*Number)[:\s]*([A-Z0-9-]+)/i);
    if (licenseMatch) {
      fields.idNumber = licenseMatch[1];
    }

    // Extract name - Driver's License format: "Last Name, First Name, Middle Name"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
      
      // Look for "Last Name, First Name, Middle Name" label
      if (line.match(/(?:Last\s*Name|First\s*Name|Middle\s*Name)/i)) {
        const nameLine = nextLine && nextLine.length > 5 ? nextLine : line;
        // Format: LASTNAME, FIRSTNAME, MIDDLENAME or LASTNAME, FIRSTNAME MIDDLENAME
        const nameMatch = nameLine.match(/([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s*,\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)\s*,?\s*([A-Z][A-Za-z]+)?/);
        if (nameMatch) {
          fields.lastName = nameMatch[1].trim();
          const firstParts = nameMatch[2].trim().split(/\s+/);
          fields.firstName = firstParts[0] || null;
          if (nameMatch[3]) {
            fields.middleName = nameMatch[3].trim();
          } else if (firstParts.length > 1) {
            fields.middleName = firstParts.slice(1).join(' ');
          }
        }
      }
      
      // Extract Date of Birth
      if (line.match(/(?:Date\s+of\s+Birth|Birthday)/i) && nextLine) {
        const dateMatch = nextLine.match(/(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})/);
        if (dateMatch) {
          fields.birthDate = this.parseDateString(dateMatch[1]);
        }
      }
      
      // Extract Expiration Date
      if (line.match(/(?:Expiration\s+Date|Expiry|Valid\s+Until)/i) && nextLine) {
        const dateMatch = nextLine.match(/(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})/);
        if (dateMatch) {
          fields.expiryDate = this.parseDateString(dateMatch[1]);
        }
      }
      
      // Extract Sex
      if (line.match(/(?:Sex|Gender)[:\s]*(Male|Female|M|F)/i)) {
        const sexMatch = line.match(/(?:Sex|Gender)[:\s]*(Male|Female|M|F)/i);
        if (sexMatch) {
          const sex = sexMatch[1].toLowerCase();
          fields.sex = sex === 'm' ? 'Male' : sex === 'f' ? 'Female' : sexMatch[1];
        }
      }
      
      // Extract Address
      if (line.match(/(?:Address|Tirahan)/i) && nextLine) {
        const addressValue = nextLine.trim();
        if (addressValue && addressValue.length > 5) {
          // Driver's license address format: UNIT/HOUSE NO. BUILDING, STREET NAME, BARANGAY, CITY/MUNICIPALITY
          const parts = addressValue.split(',').map(p => p.trim());
          if (parts.length >= 1) fields.addressLine1 = parts[0];
          if (parts.length >= 2) fields.addressLine2 = parts[1];
          if (parts.length >= 3) {
            // Usually barangay
            const barangayMatch = parts[2].match(/(?:Brgy|Barangay)\s*(.+)/i);
            if (barangayMatch) {
              fields.barangay = barangayMatch[1].trim();
            } else {
              fields.barangay = parts[2];
            }
          }
        }
      }
    }

    return this.cleanFields(fields);
  }

  /**
   * Generic ID parser (fallback)
   */
  parseGenericId(text) {
    const fields = {
      firstName: null,
      lastName: null,
      middleName: null,
      addressLine1: null,
      addressLine2: null,
      barangay: null,
      sex: null,
      idNumber: null,
      birthDate: null,
      expiryDate: null
    };

    // Normalize text: remove extra whitespace, convert to single line for easier parsing
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Extract ID Number - PhilID format: XXXX-XXXX-XXXX-XXXX (16 digits)
    const idPatterns = [
      /\b(\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4})\b/, // PhilID format: 2467-9042-1741-3581
      /\b(\d{4}[- ]?\d{4}[- ]?\d{4})\b/, // Alternative: XXXX-XXXX-XXXX
      /\b([A-Z0-9]{4}[- ]?[A-Z0-9]{4}[- ]?[A-Z0-9]{4}[- ]?[A-Z0-9]{4})\b/, // Alphanumeric
      /(?:PSN|ID|ID\s*No|ID\s*Number)[:\s]*([A-Z0-9-]{12,})\b/i, // With label
      /\b([A-Z0-9]{4}[- ]?[A-Z0-9]{4}[- ]?[A-Z0-9]{4})\b/ // Alphanumeric shorter
    ];
    for (const pattern of idPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        fields.idNumber = match[1].replace(/\s+/g, '-');
        break;
      }
    }

    // Extract dates - PhilID format: "Birthday" or "Kapanganakan" label followed by date
    const dates = [];
    
    // First, look for labeled dates (more accurate)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
      
      // Look for "Birthday", "Kapanganakan", "Date of Birth" labels
      if (line.match(/(?:Birthday|Kapanganakan|Date\s+of\s+Birth|DOB)/i) && nextLine) {
        const dateMatch = nextLine.match(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2})\b/);
        if (dateMatch) {
          dates.push({ value: dateMatch[1], type: 'birth' });
        }
      }
      
      // Look for "Expiry" or "Valid Until" labels
      if (line.match(/(?:Expiry|Valid\s+Until|Expires)/i) && nextLine) {
        const dateMatch = nextLine.match(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2})\b/);
        if (dateMatch) {
          dates.push({ value: dateMatch[1], type: 'expiry' });
        }
      }
    }
    
    // Fallback: Extract all dates from text
    const datePatterns = [
      /\b(\d{4}[-/]\d{2}[-/]\d{2})\b/, // YYYY-MM-DD or YYYY/MM/DD
      /\b(\d{2}[-/]\d{2}[-/]\d{4})\b/, // MM-DD-YYYY or DD-MM-YYYY
      /\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b/ // Flexible format
    ];
    for (const pattern of datePatterns) {
      const matches = normalizedText.matchAll(new RegExp(pattern.source, 'g'));
      for (const match of matches) {
        // Only add if not already found with label
        if (!dates.find(d => d.value === match[1])) {
          dates.push({ value: match[1], type: 'unknown' });
        }
      }
    }
    
    // Process dates - prioritize labeled dates
    const birthDates = dates.filter(d => d.type === 'birth').map(d => d.value);
    const expiryDates = dates.filter(d => d.type === 'expiry').map(d => d.value);
    const unknownDates = dates.filter(d => d.type === 'unknown').map(d => d.value);
    
    // Parse and format dates
    const parseDate = (dateStr) => {
      try {
        const parts = dateStr.split(/[-/]/);
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
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } catch {
        return null;
      }
    };
    
    // Assign birth date (prioritize labeled, then first unknown)
    if (birthDates.length > 0) {
      const parsed = parseDate(birthDates[0]);
      if (parsed) fields.birthDate = parsed;
    } else if (unknownDates.length > 0) {
      const parsed = parseDate(unknownDates[0]);
      if (parsed) fields.birthDate = parsed;
    }
    
    // Assign expiry date (prioritize labeled, then second unknown)
    if (expiryDates.length > 0) {
      const parsed = parseDate(expiryDates[0]);
      if (parsed) fields.expiryDate = parsed;
    } else if (unknownDates.length > 1) {
      const parsed = parseDate(unknownDates[1]);
      if (parsed) fields.expiryDate = parsed;
    }

    // Extract name - PhilID format: Labels like "Apelyido/Last Name" followed by value on next line
    // Also handle inline formats: "LASTNAME, FIRSTNAME MIDDLENAME"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
      
      // Pattern 1: PhilID format - "Apelyido/Last Name" label, value on next line
      if (line.match(/(?:Apelyido|Last\s*Name|Surname)/i) && nextLine) {
        const nameValue = nextLine.trim();
        if (nameValue && nameValue.length > 2 && !nameValue.match(/^(REPUBLIKA|PAMBANSANG|Philippine)/i)) {
          // Check if it's "LASTNAME, FIRSTNAME MIDDLENAME" format
          const commaMatch = nameValue.match(/^([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s*,\s*(.+)$/);
          if (commaMatch) {
            fields.lastName = commaMatch[1].trim();
            const firstParts = commaMatch[2].trim().split(/\s+/);
            fields.firstName = firstParts[0] || null;
            fields.middleName = firstParts.slice(1).join(' ') || null;
          } else {
            // Just last name
            fields.lastName = nameValue;
          }
        }
      }
      
      // Pattern 2: "Mga Pangalan" or "Given Name" label, value on next line
      if (line.match(/(?:Mga\s*Pangalan|Given\s*Name|First\s*Name)/i) && nextLine) {
        const nameValue = nextLine.trim();
        if (nameValue && nameValue.length > 2 && !nameValue.match(/^(REPUBLIKA|PAMBANSANG|Philippine)/i)) {
          const nameParts = nameValue.split(/\s+/);
          if (nameParts.length >= 2) {
            fields.firstName = nameParts[0];
            fields.middleName = nameParts.slice(1).join(' ');
          } else {
            fields.firstName = nameValue;
          }
        }
      }
      
      // Pattern 3: Inline format - "LASTNAME, FIRSTNAME MIDDLENAME"
      const commaPattern = /^([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s*,\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)/;
      const commaMatch = line.match(commaPattern);
      if (commaMatch && !fields.lastName) {
        fields.lastName = commaMatch[1].trim();
        const firstParts = commaMatch[2].trim().split(/\s+/);
        fields.firstName = firstParts[0] || null;
        fields.middleName = firstParts.slice(1).join(' ') || null;
      }
      
      // Pattern 4: Three consecutive capitalized words (likely FIRST MIDDLE LAST)
      const threeWordsPattern = /^([A-Z][A-Za-z]+)\s+([A-Z][A-Za-z]+)\s+([A-Z][A-Za-z]+)$/;
      const threeWordsMatch = line.match(threeWordsPattern);
      if (threeWordsMatch && !fields.firstName && !line.match(/(?:REPUBLIKA|PAMBANSANG|Philippine|Apelyido|Pangalan)/i)) {
        fields.firstName = threeWordsMatch[1];
        fields.middleName = threeWordsMatch[2];
        fields.lastName = threeWordsMatch[3];
      }
    }

    // Extract sex/gender
    const sexPatterns = [
      /(?:Sex|Gender)[:\s]*(Male|Female|M|F)/i,
      /\b(Male|Female|M|F)\b/
    ];
    for (const pattern of sexPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        const sex = match[1].toLowerCase();
        fields.sex = sex === 'm' ? 'Male' : sex === 'f' ? 'Female' : match[1];
        break;
      }
    }

    // Extract address - PhilID format: "Address" label followed by value
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
      
      // Look for "Address" or "Tirahan" label
      if (line.match(/(?:Address|Tirahan|Addr)/i) && nextLine) {
        const addressValue = nextLine.trim();
        if (addressValue && addressValue.length > 5 && !addressValue.match(/^(REPUBLIKA|PAMBANSANG|Philippine)/i)) {
          // Split address into lines if it contains common separators
          const addressParts = addressValue.split(/[,;]/).map(p => p.trim()).filter(p => p.length > 0);
          if (addressParts.length >= 1) {
            fields.addressLine1 = addressParts[0];
          }
          if (addressParts.length >= 2) {
            fields.addressLine2 = addressParts[1];
          }
        }
      }
      
      // Extract barangay from address or standalone
      if (line.match(/(?:Barangay|Brgy|Brg)[:\s]*([A-Z0-9\s]+)/i)) {
        const match = line.match(/(?:Barangay|Brgy|Brg)[:\s]*([A-Z0-9\s]+)/i);
        if (match && match[1]) {
          fields.barangay = match[1].trim();
        }
      } else if (nextLine && line.match(/(?:Barangay|Brgy)/i)) {
        // Barangay value on next line
        const barangayValue = nextLine.trim();
        if (barangayValue && barangayValue.length > 1) {
          fields.barangay = barangayValue;
        }
      }
    }
    
    // Fallback: Extract address patterns from normalized text
    if (!fields.addressLine1) {
      const addressPatterns = [
        /(?:Address|Tirahan)[:\s]*([^\n]{10,})/i,
        /(Purok|Barangay|Brgy|Zone)\s*(\d+|[A-Z0-9]+)/i,
        /(\d+\s+[A-Za-z0-9\s,]+(?:Street|St|Avenue|Ave|Road|Rd|Blvd|Purok))/i
      ];
      
      for (const pattern of addressPatterns) {
        const match = normalizedText.match(pattern);
        if (match) {
          fields.addressLine1 = match[0].trim();
          break;
        }
      }
    }

    // Clean up: remove null values for cleaner response
    const cleanedFields = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== null && value !== '') {
        cleanedFields[key] = value;
      }
    }

    return cleanedFields;
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

  async processId(req, res) {
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
      let imageBuffer;
      let processedImagePath = null;
      
      if (sharp) {
        try {
          // Get image metadata first
          const metadata = await sharp(file.path).metadata();
          console.log('[OCR] Original image:', { width: metadata.width, height: metadata.height });
          
          // Scale up image if it's too small (minimum 1500px width for better OCR)
          const minWidth = 1500;
          const scaleFactor = metadata.width < minWidth ? minWidth / metadata.width : 1;
          const targetWidth = Math.round(metadata.width * scaleFactor);
          const targetHeight = Math.round(metadata.height * scaleFactor);
          
          // Create enhanced preprocessing pipeline
          let pipeline = sharp(file.path)
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
              saturation: 0
            })
            .sharpen({ // Sharpen for better text recognition
              sigma: 1.5,
              flat: 1,
              jagged: 2
            })
            .linear(1.2, -(128 * 0.2)) // Increase contrast
            .threshold(128, { // Binarize (black and white only)
              grayscale: true
            });
          
          // Save processed image temporarily for debugging
          processedImagePath = file.path.replace(/\.(jpg|jpeg|png)$/i, '_processed.png');
          await pipeline.toFile(processedImagePath);
          imageBuffer = await fs.readFile(processedImagePath);
          
          console.log('[OCR] Image preprocessed and scaled:', { 
            original: `${metadata.width}x${metadata.height}`,
            processed: `${targetWidth}x${targetHeight}`,
            scaleFactor: scaleFactor.toFixed(2)
          });
        } catch (sharpError) {
          console.warn('[OCR] Sharp preprocessing failed, using original:', sharpError.message);
          imageBuffer = await fs.readFile(file.path);
        }
      } else {
        imageBuffer = await fs.readFile(file.path);
      }

      // Perform OCR with multiple attempts using different PSM modes for better accuracy
      console.log('[OCR] Starting text extraction with multiple PSM modes...');
      
      // Try different PSM (Page Segmentation Mode) settings
      // PSM 6 = Assume uniform block of text (good for IDs)
      // PSM 11 = Sparse text (good for structured documents)
      // PSM 12 = Sparse text with OSD (Orientation and Script Detection)
      const psmModes = [
        { mode: 6, name: 'Uniform block' },
        { mode: 11, name: 'Sparse text' },
        { mode: 12, name: 'Sparse text with OSD' },
        { mode: 4, name: 'Single column' }
      ];
      
      let bestResult = { text: '', confidence: 0 };
      const allTexts = [];
      
      for (const psm of psmModes) {
        try {
          console.log(`[OCR] Trying PSM mode ${psm.mode} (${psm.name})...`);
          const result = await Tesseract.recognize(imageBuffer, 'eng', {
            // Removed progress logger - no progress updates during extraction
            // Tesseract options for better accuracy
            options: {
              psm: psm.mode,
              tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/,.: ',
              // Increase DPI for better recognition
              tessedit_pageseg_mode: psm.mode
            }
          });
          
          const avgConfidence = result.data.confidence || 0;
          allTexts.push({ text: result.data.text, confidence: avgConfidence, psm: psm.mode });
          
          console.log(`[OCR] PSM ${psm.mode} completed. Confidence: ${avgConfidence.toFixed(1)}%`);
          
          // Keep the result with highest confidence
          if (avgConfidence > bestResult.confidence) {
            bestResult = { text: result.data.text, confidence: avgConfidence };
          }
        } catch (psmError) {
          console.warn(`[OCR] PSM mode ${psm.mode} failed:`, psmError.message);
        }
      }
      
      // Combine all texts for better parsing (remove duplicates, merge unique lines)
      const combinedText = this.combineOcrResults(allTexts);
      const text = combinedText || bestResult.text;

      // Validate that text was actually extracted
      const extractedTextLength = text ? text.trim().length : 0;
      const minTextLength = 10; // Minimum expected text length for a valid ID
      const minConfidence = 30; // Minimum confidence threshold
      
      if (extractedTextLength < minTextLength || bestResult.confidence < minConfidence) {
        // Text detection failed - likely due to camera/image quality issues
        const errorReason = extractedTextLength < minTextLength 
          ? 'No readable text detected in the image. This may be due to poor image quality, blur, or camera issues.'
          : `Low confidence text detection (${bestResult.confidence.toFixed(1)}%). The image may be too blurry, poorly lit, or the camera quality is insufficient.`;
        
        console.error('[OCR] Text detection failed:', {
          textLength: extractedTextLength,
          confidence: bestResult.confidence,
          reason: errorReason
        });

        // Clean up uploaded file
        try {
          await fs.unlink(file.path);
          if (processedImagePath) {
            await fs.unlink(processedImagePath);
          }
        } catch (unlinkError) {
          console.warn('[OCR] Failed to delete temp file:', unlinkError.message);
        }

        return res.status(400).json({
          success: false,
          error: 'TEXT_DETECTION_FAILED',
          message: errorReason,
          details: {
            textLength: extractedTextLength,
            confidence: bestResult.confidence,
            suggestions: [
              'Ensure the image is clear and well-lit',
              'Make sure the ID is fully visible and in focus',
              'Try using a different camera or better lighting',
              'Check that the camera lens is clean',
              'Try capturing the image again with better quality'
            ]
          }
        });
      }

      console.log('[OCR] Extracted text length:', extractedTextLength);
      console.log('[OCR] Extracted text preview:', text.substring(0, 200));

      // Detect ID type and parse accordingly
      const idType = this.detectIdType(text);
      console.log('[OCR] Detected ID type:', idType);
      
      const fields = this.parseIdFields(text, idType);
      
      // Validate that meaningful fields were extracted
      const extractedFieldsCount = Object.values(fields).filter(v => v != null && String(v).trim() !== '').length;
      if (extractedFieldsCount === 0) {
        console.error('[OCR] No meaningful fields extracted from text:', {
          textLength: extractedTextLength,
          confidence: bestResult.confidence,
          idType: idType
        });

        // Clean up uploaded file
        try {
          await fs.unlink(file.path);
          if (processedImagePath) {
            await fs.unlink(processedImagePath);
          }
        } catch (unlinkError) {
          console.warn('[OCR] Failed to delete temp file:', unlinkError.message);
        }

        return res.status(400).json({
          success: false,
          error: 'NO_FIELDS_EXTRACTED',
          message: 'Could not extract any valid information from the ID image. The image quality may be too poor or the text is not readable.',
          details: {
            textLength: extractedTextLength,
            confidence: bestResult.confidence,
            idType: idType,
            suggestions: [
              'Ensure the ID image is clear and all text is readable',
              'Check that the image is not too dark or blurry',
              'Make sure the camera is focused properly',
              'Try using better lighting when capturing the image',
              'Verify that the ID is fully visible in the frame'
            ]
          }
        });
      }

      // Clean up uploaded files
      try {
        await fs.unlink(file.path);
        if (processedImagePath) {
          await fs.unlink(processedImagePath);
        }
      } catch (unlinkError) {
        console.warn('[OCR] Failed to delete temp file:', unlinkError.message);
      }

      return res.json({
        success: true,
        provider: 'tesseract',
        idType: idType,
        fields: fields,
        rawText: text,
        message: `OCR processing completed successfully. Detected ID type: ${idType}`
      });
    } catch (error) {
      console.error('[OCR] Processing error:', error);
      
      // Clean up uploaded file on error
      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.warn('[OCR] Failed to delete temp file on error:', unlinkError.message);
        }
      }

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


