

const { TOKEN_TYPES } = require('../tokenizer');

const DEFAULT_ALLOWED = new Set(['0', '1']);

module.exports = {
  id: 'CQE008',
  name: 'No magic numbers',
  checkTokens(tokens, config) {

    const whitelist = config && Array.isArray(config.magicNumberWhitelist)
      ? new Set(config.magicNumberWhitelist.map(n => String(n)))
      : DEFAULT_ALLOWED;

    const errors = [];
    const filtered = tokens.filter(t => t.type !== TOKEN_TYPES.NEWLINE);

    for (let i = 0; i < filtered.length; i++) {
      const t = filtered[i];
      if (t.type !== TOKEN_TYPES.NUMBER) continue;

      const raw = t.value.replace(/[fFdDmMlLuU]$/g, '');

      if (whitelist.has(raw)) continue;

      if (raw === '1' || raw === '1.0') continue;
      const prev = filtered[i - 1];
      if (prev && prev.value === '-' && raw === '1') continue;

      if (prev && prev.value === '-') {
        const rawWithMinus = '-' + raw;
        if (whitelist.has(rawWithMinus)) continue;
      }

      if (isInConstDeclaration(filtered, i)) continue;

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

  for (let j = idx - 1; j >= 0 && j >= idx - 10; j--) {
    if (tokens[j].value === ';' || tokens[j].value === '{' || tokens[j].value === '}') break;
    if (tokens[j].value === 'const') return true;
  }
  return false;
}

function isInEnum(tokens, idx) {

  let braceDepth = 0;
  for (let j = idx - 1; j >= 0; j--) {
    if (tokens[j].value === '{') {
      braceDepth++;
      if (braceDepth > 0) {

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
