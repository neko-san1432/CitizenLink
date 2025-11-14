document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1) Init map in the complaints page
    const map = await initializeSimpleMap('complaint-map', {
      zoom: 15,
      scrollWheelZoom: true,
      doubleClickZoom: true
    });
    if (!map) return;
    // Remove tile changer (layers control) on this page only
    if (window.simpleMapLayerControl) {
      try { map.removeControl(window.simpleMapLayerControl); } catch {}
      window.simpleMapLayerControl = null;
    }
    // Nominatim address search (OpenStreetMap) as a Leaflet control embedded in the map
    let searchInput, searchBtn, resultsList;
    const SearchControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-bar');
        container.style.background = '#fff';
        container.style.padding = '6px';
        container.style.borderRadius = '6px';
        container.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
        container.style.minWidth = '220px';
        const row = L.DomUtil.create('div', '', container);
        row.style.display = 'flex';
        row.style.gap = '6px';
        row.style.alignItems = 'center';
        searchInput = L.DomUtil.create('input', '', row);
        searchInput.type = 'text';
        searchInput.placeholder = 'Search address or place';
        searchInput.style.flex = '1';
        searchInput.style.padding = '6px';
        searchInput.style.border = '1px solid #ccc';
        searchInput.style.borderRadius = '6px';
        searchBtn = L.DomUtil.create('button', '', row);
        searchBtn.type = 'button';
        searchBtn.textContent = 'Clear';
        searchBtn.setAttribute('aria-label', 'Clear search');
        searchBtn.style.padding = '6px 10px';
        searchBtn.style.border = '1px solid #ccc';
        searchBtn.style.borderRadius = '6px';
        searchBtn.style.background = '#f7f7f7';
        resultsList = L.DomUtil.create('div', '', container);
        resultsList.size = 4;
        resultsList.style.width = '100%';
        resultsList.style.display = 'none';
        resultsList.style.marginTop = '6px';
        resultsList.style.padding = '6px';
        resultsList.style.border = '1px solid #ddd';
        resultsList.style.borderRadius = '6px';
        resultsList.style.maxHeight = '120px';
        resultsList.style.overflowY = 'auto';
        resultsList.style.background = '#fff';
        resultsList.style.position = 'absolute';
        resultsList.style.zIndex = '1000';
        resultsList.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
        // Prevent map panning when interacting with the control
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        L.DomEvent.disableClickPropagation(resultsList);
        L.DomEvent.disableScrollPropagation(resultsList);
        return container;
      }
    });
    map.addControl(new SearchControl());
    // Swap to magnifying icon on small screens
    const mq = window.matchMedia('(max-width: 600px)');
    function setSearchButtonUI(matches) {

      if (matches) {
        searchBtn.textContent = '✖';
        searchBtn.style.minWidth = '36px';
        searchBtn.style.padding = '6px';
        searchBtn.setAttribute('aria-label', 'Clear search');
      } else {
        searchBtn.textContent = 'Clear';
        searchBtn.style.minWidth = '';
        searchBtn.style.padding = '6px 10px';
        searchBtn.setAttribute('aria-label', 'Clear search');
      }
    }
    setSearchButtonUI(mq.matches);
    try { mq.addEventListener('change', (e) => setSearchButtonUI(e.matches)); } catch { /* Safari fallback */ mq.addListener((e) => setSearchButtonUI(e.matches)); }
    // Simple scoring helpers
    function kmDistance(aLat, aLng, bLat, bLng) {

      const toRad = (d) => d * Math.PI / 180;
      const R = 6371;
      const dLat = toRad(bLat - aLat);
      const dLng = toRad(bLng - aLng);
      const lat1 = toRad(aLat);
      const lat2 = toRad(bLat);
      const s = Math.sin(dLat/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * (Math.sin(dLng/2) ** 2);
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
    }
    function classWeight(cls = '', type = '') {
      const weights = {
        city: 3, town: 2.8, village: 2.6, suburb: 2.4, neighbourhood: 2.2,
        amenity: 2.0, tourism: 1.8, shop: 1.6, building: 1.4,
        road: 1.2, highway: 1.2, address: 1.0
      };
      return (weights[type] || weights[cls] || 1.0);
    }
    function isInDigosByAddress(item) {
      const a = item && item.address ? item.address : {};
      const cityish = (a.city || a.town || a.municipality || a.village || a.county || '').toLowerCase();
      if (cityish.includes('digos')) return true;
      const stateish = (a.state_district || a.state || '').toLowerCase();
      if (stateish.includes('digos')) return true;
      return false;
    }
    function cleanDisplayName(name) {
      if (!name) return '';
      return name
        .replace(/,?\s*Digos City/gi, '')
        .replace(/,?\s*8002/gi, '')
        // eslint-disable-next-line security/detect-unsafe-regex
        .replace(/,?\s*Davao(\s+del\s+Sur)?/gi, '')
        .replace(/,?\s*Philippines/gi, '')
        .replace(/\s*,\s*,/g, ',')
        .replace(/^\s*,\s*/g, '')
        .replace(/\s*,\s*$/g, '')
        .trim();
    }
    async function runSearch(query) {
      if (!query || !query.trim()) return;
      // console.log removed for security
      try {
        resultsList.style.display = 'none';
        resultsList.innerHTML = '';
        // Bias search to Digos bounding box and exclude "Digos City" from results
        const viewbox = ['125.0,7.0','125.7,6.0']; // lon,lat pairs top-left and bottom-right
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&bounded=1&viewbox=${viewbox.join(',')}&q=${encodeURIComponent(query)}`;
        // console.log removed for security
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        const data = await res.json();
        // console.log removed for security
        if (!Array.isArray(data) || data.length === 0) {
          resultsList.innerHTML = '';
          resultsList.style.display = 'none';
          return;
        }
        // Prefer items whose address fields indicate Digos City
        const center = map.getCenter();
        let filtered = data.filter(isInDigosByAddress);
        // If none matched address fields, fall back to display_name containing 'Digos'
        if (filtered.length === 0) {
          filtered = data.filter(item =>
            String(item.display_name || '').toLowerCase().includes('digos')
          );
        }
        // Final guard: if still empty, accept nearby (within 15km of Digos center)
        if (filtered.length === 0) {
          const digosLat = 6.75, digosLng = 125.35;
          filtered = data.filter(item => {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            return !Number.isNaN(lat) && !Number.isNaN(lon) && kmDistance(digosLat, digosLng, lat, lon) <= 15;
          });
        }
        // console.log removed for security
        const scored = filtered.map((item) => {
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          const distKm = kmDistance(center.lat, center.lng, lat, lon);
          const proximityScore = 1 / (1 + distKm); // 0..1
          const classScore = classWeight(item.class, item.type) / 3; // normalize ~0.33..1
          const nameLen = (item.display_name || '').length || 1;
          const brevity = Math.min(1, 20 / nameLen); // prefer shorter names
          const score = 0.6 * proximityScore + 0.3 * classScore + 0.1 * brevity;
          return { item, score };
        })
          .sort((a, b) => b.score - a.score)
          .slice(0, 3); // show best 3
        // console.log removed for security
        scored.forEach(({ item }) => {
          const resultItem = document.createElement('div');
          resultItem.style.padding = '8px';
          resultItem.style.cursor = 'pointer';
          resultItem.style.borderBottom = '1px solid #eee';
          resultItem.style.fontSize = '13px';
          resultItem.style.lineHeight = '1.3';
          resultItem.textContent = cleanDisplayName(item.display_name);
          resultItem.addEventListener('click', () => {
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);
            // console.log removed for security
            if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
              map.setView([lat, lng], Math.max(map.getZoom(), 16));
              resultsList.style.display = 'none';
              searchInput.value = cleanDisplayName(item.display_name);
            }
          });
          resultItem.addEventListener('mouseenter', () => {
            resultItem.style.background = '#f0f0f0';
          });
          resultItem.addEventListener('mouseleave', () => {
            resultItem.style.background = 'transparent';
          });
          resultsList.appendChild(resultItem);
        });
        resultsList.style.display = 'block';
      } catch (e) {
        console.error('❌ Search failed:', e);
      }
    }
    // Debounced input search
    let searchTimer = null;
    function triggerDebouncedSearch() {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => runSearch(searchInput.value), 500);
    }
    // Clear button: clears input and results
    searchBtn.addEventListener('click', () => {
      searchInput.value = '';
      resultsList.innerHTML = '';
      resultsList.style.display = 'none';
      searchInput.focus();
    });
    searchInput.addEventListener('input', triggerDebouncedSearch);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runSearch(searchInput.value);
      }
    });
    // Hide results when clicking outside
    document.addEventListener('click', (e) => {
      if (!resultsList.contains(e.target) && !searchInput.contains(e.target)) {
        resultsList.style.display = 'none';
      }
    });
    // 2) Helper to update hidden fields
    const latInput = document.getElementById('latitude');
    const lngInput = document.getElementById('longitude');
    const mapContainer = document.getElementById('complaint-map');
    let pin = null;
    let boundaryErrorMsg = null;
    // Boundary check function (simple bounding box for Digos City)
    function isWithinCityBoundary(lat, lng) {
      if (typeof lat !== 'number' || typeof lng !== 'number') return false;
      // Digos City approximate bounds
      const minLat = 6.6, maxLat = 7.0, minLng = 125.0, maxLng = 125.7;
      return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
    }
    // Show/hide boundary error message
    function showBoundaryError(show = true) {
      const mapGroup = mapContainer?.closest('.form-group');
      if (!mapGroup) return;
      if (show && !boundaryErrorMsg) {
        boundaryErrorMsg = document.createElement('div');
        boundaryErrorMsg.className = 'boundary-error-message';
        boundaryErrorMsg.style.cssText = `
          color: #dc3545;
          font-size: 0.875rem;
          margin-top: 8px;
          padding: 8px 12px;
          background-color: #f8d7da;
          border: 1px solid #f5c6cb;
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
        `;
        boundaryErrorMsg.innerHTML = `
          <span style="font-size: 1.2em;">⚠️</span>
          <span>Outside the jurisdiction of the city</span>
        `;
        mapGroup.appendChild(boundaryErrorMsg);
      } else if (!show && boundaryErrorMsg) {
        boundaryErrorMsg.remove();
        boundaryErrorMsg = null;
      }
    }
    function updateCoordinates(lat, lng) {
      latInput.value = lat.toFixed(6);
      lngInput.value = lng.toFixed(6);
      // Check boundary and show/hide error
      const withinBoundary = isWithinCityBoundary(lat, lng);
      showBoundaryError(!withinBoundary);
    }
    function setPin(lat, lng, moveMap = false) {

      if (!pin) {
        pin = L.marker([lat, lng], { draggable: false }).addTo(map);
      } else {
        pin.setLatLng([lat, lng]);
      }
      updateCoordinates(lat, lng);
      if (moveMap) map.setView([lat, lng], Math.max(map.getZoom(), 15));
    }
    // 3) While dragging/panning, keep marker at map center and update coords
    map.on('move', () => {
      const center = map.getCenter();
      if (pin) {
        pin.setLatLng(center);
      }
      updateCoordinates(center.lat, center.lng);
    });
    // 4) Map click to reposition map center and marker
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      map.setView([lat, lng], map.getZoom());
      setPin(lat, lng, false);
    });
    // 5) Try geolocation on load
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setPin(latitude, longitude, true);
        },
        () => {
          // Fallback to Digos center
          const [lat, lng] = [6.75, 125.35];
          setPin(lat, lng, true);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      // No geolocation support - use fallback
      const [lat, lng] = [6.75, 125.35];
      setPin(lat, lng, true);
    }
  } catch (e) {
    console.error('Complaint map init error:', e);
  }
});
