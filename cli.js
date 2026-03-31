#!/usr/bin/env node
// cli.js — Code Quality Engine CLI
// Usage: node cli.js <path> [--verbose]
// Scans .cs files in the given path and reports violations.
// Exits with code 1 if any errors are found.

const path = require('path');
const { collectCsFiles } = require('./src/reader');
const { analyzeFile, formatError } = require('./src/engine');

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const targets = args.filter(a => !a.startsWith('--'));

if (targets.length === 0) {
  console.log('Code Quality Engine (CQE) — C# Linter');
  console.log('');
  console.log('Usage: node cli.js <path> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --verbose    Show per-file scan info');
  console.log('');
  console.log('Rules:');
  console.log('  CQE001  No public fields');
  console.log('  CQE002  Access modifiers required');
  console.log('  CQE003  Class names PascalCase');
  console.log('  CQE004  Method names PascalCase');
  console.log('  CQE005  Variable names camelCase');
  console.log('  CQE006  Private fields _camelCase');
  console.log('  CQE008  No magic numbers (except 0, 1, -1)');
  process.exit(0);
}

let totalErrors = 0;
let totalFiles = 0;

for (const target of targets) {
  const resolved = path.resolve(target);
  let files;
  try {
    files = collectCsFiles(resolved);
  } catch (err) {
    console.error(`[FATAL] Cannot read '${resolved}': ${err.message}`);
    process.exit(2);
  }

  for (const file of files) {
    totalFiles++;
    const relPath = path.relative(process.cwd(), file);

    if (verbose) {
      console.log(`Scanning: ${relPath}`);
    }

    try {
      const errors = analyzeFile(file);
      for (const err of errors) {
        err.file = relPath;
        console.log(formatError(err));
      }
      totalErrors += errors.length;
    } catch (err) {
      console.error(`[FATAL] Error analyzing '${relPath}': ${err.message}`);
    }
  }
}

console.log('');
console.log(`Scanned ${totalFiles} file(s), found ${totalErrors} error(s).`);

if (totalErrors > 0) {
  process.exit(1);
}
