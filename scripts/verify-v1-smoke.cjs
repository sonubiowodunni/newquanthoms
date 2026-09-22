/*
 * New Quanthoms Billboard Agency (BANQ)
 * scripts/verify-v1-smoke.cjs -- Rule 57 smoke test, read-only
 *
 * WHAT IT CHECKS, and why each one is here rather than in a unit test:
 *
 *   - Every page answers 200 with an HTML body. A page that 500s, or that
 *     answers with the SPA fallback because its file is missing, is caught here
 *     and nowhere else.
 *   - Every API path answers as an API. This is the check that would have
 *     caught the two proxy bugs found on 2026-09-22: /api/ads/public had been
 *     returning QwkBrowser's HOMEPAGE (HTML, status 200) because the proxy
 *     stripped the prefix, and unmatched /api/* paths returned index.html with
 *     a 200 because the SPA fallback caught them. Both looked healthy by status
 *     code alone. Both are caught by asserting CONTENT TYPE and BODY SHAPE.
 *   - Auth still guards what it guarded: /api/auth/me without a token is 401,
 *     and that 401 is JSON.
 *   - The QwkBrowser proxy forwards the FULL path (the bug above) and the
 *     identity bridge's shared secret is present, so sign-in can work.
 *
 * READ-ONLY BY DESIGN: it never mutates data and never needs credentials. A
 * smoke test that changes state cannot be run on a hunch, and the hunch is when
 * you need it most.
 *
 * Run:  node scripts/verify-v1-smoke.cjs      (server must be on PORT, default 3002)
 */

const BASE = process.env.BANQ_BASE || 'http://localhost:3002';

let pass = 0, fail = 0;
const failures = [];

function ok(name, condition, detail) {
  if (condition) { pass++; console.log('  PASS  ' + name); }
  else {
    fail++;
    failures.push(name + (detail ? ' :: ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? '  (' + detail + ')' : ''));
  }
}
function section(t) { console.log('\n' + t); }

async function get(path) {
  const res = await fetch(BASE + path, { redirect: 'manual' });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = null; }
  return {
    status: res.status,
    type: res.headers.get('content-type') || '',
    text: text,
    json: json,
    isHtml: /^\s*(<!DOCTYPE|<html)/i.test(text)
  };
}

const PAGES = [
  { path: '/', title: 'New Quanthoms' },
  { path: '/login.html', title: 'Sign In' },
  { path: '/packages.html', title: 'Package' },
  { path: '/billboards.html', title: 'Billboard' },
  { path: '/dashboard.html', title: 'Dashboard' },
  { path: '/about.html', title: 'About' },
  { path: '/monitor.html', title: 'Monitor' },
  { path: '/admin-console.html', title: 'Admin' }
];

const ASSETS = [
  '/css/styles.css',
  '/js/app.js',
  '/js/ad-catalog.js',
  '/js/ad-page.js',
  '/js/monitor.js'
];

async function main() {
  section('0. SERVER');
  let root;
  try {
    root = await get('/');
  } catch (e) {
    console.log('  FAIL  cannot reach ' + BASE + ' (' + e.message + ')');
    console.log('\n  Start it first:  node server.js');
    process.exit(1);
  }
  ok('server answers on ' + BASE, root.status === 200, 'status ' + root.status);

  section('1. PAGES (status AND that the body is really the page)');
  for (const page of PAGES) {
    const r = await get(page.path);
    ok(page.path + ' -> 200', r.status === 200, 'status ' + r.status);
    ok(page.path + ' serves HTML', r.isHtml, 'content-type ' + r.type);
    ok(page.path + ' contains "' + page.title + '"',
      r.text.indexOf(page.title) > -1, 'title text not found in body');
  }

  section('2. STATIC ASSETS');
  for (const a of ASSETS) {
    const r = await get(a);
    ok(a + ' -> 200', r.status === 200, 'status ' + r.status);
    // A missing asset served by the SPA fallback would be index.html with a
    // 200 -- the page would load, the styles or the namespace would simply not
    // exist, and the status code would say everything was fine.
    ok(a + ' is really that file, not the SPA fallback', !r.isHtml, 'got HTML');
  }

  section('3. API PATHS ANSWER AS AN API (the proxy / fallback traps)');
  const feed = await get('/api/ads/public?limit=1');
  ok('/api/ads/public -> 200', feed.status === 200, 'status ' + feed.status);
  ok('/api/ads/public is JSON', /application\/json/.test(feed.type), 'content-type ' + feed.type);
  ok('/api/ads/public is NOT the QwkBrowser homepage', !feed.isHtml);
  ok('/api/ads/public carries a banners array (this is the proxied QWK feed)',
    !!(feed.json && Array.isArray(feed.json.banners)),
    JSON.stringify(feed.json).slice(0, 120));

  const me = await get('/api/auth/me');
  ok('/api/auth/me without a token -> 401', me.status === 401, 'status ' + me.status);
  ok('and that 401 is JSON, not a page', /application\/json/.test(me.type), 'content-type ' + me.type);

  const typo = await get('/api/ads/this-endpoint-does-not-exist');
  ok('an unknown /api path -> 404 JSON', typo.status === 404 && !!typo.json, 'status ' + typo.status);
  ok('an unknown /api path is NEVER the homepage', !typo.isHtml,
    'the SPA fallback swallowed an API path');
  /* WHICH layer answers matters less than that it is an API answer. For a
   * proxied prefix (/api/ads/...) the 404 comes from QwkBrowser itself, which
   * is the more useful answer -- the upstream knows why. BANQ's own
   * app.all('/api/*') guard answers for the prefixes no router owns. The check
   * is therefore "a JSON error object", not "our exact wording", so it keeps
   * proving the property that matters without pinning the message. */
  ok('the 404 carries a JSON error object naming the path',
    !!(typo.json && typo.json.error && typo.json.path),
    JSON.stringify(typo.json).slice(0, 160));
  ok('the 404 is not the SPA fallback', !typo.isHtml);

  const postOnly = await get('/api/ads/click');
  ok('GET on a POST-only proxied route is a JSON 404, not HTML',
    !postOnly.isHtml && /application\/json/.test(postOnly.type),
    'status ' + postOnly.status + ' type ' + postOnly.type);

  const billboards = await get('/api/billboards/demand');
  ok('/api/billboards/demand -> JSON from the local router',
    /application\/json/.test(billboards.type), 'content-type ' + billboards.type);

  const profile = await get('/api/profile/me');
  ok('the /api/profile proxy forwards the FULL path (not a stripped one)',
    profile.status === 401 || profile.status === 200,
    'status ' + profile.status + ' (502 would mean the proxy target is wrong)');
  ok('the profile proxy answers JSON, never a web page', !profile.isHtml);

  section('4. SPA FALLBACK STILL WORKS FOR PAGES');
  const unknownPage = await get('/some-deep-link-that-is-not-a-file');
  ok('an unknown page route still serves the app shell',
    unknownPage.status === 200 && unknownPage.isHtml, 'status ' + unknownPage.status);

  section('5. CONFIGURATION THE SITE NEEDS TO BE HONEST');
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '.env');
  const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  ok('.env exists', envText.length > 0, 'expected ' + envPath);
  ok('.env carries BANQ_SSO_SECRET (QwkBrowser sign-in can work)',
    /^\s*BANQ_SSO_SECRET\s*=\s*\S+/m.test(envText),
    'without it every QwkBrowser sign-in is a 503');
  const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  ok('.env is loaded before the modules that read it',
    serverSrc.indexOf("require('./backend/load-env').load()") > -1);
  ok('the proxy is registered BEFORE express.json() (otherwise POSTs hang)',
    serverSrc.indexOf('app.use(createProxyMiddleware') < serverSrc.indexOf('app.use(express.json()'));

  section('6. DATABASE');
  const dbPath = path.join(__dirname, '..', 'data', 'banq.db');
  ok('the database file exists', fs.existsSync(dbPath));

  console.log('\n' + '='.repeat(66));
  console.log('  SMOKE RESULT:  ' + pass + ' PASS / ' + fail + ' FAIL');
  if (failures.length) {
    console.log('  FAILURES:');
    failures.forEach(function (f) { console.log('    - ' + f); });
  }
  console.log('='.repeat(66));

  /* process.exitCode, NOT process.exit().
   *
   * Calling process.exit() while undici is still tearing down a keep-alive
   * socket trips a libuv assertion on Windows --
   * "!(handle->flags & UV_HANDLE_CLOSING)" -- which ABORTS the process with
   * 0xC0000409. A suite that passed 55 of 55 checks then looks like a crash to
   * whatever ran it: verify-all.ps1 reported "FAIL -1073740791" for a run that
   * had printed 0 failures. Setting exitCode lets the event loop drain the
   * sockets and exit on its own, so the code a runner reads matches the result
   * the script printed. */
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch(function (e) {
  console.error('smoke crashed: ' + (e && e.stack ? e.stack : e));
  process.exitCode = 1;
});
