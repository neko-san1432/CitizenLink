const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from("complaints").select("category_id, priority");
  if (error) {
    console.error(error);
    return;
  }

  const { data: categories } = await supabase.from("categories").select("*");
  const catMap = {};
  categories.forEach(c => catMap[c.id] = c.name);

  const catCounts = {};
  data.forEach(c => {
    const name = catMap[c.category_id] || `Unknown (${  c.category_id  })`;
    catCounts[name] = (catCounts[name] || 0) + 1;
  });

  console.log("Category Counts:", catCounts);
}

check();
