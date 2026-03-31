// src/reader.js
// Recursively finds and reads .cs files from a directory or single file path.

const fs = require('fs');
const path = require('path');

function collectCsFiles(target) {
  const results = [];
  const stat = fs.statSync(target);

  if (stat.isFile() && target.endsWith('.cs')) {
    results.push(path.resolve(target));
  } else if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) {
      const full = path.join(target, entry);
      const entryStat = fs.statSync(full);
      if (entryStat.isDirectory()) {
        results.push(...collectCsFiles(full));
      } else if (entry.endsWith('.cs')) {
        results.push(path.resolve(full));
      }
    }
  }

  return results;
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

module.exports = { collectCsFiles, readFile };
