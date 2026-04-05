require('dotenv').config({ path: '../.env' }); // or we are in root
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function checkComplaints() {
    const { data, error } = await supabase
        .from('complaints')
        .select('*');
        
    if (error) {
        console.error('Error fetching complaints:', error);
        return;
    }

    console.log(`Found ${data.length} complaints.`);
    console.log('Sample data:', JSON.stringify(data.slice(0, 3), null, 2));

    // Analyze coordinates patterns
    let cebuCityCount = 0;
    let missingCoords = 0;
    data.forEach(c => {
        if (!c.latitude || !c.longitude) {
            missingCoords++;
        }
    });

    console.log(`Missing coordinates: ${missingCoords}`);
}

checkComplaints();
