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
            continue;
          }
          
          return cleaned;
        }
      }
    }
    return null;
  }

  /**
   * Parse Philippine National ID (PhilID)
   */
  parsePhilId(text) {
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

    // Label-based extraction with OCR error tolerance
    fields.lastName = this.findFieldByLabel(lines, ['Apelyido', 'Apilyedo', 'Apalyida', 'Apalyido', 'Last Name'], /^[A-Z\s.-]+$/);
    fields.firstName = this.findFieldByLabel(lines, ['Mga Pangalan', 'Given Names', 'Pangalan'], /^[A-Z\s.-]+$/);
    fields.middleName = this.findFieldByLabel(lines, ['Gitnang Apelyido', 'Gitnang Apilyedo', 'witnang', 'Middle Name'], /^[A-Z\s.-]+$/);
    fields.address = this.findFieldByLabel(lines, ['Tirahan', 'Address', 'Nrahan'], null);

    // Date of Birth
    const dateMatch = text.match(/([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i);
    if (dateMatch) {
      fields.birthDate = this.parseDateString(dateMatch[0]);
    } else {
      const dobRaw = this.findFieldByLabel(lines, ['Petsa ng Kapanganakan', 'Date of Birth', 'falsa ng']);
      if (dobRaw) fields.birthDate = this.parseDateString(dobRaw);
    }

    // Sex/Gender
    if (text.match(/\bMALE\b/i) || text.match(/\bLALAKI\b/i)) fields.sex = 'Male';
    else if (text.match(/\bFEMALE\b/i) || text.match(/\bBABAE\b/i)) fields.sex = 'Female';

    return this.cleanFields(fields);
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
