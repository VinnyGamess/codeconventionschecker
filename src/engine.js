// src/engine.js — Main orchestrator: reads, preprocesses, tokenizes, parses, checks rules.

const { readFile } = require('./reader');
const { removeComments } = require('./preprocessor');
const { tokenize } = require('./tokenizer');
const { parse } = require('./parser');
const { runRules } = require('./rules');

function analyzeFile(filePath) {
  const source = readFile(filePath);
  const cleaned = removeComments(source);
  const tokens = tokenize(cleaned);
  const nodes = parse(tokens);
  const errors = runRules(nodes, tokens);

  return errors.map(err => ({
    ...err,
    file: filePath,
  }));
}

function formatError(err) {
  return `[ERROR] ${err.file}:${err.line} \u2192 ${err.rule}: ${err.message} | Suggestion: ${err.suggestion}`;
}

module.exports = { analyzeFile, formatError };
