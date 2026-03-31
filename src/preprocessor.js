

function removeComments(source) {
  let result = '';
  let i = 0;
  const len = source.length;
  let inString = false;
  let stringChar = '';
  let inVerbatim = false;

  while (i < len) {

    if (!inString) {

      if (source[i] === '@' && i + 1 < len && source[i + 1] === '"') {
        inString = true;
        inVerbatim = true;
        stringChar = '"';
        result += source[i] + source[i + 1];
        i += 2;
        continue;
      }

      if (source[i] === '"' || source[i] === '\'') {
        inString = true;
        inVerbatim = false;
        stringChar = source[i];
        result += source[i];
        i++;
        continue;
      }

      if (source[i] === '/' && i + 1 < len && source[i + 1] === '/') {

        while (i < len && source[i] !== '\n') {
          i++;
        }
        continue;
      }

      if (source[i] === '/' && i + 1 < len && source[i + 1] === '*') {
        i += 2;
        while (i < len) {
          if (source[i] === '*' && i + 1 < len && source[i + 1] === '/') {
            i += 2;
            break;
          }

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

      if (inVerbatim) {

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
