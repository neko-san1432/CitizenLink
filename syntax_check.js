const fs = require('fs');
const content = fs.readFileSync('c:/Users/Neko-san/Documents/projects/CitizenLink/public/js/analytics/dashboard/dashboardProduction.js', 'utf8');
try {
    new Function(content);
    console.log("Syntax OK");
} catch (e) {
    console.error("Syntax Error:", e.message);
    const lines = content.split('\n');
    const start = Math.max(0, e.lineNumber - 5);
    const end = Math.min(lines.length, e.lineNumber + 5);
    // Note: Node's Function constructor doesn't provide line numbers in the same way as a parser, 
    // but maybe we can find the error.
}
