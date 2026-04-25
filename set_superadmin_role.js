require("dotenv").config();
const { citizen, lgu, superAdmin } = require("./config/devAccounts.js");
const db = require("./src/server/config/database.js").getInstance();
const supabase = db.getClient();

async function setSuperAdminRole() {
  const { data: users, error: fetchErr } = await supabase.auth.admin.listUsers();
  if (fetchErr) {
    console.error("List users error:", fetchErr);
    return;
  }
  const saUser = users.users.find(u => u.email === superAdmin.email);
  if (!saUser) {
    console.log("Superadmin not found by email");
    return;
  }
  const { error: updateErr } = await supabase.auth.admin.updateUserById(saUser.id, {
    user_metadata: { ...saUser.user_metadata, role: "super-admin", normalized_role: "super-admin" }
  });
  if (updateErr) {
    console.error("Error updating role:", updateErr);
  } else {
    console.log("Super admin role updated successfully!");
  }
}
setSuperAdminRole();
