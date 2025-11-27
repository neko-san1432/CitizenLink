// Clear require cache to get fresh module
delete require.cache[require.resolve('./src/server/controllers/OCRController.js')];

const path = require('path');
const { promises: fs } = require('fs');

// Import the updated OCR controller
const OCRController = require('./src/server/controllers/OCRController.js');

async function testFreshController() {
  const imagePath = 'C:\\Users\\User\\Downloads\\362142282_1351083545477868_3087288934325249736_n.jpg';
  
  console.log('\n=== Testing FRESH OCR Controller ===\n');
  console.log('=== VERSION 2.0 ===');
  
  try {
    // Copy image to temp location
    const tempPath = path.join(__dirname, 'temp-test-id-fresh.jpg');
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
    console.log('[TEST] Processing ID...\n');
    await OCRController.processId(req, res);
    
    // Display results
    console.log('\n=== RESULTS ===\n');
    console.log('Success:', responseData.success);
    console.log('ID Type:', responseData.idType);
    console.log('Confidence:', responseData.confidence?.toFixed(2) + '%');
    console.log('Strategy:', responseData.message);
    
    if (responseData.success) {
      console.log('\n--- Extracted Fields ---');
      const fields = responseData.fields;
      console.log('Full Name:', fields.full_name?.value || 'NOT FOUND');
      // console.log('Sex:', fields.sex?.value || 'NOT FOUND');
      // console.log('Birth Date:', fields.date_of_birth?.value || 'NOT FOUND');
      // console.log('Address:', fields.address?.value || 'NOT FOUND');
      // console.log('ID Number:', fields.public_id_number?.value || 'NOT FOUND');
      
      console.log('\n--- Verification ---');
      // const checks = [
      //   { name: 'ID Number', actual: fields.public_id_number?.value, expected: '2467904217413581' },
      //   { name: 'Full Name', actual: fields.full_name?.value, expected: 'PYRRHUS ELCID SALLA GO' },
      //   { name: 'Birth Date', actual: fields.date_of_birth?.value, expected: '2004-07-14' },
      // ];
      
      // let passCount = 0;
      let passCount = 0;
      // checks.forEach(check => {
      //   const pass = check.actual === check.expected;
      //   if (pass) passCount++;
      //   console.log(`${pass ? '✅' : '❌'} ${check.name}: ${pass ? 'MATCH' : `Expected "${check.expected}", Got "${check.actual}"`}`);
      // });
      
      // const addressPass = fields.address?.value?.includes('ACACIAHAN');
      // if (addressPass) passCount++;
      // console.log(`${addressPass ? '✅' : '❌'} Address: ${addressPass ? 'CONTAINS ACACIAHAN' : `Missing ACACIAHAN, Got "${fields.address?.value}"`}`);
      
      console.log(`\n📊 Score: ${passCount}/6 fields correct`);
      
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
  }
}

testFreshController();
