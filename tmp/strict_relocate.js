require("dotenv").config({ path: "../.env" });
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Load the detailed barangay boundaries (which is what the frontend map uses)
const brgyPath = path.join(__dirname, "../public/assets/json/brgyBoundariesLocation.json");
const brgyData = JSON.parse(fs.readFileSync(brgyPath, "utf8"));

// Strict Point-in-Polygon (Ray Casting)
function isPointInRing(point, ring) {
  const [x, y] = point; // lng, lat
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInPolygonCoords(point, coords) {
  if (!coords || coords.length === 0) return false;
  let inside = isPointInRing(point, coords[0]); // outer ring
  if (inside && coords.length > 1) {
    for (let i = 1; i < coords.length; i++) {
      if (isPointInRing(point, coords[i])) {
        inside = false; // in a hole
        break;
      }
    }
  }
  return inside;
}

function isStrictlyInside(lat, lng) {
  const point = [lng, lat];
  for (const brgy of brgyData) {
    if (!brgy.geojson) continue;
    const geom = brgy.geojson;
    if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates) {
        if (isPointInPolygonCoords(point, poly)) return true;
      }
    } else if (geom.type === "Polygon") {
      if (isPointInPolygonCoords(point, geom.coordinates)) return true;
    }
  }
  return false;
}

// Bounding box mapping to speed up generation
const minLat = 6.72;
const maxLat = 6.97;
const minLng = 125.26;
const maxLng = 125.39;

function generateStrictCoordinates() {
  let lat, lng, attempts = 0;
  do {
    lat = minLat + Math.random() * (maxLat - minLat);
    lng = minLng + Math.random() * (maxLng - minLng);
    attempts++;
    if (attempts > 5000) {
      throw new Error("Could not find point inside boundaries after 5000 attempts");
    }
  } while (!isStrictlyInside(lat, lng));
  return { lat, lng };
}

async function fixOutOfBounds() {
  console.log("Fetching all complaints...");
  const { data: complaints, error } = await supabase.from("complaints").select("id, latitude, longitude");

  if (error) {
    console.error("Error fetching:", error);
    return;
  }

  let outOfBoundsCount = 0;
  const updates = [];

  for (const c of complaints) {
    if (c.latitude && c.longitude && !isStrictlyInside(c.latitude, c.longitude)) {
      outOfBoundsCount++;
      const { lat: newLat, lng: newLng } = generateStrictCoordinates();
      updates.push(
        supabase.from("complaints").update({
          latitude: newLat,
          longitude: newLng
        }).eq("id", c.id)
      );
    }
  }

  console.log(`Found ${outOfBoundsCount} complaints strictly outside the barangay boundaries.`);

  if (updates.length > 0) {
    console.log("Relocating them strictly inside the drawn polygons...");
    // update in batches to avoid overwhelming connections
    for (let i = 0; i < updates.length; i += 10) {
      await Promise.all(updates.slice(i, i + 10));
      console.log(`Updated ${Math.min(i + 10, updates.length)} / ${updates.length}`);
    }
    console.log("Complete! All complaints are now safely inside Digos City.");
  } else {
    console.log("All complaints are already inside.");
  }
}

fixOutOfBounds();