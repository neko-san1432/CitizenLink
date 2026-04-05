/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const DEFAULT_COUNT = 50000;
const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_OUT = path.join(__dirname, "../../src/db/seeds/seedBulkComplaints.sql");
const DEFAULT_SPLIT_ROWS = 0;

const TAXONOMY = [
  {
    category_id: "a76a9f5d-cb62-4161-851c-9bf0cbd3e1a0",
    category_name: "Animal Control",
    subcategories: [
      { subcategory_id: "547df319-957b-410a-a7e5-4f343f4f809b", subcategory_name: "Stray Animals" }
    ]
  },
  {
    category_id: "f3d99001-dfdc-4bd8-a1b3-f079d8ff7db3",
    category_name: "Emergency",
    subcategories: []
  },
  {
    category_id: "53f33fb6-c3ab-4359-bf29-1294be75020b",
    category_name: "Environment",
    subcategories: [
      { subcategory_id: "e57d34d6-30f6-4ef2-931a-fdf705e75c8f", subcategory_name: "Air Pollution" },
      { subcategory_id: "cec6cde6-5577-4a56-82f8-9e5e6bdc4a30", subcategory_name: "Clogged Drain" },
      { subcategory_id: "0800d285-2bfd-4722-8e6d-28b982359c9f", subcategory_name: "Earthquake" },
      { subcategory_id: "5ba4d4b1-8b41-4c5e-8530-96e478433f08", subcategory_name: "Evacuation" },
      { subcategory_id: "f18c5bd0-5da5-406b-b4d2-b69367f16ad5", subcategory_name: "Flash Flood" },
      { subcategory_id: "d43030cf-c808-45df-a657-070d791c2bd9", subcategory_name: "Flood" },
      { subcategory_id: "b1ff34f2-0943-4a59-994a-957873112c4f", subcategory_name: "Flooding" },
      { subcategory_id: "ef608928-b654-4174-8dcc-6929ecbc2266", subcategory_name: "Illegal Dumping" },
      { subcategory_id: "fe7ba591-c84c-4732-847b-370ac687b7cf", subcategory_name: "Landslide" },
      { subcategory_id: "e9a0806b-01ec-40c1-bf40-02be24b720f8", subcategory_name: "Maintenance" },
      { subcategory_id: "e19e46fa-aa2f-4e29-9eeb-88b9de3bde07", subcategory_name: "Stranded" }
    ]
  },
  {
    category_id: "37191c5a-e0ff-44ef-b1b3-82e829b4af30",
    category_name: "Health Hazard",
    subcategories: [
      { subcategory_id: "5d1c141a-6749-47bd-b55f-8c9797fc23d8", subcategory_name: "Disease Outbreak" }
    ]
  },
  {
    category_id: "0c453bce-a885-4223-b105-057165e837c3",
    category_name: "Infrastructure",
    subcategories: [
      { subcategory_id: "f87cf825-79a1-4e67-8b9d-28ca5a21a90b", subcategory_name: "Bridge Collapse" },
      { subcategory_id: "05b9ed9a-2829-4ab6-8d0f-71dfb9851b7c", subcategory_name: "Broken Streetlight" },
      { subcategory_id: "38ec0edd-e2da-411d-918e-8a3a43ff095e", subcategory_name: "Clogged Canal" },
      { subcategory_id: "2eda9ae7-7b8a-4fc4-9661-862f9b4b09c3", subcategory_name: "Clogged Drainage" },
      { subcategory_id: "cdcb3b0c-d1ab-46a7-b02e-0b12020db2ad", subcategory_name: "Pothole" },
      { subcategory_id: "d461f137-969a-4063-8bce-c0400e809cb6", subcategory_name: "Road Damage" },
      { subcategory_id: "23e721d6-6ec4-4d9b-b99a-3d7c282be9d5", subcategory_name: "Road Maintenance" },
      { subcategory_id: "cd50362f-8203-48b8-a55f-47419765b5f0", subcategory_name: "Road Obstruction" },
      { subcategory_id: "3417063b-42c7-4bd1-a612-c6ddafe270a1", subcategory_name: "Streetlight" }
    ]
  },
  {
    category_id: "bc9d791e-fc08-48f4-9d2f-2393f6f3bf10",
    category_name: "Noise",
    subcategories: []
  },
  {
    category_id: "0a80af7b-77d2-41a0-bd39-e6dd4004d993",
    category_name: "Noise Complaint",
    subcategories: [
      { subcategory_id: "ee3ecec9-c255-4594-abf1-267bc4caf504", subcategory_name: "Barking Dog" },
      { subcategory_id: "f0e6d8e8-b771-449f-aa5e-a0de962d1a2f", subcategory_name: "Karaoke" },
      { subcategory_id: "5b315c3c-2593-4d02-b7f5-33dcb318d9bd", subcategory_name: "Loud Music" }
    ]
  },
  {
    category_id: "c8cf6e50-0e8d-4547-82ee-7b983796e5ca",
    category_name: "Others",
    subcategories: []
  },
  {
    category_id: "f37b5995-c36e-444a-a41b-0e2bce4cce54",
    category_name: "Pest Infestation",
    subcategories: [
      { subcategory_id: "79e759f6-12e4-4075-9630-053daf41654f", subcategory_name: "Animal Control" },
      { subcategory_id: "6c45241d-2904-4a84-9f81-f25c0203ee3a", subcategory_name: "General Infestation" },
      { subcategory_id: "80f597b0-8a72-4602-bf1a-d641715c900a", subcategory_name: "Mosquito Breeding" },
      { subcategory_id: "4420ae38-84a5-44ae-a69d-275920c8711b", subcategory_name: "Rodent Infestation" },
      { subcategory_id: "03b021f2-0fca-46d4-aa5d-37e44e86074e", subcategory_name: "Snake Sighting" },
      { subcategory_id: "210d9935-ccaf-45ac-839a-c69400bf15d6", subcategory_name: "Termite Infestation" }
    ]
  },
  {
    category_id: "59382df7-b539-4e98-abb0-70b672dca68f",
    category_name: "Public Safety",
    subcategories: [
      { subcategory_id: "68cbc5fa-b1be-48ca-a0a7-8496e15e446f", subcategory_name: "Accident" },
      { subcategory_id: "f5c6d13b-efad-4ab8-ab2c-6ca3b33052f8", subcategory_name: "Assault" },
      { subcategory_id: "3338fdc9-6b44-4b00-a59b-75449629f7e4", subcategory_name: "Building Collapse" },
      { subcategory_id: "12623eaa-95ed-44bb-8203-3258a8e6c17c", subcategory_name: "Casualty" },
      { subcategory_id: "658073b4-5bb1-4029-96bb-8ef48018da24", subcategory_name: "Crime" },
      { subcategory_id: "e1d1c7e3-b795-4ae4-8ff1-d6f4206ab15d", subcategory_name: "Explosion" },
      { subcategory_id: "298629ce-bd9c-4d3d-9b30-ca2f7ccb3309", subcategory_name: "Fire" },
      { subcategory_id: "6778e0c9-14bb-425f-9541-2c71962bf974", subcategory_name: "Gas Leak" },
      { subcategory_id: "ce95a306-3037-45e1-8869-9133be547c1e", subcategory_name: "Gunshot" },
      { subcategory_id: "54eeaba7-56b3-4c83-b466-421c56b3a1e8", subcategory_name: "Loitering" },
      { subcategory_id: "7805df37-3881-49e6-b1eb-01e3412e96ae", subcategory_name: "Medical" },
      { subcategory_id: "215169c7-1867-423f-a9bb-ca32668cb6b0", subcategory_name: "Noise Complaint" },
      { subcategory_id: "7bdd9787-a34f-49cd-913f-c70eaaf4fb23", subcategory_name: "Rescue" },
      { subcategory_id: "ad199f36-21d5-480b-bce2-a7f406ae48ac", subcategory_name: "Road Hazard" },
      { subcategory_id: "7a8b0626-670d-4e75-b780-12a539e5c45b", subcategory_name: "Robbery" },
      { subcategory_id: "6f79cf05-a8fe-472e-ae7f-7fc2e6dc5a1a", subcategory_name: "Stray Animals" },
      { subcategory_id: "9ab40f6e-7c77-47d0-b1c9-1f037606c5cf", subcategory_name: "Vandalism" }
    ]
  },
  {
    category_id: "3966088b-f349-40f7-a2b6-4913a6669339",
    category_name: "Sanitation",
    subcategories: [
      { subcategory_id: "586d511b-1443-40fc-8559-e2a678542fc1", subcategory_name: "Bad Odor" },
      { subcategory_id: "be0a64e0-157a-4721-a11d-790e68b62c83", subcategory_name: "Cleaning" },
      { subcategory_id: "bf2bd3e4-d0a0-4aec-a003-89d277b750b5", subcategory_name: "Clogged Drain" },
      { subcategory_id: "0299a85e-ad70-467c-aad1-0fdd9c111928", subcategory_name: "Dead Animal" },
      { subcategory_id: "9191e36e-807c-4936-ae98-396bad150ab5", subcategory_name: "Garbage" },
      { subcategory_id: "f69a7468-6dba-4585-8c00-8a3773938d78", subcategory_name: "Garbage Collection" },
      { subcategory_id: "da13b022-f5a6-4b40-bf67-54e3a7002596", subcategory_name: "Illegal Dumping" },
      { subcategory_id: "da575279-e484-44f9-b918-e67a5cba9c56", subcategory_name: "Overflowing Trash" },
      { subcategory_id: "a58a5c47-ee7c-4cf2-8e91-207940acdd78", subcategory_name: "Pest Infestation" },
      { subcategory_id: "7c020493-9b31-4fad-8c12-6ad21666635a", subcategory_name: "Sewage Leak" },
      { subcategory_id: "acef1f3b-ea8e-49ee-ad68-7e5ef42a6f43", subcategory_name: "Trash" }
    ]
  },
  {
    category_id: "b14e73cc-fe12-478f-8b61-b3bc09327753",
    category_name: "Stray Animals",
    subcategories: [
      { subcategory_id: "c2ecf32f-e5ef-41fe-ba64-4f0d1b795093", subcategory_name: "Stray Dog" }
    ]
  },
  {
    category_id: "98b07b7b-ba98-4347-9b81-b90c60f1e948",
    category_name: "Traffic",
    subcategories: [
      { subcategory_id: "41f3c874-3043-4112-89d8-4d51bfc1f1ac", subcategory_name: "Congestion" },
      { subcategory_id: "9e4b436e-69c5-48a0-86e3-8d25bc7e2235", subcategory_name: "Fallen Tree" },
      { subcategory_id: "bed36626-aaff-40e6-bf69-4c9edb8abbdf", subcategory_name: "Road Construction" },
      { subcategory_id: "aded2f9e-f75d-48b0-864f-78abb7be0ebb", subcategory_name: "Signal Malfunction" },
      { subcategory_id: "ba6f9f43-80df-4a7e-aa8c-1ef082451e05", subcategory_name: "Traffic Congestion" }
    ]
  },
  {
    category_id: "00190c73-0893-4e43-b25b-4d0e9cd9d479",
    category_name: "Traffic Congestion",
    subcategories: [
      { subcategory_id: "dffc3b78-a17c-42af-9167-8793382c6f36", subcategory_name: "Vehicle Breakdown" }
    ]
  },
  {
    category_id: "9cf955ac-e73f-475c-8b6c-4f475e18893d",
    category_name: "Utilities",
    subcategories: [
      { subcategory_id: "5814c0d2-e280-4c1f-8554-c443448fda16", subcategory_name: "Blackout" },
      { subcategory_id: "3340e0e9-1be5-4b08-96f7-0ee5da8ecd19", subcategory_name: "Low Pressure" },
      { subcategory_id: "b63e83a0-26bb-4748-b7c7-eabbb17183c2", subcategory_name: "No Water" },
      { subcategory_id: "0afd5bf2-fb96-463f-be14-d751c033b5d3", subcategory_name: "Pipe Leak" },
      { subcategory_id: "577f1e8c-c012-4f6c-9b20-d1c4f8d4ccf0", subcategory_name: "Power Line Down" },
      { subcategory_id: "716085e2-7ec4-4205-a0c8-3847ab6bfd70", subcategory_name: "Power Outage" },
      { subcategory_id: "5dae505f-e4b0-47a3-911f-b1f42d3a7bf6", subcategory_name: "Transformer Explosion" },
      { subcategory_id: "4c7ad319-4b79-44f6-9caa-51ecfa430f30", subcategory_name: "Water Supply" }
    ]
  }
];

const CATEGORY_WEIGHTS = {
  "Public Safety": 0.17,
  Environment: 0.12,
  Infrastructure: 0.11,
  Sanitation: 0.12,
  Utilities: 0.1,
  Traffic: 0.08,
  "Traffic Congestion": 0.03,
  Emergency: 0.04,
  "Health Hazard": 0.03,
  "Pest Infestation": 0.08,
  "Noise Complaint": 0.04,
  Noise: 0.02,
  "Animal Control": 0.02,
  "Stray Animals": 0.01,
  Others: 0.03
};

const DEPARTMENTS = [
  ["CSWDO"], ["MENRO"], ["CENRO"], ["BFP"], ["PNP"], ["CDRRMO"],
  ["CHO"], ["Engineering"], ["Traffic"], ["Barangay"], ["Utility"],
  ["MENRO", "Barangay"], ["PNP", "Barangay"], ["BFP", "CDRRMO"], []
];

const LOCATION_LABELS = [
  "Digos City, Davao del Sur",
  "Poblacion, Digos City",
  "Zone 2, Digos City",
  "San Miguel, Digos City",
  "Goma, Digos City",
  "Aplaya, Digos City",
  "Barangay Tres, Digos City"
];

const EN_ACTION = ["reported", "noticed", "experienced", "witnessed", "encountered"];
const TL_ACTION = ["nireport", "napansin", "naranasan", "nakita", "na-encounter"];
const BI_ACTION = ["gi report", "nakabantay", "naagian", "nakit-an", "nasinati"];

const NOISE_WORDS = ["pls", "asap", "grabe", "hala", "sus", "char", "charot", "awra", "siz", "beh"];

const METAPHORS = [
  "parang ilog na ang kalsada",
  "murag dagat ang dalan",
  "the road looks like a wounded spine",
  "ang kanal murag tiyan nga napuno",
  "streetlight is blinking like it is gasping"
];

const ABBREV = {
  government: "govt",
  barangay: "brgy",
  please: "pls",
  department: "dept",
  because: "coz",
  before: "b4"
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(items, getWeight) {
  const total = items.reduce((sum, item) => sum + getWeight(item), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= getWeight(item);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function randomDateWithinDays(daysBack) {
  const now = Date.now();
  const ms = Math.floor(Math.random() * daysBack * 24 * 60 * 60 * 1000);
  return new Date(now - ms);
}

function formatTs(d) {
  return d.toISOString();
}

function randomCoord(min, max) {
  return min + Math.random() * (max - min);
}

function toSqlTextArray(values) {
  if (!values || values.length === 0) return "'{}'";
  const escaped = values.map(v => String(v).replace(/"/g, "\\\"")).join(",");
  return `'{${escaped}}'`;
}

function escapeSql(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function uuid4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function maybeApplyAbbrev(text) {
  let out = text;
  Object.entries(ABBREV).forEach(([k, v]) => {
    if (Math.random() < 0.16) {
      const rx = new RegExp(`\\b${k}\\b`, "gi");
      out = out.replace(rx, v);
    }
  });
  return out;
}

function maybeLeet(text) {
  if (Math.random() > 0.25) return text;
  return text
    .replace(/e/gi, m => (Math.random() < 0.25 ? "3" : m))
    .replace(/a/gi, m => (Math.random() < 0.2 ? "4" : m))
    .replace(/o/gi, m => (Math.random() < 0.2 ? "0" : m));
}

function maybeDropLetters(text) {
  if (Math.random() > 0.22) return text;
  return text.replace(/[aeiou]/gi, m => (Math.random() < 0.1 ? "" : m));
}

function maybeTypos(text) {
  if (Math.random() > 0.3) return text;
  return text
    .replace(/traffic/gi, "trafic")
    .replace(/drainage/gi, "dranage")
    .replace(/garbage/gi, "garbge")
    .replace(/complaint/gi, "complant")
    .replace(/flood/gi, "flod");
}

function maybeCodeMix(text) {
  if (Math.random() > 0.45) return text;
  return `${text} ${pick(["unsaon ni", "ano na next", "need na gyud", "paki check pls", "wala pa response"])}`;
}

function maybeSlang(text) {
  if (Math.random() > 0.25) return text;
  return `${text} ${pick(NOISE_WORDS)}`;
}

function maybeMetaphor(text) {
  if (Math.random() > 0.2) return text;
  return `${text}; ${pick(METAPHORS)}`;
}

function normalizeSpaces(text) {
  return text.replace(/\s+/g, " ").trim();
}

function generateBaseDescription(categoryName, subcategoryName, isOthers) {
  const langMode = pick(["en", "tl", "bi", "mix", "mix"]);
  const place = pick(["kanto", "highway", "near market", "duol sa skwelahan", "near terminal"]);
  const actor = pick(["resident", "neighbor", "driver", "vendor", "student", "watcher"]);
  const subText = subcategoryName || "unclear issue";

  if (isOthers) {
    const uncertain = [
      "I cannot classify this exactly, mixed smell + noise + possible leak in one area",
      "di ko sure kung sanitation ba or utility, may amoy tapos nawalan pa ng tubig",
      "murag daghan problema sabay, naay saba unya naay baho ug kalit brownout",
      "complaint is vague but urgent feeling, maybe hazard maybe not",
      "unsa ni exactly dili ko sure category, weird smoke then loud bang then silence"
    ];
    return pick(uncertain);
  }

  if (langMode === "en") {
    return `A ${actor} ${pick(EN_ACTION)} ${subcategoryName || categoryName} near ${place}. Need quick action from local government.`;
  }
  if (langMode === "tl") {
    return `May ${subcategoryName || categoryName} na ${pick(TL_ACTION)} sa ${place}. Paki aksyunan agad ng barangay at city office.`;
  }
  if (langMode === "bi") {
    return `Naay ${subcategoryName || categoryName} nga ${pick(BI_ACTION)} duol sa ${place}. Palihug og aksyon dayon sa opisina.`;
  }

  return `May ${subText} nga ${pick(BI_ACTION)} sa ${place}, and the ${actor} ${pick(EN_ACTION)} it since yesterday. Paki check karon.`;
}

function enrichDescription(categoryName, subcategoryName) {
  const isOthers = categoryName === "Others";
  let text = generateBaseDescription(categoryName, subcategoryName, isOthers);
  text = maybeCodeMix(text);
  text = maybeAbbrev(text);
  text = maybeTypos(text);
  text = maybeLeet(text);
  text = maybeDropLetters(text);
  text = maybeSlang(text);
  text = maybeMetaphor(text);
  return normalizeSpaces(text);
}

function maybeAbbrev(text) {
  return maybeApplyAbbrev(text);
}

function selectTaxonomyRow() {
  const category = weightedPick(TAXONOMY, c => CATEGORY_WEIGHTS[c.category_name] || 0.03);
  const subcategory = category.subcategories.length > 0
    ? pick(category.subcategories)
    : null;

  return {
    category_id: category.category_id,
    category_name: category.category_name,
    subcategory_id: subcategory ? subcategory.subcategory_id : null,
    subcategory_name: subcategory ? subcategory.subcategory_name : null
  };
}

function pickPriority(categoryName) {
  if (["Emergency", "Public Safety", "Health Hazard"].includes(categoryName)) {
    return weightedPick(["high", "urgent", "medium", "low"], () => 1);
  }
  return weightedPick(["low", "medium", "high", "urgent"], () => 1);
}

function pickWorkflowStatus() {
  return weightedPick(
    ["submitted", "verified", "under_review", "action_taken", "resolved"],
    s => ({ submitted: 6, verified: 4, under_review: 5, action_taken: 3, resolved: 2 }[s])
  );
}

function pickStatus() {
  return weightedPick(["pending", "in-progress", "resolved", "closed"], s => {
    const map = { pending: 5, "in-progress": 4, resolved: 2, closed: 1 };
    return map[s];
  });
}

function pickConfirmationStatus() {
  return weightedPick(
    ["pending", "waiting_for_responders", "waiting_for_complainant", "confirmed", "disputed"],
    s => ({ pending: 5, waiting_for_responders: 3, waiting_for_complainant: 3, confirmed: 2, disputed: 1 }[s])
  );
}

function buildInsertRow(idx) {
  const tax = selectTaxonomyRow();
  const submittedAt = randomDateWithinDays(365);
  const updatedAt = new Date(submittedAt.getTime() + Math.floor(Math.random() * 18) * 24 * 60 * 60 * 1000);
  const lastActivityAt = new Date(updatedAt.getTime() + Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);
  const priority = pickPriority(tax.category_name);
  const workflow = pickWorkflowStatus();
  const status = pickStatus();
  const confirmation = pickConfirmationStatus();
  const confirmed = Math.random() < 0.18;
  const respondersConfirmed = Math.random() < 0.22;

  const lat = randomCoord(6.65, 7.2).toFixed(6);
  const lng = randomCoord(125.25, 125.8).toFixed(6);

  const description = enrichDescription(tax.category_name, tax.subcategory_name);
  const departments = pick(DEPARTMENTS);

  return `(
  ${escapeSql(uuid4())},
  (SELECT id FROM auth.users ORDER BY random() LIMIT 1),
  ${escapeSql(description)},
  ${escapeSql(pick(LOCATION_LABELS))},
  ${lat},
  ${lng},
  ${toSqlTextArray(departments)},
  ${escapeSql(workflow)},
  ${escapeSql(priority)},
  ${escapeSql(status)},
  ${escapeSql(confirmation)},
  ${confirmed ? "true" : "false"},
  ${respondersConfirmed ? "true" : "false"},
  ${escapeSql(formatTs(submittedAt))},
  ${escapeSql(formatTs(updatedAt))},
  ${escapeSql(formatTs(lastActivityAt))},
  ${escapeSql(tax.category_id)},
  ${tax.subcategory_id ? escapeSql(tax.subcategory_id) : "NULL"}
)`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    count: DEFAULT_COUNT,
    batchSize: DEFAULT_BATCH_SIZE,
    out: DEFAULT_OUT,
    splitRows: DEFAULT_SPLIT_ROWS
  };

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--count" && args[i + 1]) {
      parsed.count = Math.max(20000, Number(args[i + 1]));
      i += 1;
    } else if (a === "--batch" && args[i + 1]) {
      parsed.batchSize = Math.max(100, Number(args[i + 1]));
      i += 1;
    } else if (a === "--out" && args[i + 1]) {
      parsed.out = path.resolve(process.cwd(), args[i + 1]);
      i += 1;
    } else if (a === "--split-rows" && args[i + 1]) {
      parsed.splitRows = Math.max(0, Number(args[i + 1]));
      i += 1;
    }
  }

  if (!Number.isFinite(parsed.count) || parsed.count < 20000) parsed.count = 20000;
  if (!Number.isFinite(parsed.batchSize) || parsed.batchSize < 100) parsed.batchSize = 500;
  if (!Number.isFinite(parsed.splitRows) || parsed.splitRows < 0) parsed.splitRows = 0;

  return parsed;
}

function generateSqlRange({ startRow, endRow, batchSize, totalCount }) {
  let sql = "";
  sql += "-- Bulk Complaint Seed Dataset\n";
  sql += `-- Generated at: ${new Date().toISOString()}\n`;
  sql += `-- Total rows (overall): ${totalCount}\n`;
  sql += `-- Rows in this file: ${endRow - startRow}\n`;
  sql += `-- Row range (1-based): ${startRow + 1}-${endRow}\n`;
  sql += "-- Description profile: multilingual + noisy + ambiguous text\n\n";
  sql += "BEGIN;\n\n";

  const columns = [
    "id", "submitted_by", "description", "location_text", "latitude", "longitude",
    "departments", "workflow_status", "priority", "status", "confirmation_status",
    "confirmed_by_citizen", "all_responders_confirmed", "submitted_at", "updated_at",
    "last_activity_at", "category_id", "subcategory_id"
  ];

  for (let start = startRow; start < endRow; start += batchSize) {
    const end = Math.min(start + batchSize, endRow);
    sql += `-- Batch ${Math.floor((start - startRow) / batchSize) + 1}: rows ${start + 1} to ${end}\n`;
    sql += `INSERT INTO public.complaints (${columns.join(", ")}) VALUES\n`;

    const rows = [];
    for (let i = start; i < end; i += 1) {
      rows.push(buildInsertRow(i));
    }

    sql += `${rows.join(",\n")}\n`;
    sql += "ON CONFLICT (id) DO NOTHING;\n\n";
  }

  sql += "COMMIT;\n";
  return sql;
}

function writeSingleFile(cfg) {
  const sql = generateSqlRange({
    startRow: 0,
    endRow: cfg.count,
    batchSize: cfg.batchSize,
    totalCount: cfg.count
  });
  fs.mkdirSync(path.dirname(cfg.out), { recursive: true });
  fs.writeFileSync(cfg.out, sql, "utf8");
  return [cfg.out];
}

function writeSplitFiles(cfg) {
  const outDir = path.dirname(cfg.out);
  const ext = path.extname(cfg.out) || ".sql";
  const baseName = path.basename(cfg.out, ext);
  const files = [];

  fs.mkdirSync(outDir, { recursive: true });

  let part = 1;
  for (let start = 0; start < cfg.count; start += cfg.splitRows) {
    const end = Math.min(start + cfg.splitRows, cfg.count);
    const partPath = path.join(outDir, `${baseName}.part${String(part).padStart(3, "0")}${ext}`);
    const sql = generateSqlRange({
      startRow: start,
      endRow: end,
      batchSize: cfg.batchSize,
      totalCount: cfg.count
    });
    fs.writeFileSync(partPath, sql, "utf8");
    files.push(partPath);
    part += 1;
  }

  const runnerPath = path.join(outDir, `${baseName}.run.ps1`);
  const runner = [
    "param([Parameter(Mandatory=$true)][string]$DbUrl)",
    "$ErrorActionPreference = 'Stop'",
    "",
    "# Requires psql in PATH",
    ...files.map(f => `$sqlFile = \"${f.replace(/\\/g, "\\\\")}\"; Write-Host \"Running $sqlFile\"; psql \"$DbUrl\" -v ON_ERROR_STOP=1 -f $sqlFile`)
  ].join("\n");
  fs.writeFileSync(runnerPath, runner, "utf8");

  files.push(runnerPath);
  return files;
}

function main() {
  const cfg = parseArgs();
  const outputs = cfg.splitRows > 0 ? writeSplitFiles(cfg) : writeSingleFile(cfg);

  console.log(`[SEED] Generated ${cfg.count} complaints`);
  console.log(`[SEED] Batch size: ${cfg.batchSize}`);
  if (cfg.splitRows > 0) {
    console.log(`[SEED] Split rows: ${cfg.splitRows}`);
    console.log(`[SEED] Output files: ${outputs.length}`);
    console.log(`[SEED] Primary output: ${outputs[0]}`);
  } else {
    console.log(`[SEED] Output: ${cfg.out}`);
  }
  console.log("[SEED] Notes: includes Others, null subcategories, multilingual/noisy descriptions");
}

main();
