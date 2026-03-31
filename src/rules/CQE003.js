

module.exports = {
  id: 'CQE003',
  name: 'Class names must be PascalCase',
  check(nodes) {
    const errors = [];
    const types = ['class', 'struct', 'interface', 'enum', 'record'];

    for (const node of nodes) {
      if (!types.includes(node.kind)) continue;

      if (!isPascalCase(node.name)) {
        errors.push({
          rule: this.id,
          line: node.line,
          message: `${capitalize(node.kind)} '${node.name}' is not PascalCase.`,
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

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
