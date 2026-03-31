#!/usr/bin/env node
// test/testRunner.js — Simple test runner (no external libs)
// Runs the engine against test .cs files and checks expected rule violations.

const path = require('path');
const { analyzeFile } = require('../src/engine');
const { loadConfig } = require('../src/config');
const { ANSI } = require('../src/reporter');

const config = loadConfig(path.join(__dirname, '..'));

let passed = 0;
let failed = 0;

function assert(condition, testName, detail) {
  if (condition) {
    passed++;
    console.log(`  ${ANSI.green}PASS${ANSI.reset}  ${testName}`);
  } else {
    failed++;
    console.log(`  ${ANSI.red}FAIL${ANSI.reset}  ${testName}`);
    if (detail) console.log(`        ${ANSI.grey}${detail}${ANSI.reset}`);
  }
}

function hasViolation(errors, rule, lineOrName) {
  return errors.some(e => {
    if (e.rule !== rule) return false;
    if (typeof lineOrName === 'number') return e.line === lineOrName;
    if (typeof lineOrName === 'string') return e.message.includes(lineOrName);
    return true;
  });
}

function countViolations(errors, rule) {
  return errors.filter(e => e.rule === rule).length;
}

// ─── Test suite: sample.cs ──────────────────────────────────────────────────

console.log(`\n${ANSI.bold}Testing sample.cs${ANSI.reset}`);
const sampleErrors = analyzeFile(path.join(__dirname, 'sample.cs'), config);

assert(hasViolation(sampleErrors, 'CQE001', 'Score'), 'CQE001: detects public field Score');
assert(hasViolation(sampleErrors, 'CQE001', 'Data'), 'CQE001: detects public field Data');
assert(!hasViolation(sampleErrors, 'CQE001', 'MaxRetries'), 'CQE001: allows public const');
assert(!hasViolation(sampleErrors, 'CQE001', 'DefaultName'), 'CQE001: allows public static readonly');

assert(hasViolation(sampleErrors, 'CQE003', 'myBadClass'), 'CQE003: detects non-PascalCase class');
assert(hasViolation(sampleErrors, 'CQE004', 'calculate_total'), 'CQE004: detects non-PascalCase method');
assert(hasViolation(sampleErrors, 'CQE005', 'TotalAmount'), 'CQE005: detects non-camelCase variable');
assert(hasViolation(sampleErrors, 'CQE006', 'name'), 'CQE006: detects private field without _prefix');

assert(hasViolation(sampleErrors, 'CQE008', '100'), 'CQE008: detects magic number 100');
assert(hasViolation(sampleErrors, 'CQE008', '42'), 'CQE008: detects magic number 42');

// Enum numbers should NOT trigger CQE008
assert(!sampleErrors.some(e => e.rule === 'CQE008' && e.message.includes('10') && e.line > 90),
  'CQE008: ignores enum values');

// ─── Test suite: sample_unity.cs ────────────────────────────────────────────

console.log(`\n${ANSI.bold}Testing sample_unity.cs${ANSI.reset}`);
const unityErrors = analyzeFile(path.join(__dirname, 'sample_unity.cs'), config);

assert(hasViolation(unityErrors, 'CQE009', 'speed'), 'CQE009: detects public field speed');
assert(hasViolation(unityErrors, 'CQE009', 'health'), 'CQE009: detects public field health');
assert(!hasViolation(unityErrors, 'CQE009', 'MaxHealth'), 'CQE009: allows public const');
assert(hasViolation(unityErrors, 'CQE009', 'aggroRange'), 'CQE009: detects public field aggroRange');

assert(hasViolation(unityErrors, 'CQE010'), 'CQE010: flags Awake+Start or missing init');

const cqe010Errors = unityErrors.filter(e => e.rule === 'CQE010');
assert(cqe010Errors.some(e => e.message.includes('PlayerController') && e.message.includes('both')),
  'CQE010: warns about PlayerController having both Awake and Start');
assert(cqe010Errors.some(e => e.message.includes('EnemyAI') && e.message.includes('no Awake')),
  'CQE010: warns about EnemyAI missing Awake/Start');
assert(!cqe010Errors.some(e => e.message.includes('GameSettings')),
  'CQE010: does not flag non-MonoBehaviour class');

// ─── Test suite: sample_attributes.cs ───────────────────────────────────────

console.log(`\n${ANSI.bold}Testing sample_attributes.cs${ANSI.reset}`);
const attrErrors = analyzeFile(path.join(__dirname, 'sample_attributes.cs'), config);

assert(!hasViolation(attrErrors, 'CQE009', '_itemName'), 'CQE009: allows [SerializeField] private field');
assert(!hasViolation(attrErrors, 'CQE009', '_quantity'), 'CQE009: allows [SerializeField] private (multiline attr)');
assert(!hasViolation(attrErrors, 'CQE009', '_maxStack'), 'CQE009: allows [SerializeField] with multiple attrs');
assert(hasViolation(attrErrors, 'CQE009', 'weight'), 'CQE009: detects public field without SerializeField');
assert(hasViolation(attrErrors, 'CQE009', 'description'), 'CQE009: detects public field with non-SerializeField attr');
assert(hasViolation(attrErrors, 'CQE004', 'remove_item'), 'CQE004: detects non-PascalCase method');

// ─── Test suite: config ─────────────────────────────────────────────────────

console.log(`\n${ANSI.bold}Testing config${ANSI.reset}`);
const { loadConfig: lc, DEFAULT_CONFIG } = require('../src/config');
const defaultCfg = lc(path.join(__dirname, '..'));

assert(defaultCfg.rules.CQE001 === true, 'Config: CQE001 enabled by default');
assert(defaultCfg.rules.CQE009 === true, 'Config: CQE009 enabled by default');
assert(defaultCfg.rules.CQE010 === true, 'Config: CQE010 enabled by default');
assert(Array.isArray(defaultCfg.magicNumberWhitelist), 'Config: magicNumberWhitelist is array');
assert(defaultCfg.magicNumberWhitelist.includes(0), 'Config: whitelist includes 0');

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${ANSI.bold}${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);
if (failed === 0) {
  console.log(`${ANSI.green}${ANSI.bold}All ${passed} tests passed!${ANSI.reset}\n`);
} else {
  console.log(`${ANSI.red}${ANSI.bold}${failed} test(s) failed${ANSI.reset}, ${ANSI.green}${passed} passed${ANSI.reset}\n`);
}

process.exit(failed > 0 ? 1 : 0);
