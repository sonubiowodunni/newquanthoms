/*
 * New Quanthoms Billboard Agency (BANQ)
 * www.newquanthoms.com -- Server
 *
 * Owns its own auth (backend/auth.js + backend/db.js).
 * Proxies /api/ads/* and /api/profile/* to QWK Browser backend (port 3001)
 * for banner data and reward earning (API partnership -- to be refined).
 */

// Load .env FIRST. Modules below read process.env at require time (the QWK API
// URL, the identity secret), so a later load would be a silent no-op. Real
// environment variables still win -- .env only fills gaps.
const env = require('./backend/load-env').load();

const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const { init } = require('./backend/db');
const { router: authRouter } = require('./backend/auth');
const { router: banqRouter } = require('./backend/banq');
const { router: billboardRouter } = require('./backend/billboards');
const { router: intelligenceRouter } = require('./backend/banq-intelligence');
const { router: earnRouter } = require('./backend/earn');
const schema = require('./backend/intelligence/schema');
const flags = require('./backend/flags');

const app = express();

// WHY Number() AND NOT ||: a port from the environment is a STRING, and
// app.listen() takes its named-pipe branch for a string argument. With PORT set
// to "0", `"0" || 3002` is truthy, so the server tried to listen on a pipe
// called "0" and never answered HTTP at all -- it logged that it was running
// while nothing was reachable. Number() makes "0" falsy, so it falls back to the
// real default, and "3002" still works.
const PORT = Number(process.env.PORT) || 3002;
const QWK_API_URL = process.env.QWK_API_URL || 'http://localhost:3001';

/* -- API proxy to QWK Browser backend (ads, profile, QAP) --
 *
 * ONE middleware with a pathFilter -- NOT three app.use('/api/x', proxy)
 * mounts. That was the shape here before and it was broken in a way no log
 * would show:
 *
 *   In http-proxy-middleware v3, a middleware mounted at a path has that path
 *   STRIPPED from req.url before the proxy runs. The old `pathRewrite`
 *   '^/api/ads' -> '/api/ads' was therefore rewriting a prefix that was no
 *   longer there, so a request for /api/ads/public reached QwkBrowser as
 *   /public?limit=1. QwkBrowser has no such route, its own SPA fallback
 *   answered with its homepage HTML -- and with a 200.
 *
 *   The feed then rendered "no banners" while every server log said 200 OK.
 *   The bug was invisible from both ends and only a live probe of the BODY
 *   (not the status code) caught it: 200, and the bytes were a web page.
 *
 * pathFilter matches on the FULL path and forwards it unchanged, which is the
 * documented v3 pattern and removes the prefix-stripping hazard entirely.
 *
 * ORDER IS LOAD-BEARING: this must be registered BEFORE express.json().
 * express.json() reads the request body to parse it, which consumes the
 * stream; a proxy registered after it then forwards the headers (including
 * Content-Length) with no body, and the upstream waits for bytes that never
 * arrive. That is exactly what happened to POST /api/ads/click -- a GET feed
 * worked, every POST hung, and no error was ever logged on either side.
 *
 * The error hook is deliberate: an unreachable QwkBrowser becomes an explicit
 * 502 with a reason, never a hang and never silent HTML.
 */
app.use(createProxyMiddleware({
  target: QWK_API_URL,
  changeOrigin: true,
  pathFilter: ['/api/ads', '/api/profile', '/api/ad-profile'],
  on: {
    error: function (err, req, res) {
      console.error('[BANQ] Proxy to QwkBrowser failed for ' + req.url + ': ' + err.message);
      if (res && !res.headersSent && typeof res.status === 'function') {
        res.status(502).json({
          error: 'qwk_unreachable',
          detail: 'QwkBrowser did not answer at ' + QWK_API_URL
        });
      }
    }
  }
}));

// -- Body parser (AFTER the proxy -- see the note above) --
app.use(express.json());

// -- Static files --
app.use(express.static(__dirname));

// -- Auth routes (local, NOT proxied) --
app.use('/api/auth', authRouter);

// -- /api/banq/* -- BANQ's own namespace (local, NOT proxied).
// Residents: the contact form (backend/banq.js) and the four-phase
// intelligence system (backend/banq-intelligence.js). Both mount at
// /api/banq because neither owns the prefix and their paths do not overlap.
app.use('/api/banq', banqRouter);
app.use('/api/banq', intelligenceRouter);

// -- Billboards (C2). Declarations give the demand table real data instead of
// placeholder rows. Mounted at /api/billboards.
app.use('/api/billboards', billboardRouter);

/* -- Earning (QWK-PARTNER-REWARD). The reward half of the SAME bridge that
 * carries sign-in: the browser asks us, we ask QwkBrowser's secret-guarded
 * partner door server-side, and we report the answer as it came. The page
 * cannot call QwkBrowser directly -- it has no QWK token and cannot hold the
 * qwk_csrf cookie -- which is exactly why the old "Click to Earn" button
 * could never pay. Mounted at /api/earn, local and never proxied. */
app.use('/api/earn', earnRouter);

/* -- Unknown /api/* is 404 JSON, never the homepage --
 *
 * The SPA fallback below serves index.html for anything unmatched. Without
 * this guard a typo or a retired endpoint (/api/ads/eligable) would answer with
 * a full web page and a 200, and the client would fail while parsing it -- the
 * same silent-HTML trap the proxy bug above created. An API namespace should
 * answer like an API.
 */
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'unknown_api_route', path: req.path });
});

// -- SPA fallback (serve index.html for unknown page routes) --
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// -- Start --
init()
  .then(function () {
    // Pre-Build (E0.2 + E0.3): the intelligence schema and the config seed.
    // Idempotent, so it runs on every boot and only fills gaps -- a value an
    // admin has changed is never reset by a restart.
    return schema.migrate();
  })
  .then(function (m) {
    console.log('[BANQ] Intelligence schema ready: ' + m.tables + ' tables, ' + m.config_keys + ' config keys');
    return flags.ensureTable();
  })
  .then(function () {
    app.listen(PORT, () => {
      console.log('[BANQ] New Quanthoms Billboard running on http://localhost:' + PORT);
      console.log('[BANQ] Local auth active (banqadmin seeded)' +
        (env.present ? ' + .env (' + env.loaded + ' keys loaded)' : ' (no .env)'));
      console.log('[BANQ] Proxying /api/ads/* and /api/profile/* to ' + QWK_API_URL);
      // Say plainly whether QwkBrowser sign-in can work, because a missing
      // secret turns every bridged login into a 503 and the log is the only
      // place that failure is visible before someone tries to sign in.
      console.log('[BANQ] QwkBrowser sign-in: ' + (process.env.BANQ_SSO_SECRET
        ? 'enabled (shared secret present)'
        : 'DISABLED -- BANQ_SSO_SECRET is not set, so only local accounts can sign in'));
    });
  })
  .catch((err) => {
    console.error('[BANQ] Failed to initialize:', err.message);
    process.exit(1);
  });
