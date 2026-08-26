/*
 * New Quanthoms Billboard Agency (BANQ)
 * backend/auth.js -- Auth routes (local, independent of qwkbrowser)
 *
 * Token-based auth using UUIDv4 tokens stored as SHA-256(token) in sessions.
 * Same security pattern as qwkbrowser but completely separate database.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db, tokenHash, bcrypt } = require('./db');

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// -- Middleware: require auth --
function requireAuth(req, res, next) {
  var auth = req.headers.authorization || '';
  var token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  var hash = tokenHash(token);
  db.execute({
    sql: `SELECT s.user_id, s.expires_at, u.username, u.email, u.is_admin, u.quanthom_unit, u.quanthom_credit
          FROM sessions s JOIN users u ON s.user_id = u.id
          WHERE s.token_hash = ?`,
    args: [hash]
  }).then(function(result) {
    var row = result.rows[0];
    if (!row) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }
    req.user = {
      id: row.user_id,
      username: row.username,
      email: row.email,
      is_admin: !!row.is_admin,
      quanthom_unit: row.quanthom_unit,
      quanthom_credit: row.quanthom_credit
    };
    next();
  }).catch(function(err) {
    console.error('[BANQ auth] Error:', err.message);
    res.status(500).json({ error: 'Auth error' });
  });
}

// -- POST /api/auth/login --
router.post('/login', function(req, res) {
  var username = (req.body.username || '').trim();
  var password = req.body.password || '';
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  db.execute({
    sql: `SELECT id, username, email, password_hash, is_admin, quanthom_unit, quanthom_credit
          FROM users WHERE username = ?`,
    args: [username]
  }).then(function(result) {
    var user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return bcrypt.compare(password, user.password_hash).then(function(match) {
      if (!match) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      // Create session
      var token = uuidv4();
      var hash = tokenHash(token);
      var expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();
      return db.execute({
        sql: `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
        args: [user.id, hash, expiresAt]
      }).then(function() {
        res.json({
          success: true,
          token: token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            is_admin: !!user.is_admin,
            quanthom_unit: user.quanthom_unit,
            quanthom_credit: user.quanthom_credit
          }
        });
      });
    });
  }).catch(function(err) {
    console.error('[BANQ auth] Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  });
});

// -- GET /api/auth/me --
router.get('/me', requireAuth, function(req, res) {
  res.json({
    user: req.user
  });
});

// -- POST /api/auth/logout --
router.post('/logout', requireAuth, function(req, res) {
  var auth = req.headers.authorization || '';
  var token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  var hash = tokenHash(token);
  db.execute({
    sql: `DELETE FROM sessions WHERE token_hash = ?`,
    args: [hash]
  }).then(function() {
    res.json({ success: true });
  }).catch(function() {
    res.status(500).json({ error: 'Logout failed' });
  });
});

module.exports = { router, requireAuth };
