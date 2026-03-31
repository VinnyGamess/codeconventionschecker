// src/config.js — Configuration: rules on/off + magic number whitelist
// Loads an optional .cqerc.json from the project root. Falls back to defaults.

const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  rules: {
    CQE001: true,
    CQE002: true,
    CQE003: true,
    CQE004: true,
    CQE005: true,
    CQE006: true,
    CQE008: true,
    CQE009: true,
    CQE010: true,
    CQE011: true,
  },
  heuristicThreshold: 0.3,
  magicNumberWhitelist: [0, 1, -1],
};

function loadConfig(baseDir) {
  const configPath = path.join(baseDir || process.cwd(), '.cqerc.json');
  let userConfig = {};

  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      userConfig = JSON.parse(raw);
    } catch (err) {
      console.error(`[WARN] Could not parse ${configPath}: ${err.message}. Using defaults.`);
    }
  }

  // Merge: user overrides defaults
  const rules = { ...DEFAULT_CONFIG.rules };
  if (userConfig.rules && typeof userConfig.rules === 'object') {
    for (const [key, val] of Object.entries(userConfig.rules)) {
      if (typeof val === 'boolean') {
        rules[key] = val;
      }
    }
  }

  const magicNumberWhitelist = Array.isArray(userConfig.magicNumberWhitelist)
    ? userConfig.magicNumberWhitelist.filter(n => typeof n === 'number')
    : DEFAULT_CONFIG.magicNumberWhitelist;

  return { rules, magicNumberWhitelist };
}

module.exports = { loadConfig, DEFAULT_CONFIG };
