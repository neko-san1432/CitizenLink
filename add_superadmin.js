require("dotenv").config();
const { citizen, lgu, superAdmin } = require("./config/devAccounts.js");
const userService = require("./src/server/services/user/UserService.js");

async function main() {
  try {
    console.log("Adding super admin...");
    const result = await userService.createUser({
      email: superAdmin.email,
      password: superAdmin.password,
      firstName: "Super",
      lastName: "Admin",
      role: "super-admin",
      department: "Admin",
      mobileNumber: "09123456789",
      gender: "other",
      address: {
        line1: "123 Admin St",
        city: "Admin City",
        province: "Admin Province",
        postalCode: "1234",
        barangay: "Admin Barangay"
      }
    });
    console.log("Super admin added successfully.", result);
  } catch (error) {
    console.error("Error adding super admin:", error);
  }
}
main();
