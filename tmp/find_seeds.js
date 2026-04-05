const fs = require('fs');
const path = require('path');

function findFiles(dir, filter, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        findFiles(filePath, filter, fileList);
      }
    } else if (file.toLowerCase().includes(filter.toLowerCase())) {
        fileList.push(filePath);
    }
  });
  return fileList;
}

const seeds = findFiles('c:/Users/Neko-san/Documents/projects/CitizenLink', 'seedMockComplaintsBatch');
console.log('Seed files found:', JSON.stringify(seeds, null, 2));
