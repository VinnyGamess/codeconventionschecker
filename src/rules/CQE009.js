// src/rules/CQE009.js — Use [SerializeField] private instead of public fields
// Unity best practice: expose fields in the Inspector via [SerializeField] on
// private fields rather than making them public.

module.exports = {
  id: 'CQE009',
  name: 'Use [SerializeField] private instead of public fields',
  check(nodes) {
    const errors = [];
    for (const node of nodes) {
      if (node.kind !== 'field') continue;
      if (!node.modifiers || !node.modifiers.includes('public')) continue;

      // Allow public const and public static readonly
      if (node.modifiers.includes('const')) continue;
      if (node.modifiers.includes('static') && node.modifiers.includes('readonly')) continue;

      // If the field already has [SerializeField], skip (it's redundant but not wrong here)
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
