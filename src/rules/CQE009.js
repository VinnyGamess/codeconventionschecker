

module.exports = {
  id: 'CQE009',
  name: 'Use [SerializeField] private instead of public fields',
  check(nodes) {
    const errors = [];
    for (const node of nodes) {
      if (node.kind !== 'field') continue;
      if (!node.modifiers || !node.modifiers.includes('public')) continue;

      if (node.modifiers.includes('const')) continue;
      if (node.modifiers.includes('static') && node.modifiers.includes('readonly')) continue;

      if (node.attributes && node.attributes.some(a => a === 'SerializeField')) continue;

      errors.push({
        rule: this.id,
        line: node.line,
        message: `Public field '${node.name}' should be [SerializeField] private instead.`,
        suggestion: `Change to: [SerializeField] private ${node.typeName || ''} ${node.name};`.trim(),
      });
    }
    return errors;
  },
};
