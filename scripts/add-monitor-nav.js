/*
 * New Quanthoms Billboard Agency (BANQ)
 * scripts/add-monitor-nav.js -- Rule 18 nav update, done idempotently
 *
 * WHY A SCRIPT: the Monitor page has to appear in the nav of every page, and
 * hand-editing seven HTML files is how six of them end up disagreeing. This adds
 * the link once and reports "no change" on every later run, so it is safe to
 * re-run and safe to leave in the repo.
 *
 * It refuses to touch a page whose nav it cannot find, rather than guessing.
 *
 * Run:  node scripts/add-monitor-nav.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ANCHOR = '<a href="dashboard.html">Dashboard</a>';
const LINK = '\n      <a href="monitor.html">Monitor</a>';

const pages = fs.readdirSync(ROOT).filter(function (f) { return f.endsWith('.html'); });

let changed = 0, already = 0, noNav = 0;

for (const page of pages) {
  if (page === 'monitor.html') continue;
  const file = path.join(ROOT, page);
  const src = fs.readFileSync(file, 'utf8');

  if (src.indexOf('href="monitor.html"') !== -1) {
    already++;
    console.log('  no change  ' + page);
    continue;
  }
  if (src.indexOf(ANCHOR) === -1) {
    noNav++;
    console.log('  SKIPPED    ' + page + ' (no Dashboard nav link found)');
    continue;
  }
  // Insert immediately after the Dashboard link so Monitor sits at the end of
  // the same nav row, and keep the file's existing line endings.
  const eol = src.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
  const link = eol + '      <a href="monitor.html">Monitor</a>';
  const out = src.replace(ANCHOR, ANCHOR + link);
  fs.writeFileSync(file, out, 'utf8');
  changed++;
  console.log('  ADDED      ' + page);
}

console.log('');
console.log('nav update: ' + changed + ' changed, ' + already + ' already had it, ' + noNav + ' skipped');
