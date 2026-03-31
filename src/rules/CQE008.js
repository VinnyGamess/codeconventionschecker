// src/rules/CQE008.js — No magic numbers (except 0, 1, -1)

const { TOKEN_TYPES } = require('../tokenizer');

const ALLOWED = new Set(['0', '1']);

module.exports = {
  id: 'CQE008',
  name: 'No magic numbers',
  checkTokens(tokens) {
    const errors = [];
    const filtered = tokens.filter(t => t.type !== TOKEN_TYPES.NEWLINE);

    for (let i = 0; i < filtered.length; i++) {
      const t = filtered[i];
      if (t.type !== TOKEN_TYPES.NUMBER) continue;

      // Strip suffixes for comparison
      const raw = t.value.replace(/[fFdDmMlLuU]$/g, '');

      // Allow 0 and 1
      if (ALLOWED.has(raw)) continue;

      // Allow -1: check if preceded by unary minus
      if (raw === '1' || raw === '1.0') continue; // already allowed above
      const prev = filtered[i - 1];
      if (prev && prev.value === '-' && raw === '1') continue;

      // Check for -1 as a negative literal
      if (prev && prev.value === '-') {
        const rawWithMinus = '-' + raw;
        if (rawWithMinus === '-1') continue;
      }

      // Skip numbers in const declarations (they're named constants)
      if (isInConstDeclaration(filtered, i)) continue;

      // Skip enum values
      if (isInEnum(filtered, i)) continue;

      errors.push({
        rule: this.id,
        line: t.line,
        message: `Magic number '${t.value}' detected.`,
        suggestion: `Extract to a named constant.`,
      });
    }
    return errors;
  },
};

function isInConstDeclaration(tokens, idx) {
  // Look backwards for 'const' keyword before hitting a semicolon or opening brace
  for (let j = idx - 1; j >= 0 && j >= idx - 10; j--) {
    if (tokens[j].value === ';' || tokens[j].value === '{' || tokens[j].value === '}') break;
    if (tokens[j].value === 'const') return true;
  }
  return false;
}

function isInEnum(tokens, idx) {
  // Look backwards for 'enum' keyword or pattern
  let braceDepth = 0;
  for (let j = idx - 1; j >= 0; j--) {
    if (tokens[j].value === '{') {
      braceDepth++;
      if (braceDepth > 0) {
        // Check if just before this brace there's an enum keyword
        for (let k = j - 1; k >= 0 && k >= j - 5; k--) {
          if (tokens[k].value === 'enum') return true;
          if (tokens[k].value === 'class' || tokens[k].value === 'struct') return false;
        }
        return false;
      }
    }
    if (tokens[j].value === '}') braceDepth--;
  }
  return false;
}
