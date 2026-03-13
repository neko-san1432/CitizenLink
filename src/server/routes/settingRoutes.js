const express = require("express");
const SettingController = require("../controllers/SettingController");
const { authenticateUser, requireRole } = require("../middleware/auth");
const { csrfProtection } = require("../middleware/csrf");

const router = express.Router();
const settingController = new SettingController();

// SEC-16 FIX: CSRF protection on all state-changing routes
router.use(csrfProtection);
router.get("/public",
  (req, res) => settingController.getPublicsettings(req, res)
);
router.get("/category/:category",
  authenticateUser,
  (req, res) => settingController.getsettingsByCategory(req, res)
);
router.post("/initialize",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => settingController.initializeDefaults(req, res)
);
router.get("/",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  (req, res) => settingController.getAllsettings(req, res)
);
router.get("/:key",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  (req, res) => settingController.getsettingByKey(req, res)
);
router.post("/",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  (req, res) => settingController.createsetting(req, res)
);
router.put("/:key",
  authenticateUser,
  requireRole(["lgu", "super-admin"]),
  (req, res) => settingController.updatesetting(req, res)
);
router.delete("/:key",
  authenticateUser,
  requireRole(["super-admin"]),
  (req, res) => settingController.deletesetting(req, res)
);

module.exports = router;
