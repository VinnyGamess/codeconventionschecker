

const CQE001 = require('./CQE001');
const CQE002 = require('./CQE002');
const CQE003 = require('./CQE003');
const CQE004 = require('./CQE004');
const CQE005 = require('./CQE005');
const CQE006 = require('./CQE006');
const CQE008 = require('./CQE008');
const CQE009 = require('./CQE009');
const CQE010 = require('./CQE010');
const CQE011 = require('./CQE011');

const allRules = [CQE001, CQE002, CQE003, CQE004, CQE005, CQE006, CQE008, CQE009, CQE010, CQE011];

function runRules(nodes, tokens, config) {
  const errors = [];
  const enabledRules = config && config.rules ? config.rules : {};

  for (const rule of allRules) {

    if (enabledRules[rule.id] === false) continue;

    if (typeof rule.check === 'function') {
      errors.push(...rule.check(nodes));
    }

    if (typeof rule.checkTokens === 'function') {
      errors.push(...rule.checkTokens(tokens, config));
    }
  }

  errors.sort((a, b) => a.line - b.line);
  return errors;
}

module.exports = { runRules, allRules };
