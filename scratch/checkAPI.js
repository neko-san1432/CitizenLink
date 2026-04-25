require("dotenv").config();
const Database = require("../src/server/config/database");

async function check() {
  try {
    const supabase = Database.getServiceClient();

    const { data: deptCats, error } = await supabase.from("department_categories").select("*");
    if(deptCats) console.log("department_categories:", deptCats);
    else console.log(error);

  } catch(e) { console.error(e); }
  process.exit(0);
}
check();
