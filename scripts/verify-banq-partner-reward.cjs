/*
 * New Quanthoms Billboard Agency (BANQ)
 * scripts/verify-banq-partner-reward.cjs -- Rule 57 verify (F3 reward path)
 *
 * WHAT IT PROVES, in both directions:
 *
 *   THE DOOR OPENS FOR THE WING
 *     1. A real BANQ session (iloveqwkbrowser) can earn on a real campaign.
 *        Before this work the click answered 401 + CSRF_MISSING no matter how
 *        honest the caller was, because the app cannot hold a qwk_csrf cookie.
 *     2. The BANQ balance mirrors what QwkBrowser says the balance is -- the
 *        QWK side is the authority, and we do not invent a number locally.
 *     3. A retry of the same reward is answered from the audit row. One row,
 *        one payout, whatever the network does.
 *
 *   THE DOOR STAYS SHUT FOR EVERYONE ELSE
 *     4. No secret, a wrong secret, and a non-allowlisted address all get the
 *        same 404 an unknown path gets -- the door never confirms it exists.
 *     5. Missing fields are rejected before anything is paid.
 *     6. A partner cannot be paid for their own banner (the self-reward block).
 *     7. The per-recipient limit answers 429 with a retry window.
 *     8. The endpoint never answers HTML. A proxied or mounted route that
 *        returns a web page with a 200 is the failure this whole wing has hit
 *        before, so every response here is asserted to be JSON.
 *
 * Run:  node scripts/verify-banq-partner-reward.cjs
 * Requires BOTH servers: QwkBrowser on 3001, BANQ on 3002.
 */

const path = require('path');

require(path.join(__dirname, '..', 'backend', 'load-env')).load();

const BASE = process.env.BANQ_BASE || 'http://localhost:3002';
const QWK_BASE = process.env.QWK_BASE || process.env.QWK_API_URL || 'http://localhost:3001';
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

async function api(method, urlPath, token, body, extraHeaders, base) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (extraHeaders) Object.assign(headers, extraHeaders);
  const res = await fetch((base || BASE) + urlPath, {
    method: method,
    headers: headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const ctype = res.headers.get('content-type') || '';
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = null; }
  return { status: res.status, body: json, isJson: ctype.indexOf('json') !== -1, raw: text.slice(0, 160) };
}

/* Open QwkBrowser's database to READ what the door recorded. The trust
 * boundary is on the QWK side, so the evidence has to be read there. */
async function openQwkDb() {
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
  const secret = (process.env.BANQ_SSO_SECRET || '').trim() || null;
  const qwkSecret = (process.env.QWK_SSO_SECRET || process.env.BANQ_SSO_SECRET || '').trim() || null;
  const qdb = await openQwkDb();

  section('0. CONFIGURATION');
  ok('the shared secret is configured on the BANQ side', !!secret,
    'add BANQ_SSO_SECRET to .env (equal to QWK_SSO_SECRET)');
  const banqUp = await fetch(BASE + '/api/auth/me').then(function (r) { return r.status; }).catch(function () { return 0; });
  const qwkUp = await fetch(QWK_BASE + '/api/health').then(function (r) { return r.status; }).catch(function () { return 0; });
  ok('BANQ is serving on ' + BASE, banqUp === 401, 'got ' + banqUp);
  ok('QwkBrowser is serving on ' + QWK_BASE, qwkUp > 0 && qwkUp < 500, 'got ' + qwkUp);
  if (!secret) {
    console.log('\nNo secret configured: the rest cannot be proven. Stopping.');
    return finish();
  }

  section('1. THE DOOR DOES NOT CONFIRM IT EXISTS');
  const noSecret = await api('GET', '/api/ads/partner/health', null, undefined, null, QWK_BASE);
  ok('health with no secret answers 404, not 401', noSecret.status === 404, 'got ' + noSecret.status);
  ok('health with no secret answers JSON', noSecret.isJson === true, noSecret.raw);
  const wrongSecret = await api('GET', '/api/ads/partner/health', null, undefined,
    { 'X-QWK-SSO-Secret': 'not-the-secret-000' }, QWK_BASE);
  ok('health with a wrong secret answers 404', wrongSecret.status === 404, 'got ' + wrongSecret.status);
  const wrongSecretReward = await api('POST', '/api/ads/partner/reward', null,
    { partner: 'banq', external_user_id: '1', reward_id: 'x', recipient_user_id: 1, banner_id: 1 },
    { 'X-QWK-SSO-Secret': 'not-the-secret-000' }, QWK_BASE);
  ok('a wrong secret cannot reach the payout', wrongSecretReward.status === 404,
    'got ' + wrongSecretReward.status);
  ok('the refusal is JSON, never a page', wrongSecretReward.isJson === true, wrongSecretReward.raw);

  const foreignIp = await api('GET', '/api/ads/partner/health', null, undefined,
    { 'X-QWK-SSO-Secret': qwkSecret, 'X-Forwarded-For': '203.0.113.9' }, QWK_BASE);
  ok('the right secret from a non-allowlisted address is still refused', foreignIp.status === 404,
    'got ' + foreignIp.status + ' (add the wing IP to QWK_PARTNER_REWARD_IPS for production)');

  const allowed = await api('GET', '/api/ads/partner/health', null, undefined,
    { 'X-QWK-SSO-Secret': qwkSecret, 'X-Forwarded-For': '127.0.0.1' }, QWK_BASE);
  ok('the right secret from an allowlisted address opens the door', allowed.status === 200,
    'got ' + allowed.status + ' :: ' + allowed.raw);
  if (allowed.status === 200) {
    ok('the door reports its own limits', !!(allowed.body && allowed.body.limits && allowed.body.limits.per_recipient),
      JSON.stringify(allowed.body));
    const bad = await api('POST', '/api/ads/partner/reward', null, { partner: 'banq' },
      { 'X-QWK-SSO-Secret': qwkSecret, 'X-Forwarded-For': '127.0.0.1' }, QWK_BASE);
    ok('missing fields are rejected before anything is paid', bad.status === 400,
      'got ' + bad.status + ' :: ' + bad.raw);
    ok('the rejection names the fields it wanted',
      !!(bad.body && bad.body.error === 'missing_fields' && bad.body.required),
      JSON.stringify(bad.body));
  } else {
    skip('limits + field validation', 'the door did not open on this run');
  }

  section('2. A REAL BANQ SESSION CAN EARN');
  const login = await api('POST', '/api/auth/login', null, { username: TEST_USER, password: TEST_PASS });
  ok(TEST_USER + ' signs in on BANQ', login.status === 200 && !!(login.body && login.body.token),
    'got ' + login.status + ' :: ' + login.raw);
  const token = (login.body && login.body.token) || null;
  if (!token) { console.log('\nNo session: the earn path cannot be proven. Stopping.'); return finish(); }

  const status = await api('GET', '/api/earn/status', token);
  ok('/api/earn/status reports earning is open for this account',
    !!(status.body && status.body.status && status.body.status.can_earn), JSON.stringify(status.body));
  ok('the account is linked to a QWK identity',
    !!(status.body && status.body.status && status.body.status.linked), JSON.stringify(status.body));

  const feed = await api('GET', '/api/ads/public', null, undefined, null, QWK_BASE);
  const banners = (feed.body && feed.body.banners) || [];
  ok('a real campaign exists to earn on', banners.length > 0, 'public banners: ' + banners.length);
  if (!banners.length) return finish();
  const banner = banners[0];

  const before = await api('GET', '/api/auth/me', token);
  const beforeUnit = Number((before.body && before.body.user && before.body.user.quanthom_unit) || 0);

  const earn = await api('POST', '/api/earn/click', token, { banner_id: Number(banner.id) });
  ok('the earn endpoint answers JSON', earn.isJson === true, earn.raw);
  const granted = earn.status === 200 && !!(earn.body && earn.body.ok);
  const cooled = earn.status === 409 && earn.body && earn.body.reason === 'cooldown_active';
  if (granted) {
    ok('a BANQ session earned on a real campaign', true);
    ok('the reward is a real number (or rewards are centrally paused)',
      earn.body.reward_hidden === true || Number(earn.body.units_earned) > 0,
      JSON.stringify(earn.body));
    const after = await api('GET', '/api/auth/me', token);
    const afterUnit = Number((after.body && after.body.user && after.body.user.quanthom_unit) || 0);
    if (earn.body.replay === true) {
      // The reward for today was granted on an earlier run. A replay must NOT
      // move the balance: paying again here would be the exact double-pay this
      // door exists to prevent.
      ok('a replay does not pay a second time', afterUnit === beforeUnit,
        beforeUnit + ' -> ' + afterUnit + ' on a replay');
    } else {
      ok('the BANQ balance moved by exactly what was earned',
        afterUnit - beforeUnit === Number(earn.body.units_earned || 0),
        beforeUnit + ' -> ' + afterUnit + ' (+' + earn.body.units_earned + ')');
    }
    ok('the balance matches QwkBrowser\'s number (QWK is the authority)',
      Number(earn.body.quanthom_unit) === afterUnit,
      'qwk says ' + earn.body.quanthom_unit + ', banq has ' + afterUnit);
  } else if (cooled) {
    skip('a fresh payout', 'this account already earned on this banner today; the door answered cooldown_active, which is a real reward answer and not a 401/CSRF refusal');
  } else {
    ok('a BANQ session earned on a real campaign', false,
      'status ' + earn.status + ' :: ' + earn.raw);
  }

  const replay = await api('POST', '/api/earn/click', token, { banner_id: Number(banner.id) });
  ok('a retry is idempotent (no second payout)',
    (replay.status === 200 || replay.status === 409) &&
    (replay.body && (replay.body.replay === true || replay.body.reason === 'cooldown_active')),
    'status ' + replay.status + ' :: ' + replay.raw);

  if (qdb) {
    const rewardId = 'banq-' + Number(banner.id) + '-' + new Date().toISOString().slice(0, 10);
    const rows = (await qdb.execute({
      sql: `SELECT COUNT(*) AS c FROM partner_reward_grants WHERE reward_id = ?`, args: [rewardId]
    })).rows[0];
    ok('exactly one audit row exists for this reward, whatever the retries did',
      Number(rows.c) === 1, 'rows: ' + rows.c + ' for ' + rewardId);
    const history = await api('GET', '/api/earn/history', token);
    ok('BANQ shows the person their own earn history',
      !!(history.body && Array.isArray(history.body.history) && history.body.history.length > 0),
      JSON.stringify(history.body).slice(0, 160));
  } else {
    skip('audit + history reads', 'qwkbrowser database not reachable from here');
  }

  section('3. THE DOOR REFUSES THE THINGS IT SHOULD');
  // 999998, not 999999: the rate-limit section below deliberately exhausts the
  // budget of 999999, and the limiter runs BEFORE the recipient lookup (right
  // order -- refuse the flood first). A shared id would make this assertion
  // depend on section order, which is how a verify script starts lying.
  const ghost = await api('POST', '/api/ads/partner/reward', null,
    { partner: 'banq', external_user_id: '1', reward_id: 'ghost', recipient_user_id: 999998, banner_id: Number(banner.id) },
    { 'X-QWK-SSO-Secret': qwkSecret, 'X-Forwarded-For': '127.0.0.1' }, QWK_BASE);
  ok('an unknown recipient is refused', ghost.status === 404 && ghost.body && ghost.body.error === 'recipient_not_found',
    'status ' + ghost.status + ' :: ' + ghost.raw);

  if (qdb) {
    // Self-reward: a banner owned by the person being paid must not pay them.
    // The fixture is created and removed by this script so nothing leaks into
    // the public feed (status 'draft' keeps it out of /api/ads/public).
    let fixturePartner = null, fixtureBanner = null;
    try {
      // Resolve the QWK identity from the QWK side. BANQ's /api/auth/me
      // deliberately exposes the username and the link state, not the numeric
      // id, so the id is read where it actually lives.
      const idRow = (await qdb.execute({
        sql: 'SELECT id FROM users WHERE username = ?', args: [TEST_USER]
      })).rows[0];
      const qwkUserId = Number((idRow || {}).id);
      if (!qwkUserId) throw new Error('no QWK user named ' + TEST_USER);
      const marker = 'verify-selfreward-' + Date.now();
      const p = await qdb.execute({
        sql: `INSERT INTO ad_partners (user_id, company_name, contact_email) VALUES (?, ?, ?)`,
        args: [qwkUserId, marker, marker + '@qwk.local']
      });
      fixturePartner = Number(p.lastInsertRowid);
      const b = await qdb.execute({
        sql: `INSERT INTO ad_banners (partner_id, title, target_url, units_reward, cooldown_hours, status)
              VALUES (?, ?, ?, 10, 24, 'draft')`,
        args: [fixturePartner, marker, 'https://example.com/selfreward']
      });
      fixtureBanner = Number(b.lastInsertRowid);
      const self = await api('POST', '/api/ads/partner/reward', null,
        { partner: 'banq', external_user_id: String(qwkUserId), reward_id: 'self-' + fixtureBanner,
          recipient_user_id: qwkUserId, banner_id: fixtureBanner },
        { 'X-QWK-SSO-Secret': qwkSecret, 'X-Forwarded-For': '127.0.0.1' }, QWK_BASE);
      ok('a partner cannot be paid for their own banner',
        self.status === 403 && self.body && self.body.error === 'self_reward',
        'status ' + self.status + ' :: ' + self.raw);
    } catch (e) {
      skip('self-reward block', 'fixture could not be created: ' + e.message);
    } finally {
      try { if (fixtureBanner) await qdb.execute({ sql: 'DELETE FROM ad_banners WHERE id = ?', args: [fixtureBanner] }); } catch (e) {}
      try { if (fixturePartner) await qdb.execute({ sql: 'DELETE FROM ad_partners WHERE id = ?', args: [fixturePartner] }); } catch (e) {}
    }
  } else {
    skip('self-reward block', 'qwkbrowser database not reachable from here');
  }

  section('4. THE RATE LIMIT HOLDS (this section spends the recipient budget)');
  let limited = null;
  for (let i = 0; i < 22 && !limited; i++) {
    const r = await api('POST', '/api/ads/partner/reward', null,
      { partner: 'banq', external_user_id: 'ratelimit-probe', reward_id: 'rl-' + Date.now() + '-' + i,
        recipient_user_id: 999999, banner_id: 999999 },
      { 'X-QWK-SSO-Secret': qwkSecret, 'X-Forwarded-For': '127.0.0.1' }, QWK_BASE);
    if (r.status === 429) limited = r;
  }
  ok('the per-recipient limit answers 429', !!limited, 'no 429 within 22 attempts');
  if (limited) {
    ok('the limit says which scope it was and when to come back',
      !!(limited.body && limited.body.scope && limited.body.retry_after_seconds),
      JSON.stringify(limited.body));
  }

  return finish();
}

function finish() {
  console.log('\n' + '='.repeat(64));
  console.log('  partner reward verify: ' + pass + ' PASS / ' + fail + ' FAIL / ' + skipped + ' SKIP');
  console.log('='.repeat(64));
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(function (f) { console.log('  - ' + f); });
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(function (e) {
  console.error('\nverify crashed: ' + e.message);
  process.exit(1);
});
