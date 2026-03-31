// src/rules/CQE006.js — Private fields must use _camelCase

module.exports = {
  id: 'CQE006',
  name: 'Private fields must be _camelCase',
  check(nodes) {
    const errors = [];

    for (const node of nodes) {
      if (node.kind !== 'field') continue;
      // Only check private fields (explicit or implicit — if no access modifier, C# defaults to private)
      const isPrivate = !node.modifiers || node.modifiers.length === 0 ||
                        node.modifiers.includes('private');
      // Skip const and static fields
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
  // Must start with _
  if (name[0] !== '_') return false;
  // Second char must be lowercase
  if (name[1] < 'a' || name[1] > 'z') return false;
  // No additional underscores
  if (name.indexOf('_', 1) !== -1) return false;
  return true;
}

function toUnderscoreCamelCase(name) {
  const cleaned = name.replace(/^_+/, '');
  if (!cleaned) return '_' + name;
  return '_' + cleaned[0].toLowerCase() + cleaned.slice(1);
}
