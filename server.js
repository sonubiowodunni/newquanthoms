/*
 * New Quanthoms Billboard Agency (BANQ)
 * www.newquanthoms.com -- Server
 *
 * Serves static files + proxies /api/* to QWK Browser backend (port 3001)
 * Content is public (blog-style). Auth required only for earning rewards.
 */

const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3002;
const QWK_API_URL = process.env.QWK_API_URL || 'http://localhost:3001';

// -- Static files --
app.use(express.static(__dirname));

// -- API proxy to QWK Browser backend --
app.use('/api', createProxyMiddleware({
  target: QWK_API_URL,
  changeOrigin: true,
  pathRewrite: { '^/api': '/api' }
}));

// -- SPA fallback (serve index.html for unknown routes) --
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('[BANQ] New Quanthoms Billboard running on http://localhost:' + PORT);
  console.log('[BANQ] Proxying /api/* to ' + QWK_API_URL);
});
