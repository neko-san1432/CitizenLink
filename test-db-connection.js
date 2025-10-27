require('dotenv').config();
const Database = require('./src/server/config/database');

async function testConnection() {
  console.log('🔍 Testing database connection...');
  console.log('Environment variables:');
  console.log('  SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ SET' : '❌ NOT SET');
  console.log('  SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ SET' : '❌ NOT SET');
  console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ SET' : '❌ NOT SET');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables!');
    console.log('Please set the following in your .env file:');
    console.log('  SUPABASE_URL=your_supabase_url');
    console.log('  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
    console.log('  SUPABASE_ANON_KEY=your_anon_key (optional for admin operations)');
    return;
  }

  const db = new Database();
  const isConnected = await db.testConnection();

  if (isConnected) {
    console.log('✅ Database connection successful!');
    console.log('✅ Ready to start server');
  } else {
    console.error('❌ Database connection failed!');
    console.log('Please check:');
    console.log('1. Your Supabase URL is correct');
    console.log('2. Your service role key is valid');
    console.log('3. Your database schema is properly set up');
    console.log('4. Your Supabase project is active');
  }
}

testConnection().catch(console.error);
