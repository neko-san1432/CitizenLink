const fs = require('fs');
const path = require('path');

// Load mock complaints
const dataPath = path.join(__dirname, '../../DRIMS_Simulated_System/data/complaints/mock_complaints.json');
const data = require(dataPath);

// IDs already uploaded to database
const existingIds = [
    'fa9fdb0c-6a7b-4af5-bd09-96e9320807fb',
    '44dafae2-64fb-4054-96fc-60d263242ff2',
    '6b0be791-e13c-4a28-86c3-a34c04145295',
    '22b1a503-3d60-4b03-b169-a3e8a2f24d63',
    '57b0e5d5-43ff-48b2-b88d-b3829a2bdbcd',
    'c1976497-92f2-450f-9b43-a7cc944fbe2d',
    'a5784db0-3505-40b3-abad-55f3b15571a7',
    'ddd2e792-9ca8-44e0-8f84-1226386454c5',
    '775d5c26-a232-44a7-83ba-f9ed59bee954',
    '1ef357da-ec48-4cf8-8744-6218f8858e4b',
    '8aee13a8-bddc-4293-922f-5098aeefe551',
    '6f124f6c-4d97-42c6-8ccc-16042792e88d',
    'f672ae6f-d5d6-45fa-a146-cfed800df98a',
    'cf80f2d6-ea0a-413e-b22e-0b21cf4e6fbc',
    '4b0e04d1-fc86-44c2-bdd9-498cd7e674cf',
    'a2d3d4ac-ad48-4f3a-bcc7-44e582d6b18e',
    '169934a3-48c3-4d9f-aed1-af06f8d5efea'
];

const remaining = data.complaints.filter(c => !existingIds.includes(c.id));

console.log(`Total complaints in JSON: ${data.complaints.length}`);
console.log(`Already uploaded: ${existingIds.length}`);
console.log(`Remaining to generate: ${remaining.length}`);

let sql = `-- ============================================================================
-- ADDITIONAL MOCK COMPLAINTS (${remaining.length} remaining records)
-- Source: mock_complaints.json (blind test - no scenario metadata)
-- Run this AFTER the initial seed_mock_complaints.sql
-- ============================================================================

`;

const batchSize = 50;
for (let i = 0; i < remaining.length; i += batchSize) {
    const batch = remaining.slice(i, Math.min(i + batchSize, remaining.length));
    const batchNum = Math.floor(i / batchSize) + 1;

    sql += `-- Batch ${batchNum} (records ${i + 1} to ${i + batch.length})\n`;
    sql += `INSERT INTO public.complaints (
    id, submitted_by, descriptive_su, location_text, latitude, longitude,
    category, subcategory, department_r, workflow_status, priority, status,
    confirmation_status, confirmed_by_citizen, all_responders_confirmed,
    submitted_at, updated_at, last_activity_at
) VALUES\n`;

    batch.forEach((c, idx) => {
        // Generic location - no zone labels for blind testing
        const location = 'Digos City, Davao del Sur';
        const desc = (c.description || '').replace(/'/g, "''");
        const subcat = (c.subcategory || '').replace(/'/g, "''");

        sql += `(
    '${c.id}',
    (SELECT id FROM auth.users LIMIT 1),
    '${desc}',
    '${location}',
    ${c.latitude},
    ${c.longitude},
    '${c.category}',
    '${subcat}',
    '{}',
    '${c.workflow_status || 'new'}',
    '${c.priority || 'low'}',
    '${c.status || 'pending'}',
    '${c.confirmation_status || 'pending'}',
    ${c.confirmed_by_citizen || false},
    ${c.all_responders_confirmed || false},
    '${c.timestamp}',
    '${c.updated_at}',
    '${c.last_activity_at}'
)`;
        sql += (idx < batch.length - 1) ? ',\n' : ';\n\n';
    });
}

sql += `-- ============================================================================
-- Total: ${remaining.length} additional complaints added
-- Combined with initial 17, total dataset: ${data.complaints.length} complaints
-- ============================================================================\n`;

const outputPath = path.join(__dirname, '../database/seeds/seed_mock_complaints_batch2.sql');
fs.writeFileSync(outputPath, sql);
console.log(`\nGenerated: ${outputPath}`);
console.log(`File size: ${(sql.length / 1024).toFixed(1)} KB`);
