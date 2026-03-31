

const TOKEN_TYPES = {
  KEYWORD: 'KEYWORD',
  IDENTIFIER: 'IDENTIFIER',
  NUMBER: 'NUMBER',
  STRING: 'STRING',
  OPERATOR: 'OPERATOR',
  PUNCTUATION: 'PUNCTUATION',
  NEWLINE: 'NEWLINE',
};

const KEYWORDS = new Set([
  'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch',
  'char', 'checked', 'class', 'const', 'continue', 'decimal', 'default',
  'delegate', 'do', 'double', 'else', 'enum', 'event', 'explicit',
  'extern', 'false', 'finally', 'fixed', 'float', 'for', 'foreach',
  'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal',
  'is', 'lock', 'long', 'namespace', 'new', 'null', 'object', 'operator',
  'out', 'override', 'params', 'private', 'protected', 'public',
  'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short', 'sizeof',
  'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw',
  'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe',
  'ushort', 'using', 'var', 'virtual', 'void', 'volatile', 'while',
  'async', 'await', 'partial', 'yield', 'record',
]);

const ACCESS_MODIFIERS = new Set([
  'public', 'private', 'protected', 'internal',
]);

const MODIFIERS = new Set([
  'public', 'private', 'protected', 'internal',
  'static', 'readonly', 'const', 'abstract', 'virtual', 'override',
  'sealed', 'extern', 'async', 'partial', 'volatile', 'new',
]);

function tokenize(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const len = source.length;

  while (i < len) {
    const ch = source[i];

    if (ch === '\n') {
      tokens.push({ type: TOKEN_TYPES.NEWLINE, value: '\n', line, col });
      line++;
      col = 1;
      i++;
      continue;
    }

    if (ch === '\r') {
      i++;
      continue;
    }

    if (ch === ' ' || ch === '\t') {
      i++;
      col++;
      continue;
    }

    if (ch === '@' && i + 1 < len && source[i + 1] === '"') {
      let str = '@"';
      i += 2;
      col += 2;
      while (i < len) {
        if (source[i] === '"') {
          if (i + 1 < len && source[i + 1] === '"') {
            str += '""';
            i += 2;
            col += 2;
          } else {
            str += '"';
            i++;
            col++;
            break;
          }
        } else {
          if (source[i] === '\n') { line++; col = 0; }
          str += source[i];
          i++;
          col++;
        }
      }
      tokens.push({ type: TOKEN_TYPES.STRING, value: str, line, col });
      continue;
    }

    if (ch === '"') {
      const startLine = line;
      const startCol = col;
      let str = '"';
      i++;
      col++;
      while (i < len && source[i] !== '"') {
        if (source[i] === '\\' && i + 1 < len) {
          str += source[i] + source[i + 1];
          i += 2;
          col += 2;
        } else {
          str += source[i];
          i++;
          col++;
        }
      }
      if (i < len) { str += '"'; i++; col++; }
      tokens.push({ type: TOKEN_TYPES.STRING, value: str, line: startLine, col: startCol });
      continue;
    }

    if (ch === '\'') {
      const startLine = line;
      const startCol = col;
      let str = '\'';
      i++;
      col++;
      while (i < len && source[i] !== '\'') {
        if (source[i] === '\\' && i + 1 < len) {
          str += source[i] + source[i + 1];
          i += 2;
          col += 2;
        } else {
          str += source[i];
          i++;
          col++;
        }
      }
      if (i < len) { str += '\''; i++; col++; }
      tokens.push({ type: TOKEN_TYPES.STRING, value: str, line: startLine, col: startCol });
      continue;
    }

    if (isDigit(ch) || (ch === '.' && i + 1 < len && isDigit(source[i + 1]))) {
      const startCol = col;
      let num = '';

      if (ch === '0' && i + 1 < len && (source[i + 1] === 'x' || source[i + 1] === 'X')) {
        num += source[i] + source[i + 1];
        i += 2;
        col += 2;
        while (i < len && isHexDigit(source[i])) {
          num += source[i];
          i++;
          col++;
        }
      } else {
        while (i < len && isDigit(source[i])) {
          num += source[i];
          i++;
          col++;
        }
        if (i < len && source[i] === '.' && i + 1 < len && isDigit(source[i + 1])) {
          num += '.';
          i++;
          col++;
          while (i < len && isDigit(source[i])) {
            num += source[i];
            i++;
            col++;
          }
        }
      }

      if (i < len && /[fFdDmMlLuU]/.test(source[i])) {
        num += source[i];
        i++;
        col++;
      }
      tokens.push({ type: TOKEN_TYPES.NUMBER, value: num, line, col: startCol });
      continue;
    }

    if (isIdentStart(ch)) {
      const startCol = col;
      let word = '';
      while (i < len && isIdentPart(source[i])) {
        word += source[i];
        i++;
        col++;
      }
      const type = KEYWORDS.has(word) ? TOKEN_TYPES.KEYWORD : TOKEN_TYPES.IDENTIFIER;
      tokens.push({ type, value: word, line, col: startCol });
      continue;
    }

    if (i + 1 < len) {
      const two = ch + source[i + 1];
      if (['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '=>', '??'].includes(two)) {
        tokens.push({ type: TOKEN_TYPES.OPERATOR, value: two, line, col });
        i += 2;
        col += 2;
        continue;
      }
    }

    if ('+-*/%=<>!&|^~?'.includes(ch)) {
      tokens.push({ type: TOKEN_TYPES.OPERATOR, value: ch, line, col });
      i++;
      col++;
      continue;
    }

    if ('(){}[];:,.'.includes(ch)) {
      tokens.push({ type: TOKEN_TYPES.PUNCTUATION, value: ch, line, col });
      i++;
      col++;
      continue;
    }

    i++;
    col++;
  }

  return tokens;
}

function isDigit(c) { return c >= '0' && c <= '9'; }
function isHexDigit(c) { return isDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'); }
function isIdentStart(c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_'; }
function isIdentPart(c) { return isIdentStart(c) || isDigit(c); }

module.exports = { tokenize, TOKEN_TYPES, KEYWORDS, ACCESS_MODIFIERS, MODIFIERS };
