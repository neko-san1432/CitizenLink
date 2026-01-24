require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Database = require('../src/server/config/database');

const SEED_FILE = path.join(__dirname, '../database/seeds/20260124_seed_nlp_data.sql');

async function runSeed() {
    console.log("🚀 Starting Auto-Fix Seed Runner...");

    if (!fs.existsSync(SEED_FILE)) {
        console.error(`❌ Seed file not found: ${SEED_FILE}`);
        return;
    }

    const sqlContent = fs.readFileSync(SEED_FILE, 'utf8');
    const supabase = Database.getClient();

    // Fetch existing categories
    const { data: existingConfigs, error: cfgError } = await supabase.from('nlp_category_config').select('category');
    const existingCatrogeriesSet = new Set(existingConfigs ? existingConfigs.map(c => c.category) : []);

    const insertRegex = /INSERT INTO\s+(?:public\.)?(\w+)\s*\(([^)]+)\)\s*VALUES\s*([\s\S]*?)(?:ON CONFLICT.*)?;(?=\s*(?:--|$)|$)/gi;

    let match;
    while ((match = insertRegex.exec(sqlContent)) !== null) {
        const tableName = match[1];
        if (tableName !== 'nlp_anchors') continue;

        const columnsStr = match[2];
        const valuesStr = match[3];
        const columns = columnsStr.split(',').map(c => c.trim());

        const rows = parseValues(valuesStr);
        console.log(`Parsed ${rows.length} anchors.`);

        const dataToInsert = rows.map(row => {
            const obj = {};
            columns.forEach((col, idx) => {
                obj[col] = row[idx];
            });
            return obj;
        });

        // Detect Missing Categories
        const missingCats = new Set();
        dataToInsert.forEach(a => {
            if (!existingCatrogeriesSet.has(a.category)) {
                missingCats.add(a.category);
            }
        });

        if (missingCats.size > 0) {
            console.log(`⚠️ Found ${missingCats.size} missing categories: ${Array.from(missingCats).join(', ')}`);
            // Insert missing categories
            const newCats = Array.from(missingCats).map(cat => ({
                category: cat,
                parent_category: null, // Assume top level
                urgency_rating: 30, // Default
                description: 'Auto-generated from anchors'
            }));

            const { error: insError } = await supabase.from('nlp_category_config').insert(newCats);
            if (insError) {
                console.error("❌ Failed to insert missing categories:", insError.message);
                return; // Stop if we can't fix dependency
            }
            console.log("✅ Missing categories inserted.");
        }

        // Insert Anchors
        console.log(`Inserting ${dataToInsert.length} anchors...`);
        const { error } = await supabase.from(tableName).insert(dataToInsert);
        if (error) console.error("❌ Anchor Insert Error:", error.message);
        else console.log("✅ Anchors inserted successfully.");
    }
}

function parseValues(str) {
    const rows = [];
    let currentRow = [];
    let currentVal = '';
    let inQuote = false;
    let inRow = false;

    // Filter comments
    const lines = str.split('\n');
    const cleanStr = lines.filter(l => !l.trim().startsWith('--')).join('\n');

    for (let i = 0; i < cleanStr.length; i++) {
        const char = cleanStr[i];

        if (char === '(' && !inQuote && !inRow) {
            inRow = true;
            currentRow = [];
            currentVal = '';
            continue;
        }

        if (char === ')' && !inQuote && inRow) {
            if (currentVal.trim() !== '' || inQuote) currentRow.push(cleanValue(currentVal));
            rows.push(currentRow);
            inRow = false;
            currentVal = '';
            continue;
        }

        if (char === "'" && !inQuote) {
            inQuote = true;
        } else if (char === "'" && inQuote) {
            if (cleanStr[i + 1] === "'") {
                currentVal += "'";
                i++;
            } else {
                inQuote = false;
            }
        } else if (char === ',' && !inQuote && inRow) {
            currentRow.push(cleanValue(currentVal));
            currentVal = '';
        } else if (inRow) {
            if (inQuote || char.trim() !== '') currentVal += char;
        }
    }
    return rows;
}

function cleanValue(val) {
    val = val.trim();
    if (!isNaN(val) && val !== '') return Number(val);
    return val;
}

runSeed();
