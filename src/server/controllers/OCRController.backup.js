const path = require('path');
const { promises: fs } = require('fs');
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
        confidence: bestResult.confidence,
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


