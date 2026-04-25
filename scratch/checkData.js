require("dotenv").config();
const Database = require("../src/server/config/database");

async function check() {
  try {
    const supabase = Database.getServiceClient();

    // Check all user metadata to tell exactly who logged in
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if(users) {
      console.log("Logged in user might be one of these:");
      users.users.forEach(u => console.log(u.email, u.last_sign_in_at));
    }

    // Let's get department mappings
    const { data: mappings } = await supabase.from("department_subcategory_mapping").select("*, departments(code)");
    console.log("Mappings:", mappings?.slice(0, 5));

  } catch(e) { console.error(e); }
  process.exit(0);
}
check();
