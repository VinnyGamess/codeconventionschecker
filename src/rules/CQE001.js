

module.exports = {
  id: 'CQE001',
  name: 'No public fields',
  check(nodes) {
    const errors = [];
    for (const node of nodes) {
      if (node.kind === 'field' && node.modifiers && node.modifiers.includes('public')) {

        if (node.modifiers.includes('const')) continue;
        if (node.modifiers.includes('static') && node.modifiers.includes('readonly')) continue;

        errors.push({
          rule: this.id,
          line: node.line,
          message: `Public field '${node.name}' detected.`,
          suggestion: `Use a property or mark the field as private/internal.`,
        });
      }
    }
    return errors;
  },
};
