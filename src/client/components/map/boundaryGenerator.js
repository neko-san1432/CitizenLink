async function loadBoundaries() {
  try {
    // Wait for map instance to be available with shorter intervals
    const maxAttempts = 20;
    let attempts = 0;

    while (!window.simpleMap && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Reduced from 500ms to 100ms
      attempts++;
    }

    const M = window.simpleMap;
    if (!M) {
      throw new Error('Map failed to initialize after multiple attempts');
    }

    // Fetch boundaries data
    const response = await fetch('/api/boundaries');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const brgyData = await response.json();

    // Check if brgyData is an array
    if (!Array.isArray(brgyData)) {
      throw new Error('Boundary data is not in correct format');
    }

    // Add each barangay boundary to the map
    brgyData.forEach((barangay) => {
      const geojsonLayer = L.geoJSON(barangay.geojson, {
        style: {
          color: '#3388ff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0, // Slight fill for better visibility
        },

      });

      geojsonLayer.addTo(M);
    });

    // Add fit bounds to see if boundaries are outside view
    const bounds = L.geoJSON(brgyData.map(b => b.geojson)).getBounds();
    M.fitBounds(bounds, { padding: [20, 20] }); // Add padding for better view

    // console.log removed for security
  } catch (err) {
    console.error('Error loading boundaries:', err.message);
    console.error('Stack:', err.stack);
  }
}

// Initialize boundaries when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load boundaries immediately - no delay
    await loadBoundaries();
  } catch (error) {
    console.error('Failed to load boundaries:', error);
  }
});

/**
 * Create an inverted city boundary mask that fills everything OUTSIDE the city
 * @param {L.Map} map - Leaflet map instance
 * @param {Array} brgyData - Array of barangay data
 */
async function addCityBoundary(map, brgyData) {
  try {
    // console.log removed for security

    // Create a feature collection from all barangay geojson
    const allFeatures = brgyData.map(barangay => barangay.geojson);

    // Calculate the convex hull (outer boundary) of all barangays
    const cityBoundary = calculateConvexHull(allFeatures);

    if (cityBoundary) {
      // Create a world rectangle that covers the entire map
      const worldBounds = L.latLngBounds([-90, -180], [90, 180]);
      const worldRectangle = {
        type: 'Feature',
        properties: { name: 'World' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-180, -90], [-180, 90], [180, 90], [180, -90], [-180, -90]
          ]]
        }
      };

      // Create the inverted mask using a "donut" polygon
      const invertedMask = {
        type: 'Feature',
        properties: { name: 'Digos City Inverted Mask' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            worldRectangle.geometry.coordinates[0], // Outer ring (world)
            cityBoundary.geometry.coordinates[0]    // Inner ring (city boundary - creates the "hole")
          ]
        }
      };

      // Create the inverted mask layer
      const maskLayer = L.geoJSON(invertedMask, {
        style: {
          color: 'transparent',     // No border
          weight: 0,
          opacity: 0,
          fillOpacity: 0.3,         // Semi-transparent fill
          fillColor: '#000000'      // Black mask
        },
        onEachFeature(feature, layer) {
          layer.bindPopup(`
            <div>
              <h4>🏙️ Digos City Area</h4>
              <p>Highlighted area shows the city limits</p>
            </div>
          `);
        }
      });

      // Add inverted mask to map
      maskLayer.addTo(map);
      // console.log removed for security
    }
  } catch (error) {
    console.error('❌ Error creating inverted city boundary:', error);
  }
}