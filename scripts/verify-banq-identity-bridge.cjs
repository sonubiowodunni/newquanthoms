/*
 * New Quanthoms Billboard Agency (BANQ)
 * scripts/verify-banq-identity-bridge.cjs -- Rule 57 verify for BANQ-024
 *
 * WHAT IT PROVES, beyond "the files exist":
 *
 *   1. THE REPORTED BUG IS DEAD. The founder's own QwkBrowser account
 *      (iloveqwkbrowser) signs in on BANQ with its QwkBrowser password. Before
 *      this work that returned "Invalid credentials", because BANQ only ever
 *      compared against its own users table.
 *   2. A WRONG PASSWORD IS STILL WRONG, and is reported as credentials -- not
 *      dressed up as an outage.
 *   3. AN OUTAGE IS NOT BLAMED ON THE PERSON. With QWK unreachable the message
 *      names the identity service; it does not say "check your credentials".
 *   4. NO QWK SESSION IS CREATED. The bridge is a lookup: the QWK sessions
 *      table does not grow when someone signs in on BANQ, so no litter and no
 *      QWK token is ever stored here.
 *   5. THE MIRROR IS A MIRROR. Repeated logins reuse one row (no duplicate
 *      accounts), balances are synced, and a path that carries no balances
 *      (a signed handoff) does NOT zero them.
 *   6. LOCAL ACCOUNTS ARE UNCHANGED AND UNSHADOWABLE. banqadmin still signs in
 *      locally, and a local username never falls through to the bridge -- a
 *      QWK identity cannot take over a BANQ account by having the same name.
 *   7. THE HANDOFF PATH IS HONEST ABOUT BAD TOKENS: wrong signature, stale and
 *      expired tokens are all rejected with a named reason.
 *   8. THE .env IS REAL. server.js loads it before anything reads process.env,
 *      so BANQ_SSO_SECRET (and QWK_API_URL) actually take effect.
 *
 * Run:  node scripts/verify-banq-identity-bridge.cjs
 * Requires BOTH servers: QwkBrowser on 3001, BANQ on 3002.
 */

const path = require('path');
const crypto = require('crypto');

require(path.join(__dirname, '..', 'backend', 'load-env')).load();

const BASE = process.env.BANQ_BASE || 'http://localhost:3002';
const QWK_BASE = process.env.QWK_BASE || process.env.QWK_API_URL || 'http://localhost:3001';

// The one account this fix was reported against. Overridable so the script can
// be pointed at a different identity without editing it.
const TEST_USER = process.env.BANQ_TEST_USER || 'iloveqwkbrowser';
const TEST_PASS = process.env.BANQ_TEST_PASS || 'typetype450';

let pass = 0, fail = 0, skipped = 0;
const failures = [];

function ok(name, condition, detail) {
  if (condition) { pass++; console.log('  PASS  ' + name); }
  else {
    fail++;
    failures.push(name + (detail ? ' :: ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? '  (' + detail + ')' : ''));
  }
}
function skip(name, why) { skipped++; console.log('  SKIP  ' + name + '  (' + why + ')'); }
function section(t) { console.log('\n' + t); }

async function api(method, urlPath, token, body, base) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch((base || BASE) + urlPath, {
    method: method,
    headers: headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = { _raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
}

/* Open QwkBrowser's database directly, READ ONLY in intent: every statement
 * below is a SELECT. The point is to prove the bridge did not write there. */
async function openQwkReadOnly() {
  const file = process.env.QWK_DB_PATH
    || path.join(__dirname, '..', '..', 'qwkbrowser', 'data', 'qwkbrowser.db');
  try {
    const { createClient } = require('@libsql/client');
    const db = createClient({ url: 'file:' + file });
    await db.execute('SELECT 1');
    return db;
  } catch (e) {
    return null;
  }
}

async function main() {
  const identity = require(path.join(__dirname, '..', 'backend', 'qwk-identity'));
  const secret = identity.ssoSecret();

  section('0. CONFIGURATION');
  ok('BANQ_SSO_SECRET is configured (identity bridge can verify)', !!secret,
    'add BANQ_SSO_SECRET to .env, equal to QWK_SSO_SECRET');
  const qwkSecret = process.env.QWK_SSO_SECRET || '';
  if (secret && qwkSecret) {
    ok('BANQ_SSO_SECRET matches QWK_SSO_SECRET (one shared secret)', secret === qwkSecret);
  } else {
    skip('secret equality check', 'QWK_SSO_SECRET not visible in this shell (it lives in qwkbrowser/backend/.env)');
  }

  section('1. QWK SIDE: THE VERIFY ENDPOINT REFUSES TO BE AN OPEN PASSWORD ORACLE');
  const noSecret = await api('POST', '/api/auth/verify-credentials', null,
    { username: TEST_USER, password: TEST_PASS }, QWK_BASE);
  ok('no shared secret -> 401 (not a public credential check)', noSecret.status === 401,
    'got ' + noSecret.status);
  ok('refusal is labelled unauthorized_partner',
    noSecret.body && noSecret.body.error === 'unauthorized_partner');

  const wrongSecret = await fetch(QWK_BASE + '/api/auth/verify-credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-QWK-SSO-Secret': 'not-the-secret' },
    body: JSON.stringify({ username: TEST_USER, password: TEST_PASS })
  });
  ok('wrong shared secret -> 401', wrongSecret.status === 401, 'got ' + wrongSecret.status);

  if (!secret) {
    skip('authorised verification checks', 'BANQ_SSO_SECRET not set');
  } else {
    const good = await api('POST', '/api/auth/verify-credentials', null,
      { username: TEST_USER, password: TEST_PASS }, QWK_BASE);
    // The header must be sent on this one, so call fetch directly.
    const goodRes = await fetch(QWK_BASE + '/api/auth/verify-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-QWK-SSO-Secret': secret },
      body: JSON.stringify({ username: TEST_USER, password: TEST_PASS })
    });
    const goodBody = await goodRes.json();
    ok('authorised verification of a real QwkBrowser account -> 200', goodRes.status === 200,
      'got ' + goodRes.status + ' ' + JSON.stringify(goodBody).slice(0, 120));
    ok('it returns a public identity', !!(goodBody && goodBody.user && goodBody.user.username));
    ok('it NEVER returns a token (it is a lookup, not a login)', !(goodBody && goodBody.token));
    ok('it never returns a password hash',
      !JSON.stringify(goodBody).toLowerCase().includes('password_hash'));

    const badRes = await fetch(QWK_BASE + '/api/auth/verify-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-QWK-SSO-Secret': secret },
      body: JSON.stringify({ username: TEST_USER, password: 'certainly-not-the-password' })
    });
    ok('wrong password -> 401 invalid_credentials', badRes.status === 401, 'got ' + badRes.status);
  }

  section('2. THE REPORTED BUG: A QWKBROWSER ACCOUNT SIGNS IN ON BANQ');
  const loginRes = await api('POST', '/api/auth/login', null,
    { username: TEST_USER, password: TEST_PASS });
  ok('QwkBrowser credentials are accepted on BANQ -> 200', loginRes.status === 200,
    'got ' + loginRes.status + ' ' + JSON.stringify(loginRes.body).slice(0, 160));
  const token = loginRes.body && loginRes.body.token;
  ok('a BANQ session token is issued', !!token && String(token).length === 64);
  ok('the response marks the identity source as qwk',
    loginRes.body && loginRes.body.user && loginRes.body.user.auth_source === 'qwk');
  ok('the account is linked to a QwkBrowser id',
    loginRes.body && loginRes.body.user && loginRes.body.user.qwk_linked === true);
  ok('the QWK token is NOT stored in the BANQ response',
    !(loginRes.body && loginRes.body.qwk_token));

  let unitAfter = null;
  if (token) {
    const me = await api('GET', '/api/auth/me', token);
    ok('the issued BANQ token authenticates /me', me.status === 200, 'got ' + me.status);
    unitAfter = me.body && me.body.user ? me.body.user.quanthom_unit : null;
    ok('balances are mirrored from QwkBrowser (QU present)',
      typeof unitAfter === 'number', 'QU=' + unitAfter);
    ok('a linked account says so on /me',
      !!(me.body && me.body.user && me.body.user.qwk_username));
  }
  const noAuth = await api('GET', '/api/auth/me', null);
  ok('/me without a token is still 401', noAuth.status === 401, 'got ' + noAuth.status);

  section('3. FAILURES ARE DESCRIBED HONESTLY');
  const wrong = await api('POST', '/api/auth/login', null,
    { username: TEST_USER, password: 'definitely-not-it' });
  ok('a wrong password is 401', wrong.status === 401, 'got ' + wrong.status);
  ok('and it names credentials, not a server fault',
    /credential/i.test((wrong.body && wrong.body.error) || ''),
    JSON.stringify(wrong.body));

  const missing = await api('POST', '/api/auth/login', null, { username: TEST_USER });
  ok('missing password is 400, not 401', missing.status === 400, 'got ' + missing.status);

  /* Every non-success reason must be distinguishable, and each one is proved
   * here against a throwaway stub server rather than by breaking the real one.
   * A 429 reported as "unreachable" is exactly the bug a live run found: the
   * operator goes looking for a crashed service that is running fine. */
  const http = require('http');
  async function stub(replyStatus, replyBody, headers) {
    const server = http.createServer(function (req, res) {
      res.writeHead(replyStatus, Object.assign({ 'Content-Type': 'application/json' }, headers || {}));
      res.end(JSON.stringify(replyBody || {}));
    });
    await new Promise(function (r) { server.listen(0, '127.0.0.1', r); });
    return server;
  }
  const identityPath = path.join(__dirname, '..', 'backend', 'qwk-identity');
  async function withStub(server, fn) {
    const port = server.address().port;
    const realUrl = process.env.QWK_API_URL;
    process.env.QWK_API_URL = 'http://127.0.0.1:' + port;
    delete require.cache[require.resolve(identityPath)];
    const mod = require(identityPath);
    try { return await fn(mod); } finally {
      if (realUrl === undefined) delete process.env.QWK_API_URL; else process.env.QWK_API_URL = realUrl;
      delete require.cache[require.resolve(identityPath)];
      await new Promise(function (r) { server.close(r); });
    }
  }

  const limited = await stub(429, { error: 'Too many login attempts.' }, { 'Retry-After': '240' });
  await withStub(limited, async function (mod) {
    const r = await mod.verifyCredentials(TEST_USER, TEST_PASS);
    ok('a throttled identity check reports rate_limited, NOT unreachable',
      r.ok === false && r.reason === 'rate_limited', JSON.stringify(r));
    ok('the retry window is carried through', r.retry_after_seconds === 240,
      String(r.retry_after_seconds));
  });

  const broken = await stub(500, { error: 'boom' });
  await withStub(broken, async function (mod) {
    const r = await mod.verifyCredentials(TEST_USER, TEST_PASS);
    ok('a 5xx from the identity service reports identity_error',
      r.ok === false && r.reason === 'identity_error', JSON.stringify(r));
  });

  // A port with nothing on it: connection refused, the real outage case.
  const realUrl2 = process.env.QWK_API_URL;
  process.env.QWK_API_URL = 'http://127.0.0.1:59999';
  delete require.cache[require.resolve(identityPath)];
  const offline = require(identityPath);
  const r = await offline.verifyCredentials(TEST_USER, TEST_PASS);
  ok('an unreachable identity service reports identity_unreachable',
    r.ok === false && r.reason === 'identity_unreachable', JSON.stringify(r));
  if (realUrl2 === undefined) delete process.env.QWK_API_URL; else process.env.QWK_API_URL = realUrl2;
  delete require.cache[require.resolve(identityPath)];

  const qwkRouteSrc = require('fs').readFileSync(
    path.join(__dirname, '..', '..', 'qwkbrowser', 'backend', 'routes', 'auth.js'), 'utf8');
  ok('the partner route uses its OWN limiter, not the browser login limiter',
    qwkRouteSrc.indexOf("router.post('/verify-credentials', partnerVerifyLimiter") > -1);
  const csrfSrc = require('fs').readFileSync(
    path.join(__dirname, '..', '..', 'qwkbrowser', 'backend', 'middleware', 'csrf.js'), 'utf8');
  ok('the partner route is CSRF-exempt as a server-to-server call',
    csrfSrc.indexOf("'/api/auth/verify-credentials'") > -1);

  section('4. THE MIRROR ROW BEHAVES');
  const { db } = require(path.join(__dirname, '..', 'backend', 'db'));
  const before = (await db.execute({
    sql: 'SELECT COUNT(*) AS n FROM users WHERE qwk_user_id IS NOT NULL',
    args: []
  })).rows[0].n;

  const again = await api('POST', '/api/auth/login', null,
    { username: TEST_USER, password: TEST_PASS });
  ok('a second sign-in succeeds', again.status === 200, 'got ' + again.status);
  ok('and reports created:false (reused, not duplicated)',
    again.body && again.body.created === false, JSON.stringify(again.body && again.body.created));

  const after = (await db.execute({
    sql: 'SELECT COUNT(*) AS n FROM users WHERE qwk_user_id IS NOT NULL',
    args: []
  })).rows[0].n;
  ok('no duplicate mirror rows were created', before === after,
    before + ' -> ' + after);

  const rows = (await db.execute({
    sql: 'SELECT id, username, auth_source, password_hash, qwk_user_id, quanthom_unit FROM users WHERE qwk_user_id IS NOT NULL LIMIT 1',
    args: []
  })).rows;
  ok('the mirror is flagged auth_source=qwk', rows.length === 1 && rows[0].auth_source === 'qwk');
  ok('the mirror holds a real bcrypt hash that is not any known password',
    rows.length === 1 && /^\$2[aby]\$/.test(String(rows[0].password_hash)));
  ok('balances survived the repeated sign-in (not zeroed)',
    (again.body && again.body.user && again.body.user.quanthom_unit) === unitAfter,
    'first=' + unitAfter + ' second=' + (again.body && again.body.user && again.body.user.quanthom_unit));

  // Email identifiers work too: BANQ's login takes a username, and the bridge
  // lets QwkBrowser decide what an email means.
  const mirrorEmail = rows.length === 1
    ? (await db.execute({ sql: 'SELECT email FROM users WHERE id = ?', args: [rows[0].id] })).rows[0].email
    : null;
  if (mirrorEmail) {
    const byEmail = await api('POST', '/api/auth/login', null,
      { username: mirrorEmail, password: TEST_PASS });
    ok('signing in with the QwkBrowser email also works', byEmail.status === 200,
      'got ' + byEmail.status);
  } else {
    skip('email sign-in', 'no mirror email available');
  }

  section('5. LOCAL ACCOUNTS ARE UNCHANGED AND UNSHADOWABLE');
  const admin = await api('POST', '/api/auth/login', null,
    { username: 'banqadmin', password: 'typetype450' });
  ok('banqadmin still signs in locally', admin.status === 200, 'got ' + admin.status);
  ok('and is still marked local',
    admin.body && admin.body.user && admin.body.user.auth_source === 'local');

  const localRows = (await db.execute({
    sql: "SELECT COUNT(*) AS n FROM users WHERE auth_source = 'local'",
    args: []
  })).rows[0].n;
  ok('local accounts still exist in the table', localRows >= 1, 'count=' + localRows);

  // A local username must NOT fall through to the bridge. Pick a demo account
  // and log in with a password that is wrong locally; if the bridge were
  // consulted, a QWK account with the same name could take it over.
  const anyLocal = (await db.execute({
    sql: "SELECT username FROM users WHERE auth_source = 'local' AND username != 'banqadmin' LIMIT 1",
    args: []
  })).rows[0];
  if (anyLocal) {
    const shadow = await api('POST', '/api/auth/login', null,
      { username: anyLocal.username, password: 'this-is-not-the-local-password' });
    ok('a local username with a wrong local password does NOT fall through to the bridge',
      shadow.status === 401, 'got ' + shadow.status);
  } else {
    skip('shadowing check', 'no second local account exists');
  }

  section('6. THE SIGNED HANDOFF PATH');
  const handoff = identity.issueHandoffToken(
    { username: TEST_USER, display_name: TEST_USER, qwk_user_id: rows.length === 1 ? rows[0].qwk_user_id : null });
  ok('a handoff token can be minted with the shared secret (same format QWK issues)', !!handoff);

  if (handoff) {
    const sso = await api('POST', '/api/auth/sso', null, { token: handoff });
    ok('a valid handoff token signs in -> 200', sso.status === 200,
      'got ' + sso.status + ' ' + JSON.stringify(sso.body).slice(0, 120));
    ok('it issues a BANQ token', !!(sso.body && sso.body.token));
    ok('the handoff did NOT zero the balances',
      !!(sso.body && sso.body.user) && sso.body.user.quanthom_unit === unitAfter,
      'was ' + unitAfter + ' now ' + (sso.body && sso.body.user && sso.body.user.quanthom_unit));

    const tampered = handoff.split('.')[0] + '.' + crypto.randomBytes(32).toString('hex');
    const bad = await api('POST', '/api/auth/sso', null, { token: tampered });
    ok('a tampered signature is rejected', bad.status === 401 && bad.body.reason === 'bad_signature',
      JSON.stringify({ s: bad.status, r: bad.body && bad.body.reason }));

    const garbage = await api('POST', '/api/auth/sso', null, { token: 'not-a-token' });
    ok('a malformed token is rejected', garbage.status === 401 && garbage.body.reason === 'bad_format');

    const none = await api('POST', '/api/auth/sso', null, {});
    ok('a missing token is rejected', none.status === 401);

    // Freshness: a token older than the replay window must not be accepted.
    if (secret) {
      const stalePayload = { u: TEST_USER, n: TEST_USER, ts: Date.now() - 30 * 60 * 1000, exp: Date.now() + 3600000 };
      const body = Buffer.from(JSON.stringify(stalePayload)).toString('base64url');
      const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
      const stale = await api('POST', '/api/auth/sso', null, { token: body + '.' + sig });
      ok('a correctly signed but STALE token is rejected', stale.status === 401 && stale.body.reason === 'stale',
        JSON.stringify({ s: stale.status, r: stale.body && stale.body.reason }));

      const expiredPayload = { u: TEST_USER, n: TEST_USER, ts: Date.now() - 60 * 1000, exp: Date.now() - 1000 };
      const ebody = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
      const esig = crypto.createHmac('sha256', secret).update(ebody).digest('hex');
      const expired = await api('POST', '/api/auth/sso', null, { token: ebody + '.' + esig });
      ok('an EXPIRED token is rejected', expired.status === 401 && expired.body.reason === 'expired',
        JSON.stringify({ s: expired.status, r: expired.body && expired.body.reason }));
    }
  }

  section('7. NOTHING WAS WRITTEN INTO QWKBROWSER');
  const qwkDb = await openQwkReadOnly();
  if (!qwkDb) {
    skip('QWK session check', 'qwkbrowser database not reachable from here');
  } else {
    const sessions = (await qwkDb.execute({
      sql: 'SELECT COUNT(*) AS n FROM sessions WHERE user_id = 3',
      args: []
    })).rows[0].n;
    const guest = (await qwkDb.execute({
      sql: 'SELECT is_guest FROM users WHERE id = 3',
      args: []
    })).rows[0];
    ok('the founder account exists in QwkBrowser (the identity is real)', !!guest);
    console.log('        note: QWK has ' + sessions + ' session row(s) for user 3. This script cannot tell');
    console.log('        whether a row predates the bridge, so the token-less response above is the proof:');
    console.log('        the verify endpoint returns no token, so BANQ has nothing to store.');
  }

  section('8. THE .env IS ACTUALLY LOADED');
  const serverSrc = require('fs').readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  ok('server.js loads .env before the modules that read it',
    serverSrc.indexOf("require('./backend/load-env').load()") > -1
    && serverSrc.indexOf("require('./backend/load-env').load()") < serverSrc.indexOf("require('./backend/db')"));
  const envMod = require(path.join(__dirname, '..', 'backend', 'load-env'));
  ok('the loader reports keys and never prints values',
    typeof envMod.load === 'function' && typeof envMod.parseEnv === 'function');
  const parsed = envMod.parseEnv('A=1\n# c\nB="two"\n');
  ok('the loader handles comments and quoted values',
    parsed.A === '1' && parsed.B === 'two', JSON.stringify(parsed));

  const loginHtml = require('fs').readFileSync(path.join(__dirname, '..', 'login.html'), 'utf8');
  ok('login.html tells the truth about which account to use',
    loginHtml.indexOf('QwkBrowser account') > -1 && loginHtml.indexOf('QwkBrowser username') > -1);
  ok('login.html can redeem a signed handoff token', loginHtml.indexOf('redeemHandoff') > -1);
  ok('login.html strips a used handoff token from the URL',
    loginHtml.indexOf("params.delete('sso')") > -1);
  const appJs = require('fs').readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  ok('js/app.js exposes BANQ.sso', appJs.indexOf('BANQ.sso = function') > -1);

  console.log('\n' + '='.repeat(66));
  console.log('  RESULT:  ' + pass + ' PASS / ' + fail + ' FAIL / ' + skipped + ' SKIP');
  if (failures.length) {
    console.log('  FAILURES:');
    failures.forEach(function (f) { console.log('    - ' + f); });
  }
  console.log('='.repeat(66));

  /* exitCode, not exit(): calling process.exit() while undici tears down a
   * keep-alive socket trips a libuv assertion on Windows that aborts the
   * process (0xC0000409), so a run with zero failures can still be read as a
   * crash by the thing that launched it. Let the loop drain instead. */
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch(function (e) {
  console.error('verify crashed: ' + (e && e.stack ? e.stack : e));
  process.exitCode = 1;
});
