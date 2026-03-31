// src/reporter.js — Coloured reporter with source snippets (no external libs)
// Uses ANSI escape codes for colour output in terminals that support it.

const fs = require('fs');

// ANSI colour codes
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
  grey: '\x1b[90m',
  white: '\x1b[37m',
  underline: '\x1b[4m',
};

// Cache file contents so we don't re-read for every error in the same file
const fileCache = new Map();

function getLines(filePath) {
  if (fileCache.has(filePath)) return fileCache.get(filePath);
  try {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    fileCache.set(filePath, lines);
    return lines;
  } catch {
    return null;
  }
}

function formatSeverity(severity) {
  if (severity === 'warning') {
    return `${ANSI.yellow}${ANSI.bold}warning${ANSI.reset}`;
  }
  return `${ANSI.red}${ANSI.bold}error${ANSI.reset}`;
}

function formatSnippet(filePath, line, contextLines = 1) {
  const lines = getLines(filePath);
  if (!lines) return '';

  const start = Math.max(0, line - 1 - contextLines);
  const end = Math.min(lines.length - 1, line - 1 + contextLines);
  const gutterWidth = String(end + 1).length;
  let output = '';

  for (let i = start; i <= end; i++) {
    const lineNum = String(i + 1).padStart(gutterWidth, ' ');
    const isTarget = i === line - 1;
    const marker = isTarget ? `${ANSI.red}>${ANSI.reset}` : ' ';
    const lineColour = isTarget ? ANSI.white : ANSI.grey;
    const numColour = isTarget ? ANSI.cyan : ANSI.grey;
    output += `  ${marker} ${numColour}${lineNum}${ANSI.reset} ${ANSI.grey}|${ANSI.reset} ${lineColour}${lines[i] || ''}${ANSI.reset}\n`;
  }

  return output;
}

function reportError(err) {
  const sev = formatSeverity(err.severity);
  const rule = `${ANSI.magenta}${err.rule}${ANSI.reset}`;
  const location = `${ANSI.cyan}${ANSI.underline}${err.file}${ANSI.reset}${ANSI.grey}:${err.line}${ANSI.reset}`;
  const message = `${ANSI.white}${err.message}${ANSI.reset}`;
  const suggestion = err.suggestion ? `${ANSI.green}Suggestion: ${err.suggestion}${ANSI.reset}` : '';

  let output = `\n${location}\n`;
  output += `  ${sev} ${rule}  ${message}\n`;
  if (suggestion) {
    output += `  ${suggestion}\n`;
  }

  // Show snippet if we have the file path
  if (err.file && err.line) {
    const snippet = formatSnippet(err.file, err.line);
    if (snippet) output += snippet;
  }

  return output;
}

function reportSummary(totalFiles, totalErrors, totalWarnings) {
  let output = '\n';
  output += `${ANSI.bold}${ANSI.dim}${'─'.repeat(60)}${ANSI.reset}\n`;

  if (totalErrors === 0 && totalWarnings === 0) {
    output += `${ANSI.green}${ANSI.bold}  ✓ ${totalFiles} file(s) scanned — no issues found${ANSI.reset}\n`;
  } else {
    const parts = [];
    if (totalErrors > 0) parts.push(`${ANSI.red}${ANSI.bold}${totalErrors} error(s)${ANSI.reset}`);
    if (totalWarnings > 0) parts.push(`${ANSI.yellow}${ANSI.bold}${totalWarnings} warning(s)${ANSI.reset}`);
    output += `  ${ANSI.bold}${totalFiles} file(s) scanned${ANSI.reset} — ${parts.join(', ')}\n`;
  }

  output += `${ANSI.bold}${ANSI.dim}${'─'.repeat(60)}${ANSI.reset}\n`;
  return output;
}

function clearCache() {
  fileCache.clear();
}

module.exports = { reportError, reportSummary, clearCache, ANSI };
