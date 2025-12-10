const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const { spawn } = require('child_process');
const IDVerificationService = require('../services/IDVerificationService');

// Try to load Sharp, but make it optional
let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  console.warn('[OCR] Sharp not available, will skip image preprocessing');
}

class OCRController {
  constructor() {
    // Python script path
    this.pythonScriptPath = path.join(__dirname, '../services/ocr_service.py');
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

    if (/\d/.test(value)) return null;

    let cleaned = value.toUpperCase().replace(/[^A-Z\s.-]/g, ' ').trim();
    cleaned = cleaned.replace(/\s+/g, ' ');

    const letterCount = (cleaned.match(/[A-Z]/g) || []).length;
    if (letterCount < 2) return null;

    const words = cleaned.split(' ');
    const isExcluded = words.some(word => {
      return EXCLUDED_WORDS.some(excluded => {
        if (word === excluded) return true;
        if (excluded.length > 4) {
          return this.levenshteinDistance(word, excluded) <= 2;
        }
        return false;
      });
    });

    if (isExcluded) return null;
    if (/REPUBLIKA|PILIPINAS|PHILIPPINES|PHILSYS|PUBLIKA/i.test(cleaned)) return null;

    return cleaned;
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

    const idMatch = text.match(/(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})/);
    if (idMatch) fields.idNumber = idMatch[1].replace(/[\s-]/g, '');

    fields.lastName = this.findFieldByLabel(lines, ['Apelyido', 'Apilyedo', 'Apalyida', 'Apalyido', 'Last Name'], /^[A-Z\s.-]+$/);
    fields.firstName = this.findFieldByLabel(lines, ['Mga Pangalan', 'Given Names', 'Pangalan'], /^[A-Z\s.-]+$/);
    fields.middleName = this.findFieldByLabel(lines, ['Gitnang Apelyido', 'Gitnang Apilyedo', 'witnang', 'Middle Name'], /^[A-Z\s.-]+$/);
    fields.address = this.findFieldByLabel(lines, ['Tirahan', 'Address', 'Nrahan'], null);

    fields.lastName = this.cleanAndValidateName(fields.lastName);
    fields.firstName = this.cleanAndValidateName(fields.firstName);
    fields.middleName = this.cleanAndValidateName(fields.middleName);

    const dateMatch = text.match(/([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i);
    if (dateMatch) {
      fields.birthDate = this.parseDateString(dateMatch[0]);
    } else {
      const dobRaw = this.findFieldByLabel(lines, ['Petsa ng Kapanganakan', 'Date of Birth', 'falsa ng']);
      if (dobRaw) fields.birthDate = this.parseDateString(dobRaw);
    }

    let nameLines = [];
    if (!fields.lastName || !fields.firstName) {
      nameLines = lines.map(l => this.cleanAndValidateName(l)).filter(l => l !== null);
      if (fields.address) {
        const addrUpper = fields.address.toUpperCase();
        nameLines = nameLines.filter(l => !addrUpper.includes(l) && !l.includes(addrUpper));
      }
      if (nameLines.length > 0) {
        if (!fields.lastName && nameLines.length >= 1) fields.lastName = nameLines[0];
        if (!fields.firstName && nameLines.length >= 2) fields.firstName = nameLines[1];
        if (!fields.middleName && nameLines.length >= 3) fields.middleName = nameLines[2];
      }
    }

    if (text.match(/\bMALE\b/i) || text.match(/\bLALAKI\b/i)) fields.sex = 'Male';
    else if (text.match(/\bFEMALE\b/i) || text.match(/\bBABAE\b/i)) fields.sex = 'Female';

    return {
      full_name: {
        value: [fields.firstName, fields.middleName, fields.lastName].filter(Boolean).join(' '),
        confidence: fields.firstName && fields.lastName ? 0.9 : 0.0
      },
      sex: {
        value: fields.sex || '',
        confidence: fields.sex ? 0.9 : 0.0
      },
      date_of_birth: {
        value: fields.birthDate || '',
        confidence: fields.birthDate ? 0.9 : 0.0
      },
      address: {
        value: fields.address || '',
        confidence: fields.address ? 0.8 : 0.0
      },
      public_id_number: {
        value: fields.idNumber || '',
        confidence: fields.idNumber ? 0.95 : 0.0
      },
      issue_date: { value: '', confidence: 0.0 },
      face_region_detected: { value: false, confidence: 0.0 },
      signature_region_detected: { value: false, confidence: 0.0 },
      qr_code_data: { value: '', confidence: 0.0 }
    };
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

    const prnMatch = text.match(/([A-Z]\d{3}[\s-]?\d{4}[\s-]?\d{4})/);
    if (prnMatch) fields.idNumber = prnMatch[1];

    fields.address = this.findFieldByLabel(lines, ['Address', 'Tirahan'], null);

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

    const licMatch = text.match(/([A-Z]\d{2}-?\d{2}-?\d{6})/);
    if (licMatch) fields.idNumber = licMatch[1];

    const dates = text.match(/\d{4}[-/]\d{2}[-/]\d{2}/g);
    if (dates && dates.length > 0) fields.birthDate = this.parseDateString(dates[0]);

    if (text.match(/\bM\b/) || text.match(/\bMale\b/i)) fields.sex = 'Male';
    else if (text.match(/\bF\b/) || text.match(/\bFemale\b/i)) fields.sex = 'Female';

    return this.cleanFields(fields);
  }

  parseDateString(dateStr) {
    if (!dateStr) return null;
    try {
      const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
        'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
      const monthAbbr = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
        'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

      const monthDayYearMatch = dateStr.match(/([A-Z]+)\s+(\d{1,2}),?\s+(\d{2,4})/i);
      if (monthDayYearMatch) {
        const monthName = monthDayYearMatch[1].toUpperCase();
        const day = monthDayYearMatch[2].padStart(2, '0');
        let year = monthDayYearMatch[3];
        if (year.length === 2) {
          const yearNum = parseInt(year);
          year = yearNum > 50 ? `19${year}` : `20${year}`;
        }
        let monthIndex = monthNames.indexOf(monthName);
        if (monthIndex === -1) monthIndex = monthAbbr.findIndex(m => monthName.startsWith(m));
        if (monthIndex !== -1) {
          const month = (monthIndex + 1).toString().padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }

      const parts = dateStr.split(/[-/]/);
      if (parts.length === 3) {
        let year, month, day;
        if (parts[0].length === 4) {
          [year, month, day] = parts;
        } else if (parseInt(parts[0]) > 12) {
          [day, month, year] = parts;
        } else {
          [month, day, year] = parts;
        }
        if (year.length === 2) {
          const yearNum = parseInt(year);
          year = yearNum > 50 ? `19${year}` : `20${year}`;
        }
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      return null;
    } catch { return null; }
  }

  cleanFields(fields) {
    const cleaned = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== null && value !== '' && value !== undefined) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  async detectAndCropCard(imagePath) {
    if (!sharp) return imagePath;
    try {
      console.log('[OCR] Attempting to detect and crop card...');
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      const trimmedBuffer = await image.clone().trim({ threshold: 50 }).toBuffer();
      const trimmedMeta = await sharp(trimmedBuffer).metadata();
      const widthRatio = trimmedMeta.width / metadata.width;
      const heightRatio = trimmedMeta.height / metadata.height;
      if (widthRatio > 0.95 && heightRatio > 0.95) {
        console.log('[OCR] Trimming ineffective, using original image.');
        return imagePath;
      }
      const parsedPath = path.parse(imagePath);
      const cropPath = path.join(parsedPath.dir, `${parsedPath.name}_cropped${parsedPath.ext}`);
      await sharp(trimmedBuffer).toFile(cropPath);
      console.log(`[OCR] Card cropped. Saved to: ${cropPath}`);
      return cropPath;
    } catch (error) {
      console.warn('[OCR] Card detection failed, using original image:', error.message);
      return imagePath;
    }
  }

  /**
   * Execute Python OCR script
   */
  async runPythonOCR(imagePath) {
    return new Promise((resolve, reject) => {
      console.log(`[OCR] Spawning Python process: python ${this.pythonScriptPath} ${imagePath}`);

      // Add site-packages to PYTHONPATH
      const pythonProcess = spawn('python', [this.pythonScriptPath, imagePath], { env: process.env });

      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        // Also log stderr to console for debugging
        process.stderr.write(`[Python OCR] ${data}`);
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`[OCR] Python process exited with code ${code}`);
          return reject(new Error(`OCR process failed: ${stderrData}`));
        }

        try {
          const result = JSON.parse(stdoutData);
          if (result.error) {
            return reject(new Error(result.error));
          }
          resolve(result);
        } catch (e) {
          console.error('[OCR] Failed to parse Python output:', stdoutData);
          reject(new Error('Invalid JSON output from OCR script'));
        }
      });

      pythonProcess.on('error', (err) => {
        reject(err);
      });
    });
  }

  async processId(req, res) {
    const intermediateFiles = [];
    try {
      const {file} = req;
      if (!file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      console.log('[OCR] Received file:', file.originalname);

      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ success: false, error: 'File must be an image' });
      }

      let processedImagePath = null;
      let workingPath = file.path;

      if (sharp) {
        try {
          const croppedPath = await this.detectAndCropCard(file.path);
          if (croppedPath !== file.path) {
            workingPath = croppedPath;
            intermediateFiles.push(workingPath);
          }

          const metadata = await sharp(workingPath).metadata();
          const minWidth = 1500;
          const scaleFactor = metadata.width < minWidth ? minWidth / metadata.width : 1;
          const targetWidth = Math.round(metadata.width * scaleFactor);
          const targetHeight = Math.round(metadata.height * scaleFactor);

          const pipeline = sharp(workingPath)
            .resize(targetWidth, targetHeight, { kernel: sharp.kernel.lanczos3, fit: 'fill' })
            .greyscale()
            .normalize({ lower: 5, upper: 95 })
            .modulate({ brightness: 1.1, saturation: 1.2 })
            .sharpen({ sigma: 1.5, m1: 1.0, m2: 2.0, x1: 10, y2: 10, y3: 20 });

          // Ensure processed image has an extension for PaddleOCR
          const ext = path.extname(file.originalname) || '.jpg';
          processedImagePath = path.join(path.dirname(file.path), `processed_${path.basename(file.path)}${ext}`);
          await pipeline.toFile(processedImagePath);
          intermediateFiles.push(processedImagePath);

          console.log('[OCR] Image preprocessed:', processedImagePath);
        } catch (err) {
          console.error('[OCR] Preprocessing failed:', err);
          // Fallback to original, but we need to ensure it has extension
          const ext = path.extname(file.originalname) || '.jpg';
          const tempPath = file.path + ext;
          await fsPromises.copyFile(file.path, tempPath);
          processedImagePath = tempPath;
          intermediateFiles.push(processedImagePath);
        }
      } else {
        // No sharp, use original but ensure extension
        const ext = path.extname(file.originalname) || '.jpg';
        const tempPath = file.path + ext;
        await fsPromises.copyFile(file.path, tempPath);
        processedImagePath = tempPath;
        intermediateFiles.push(processedImagePath);
      }

      console.log('[OCR] Starting PaddleOCR recognition (Python)...');

      const ocrResult = await this.runPythonOCR(processedImagePath);

      const {text} = ocrResult;
      const confidence = ocrResult.average_confidence * 100; // Convert to percentage

      console.log(`[OCR] Recognition complete. Confidence: ${confidence.toFixed(2)}%`);
      console.log(`[OCR] Extracted Text Length: ${text.length}`);

      try {
        for (const p of intermediateFiles) {
          if (fs.existsSync(p)) await fsPromises.unlink(p).catch(() => {});
        }
      } catch (e) {}

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
module.exports = {
  processId: ocrController.processId.bind(ocrController)
};
