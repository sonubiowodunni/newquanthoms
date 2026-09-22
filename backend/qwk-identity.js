/*
 * New Quanthoms Billboard Agency (BANQ)
 * backend/qwk-identity.js -- the QwkBrowser identity bridge (BANQ-022)
 *
 * THE PROBLEM THIS SOLVES
 *
 * BANQ's own copy says "sign in with your QwkBrowser account", and the
 * audience has one. But backend/auth.js only ever compared against BANQ's own
 * users table, which contains banqadmin and nobody else -- so a real
 * QwkBrowser account came back "Invalid credentials". The page promised an
 * account it could not accept.
 *
 * THE MODEL (matches Quanthom Mails, the sibling wing)
 *
 *   QwkBrowser is the identity authority. BANQ keeps its OWN sessions table
 *   and issues its OWN token -- the QWK token is never stored here -- but the
 *   password question is answered by QwkBrowser, twice over:
 *
 *   1. SIGNED HANDOFF (primary, what the ecosystem already uses)
 *      qwkbrowser POST /api/auth/sso/handoff -> base64url(json).hmacHex
 *      signed with the shared secret QWK_SSO_SECRET == BANQ_SSO_SECRET.
 *      BANQ verifies the signature and freshness itself: no network call, and
 *      it works even while the QWK server is down.
 *
 *   2. CREDENTIAL VERIFICATION (fallback for the typed form)
 *      A person typing a username and password on BANQ's login page has no
 *      handoff token. BANQ asks QwkBrowser server-to-server
 *      (POST /api/auth/verify-credentials, guarded by the shared secret).
 *      QwkBrowser returns the public identity and NO session -- so a partner
 *      login never leaves a QWK session row behind.
 *
 * WHAT A MIRROR ROW IS
 *
 * The first successful bridge creates a local users row with auth_source='qwk'
 * and the QWK identity linked. It exists so BANQ's own tables (sessions,
 * rewards, declarations) have a local user_id to point at. It is a mirror, not
 * a second account: the password column holds a random unusable hash, so a
 * mirror row can never be logged into locally.
 *
 * ASCII-only. No secrets in this file.
 */

const crypto = require('crypto');
const { db, bcrypt } = require('./db');

const QWK_API_URL = process.env.QWK_API_URL || 'http://localhost:3001';
const HANDSOFF_MAX_AGE_MS = 5 * 60 * 1000;   // replay window
const QWK_TIMEOUT_MS = 5000;                 // a hung identity provider must not hang login

/* -- Shared secret --------------------------------------------------------- */

/* Fail-closed: with no secret configured, BANQ verifies nobody and says why,
 * rather than quietly accepting credentials it cannot actually check. */
function ssoSecret() {
  const s = process.env.BANQ_SSO_SECRET || '';
  return s ? String(s) : null;
}

function hmacHex(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/* -- 1. Signed handoff token ---------------------------------------------- */

/*
 * Token format: base64url(JSON payload) + "." + hex HMAC-SHA256.
 * Payload: { u: username, n: display_name, i: qwk_user_id, ts, exp }
 *
 * Returns { ok: true, payload } or { ok: false, reason } -- never throws,
 * because every caller is a request handler that must answer honestly.
 */
function verifyHandoffToken(token) {
  const secret = ssoSecret();
  if (!secret) return { ok: false, reason: 'sso_not_configured' };

  const parts = String(token || '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'bad_format' };
  const body = parts[0];
  const sig = parts[1];

  const expected = hmacHex(body, secret);
  if (sig.length !== expected.length) return { ok: false, reason: 'bad_signature' };
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return { ok: false, reason: 'bad_signature' };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (e) {
    return { ok: false, reason: 'bad_payload' };
  }

  if (!payload || !payload.u) return { ok: false, reason: 'no_username' };
  const now = Date.now();
  if (payload.exp && Number(payload.exp) < now) return { ok: false, reason: 'expired' };
  if (payload.ts && now - Number(payload.ts) > HANDSOFF_MAX_AGE_MS) return { ok: false, reason: 'stale' };
  if (payload.ts && Number(payload.ts) - now > HANDSOFF_MAX_AGE_MS) return { ok: false, reason: 'clock_skew' };

  return { ok: true, payload: payload };
}

/* Issue a handoff token. Used by the verify script and by local development;
 * production issuance belongs to qwkbrowser (POST /api/auth/sso/handoff). */
function issueHandoffToken(user, ttlMs) {
  const secret = ssoSecret();
  if (!secret) return null;
  const now = Date.now();
  const payload = {
    u: user.username,
    n: user.display_name || user.username,
    i: user.qwk_user_id || user.id || null,
    ts: now,
    exp: now + (ttlMs || HANDSOFF_MAX_AGE_MS)
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + hmacHex(body, secret);
}

/* -- 2. Credential verification against QwkBrowser ------------------------ */

/*
 * Server-to-server. Returns:
 *   { ok: true,  user }                                  credentials are valid
 *   { ok: false, reason: 'invalid_credentials' }         QWK said no
 *   { ok: false, reason: 'sso_not_configured' }          no shared secret
 *   { ok: false, reason: 'rate_limited' }                QWK throttled the call
 *   { ok: false, reason: 'identity_error' }              QWK answered 5xx
 *   { ok: false, reason: 'identity_unreachable' }        QWK did not answer
 *
 * EVERY non-success reason is distinct on purpose. Telling someone with a
 * correct password that their password is wrong is a lie the page must not
 * tell; and reporting a throttle as "unreachable" is a second, subtler lie --
 * it sends an operator to look for a crashed service that is running fine.
 *
 * The 429 branch was added because a live verification run hit it: a burst of
 * sign-ins exhausted the shared login limiter and every subsequent check was
 * reported as an outage. A wrong diagnosis costs more than a wrong answer.
 */
async function verifyCredentials(identifier, password) {
  const secret = ssoSecret();
  if (!secret) return { ok: false, reason: 'sso_not_configured' };

  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, QWK_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(QWK_API_URL + '/api/auth/verify-credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-QWK-SSO-Secret': secret
      },
      body: JSON.stringify({ username: identifier, password: password }),
      signal: controller.signal
    });
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, reason: 'identity_unreachable', detail: e.message };
  }
  clearTimeout(timer);

  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }

  if (res.status === 200 && data && data.user) return { ok: true, user: data.user };
  if (res.status === 401) return { ok: false, reason: 'invalid_credentials' };
  if (res.status === 403 && data && data.error === 'guest_accounts_cannot_sso') {
    return { ok: false, reason: 'guest_accounts_cannot_sso' };
  }
  if (res.status === 429) {
    const retry = Number(res.headers.get('retry-after') || 0);
    return { ok: false, reason: 'rate_limited', retry_after_seconds: retry || null };
  }
  // Our own caller is misconfigured or unauthenticated: that is not the
  // person's fault either, and it is not an outage.
  if (res.status === 400) return { ok: false, reason: 'bad_request' };
  if (res.status === 503) return { ok: false, reason: 'sso_not_configured' };
  if (res.status >= 500) return { ok: false, reason: 'identity_error', detail: 'status ' + res.status };
  return { ok: false, reason: 'identity_unreachable', detail: 'status ' + res.status };
}

/* -- Local mirror provisioning -------------------------------------------- */

const MIRROR_USERNAME_RE = /^[a-z0-9_.-]{2,40}$/i;

/* A mirror row must never be reachable by the local password path. Storing a
 * bcrypt hash of 48 random bytes means every local compare fails while the
 * column still holds a real hash (so bcrypt.compare never chokes on junk). */
function unusablePasswordHash() {
  return bcrypt.hashSync(crypto.randomBytes(48).toString('hex'), 10);
}

function readUser(id) {
  return db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] })
    .then(function (r) { return r.rows[0] || null; });
}

/* A missing balance means "this path did not mention it", NOT "zero it".
 * Both the credential path (which knows the balances) and the handoff path
 * (which does not) reach this function; conflating the two would let a
 * signature-only login wipe a real balance on the way in. */
function isNumber(v) {
  return v !== undefined && v !== null && v !== '' && !isNaN(Number(v));
}

/*
 * Create or update the local mirror of a QwkBrowser identity.
 * Returns the local user row (id, username, quanthom_unit, quanthom_credit).
 *
 * Lookup order matters: qwk_user_id first (a rename on the QWK side keeps the
 * link), then qwk_username (the row exists but was created before ids were
 * stored), then username (a mirror created by an earlier build).
 */
async function upsertMirrorUser(qwkUser) {
  const username = String(qwkUser.username || '').trim();
  if (!MIRROR_USERNAME_RE.test(username)) {
    return { ok: false, reason: 'bad_username' };
  }
  const id = (qwkUser.id === undefined || qwkUser.id === null) ? null : Number(qwkUser.id);
  const hasUnit = isNumber(qwkUser.quanthom_unit);
  const hasCredit = isNumber(qwkUser.quanthom_credit);
  const nowIso = new Date().toISOString();

  let row = null;
  if (id !== null) {
    row = (await db.execute({
      sql: 'SELECT * FROM users WHERE qwk_user_id = ?',
      args: [id]
    })).rows[0] || null;
  }
  if (!row) {
    row = (await db.execute({
      sql: 'SELECT * FROM users WHERE qwk_username = ? AND auth_source = ?',
      args: [username, 'qwk']
    })).rows[0] || null;
  }

  if (row) {
    await db.execute({
      sql: `UPDATE users SET qwk_user_id = ?, qwk_username = ?, last_sso_at = ?,
              quanthom_unit = ?, quanthom_credit = ?
            WHERE id = ?`,
      args: [
        id,
        username,
        nowIso,
        hasUnit ? Number(qwkUser.quanthom_unit) : Number(row.quanthom_unit || 0),
        hasCredit ? Number(qwkUser.quanthom_credit) : Number(row.quanthom_credit || 0),
        row.id
      ]
    });
    console.log('[BANQ] Identity: reused mirror for ' + username + ' (local user ' + row.id + ')');
    return { ok: true, user: await readUser(row.id), created: false };
  }

  // Email is UNIQUE NOT NULL in this schema. A QWK account may have no email
  // exposed; derive a deterministic placeholder from the username so the
  // constraint holds without inventing a deliverable-looking address.
  const email = String(qwkUser.email || (username + '@qwk.local')).trim();

  const existingEmail = (await db.execute({
    sql: 'SELECT id, auth_source, quanthom_unit, quanthom_credit FROM users WHERE email = ?',
    args: [email]
  })).rows[0] || null;

  if (existingEmail) {
    // A local account already owns that address. If it is a local-only
    // account, refuse: linking it would let a QWK identity take over a BANQ
    // account by username collision.
    if (existingEmail.auth_source !== 'qwk') {
      return { ok: false, reason: 'email_taken_by_local_account' };
    }
    await db.execute({
      sql: `UPDATE users SET qwk_user_id = ?, qwk_username = ?, last_sso_at = ?,
              quanthom_unit = ?, quanthom_credit = ?
            WHERE id = ?`,
      args: [
        id,
        username,
        nowIso,
        hasUnit ? Number(qwkUser.quanthom_unit) : Number(existingEmail.quanthom_unit || 0),
        hasCredit ? Number(qwkUser.quanthom_credit) : Number(existingEmail.quanthom_credit || 0),
        existingEmail.id
      ]
    });
    console.log('[BANQ] Identity: linked existing mirror by email for ' + username + ' (local user ' + existingEmail.id + ')');
    return { ok: true, user: await readUser(existingEmail.id), created: false };
  }

  const info = await db.execute({
    sql: `INSERT INTO users
            (username, email, password_hash, auth_source, qwk_user_id, qwk_username,
             last_sso_at, quanthom_unit, quanthom_credit)
          VALUES (?, ?, ?, 'qwk', ?, ?, ?, ?, ?)`,
    args: [
      username,
      email,
      unusablePasswordHash(),
      id,
      username,
      nowIso,
      hasUnit ? Number(qwkUser.quanthom_unit) : 0,
      hasCredit ? Number(qwkUser.quanthom_credit) : 0
    ]
  });

  const created = await readUser(Number(info.lastInsertRowid));

  console.log('[BANQ] Identity: created mirror for ' + username + ' (local user ' + created.id + ')');
  return { ok: true, user: created, created: true };
}

/* Session issuing deliberately lives in ONE place -- backend/auth.js -- so the
 * local path and the bridged path cannot drift apart on token lifetime, token
 * strength or hashing. This module never mints a session. */

module.exports = {
  ssoSecret: ssoSecret,
  verifyHandoffToken: verifyHandoffToken,
  issueHandoffToken: issueHandoffToken,
  verifyCredentials: verifyCredentials,
  upsertMirrorUser: upsertMirrorUser,
  QWK_API_URL: QWK_API_URL
};
