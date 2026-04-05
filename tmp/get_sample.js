const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function getSample() {
  const { data, error } = await supabase.from('complaints').select('*').is('category_id', null).limit(1);
  if (data) {
    fs.writeFileSync("tmp/full_null_sample.json", JSON.stringify(data[0], null, 2));
    console.log("Sample saved to tmp/full_null_sample.json");
  } else {
    console.log("No null records found.");
  }
}
getSample();
