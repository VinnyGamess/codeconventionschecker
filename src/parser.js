

const { TOKEN_TYPES, ACCESS_MODIFIERS, MODIFIERS } = require('./tokenizer');

const BUILTIN_TYPES = new Set([
  'void', 'int', 'uint', 'long', 'ulong', 'short', 'ushort',
  'byte', 'sbyte', 'float', 'double', 'decimal', 'bool',
  'char', 'string', 'object', 'var', 'dynamic',
]);

function parse(tokens) {
  const nodes = [];
  const filtered = tokens.filter(t => t.type !== TOKEN_TYPES.NEWLINE);
  let i = 0;

  function peek(offset = 0) {
    return filtered[i + offset];
  }

  function current() {
    return filtered[i];
  }

  function advance() {
    return filtered[i++];
  }

  function isModifier(token) {
    return token && token.type === TOKEN_TYPES.KEYWORD && MODIFIERS.has(token.value);
  }

  function isType(token) {
    if (!token) return false;
    if (token.type === TOKEN_TYPES.KEYWORD && BUILTIN_TYPES.has(token.value)) return true;
    if (token.type === TOKEN_TYPES.IDENTIFIER) return true;
    return false;
  }

  function hasAccessModifier(mods) {
    return mods.some(m => ACCESS_MODIFIERS.has(m));
  }

  function collectAttributes() {
    const attrs = [];
    while (i < filtered.length && current() && current().value === '[') {
      advance();

      while (i < filtered.length && current() && current().value !== ']') {
        const t = current();

        if (t.type === TOKEN_TYPES.IDENTIFIER || t.type === TOKEN_TYPES.KEYWORD) {
          let name = t.value;
          advance();

          while (i < filtered.length && current() && current().value === '.') {
            advance();
            if (i < filtered.length && current()) {
              name = current().value;
              advance();
            }
          }
          attrs.push(name);

          if (i < filtered.length && current() && current().value === '(') {
            let parenDepth = 0;
            while (i < filtered.length) {
              if (current().value === '(') parenDepth++;
              else if (current().value === ')') {
                parenDepth--;
                if (parenDepth === 0) { advance(); break; }
              }
              advance();
            }
          }

          if (i < filtered.length && current() && current().value === ',') {
            advance();
          }
        } else {
          advance();
        }
      }
      if (i < filtered.length && current() && current().value === ']') {
        advance();
      }
    }
    return attrs;
  }

  function skipBlock() {

    if (!current() || current().value !== '{') return;
    let depth = 0;
    while (i < filtered.length) {
      if (current().value === '{') depth++;
      else if (current().value === '}') {
        depth--;
        if (depth === 0) { advance(); return; }
      }
      advance();
    }
  }

  function parseBody() {

    if (!current() || current().value !== '{') return;
    advance();
    let depth = 1;

    while (i < filtered.length && depth > 0) {
      if (current().value === '{') {
        depth++;
        advance();
        continue;
      }
      if (current().value === '}') {
        depth--;
        advance();
        continue;
      }

      const t = current();
      if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'if') {
        nodes.push({
          kind: 'if-statement',
          line: t.line,
          col: t.col,
        });
        advance();
        continue;
      }

      if (isType(t) && !isControlKeyword(t.value)) {
        const next = peek(1);
        const afterNext = peek(2);

        if (next && next.type === TOKEN_TYPES.IDENTIFIER &&
            afterNext && (afterNext.value === '=' || afterNext.value === ';' || afterNext.value === ',')) {

          nodes.push({
            kind: 'variable',
            name: next.value,
            typeName: t.value,
            line: next.line,
            col: next.col,
          });
          advance();
          advance();
          continue;
        }

        if (next && next.value === '<') {
          let j = i + 2;
          let angleDepth = 1;
          while (j < filtered.length && angleDepth > 0) {
            if (filtered[j].value === '<') angleDepth++;
            else if (filtered[j].value === '>') angleDepth--;
            j++;
          }
          if (j < filtered.length && filtered[j].type === TOKEN_TYPES.IDENTIFIER) {
            const afterGenericName = filtered[j + 1];
            if (afterGenericName && (afterGenericName.value === '=' || afterGenericName.value === ';' || afterGenericName.value === ',')) {
              nodes.push({
                kind: 'variable',
                name: filtered[j].value,
                typeName: t.value,
                line: filtered[j].line,
                col: filtered[j].col,
              });
              i = j + 1;
              continue;
            }
          }
        }

        if (next && next.value === '[' && peek(2) && peek(2).value === ']') {
          const arrName = peek(3);
          if (arrName && arrName.type === TOKEN_TYPES.IDENTIFIER) {
            const afterArr = peek(4);
            if (afterArr && (afterArr.value === '=' || afterArr.value === ';' || afterArr.value === ',')) {
              nodes.push({
                kind: 'variable',
                name: arrName.value,
                typeName: t.value + '[]',
                line: arrName.line,
                col: arrName.col,
              });
              i += 4;
              continue;
            }
          }
        }
      }

      advance();
    }
  }

  function isControlKeyword(value) {
    return ['if', 'else', 'for', 'foreach', 'while', 'do', 'switch',
            'case', 'return', 'break', 'continue', 'throw', 'try',
            'catch', 'finally', 'using', 'lock', 'yield', 'await',
            'new', 'null', 'true', 'false', 'this', 'base',
            'typeof', 'sizeof', 'default', 'checked', 'unchecked',
            'namespace', 'class', 'struct', 'interface', 'enum',
            'delegate', 'event'].includes(value);
  }

  while (i < filtered.length) {
    const t = current();

    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'using') {
      while (i < filtered.length && current().value !== ';') advance();
      if (i < filtered.length) advance();
      continue;
    }

    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'namespace') {
      advance();
      while (i < filtered.length && current().value !== '{') advance();
      if (i < filtered.length) advance();
      continue;
    }

    const topAttrs = collectAttributes();

    const modifiers = [];
    const modStart = current();
    while (i < filtered.length && isModifier(current())) {
      modifiers.push(advance().value);
    }

    if (i >= filtered.length) break;

    const curr = current();

    if (curr.type === TOKEN_TYPES.KEYWORD &&
        (curr.value === 'class' || curr.value === 'struct' || curr.value === 'interface' ||
         curr.value === 'enum' || curr.value === 'record')) {
      const declType = curr.value;
      advance();
      const nameToken = current();
      if (nameToken && (nameToken.type === TOKEN_TYPES.IDENTIFIER || nameToken.type === TOKEN_TYPES.KEYWORD)) {
        nodes.push({
          kind: declType,
          name: nameToken.value,
          modifiers,
          attributes: topAttrs,
          hasAccessModifier: hasAccessModifier(modifiers),
          line: nameToken.line,
          col: nameToken.col,
        });
        advance();

        while (i < filtered.length && current().value !== '{') advance();

        if (i < filtered.length && current().value === '{') {
          advance();
          let depth = 1;
          while (i < filtered.length && depth > 0) {
            if (current().value === '}') {
              depth--;
              if (depth === 0) { advance(); break; }
              advance();
              continue;
            }
            if (current().value === '{') {
              depth++;
              advance();
              continue;
            }

            const memberAttrs = collectAttributes();
            const memberMods = [];
            while (i < filtered.length && isModifier(current())) {
              memberMods.push(advance().value);
            }

            if (i >= filtered.length || depth <= 0) break;

            const mc = current();

            if (mc.type === TOKEN_TYPES.KEYWORD &&
                (mc.value === 'class' || mc.value === 'struct' || mc.value === 'interface' ||
                 mc.value === 'enum' || mc.value === 'record')) {
              const nestedType = mc.value;
              advance();
              const nName = current();
              if (nName && (nName.type === TOKEN_TYPES.IDENTIFIER || nName.type === TOKEN_TYPES.KEYWORD)) {
                nodes.push({
                  kind: nestedType,
                  name: nName.value,
                  modifiers: memberMods,
                  attributes: memberAttrs,
                  hasAccessModifier: hasAccessModifier(memberMods),
                  line: nName.line,
                  col: nName.col,
                });
                advance();
                while (i < filtered.length && current().value !== '{') advance();
                skipBlock();
              }
              continue;
            }

            if (mc.type === TOKEN_TYPES.KEYWORD && mc.value === 'if') {
              nodes.push({ kind: 'if-statement', line: mc.line, col: mc.col });
              advance();
              continue;
            }

            if (isType(mc)) {
              let returnType = mc.value;
              let typeEndIdx = i + 1;

              if (peek(1) && peek(1).value === '<') {
                let j = i + 2;
                let ad = 1;
                while (j < filtered.length && ad > 0) {
                  if (filtered[j].value === '<') ad++;
                  else if (filtered[j].value === '>') ad--;
                  j++;
                }
                typeEndIdx = j;
              }

              if (typeEndIdx < filtered.length && filtered[typeEndIdx].value === '[' &&
                  typeEndIdx + 1 < filtered.length && filtered[typeEndIdx + 1].value === ']') {
                typeEndIdx += 2;
              }

              const memberName = filtered[typeEndIdx];
              const afterName = filtered[typeEndIdx + 1];

              if (memberName && memberName.type === TOKEN_TYPES.IDENTIFIER && afterName) {
                if (afterName.value === '(') {

                  nodes.push({
                    kind: 'method',
                    name: memberName.value,
                    modifiers: memberMods,
                    attributes: memberAttrs,
                    hasAccessModifier: hasAccessModifier(memberMods),
                    line: memberName.line,
                    col: memberName.col,
                  });
                  i = typeEndIdx + 1;

                  let parenDepth = 0;
                  while (i < filtered.length) {
                    if (current().value === '(') parenDepth++;
                    else if (current().value === ')') {
                      parenDepth--;
                      if (parenDepth === 0) { advance(); break; }
                    }
                    advance();
                  }

                  if (i < filtered.length && current().value === '{') {

                    parseBody();
                  } else if (i < filtered.length && current().value === '=>') {

                    advance();
                    while (i < filtered.length && current().value !== ';') advance();
                    if (i < filtered.length) advance();
                  } else if (i < filtered.length && current().value === ';') {
                    advance();
                  }
                  continue;
                } else if (afterName.value === ';' || afterName.value === '=' || afterName.value === ',') {

                  nodes.push({
                    kind: 'field',
                    name: memberName.value,
                    typeName: returnType,
                    modifiers: memberMods,
                    attributes: memberAttrs,
                    hasAccessModifier: hasAccessModifier(memberMods),
                    line: memberName.line,
                    col: memberName.col,
                  });
                  if (afterName.value === ';') {
                    i = typeEndIdx + 2;
                  } else {
                    i = typeEndIdx + 2;

                    while (i < filtered.length && current().value !== ';') advance();
                    if (i < filtered.length) advance();
                  }
                  continue;
                }
              }
            }

            if (mc.type === TOKEN_TYPES.IDENTIFIER && peek(1) && peek(1).value === '(') {
              nodes.push({
                kind: 'method',
                name: mc.value,
                modifiers: memberMods,
                attributes: memberAttrs,
                hasAccessModifier: hasAccessModifier(memberMods),
                isConstructor: true,
                line: mc.line,
                col: mc.col,
              });
              advance();

              let parenDepth = 0;
              while (i < filtered.length) {
                if (current().value === '(') parenDepth++;
                else if (current().value === ')') {
                  parenDepth--;
                  if (parenDepth === 0) { advance(); break; }
                }
                advance();
              }
              if (i < filtered.length && current().value === '{') {
                parseBody();
              } else if (i < filtered.length && current().value === ':') {

                while (i < filtered.length && current().value !== '{') advance();
                if (i < filtered.length) parseBody();
              }
              continue;
            }

            advance();
          }
        }
        continue;
      }
    }

    if (curr.value === '}') {
      advance();
      continue;
    }

    advance();
  }

  return nodes;
}

module.exports = { parse };
