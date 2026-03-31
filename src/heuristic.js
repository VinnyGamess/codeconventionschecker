// src/heuristic.js — Heuristic Learning Engine (no libraries)
// Analyses identifier names for quality using:
//   - Levenshtein distance to known bad names
//   - N-gram frequency analysis (English-likeness)
//   - Pattern checks (digits, repeated chars, too short/long)
//   - Non-English / mixed-language detection
//   - Persistent learning data (learningData.json)
//
// Returns a confidence score 0–1 where 1 = definitely bad name.

const fs = require('fs');
const path = require('path');

// ─── Known bad names / placeholder names ────────────────────────────────────

const BAD_NAMES = [
  // Generic placeholders
  'test', 'temp', 'tmp', 'foo', 'bar', 'baz', 'qux', 'asdf', 'xxx', 'yyy',
  'abc', 'xyz', 'aaa', 'bbb', 'ccc', 'zzz', 'blah', 'todo', 'fixme',
  'stuff', 'thing', 'data', 'data1', 'data2', 'val', 'val1', 'val2',
  'obj', 'obj1', 'obj2', 'var1', 'var2', 'str', 'str1', 'str2',
  'num', 'num1', 'num2', 'res', 'ret', 'result1', 'result2',
  'dummy', 'sample', 'example', 'placeholder',
  // Common non-English (Dutch examples)
  'aap', 'noot', 'mies', 'wim', 'zus', 'jet', 'bril', 'schaap',
  'fiets', 'appel', 'banaan', 'kat', 'hond', 'muis', 'deur',
  'tafel', 'stoel', 'boek', 'potlood', 'nummer', 'getal',
  'knop', 'scherm', 'venster', 'bericht', 'lijst', 'teller',
  'speler', 'vijand', 'snelheid', 'hoogte', 'breedte', 'lengte',
  // German common
  'eingabe', 'ausgabe', 'fehler', 'nachricht', 'spieler', 'zahl',
  'wert', 'groesse', 'breite', 'hoehe', 'laenge', 'taste',
  // Single characters (except common conventions i, j, k, x, y, z, e, _)
  'a', 'b', 'c', 'd', 'f', 'g', 'h', 'l', 'm', 'n', 'o', 'p', 'q',
  'r', 's', 't', 'u', 'v', 'w',
];

const BAD_NAME_SET = new Set(BAD_NAMES);

// ─── Common English programming words (positive signals) ───────────────────

const ENGLISH_COMMON = new Set([
  'get', 'set', 'add', 'remove', 'delete', 'update', 'create', 'find',
  'search', 'sort', 'filter', 'map', 'reduce', 'count', 'size', 'length',
  'width', 'height', 'depth', 'index', 'key', 'value', 'name', 'type',
  'item', 'list', 'array', 'queue', 'stack', 'tree', 'node', 'graph',
  'edge', 'path', 'file', 'buffer', 'stream', 'reader', 'writer',
  'handler', 'listener', 'callback', 'event', 'action', 'command',
  'request', 'response', 'client', 'server', 'service', 'controller',
  'manager', 'factory', 'builder', 'provider', 'resolver', 'validator',
  'parser', 'formatter', 'converter', 'adapter', 'wrapper', 'proxy',
  'cache', 'pool', 'config', 'settings', 'options', 'params', 'args',
  'input', 'output', 'error', 'exception', 'message', 'result',
  'status', 'state', 'context', 'scope', 'session', 'token',
  'user', 'player', 'enemy', 'target', 'source', 'destination',
  'start', 'stop', 'begin', 'end', 'init', 'reset', 'clear', 'close',
  'open', 'read', 'write', 'load', 'save', 'send', 'receive',
  'enable', 'disable', 'show', 'hide', 'visible', 'active', 'enabled',
  'min', 'max', 'total', 'sum', 'average', 'current', 'previous', 'next',
  'first', 'last', 'left', 'right', 'top', 'bottom', 'front', 'back',
  'position', 'rotation', 'scale', 'velocity', 'speed', 'force',
  'color', 'colour', 'text', 'label', 'title', 'description',
  'is', 'has', 'can', 'should', 'will', 'was',
  'on', 'off', 'true', 'false', 'null', 'none', 'empty', 'default',
]);

// ─── English bigram frequencies (top pairs, normalised) ─────────────────────
// Used to score how "English-like" a word looks.

const ENGLISH_BIGRAMS = {
  'th': 3.56, 'he': 3.07, 'in': 2.43, 'er': 2.05, 'an': 1.99,
  're': 1.85, 'on': 1.76, 'at': 1.49, 'en': 1.45, 'nd': 1.35,
  'ti': 1.34, 'es': 1.34, 'or': 1.28, 'te': 1.27, 'of': 1.17,
  'ed': 1.17, 'is': 1.13, 'it': 1.12, 'al': 1.09, 'ar': 1.07,
  'st': 1.05, 'to': 1.05, 'nt': 1.04, 'ng': 0.95, 'se': 0.93,
  'ha': 0.93, 'as': 0.87, 'ou': 0.87, 'io': 0.83, 'le': 0.83,
  've': 0.83, 'co': 0.79, 'me': 0.79, 'de': 0.76, 'hi': 0.73,
  'ri': 0.73, 'ro': 0.73, 'ic': 0.70, 'ne': 0.69, 'ea': 0.69,
  'ra': 0.69, 'ce': 0.65, 'li': 0.62, 'ch': 0.60, 'll': 0.58,
  'be': 0.58, 'ma': 0.57, 'si': 0.55, 'om': 0.55, 'ur': 0.54,
};

// Non-English bigrams that are rare in English but common in Dutch/German
const NON_ENGLISH_BIGRAMS = new Set([
  'ij', 'oe', 'ui', 'aa', 'uu', 'ee', 'oo', 'eu',  // Dutch vowels
  'heid', 'lijk', 'baar', 'tje',                      // Dutch suffixes
  'sch', 'ck', 'pf', 'tz', 'sz',                      // German
  'ää', 'öö', 'üü',                                    // German umlauts
]);

// ─── Levenshtein Distance ───────────────────────────────────────────────────

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Use single-row optimisation
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Normalised similarity: 0 = identical, 1 = completely different
function levenshteinSimilarity(a, b) {
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 0 : dist / maxLen;
}

// ─── N-gram Analysis ────────────────────────────────────────────────────────

function getBigrams(word) {
  const bigrams = [];
  const lower = word.toLowerCase();
  for (let i = 0; i < lower.length - 1; i++) {
    bigrams.push(lower.substring(i, i + 2));
  }
  return bigrams;
}

function getTrigrams(word) {
  const trigrams = [];
  const lower = word.toLowerCase();
  for (let i = 0; i < lower.length - 2; i++) {
    trigrams.push(lower.substring(i, i + 3));
  }
  return trigrams;
}

// Score how English-like a word is based on bigram frequencies (0 = gibberish, 1 = very English)
function englishBigramScore(word) {
  const bigrams = getBigrams(word);
  if (bigrams.length === 0) return 0.5;

  let totalScore = 0;
  for (const bg of bigrams) {
    totalScore += ENGLISH_BIGRAMS[bg] || 0;
  }

  // Normalise: average bigram score / max possible (~3.5)
  const avg = totalScore / bigrams.length;
  return Math.min(1, avg / 2.0);
}

// Jaccard similarity between bigram sets of two words
function bigramSimilarity(a, b) {
  const setA = new Set(getBigrams(a));
  const setB = new Set(getBigrams(b));
  if (setA.size === 0 && setB.size === 0) return 1;

  let intersection = 0;
  for (const bg of setA) {
    if (setB.has(bg)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ─── Pattern Checks ─────────────────────────────────────────────────────────

function splitCamelCase(name) {
  // Remove leading underscores
  const clean = name.replace(/^_+/, '');
  // Split on camelCase / PascalCase boundaries
  return clean
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(w => w.length > 0);
}

function hasDigitSuffix(name) {
  return /\d+$/.test(name);
}

function hasDigitPrefix(name) {
  return /^_?\d/.test(name);
}

function isAllSameChar(name) {
  const clean = name.replace(/^_+/, '').toLowerCase();
  if (clean.length < 2) return false;
  return clean.split('').every(c => c === clean[0]);
}

function hasRepeatedChars(name) {
  const clean = name.replace(/^_+/, '').toLowerCase();
  return /(.)\1{2,}/.test(clean); // 3+ same char in a row
}

function isTooShort(name) {
  const clean = name.replace(/^_+/, '');
  return clean.length <= 2;
}

function isTooLong(name) {
  const clean = name.replace(/^_+/, '');
  return clean.length > 40;
}

function hasKeyboardWalk(name) {
  const lower = name.replace(/^_+/, '').toLowerCase();
  const walks = ['qwer', 'asdf', 'zxcv', 'wasd', 'qwerty', 'asdfgh'];
  return walks.some(w => lower.includes(w));
}

// ─── Non-English Detection ──────────────────────────────────────────────────

function detectNonEnglishSignals(word) {
  const lower = word.toLowerCase();
  let signals = 0;

  // Check for non-English bigram patterns
  for (const bg of NON_ENGLISH_BIGRAMS) {
    if (lower.includes(bg)) signals++;
  }

  // Double vowels uncommon in English programming words (except 'oo', 'ee')
  if (/aa|uu|ii/.test(lower)) signals++;

  // Consonant clusters unusual in English
  if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(lower)) signals++;

  return signals;
}

function isMixedLanguage(words) {
  if (words.length < 2) return false;
  let englishCount = 0;
  let nonEnglishCount = 0;

  for (const w of words) {
    if (ENGLISH_COMMON.has(w)) {
      englishCount++;
    } else if (detectNonEnglishSignals(w) > 0) {
      nonEnglishCount++;
    }
  }

  return englishCount > 0 && nonEnglishCount > 0;
}

// ─── Learning Data ──────────────────────────────────────────────────────────

const LEARNING_DATA_FILE = path.join(__dirname, '..', 'learningData.json');

function loadLearningData() {
  try {
    if (fs.existsSync(LEARNING_DATA_FILE)) {
      const raw = fs.readFileSync(LEARNING_DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // Corrupted file — start fresh
  }
  return { badNames: [], goodNames: [], seenPatterns: {} };
}

function saveLearningData(data) {
  try {
    fs.writeFileSync(LEARNING_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Non-critical — silently ignore
  }
}

function recordBadName(name) {
  const data = loadLearningData();
  const lower = name.toLowerCase();
  if (!data.badNames.includes(lower)) {
    data.badNames.push(lower);
    // Keep list manageable
    if (data.badNames.length > 500) data.badNames = data.badNames.slice(-500);
    saveLearningData(data);
  }
}

function recordGoodName(name) {
  const data = loadLearningData();
  const lower = name.toLowerCase();
  if (!data.goodNames.includes(lower)) {
    data.goodNames.push(lower);
    if (data.goodNames.length > 500) data.goodNames = data.goodNames.slice(-500);
    saveLearningData(data);
  }
}

function getLearnedBadNames() {
  const data = loadLearningData();
  return data.badNames || [];
}

// ─── Main Scoring Engine ────────────────────────────────────────────────────

/**
 * Analyse an identifier name and return a quality report.
 *
 * @param {string} name      The identifier (field, variable, method, class name)
 * @param {string} kind      'class' | 'method' | 'variable' | 'field'
 * @returns {{ confidence: number, reasons: string[], isNonEnglish: boolean, isMixed: boolean }}
 *   confidence: 0 = fine, 1 = definitely bad
 */
function analyseIdentifier(name, kind) {
  const reasons = [];
  let score = 0;
  const clean = name.replace(/^_+/, '');
  const lower = clean.toLowerCase();
  const words = splitCamelCase(name);

  // ── 1. Exact match in bad names list ──────────────────────────────────
  if (BAD_NAME_SET.has(lower)) {
    score += 0.6;
    reasons.push(`'${clean}' is a known placeholder/bad name`);
  }

  // Check words within compound names
  for (const w of words) {
    if (w.length > 1 && BAD_NAME_SET.has(w) && !ENGLISH_COMMON.has(w)) {
      score += 0.3;
      reasons.push(`contains placeholder word '${w}'`);
    }
  }

  // ── 2. Levenshtein closeness to bad names ─────────────────────────────
  let closestBad = null;
  let closestDist = Infinity;
  for (const bad of BAD_NAMES) {
    const dist = levenshtein(lower, bad);
    if (dist < closestDist) {
      closestDist = dist;
      closestBad = bad;
    }
  }
  // If very close to a bad name but not exact match
  if (closestDist > 0 && closestDist <= 2 && closestBad) {
    const penalty = closestDist === 1 ? 0.35 : 0.15;
    score += penalty;
    reasons.push(`very similar to bad name '${closestBad}' (distance: ${closestDist})`);
  }

  // Check learned bad names too
  const learned = getLearnedBadNames();
  for (const bad of learned) {
    const dist = levenshtein(lower, bad);
    if (dist === 0) {
      score += 0.5;
      reasons.push(`'${clean}' was previously flagged`);
      break;
    } else if (dist <= 2) {
      score += 0.2;
      reasons.push(`similar to previously flagged '${bad}'`);
      break;
    }
  }

  // ── 3. Pattern checks ────────────────────────────────────────────────
  if (isTooShort(name) && kind !== 'variable') {
    score += 0.3;
    reasons.push('name is too short (≤ 2 chars)');
  } else if (isTooShort(name) && kind === 'variable') {
    // Short variable names are sometimes OK (i, j, k) but suspicious otherwise
    const allowedShort = new Set(['i', 'j', 'k', 'x', 'y', 'z', 'id']);
    if (!allowedShort.has(lower)) {
      score += 0.2;
      reasons.push('short variable name (consider more descriptive)');
    }
  }

  if (isTooLong(name)) {
    score += 0.15;
    reasons.push('name is excessively long (> 40 chars)');
  }

  if (hasDigitSuffix(name) && !/[A-Za-z]2[Dd]|[A-Za-z]3[Dd]|[Vv]ector[234]|[Uu]int(8|16|32|64)|[Ii]nt(8|16|32|64)/.test(clean)) {
    score += 0.25;
    reasons.push('numeric suffix suggests lazy naming (e.g. data1, data2)');
  }

  if (isAllSameChar(name)) {
    score += 0.5;
    reasons.push('all same character');
  }

  if (hasRepeatedChars(name)) {
    score += 0.2;
    reasons.push('excessive character repetition');
  }

  if (hasKeyboardWalk(name)) {
    score += 0.4;
    reasons.push('keyboard walk pattern detected');
  }

  // ── 4. N-gram / English-likeness ──────────────────────────────────────
  if (clean.length >= 4) {
    const engScore = englishBigramScore(clean);
    if (engScore < 0.15) {
      score += 0.3;
      reasons.push(`low English-likeness (bigram score: ${engScore.toFixed(2)})`);
    } else if (engScore < 0.25) {
      score += 0.15;
      reasons.push(`below-average English-likeness (bigram score: ${engScore.toFixed(2)})`);
    }
  }

  // ── 5. Non-English / mixed language ───────────────────────────────────
  const nonEngSignals = detectNonEnglishSignals(clean);
  const isNonEnglish = nonEngSignals >= 2;
  const isMixed = isMixedLanguage(words);

  if (isNonEnglish) {
    score += 0.3;
    reasons.push('likely non-English identifier');
  }

  if (isMixed) {
    score += 0.25;
    reasons.push('mixed-language naming (English + other)');
  }

  // Check individual words for non-English
  for (const w of words) {
    if (w.length >= 4 && !ENGLISH_COMMON.has(w) && detectNonEnglishSignals(w) >= 1) {
      // Check bigram similarity to any known English word
      let bestSim = 0;
      for (const eng of ENGLISH_COMMON) {
        const sim = bigramSimilarity(w, eng);
        if (sim > bestSim) bestSim = sim;
      }
      if (bestSim < 0.3) {
        score += 0.15;
        reasons.push(`word '${w}' appears non-English`);
      }
    }
  }

  // ── Clamp and round ───────────────────────────────────────────────────
  const confidence = Math.min(1, Math.max(0, score));

  return {
    confidence: Math.round(confidence * 100) / 100,
    reasons,
    isNonEnglish,
    isMixed,
  };
}

// ─── Batch analysis for AST nodes ───────────────────────────────────────────

function analyseNodes(nodes, threshold) {
  threshold = threshold || 0.3;
  const results = [];

  for (const node of nodes) {
    if (!node.name) continue;
    const kinds = ['class', 'struct', 'interface', 'enum', 'record',
                   'method', 'field', 'variable'];
    if (!kinds.includes(node.kind)) continue;

    // Skip constructors (they must match class name)
    if (node.isConstructor) continue;

    const report = analyseIdentifier(node.name, node.kind);
    if (report.confidence >= threshold) {
      results.push({
        node,
        ...report,
      });

      // Auto-learn flagged names above high confidence
      if (report.confidence >= 0.6) {
        recordBadName(node.name);
      }
    }
  }

  return results;
}

module.exports = {
  analyseIdentifier,
  analyseNodes,
  levenshtein,
  levenshteinSimilarity,
  englishBigramScore,
  bigramSimilarity,
  splitCamelCase,
  detectNonEnglishSignals,
  isMixedLanguage,
  loadLearningData,
  saveLearningData,
  recordBadName,
  recordGoodName,
  BAD_NAMES,
  ENGLISH_COMMON,
};
