const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addStatusColumn() {
  console.log('🔄 Adding status column to complaints table...');

  try {
    // First, let's check if the status column already exists
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'complaints')
      .eq('table_schema', 'public');

    if (columnsError) {
      console.error('❌ Failed to check existing columns:', columnsError);
      process.exit(1);
    }

    const hasStatusColumn = columns.some(col => col.column_name === 'status');
    
    if (hasStatusColumn) {
      console.log('✅ Status column already exists, skipping creation');
    } else {
      console.log('📝 Status column does not exist, will need to be added manually via Supabase dashboard');
      console.log('🔧 Please run this SQL in your Supabase SQL editor:');
      console.log(`
        ALTER TABLE public.complaints 
        ADD COLUMN status VARCHAR(50) DEFAULT 'pending';
        
        CREATE INDEX idx_complaints_status ON public.complaints(status);
        
        UPDATE public.complaints 
        SET status = CASE 
            WHEN workflow_status = 'submitted' THEN 'pending'
            WHEN workflow_status = 'assigned' THEN 'assigned'
            WHEN workflow_status = 'in_progress' THEN 'in_progress'
            WHEN workflow_status = 'resolved' THEN 'resolved'
            WHEN workflow_status = 'rejected' THEN 'rejected'
            WHEN workflow_status = 'closed' THEN 'closed'
            ELSE 'pending'
        END;
        
        COMMENT ON COLUMN public.complaints.status IS 'Current status of the complaint (pending, assigned, in_progress, resolved, rejected, closed)';
      `);
    }

    // Test if we can query the status column
    const { data: testData, error: testError } = await supabase
      .from('complaints')
      .select('id, status')
      .limit(1);

    if (testError) {
      console.log('⚠️ Status column not yet available:', testError.message);
      console.log('📋 Please add the status column manually using the SQL above');
    } else {
      console.log('✅ Status column is available and working');
      console.log('🎉 Status column migration completed successfully!');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('📋 Please add the status column manually using the SQL provided above');
  }
}

// Run the migration
addStatusColumn();
