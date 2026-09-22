/*
 * New Quanthoms Billboard Agency (BANQ)
 * backend/earn.js -- the reward half of the QwkBrowser bridge
 *
 * WHY THIS FILE EXISTS
 *
 * The identity half of the bridge (backend/qwk-identity.js) lets a person sign
 * in here with a QwkBrowser account. It does not let them EARN. The audience
 * page has said "Click to Earn" since it shipped, and the click went straight
 * at QwkBrowser's /api/ads/click, which can never accept it:
 *
 *   - it wants a QWK Bearer token, and this site has its own session
 *   - it wants the qwk_csrf cookie + header, and only a page served from
 *     QwkBrowser can hold that cookie
 *
 * So the button was structurally unable to pay, and the page said "try again".
 *
 * THE MODEL
 *
 * BANQ's server calls QwkBrowser's PARTNER REWARD DOOR server-side, with the
 * same shared secret that already carries sign-in (BANQ_SSO_SECRET ==
 * QWK_SSO_SECRET). The browser never sees the secret and never holds a QWK
 * token. The reward itself is decided and paid entirely on the QwkBrowser side
 * -- this file asks, then reports the answer honestly.
 *
 * IDEMPOTENCY is passed through, not reinvented: the reward_id is derived from
 * (banner, UTC day), so a retry of the same click on the same day is the same
 * reward and QwkBrowser pays it once. A later day is a genuinely new reward.
 *
 * HONESTY RULES (the reason this file is longer than it looks)
 *
 * Every failure has its own reason, and none of them is "try again":
 *   bridge_not_configured -- no shared secret here; earning is OFF, and the
 *                            button should say so rather than inviting clicks
 *   qwk_not_linked        -- signed in, but this account has no QWK identity
 *   reward_door_closed    -- QWK answered 404: the partner door is not open
 *                            (secret mismatch, IP not allowlisted, or the ad
 *                            system is switched off). NOT the person's fault.
 *   cooldown_active       -- a real answer: they already earned on this banner
 *   rate_limited          -- a real answer: too fast, with a retry window
 *   self_reward           -- their own banner
 *   reward_unavailable    -- QWK did not answer / answered 5xx
 *
 * No secret, no token, no reward number is invented anywhere in this file.
 * ASCII-only.
 */

const express = require('express');
const router = express.Router();
const { db } = require('./db');
const { requireAuth } = require('./auth');

const QWK_API_URL = process.env.QWK_API_URL || 'http://localhost:3001';
const QWK_TIMEOUT_MS = 8000;

/* The sign-in secret, reused. One shared secret for one trust boundary; a
 * second secret for rewards would be a second thing to rotate and a second
 * thing to get wrong. */
function bridgeSecret() {
  const s = process.env.BANQ_SSO_SECRET || '';
  return s ? String(s) : null;
}

function dayKeyUTC(d) {
  return new Date(d || Date.now()).toISOString().slice(0, 10);
}

/* -- Local ledger of attempts --------------------------------------------- */
/*
 * NOT the source of truth for what was paid -- QwkBrowser holds that. This
 * exists so the person can see their own earning history on this site without
 * needing a QWK token. One row per (user, reward_id).
 *
 * WHY THE ROW CAN BE UPDATED (this was a real defect, found live)
 *
 * The first version was INSERT OR IGNORE: one row per reward, written once.
 * That looked rigorous and was wrong in a way the tests could not see until
 * the underlying bug was fixed. Sequence that broke it:
 *
 *   1. attempt 1 fails (the QWK door answered 500)  -> row: server_error
 *   2. attempt 2 SUCCEEDS and pays 10 QU             -> INSERT IGNORED
 *
 * the person's history and bonus bar then showed a failure for a reward they
 * had actually been paid. So the row records the LATEST KNOWN outcome, with
 * one rule that keeps it honest: a GRANT IS NEVER DOWNGRADED. A later cooldown
 * or replay cannot erase it, and a later grant always repairs an earlier
 * failure (which is what makes this table self-healing).
 */
let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS banq_earn_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_user_id INTEGER NOT NULL,
      qwk_user_id INTEGER,
      banner_id INTEGER,
      reward_id TEXT NOT NULL,
      units INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'attempted',
      reason TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_banq_earn_unique
                    ON banq_earn_events (local_user_id, reward_id)`);
  tableReady = true;
}

async function logEvent(user, bannerId, rewardId, units, status, reason) {
  try {
    await ensureTable();
    await db.execute({
      sql: `INSERT INTO banq_earn_events
              (local_user_id, qwk_user_id, banner_id, reward_id, units, status, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(local_user_id, reward_id) DO UPDATE SET
              units = CASE WHEN excluded.status = 'granted' THEN excluded.units
                           ELSE banq_earn_events.units END,
              status = CASE WHEN excluded.status = 'granted' THEN 'granted'
                            WHEN banq_earn_events.status = 'granted' THEN 'granted'
                            ELSE excluded.status END,
              reason = CASE WHEN excluded.status = 'granted' THEN ''
                            WHEN banq_earn_events.status = 'granted' THEN banq_earn_events.reason
                            ELSE excluded.reason END`,
      args: [user.id, user.qwk_user_id || null, bannerId || null, rewardId,
             units || 0, status, String(reason || '').slice(0, 120)]
    });
  } catch (e) {
    console.warn('[BANQ] earn log failed: ' + e.message);
  }
}

/* Mirror what QwkBrowser says the balance is. The QWK side is the authority;
 * overwriting a local number with it is the point, not a side effect. */
async function mirrorBalance(localUserId, balance) {
  if (balance === null || balance === undefined || isNaN(Number(balance))) return;
  try {
    await db.execute({
      sql: 'UPDATE users SET quanthom_unit = ? WHERE id = ?',
      args: [Number(balance), localUserId]
    });
  } catch (e) {
    console.warn('[BANQ] balance mirror failed: ' + e.message);
  }
}

/* -- The call -------------------------------------------------------------- */

async function callRewardDoor(payload) {
  const secret = bridgeSecret();
  if (!secret) return { ok: false, reason: 'bridge_not_configured' };

  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, QWK_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(QWK_API_URL + '/api/ads/partner/reward', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-QWK-SSO-Secret': secret
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, reason: 'reward_unavailable', detail: e.message };
  }
  clearTimeout(timer);

  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }

  if (res.status === 200 && data && data.ok) {
    return {
      ok: true,
      units_earned: Number(data.units_earned || 0),
      recipient_balance: data.recipient_balance === undefined ? null : data.recipient_balance,
      eligible_again_at: data.eligible_again_at || null,
      replay: !!data.replay,
      reward_hidden: !!data.reward_hidden
    };
  }
  if (res.status === 200 && data && data.ok === false) {
    // A replay of an earlier non-grant (cooldown etc) is still the truth.
    return { ok: false, reason: data.reason || data.status || 'not_granted', replay: true };
  }
  if (data && data.error) {
    // 404 here means the DOOR is not open, which is not the same as a missing
    // banner. Saying "banner not found" would send someone looking for a
    // deleted ad instead of an unconfigured deployment.
    if (res.status === 404 && data.error === 'not_found') {
      return { ok: false, reason: 'reward_door_closed' };
    }
    return {
      ok: false,
      reason: data.error,
      eligible_again_at: data.eligible_again_at || null,
      status: res.status
    };
  }
  if (res.status >= 500) return { ok: false, reason: 'reward_unavailable', detail: 'status ' + res.status };
  return { ok: false, reason: 'reward_unavailable', detail: 'status ' + res.status };
}

/* Earn on one banner, for one signed-in BANQ user. */
async function earnFromBanner(user, bannerId) {
  if (!user.qwk_user_id) return { ok: false, reason: 'qwk_not_linked' };
  if (!bridgeSecret()) return { ok: false, reason: 'bridge_not_configured' };

  const rewardId = 'banq-' + bannerId + '-' + dayKeyUTC();
  const result = await callRewardDoor({
    partner: 'banq',
    external_user_id: String(user.qwk_user_id),
    external_username: user.qwk_username || user.username || '',
    reward_id: rewardId,
    recipient_user_id: Number(user.qwk_user_id),
    banner_id: Number(bannerId)
  });

  if (result.ok) {
    await logEvent(user, bannerId, rewardId, result.units_earned, 'granted', result.replay ? 'replay' : '');
    await mirrorBalance(user.id, result.recipient_balance);
    return result;
  }

  await logEvent(user, bannerId, rewardId, 0, result.reason, result.detail || '');
  return result;
}

/* What the page needs to decide whether to invite a click at all. */
function earnStatus(user) {
  return {
    signed_in: !!user,
    linked: !!(user && user.qwk_user_id),
    bridge_configured: !!bridgeSecret(),
    can_earn: !!(user && user.qwk_user_id && bridgeSecret())
  };
}

/* -- Routes --------------------------------------------------------------- */

// GET /api/earn/status -- is earning open for this account, and why not
router.get('/status', requireAuth, async function (req, res) {
  try {
    res.json({ ok: true, status: earnStatus(req.user) });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'status_failed' });
  }
});

// POST /api/earn/click -- earn on a banner. body: { banner_id }
router.post('/click', requireAuth, async function (req, res) {
  try {
    const bannerId = parseInt(req.body && req.body.banner_id, 10);
    if (!bannerId) return res.status(400).json({ ok: false, error: 'banner_id_required' });

    const result = await earnFromBanner(req.user, bannerId);
    if (result.ok) {
      const fresh = (await db.execute({
        sql: 'SELECT quanthom_unit, quanthom_credit FROM users WHERE id = ?',
        args: [req.user.id]
      })).rows[0] || {};
      return res.json({
        ok: true,
        units_earned: result.units_earned,
        reward_hidden: result.reward_hidden,
        replay: result.replay || false,
        eligible_again_at: result.eligible_again_at || null,
        quanthom_unit: Number(fresh.quanthom_unit || 0),
        quanthom_credit: Number(fresh.quanthom_credit || 0)
      });
    }

    const status = result.reason === 'rate_limited' ? 429
      : result.reason === 'self_reward' ? 403
      : result.reason === 'cooldown_active' ? 409
      : 502;
    return res.status(status).json({
      ok: false,
      reason: result.reason,
      detail: result.detail || null,
      eligible_again_at: result.eligible_again_at || null,
      status: earnStatus(req.user)
    });
  } catch (err) {
    console.error('[BANQ] POST /api/earn/click failed: ' + err.message);
    res.status(500).json({ ok: false, error: 'earn_failed' });
  }
});

// GET /api/earn/history -- this person's own earning attempts, newest first
router.get('/history', requireAuth, async function (req, res) {
  try {
    await ensureTable();
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const rows = (await db.execute({
      sql: `SELECT banner_id, reward_id, units, status, reason, created_at
            FROM banq_earn_events WHERE local_user_id = ?
            ORDER BY id DESC LIMIT ?`,
      args: [req.user.id, limit]
    })).rows || [];
    const today = dayKeyUTC();
    const earnedToday = rows
      .filter(function (r) { return (r.reward_id || '').slice(-10) === today && r.status === 'granted'; })
      .reduce(function (sum, r) { return sum + Number(r.units || 0); }, 0);
    res.json({ ok: true, history: rows, earned_today: earnedToday, status: earnStatus(req.user) });
  } catch (err) {
    console.error('[BANQ] GET /api/earn/history failed: ' + err.message);
    res.status(500).json({ ok: false, error: 'history_failed' });
  }
});

module.exports = {
  router: router,
  earnFromBanner: earnFromBanner,
  earnStatus: earnStatus,
  bridgeSecret: bridgeSecret,
  dayKeyUTC: dayKeyUTC
};
