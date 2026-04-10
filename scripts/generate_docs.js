const fs = require('fs');
const path = require('path');

const srcFolders = ['src', 'public/js', 'config'];
const outputDir = path.join(process.cwd(), 'docs', 'api');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

function parseFile(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    const docs = [];
    
    // High-level summary (find first block comment)
    const summaryMatch = code.match(/^\s*\/\*\*?([\s\S]*?)\*\//);
    let summary = summaryMatch ? summaryMatch[1].replace(/^\s*\* ?/gm, '').trim() : 'No summary provided.';
    if (!summary) summary = 'No summary provided.';
    
    // Functions and methods
    // Rough regex to find function/method signatures
    const lines = code.split('\n');
    let currentComment = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('//') || line.startsWith('/*')) {
             if (line.startsWith('//')) currentComment.push(line.substring(2).trim());
             if (line.startsWith('/*')) currentComment.push(line.replace(/[\/\*]/g, '').trim());
             continue; // ignore multi-line comment internals for simplicity in this rough parser
        }
        
        const fnMatch = line.match(/(?:export\s+|async\s+)*function\s+([a-zA-Z0-9_]+)\s*\(/) || 
                        line.match(/(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>/) ||
                        line.match(/^[a-zA-Z0-9_]+\s*\([^)]*\)\s*\{/);
                        
        if (fnMatch) {
            const name = fnMatch[1] || fnMatch[0].split('(')[0].trim();
            if (name && !['if', 'for', 'while', 'catch', 'switch'].includes(name)) {
                docs.push({ name, comment: currentComment.join(' ') || 'No documentation provided.' });
                currentComment = [];
            }
        } else if (line !== '' && !line.startsWith('*')) {
            currentComment = [];
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

let indexMd = '# DRIMS Codebase Documentation\n\n';

srcFolders.forEach(folder => {
    const fullPath = path.join(process.cwd(), folder);
    const files = walk(fullPath);
    if (files.length === 0) return;
    
    indexMd += `## ${folder}\n\n`;
    
    files.forEach(file => {
        const relativePath = path.relative(process.cwd(), file).replace(/\\/g, '/');
        const parsed = parseFile(file);
        
        const docFileName = relativePath.replace(/\//g, '_') + '.md';
        const docFilePath = path.join(outputDir, docFileName);
        
        let md = `# File: ${relativePath}\n\n`;
        md += `## Overview\n\n${parsed.summary}\n\n`;
        
        if (parsed.functions.length > 0) {
            md += `## Functions\n\n`;
            parsed.functions.forEach(f => {
                const safeName = f.name.replace('_', '\\_');
                md += `### \`${safeName}\`\n\n${f.comment}\n\n`;
            });
        }
        
        fs.writeFileSync(docFilePath, md);
        indexMd += `- [${relativePath}](./${docFileName})\n`;
    });
});

fs.writeFileSync(path.join(process.cwd(), 'docs', 'api_documentation.md'), indexMd);
console.log('Documentation generated in docs/api and docs/api_documentation.md');
