const Database = require('../src/server/config/database');

async function testStorage() {
  try {
    const db = new Database();
    const supabase = db.getClient();
    
    console.log('Testing Supabase storage...');
    
    // Test if we can access the storage bucket
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      return;
    }
    
    console.log('Available buckets:', buckets);
    
    // Check if complaint-evidence bucket exists
    const evidenceBucket = buckets.find(bucket => bucket.name === 'complaint-evidence');
    
    if (!evidenceBucket) {
      console.log('complaint-evidence bucket does not exist');
      console.log('Creating complaint-evidence bucket...');
      
      const { data: createData, error: createError } = await supabase.storage.createBucket('complaint-evidence', {
        public: false,
        allowedMimeTypes: ['image/*', 'application/pdf', 'video/*'],
        fileSizeLimit: 10485760 // 10MB
      });
      
      if (createError) {
        console.error('Error creating bucket:', createError);
      } else {
        console.log('Bucket created successfully:', createData);
      }
    } else {
      console.log('complaint-evidence bucket exists:', evidenceBucket);
    }
    
    // Test upload
    const testContent = 'This is a test file';
    const testFileName = `test-${Date.now()}.txt`;
    
    console.log('Testing file upload...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('complaint-evidence')
      .upload(testFileName, testContent, {
        contentType: 'text/plain',
        cacheControl: '3600'
      });
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
    } else {
      console.log('Upload successful:', uploadData);
      
      // Clean up test file
      const { error: deleteError } = await supabase.storage
        .from('complaint-evidence')
        .remove([testFileName]);
      
      if (deleteError) {
        console.error('Error deleting test file:', deleteError);
      } else {
        console.log('Test file cleaned up successfully');
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testStorage();
