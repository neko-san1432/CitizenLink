require("dotenv").config();
const Database = require("../src/server/config/database");

async function checkTable(supabase, name) {
  try {
    const { count, error } = await supabase.from(name).select("*", { count: "exact", head: true });
    if (error) return { name, ok: false, error: error.message };
    return { name, ok: true, count: typeof count === "number" ? count : null };
  } catch (e) {
    return { name, ok: false, error: e?.message || String(e) };
  }
}

async function main() {
  const urlOk = Boolean(process.env.SUPABASE_URL);
  const keyOk = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  console.log("Supabase env:");
  console.log(`- SUPABASE_URL: ${urlOk ? "present" : "missing"}`);
  console.log(`- SUPABASE_SERVICE_ROLE_KEY: ${keyOk ? "present" : "missing"}`);

  if (!urlOk || !keyOk) {
    process.exitCode = 1;
    return;
  }

  const supabase = Database.getClient();
  const tables = [
    "nlp_keywords",
    "nlp_category_config",
    "nlp_anchors",
    "nlp_metaphors",
    "nlp_logs",
    "nlp_proposals",
    "nlp_dictionary_rules",
  ];

  const results = [];
  for (const t of tables) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await checkTable(supabase, t));
  }

  console.log("");
  console.log("NLP table checks:");
  for (const r of results) {
    if (r.ok) console.log(`- ${r.name}: OK (count=${r.count ?? "?"})`);
    else console.log(`- ${r.name}: FAIL (${r.error})`);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Fatal Error:", err?.message || String(err));
  process.exitCode = 1;
});
