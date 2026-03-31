// src/preprocessor.js
// Strips single-line (//) and multi-line (/* */) comments from C# source,
// preserving line numbers by keeping newlines intact.

function removeComments(source) {
  let result = '';
  let i = 0;
  const len = source.length;
  let inString = false;
  let stringChar = '';
  let inVerbatim = false;

  while (i < len) {
    // Handle string literals so we don't strip "comments" inside strings
    if (!inString) {
      // Verbatim string @"..."
      if (source[i] === '@' && i + 1 < len && source[i + 1] === '"') {
        inString = true;
        inVerbatim = true;
        stringChar = '"';
        result += source[i] + source[i + 1];
        i += 2;
        continue;
      }
      // Regular string or char literal
      if (source[i] === '"' || source[i] === '\'') {
        inString = true;
        inVerbatim = false;
        stringChar = source[i];
        result += source[i];
        i++;
        continue;
      }

      // Single-line comment
      if (source[i] === '/' && i + 1 < len && source[i + 1] === '/') {
        // Skip until end of line, but keep the newline
        while (i < len && source[i] !== '\n') {
          i++;
        }
        continue;
      }

      // Multi-line comment
      if (source[i] === '/' && i + 1 < len && source[i + 1] === '*') {
        i += 2;
        while (i < len) {
          if (source[i] === '*' && i + 1 < len && source[i + 1] === '/') {
            i += 2;
            break;
          }
          // Preserve newlines for accurate line counting
          if (source[i] === '\n') {
            result += '\n';
          }
          i++;
        }
        continue;
      }

      result += source[i];
      i++;
    } else {
      // Inside a string literal
      if (inVerbatim) {
        // Verbatim strings end at " not preceded by another "
        if (source[i] === '"') {
          if (i + 1 < len && source[i + 1] === '"') {
            result += '""';
            i += 2;
          } else {
            result += '"';
            i++;
            inString = false;
            inVerbatim = false;
          }
        } else {
          result += source[i];
          i++;
        }
      } else {
        // Escape sequences
        if (source[i] === '\\' && i + 1 < len) {
          result += source[i] + source[i + 1];
          i += 2;
          continue;
        }
        if (source[i] === stringChar) {
          result += source[i];
          i++;
          inString = false;
        } else {
          result += source[i];
          i++;
        }
      }
    }
  }

  return result;
}

module.exports = { removeComments };
