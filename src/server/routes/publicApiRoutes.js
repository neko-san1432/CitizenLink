const express = require('express');
const path = require('path');
const config = require('../../../config/app');
const { apiLimiter } = require('../middleware/rateLimiting');

const router = express.Router();

// Public API endpoints

router.get('/boundaries', apiLimiter, async (req, res) => {
  try {
    const filePath = path.join(config.rootDir, 'src', 'client', 'assets', 'brgy_boundaries_location.json');
    const fs = require('fs').promises;

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Safe: reading static asset file with hardcoded path
    const jsonData = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(jsonData));
  } catch (error) {
    res.status(500).json({ error: 'Failed to load boundaries data' });
  }
});

// Digos city boundary endpoint (for validation)
router.get('/digos-boundary', apiLimiter, async (req, res) => {
  try {
    const filePath = path.join(config.rootDir, 'src', 'client', 'assets', 'digos-city-boundary.json');
    const fs = require('fs').promises;

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Safe: reading static asset file with hardcoded path
    const jsonData = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(jsonData));
  } catch (error) {
    res.status(500).json({ error: 'Failed to load Digos city boundary data' });
  }
});

router.get('/reverse-geocode', apiLimiter, async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'CitizenLink/1.0 (https://citizenlink.local)'
      }
    });
    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    res.status(500).json({ error: 'Failed to get address information' });
  }
});

module.exports = router;
