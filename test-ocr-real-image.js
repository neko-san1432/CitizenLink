const OCRController = require('./src/server/controllers/OCRController');
const path = require('path');
const fs = require('fs');

const imagePath = path.resolve(__dirname, 'test-image-2.jpg');

if (!fs.existsSync(imagePath)) {
    console.error('File does not exist:', imagePath);
    process.exit(1);
}

const req = {
  file: {
    path: imagePath,
    originalname: 'test-image.jpg',
    mimetype: 'image/jpeg',
    size: 100000
  }
};

const res = {
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    fs.writeFileSync('ocr-json.json', JSON.stringify(data, null, 2));
    return this;
  }
};

// console.log('Processing image:', imagePath); // Comment out to reduce noise
OCRController.processId(req, res).catch(err => {
  console.error('Error running OCR:', err);
});
