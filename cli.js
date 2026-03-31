#!/usr/bin/env node

const path = require('path');
const { collectCsFiles } = require('./src/reader');
const { analyzeFile, formatError } = require('./src/engine');
const { loadConfig } = require('./src/config');
const { reportSummary, clearCache, ANSI } = require('./src/reporter');

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const targets = args.filter(a => !a.startsWith('--'));

if (targets.length === 0) {
  console.log(`${ANSI.bold}Code Quality Engine (CQE) — C# Linter${ANSI.reset}`);
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
  console.log('  CQE008  No magic numbers');
  console.log('  CQE009  Use [SerializeField] private');
  console.log('  CQE010  Awake vs Start check');
  console.log('  CQE011  Heuristic naming quality');
  console.log('');
  console.log('Config: place .cqerc.json in project root to toggle rules / set whitelist.');
  process.exit(0);
}

const config = loadConfig(process.cwd());
let totalErrors = 0;
let totalWarnings = 0;
let totalFiles = 0;

for (const target of targets) {
  const resolved = path.resolve(target);
  let files;
  try {
    files = collectCsFiles(resolved);
  } catch (err) {
    console.error(`${ANSI.red}[FATAL]${ANSI.reset} Cannot read '${resolved}': ${err.message}`);
    process.exit(2);
  }

  for (const file of files) {
    totalFiles++;
    const relPath = path.relative(process.cwd(), file);

    if (verbose) {
      console.log(`${ANSI.grey}Scanning: ${relPath}${ANSI.reset}`);
    }

    try {
      const errors = analyzeFile(file, config);
      for (const err of errors) {
        err.file = relPath;
        process.stdout.write(formatError(err));
        if (err.severity === 'warning') {
          totalWarnings++;
        } else {
          totalErrors++;
        }
      }
    } catch (err) {
      console.error(`${ANSI.red}[FATAL]${ANSI.reset} Error analyzing '${relPath}': ${err.message}`);
    }
  }
}

clearCache();
process.stdout.write(reportSummary(totalFiles, totalErrors, totalWarnings));

if (totalErrors > 0) {
  process.exit(1);
}
