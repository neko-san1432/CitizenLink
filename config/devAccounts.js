require("dotenv").config();

module.exports = {
  citizen: {
    email: process.env.DEV_CITIZEN_EMAIL || "",
    password: process.env.DEV_CITIZEN_PASSWORD || ""
  },
  lgu: {
    email: process.env.DEV_LGU_EMAIL || "",
    password: process.env.DEV_LGU_PASSWORD || ""
  },
  superAdmin: {
    email: process.env.DEV_SUPERADMIN_EMAIL || "",
    password: process.env.DEV_SUPERADMIN_PASSWORD || ""
  }
};
