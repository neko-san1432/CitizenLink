require("dotenv").config();
const fs = require("fs");
const path = require("path");
const Database = require("../src/server/config/database");

function isUuidLike(value) {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function normalizeWhitespace(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function loadTaxonomyFromPublic() {
  const filePath = path.join(__dirname, "..", "public", "categories_subcategories.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildTaxonomyLookups(taxonomy) {
  const parents = new Set(Object.keys(taxonomy?.categories || {}));
  const subcategories = new Set();

  for (const parent of parents) {
    const subs = taxonomy?.categories?.[parent]?.subcategories || [];
    for (const sub of subs) {
      subcategories.add(sub);
    }
  }

  const labelAliases = taxonomy?.label_aliases || {};
  const aliasMap = new Map();
  for (const [alias, canonical] of Object.entries(labelAliases)) {
    aliasMap.set(normalizeWhitespace(alias), normalizeWhitespace(canonical));
  }

  const validLabels = new Set(["Others", ...parents, ...subcategories]);
  const validLabelsWithAliases = new Set(validLabels);
  for (const [alias, canonical] of aliasMap.entries()) {
    validLabelsWithAliases.add(alias);
    validLabelsWithAliases.add(canonical);
  }

  return {
    parents,
    subcategories,
    aliasMap,
    validLabels,
    validLabelsWithAliases,
  };
}

async function fetchAllRows(supabase, table, select, pageSize = 1000) {
  let out = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    out = out.concat(rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

function printSection(title) {
  console.log("");
  console.log("=".repeat(80));
  console.log(title);
  console.log("=".repeat(80));
}

function printList(title, items, max = 50) {
  const arr = Array.isArray(items) ? items : [];
  const shown = arr.slice(0, max);
  console.log(`${title}: ${arr.length}`);
  for (const item of shown) console.log(`- ${item}`);
  if (arr.length > max) console.log(`... (${arr.length - max} more)`);
}

async function main() {
  const taxonomy = loadTaxonomyFromPublic();
  const lookups = buildTaxonomyLookups(taxonomy);

  const supabase = Database.getClient();

  printSection("Taxonomy Summary (categories_subcategories.json)");
  console.log(`Parents: ${lookups.parents.size}`);
  console.log(`Subcategories: ${lookups.subcategories.size}`);
  console.log(`Label aliases: ${lookups.aliasMap.size}`);

  const categories = await fetchAllRows(supabase, "categories", "id,name,is_active");
  const subcats = await fetchAllRows(supabase, "subcategories", "id,name,category_id,is_active");

  const activeCategories = categories.filter((c) => c && c.is_active);
  const activeSubcats = subcats.filter((s) => s && s.is_active);

  const dbCategoryNames = new Set(activeCategories.map((c) => normalizeWhitespace(c.name)).filter(Boolean));
  const dbSubcatNames = new Set(activeSubcats.map((s) => normalizeWhitespace(s.name)).filter(Boolean));

  const taxonomyParents = new Set([...lookups.parents].map(normalizeWhitespace));
  const taxonomySubcats = new Set([...lookups.subcategories].map(normalizeWhitespace));

  const dbCategoriesMissingInTaxonomy = [...dbCategoryNames].filter((n) => !lookups.validLabelsWithAliases.has(n));
  const taxonomyParentsMissingInDb = [...taxonomyParents].filter((n) => !dbCategoryNames.has(n));

  const dbSubcatsMissingInTaxonomy = [...dbSubcatNames].filter((n) => !lookups.validLabelsWithAliases.has(n));
  const taxonomySubcatsMissingInDb = [...taxonomySubcats].filter((n) => !dbSubcatNames.has(n));

  printSection("DB Category/Subcategory Names vs Taxonomy Labels");
  printList("DB categories not in taxonomy (or aliases)", dbCategoriesMissingInTaxonomy);
  printList("Taxonomy parents missing in DB categories", taxonomyParentsMissingInDb);
  printList("DB subcategories not in taxonomy (or aliases)", dbSubcatsMissingInTaxonomy);
  printList("Taxonomy subcategories missing in DB subcategories", taxonomySubcatsMissingInDb);

  const categoryById = new Map(activeCategories.map((c) => [c.id, c]));
  const subcatById = new Map(activeSubcats.map((s) => [s.id, s]));

  const complaints = await fetchAllRows(
    supabase,
    "complaints",
    "id,category,subcategory,workflow_status,submitted_at,updated_at"
  );

  const distinctCategoryValues = new Set();
  const distinctSubcategoryValues = new Set();
  for (const c of complaints) {
    if (!c) continue;
    if (c.category) distinctCategoryValues.add(String(c.category));
    if (c.subcategory) distinctSubcategoryValues.add(String(c.subcategory));
  }

  const categoryValues = [...distinctCategoryValues];
  const subcategoryValues = [...distinctSubcategoryValues];

  const categoryUuidLike = categoryValues.filter(isUuidLike);
  const categoryLabelLike = categoryValues.filter((v) => !isUuidLike(v));
  const subcategoryUuidLike = subcategoryValues.filter(isUuidLike);
  const subcategoryLabelLike = subcategoryValues.filter((v) => !isUuidLike(v));

  printSection("Complaints Field Shape (UUID vs Label)");
  console.log(`Distinct complaints.category values: ${categoryValues.length}`);
  console.log(`- UUID-like: ${categoryUuidLike.length}`);
  console.log(`- Label-like: ${categoryLabelLike.length}`);
  console.log(`Distinct complaints.subcategory values: ${subcategoryValues.length}`);
  console.log(`- UUID-like: ${subcategoryUuidLike.length}`);
  console.log(`- Label-like: ${subcategoryLabelLike.length}`);

  const unknownCategoryUuids = categoryUuidLike.filter((id) => !categoryById.has(id));
  const unknownSubcategoryUuids = subcategoryUuidLike.filter((id) => !subcatById.has(id));

  const invalidCategoryLabels = categoryLabelLike
    .map(normalizeWhitespace)
    .filter(Boolean)
    .filter((label) => !lookups.validLabelsWithAliases.has(label));
  const invalidSubcategoryLabels = subcategoryLabelLike
    .map(normalizeWhitespace)
    .filter(Boolean)
    .filter((label) => !lookups.validLabelsWithAliases.has(label));

  printSection("Complaints Values Not Resolving (DB IDs or Taxonomy Labels)");
  printList("Unknown category UUIDs (not in categories table)", unknownCategoryUuids);
  printList("Unknown subcategory UUIDs (not in subcategories table)", unknownSubcategoryUuids);
  printList("Invalid category labels (not in taxonomy)", [...new Set(invalidCategoryLabels)]);
  printList("Invalid subcategory labels (not in taxonomy)", [...new Set(invalidSubcategoryLabels)]);

  const subcatCategoryById = new Map(activeSubcats.map((s) => [s.id, s.category_id]));
  const mismatchedPairs = [];
  const mixedTypeRows = [];

  for (const c of complaints) {
    if (!c) continue;
    const cat = c.category ? String(c.category) : null;
    const sub = c.subcategory ? String(c.subcategory) : null;
    const catIsId = isUuidLike(cat);
    const subIsId = isUuidLike(sub);

    if ((cat && !catIsId && sub && subIsId) || (cat && catIsId && sub && !subIsId)) {
      mixedTypeRows.push(c.id);
      continue;
    }

    if (cat && sub && catIsId && subIsId) {
      const expectedCat = subcatCategoryById.get(sub);
      if (expectedCat && expectedCat !== cat) {
        mismatchedPairs.push(c.id);
      }
    }
  }

  printSection("Complaints Pair Consistency (category/subcategory)");
  printList("Mixed-type complaints (one UUID, one label)", mixedTypeRows);
  printList("Mismatched UUID pairs (subcategory not under category)", mismatchedPairs);

  const nlpCategoryConfig = await fetchAllRows(supabase, "nlp_category_config", "category");
  const nlpCategories = new Set(nlpCategoryConfig.map((c) => normalizeWhitespace(c.category)).filter(Boolean));
  const nlpNotInTaxonomy = [...nlpCategories].filter((n) => !lookups.validLabelsWithAliases.has(n));

  printSection("Body NLP Categories vs Taxonomy");
  printList("NLP categories not in taxonomy (or aliases)", nlpNotInTaxonomy);

  printSection("Status");
  console.log("OK: Taxonomy audit completed.");
}

main().catch((err) => {
  console.error("Fatal Error:", err?.message || String(err));
  process.exitCode = 1;
});
