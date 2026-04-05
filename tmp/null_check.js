const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkNulls() {
  const { count: catNull, error: e1 } = await s.from('complaints').select('id', { count: 'exact', head: true }).is('category_id', null);
  const { count: subNull, error: e2 } = await s.from('complaints').select('id', { count: 'exact', head: true }).is('subcategory_id', null);
  const { count: total, error: e3 } = await s.from('complaints').select('id', { count: 'exact', head: true });

  console.log('Total Complaints:', total);
  console.log('Null category_id count:', catNull);
  console.log('Null subcategory_id count:', subNull);
}
checkNulls();
