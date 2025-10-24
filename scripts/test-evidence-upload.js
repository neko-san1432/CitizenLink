const Database = require('../src/server/config/database');

async function testEvidenceUpload() {
  try {
    const db = new Database();
    const supabase = db.getClient();
    
    console.log('Testing evidence upload...');
    
    // Create a test file buffer
    const testContent = 'This is a test evidence file';
    const testFileName = `test-complaint-${Date.now()}/test-evidence-${Date.now()}.txt`;
    
    console.log('Uploading test file:', testFileName);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('complaint-evidence')
      .upload(testFileName, testContent, {
        contentType: 'text/plain',
        cacheControl: '3600',
        upsert: false
      });
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
    } else {
      console.log('Upload successful:', uploadData);
      
      // Test database insertion
      const testEvidence = [{
        complaint_id: 'test-complaint-id',
        file_name: 'test-evidence.txt',
        file_path: testFileName,
        file_size: testContent.length,
        file_type: 'text/plain',
        mime_type: 'text/plain',
        uploaded_by: 'test-user-id',
        is_public: false,
        description: null,
        tags: [],
        metadata: {}
      }];
      
      console.log('Testing database insertion...');
      const { data: insertData, error: insertError } = await supabase
        .from('complaint_evidence')
        .insert(testEvidence)
        .select();
      
      if (insertError) {
        console.error('Database insertion error:', insertError);
      } else {
        console.log('Database insertion successful:', insertData);
        
        // Clean up
        const { error: deleteError } = await supabase
          .from('complaint_evidence')
          .delete()
          .eq('complaint_id', 'test-complaint-id');
        
        if (deleteError) {
          console.error('Error cleaning up database:', deleteError);
        } else {
          console.log('Database cleanup successful');
        }
      }
      
      // Clean up storage
      const { error: storageDeleteError } = await supabase.storage
        .from('complaint-evidence')
        .remove([testFileName]);
      
      if (storageDeleteError) {
        console.error('Error cleaning up storage:', storageDeleteError);
      } else {
        console.log('Storage cleanup successful');
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testEvidenceUpload();
