const express = require('express');
const config = require('../../../config/app');
const Database = require('../config/database');

const router = express.Router();

// GET /api/supabase/config - expose only safe client config
router.get('/config', (req, res) => {
  try {
    return res.json({
      success: true,
      url: config.supabase?.url || null,
      anonKey: config.supabase?.anonKey || null
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load config' });
  }
});

// POST /api/supabase - placeholder secure gateway (not enabled)
router.post('/', (req, res) => {
  return res.status(501).json({ success: false, error: 'Not implemented' });
});

module.exports = router;

