/**
 * BANQ-021 -- UNIFIED ADVERTISING PAGE VERIFIER
 *
 * The design's Section 10 checks, as code. The one that matters most is check 3:
 * the catalog key set must equal the billing key set the QWK launch endpoint
 * accepts. That is the drift alarm -- the failure that put Starter/Premium
 * $500 on one page and Banner/Express ADS $450 on another.
 *
 * Run:  node scripts/verify-unified-ad-page.cjs
 * Exit: 0 when every check passes, 1 otherwise.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PASS = [];
const FAIL = [];

function check(name, ok, detail) {
  (ok ? PASS : FAIL).push(name + (detail ? ' :: ' + detail : ''));
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? ' :: ' + detail : ''));
}

function read(p) {
  try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
  catch (e) { return null; }
}

/** Load the browser IIFE catalog in a fake window. */
function loadCatalog() {
  const src = read('js/ad-catalog.js');
  if (!src) return null;
  const win = {};
  try {
    new Function('window', src)(win);
    return win.BANQ_AD_CATALOG || null;
  } catch (e) {
    console.log('  (catalog threw: ' + e.message + ')');
    return null;
  }
}

console.log('=== BANQ-021 unified advertising page ===\n');

// 1. catalog loads and has six unique entries
const CAT = loadCatalog();
check('1. catalog loads', !!CAT);
if (CAT) {
  const keys = CAT.entries.map((e) => e.key);
  check('1b. six entries', CAT.entries.length === 6, 'found ' + CAT.entries.length);
  check('1c. unique keys', new Set(keys).size === keys.length, keys.join(','));
}

// 2. every billable entry has a price and is in the billing key set
if (CAT) {
  const bad = CAT.entries.filter((e) => e.state !== 'announced_soon' && !CAT.isBillable(e));
  check('2. priced entries are billable', bad.length === 0, bad.map((e) => e.key).join(',') || 'all good');
}

// 3. THE DRIFT ALARM -- catalog billing keys vs the QWK PACKAGE_TIERS keys
if (CAT) {
  const adsPath = path.resolve(ROOT, '..', 'qwkbrowser', 'backend', 'routes', 'ads.js');
  let billingKeys = null;
  try {
    const ads = fs.readFileSync(adsPath, 'utf8');
    const block = ads.slice(ads.indexOf('PACKAGE_TIERS = {'));
    billingKeys = [];
    const re = /^\s{2}([a-z_]+):\s*\{/gm;
    let m;
    const stop = block.indexOf('\n};');
    const head = stop > -1 ? block.slice(0, stop) : block.slice(0, 4000);
    while ((m = re.exec(head)) !== null) billingKeys.push(m[1]);
  } catch (e) { /* sibling repo not present -- noted below */ }

  if (!billingKeys) {
    console.log('  NOTE  QWK PACKAGE_TIERS not readable (sibling repo absent); drift check skipped, not faked.');
  } else {
    const local = CAT.billing_keys.slice().sort().join(',');
    const remote = billingKeys.slice().sort().join(',');
    check('3. catalog billing keys == QWK PACKAGE_TIERS keys', local === remote,
      'catalog[' + local + '] vs qwk[' + remote + ']');
  }
}

// 4. no day-based durations anywhere in the catalog or the two surfaces
const dayRe = /\/\s*7 days|7-day|14 days|14-day|30 days|30-day|per campaign \/|duration_days/i;
['js/ad-catalog.js', 'packages.html', 'index.html'].forEach((f) => {
  const src = read(f) || '';
  const hit = src.match(dayRe);
  check('4. no day durations in ' + f, !hit, hit ? 'found "' + hit[0] + '"' : '');
});

// 5. priced shows a number; unpriced shows $ and no number
if (CAT) {
  const priceOk = CAT.entries.every((e) =>
    e.price_usd == null ? e.price_display === '$' : e.price_display === '$' + e.price_usd);
  check('5. price display matches price_usd', priceOk);
}

// 6. the dead tier names are gone from both surfaces
['packages.html', 'index.html'].forEach((f) => {
  const src = read(f) || '';
  const hit = src.match(/\bStarter\b|\bPremium Banner\b|\bSponsored Feed\b/);
  check('6. no old tier names in ' + f, !hit, hit ? 'found "' + hit[0] + '"' : '');
});

// 7. both renderers exist
const pageSrc = read('js/ad-page.js') || '';
check('7. mountPage exists', pageSrc.indexOf('mountPage') !== -1);
check('7b. mountPopup exists', pageSrc.indexOf('mountPopup') !== -1);
check('7c. surfaces render the catalog', (read('packages.html') || '').indexOf('BANQ_AD_PAGE') !== -1 &&
  (read('index.html') || '').indexOf('BANQ_AD_PAGE') !== -1);

// 8. QAP read-through proxy is mounted
check('8. /api/ad-profile proxy present', (read('server.js') || '').indexOf("'/api/ad-profile'") !== -1);

// 9. dashboard resolves a catalog key rather than printing it raw
const dash = read('dashboard.html') || '';
check('9. dashboard resolves pkg via catalog', dash.indexOf('BANQ_AD_CATALOG') !== -1 && dash.indexOf('entry.label') !== -1);

// 10. the BANQ service is the only BANQ price and states credits-or-fiat
if (CAT) {
  check('10. BANQ service is $15/mo all-ads', CAT.service.monthly_usd === 15 && CAT.service.all_ads === true);
  check('10b. payable in credits or fiat', /credits or fiat/i.test(CAT.service.payment));
}

console.log('\n=== ' + PASS.length + ' PASS / ' + FAIL.length + ' FAIL ===');
if (FAIL.length) {
  console.log('\nFAILURES:');
  FAIL.forEach((f) => console.log('  - ' + f));
}
process.exitCode = FAIL.length ? 1 : 0;
