

const { readFile } = require('./reader');
const { removeComments } = require('./preprocessor');
const { tokenize } = require('./tokenizer');
const { parse } = require('./parser');
const { runRules } = require('./rules');
const { reportError } = require('./reporter');

function analyzeFile(filePath, config) {
  const source = readFile(filePath);
  const cleaned = removeComments(source);
  const tokens = tokenize(cleaned);
  const nodes = parse(tokens);
  const errors = runRules(nodes, tokens, config);

  return errors.map(err => ({
    ...err,
    file: filePath,
  }));
}

function formatError(err) {
  return reportError(err);
}

module.exports = { analyzeFile, formatError };
