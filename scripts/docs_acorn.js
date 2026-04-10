const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const srcFolders = ['src', 'public/js', 'config'];
const outputDir = path.join(process.cwd(), 'docs', 'detailed_api');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

function extractFunctions(code) {
    let ast;
    try {
        ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
    } catch (e) {
        return [];
    }

    const functions = [];
    
    function walk(node) {
        if (!node || typeof node !== 'object') return;
        
        if (node.type === 'FunctionDeclaration') {
            const name = node.id ? node.id.name : 'anonymous';
            const params = node.params.map(p => p.name || 'param').join(', ');
            functions.push({ name, params, type: 'Function' });
        } else if (node.type === 'VariableDeclarator' && node.init && (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')) {
            const name = node.id && node.id.name ? node.id.name : 'anonymous';
            const params = node.init.params.map(p => p.name || 'param').join(', ');
            functions.push({ name, params, type: 'Arrow/Var Function' });
        } else if (node.type === 'MethodDefinition') {
            const name = node.key && node.key.name ? node.key.name : 'anonymous';
            const params = node.value.params.map(p => p.name || 'param').join(', ');
            functions.push({ name, params, type: 'Method' });
        }

        for (const key in node) {
            if (node.hasOwnProperty(key)) {
                if (Array.isArray(node[key])) {
                    node[key].forEach(walk);
                } else {
                    walk(node[key]);
                }
            }
        }
    }
    
    walk(ast);
    return functions;
}

function processDirectory(dir, basePath) {
    const files = fs.readdirSync(dir);
    let indexMap = '';
    
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');
        
        if (fs.statSync(fullPath).isDirectory()) {
            indexMap += processDirectory(fullPath, basePath);
        } else if (file.endsWith('.js')) {
            const code = fs.readFileSync(fullPath, 'utf8');
            
            // extract top level comments
            const summaryMatch = code.match(/^\s*\/\*\*?([\s\S]*?)\*\//);
            let summary = summaryMatch ? summaryMatch[1].replace(/^\s*\* ?/gm, '').trim() : 'No top-level documentation summary available.';
            
            const functions = extractFunctions(code);
            
            const docName = relativePath.replace(/\//g, '_') + '.md';
            const docPath = path.join(outputDir, docName);
            
            let md = `# File: ${relativePath}\n\n`;
            md += `## Overview\n\n${summary}\n\n`;
            
            if (functions.length > 0) {
                md += `## Functions & Methods\n\n`;
                functions.forEach(f => {
                    const safeName = f.name.replace('_', '\\_');
                    md += `### \`${safeName}(${f.params})\`\n\n`;
                    md += `- **Type:** ${f.type}\n`;
                    md += `- **Description:** Implements ${f.name} logic.\n\n`;
                });
            } else {
                md += `*No functions or methods detected by static analysis.*\n`;
            }
            
            fs.writeFileSync(docPath, md);
            indexMap += `- [${relativePath}](./${docName})\n`;
        }
    });
    
    return indexMap;
}

let mainIndex = '# Detailed Project Documentation\n\n';

srcFolders.forEach(folder => {
    const fullSourcePath = path.join(process.cwd(), folder);
    if (fs.existsSync(fullSourcePath)) {
        mainIndex += `## /${folder}\n\n`;
        mainIndex += processDirectory(fullSourcePath, process.cwd());
        mainIndex += '\n';
    }
});

fs.writeFileSync(path.join(outputDir, 'README.md'), mainIndex);
console.log('Advanced parsed documentation written to docs/detailed_api/README.md');
