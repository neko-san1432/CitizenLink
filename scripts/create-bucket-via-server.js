const Database = require('../src/server/config/database');

async function createBucketViaServer() {
  try {
    console.log('Creating complaint-evidence bucket via server context...');
    
    const db = new Database();
    const supabase = db.getClient();
    
    // Check if bucket already exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      return;
    }
    
    console.log('Available buckets:', buckets.map(b => b.name));
    
    // Check if complaint-evidence bucket exists
    const evidenceBucket = buckets.find(bucket => bucket.name === 'complaint-evidence');
    
    if (evidenceBucket) {
      console.log('✅ complaint-evidence bucket already exists:', evidenceBucket);
      return;
    }
    
    console.log('Creating complaint-evidence bucket...');
    
    const { data: createData, error: createError } = await supabase.storage.createBucket('complaint-evidence', {
      public: false,
      allowedMimeTypes: ['image/*', 'application/pdf', 'video/*', 'text/*'],
      fileSizeLimit: 10485760 // 10MB
    });
    
    if (createError) {
      console.error('❌ Error creating bucket:', createError);
    } else {
      console.log('✅ Bucket created successfully:', createData);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
createBucketViaServer().then(() => {
  console.log('Bucket creation process completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
