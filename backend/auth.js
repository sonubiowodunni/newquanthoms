/*
 * New Quanthoms Billboard Agency (BANQ)
 * backend/auth.js -- Auth routes
 *
 * Two ways in, and the difference matters:
 *
 *   1. LOCAL account      -- a BANQ row with auth_source='local' (banqadmin).
 *                            Password checked with bcrypt against THIS database.
 *   2. QWK-BROWSER account -- BANQ's own pages have always promised "sign in
 *                            with your QwkBrowser account". That promise is now
 *                            kept: the password is verified by QwkBrowser
 *                            (backend/qwk-identity.js) and BANQ issues its OWN
 *                            session. The QWK token is never stored here.
 *
 * BANQ still owns its sessions: 32 random bytes, stored as SHA-256(token) in
 * sessions.token_hash, 7-day lifetime. Same security shape as before.
 *
 * ASCII-only (Rule 16). Secrets live in .env, never here.
 */

const express = require('express');
const router = express.Router();
const { db, tokenHash, bcrypt } = require('./db');
const qwkIdentity = require('./qwk-identity');

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// -- Session issuing (one path, two callers) --
function issueSession(userId) {
  var token = require('crypto').randomBytes(32).toString('hex');
  var expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();
  return db.execute({
    sql: 'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    args: [userId, tokenHash(token), expiresAt]
  }).then(function () {
    return { token: token, expires_at: expiresAt };
  });
}

// -- The one user shape the client receives --
function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    is_admin: !!row.is_admin,
    quanthom_unit: Number(row.quanthom_unit || 0),
    quanthom_credit: Number(row.quanthom_credit || 0),
    auth_source: row.auth_source || 'local',
    qwk_username: row.qwk_username || null,
    qwk_linked: !!row.qwk_user_id
  };
}

// -- Middleware: require auth --
function requireAuth(req, res, next) {
  var auth = req.headers.authorization || '';
  var token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  var hash = tokenHash(token);
  db.execute({
    sql: `SELECT s.user_id, s.expires_at, u.username, u.email, u.is_admin,
                 u.quanthom_unit, u.quanthom_credit, u.auth_source,
                 u.qwk_user_id, u.qwk_username
          FROM sessions s JOIN users u ON s.user_id = u.id
          WHERE s.token_hash = ?`,
    args: [hash]
  }).then(function (result) {
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
      quanthom_credit: row.quanthom_credit,
      auth_source: row.auth_source || 'local',
      qwk_user_id: row.qwk_user_id || null,
      qwk_username: row.qwk_username || null
    };
    next();
  }).catch(function (err) {
    console.error('[BANQ auth] Error:', err.message);
    res.status(500).json({ error: 'Auth error' });
  });
}

/* -- The bridge, in one place -------------------------------------------
 *
 * Verify with QwkBrowser, mirror the identity locally, sync its balances,
 * issue a BANQ session. Every caller of the bridge goes through this so the
 * behaviour cannot drift between the typed form and a handoff token.
 */
function signInWithQwk(qwkUser) {
  return qwkIdentity.upsertMirrorUser(qwkUser).then(function (mirror) {
    if (!mirror.ok) {
      return { ok: false, reason: mirror.reason };
    }
    return issueSession(mirror.user.id).then(function (session) {
      /* The mirror row is the source of the balances in the response, not the
       * payload: on the handoff path the payload carries no balances at all,
       * and echoing an absent value as 0 would tell a funded user their balance
       * is empty. The mirror row already knows. */
      return {
        ok: true,
        created: !!mirror.created,
        token: session.token,
        user: publicUser(Object.assign({}, mirror.user, {
          auth_source: 'qwk',
          qwk_user_id: mirror.user.qwk_user_id,
          qwk_username: mirror.user.qwk_username || qwkUser.username
        }))
      };
    });
  });
}

/* Failure -> HTTP, in one place, so the reason a login failed is never
 * flattened into a generic "Login failed" that hides a server problem. */
function bridgeFailure(res, reason, detail) {
  if (reason === 'invalid_credentials') {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (reason === 'guest_accounts_cannot_sso') {
    return res.status(403).json({
      error: 'Guest QwkBrowser accounts cannot sign in here. Create a full account on QwkBrowser first.'
    });
  }
  if (reason === 'bad_username') {
    return res.status(400).json({ error: 'That QwkBrowser username cannot be used on this site.' });
  }
  if (reason === 'email_taken_by_local_account') {
    return res.status(409).json({
      error: 'That email belongs to a local BANQ account. Contact BANQ to link them.'
    });
  }
  if (reason === 'sso_not_configured') {
    return res.status(503).json({
      error: 'QwkBrowser sign-in is not configured on this server (BANQ_SSO_SECRET is missing).'
    });
  }
  if (reason === 'rate_limited') {
    return res.status(429).json({
      error: 'Too many sign-in attempts right now. Wait a few minutes and try again.',
      retry_after_seconds: (detail && detail.retry_after_seconds) || null
    });
  }
  if (reason === 'bad_request') {
    return res.status(400).json({
      error: 'That username or password could not be checked. Enter both and try again.'
    });
  }
  if (reason === 'identity_error') {
    return res.status(502).json({
      error: 'QwkBrowser could not answer the sign-in check. This is a fault on our side, not your password.'
    });
  }
  // identity_unreachable and anything unexpected: say so, do NOT claim the
  // password was wrong. A correct password reported as invalid is a lie.
  return res.status(503).json({
    error: 'QwkBrowser identity service is unreachable. Try again in a moment.'
  });
}

// -- POST /api/auth/login --
// Local account first, then the QwkBrowser bridge.
router.post('/login', function (req, res) {
  var username = (req.body.username || '').trim();
  var password = req.body.password || '';
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  db.execute({
    sql: `SELECT * FROM users WHERE username = ?`,
    args: [username]
  }).then(function (result) {
    var localUser = result.rows[0];

    /* A mirror row is never logged into locally -- its password column holds a
     * random unusable hash on purpose. Fall through to the bridge, which is the
     * only authority for a linked identity. */
    var canTryLocal = !!localUser && (localUser.auth_source || 'local') !== 'qwk';

    if (canTryLocal) {
      return bcrypt.compare(password, localUser.password_hash).then(function (match) {
        if (match) {
          return issueSession(localUser.id).then(function (session) {
            return res.json({
              success: true,
              token: session.token,
              user: publicUser(localUser)
            });
          });
        }
        /* A local account owns this username, so no bridge fallback: linking a
         * QWK identity by username collision would hand someone else's account
         * over on the strength of a matching name. */
        return res.status(401).json({ error: 'Invalid credentials' });
      });
    }

    // No local account (or a mirror): ask QwkBrowser.
    return qwkIdentity.verifyCredentials(username, password).then(function (bridged) {
      if (!bridged.ok) {
        return bridgeFailure(res, bridged.reason, bridged);
      }
      return signInWithQwk(bridged.user).then(function (out) {
        if (!out.ok) return bridgeFailure(res, out.reason);
        return res.json({
          success: true,
          token: out.token,
          created: out.created,
          user: out.user
        });
      });
    });
  }).catch(function (err) {
    console.error('[BANQ auth] Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  });
});

/* -- POST /api/auth/sso -- signed handoff from QwkBrowser --
 *
 * Body: { token: "<base64url(payload)>.<hex hmac>" }
 * qwkbrowser issues these (POST /api/auth/sso/handoff) signed with the shared
 * secret. BANQ verifies the signature and freshness here, with no network call,
 * so this path keeps working when the QWK server is down -- that is the point
 * of a signed handoff.
 *
 * The handoff proves IDENTITY only: it carries no balances. A linked mirror
 * therefore keeps the balances from its last verified sign-in rather than
 * having them zeroed by a login that simply did not mention them.
 */
router.post('/sso', function (req, res) {
  var token = req.body && req.body.token;
  var verified = qwkIdentity.verifyHandoffToken(token);
  if (!verified.ok) {
    console.warn('[BANQ auth] SSO rejected: ' + verified.reason);
    return res.status(401).json({ error: 'sso_rejected', reason: verified.reason });
  }

  var payload = verified.payload;
  signInWithQwk({
    id: payload.i === undefined ? null : payload.i,
    username: payload.u,
    display_name: payload.n,
    // Balances are unknown on this path: undefined means "keep what is stored".
    quanthom_unit: undefined,
    quanthom_credit: undefined
  }).then(function (out) {
    if (!out.ok) return bridgeFailure(res, out.reason);
    res.json({ success: true, token: out.token, created: out.created, user: out.user });
  }).catch(function (err) {
    console.error('[BANQ auth] SSO error:', err.message);
    res.status(500).json({ error: 'sso_failed' });
  });
});

// -- GET /api/auth/me --
router.get('/me', requireAuth, function (req, res) {
  res.json({
    user: publicUser({
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      is_admin: req.user.is_admin,
      quanthom_unit: req.user.quanthom_unit,
      quanthom_credit: req.user.quanthom_credit,
      auth_source: req.user.auth_source,
      qwk_user_id: req.user.qwk_user_id,
      qwk_username: req.user.qwk_username
    })
  });
});

// -- POST /api/auth/logout --
router.post('/logout', requireAuth, function (req, res) {
  var auth = req.headers.authorization || '';
  var token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  var hash = tokenHash(token);
  db.execute({
    sql: 'DELETE FROM sessions WHERE token_hash = ?',
    args: [hash]
  }).then(function () {
    res.json({ success: true });
  }).catch(function () {
    res.status(500).json({ error: 'Logout failed' });
  });
});

module.exports = { router, requireAuth };
