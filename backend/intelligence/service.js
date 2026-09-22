/*
 * New Quanthoms Billboard Agency (BANQ)
 * backend/intelligence/service.js -- BANQ AD SERVICE: the gate (G3 + G4)
 *
 * THE MODEL, in the founder's words:
 *
 *   "no matter how much the advertiser is charged on qwkbrowser... in order for
 *    the advertiser to have access to BANQ MONITORING tools, they have to pay
 *    $15 per month in credits or fiat. They can do as many adverts as they want
 *    but the premium monitoring fee is $15."
 *
 * So there are two separate financial facts and this file keeps them separate:
 *
 *   - WHAT THEY SPENT ON ADS. Nothing to do with BANQ. An advertiser can run
 *     fifty campaigns this month through QWK and owe BANQ nothing.
 *   - WHETHER THEY HAVE A BANQ MONTH. One $15 month unlocks every monitoring
 *     tool for every campaign they run inside that month. Running another ad in
 *     the same month does NOT charge a second time.
 *
 * The fee is read from banq_config (`banq_monitor_fee_usd` / `_credits`), never
 * from a literal, so the founder can change the price without a redeploy.
 *
 * Revenue is written to banq_revenue_ledger at activation, in its own ledger
 * with its own settlement status, exactly as Section 9 of the monitoring
 * partnership doc requires -- the BANQ fee must never be silently netted off
 * against the advertising budget.
 */

const { db } = require('../db');
const core = require('./core');
const { cfg, logActivity } = core;

// Lifecycle, from Section 8 of BANQ-AD-MONITORING-PARTNERSHIP.md.
const LIFECYCLE = ['NOT_SELECTED', 'OFFERED', 'OPTED_IN', 'PAYMENT_CONFIRMED', 'ACTIVE', 'MONITORING',
  'CAMPAIGN_COMPLETED', 'SERVICE_COMPLETED'];
const EXTRA_STATES = ['PAUSED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'SUSPENDED'];

// The states that actually open the gate.
const OPEN_STATES = ['PAYMENT_CONFIRMED', 'ACTIVE', 'MONITORING'];

const PERIOD_DAYS = 30;

async function fees() {
  return {
    usd: await cfg('banq_monitor_fee_usd', 15),
    credits: await cfg('banq_monitor_fee_credits', 1500),
    plans: await cfg('banq_service_plans', {})
  };
}

/**
 * Is this advertiser's current month paid and open?
 *
 * Checks BOTH bounds, because a subscription that has not started yet must not
 * open the gate, and an expired one must not either -- either mistake would give
 * the tools away.
 */
async function activeSubscription(advertiserId) {
  const row = (await db.execute({
    sql: `SELECT * FROM banq_service_subscriptions
          WHERE advertiser_id = ?
            AND banq_service_status IN ('PAYMENT_CONFIRMED','ACTIVE','MONITORING')
            AND (period_start IS NULL OR period_start <= CURRENT_TIMESTAMP)
            AND (period_end IS NULL OR period_end >= CURRENT_TIMESTAMP)
          ORDER BY period_end DESC LIMIT 1`,
    args: [Number(advertiserId)]
  })).rows[0];
  return row || null;
}

/**
 * The single gate every monitoring route consults. Returns the reason when it
 * closes, so the UI can say "this is what the $15 buys" rather than a bare 403.
 */
async function monitorAccess(advertiserId) {
  const f = await fees();
  if (!advertiserId) {
    return { allowed: false, reason: 'no_session', message: 'Sign in to see monitoring tools.', fees: f };
  }
  const sub = await activeSubscription(advertiserId);
  if (!sub) {
    const last = (await db.execute({
      sql: `SELECT * FROM banq_service_subscriptions WHERE advertiser_id = ? ORDER BY created_at DESC LIMIT 1`,
      args: [Number(advertiserId)]
    })).rows[0];
    return {
      allowed: false,
      reason: last ? 'not_paid_this_month' : 'never_subscribed',
      message: 'BANQ AD SERVICE is not active for this month. Monitoring, analysis and alerting are the tools the $' + f.usd + ' month buys.',
      fee_usd: f.usd,
      fee_credits: f.credits,
      last_status: last ? last.banq_service_status : null
    };
  }
  const daysLeft = sub.period_end
    ? Math.max(0, Math.ceil((new Date(String(sub.period_end).replace(' ', 'T') + 'Z').getTime() - Date.now()) / 86400000))
    : null;
  return {
    allowed: true,
    reason: null,
    subscription: {
      id: sub.id,
      plan: sub.banq_service_plan,
      status: sub.banq_service_status,
      period_start: sub.period_start,
      period_end: sub.period_end,
      days_left: daysLeft,
      currency: sub.banq_service_currency
    },
    // Stated plainly because it is a promise made to the advertiser: more ads
    // this month do not cost more BANQ fee.
    covers: 'Every campaign you run inside this paid month. Running another ad does not charge the BANQ fee again.',
    fees: f
  };
}

/** Express middleware for the monitoring routes. Attaches req.monitor. */
function requireMonitorAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: 'unauthorized', message: 'Sign in to continue.' });
  }
  // Staff are never gated: they are the ones delivering the service.
  if (req.user.is_admin) {
    req.monitor = { allowed: true, reason: 'banq_staff', staff: true };
    return next();
  }
  monitorAccess(req.user.id).then(function (access) {
    req.monitor = access;
    if (!access.allowed) {
      return res.status(402).json({
        ok: false,
        error: 'banq_service_required',
        message: access.message,
        reason: access.reason,
        fee_usd: access.fee_usd,
        fee_credits: access.fee_credits
      });
    }
    next();
  }).catch(function (err) {
    console.error('[BANQ service] gate failed:', err.message);
    res.status(500).json({ ok: false, error: 'gate_failed' });
  });
}

/**
 * Subscribe for a month. Advertiser-wide by design (campaign_id stays NULL),
 * because the fee is per advertiser per month, not per campaign.
 *
 * payment_status is recorded honestly: without a payment rail connected the row
 * is left 'pending' and the status is OPTED_IN, so the gate stays CLOSED until
 * money is actually confirmed. A free unlocked demo is exactly the bug this
 * avoids.
 */
async function subscribe(advertiserId, input, actor) {
  const f = await fees();
  const plan = String(input.plan || 'monitor');
  const currency = String(input.currency || 'credits').toLowerCase() === 'fiat' ? 'USD' : 'QC';
  const planDef = (f.plans && f.plans[plan]) || null;
  const feeUsd = planDef ? Number(planDef.fee_usd) : f.usd;
  const feeCredits = planDef ? Number(planDef.fee_credits) : f.credits;
  const fee = currency === 'USD' ? feeUsd : feeCredits;

  // A second purchase inside an already-paid month must not double-charge.
  const existing = await activeSubscription(advertiserId);
  if (existing && !input.force) {
    return {
      charged: false,
      reason: 'already_covered_this_month',
      message: 'This month is already paid, so no further BANQ fee is due. Your ads this month are covered.',
      subscription: existing
    };
  }

  const paymentConfirmed = input.payment_confirmed === true;
  const status = paymentConfirmed ? 'ACTIVE' : 'OPTED_IN';
  const note = input.note || null;

  const res = await db.execute({
    sql: `INSERT INTO banq_service_subscriptions
          (advertiser_id, campaign_id, banq_service_plan, banq_service_fee, banq_service_currency,
           banq_service_status, period_start, period_end, banq_service_start)
          VALUES (?, NULL, ?, ?, ?, ?, CURRENT_TIMESTAMP, datetime('now', '+' || ? || ' days'), CURRENT_TIMESTAMP)`,
    args: [Number(advertiserId), plan, fee, currency, status, PERIOD_DAYS]
  });
  const id = Number(res.lastInsertRowid);

  // Revenue is recorded only when payment is confirmed. A pending subscription
  // is not revenue, and recording it as such would inflate the ledger.
  let ledgerId = null;
  if (paymentConfirmed) {
    const led = await db.execute({
      sql: `INSERT INTO banq_revenue_ledger
            (campaign_id, advertiser_id, banq_plan, banq_service_fee, payment_status, settlement_status)
            VALUES (NULL, ?, ?, ?, 'paid', 'PENDING')`,
      args: [Number(advertiserId), plan, fee]
    });
    ledgerId = Number(led.lastInsertRowid);
  }

  await logActivity(null, actor ? actor.id : null, paymentConfirmed ? 'SERVICE_ACTIVATED' : 'SERVICE_OPTED_IN',
    { subscription_id: id, plan, fee, currency, note });

  return {
    id,
    plan,
    status,
    fee,
    currency,
    charged: paymentConfirmed,
    ledger_id: ledgerId,
    gate_open: paymentConfirmed,
    message: paymentConfirmed
      ? 'BANQ AD SERVICE is active for 30 days. Every campaign you run in this month is covered.'
      : 'Recorded as opted in. The monitoring tools stay locked until payment is confirmed, because an unpaid subscription must not open a paid gate.'
  };
}

/** Confirm payment on a pending subscription (the moment the gate opens). */
async function confirmPayment(subscriptionId, actor, reference) {
  const sub = (await db.execute({
    sql: `SELECT * FROM banq_service_subscriptions WHERE id = ?`,
    args: [Number(subscriptionId)]
  })).rows[0];
  if (!sub) throw Object.assign(new Error('Subscription not found.'), { code: 404 });
  if (OPEN_STATES.includes(sub.banq_service_status)) {
    return { id: Number(subscriptionId), status: sub.banq_service_status, changed: false, message: 'Already open.' };
  }
  await db.execute({
    sql: `UPDATE banq_service_subscriptions SET banq_service_status = 'ACTIVE' WHERE id = ?`,
    args: [Number(subscriptionId)]
  });
  const led = await db.execute({
    sql: `INSERT INTO banq_revenue_ledger
          (campaign_id, advertiser_id, banq_plan, banq_service_fee, payment_status, settlement_status)
          VALUES (NULL, ?, ?, ?, 'paid', 'PENDING')`,
    args: [sub.advertiser_id, sub.banq_service_plan, Number(sub.banq_service_fee || 0)]
  });
  await logActivity(null, actor ? actor.id : null, 'SERVICE_ACTIVATED',
    { subscription_id: Number(subscriptionId), reference: reference || null });
  return { id: Number(subscriptionId), status: 'ACTIVE', ledger_id: Number(led.lastInsertRowid), changed: true };
}

async function setStatus(subscriptionId, status, actor) {
  const s = String(status || '').toUpperCase();
  if (!LIFECYCLE.includes(s) && !EXTRA_STATES.includes(s)) {
    throw Object.assign(new Error('Status must be one of: ' + LIFECYCLE.concat(EXTRA_STATES).join(', ')), { code: 400 });
  }
  const sub = (await db.execute({
    sql: `SELECT * FROM banq_service_subscriptions WHERE id = ?`,
    args: [Number(subscriptionId)]
  })).rows[0];
  if (!sub) throw Object.assign(new Error('Subscription not found.'), { code: 404 });
  await db.execute({
    sql: `UPDATE banq_service_subscriptions SET banq_service_status = ? WHERE id = ?`,
    args: [s, Number(subscriptionId)]
  });
  await logActivity(null, actor ? actor.id : null, 'SERVICE_STATUS_CHANGED', { subscription_id: Number(subscriptionId), status: s });
  return { id: Number(subscriptionId), status: s };
}

async function listSubscriptions(advertiserId) {
  const rows = (await db.execute({
    sql: `SELECT * FROM banq_service_subscriptions WHERE advertiser_id = ? ORDER BY created_at DESC LIMIT 100`,
    args: [Number(advertiserId)]
  })).rows;
  return rows;
}

/** What the $15 buys, for the locked state the dashboard renders. */
async function serviceOffer() {
  const f = await fees();
  return {
    active: true,
    headline: 'BANQ AD SERVICE',
    fee_usd: f.usd,
    fee_credits: f.credits,
    period: 'per month',
    covers: 'Every campaign you run inside the paid month. Running more ads does not raise the BANQ fee.',
    unlocks: [
      'Campaign monitoring dashboard',
      'Health score and budget pacing',
      'BANQ Watch alerts',
      'Creative intelligence and fatigue detection',
      'Recommendations you approve or decline',
      'Journey and drop-off analysis',
      'Experiments and benchmarking',
      'Report cards and forecasting'
    ],
    does_not_include: 'Advertising spend. Ad packages are paid separately on QWK Browser.',
    extra_plans_note: 'Additional BANQ plans and services are purchased on newquanthoms.com.',
    plans: f.plans
  };
}

module.exports = {
  LIFECYCLE, EXTRA_STATES, OPEN_STATES, PERIOD_DAYS,
  fees, activeSubscription, monitorAccess, requireMonitorAccess,
  subscribe, confirmPayment, setStatus, listSubscriptions, serviceOffer
};
