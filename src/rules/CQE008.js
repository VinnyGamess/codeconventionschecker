

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

      if (isInVariableDeclaration(filtered, i)) continue;

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

const MEMBER_MODIFIERS = new Set([
  'public', 'private', 'protected', 'internal', 'static', 'readonly',
  'abstract', 'virtual', 'override', 'sealed', 'extern', 'volatile', 'new',
]);

function isInVariableDeclaration(tokens, idx) {
  // Only suppress magic number warnings for field/member declarations, not local variables.
  // A field declaration has at least one member modifier (private, public, readonly, etc.)
  // or an attribute ([SerializeField]) before the type.
  // Pattern: [modifiers/attributes] <type> <identifier> = <number>

  // The previous token must be '='
  const prev = tokens[idx - 1];
  if (!prev || prev.value !== '=') return false;

  // The token before '=' must be an identifier (the variable name)
  const varName = tokens[idx - 2];
  if (!varName || varName.type !== TOKEN_TYPES.IDENTIFIER) return false;

  // Ensure we are not inside parentheses (e.g. a function call argument)
  let parenDepth = 0;
  for (let j = idx - 1; j >= 0; j--) {
    if (tokens[j].value === ')') parenDepth++;
    if (tokens[j].value === '(') {
      if (parenDepth === 0) return false; // unmatched '(' means we're inside a call
      parenDepth--;
    }
    if (tokens[j].value === ';' || tokens[j].value === '{' || tokens[j].value === '}') break;
  }

  // Find the start of the current statement
  let stmtStart = 0;
  for (let j = idx - 3; j >= 0; j--) {
    const v = tokens[j].value;
    if (v === ';' || v === '{' || v === '}') { stmtStart = j + 1; break; }
  }

  // Collect the statement tokens before the identifier (i.e., the modifiers + type)
  const stmtTokens = tokens.slice(stmtStart, idx - 2); // exclude varName and '='

  // Must have at least one member modifier OR an attribute closing ']'
  const hasModifier = stmtTokens.some(t => MEMBER_MODIFIERS.has(t.value));
  const hasAttribute = stmtTokens.some(t => t.value === ']');
  return hasModifier || hasAttribute;
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
