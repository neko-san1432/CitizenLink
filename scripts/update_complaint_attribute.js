require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateComplaintAttribute() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log("Usage: node scripts/update_complaint_attribute.js <complaint_id> <attribute_name> <new_value>");
    console.log("Example: node scripts/update_complaint_attribute.js 123-abc priority high");
    console.log('Example: node scripts/update_complaint_attribute.js 123-abc descriptive_su "New updated description"');
    process.exit(1);
  }

  const complaintId = args[0];
  const attribute = args[1];
  let value = args[2];

  // Try to parse booleans or numbers if applicable
  if (value === "true") value = true;
  else if (value === "false") value = false;
  else if (!isNaN(value) && value.trim() !== "") value = Number(value);

  console.log(`Updating complaint ${complaintId}: setting '${attribute}' to '${value}'...`);

  try {
    const { data, error } = await supabase
      .from("complaints")
      .update({
        [attribute]: value,
        updated_at: new Date().toISOString()
      })
      .eq("id", complaintId)
      .select();

    if (error) {
      throw new Error(error.message);
    }

    if (data && data.length > 0) {
      console.log("Update successful:", data[0]);
    } else {
      console.log("Update completed, but no data returned (check if ID exists).");
    }

  } catch (error) {
    console.error("Error updating complaint:", error.message);
    process.exit(1);
  }
}

updateComplaintAttribute();
