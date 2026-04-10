const fs = require('fs');
const path = require('path');

const srcFolders = ['src', 'public/js', 'config'];
const outputDir = path.join(__dirname, 'docs', 'api');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

function parseFile(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    const docs = [];
    
    // High-level summary (find first block comment)
    const summaryMatch = code.match(/^\s*\/\*\*?([\s\S]*?)\*\//);
    const summary = summaryMatch ? summaryMatch[1].replace(/^\s*\* ?/gm, '').trim() : 'No summary provided.';
    
    // Functions and methods
    const fnRegex = /(?:(?:\/\*\*?([\s\S]*?)\*\/\s*)?(?:export\s+|async\s+)*?(?:function\s+([a-zA-Z0-9_]+)|\b([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>|\b([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{))/g;
    
    let match;
    while ((match = fnRegex.exec(code)) !== null) {
        const comment = match[1] ? match[1].replace(/^\s*\* ?/gm, '').trim() : '';
        const name = match[2] || match[3] || match[4];
        if (name && !['if', 'for', 'while', 'catch', 'switch'].includes(name)) {
            docs.push({ name, comment: comment || 'No documentation provided.' });
        }
    }
    
    return { summary, functions: docs };
}

function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.js')) {
            results.push(file);
        }
    });
    return results;
}

let indexMd = '# API Documentation\n\n';

srcFolders.forEach(folder => {
    const files = walk(path.join(__dirname, folder));
    if (files.length === 0) return;
    
    indexMd += ## \n\n;
    
    files.forEach(file => {
        const relativePath = path.relative(__dirname, file).replace(/\\/g, '/');
        const parsed = parseFile(file);
        
        const docFileName = relativePath.replace(/\//g, '_') + '.md';
        const docFilePath = path.join(outputDir, docFileName);
        
        let md = # File: \n\n;
        md += ## Overview\n\n\n;
        
        if (parsed.functions.length > 0) {
            md += ## Functions\n\n;
            parsed.functions.forEach(f => {
                md += ### \${f.name}\\n\n\n\n;
            });
        }
        
        fs.writeFileSync(docFilePath, md);
        indexMd += - [](./)\n;
    });
});

fs.writeFileSync(path.join(outputDir, 'README.md'), indexMd);
console.log('Documentation generated in docs/api');
