require("dotenv").config();
const Database = require("../config/database");

async function check() {
  const client = Database.getClient();
  const { count, error } = await client
    .from("complaints")
    .select("*", { count: "exact", head: true });

  if (error) console.error(error);
  else console.log(`Total Complaints: ${count}`);
  process.exit(0);
}
check();
