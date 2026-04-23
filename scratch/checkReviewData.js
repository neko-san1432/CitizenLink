const Database = require("../src/server/config/database");
const dotenv = require("dotenv");
dotenv.config();

async function checkData() {
    try {
        const supabase = Database.getServiceClient();
        const { data, count, error } = await supabase
            .from("complaints")
            .select("id, workflow_status, submitted_at", { count: 'exact' });

        if (error) throw error;

        console.log("Total complaints:", count);
        console.log("Recent complaints (first 5):");
        data.slice(0, 5).forEach(c => {
            console.log(`- ID: ${c.id}, Status: ${c.workflow_status}, Date: ${c.submitted_at}`);
        });

        const statusCounts = {};
        data.forEach(c => {
            statusCounts[c.workflow_status] = (statusCounts[c.workflow_status] || 0) + 1;
        });
        console.log("Status Breakdown:", statusCounts);

    } catch (err) {
        console.error("Error:", err.message);
    }
}

checkData();
