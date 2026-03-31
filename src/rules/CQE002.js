// src/rules/CQE002.js — Access modifiers required
// Every class, method, and field must have an explicit access modifier.

module.exports = {
  id: 'CQE002',
  name: 'Access modifier required',
  check(nodes) {
    const errors = [];
    const applicable = ['class', 'struct', 'interface', 'enum', 'record', 'method', 'field'];

    for (const node of nodes) {
      if (!applicable.includes(node.kind)) continue;
      if (node.isConstructor) continue; // static constructors don't need access modifiers

      if (!node.hasAccessModifier) {
        errors.push({
          rule: this.id,
          line: node.line,
          message: `${capitalize(node.kind)} '${node.name}' is missing an access modifier.`,
          suggestion: `Add an explicit access modifier (public, private, protected, internal).`,
        });
      }
    }
    return errors;
  },
};

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
