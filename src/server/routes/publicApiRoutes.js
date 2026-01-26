const express = require("express");
const path = require("path");
const config = require("../../../config/app");
const { apiLimiter } = require("../middleware/rateLimiting");

const router = express.Router();

// ==================== GEOCODE CACHING SYSTEM ====================
/**
 * In-memory cache for reverse geocoding results
 * Reduces redundant Nominatim API calls for nearby coordinates
 * 
 * Key: "lat,lng" with 5-decimal precision (~1.1m accuracy)
 * Value: { data, timestamp }
 * 
 * @thesis-feature Implements geocode caching from CitizenLink_Simulated_System
 */
const geocodeCache = new Map();
const GEOCODE_CACHE_MAX_SIZE = 1000; // LRU eviction threshold
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const GEOCODE_RATE_LIMIT_MS = 1100; // Nominatim requires 1 request/second
let lastGeocodeRequestTime = 0;

/**
 * Generate cache key from coordinates (5-decimal precision)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Cache key
 */
function getGeocodeCacheKey(lat, lng) {
  return `${parseFloat(lat).toFixed(5)},${parseFloat(lng).toFixed(5)}`;
}

/**
 * Evict oldest entries if cache exceeds max size (LRU-style)
 */
function evictOldestCacheEntries() {
  if (geocodeCache.size <= GEOCODE_CACHE_MAX_SIZE) return;
  
  const entriesToDelete = geocodeCache.size - GEOCODE_CACHE_MAX_SIZE;
  const iterator = geocodeCache.keys();
  for (let i = 0; i < entriesToDelete; i++) {
    const key = iterator.next().value;
    geocodeCache.delete(key);
  }
}

// Public API endpoints

router.get("/boundaries", apiLimiter, async (req, res) => {
  try {
    const filePath = path.join(config.rootDir, "src", "client", "assets", "brgy_boundaries_location.json");
    const fs = require("fs").promises;

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Safe: reading static asset file with hardcoded path
    const jsonData = await fs.readFile(filePath, "utf8");
    res.json(JSON.parse(jsonData));
  } catch (error) {
    res.status(500).json({ error: "Failed to load boundaries data" });
  }
});

// Digos city boundary endpoint (for validation)
router.get("/digos-boundary", apiLimiter, async (req, res) => {
  try {
    const filePath = path.join(config.rootDir, "src", "client", "assets", "digos-city-boundary.json");
    const fs = require("fs").promises;

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Safe: reading static asset file with hardcoded path
    const jsonData = await fs.readFile(filePath, "utf8");
    res.json(JSON.parse(jsonData));
  } catch (error) {
    res.status(500).json({ error: "Failed to load Digos city boundary data" });
  }
});

router.get("/reverse-geocode", apiLimiter, async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: "Latitude and longitude are required" });
    }

    // ==================== CACHE CHECK ====================
    const cacheKey = getGeocodeCacheKey(lat, lng);
    const cachedEntry = geocodeCache.get(cacheKey);
    
    if (cachedEntry) {
      // Check TTL
      if (Date.now() - cachedEntry.timestamp < GEOCODE_CACHE_TTL_MS) {
        // Cache hit - return immediately without API call
        return res.json({
          ...cachedEntry.data,
          _cached: true,
          _cacheKey: cacheKey
        });
      } else {
        // Expired - remove from cache
        geocodeCache.delete(cacheKey);
      }
    }

    // ==================== RATE LIMITING ====================
    const now = Date.now();
    const timeSinceLastRequest = now - lastGeocodeRequestTime;
    if (timeSinceLastRequest < GEOCODE_RATE_LIMIT_MS) {
      // Wait to respect Nominatim rate limit
      await new Promise(resolve => setTimeout(resolve, GEOCODE_RATE_LIMIT_MS - timeSinceLastRequest));
    }
    lastGeocodeRequestTime = Date.now();

    // ==================== API CALL ====================
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "CitizenLink/1.0 (https://citizenlink.local)"
      }
    });
    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }
    const data = await response.json();

    // ==================== CACHE STORE ====================
    geocodeCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    evictOldestCacheEntries();

    res.json({
      ...data,
      _cached: false
    });
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    res.status(500).json({ error: "Failed to get address information" });
  }
});

module.exports = router;
