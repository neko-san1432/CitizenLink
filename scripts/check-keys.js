require('dotenv').config();
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Anon Key length:', anon ? anon.length : 0);
console.log('Service Key length:', service ? service.length : 0);
console.log('Keys are identical:', anon === service);
if (anon && service && anon === service) {
  console.error('CRITICAL ERROR: SUPABASE_SERVICE_ROLE_KEY is the same as SUPABASE_ANON_KEY!');
} else {
  console.log('Keys appear different.');
}
