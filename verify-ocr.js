
const path = require('path');
const fs = require('fs');
const OCRController = require('./src/server/controllers/OCRController');

// Use a sample image from uploads
// You can change this filename to test different images
const sampleImage = '1bd4484f5d6b4da44c6cb3480837473f'; 
const imagePath = path.resolve('uploads/ocr', sampleImage);

if (!fs.existsSync(imagePath)) {
    console.error(`Error: Sample image not found at ${imagePath}`);
    console.error('Please ensure you have uploaded an image or update the "sampleImage" variable in this script.');
    process.exit(1);
}

// Mock Request object
const req = {
    file: {
        path: imagePath,
        mimetype: 'image/jpeg',
        originalname: 'test-verification.jpg',
        size: fs.statSync(imagePath).size
    }
};

// Mock Response object
const res = {
    json: (data) => {
        console.log('\n--- OCR Result ---');
        if (data.success) {
            console.log('✅ Success!');
            console.log('Detected ID Type:', data.idType);
            console.log('Confidence:', data.confidence.toFixed(2) + '%');
            console.log('Extracted Fields:');
            console.table(Object.entries(data.fields).map(([k, v]) => ({ Field: k, Value: v.value, Conf: v.confidence })));
        } else {
            console.log('❌ Failed:', data.error);
        }
        console.log('------------------\n');
    },
    status: (code) => {
        console.log(`Response Status Code: ${code}`);
        return res; // Chainable
    }
};

(async () => {
    console.log(`Testing OCR with image: ${sampleImage}`);
    console.log('Processing... (this may take a moment)');
    try {
        await OCRController.processId(req, res);
    } catch (error) {
        console.error('Unexpected error:', error);
    }
})();
