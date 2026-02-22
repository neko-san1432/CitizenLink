const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'views', 'pages');

function processFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf-8');

    // Skip files that don't have the typical app + header structure
    if (!content.includes('class="header-container"') || !content.includes('id="app"')) {
        return false;
    }

    // Check if header is inside app already
    if (/<div[^>]*id="app"[^>]*>[\s\S]*?<div[^>]*class="header-container"/.test(content)) {
        return false;
    }

    // Find the header element
    const headerRegex = /(<div[^>]*class="header-container"[^>]*><\/div>)/;
    const headerMatch = content.match(headerRegex);
    if (!headerMatch) return false;

    const headerHtml = headerMatch[1];
    let newContent = content.replace(headerHtml, '');

    // Find #app opening tag 
    const appRegex = /(<div\s+id="app"\s+class="[^"]*?")([^>]*)(>)/i;
    const appMatch = newContent.match(appRegex);
    if (!appMatch) return false;

    let fullAppTag = appMatch[0];
    let appAttrPart = appMatch[1];
    let restOfOpeningTag = appMatch[2];

    let newAppTag = fullAppTag;

    // Check if app wrapper already has display:flex
    if (!restOfOpeningTag.includes('display:') || !restOfOpeningTag.includes('flex')) {
        if (fullAppTag.includes('style="')) {
            // Append flex attributes to existing style
            newAppTag = fullAppTag.replace(/style="([^"]*)"/, 'style="$1; display: flex; flex-direction: column;"');
        } else {
            // Add new style attribute
            newAppTag = `${appAttrPart}${restOfOpeningTag} style="display: flex; flex-direction: column;">`;
        }
        newContent = newContent.replace(fullAppTag, newAppTag);
    }

    // Insert header inside #app and open a flex wrapper for the rest of the content
    const injectionPointIdx = newContent.indexOf(newAppTag) + newAppTag.length;
    const wrapperHtml = `\n      ${headerHtml}\n      <div class="dashboard-main-wrapper" style="display: flex; flex-direction: column; flex: 1;">\n`;
    newContent = newContent.slice(0, injectionPointIdx) + wrapperHtml + newContent.slice(injectionPointIdx);

    // We now need to wrap the bottom.
    const endPattern = /(<\/div>\s*<div\s+id="toast-container")/i;
    const fallbackEndPattern = /(<script)/i;

    if (endPattern.test(newContent)) {
        newContent = newContent.replace(endPattern, '</div>\n      </div> <!-- End dashboard-main-wrapper -->\n    $1');
    } else if (fallbackEndPattern.test(newContent)) {
        newContent = newContent.replace(fallbackEndPattern, '</div>\n      </div> <!-- End dashboard-main-wrapper -->\n$1');
    } else {
        newContent = newContent.replace('</body>', '\n      </div> <!-- End dashboard-main-wrapper -->\n</body>');
    }

    fs.writeFileSync(filepath, newContent, 'utf-8');
    return true;
}

function walkSync(dir, filelist = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            filelist = walkSync(filepath, filelist);
        } else if (filepath.endsWith('.html')) {
            filelist.push(filepath);
        }
    }
    return filelist;
}

let patchCount = 0;
const htmlFiles = walkSync(targetDir);

htmlFiles.forEach(file => {
    if (processFile(file)) {
        patchCount++;
        console.log(`Patched Layout for: ${path.relative(__dirname, file)}`);
    }
});

console.log(`Successfully patched ${patchCount} files.`);
