

module.exports = {
  id: 'CQE010',
  name: 'Awake vs Start usage',
  severity: 'warning',
  check(nodes) {
    const errors = [];

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
