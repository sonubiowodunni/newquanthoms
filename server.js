/*
 * New Quanthoms Billboard Agency (BANQ)
 * www.newquanthoms.com -- Server
 *
 * Owns its own auth (backend/auth.js + backend/db.js).
 * Proxies /api/ads/* and /api/profile/* to QWK Browser backend (port 3001)
 * for banner data and reward earning (API partnership -- to be refined).
 */

const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const { init } = require('./backend/db');
const { router: authRouter } = require('./backend/auth');
const { router: banqRouter } = require('./backend/banq');

const app = express();
const PORT = process.env.PORT || 3002;
const QWK_API_URL = process.env.QWK_API_URL || 'http://localhost:3001';

// -- Body parser --
app.use(express.json());

// -- Static files --
app.use(express.static(__dirname));

// -- Auth routes (local, NOT proxied) --
app.use('/api/auth', authRouter);

// -- /api/banq/* -- BANQ's own namespace (local, NOT proxied).
// First resident: the contact form. See backend/banq.js.
app.use('/api/banq', banqRouter);

// -- API proxy to QWK Browser backend (ads, profile, rewards) --
// Only /api/ads/* and /api/profile/* are proxied. Auth is local.
app.use('/api/ads', createProxyMiddleware({
  target: QWK_API_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/ads': '/api/ads' }
}));
app.use('/api/profile', createProxyMiddleware({
  target: QWK_API_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/profile': '/api/profile' }
}));

// -- QAP read-through (BANQ-021) --
// A QAP number identifies an advertising profile issued by QwkBrowser. The
// partner-facing lookup is public on the QWK side and lives at
// GET /api/ad-profile/<QAP> (no /qap/ segment). Without this the launch flow
// could only check the shape of a QAP, never whether it exists.
app.use('/api/ad-profile', createProxyMiddleware({
  target: QWK_API_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/ad-profile': '/api/ad-profile' }
}));

// -- SPA fallback (serve index.html for unknown routes) --
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// -- Start --
init().then(() => {
  app.listen(PORT, () => {
    console.log('[BANQ] New Quanthoms Billboard running on http://localhost:' + PORT);
    console.log('[BANQ] Local auth active (banqadmin seeded)');
    console.log('[BANQ] Proxying /api/ads/* and /api/profile/* to ' + QWK_API_URL);
  });
}).catch((err) => {
  console.error('[BANQ] Failed to initialize database:', err.message);
  process.exit(1);
});
