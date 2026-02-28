const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, 'views');
const faviconTag = '<link rel="icon" href="/favicon.ico" type="image/x-icon">';

function updateFaviconInFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let updatedContent = content;

        // Check if favicon link already exists
        // Regex matches <link rel="icon" ... > or <link ... rel="icon" ... >
        const faviconRegex = /<link\s+(?:[^>]*?\s+)?rel=["']icon["'][^>]*>/i;

        if (faviconRegex.test(content)) {
            // Replace existing favicon link
            console.log(`Updating favicon in: ${filePath}`);
            updatedContent = content.replace(faviconRegex, faviconTag);
        } else {
            // Insert new favicon link before <title> or </head>
            console.log(`Adding favicon to: ${filePath}`);
            if (content.includes('<title>')) {
                updatedContent = content.replace('<title>', `${faviconTag}\n  <title>`);
            } else if (content.includes('</head>')) {
                updatedContent = content.replace('</head>', `  ${faviconTag}\n</head>`);
            } else {
                console.warn(`Skipping ${filePath}: No <title> or </head> tag found.`);
                return;
            }
        }

        if (content !== updatedContent) {
            fs.writeFileSync(filePath, updatedContent, 'utf8');
            console.log(`Saved changes to: ${filePath}`);
        } else {
            console.log(`No changes needed for: ${filePath}`);
        }

    } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
    }
}

function traverseDirectory(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            traverseDirectory(fullPath);
        } else if (path.extname(file) === '.html') {
            updateFaviconInFile(fullPath);
        }
    }
}

console.log('Starting favicon update...');
traverseDirectory(viewsDir);
console.log('Favicon update complete.');
