const path = require('path');
const { promises: fs } = require('fs');
const multer = require('multer');

// Import the updated OCR controller
const OCRController = require('./src/server/controllers/OCRController.js');

async function testUpdatedController() {
  const imagePath = 'C:\\Users\\User\\Downloads\\362142282_1351083545477868_3087288934325249736_n.jpg';
  
  console.log('\n=== Testing Updated OCR Controller ===\n');
  console.log('Image:', imagePath);
  console.log('');
  
  try {
    // Copy image to temp location
    const tempPath = path.join(__dirname, 'temp-test-id.jpg');
    await fs.copyFile(imagePath, tempPath);
    
    // Create mock request and response
    const req = {
      file: {
        originalname: '362142282_1351083545477868_3087288934325249736_n.jpg',
        mimetype: 'image/jpeg',
        size: (await fs.stat(tempPath)).size,
        path: tempPath
      }
    };
    
    let responseData = null;
    const res = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        responseData = data;
        return this;
      },
      statusCode: 200
    };
    
    // Process the ID
    console.log('[TEST] Processing ID with updated controller...\n');
    await OCRController.processId(req, res);
    
    // Display results
    console.log('\n=== RESULTS ===\n');
    console.log('Success:', responseData.success);
    console.log('ID Type:', responseData.idType);
    console.log('Confidence:', responseData.confidence?.toFixed(2) + '%');
    console.log('Provider:', responseData.provider);
    
    if (responseData.success) {
      console.log('\n--- Extracted Fields ---');
      const fields = responseData.fields;
      console.log('ID Number:', fields.idNumber || '❌ NOT FOUND');
      console.log('Last Name:', fields.lastName || '❌ NOT FOUND');
      console.log('First Name:', fields.firstName || '❌ NOT FOUND');
      console.log('Middle Name:', fields.middleName || '❌ NOT FOUND');
      console.log('Birth Date:', fields.birthDate || '❌ NOT FOUND');
      console.log('Address:', fields.address || '❌ NOT FOUND');
      console.log('Sex:', fields.sex || '❌ NOT FOUND');
      
      console.log('\n--- Verification ---');
      const expected = {
        idNumber: '2467904217413581',
        lastName: 'GO',
        firstName: 'PYRRHUS ELCID',
        middleName: 'SALLA',
        birthDate: '2004-07-14',
        address: '0915 ACACIAHAN'
      };
      
      console.log('✓ ID Number:', fields.idNumber === expected.idNumber ? '✅ MATCH' : `❌ Expected: ${expected.idNumber}`);
      console.log('✓ Last Name:', fields.lastName === expected.lastName ? '✅ MATCH' : `❌ Expected: ${expected.lastName}, Got: ${fields.lastName}`);
      console.log('✓ First Name:', fields.firstName === expected.firstName ? '✅ MATCH' : `❌ Expected: ${expected.firstName}, Got: ${fields.firstName}`);
      console.log('✓ Middle Name:', fields.middleName === expected.middleName ? '✅ MATCH' : `❌ Expected: ${expected.middleName}, Got: ${fields.middleName}`);
      console.log('✓ Birth Date:', fields.birthDate === expected.birthDate ? '✅ MATCH' : `❌ Expected: ${expected.birthDate}, Got: ${fields.birthDate}`);
      console.log('✓ Address:', fields.address?.includes('ACACIAHAN') ? '✅ CONTAINS' : `❌ Expected to contain: ${expected.address}`);
      
    } else {
      console.log('\n❌ Error:', responseData.error);
      console.log('Message:', responseData.message);
    }
    
    // Clean up
    try {
      await fs.unlink(tempPath).catch(() => {});
    } catch (e) {}
    
  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    console.error(error.stack);
  }
}

testUpdatedController();
