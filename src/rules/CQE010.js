// src/rules/CQE010.js — Awake vs Start check (heuristic, warning)
// Heuristic: if a MonoBehaviour has both Awake() and Start(), warn that
// initialisation logic may be split confusingly. Also warns when neither
// is present in a class that looks like a MonoBehaviour.

module.exports = {
  id: 'CQE010',
  name: 'Awake vs Start usage',
  severity: 'warning',
  check(nodes) {
    const errors = [];

    // Group methods by their surrounding class.
    // Strategy: walk nodes, track which class we're in by finding class nodes
    // and then methods that follow. We rely on document order.
    const classes = [];
    let currentClass = null;

    for (const node of nodes) {
      if (node.kind === 'class') {
        currentClass = { node, methods: [] };
        classes.push(currentClass);
      } else if (node.kind === 'method' && currentClass) {
        currentClass.methods.push(node);
      }
    }

    for (const cls of classes) {
      const methodNames = cls.methods.map(m => m.name);
      const hasAwake = methodNames.includes('Awake');
      const hasStart = methodNames.includes('Start');

      // Heuristic: if the class has both Awake and Start, warn about split init
      if (hasAwake && hasStart) {
        const startMethod = cls.methods.find(m => m.name === 'Start');
        errors.push({
          rule: this.id,
          line: startMethod.line,
          severity: 'warning',
          message: `Class '${cls.node.name}' has both Awake() and Start(). Consider consolidating initialisation.`,
          suggestion: `Use Awake() for self-init and Start() only for cross-object references, or consolidate into one.`,
        });
      }

      // Heuristic: class inherits MonoBehaviour (we can't fully check inheritance,
      // but if it has OnEnable, Update, FixedUpdate etc. it's likely a MonoBehaviour)
      const unityCallbacks = ['OnEnable', 'OnDisable', 'Update', 'FixedUpdate', 'LateUpdate',
        'OnDestroy', 'OnCollisionEnter', 'OnTriggerEnter', 'OnGUI'];
      const hasUnityCallback = methodNames.some(m => unityCallbacks.includes(m));

      if (hasUnityCallback && !hasAwake && !hasStart) {
        errors.push({
          rule: this.id,
          line: cls.node.line,
          severity: 'warning',
          message: `Class '${cls.node.name}' appears to be a MonoBehaviour but has no Awake() or Start().`,
          suggestion: `Add Awake() or Start() for explicit initialisation, even if empty.`,
        });
      }
    }

    return errors;
  },
};
