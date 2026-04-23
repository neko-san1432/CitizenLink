require("dotenv").config();
const Database = require("../src/server/config/database");

async function check() {
  try {
    const supabase = Database.getServiceClient();
    
    // Group all complaints by category_id to see where the data actually went
    const { data: counts, error } = await supabase
      .from("complaints")
      .select("category_id");
      
    if (counts) {
      const freq = {};
      counts.forEach(c => {
         freq[c.category_id] = (freq[c.category_id] || 0) + 1;
      });
      console.log("Complaint counts by category_id:", freq);
      
      const { data: cats } = await supabase.from("categories").select("*");
      cats.forEach(c => console.log(c.id, "=>", c.name));
    }
  } catch(e) { console.error(e) }
  process.exit(0);
}
check();
