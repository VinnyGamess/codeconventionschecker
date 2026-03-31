

module.exports = {
  id: 'CQE005',
  name: 'Variables must be camelCase',
  check(nodes) {
    const errors = [];

    for (const node of nodes) {
      if (node.kind !== 'variable') continue;

      if (!isCamelCase(node.name)) {
        errors.push({
          rule: this.id,
          line: node.line,
          message: `Variable '${node.name}' is not camelCase.`,
          suggestion: `Rename to '${toCamelCase(node.name)}'.`,
        });
      }
    }
    return errors;
  },
};

function isCamelCase(name) {
  if (!name || name.length === 0) return false;

  if (name[0] < 'a' || name[0] > 'z') return false;

  if (name.includes('_')) return false;
  return true;
}

function toCamelCase(name) {
  const cleaned = name.replace(/^_+/, '');
  if (!cleaned) return name;
  return cleaned[0].toLowerCase() + cleaned.slice(1).replace(/_(\w)/g, (_, c) => c.toUpperCase());
}
