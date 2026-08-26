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

const app = express();
const PORT = process.env.PORT || 3002;
const QWK_API_URL = process.env.QWK_API_URL || 'http://localhost:3001';

// -- Body parser --
app.use(express.json());

// -- Static files --
app.use(express.static(__dirname));

// -- Auth routes (local, NOT proxied) --
app.use('/api/auth', authRouter);

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
