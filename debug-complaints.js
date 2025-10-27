/**
 * Simple debug script to check database connection and complaints
 */
require('dotenv').config();

async function debugDB() {
  try {
    console.log('=== DATABASE DEBUG ===');

    // Check environment variables
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');

    // Check if we can connect to database
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('\n=== TABLES CHECK ===');

    // Check complaints table
    const { data: complaints, error: complaintsError } = await supabase
      .from('complaints')
      .select('*')
      .limit(5);

    if (complaintsError) {
      console.error('Complaints table error:', complaintsError);
    } else {
      console.log(`Complaints table: ${complaints?.length || 0} records`);
      if (complaints && complaints.length > 0) {
        console.log('Sample complaint:', {
          title: complaints[0].title,
          workflow_status: complaints[0].workflow_status,
          submitted_by: complaints[0].submitted_by
        });
      }
    }

    // Check complaint_coordinators table
    const { data: coordinators, error: coordError } = await supabase
      .from('complaint_coordinators')
      .select('*');

    if (coordError) {
      console.error('Coordinators table error:', coordError);
    } else {
      console.log(`Coordinators table: ${coordinators?.length || 0} records`);
    }

    // Check departments table
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('*')
      .limit(5);

    if (deptError) {
      console.error('Departments table error:', deptError);
    } else {
      console.log(`Departments table: ${departments?.length || 0} records`);
    }

  } catch (error) {
    console.error('Debug error:', error);
  }
}

debugDB();
