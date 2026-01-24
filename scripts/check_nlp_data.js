require('dotenv').config();
const Database = require('../src/server/config/database');

async function check() {
    try {
        console.log("Checking NLP data...");
        const supabase = Database.getClient();

        // Check keywords
        const { count: kwCount, error: kwError } = await supabase
            .from('nlp_keywords')
            .select('*', { count: 'exact', head: true });

        if (kwError) console.error("Error checking keywords:", kwError.message);
        else console.log(`Keywords count: ${kwCount}`);

        // Check Category Config
        const { count: ccCount, error: ccError } = await supabase
            .from('nlp_category_config')
            .select('*', { count: 'exact', head: true });

        if (ccError) console.error("Error checking config:", ccError.message);
        else console.log(`Config count: ${ccCount}`);

        // Check anchors
        const { count: anCount, error: anError } = await supabase
            .from('nlp_anchors')
            .select('*', { count: 'exact', head: true });

        if (anError) console.error("Error checking anchors:", anError.message);
        else console.log(`Anchors count: ${anCount}`);

    } catch (err) {
        console.error("Fatal Error:", err.message);
    }
}

check();
