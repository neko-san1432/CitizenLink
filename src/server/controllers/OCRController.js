const path = require("path");
const fs = require("fs");
const fsPromises = fs.promises;
const { spawn } = require("child_process");
const IDVerificationService = require("../services/IDVerificationService");

// Try to load Sharp, but make it optional
let sharp;
try {
  sharp = require("sharp");
} catch (err) {
  console.warn("[OCR] Sharp not available, will skip image preprocessing");
}

class OCRController {
  constructor() {
    // Python script path
    this.pythonScriptPath = path.join(__dirname, "../services/ocr_service.py");
  }

  /**
   * Detect ID type from extracted text
   */
  detectIdType(text) {
    const normalized = text.toUpperCase();

    if (
      normalized.includes("PHILIPPINE POSTAL CORPORATION") ||
      normalized.includes("POSTAL IDENTITY CARD") ||
      normalized.includes("PHLPOST") ||
      normalized.includes("POSTAL ID")
    ) {
      return "philpost";
    }

    if (
      normalized.includes("PAMBANSANG PAGKAKAKILANLAN") ||
      normalized.includes("PHILIPPINE IDENTIFICATION CARD") ||
      (normalized.includes("REPUBLIKA NG PILIPINAS") &&
        normalized.includes("PAGKAKAKILANLAN"))
    ) {
      return "philid";
    }

    if (
      normalized.includes("DRIVER'S LICENSE") ||
      normalized.includes("DRIVERS LICENSE") ||
      normalized.includes("LAND TRANSPORTATION OFFICE") ||
      normalized.includes("LTO") ||
      normalized.includes("NON-PROFESSIONAL") ||
      normalized.includes("PROFESSIONAL")
    ) {
      return "drivers_license";
    }

    return "unknown";
  }

  /**
   * Parse extracted text to find relevant ID fields based on ID type
   */
  parseIdFields(text, idType = "unknown") {
    // Auto-detect if not provided
    if (idType === "unknown") {
      idType = this.detectIdType(text);
    }

    // Use format-specific parsers
    switch (idType) {
      case "philid":
        return this.parsePhilId(text);
      case "philpost":
        return this.parsePhilPost(text);
      case "drivers_license":
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
   * Helper: Extract and clean value from line(s)
   */
  extractAndCleanValue(line, startIndex, lineIndex, lines) {
    let value = line
      .substring(startIndex)
      .replace(/[:.\\/]/g, "")
      .trim();

    // Check if value looks like another label
    const labelKeywords = [
      "LAST",
      "NAME",
      "FIRST",
      "GIVEN",
      "MIDDLE",
      "NAMES",
      "PANGALAN",
      "APILYEDO",
      "APELYIDO",
      "GITNANG",
      "TIRAHAN",
      "ADDRESS",
      "NRAHAN",
    ];

    // Explicitly remove any label appearing at the START of the value (e.g. "Address 123 Main St" -> "123 Main St")
    // This happens if the startIndex wasn't perfectly after the label
    for (const kw of labelKeywords) {
      if (value.toUpperCase().startsWith(kw)) {
        value = value
          .substring(kw.length)
          .replace(/[:.\\/]/g, "")
          .trim();
      }
    }

    const valueWords = value.toUpperCase().split(/\s+/);
    // Strict check: if the value is ONLY a label keyword (or very short + keyword), reject it
    const isJustLabel = valueWords.every(
      (w) => labelKeywords.includes(w) || w.length < 2
    );

    // Use next line if value is empty or looks like a label
    if ((value.length < 3 || isJustLabel) && lineIndex + 1 < lines.length) {
      value = lines[lineIndex + 1].trim();
    }

    // Clean value
    const cleaned = value.replace(/[^A-Z0-9\s.,-]/gi, "").trim();
    return cleaned;
  }

  /**
   * Helper: Find field value by looking for a label (Exact + Fuzzy)
   */
  findFieldByLabel(lines, labels, valuePattern = null) {
    // 1. First pass: Exact Regex Matches
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      for (const label of labels) {
        const labelUpper = label.toUpperCase();
        // Check if label appears in line with word boundaries
        const labelRegex = new RegExp(
          `(^|[^A-Z])${labelUpper.replace(/\s+/g, "\\s+")}($|[^A-Z])`,
          "i"
        );

        if (labelRegex.test(line)) {
          const match = line.match(labelRegex);
          const labelEndIndex =
            match.index + match[0].length - (match[2] ? 1 : 0);

          const cleaned = this.extractAndCleanValue(
            line,
            labelEndIndex,
            i,
            lines
          );
          if (valuePattern && !valuePattern.test(cleaned.toUpperCase()))
            continue;
          return cleaned;
        }
      }
    }

    // 2. Second pass: Fuzzy Matching
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Split line into words to check against labels
      const words = line.split(/[\s:.,]+/);

      for (const label of labels) {
        const labelUpper = label.toUpperCase();

        for (const word of words) {
          if (word.length < 3) continue;
          if (Math.abs(word.length - label.length) > 2) continue; // Optimization

          const dist = this.levenshteinDistance(word.toUpperCase(), labelUpper);
          // Allow 1 edit for short labels, 2 for longer
          const threshold = label.length > 5 ? 2 : 1;

          if (dist <= threshold) {
            // Found a fuzzy match
            const matchIndex = line.indexOf(word);
            if (matchIndex !== -1) {
              const labelEndIndex = matchIndex + word.length;
              const cleaned = this.extractAndCleanValue(
                line,
                labelEndIndex,
                i,
                lines
              );
              if (valuePattern && !valuePattern.test(cleaned.toUpperCase()))
                continue;
              console.log(
                `[OCR] Fuzzy match found for '${label}': '${word}' (Dist: ${dist}) -> ${cleaned}`
              );
              return cleaned;
            }
          }
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
      "REPUBLIKA",
      "PILIPINAS",
      "PHILIPPINES",
      "PAGKAKAKILANLAN",
      "LAST",
      "NAME",
      "GIVEN",
      "APILYEDO",
      "MGA",
      "PANGALAN",
      "GITNANG",
      "MIDDLE",
      "SEX",
      "DATE",
      "BIRTH",
      "ADDRESS",
      "TIRAHAN",
      "LALAKI",
      "BABAE",
      "MALE",
      "FEMALE",
      "HALALAN",
      "KOMISYON",
      "PHILSYS",
      "CARD",
      "NUMBER",
      "ID",
      "ISSUE",
      "ISSUING",
      "AUTHORITY",
      "NAMAS",
      "IZ",
      "PUBLIKA",
      "PILIPINA",
      "OO",
      "00",
      "REPUBLIC",
      "PHILIPPINE",
      "EPUBLIKA",
    ];

    if (/\d/.test(value)) return null;

    let cleaned = value
      .toUpperCase()
      .replace(/[^A-Z\s.-]/g, " ")
      .trim();
    cleaned = cleaned.replace(/\s+/g, " ");

    const letterCount = (cleaned.match(/[A-Z]/g) || []).length;
    if (letterCount < 2) return null;

    const words = cleaned.split(" ");
    const isExcluded = words.some((word) => {
      return EXCLUDED_WORDS.some((excluded) => {
        if (word === excluded) return true;
        if (excluded.length > 4) {
          return this.levenshteinDistance(word, excluded) <= 2;
        }
        return false;
      });
    });

    if (isExcluded) return null;
    if (/REPUBLIKA|PILIPINAS|PHILIPPINES|PHILSYS|PUBLIKA/i.test(cleaned))
      return null;

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
      idNumber: null,
    };

    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const idMatch = text.match(/(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})/);
    if (idMatch) fields.idNumber = idMatch[1].replace(/[\s-]/g, "");

    fields.lastName = this.findFieldByLabel(
      lines,
      ["Apelyido", "Apilyedo", "Apalyida", "Apalyido", "Last Name"],
      /^[A-Z\s.-]+$/
    );
    fields.firstName = this.findFieldByLabel(
      lines,
      ["Mga Pangalan", "Given Names", "Pangalan"],
      /^[A-Z\s.-]+$/
    );
    fields.middleName = this.findFieldByLabel(
      lines,
      ["Gitnang Apelyido", "Gitnang Apilyedo", "witnang", "Middle Name"],
      /^[A-Z\s.-]+$/
    );
    fields.address = this.findFieldByLabel(
      lines,
      ["Tirahan", "Address", "Nrahan"],
      null
    );

    fields.lastName = this.cleanAndValidateName(fields.lastName);
    fields.firstName = this.cleanAndValidateName(fields.firstName);
    fields.middleName = this.cleanAndValidateName(fields.middleName);

    const dateMatch = text.match(/([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i);
    if (dateMatch) {
      fields.birthDate = this.parseDateString(dateMatch[0]);
    } else {
      const dobRaw = this.findFieldByLabel(lines, [
        "Petsa ng Kapanganakan",
        "Date of Birth",
        "falsa ng",
      ]);
      if (dobRaw) fields.birthDate = this.parseDateString(dobRaw);
    }

    let nameLines = [];
    if (!fields.lastName || !fields.firstName) {
      nameLines = lines
        .map((l) => this.cleanAndValidateName(l))
        .filter((l) => l !== null);
      if (fields.address) {
        const addrUpper = fields.address.toUpperCase();
        nameLines = nameLines.filter(
          (l) => !addrUpper.includes(l) && !l.includes(addrUpper)
        );
      }
      if (nameLines.length > 0) {
        if (!fields.lastName && nameLines.length >= 1)
          fields.lastName = nameLines[0];
        if (!fields.firstName && nameLines.length >= 2)
          fields.firstName = nameLines[1];
        if (!fields.middleName && nameLines.length >= 3)
          fields.middleName = nameLines[2];
      }
    }

    if (text.match(/\bMALE\b/i) || text.match(/\bLALAKI\b/i))
      fields.sex = "Male";
    else if (text.match(/\bFEMALE\b/i) || text.match(/\bBABAE\b/i))
      fields.sex = "Female";

    // Standardize to flat format like other parsers for client compatibility
    const cleanedFields = this.cleanFields(fields);

    // Explicitly add idType to ensure client validation passes
    // This acts as a fallback if the top-level idType is lost
    cleanedFields.idType = "philid";

    return cleanedFields;
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
      birthDate: null,
    };

    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const prnMatch = text.match(/([A-Z]\d{3}[\s-]?\d{4}[\s-]?\d{4})/);
    if (prnMatch) fields.idNumber = prnMatch[1];

    fields.address = this.findFieldByLabel(lines, ["Address", "Tirahan"], null);

    const dates = text.match(/\d{4}[-/]\d{2}[-/]\d{2}/g);
    if (dates && dates.length >= 1)
      fields.birthDate = this.parseDateString(dates[0]);

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
      agency: "LTO",
    };

    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const licMatch = text.match(/([A-Z]\d{2}-?\d{2}-?\d{6})/);
    if (licMatch) fields.idNumber = licMatch[1];

    const dates = text.match(/\d{4}[-/]\d{2}[-/]\d{2}/g);
    if (dates && dates.length > 0)
      fields.birthDate = this.parseDateString(dates[0]);

    if (text.match(/\bM\b/) || text.match(/\bMale\b/i)) fields.sex = "Male";
    else if (text.match(/\bF\b/) || text.match(/\bFemale\b/i))
      fields.sex = "Female";

    return this.cleanFields(fields);
  }

  parseDateString(dateStr) {
    if (!dateStr) return null;
    try {
      const monthNames = [
        "JANUARY",
        "FEBRUARY",
        "MARCH",
        "APRIL",
        "MAY",
        "JUNE",
        "JULY",
        "AUGUST",
        "SEPTEMBER",
        "OCTOBER",
        "NOVEMBER",
        "DECEMBER",
      ];
      const monthAbbr = [
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC",
      ];

      const monthDayYearMatch = dateStr.match(
        /([A-Z]+)\s+(\d{1,2}),?\s+(\d{2,4})/i
      );
      if (monthDayYearMatch) {
        const monthName = monthDayYearMatch[1].toUpperCase();
        const day = monthDayYearMatch[2].padStart(2, "0");
        let year = monthDayYearMatch[3];
        if (year.length === 2) {
          const yearNum = parseInt(year);
          year = yearNum > 50 ? `19${year}` : `20${year}`;
        }
        let monthIndex = monthNames.indexOf(monthName);
        if (monthIndex === -1)
          monthIndex = monthAbbr.findIndex((m) => monthName.startsWith(m));
        if (monthIndex !== -1) {
          const month = (monthIndex + 1).toString().padStart(2, "0");
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
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
      return null;
    } catch {
      return null;
    }
  }

  cleanFields(fields) {
    const cleaned = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== null && value !== "" && value !== undefined) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  async detectAndCropCard(imagePath) {
    if (!sharp) return imagePath;
    try {
      console.log("[OCR] Attempting to detect and crop card...");
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      const trimmedBuffer = await image
        .clone()
        .trim({ threshold: 50 })
        .toBuffer();
      const trimmedMeta = await sharp(trimmedBuffer).metadata();
      const widthRatio = trimmedMeta.width / metadata.width;
      const heightRatio = trimmedMeta.height / metadata.height;
      if (widthRatio > 0.95 && heightRatio > 0.95) {
        console.log("[OCR] Trimming ineffective, using original image.");
        return imagePath;
      }
      const parsedPath = path.parse(imagePath);
      const cropPath = path.join(
        parsedPath.dir,
        `${parsedPath.name}_cropped${parsedPath.ext}`
      );
      await sharp(trimmedBuffer).toFile(cropPath);
      console.log(`[OCR] Card cropped. Saved to: ${cropPath}`);
      return cropPath;
    } catch (error) {
      console.warn(
        "[OCR] Card detection failed, using original image:",
        error.message
      );
      return imagePath;
    }
  }

  /**
   * Execute Python OCR script
   */
  async runPythonOCR(imagePath) {
    return new Promise((resolve, reject) => {
      console.log(
        `[OCR] Spawning Python process: python ${this.pythonScriptPath} ${imagePath}`
      );

      // Add site-packages to PYTHONPATH
      const pythonProcess = spawn(
        "python",
        [this.pythonScriptPath, imagePath],
        { env: process.env }
      );

      let stdoutData = "";
      let stderrData = "";

      pythonProcess.stdout.on("data", (data) => {
        stdoutData += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        stderrData += data.toString();
        // Also log stderr to console for debugging
        process.stderr.write(`[Python OCR] ${data}`);
      });

      pythonProcess.on("close", (code) => {
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
          console.error("[OCR] Failed to parse Python output:", stdoutData);
          reject(new Error("Invalid JSON output from OCR script"));
        }
      });

      pythonProcess.on("error", (err) => {
        reject(err);
      });
    });
  }

  async processId(req, res) {
    const intermediateFiles = [];
    try {
      const { file } = req;
      if (!file) {
        return res
          .status(400)
          .json({ success: false, error: "No file uploaded" });
      }

      console.log("[OCR] Received file:", file.originalname);

      if (!file.mimetype.startsWith("image/")) {
        return res
          .status(400)
          .json({ success: false, error: "File must be an image" });
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
          const scaleFactor =
            metadata.width < minWidth ? minWidth / metadata.width : 1;
          const targetWidth = Math.round(metadata.width * scaleFactor);
          const targetHeight = Math.round(metadata.height * scaleFactor);

          const pipeline = sharp(workingPath)
            .resize(targetWidth, targetHeight, {
              kernel: sharp.kernel.lanczos3,
              fit: "fill",
            })
            .greyscale()
            .normalize({ lower: 5, upper: 95 })
            .modulate({ brightness: 1.1, saturation: 1.2 })
            .sharpen({ sigma: 1.5, m1: 1.0, m2: 2.0, x1: 10, y2: 10, y3: 20 });

          // Ensure processed image has an extension for PaddleOCR
          const ext = path.extname(file.originalname) || ".jpg";
          processedImagePath = path.join(
            path.dirname(file.path),
            `processed_${path.basename(file.path)}${ext}`
          );
          await pipeline.toFile(processedImagePath);
          intermediateFiles.push(processedImagePath);

          console.log("[OCR] Image preprocessed:", processedImagePath);
        } catch (err) {
          console.error("[OCR] Preprocessing failed:", err);
          // Fallback to original, but we need to ensure it has extension
          const ext = path.extname(file.originalname) || ".jpg";
          const tempPath = file.path + ext;
          await fsPromises.copyFile(file.path, tempPath);
          processedImagePath = tempPath;
          intermediateFiles.push(processedImagePath);
        }
      } else {
        // No sharp, use original but ensure extension
        const ext = path.extname(file.originalname) || ".jpg";
        const tempPath = file.path + ext;
        await fsPromises.copyFile(file.path, tempPath);
        processedImagePath = tempPath;
        intermediateFiles.push(processedImagePath);
      }

      console.log("[OCR] Starting PaddleOCR recognition (Python)...");

      const ocrResult = await this.runPythonOCR(processedImagePath);

      const { text } = ocrResult;
      const confidence = ocrResult.average_confidence * 100; // Convert to percentage

      console.log(
        `[OCR] Recognition complete. Confidence: ${confidence.toFixed(2)}%`
      );
      console.log(`[OCR] Extracted Text Length: ${text.length}`);

      try {
        for (const p of intermediateFiles) {
          if (fs.existsSync(p)) await fsPromises.unlink(p).catch(() => {});
        }
      } catch (e) {}

      const idType = this.detectIdType(text);
      console.log(`[OCR] Detected ID type: ${idType}`);

      const fields = this.parseIdFields(text, idType);

      // Secure ID Verification: Generate a signed token if ID was detected
      let verificationToken = null;
      if (idType !== "unknown") {
        const { generateVerificationToken } = require("../utils/token");
        try {
          verificationToken = generateVerificationToken(idType);
        } catch (e) {
          console.error("[OCR] Failed to generate verification token:", e);
        }
      }

      // Cleanup original file if it exists and wasn't already cleaned up
      try {
        if (file && file.path && fs.existsSync(file.path)) {
          await fsPromises.unlink(file.path).catch(() => {});
        }
      } catch (e) {}

      return res.json({
        success: true,
        idType,
        fields,
        verificationToken, // Return the token to the client
        confidence,
        message: "ID processed successfully",
      });
    } catch (error) {
      console.error("[OCR] Processing error:", error);
      try {
        for (const p of intermediateFiles) {
          if (fs.existsSync(p)) await fsPromises.unlink(p).catch(() => {});
        }
        // Cleanup original file on error as well
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          await fsPromises.unlink(req.file.path).catch(() => {});
        }
      } catch (e) {}

      return res.status(500).json({
        success: false,
        error: "Failed to process ID",
        message: error.message,
      });
    }
  }
  /**
   * Process Secondary Residency Document (Bill, Certificate, Cedula)
   * Validates: "DIGOS" keyword AND User's Last Name
   */
  async processResidencyDoc(req, res) {
    const intermediateFiles = [];
    try {
      const { file } = req;
      const { lastName } = req.body;

      if (!file || !lastName) {
        return res
          .status(400)
          .json({ success: false, error: "File and Last Name are required" });
      }

      console.log(`[OCR-RESIDENCY] Processing doc for user: ${lastName}`);

      // 1. Preprocess (Reuse existing logic)
      let processedImagePath = file.path;
      // Simple preprocessing if sharp is available
      if (sharp) {
        const ext = path.extname(file.originalname) || ".jpg";
        processedImagePath = path.join(
          path.dirname(file.path),
          `residency_${Date.now()}${ext}`
        );
        await sharp(file.path)
          .greyscale()
          .normalize()
          .toFile(processedImagePath);
        intermediateFiles.push(processedImagePath);
      }

      // 2. Run Generic OCR (Get ALL text)
      const ocrResult = await this.runPythonOCR(processedImagePath);
      const text = ocrResult.text.toUpperCase();

      console.log(`[OCR-RESIDENCY] Extracted Text Length: ${text.length}`);

      // 3. Keyword Validation
      // Helper: Check if word exists in text (fuzzy allowed for name)
      const hasKeyword = (keyword) => {
        if (text.includes(keyword)) return true;
        // Split text into tokens for fuzzy check
        const tokens = text.split(/\s+/);
        for (const token of tokens) {
          if (token.length > 3 && this.levenshteinDistance(token, keyword) <= 1)
            return true;
        }
        return false;
      };

      const hasLocation = hasKeyword("DIGOS");
      const hasName = hasKeyword(lastName.toUpperCase());

      // Cleanup
      try {
        if (file.path) fsPromises.unlink(file.path).catch(() => {});
        for (const p of intermediateFiles) fsPromises.unlink(p).catch(() => {});
      } catch (e) {}

      if (hasLocation && hasName) {
        // Generate token for this specific residency check
        const { generateVerificationToken } = require("../utils/token");
        const residencyToken = generateVerificationToken("residency_secondary");

        return res.json({
          success: true,
          verified: true,
          message: "Residency verified: Digos address and Name match found.",
          residencyToken,
        });
      }
      let errorMsg = "Verification Failed. ";
      if (!hasLocation) errorMsg += "Document does not mention 'Digos'. ";
      if (!hasName)
        errorMsg += `Document does not mention surname '${lastName}'.`;

      return res.json({
        success: true,
        verified: false,
        error: errorMsg,
      });

    } catch (error) {
      console.error("[OCR-RESIDENCY] Error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to process residency document",
      });
    }
  }
}

const ocrController = new OCRController();
module.exports = {
  processId: ocrController.processId.bind(ocrController),
  processResidencyDoc: ocrController.processResidencyDoc.bind(ocrController),
};
