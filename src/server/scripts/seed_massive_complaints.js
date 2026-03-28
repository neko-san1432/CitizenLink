/**
 * Script to seed 10,000 random complaints within Digos City boundaries.
 */

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { loadDigosBoundary, getDigosBounds } = require("../../shared/boundaryValidator");
const crypto = require("crypto");

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Ray casting algorithm for point-in-polygon
function isPointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, polygonCoords) {
  const outerRing = polygonCoords[0];
  let inside = isPointInRing(point, outerRing);
  if (inside && polygonCoords.length > 1) {
    for (let i = 1; i < polygonCoords.length; i++) {
      if (isPointInRing(point, polygonCoords[i])) { inside = false; break; }
    }
  }
  return inside;
}

async function seedMassiveComplaints() {
  console.log("🚀 Starting massive seeding of 10,000 complaints...");

  // Load boundary and bounds
  const boundary = loadDigosBoundary();
  const bounds = getDigosBounds();
  const { coordinates, type } = boundary.geometry;

  // Get some real categories and departments to make data realistic
  const { data: categories } = await supabase.from("categories").select("id, name");
  const { data: subcategories } = await supabase.from("subcategories").select("id, name, category_id");
  const { data: departments } = await supabase.from("departments").select("code");
  const { data: users } = await supabase.from("user_profiles").select("id").limit(10); // Use some existing users as submitters

  const catList = categories || [];
  const subList = subcategories || [];
  const deptList = (departments || []).map(d => d.code);
  const userList = (users || []).map(u => u.id);

  if (userList.length === 0) {
    console.error("❌ Error: No users found in user_profiles to assign as submitters.");
    return;
  }

  const phrases = {
    english: [
      "Emergency: road accident near the plaza.",
      "Street lights are broken in our area.",
      "The garbage collection is delayed again.",
      "Heavy traffic due to illegal parking.",
      "Water supply interruption since morning.",
      "Construction dust is becoming unbearable.",
      "Illegal dumping detected in the vacant lot.",
      "I am writing to formally report a serious issue with the drainage system on our street. Every time it rains even slightly, the water builds up rapidly and overflows onto the sidewalk. This has been happening for three weeks now, and it's starting to smell really bad, likely due to the stagnant water attracting mosquitoes and other pests. We're worried about potential health hazards for our children who walk to school along this path. Please look into this immediately as the rainy season is approaching.",
      "The streetlights along the main road have been out for several nights now, creating a dangerous environment for commuters and residents alike. We have seen a few suspicious individuals loitering in the shadows, which makes us very uneasy about walking home late from work. This lack of proper illumination is an invitation for criminal activity, and we hope the city can repair these lights as soon as possible to restore our sense of security.",
      "I've noticed a significant increase in illegal dumping in the vacant lot next to our subdivision. People from other barangays seem to be bringing their construction debris and household waste and just leaving it there in the middle of the night. The smell is becoming unbearable, and I've seen rats running around the area recently. It's a complete eyesore and a major sanitation concern that needs to be addressed before it becomes a full-blown landfill."
    ],
    tagalog: [
      "May butas sa kalsada dito sa aming barangay.",
      "Patay ang mga ilaw sa labas ng bahay namin.",
      "Hindi pinu-punit ang basura sa kalsada.",
      "Masyadong maingay ang karaoke ng kapitbahay.",
      "Wala pong tubig buong araw.",
      "Maraming nakabalandrang sasakyan sa sidewalk.",
      "May nasusunog na basura sa likod ng palengke.",
      "Gusto ko lang pong ireklamo ang tumpok ng basura sa tapat ng aming bahay na halos isang linggo na pong hindi nakukuha ng garbage truck. Nangangamoy na po ito at dinudumog na ng mga langaw at aso, kaya kumakalat na ang dumi sa kalsada. Sana po ay maaksyunan agad ito dahil baka magdulot ito ng sakit sa aming pamilya, lalo na't may mga bata kaming kasama sa bahay. Maraming salamat po.",
      "Napakadelikado po ng malaking lubak dito sa kalsada malapit sa kanto namin. Noong nakaraang gabi lang ay may motorsiklong halos sumemplang dahil hindi niya napansin ang butas dahil madilim din ang mga poste ng ilaw dito. Nakakatakot po para sa mga dumadaan lalo na kung gabi at umuulan dahil natatakpan ng tubig ang lubak. Sana po ay matakpan o maayos agad ito bago pa magkaroon ng mas malalang aksidente.",
      "Reklamo ko lang po ang napakalakas na videoke ng aming kapitbahay na umaabot hanggang madaling araw. Hindi na po kami makatulog nang maayos at naaabala rin ang pag-aaral ng aking mga anak para sa kanilang exam bukas. Sinubukan na po naming kausapin sila nang maayos pero hindi po sila nakikinig at lalo pa nilang nilalakasan ang volume. Sana po ay may rumesponde rito para mapaalalahanan sila tungkol sa tamang oras ng paggamit ng videoke."
    ],
    bisaya: [
      "Daghan kaayong libaong sa kalsada diri.",
      "Guba man ang suga sa among dalan.",
      "Wala man gihapon gikuha ang basura.",
      "Saba kaayo ang silingan sige'g videoke.",
      "Hurot na jud ang tubig diri sa amoa.",
      "Bahô na kaayo ang kanal tungod sa basura.",
      "Nagpundok na sad ang mga istambay sa kanto.",
      "Sir/Ma'am, naay dako kaayong leak sa tubo sa tubig diri sa amoa duol sa basketbolan. Sayang kaayo ang tubig nga nag-agas lang sa dalan, halos tibuok adlaw na ni. Tungod ani, hinay kaayo ang agas sa amoa sulod sa balay ug dili mi makalaba o makaligo og tarong. Hinaot unta nga maadtoan ni og taga-water district para ma-repair dayon kay dako na kaayo ang usik sa atong resources.",
      "Grabe na jud ang kahuot sa trapiko diri sa amoa tungod aning mga sakyanan nga pataka lang og park sa kilid sa dalan. Ang mga sidewalk kay dili na maagian sa mga tawo kay gihimo na og parkingan, mao nga mapugos mig lakaw sa tunga sa kalsada nga delikado kaayo sa mga nagdagan nga motor ug sakyanan. Hinaot mapadal-an ni og traffic enforcer para mahapsay ang atong dalan ug malikayan ang disgrasya.",
      "Naunsa na man ning basura diri sa among dapit, wala na man jud gikuha sa truck sulod sa duha ka semana. Pwerte na jud bahoa, sir, dili na mi katarong og kaon tungod sa kaba-ho sa palibot. Naa na poy mga ilaga ug mga ulod nga nigawas sa mga plastic sa basura. Intawon, kaloy-i intawon mi diri kay basin og magkasakit mi ani tungod sa hugaw nga palibot. Palihog intawon og aksyon dayon."
    ]
  };

  // Function to apply L337-speak to a description
  function toL33t(text) {
    const map = { 'e': '3', 'a': '4', 'i': '1', 'o': '0', 's': '5', 't': '7' };
    return text.split('').map(char => {
        const lower = char.toLowerCase();
        // 30% chance to replace character if it's in the map
        if (map[lower] && Math.random() < 0.3) {
            return map[lower];
        }
        return char;
    }).join('');
  }

  const complaints = [];
  const totalToSeed = 10000;
  let count = 0;

  console.log(`📍 Generating ${totalToSeed} valid points within Digos...`);

  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const languages = ['english', 'tagalog', 'bisaya'];

  while (count < totalToSeed) {
    // Generate random point within bounds
    const lat = Math.random() * (bounds.maxLat - bounds.minLat) + bounds.minLat;
    const lng = Math.random() * (bounds.maxLng - bounds.minLng) + bounds.minLng;
    const point = [lng, lat];

    let isInside = false;
    if (type === "Polygon") {
      isInside = pointInPolygon(point, coordinates);
    } else if (type === "MultiPolygon") {
      for (const poly of coordinates) {
        if (pointInPolygon(point, poly)) { isInside = true; break; }
      }
    }

    if (isInside) {
      // Pick random language and phrase
      const lang = languages[Math.floor(Math.random() * languages.length)];
      const phraseList = phrases[lang];
      const baseDescription = phraseList[Math.floor(Math.random() * phraseList.length)];
      
      // Apply random L337-speak
      const description = toL33t(baseDescription);
      
      // DEPLOYMENT SCENARIOS: 5% chance to trigger a duplication cluster
      const DUPLICATE_CHANCE = 0.05;
      const isDuplicateTrigger = Math.random() < DUPLICATE_CHANCE && complaints.length > 10;

      let finalDescription = description;
      let finalLat = lat;
      let finalLng = lng;
      let finalCategory = catList[Math.floor(Math.random() * catList.length)];
      let finalSubcategory = subList.filter(s => s.category_id === finalCategory.id)[0] || null;
      let finalSubmittedAt;

      if (isDuplicateTrigger) {
        // Pick an existing complaint as the "Master" for this duplicate
        const master = complaints[Math.floor(Math.random() * complaints.length)];
        
        // Scenario 1: Near-exact duplicate (Same category, very close location)
        // Jitter within ~10 meters (0.0001 degrees)
        finalLat = master.latitude + (Math.random() * 0.0002 - 0.0001);
        finalLng = master.longitude + (Math.random() * 0.0002 - 0.0001);
        finalCategory = { id: master.category };
        finalSubcategory = { id: master.subcategory };
        
        // Scenario Variations
        const subScenario = Math.random();
        if (subScenario < 0.4) {
             // 40% chance: Exact same text
             finalDescription = master.description;
        } else if (subScenario < 0.8) {
             // 40% chance: Slightly modified text (L337-speak of the original)
             finalDescription = toL33t(master.description);
        } else {
             // 20% chance: "Someone else reporting the same thing" - different phrase, same category
             const lang = languages[Math.floor(Math.random() * languages.length)];
             finalDescription = phrases[lang][Math.floor(Math.random() * phrases[lang].length)];
        }

        // Temporal: Must be within 48 hours for detection
        const masterTime = new Date(master.submitted_at).getTime();
        const jitterTime = (Math.random() * 48 * 60 * 60 * 1000) - (24 * 60 * 60 * 1000); // ± 24 hours
        finalSubmittedAt = new Date(masterTime + jitterTime).toISOString();
      } else {
        // Normal generation
        finalSubmittedAt = Math.random() < 0.2 ? 
            new Date().toISOString() : 
            new Date(thirtyDaysAgo.getTime() + Math.random() * (now.getTime() - thirtyDaysAgo.getTime())).toISOString();
      }

      complaints.push({
        id: crypto.randomUUID(),
        submitted_by: userList[Math.floor(Math.random() * userList.length)],
        description: finalDescription,
        latitude: finalLat,
        longitude: finalLng,
        category: finalCategory.id,
        subcategory: finalSubcategory ? finalSubcategory.id : null,
        departments: [deptList[Math.floor(Math.random() * deptList.length)]],
        workflow_status: ["submitted", "verified", "under_review", "action_taken"][Math.floor(Math.random() * 4)],
        priority: ["low", "medium", "high", "urgent"][Math.floor(Math.random() * 4)],
        submitted_at: finalSubmittedAt,
        updated_at: finalSubmittedAt
      });
      
      count++;
      if (count % 1000 === 0) console.log(`   Processed ${count}...`);
    }
  }
  
  // POST-PROCESSING: Inject one guaranteed "High-Density Cluster" for testing
  // Location: Digos City Plaza (approx)
  console.log("📍 Injecting guaranteed Duplicate Cluster (Blocking Scenario)...");
  const plazaLat = 6.7578;
  const plazaLng = 125.3572;
  const infraCat = catList.find(c => c.name === "Infrastructure") || catList[0];
  const infraSub = subList.find(s => s.category_id === infraCat.id) || null;
  
  for (let i = 0; i < 8; i++) {
    const clusterTime = new Date().toISOString();
    complaints.push({
      id: crypto.randomUUID(),
      submitted_by: userList[Math.floor(Math.random() * userList.length)],
      description: "Static Cluster Test: Deep Pothole detected near City Plaza. Dangerous for motorcycles.",
      latitude: plazaLat + (Math.random() * 0.0001 - 0.00005), // ~5m jitter
      longitude: plazaLng + (Math.random() * 0.0001 - 0.00005),
      category: infraCat.id,
      subcategory: infraSub ? infraSub.id : null,
      departments: [deptList[Math.floor(Math.random() * deptList.length)]],
      workflow_status: "submitted",
      priority: "high",
      submitted_at: clusterTime,
      updated_at: clusterTime
    });
  }

  // EVENT CLUSTER: Same-Day Flash Flood (Large group, same day)
  console.log("📍 Injecting Large Event Cluster (Flash Flood - Same Day)...");
  const floodLat = 6.7500; // Mabini District (example)
  const floodLng = 125.3500;
  const envCat = catList.find(c => c.name === "Environment") || catList[0];
  const floodSub = subList.find(s => s.category_id === envCat.id && s.name.includes("Flood")) || null;
  
  const today = new Date();
  for (let i = 0; i < 15; i++) {
    // Reports distributed within 4 hours today
    const hourOffset = Math.random() * 4; 
    const reportTime = new Date(today.getTime() - hourOffset * 60 * 60 * 1000).toISOString();
    
    complaints.push({
      id: crypto.randomUUID(),
      submitted_by: userList[Math.floor(Math.random() * userList.length)],
      description: "URGENT: Water is rising fast in Mabini area. Houses are getting flooded. Need rescue assistance!",
      latitude: floodLat + (Math.random() * 0.0008 - 0.0004), // ~80m spread
      longitude: floodLng + (Math.random() * 0.0008 - 0.0004),
      category: envCat.id,
      subcategory: floodSub ? floodSub.id : null,
      departments: ["DRRMO"], // Most likely dept
      workflow_status: "submitted",
      priority: "urgent",
      submitted_at: reportTime,
      updated_at: reportTime
    });
  }

  console.log("💾 Inserting into database (in chunks)...");
  const chunkSize = 500;
  for (let i = 0; i < complaints.length; i += chunkSize) {
    const chunk = complaints.slice(i, i + chunkSize);
    const { error } = await supabase.from("complaints").insert(chunk);
    if (error) {
      console.error(`❌ Error inserting chunk at ${i}:`, error.message);
      break;
    }
    console.log(`   Inserted ${i + chunk.length} complaints...`);
  }

  console.log("✨ Seeding completed successfully!");
}

seedMassiveComplaints()
  .then(() => {
    console.log("🏁 Seeding complete.");
  })
  .catch(err => {
    console.error("💥 Fatal error:", err);
    process.exit(1);
  });
