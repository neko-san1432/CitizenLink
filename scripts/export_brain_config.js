require("dotenv").config();
const fs = require("fs");
const path = require("path");
const Database = require("../src/server/config/database");

function normalizeWhitespace(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
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

async function fetchAllRowsOptional(supabase, table, select, pageSize = 1000) {
  try {
    return await fetchAllRows(supabase, table, select, pageSize);
  } catch (e) {
    const message = e?.message || String(e);
    console.warn(`[BRAIN-CONFIG] Skipping optional table "${table}": ${message}`);
    return [];
  }
}

function loadTaxonomyJson() {
  const taxonomyPath = path.join(__dirname, "..", "public", "categories_subcategories.json");
  const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, "utf8"));
  return { taxonomyPath, taxonomy };
}

function extractCausalLinksFromDashboard() {
  const dashboardPath = path.join(__dirname, "..", "public", "brain-dashboard", "dashboard_production.js");
  const content = fs.readFileSync(dashboardPath, "utf8");
  const lines = content.split(/\r?\n/);

  const links = [];
  const re =
    /\{\s*cause:\s*'([^']+)'\s*,\s*effect:\s*'([^']+)'\s*,\s*correlation:\s*([0-9.]+)\s*\}/;

  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    links.push({
      cause: m[1],
      effect: m[2],
      correlation: Number(m[3]),
    });
  }

  return { dashboardPath, links };
}

function buildDictionaryFromDb({ keywords, anchors, metaphors, rules }) {
  const filipino_keywords = {};
  const english_keywords = {};

  for (const row of keywords) {
    if (!row?.term || !row?.category) continue;
    const mainCategory = normalizeWhitespace(String(row.category));
    const subCategory = normalizeWhitespace(String(row.subcategory || row.category || "General"));
    const term = String(row.term).trim();
    if (!term) continue;

    filipino_keywords[mainCategory] = filipino_keywords[mainCategory] || {};
    filipino_keywords[mainCategory][subCategory] = filipino_keywords[mainCategory][subCategory] || [];
    filipino_keywords[mainCategory][subCategory].push({
      term,
      translation: row.translation || "",
      confidence: typeof row.confidence === "number" ? row.confidence : 0.8,
      category: mainCategory,
    });

    english_keywords[mainCategory] = english_keywords[mainCategory] || [];
    english_keywords[mainCategory].push({
      term,
      confidence: typeof row.confidence === "number" ? row.confidence : 0.8,
      category: mainCategory,
    });
  }

  for (const row of anchors) {
    if (!row?.anchor_text || !row?.category) continue;
    const mainCategory = normalizeWhitespace(String(row.category));
    const term = String(row.anchor_text).trim();
    if (!term) continue;

    english_keywords[mainCategory] = english_keywords[mainCategory] || [];
    english_keywords[mainCategory].push({
      term,
      confidence: 0.75,
      category: mainCategory,
    });
  }

  const speculation_patterns = {
    conditional_triggers: [],
    risk_assessment_language: [],
    past_event_markers: [],
  };
  const severity_modifiers = { amplifiers: [], diminishers: [] };
  const negation_patterns = { no_issue_indicators: [] };
  const temporal_present = [];
  const temporal_past = [];
  const temporal_future = [];

  for (const r of rules || []) {
    if (!r || !r.rule_type || !r.pattern) continue;
    const ruleType = String(r.rule_type);
    const pattern = String(r.pattern);

    if (ruleType === "speculation_conditional") {
      speculation_patterns.conditional_triggers.push({
        pattern,
        type: "conditional",
        translation: r.translation || "",
      });
    } else if (ruleType === "speculation_risk") {
      speculation_patterns.risk_assessment_language.push({
        pattern,
        type: "speculative_risk",
        translation: r.translation || "",
      });
    } else if (ruleType === "speculation_past") {
      speculation_patterns.past_event_markers.push({
        pattern,
        type: "past_reference",
        translation: r.translation || "",
        is_current_emergency: r.is_current_emergency === true,
      });
    } else if (ruleType === "severity_amplifier") {
      severity_modifiers.amplifiers.push({
        term: pattern,
        multiplier: r.multiplier,
        translation: r.translation || "",
      });
    } else if (ruleType === "severity_diminisher") {
      severity_modifiers.diminishers.push({
        term: pattern,
        multiplier: r.multiplier,
        translation: r.translation || "",
      });
    } else if (ruleType === "negation_no_issue") {
      negation_patterns.no_issue_indicators.push({
        pattern,
        action: r.action || "filter_out",
        translation: r.translation || "",
      });
    } else if (ruleType === "temporal_present") {
      temporal_present.push(pattern);
    } else if (ruleType === "temporal_past") {
      temporal_past.push(pattern);
    } else if (ruleType === "temporal_future") {
      temporal_future.push(pattern);
    }
  }

  return {
    _metadata: {
      version: "body-export",
      languages: ["english", "filipino", "cebuano"],
      last_updated: new Date().toISOString().slice(0, 10),
    },
    filipino_keywords,
    english_keywords,
    metaphor_filters: {
      patterns: (metaphors || [])
        .filter((m) => m && m.pattern)
        .map((m) => ({
          pattern: m.pattern,
          literal: m.literal_meaning || null,
          actual_meaning: m.actual_meaning || null,
          filter_type: m.filter_type || null,
          is_emergency: m.is_emergency === true,
        })),
    },
    speculation_patterns,
    severity_modifiers,
    negation_patterns,
    temporal_present,
    temporal_past,
    temporal_future,
  };
}

async function main() {
  const outputPath = path.join(__dirname, "..", "public", "brain-config.json");

  const { taxonomy } = loadTaxonomyJson();
  const { links } = extractCausalLinksFromDashboard();

  const supabase = Database.getClient();
  const keywords = await fetchAllRows(
    supabase,
    "nlp_keywords",
    "term,category,subcategory,language,confidence,translation,updated_at"
  );
  const anchors = await fetchAllRows(supabase, "nlp_anchors", "category,anchor_text,created_at");
  const metaphors = await fetchAllRows(
    supabase,
    "nlp_metaphors",
    "pattern,literal_meaning,actual_meaning,filter_type,is_emergency,created_at"
  );
  const rules = await fetchAllRowsOptional(
    supabase,
    "nlp_dictionary_rules",
    "rule_type,pattern,translation,multiplier,action,is_current_emergency,updated_at"
  );

  const dictionaries = buildDictionaryFromDb({ keywords, anchors, metaphors, rules });

  const config = {
    metadata: {
      version: new Date().toISOString().slice(0, 10),
      generated_at: new Date().toISOString(),
      bundle: ["taxonomy", "dictionaries", "correlations"],
    },
    taxonomy,
    dictionaries,
    correlations: {
      knownCausalLinks: links,
    },
  };

  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(`OK: wrote ${outputPath}`);
  console.log(`- causal links: ${links.length}`);
  console.log(`- dictionary keywords: ${keywords.length}`);
  console.log(`- dictionary anchors: ${anchors.length}`);
  console.log(`- dictionary metaphors: ${metaphors.length}`);
  console.log(`- dictionary rules: ${rules.length}`);
}

main().catch((err) => {
  console.error("Fatal Error:", err?.message || String(err));
  process.exitCode = 1;
});
