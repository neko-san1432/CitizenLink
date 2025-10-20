const express = require('express');
const SettingController = require('../controllers/SettingController');
const { authenticateUser, requireRole } = require('../middleware/auth');

const router = express.Router();
const settingController = new SettingController();

router.get('/public',
  (req, res) => settingController.getPublicSettings(req, res)
);

router.get('/category/:category',
  authenticateUser,
  (req, res) => settingController.getSettingsByCategory(req, res)
);

router.post('/initialize',
  authenticateUser,
  requireRole(['super-admin']),
  (req, res) => settingController.initializeDefaults(req, res)
);

router.get('/',
  authenticateUser,
  requireRole(['lgu-admin', 'super-admin']),
  (req, res) => settingController.getAllSettings(req, res)
);

router.get('/:key',
  authenticateUser,
  requireRole(['lgu-admin', 'super-admin']),
  (req, res) => settingController.getSettingByKey(req, res)
);

router.post('/',
  authenticateUser,
  requireRole(['lgu-admin', 'super-admin']),
  (req, res) => settingController.createSetting(req, res)
);

router.put('/:key',
  authenticateUser,
  requireRole(['lgu-admin', 'super-admin']),
  (req, res) => settingController.updateSetting(req, res)
);

router.delete('/:key',
  authenticateUser,
  requireRole(['super-admin']),
  (req, res) => settingController.deleteSetting(req, res)
);

module.exports = router;
