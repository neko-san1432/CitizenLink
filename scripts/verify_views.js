const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

const viewsDir = path.join(__dirname, '../views');

// Mock Locals
const locals = {
    title: 'Test Title',
    user: { role: 'fake-role' },
    cssPaths: ['/css/test.css'],
    scriptPaths: ['/js/test.js'],
    appClass: 'test-class'
};

const filesToTest = [
    'pages/lgu-admin/dashboard.html',
    'pages/coordinator/dashboard.html',
    'pages/super-admin/dashboard.html', // Fixed path: pages/super-admin/dashboard.html (assuming typical structure) but checked file list earlier.
    'pages/shared/heatmap.html' // New shared location
];

console.log('--- Starting View Verification ---');

let errors = 0;

filesToTest.forEach(file => {
    const fullPath = path.join(viewsDir, file);
    if (!fs.existsSync(fullPath)) {
        console.error(`[MISSING] ${file}`);
        errors++;
        return;
    }

    try {
        console.log(`[TESTING] ${file}...`);
        const template = fs.readFileSync(fullPath, 'utf8');
        // We use include path relative to the file, which ejs handles if we provide 'filename' option
        ejs.render(template, locals, {
            filename: fullPath,
            root: viewsDir
        });
        console.log(`[PASS] ${file}`);
    } catch (err) {
        console.error(`[FAIL] ${file}`);
        console.error(err.message);
        errors++;
    }
});

if (errors > 0) {
    console.error(`\nFound ${errors} errors.`);
    process.exit(1);
} else {
    console.log('\nAll views compiled successfully.');
    process.exit(0);
}
