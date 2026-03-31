// src/rules/CQE011.js — Heuristic naming quality (bad/non-English/mixed names)
// Uses the heuristic learning engine to detect poor identifier names.
// Severity: warning (heuristic, not deterministic).

const { analyseIdentifier } = require('../heuristic');

const THRESHOLD = 0.3;

module.exports = {
  id: 'CQE011',
  name: 'Heuristic naming quality',
  severity: 'warning',
  check(nodes) {
    const errors = [];
    const nameKinds = ['class', 'struct', 'interface', 'enum', 'record',
                       'method', 'field', 'variable'];

    for (const node of nodes) {
      if (!node.name) continue;
      if (!nameKinds.includes(node.kind)) continue;
      if (node.isConstructor) continue;

      const report = analyseIdentifier(node.name, node.kind);
      if (report.confidence < THRESHOLD) continue;

      const kindLabel = node.kind.charAt(0).toUpperCase() + node.kind.slice(1);
      const reasonList = report.reasons.slice(0, 3).join('; ');

      const parts = [];
      if (report.isNonEnglish) parts.push('non-English');
      if (report.isMixed) parts.push('mixed-language');
      if (parts.length === 0 && report.confidence >= 0.4) parts.push('poor quality');
      if (parts.length === 0) parts.push('suspicious');

      errors.push({
        rule: this.id,
        severity: 'warning',
        line: node.line,
        confidence: report.confidence,
        message: `${kindLabel} '${node.name}' — ${parts.join(', ')} name (confidence: ${report.confidence.toFixed(2)})`,
        suggestion: reasonList || 'Consider using a more descriptive English name.',
      });
    }

    return errors;
  },
};
