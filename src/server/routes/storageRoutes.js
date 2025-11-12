const express = require('express');
const Database = require('../config/database');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();
const db = new Database();
const supabase = db.getClient();
// GET /api/storage/signed-url?path=bucketPath
router.get('/signed-url', authenticateUser, async (req, res) => {
  try {
    const {path} = req.query;
    if (!path) return res.status(400).json({ error: 'path is required' });
    // 5 minutes expiry
    const expiresIn = 60 * 5;
    const { data, error } = await supabase
      .storage
      .from('complaint-evidence')
      .createSignedUrl(path, expiresIn);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ url: data.signedUrl, expiresAt: Date.now() + expiresIn * 1000 });
  } catch (e) {
    console.error('[STORAGE] signed-url error:', e);
    res.status(500).json({ error: 'Failed to create signed URL' });
  }
});

module.exports = router;
