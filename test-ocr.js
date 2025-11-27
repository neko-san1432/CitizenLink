const path = require('path');
const OCRController = require('./src/server/controllers/OCRController');

// Mock request and response
const req = {
  file: {
    path: 'C:/Users/User/.gemini/antigravity/brain/0d39c64e-ba01-4c27-9a2d-092e5e848559/uploaded_image_1764094819016.png',
    mimetype: 'image/png',
    originalname: 'uploaded_image.png',
    size: 1000000
  }
};

const res = {
  status: (code) => ({
    json: (data) => {
      console.log(`[TEST] Status ${code}:`, JSON.stringify(data, null, 2));
      return data;
    }
  }),
  json: (data) => {
    console.log('[TEST] Success:', JSON.stringify(data, null, 2));
    return data;
  }
};

// Run OCR
console.log('[TEST] Running OCR on:', req.file.path);
OCRController.processId(req, res).catch(err => {
  console.error('[TEST] Error:', err);
});
