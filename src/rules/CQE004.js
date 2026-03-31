

module.exports = {
  id: 'CQE004',
  name: 'Method names must be PascalCase',
  check(nodes) {
    const errors = [];

    for (const node of nodes) {
      if (node.kind !== 'method') continue;

      if (node.isConstructor) continue;

      if (!isPascalCase(node.name)) {
        errors.push({
          rule: this.id,
          line: node.line,
          message: `Method '${node.name}' is not PascalCase.`,
          suggestion: `Rename to '${toPascalCase(node.name)}'.`,
        });
      }
    }
    return errors;
  },
};

function isPascalCase(name) {
  if (!name || name.length === 0) return false;
  if (name[0] < 'A' || name[0] > 'Z') return false;
  if (name.includes('_')) return false;
  return true;
}

function toPascalCase(name) {
  return name
    .replace(/^_+/, '')
    .replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase());
}
