

module.exports = {
  id: 'CQE006',
  name: 'Private fields must be _camelCase',
  check(nodes) {
    const errors = [];

    for (const node of nodes) {
      if (node.kind !== 'field') continue;

      const isPrivate = !node.modifiers || node.modifiers.length === 0 ||
                        node.modifiers.includes('private');

      if (node.modifiers && (node.modifiers.includes('const') || node.modifiers.includes('static'))) continue;

      if (isPrivate && !isUnderscoreCamelCase(node.name)) {
        errors.push({
          rule: this.id,
          line: node.line,
          message: `Private field '${node.name}' should use _camelCase naming.`,
          suggestion: `Rename to '${toUnderscoreCamelCase(node.name)}'.`,
        });
      }
    }
    return errors;
  },
};

function isUnderscoreCamelCase(name) {
  if (!name || name.length < 2) return false;

  if (name[0] !== '_') return false;

  if (name[1] < 'a' || name[1] > 'z') return false;

  if (name.indexOf('_', 1) !== -1) return false;
  return true;
}

function toUnderscoreCamelCase(name) {
  const cleaned = name.replace(/^_+/, '');
  if (!cleaned) return '_' + name;
  return '_' + cleaned[0].toLowerCase() + cleaned.slice(1);
}
