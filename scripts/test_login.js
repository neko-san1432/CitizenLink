const axios = require("axios");

const BASE_URL = "http://localhost:3000"; // Assuming running on 3000 based on previous logs, user said 3001 in code but let's check.
// Actually AuthController.js user code showed port 3001 in redirects, but let's assume default express port.
// I'll check the current running port if this fails, but usually it's 3000 or 3001.

const USERS = [
  { email: "citizen@gmail.com", password: "12345678", label: "CITIZEN" },
  { email: "lgu_officer@example.com", password: "Password123!", label: "LGU" }
];

async function testLogin() {
  console.log("🚀 Testing Login Endpoints...");

  for (const user of USERS) {
    console.log(`\n➤ Testing ${user.label} Login (${user.email})...`);
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: user.email,
        password: user.password
      }, {
        validateStatus: status => true // Don't throw on error status
      });

      console.log(`   Status: ${response.status} ${response.statusText}`);
      if (response.status === 200) {
        console.log("   ✅ Login Successful");
        // console.log("   Data:", response.data);
      } else {
        console.log("   ❌ Login Failed");
        console.log("   Response:", response.data);
      }
    } catch (error) {
      console.log(`   ❌ Request Error: ${error.message}`);
      if (error.response) {
        console.log(`   Response Data:`, error.response.data);
      }
    }
  }
}

testLogin();
