/*
 * New Quanthoms Billboard Agency (BANQ)
 * backend/intelligence/phase2.js -- PHASE 2: UNDERSTAND
 *
 * "What changed and what should I consider?"
 *
 *   2.1 creatives       2.2 creative score   2.3 what changed?   2.4 fatigue
 *   2.5 creative battle 2.6 recommends       2.7 approval         2.8 action centre
 *
 * THE RULE THIS FILE IS BUILT AROUND, taken from Step 2.3 and applied to every
 * sentence the engine produces:
 *
 *   Separate OBSERVED FACTS from POSSIBLE CONTRIBUTING FACTORS. Never claim
 *   causation.
 *
 * So `whatChanged()` returns its findings bucketed under those exact labels,
 * and `recommend()` phrases everything as "BANQ recommends considering...",
 * because a system that says "this will improve your campaign" is making a
 * promise it cannot keep.
 */

const { db } = require('../db');
const core = require('./core');
const { cfg, logActivity, timelineAdd, pct, safeJson, parseDbDate } = core;
const p1 = require('./phase1');

const CREATIVE_TYPES = ['IMAGE', 'BANNER', 'VIDEO', 'TEXT', 'OTHER'];
const CREATIVE_STATUSES = ['active', 'paused', 'deactivated', 'replaced'];
const STATUS_ACTIONS = ['ADDED', 'PAUSED', 'RESUMED', 'REMOVED', 'REPLACED', 'BUDGET_CHANGED'];
const SCORE_STATUSES = ['STRONG', 'STABLE', 'WATCH', 'DECLINING', 'INSUFFICIENT_DATA'];
const RECOMMENDATION_TYPES = ['CREATIVE_REVIEW', 'CREATIVE_PAUSE', 'CREATIVE_TEST', 'BUDGET_REVIEW',
  'BUDGET_REALLOCATION', 'CAMPAIGN_EXTENSION', 'GOAL_REVIEW', 'PERFORMANCE_INVESTIGATION', 'MONITORING_ONLY'];
const CONFIDENCE = ['HIGH', 'MODERATE', 'EARLY_SIGNAL'];
const REC_STATUSES = ['NEW', 'VIEWED', 'APPROVED', 'DECLINED', 'DISMISSED', 'EXPIRED', 'COMPLETED'];

// ==================================================================
// 2.1 -- Creative Intelligence
// ==================================================================
async function listCreatives(campaignId) {
  const rows = (await db.execute({
    sql: `SELECT * FROM ad_creatives WHERE campaign_id = ? ORDER BY created_at ASC`,
    args: [Number(campaignId)]
  })).rows;
  const out = [];
  for (const r of rows) {
    const metrics = await creativeMetrics(r.id);
    const score = (await db.execute({
      sql: `SELECT * FROM creative_performance_scores WHERE creative_id = ? ORDER BY calculated_at DESC LIMIT 1`,
      args: [r.id]
    })).rows[0];
    out.push(Object.assign({}, r, {
      metrics,
      latest_score: score ? { score: score.score, status: score.status, calculated_at: score.calculated_at } : null
    }));
  }
  return out;
}

async function creativeMetrics(creativeId) {
  const rows = (await db.execute({
    sql: `SELECT metric_name, SUM(metric_value) AS total FROM creative_metrics WHERE creative_id = ? GROUP BY metric_name`,
    args: [Number(creativeId)]
  })).rows;
  const out = {};
  rows.forEach(function (r) { out[r.metric_name] = Number(r.total); });
  return out;
}

async function createCreative(input, actor) {
  const campaignId = Number(input.campaign_id);
  const name = String(input.creative_name || '').trim();
  if (!name) throw Object.assign(new Error('A creative needs a name.'), { code: 400 });
  const type = String(input.creative_type || 'IMAGE').toUpperCase();
  if (!CREATIVE_TYPES.includes(type)) {
    throw Object.assign(new Error('Unknown creative type. One of: ' + CREATIVE_TYPES.join(', ')), { code: 400 });
  }
  const res = await db.execute({
    sql: `INSERT INTO ad_creatives (campaign_id, creative_name, creative_type, creative_status, activated_at)
          VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)`,
    args: [campaignId, name, type]
  });
  const id = Number(res.lastInsertRowid);
  await db.execute({
    sql: `INSERT INTO creative_status_history (creative_id, action_type, actor_id, actor_type) VALUES (?, 'ADDED', ?, ?)`,
    args: [id, actor ? actor.id : null, core.noteRole(actor)]
  });
  await timelineAdd(campaignId, 'CREATIVE_ADDED', 'ADVERTISER', actor ? actor.id : null, { creative_id: id, creative_type: type });
  await logActivity(campaignId, actor ? actor.id : null, 'CREATIVE_CREATED', { creative_id: id, type });
  return { id, creative_name: name, creative_type: type };
}

async function setCreativeStatus(creativeId, action, actor, reason) {
  const a = String(action || '').toUpperCase();
  if (!STATUS_ACTIONS.includes(a)) {
    throw Object.assign(new Error('Action must be one of: ' + STATUS_ACTIONS.join(', ')), { code: 400 });
  }
  const creative = (await db.execute({ sql: `SELECT * FROM ad_creatives WHERE id = ?`, args: [Number(creativeId)] })).rows[0];
  if (!creative) throw Object.assign(new Error('Creative not found.'), { code: 404 });

  const map = { ADDED: 'active', PAUSED: 'paused', RESUMED: 'active', REMOVED: 'deactivated', REPLACED: 'replaced' };
  const nextStatus = map[a] || creative.creative_status;
  const stamp = nextStatus === 'active' ? 'activated_at' : 'deactivated_at';

  await db.execute({
    sql: `UPDATE ad_creatives SET creative_status = ?, ${stamp} = CURRENT_TIMESTAMP WHERE id = ?`,
    args: [nextStatus, Number(creativeId)]
  });
  await db.execute({
    sql: `INSERT INTO creative_status_history (creative_id, action_type, actor_id, actor_type, reason) VALUES (?, ?, ?, ?, ?)`,
    args: [Number(creativeId), a, actor ? actor.id : null, core.noteRole(actor), reason || null]
  });

  const eventMap = { ADDED: 'CREATIVE_ADDED', PAUSED: 'CREATIVE_PAUSED', RESUMED: 'CREATIVE_ADDED', REMOVED: 'CREATIVE_PAUSED', REPLACED: 'CREATIVE_ADDED' };
  await timelineAdd(creative.campaign_id, eventMap[a], 'ADVERTISER', actor ? actor.id : null,
    { creative_id: Number(creativeId), action: a, reason: reason || null });
  await logActivity(creative.campaign_id, actor ? actor.id : null, 'CREATIVE_STATUS_CHANGED',
    { creative_id: Number(creativeId), action: a });
  return { id: Number(creativeId), action: a, creative_status: nextStatus };
}

async function creativeStatusHistory(creativeId) {
  const rows = (await db.execute({
    sql: `SELECT * FROM creative_status_history WHERE creative_id = ? ORDER BY timestamp DESC`,
    args: [Number(creativeId)]
  })).rows;
  return rows.map(function (r) { return Object.assign({}, r, { metadata: safeJson(r.metadata, null) }); });
}

/** Record a metric for one creative. Used by the seed and by real delivery. */
async function recordCreativeMetric(creativeId, metricName, value, source) {
  const creative = (await db.execute({ sql: `SELECT campaign_id FROM ad_creatives WHERE id = ?`, args: [Number(creativeId)] })).rows[0];
  if (!creative) throw Object.assign(new Error('Creative not found.'), { code: 404 });
  await db.execute({
    sql: `INSERT INTO creative_metrics (creative_id, campaign_id, metric_name, metric_value, source) VALUES (?, ?, ?, ?, ?)`,
    args: [Number(creativeId), creative.campaign_id, String(metricName), Number(value), source || 'system']
  });
  return { ok: true };
}

// ==================================================================
// 2.2 -- Creative Performance Score
// ==================================================================
/**
 * Weights are goal-aware. An awareness campaign judged by conversion weight
 * would rank its best creative last, so the weights come from
 * `creative_score_weights_by_goal` when the campaign has a goal, and from the
 * general `creative_score_weights` when it does not.
 */
async function creativeScore(creative, opts) {
  const o = opts || {};
  const minImpr = await cfg('creative_min_impressions', 500);
  const minClicks = await cfg('creative_min_clicks', 50);
  const minHours = await cfg('creative_min_runtime_hours', 24);

  const metrics = await creativeMetrics(creative.id);
  const impressions = Number(metrics.impressions || 0);
  const clicks = Number(metrics.clicks || 0);
  const conversions = Number(metrics.conversions || 0);
  const spend = Number(metrics.spend || 0);
  const engagements = Number(metrics.engagements || 0);
  const runtimeHours = core.hoursBetween(creative.activated_at || creative.created_at, new Date().toISOString());

  const missing = [];
  if (impressions < minImpr) missing.push('impressions ' + impressions + '/' + minImpr);
  if (clicks < minClicks) missing.push('clicks ' + clicks + '/' + minClicks);
  if (runtimeHours !== null && runtimeHours < minHours) missing.push('runtime ' + Math.round(runtimeHours) + 'h/' + minHours + 'h');

  if (missing.length) {
    // A DEFECT THIS FIXES: this branch used to store a row with score = 0 and
    // status INSUFFICIENT_DATA. The spec says "INSUFFICIENT_DATA, no score", and
    // a stored zero is not no score -- it is the claim "this creative scored
    // zero", which later reads in history as a real collapse and drags any
    // average built from score rows. Nothing is written when there is nothing to
    // score, so the absence stays an absence.
    return {
      score: null,
      status: 'INSUFFICIENT_DATA',
      message: 'Not enough data yet to score this creative. Still needed: ' + missing.join(', ') + '.',
      metrics,
      stored: false,
      note: 'No score row is written, because a stored zero would read as a real score.'
    };
  }

  // Campaign goal selects the weight set.
  const goalRow = (await db.execute({
    sql: `SELECT goal_type FROM campaign_goals WHERE campaign_id = ? ORDER BY id ASC LIMIT 1`,
    args: [creative.campaign_id]
  })).rows[0];
  const byGoal = await cfg('creative_score_weights_by_goal', {});
  const general = await cfg('creative_score_weights', { engagement: 20, click: 25, conversion: 25, cost_efficiency: 15, goal_contribution: 10, trend: 5 });
  const weights = (goalRow && byGoal[goalRow.goal_type]) ? byGoal[goalRow.goal_type] : general;

  const ctr = impressions ? clicks / impressions : 0;
  const engagementRate = impressions ? engagements / impressions : 0;
  const conversionRate = clicks ? conversions / clicks : 0;
  const costPerConversion = conversions ? spend / conversions : null;

  // Each factor is normalised to 0-100 against reference rates, because a raw
  // rate has no scale and averaging raw rates would be meaningless.
  const factors = {
    engagement: { available: true, score: clampScore((engagementRate / 0.10) * 100), value: round4(engagementRate) },
    click: { available: true, score: clampScore((ctr / 0.02) * 100), value: round4(ctr) },
    conversion: { available: true, score: clampScore((conversionRate / 0.05) * 100), value: round4(conversionRate) },
    cost_efficiency: {
      available: costPerConversion !== null,
      score: costPerConversion === null ? null : clampScore((1 - Math.min(1, costPerConversion / 50)) * 100),
      value: costPerConversion === null ? null : round4(costPerConversion),
      note: costPerConversion === null ? 'No conversions recorded, so cost efficiency cannot be judged.' : null
    },
    goal_contribution: { available: true, score: clampScore((conversions / Math.max(1, minClicks)) * 100), value: conversions },
    trend: { available: false, score: null, note: 'Trend needs a previous period of creative metrics.' }
  };

  const trend = await creativeTrend(creative.id);
  if (trend && trend.change_pct !== null) {
    factors.trend = {
      available: true,
      score: clampScore(60 + Math.max(-60, Math.min(40, trend.change_pct))),
      change_pct: trend.change_pct
    };
  }

  let weightSum = 0, weighted = 0;
  Object.keys(factors).forEach(function (k) {
    const f = factors[k];
    const w = Number(weights[k] || 0);
    if (f.available && f.score !== null) { weightSum += w; weighted += w * f.score; }
  });

  const score = weightSum ? Math.round(weighted / weightSum) : null;
  let status = score === null ? 'INSUFFICIENT_DATA'
    : (score >= 80 ? 'STRONG' : score >= 60 ? 'STABLE' : score >= 40 ? 'WATCH' : 'DECLINING');

  // A DEFECT THIS FIXES: the score is built from RATES (CTR, conversion rate,
  // engagement rate). A creative whose delivery is collapsing keeps its rates,
  // because impressions and clicks fall together -- so it scored 95 STRONG while
  // losing most of its audience. The efficiency maths is right; the headline was
  // wrong. A sustained fall in volume is now allowed to overrule the band, and
  // the reason travels with it.
  let declining = false;
  let declineDetail = null;
  const trendFactor = factors.trend;
  if (status !== 'INSUFFICIENT_DATA' && trendFactor && trendFactor.available &&
      trendFactor.change_pct !== null && trendFactor.change_pct <= -15) {
    declining = true;
    declineDetail = (trendFactor.metric_name || 'delivery') + ' is down ' + Math.abs(trendFactor.change_pct) +
      '% per day versus the previous window, so this creative is losing reach even though its efficiency rates hold up.';
    if (status === 'STRONG' || status === 'STABLE') status = 'DECLINING';
  }

  const breakdown = { factors, weights_used: weights, weight_sum: weightSum, goal_type: goalRow ? goalRow.goal_type : null, metrics, declining, decline_detail: declineDetail };

  await db.execute({
    sql: `INSERT INTO creative_performance_scores (creative_id, score, status, factor_breakdown) VALUES (?, ?, ?, ?)`,
    args: [creative.id, score || 0, status, JSON.stringify(breakdown)]
  });
  await logActivity(creative.campaign_id, o.actorId, 'CREATIVE_SCORE_CALCULATED', { creative_id: creative.id, score, status });

  return { score, status, factor_breakdown: factors, weights_used: weights, metrics, declining, decline_detail: declineDetail };
}

function clampScore(n) { return Math.max(0, Math.min(100, Math.round(n))); }
function round4(n) { return Math.round(n * 10000) / 10000; }

/**
 * Compares RATES, not totals, and only when both windows are real.
 *
 * A SECOND DEFECT THIS FIXES: comparing raw sums across windows of different
 * lengths. With nine days of data, a "last 7 days vs previous 7 days" sum put
 * two days against seven and reported a RISING metric for a creative that was
 * falling. Each window is now divided by the days it actually covers, and a
 * window with no rows reports null rather than being treated as zero.
 */
async function creativeTrend(creativeId, periodHours) {
  const hours = Number(periodHours) || 168;
  const rows = (await db.execute({
    sql: `SELECT metric_name, metric_value, timestamp FROM creative_metrics WHERE creative_id = ? ORDER BY timestamp DESC`,
    args: [Number(creativeId)]
  })).rows;
  if (!rows.length) return null;
  const counts = {};
  rows.forEach(function (r) { counts[r.metric_name] = (counts[r.metric_name] || 0) + 1; });
  // Impressions are preferred as the volume signal when present, because they
  // describe reach rather than response.
  const metric = counts.impressions ? 'impressions'
    : Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];

  const now = Date.now();
  const recentCut = now - hours * 3600000;
  const previousCut = now - hours * 2 * 3600000;

  function windowStats(predicate) {
    const points = rows.filter(function (r) { return r.metric_name === metric; }).map(function (r) {
      const at = parseDbDate(r.timestamp);
      return at ? { t: at.getTime(), v: Number(r.metric_value) } : null;
    }).filter(Boolean).filter(predicate);
    if (!points.length) return { sum: 0, days: 0, per_day: null };
    const min = Math.min.apply(null, points.map(function (p) { return p.t; }));
    const max = Math.max.apply(null, points.map(function (p) { return p.t; }));
    const spanDays = Math.max(1, (max - min) / 86400000 + 1);
    const sum = points.reduce(function (s, p) { return s + p.v; }, 0);
    return { sum, days: spanDays, per_day: sum / spanDays };
  }

  const recent = windowStats(function (p) { return p.t > recentCut; });
  const previous = windowStats(function (p) { return p.t > previousCut && p.t <= recentCut; });

  if (!recent.per_day || !previous.per_day) {
    return {
      metric_name: metric,
      recent: Math.round(recent.sum),
      previous: previous.per_day ? Math.round(previous.sum) : null,
      change_pct: null,
      note: 'A previous window with data is needed before a trend can be stated.'
    };
  }

  const change = ((recent.per_day - previous.per_day) / previous.per_day) * 100;
  return {
    metric_name: metric,
    recent: Math.round(recent.sum),
    previous: Math.round(previous.sum),
    recent_per_day: Math.round(recent.per_day),
    previous_per_day: Math.round(previous.per_day),
    window_days: { recent: Math.round(recent.days), previous: Math.round(previous.days) },
    change_pct: Math.round(change * 10) / 10,
    basis: 'per-day rate, because the two windows can cover different spans'
  };
}

async function creativeScoreHistory(creativeId, limit) {
  const rows = (await db.execute({
    sql: `SELECT * FROM creative_performance_scores WHERE creative_id = ? ORDER BY calculated_at DESC LIMIT ?`,
    args: [Number(creativeId), Math.min(Number(limit) || 30, 200)]
  })).rows;
  return rows.map(function (r) { return Object.assign({}, r, { factor_breakdown: safeJson(r.factor_breakdown, null) }); }).reverse();
}

// ==================================================================
// 2.3 -- What Changed?
// ==================================================================
const PERIODS = { '24h': 24, '7d': 168, '30d': 720 };

/**
 * Compares two windows and reports what moved. Findings are bucketed:
 *
 *   observed               -- facts, each with both numbers
 *   possible_contributing_factors -- things that also happened in the window
 *   requires_further_review -- what would settle it
 *
 * Nothing here asserts that one caused the other, and the caller cannot
 * accidentally present a factor as a cause because the buckets are separate
 * fields.
 */
async function whatChanged(campaign, opts) {
  const o = opts || {};
  const key = String(o.period || '7d');
  const hours = PERIODS[key] || Number(o.period_hours) || 168;
  const now = Date.now();
  const recentFrom = now - hours * 3600000;
  const previousFrom = now - 2 * hours * 3600000;

  const metricRows = (await db.execute({
    sql: `SELECT metric_name, metric_value, timestamp FROM campaign_metrics WHERE campaign_id = ?`,
    args: [campaign.id]
  })).rows;

  const observed = [];
  const byMetric = {};
  metricRows.forEach(function (r) {
    const at = parseDbDate(r.timestamp);
    if (!at) return;
    const t = at.getTime();
    if (t < previousFrom) return;
    if (!byMetric[r.metric_name]) byMetric[r.metric_name] = { recent: [], previous: [] };
    const bucket = t >= recentFrom ? 'recent' : 'previous';
    byMetric[r.metric_name][bucket].push({ t: t, v: Number(r.metric_value) });
  });

  /** Per-day rate, so two windows of different spans can be compared honestly. */
  function rate(points) {
    if (!points.length) return null;
    const min = Math.min.apply(null, points.map(function (p) { return p.t; }));
    const max = Math.max.apply(null, points.map(function (p) { return p.t; }));
    const days = Math.max(1, (max - min) / 86400000 + 1);
    const sum = points.reduce(function (s, p) { return s + p.v; }, 0);
    return { sum: sum, days: days, per_day: sum / days };
  }

  Object.keys(byMetric).forEach(function (m) {
    const recent = rate(byMetric[m].recent);
    const previous = rate(byMetric[m].previous);
    if (!recent && !previous) return;
    if (!previous || !recent) {
      observed.push({
        metric: m, change_pct: null, direction: 'NEW_DATA',
        detail: m + ' has data in ' + (recent ? 'this period but none in the previous one' : 'only the previous period') +
          ', so a percentage change cannot be stated.'
      });
      return;
    }
    // THE FIX: compare per-day rates. Summing each window and dividing nothing
    // put a 5-day total against a 7-day total and reported a RISE for a metric
    // that was falling -- the precise failure this step exists to avoid.
    const change = ((recent.per_day - previous.per_day) / previous.per_day) * 100;
    const rounded = Math.round(change * 10) / 10;
    if (Math.abs(rounded) < 1) return; // a sub-1% move is noise, not a finding
    observed.push({
      metric: m,
      previous_value: Math.round(previous.sum),
      recent_value: Math.round(recent.sum),
      previous_per_day: Math.round(previous.per_day),
      recent_per_day: Math.round(recent.per_day),
      window_days: { recent: Math.round(recent.days), previous: Math.round(previous.days) },
      change_pct: rounded,
      direction: rounded > 0 ? 'INCREASE' : 'DECREASE',
      detail: m + ' ' + (rounded > 0 ? 'increased' : 'decreased') + ' by ' + Math.abs(rounded) +
        '% per day versus the previous period (' + Math.round(previous.per_day) + ' to ' + Math.round(recent.per_day) + ' per day).',
      basis: 'per-day rate, because the two windows can cover different spans'
    });
  });

  // Timeline events inside the window are candidate factors, never causes.
  const events = (await db.execute({
    sql: `SELECT event_type, metadata, timestamp FROM campaign_timeline
          WHERE campaign_id = ? AND timestamp >= datetime('now', ?) ORDER BY timestamp DESC`,
    args: [campaign.id, '-' + (hours * 2) + ' hours']
  })).rows;

  const possibleFactors = [];
  const factorMap = {
    CREATIVE_ADDED: 'A creative was added or resumed during the window.',
    CREATIVE_PAUSED: 'A creative was paused or removed during the window.',
    BUDGET_CHANGED: 'The campaign budget changed during the window.',
    GOAL_UPDATED: 'A campaign goal was changed during the window.',
    CAMPAIGN_PAUSED: 'The campaign was paused during the window.',
    CAMPAIGN_RESUMED: 'The campaign was resumed during the window.',
    ALERT_GENERATED: 'BANQ raised an alert during the window.'
  };
  const seen = {};
  events.forEach(function (e) {
    if (!factorMap[e.event_type] || seen[e.event_type]) return;
    seen[e.event_type] = true;
    possibleFactors.push({ event_type: e.event_type, statement: factorMap[e.event_type], at: e.timestamp });
  });

  // A creative whose own numbers fell in the same window is the strongest
  // candidate factor, and it is still only a candidate.
  const creatives = (await db.execute({
    sql: `SELECT * FROM ad_creatives WHERE campaign_id = ?`,
    args: [campaign.id]
  })).rows;
  for (const c of creatives) {
    const t = await creativeTrend(c.id, hours);
    if (t && t.change_pct !== null && t.change_pct < 0) {
      possibleFactors.push({
        event_type: 'CREATIVE_DECLINE',
        statement: c.creative_name + ' also showed declining ' + t.metric_name + ' during the same period (' + t.change_pct + '%).',
        creative_id: c.id
      });
    }
  }

  const requiresReview = [];
  observed.forEach(function (o1) {
    if (o1.direction === 'DECREASE') {
      requiresReview.push('Whether the change in ' + o1.metric + ' is caused by delivery, creative, or audience, which BANQ cannot determine from its own data alone.');
    }
  });
  if (!possibleFactors.length && observed.length) {
    requiresReview.push('No campaign event coincides with this window, so the change may originate outside BANQ tracking.');
  }

  await logActivity(campaign.id, o.actorId, 'WHAT_CHANGED_VIEWED', { period: key, observed: observed.length });

  return {
    period: key,
    window: { recent_from: new Date(recentFrom).toISOString(), previous_from: new Date(previousFrom).toISOString(), hours },
    observed,
    possible_contributing_factors: possibleFactors,
    requires_further_review: requiresReview,
    disclaimer: 'Observed facts are measurements. Possible contributing factors are things that also happened in the window and are not asserted as causes.'
  };
}

// ==================================================================
// 2.4 -- Ad Fatigue Detector
// ==================================================================
/**
 * Fatigue is a claim about a pattern, so it is only made when the pattern
 * actually exists: enough active days, enough impressions, a decline at least
 * as large as the configured threshold, sustained for the configured number of
 * consecutive periods. Below any of those, the detector says nothing -- which
 * is different from saying "no fatigue".
 */
async function detectFatigue(campaign, opts) {
  const o = opts || {};
  const minDays = await cfg('fatigue_min_active_days', 5);
  const minImpressions = await cfg('fatigue_min_impressions', 1000);
  const declineThreshold = await cfg('fatigue_decline_threshold', 15);
  const consecutiveNeeded = await cfg('fatigue_consecutive_decline_periods', 3);

  const creatives = (await db.execute({
    sql: `SELECT * FROM ad_creatives WHERE campaign_id = ? AND creative_status = 'active'`,
    args: [campaign.id]
  })).rows;

  const findings = [];
  for (const c of creatives) {
    const metrics = await creativeMetrics(c.id);
    const impressions = Number(metrics.impressions || 0);
    const runtimeHours = core.hoursBetween(c.activated_at || c.created_at, new Date().toISOString());
    const activeDays = runtimeHours === null ? 0 : runtimeHours / 24;

    if (activeDays < minDays || impressions < minImpressions) {
      findings.push({
        creative_id: c.id, creative_name: c.creative_name, state: 'NOT_ENOUGH_DATA',
        detail: 'Fatigue cannot be judged yet: ' + Math.round(activeDays) + ' active day(s) of a required ' + minDays +
          ', and ' + impressions + ' impressions of a required ' + minImpressions + '.'
      });
      continue;
    }

    const periods = await creativePeriodSeries(c.id, consecutiveNeeded + 2);
    let streaks = 0, worst = 0, evaluated = 0;
    for (const p of periods) {
      // A DEFECT THIS FIXES: a period whose earlier window has no data was
      // resetting the streak to zero. That treated "we have not been running
      // that long" as "the decline stopped", which silently hid fatigue from
      // every young creative -- exactly the ones most exposed to it. Such a
      // period is SKIPPED; only a period that actually fell short breaks the
      // streak, and the streak must be built from periods that were measured.
      if (p.previous === null) continue;
      evaluated++;
      const change = ((p.recent - p.previous) / p.previous) * 100;
      if (change <= -declineThreshold) { streaks++; worst = Math.min(worst, change); }
      else streaks = 0;
      if (streaks >= consecutiveNeeded) break;
    }

    if (streaks >= consecutiveNeeded && evaluated >= consecutiveNeeded) {
      const existing = (await db.execute({
        sql: `SELECT id FROM creative_fatigue_events WHERE creative_id = ? AND resolved_at IS NULL ORDER BY detected_at DESC LIMIT 1`,
        args: [c.id]
      })).rows[0];
      if (!existing) {
        await db.execute({
          sql: `INSERT INTO creative_fatigue_events (creative_id, campaign_id, state, metadata) VALUES (?, ?, 'POSSIBLE_FATIGUE', ?)`,
          args: [c.id, campaign.id, JSON.stringify({ consecutive_declining_periods: streaks, worst_change_pct: Math.round(worst), impressions })]
        });
        await logActivity(campaign.id, o.actorId, 'FATIGUE_DETECTED', { creative_id: c.id, worst_change_pct: Math.round(worst) });
      }
      findings.push({
        creative_id: c.id, creative_name: c.creative_name, state: 'POSSIBLE_FATIGUE',
        consecutive_declining_periods: streaks,
        worst_change_pct: Math.round(worst),
        detail: c.creative_name + ' has declined for ' + streaks + ' consecutive periods (worst ' + Math.round(worst) + '%), against a threshold of ' + declineThreshold + '%.',
        language_note: 'Declining response alongside high exposure is consistent with fatigue. It does not prove it.'
      });
    } else {
      findings.push({
        creative_id: c.id, creative_name: c.creative_name, state: 'NO_FATIGUE_SIGNAL',
        detail: c.creative_name + ' shows no sustained decline meeting the configured threshold.',
        declining_periods: streaks, evaluated_periods: evaluated, required: consecutiveNeeded
      });
    }
  }

  return { threshold_pct: declineThreshold, consecutive_required: consecutiveNeeded, findings };
}

async function creativePeriodSeries(creativeId, periods, periodHours) {
  const hours = Number(periodHours) || 72;
  const rows = (await db.execute({
    sql: `SELECT metric_name, metric_value, timestamp FROM creative_metrics WHERE creative_id = ?`,
    args: [Number(creativeId)]
  })).rows;
  const counts = {};
  rows.forEach(function (r) { counts[r.metric_name] = (counts[r.metric_name] || 0) + 1; });
  const metric = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
  if (!metric) return [];
  const now = Date.now();
  const out = [];
  const n = Number(periods) || 3;
  for (let i = 0; i < n; i++) {
    const from = now - (i + 1) * hours * 3600000;
    const to = now - i * hours * 3600000;
    let recent = 0, previous = 0;
    rows.filter(function (r) { return r.metric_name === metric; }).forEach(function (r) {
      const at = parseDbDate(r.timestamp);
      if (!at) return;
      const t = at.getTime();
      if (t >= from && t < to) recent += Number(r.metric_value);
      const prevFrom = from - hours * 3600000;
      if (t >= prevFrom && t < from) previous += Number(r.metric_value);
    });
    out.push({ metric_name: metric, period_index: i, recent, previous: previous || null });
  }
  return out;
}

async function fatigueEvents(campaignId) {
  const rows = (await db.execute({
    sql: `SELECT f.*, c.creative_name FROM creative_fatigue_events f
          LEFT JOIN ad_creatives c ON c.id = f.creative_id
          WHERE f.campaign_id = ? ORDER BY f.detected_at DESC`,
    args: [Number(campaignId)]
  })).rows;
  return rows.map(function (r) { return Object.assign({}, r, { metadata: safeJson(r.metadata, null) }); });
}

async function resolveFatigue(eventId, actor) {
  const ev = (await db.execute({ sql: `SELECT * FROM creative_fatigue_events WHERE id = ?`, args: [Number(eventId)] })).rows[0];
  if (!ev) throw Object.assign(new Error('Fatigue event not found.'), { code: 404 });
  await db.execute({
    sql: `UPDATE creative_fatigue_events SET state = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`,
    args: [Number(eventId)]
  });
  await logActivity(ev.campaign_id, actor ? actor.id : null, 'FATIGUE_RESOLVED', { event_id: Number(eventId) });
  return { id: Number(eventId), state: 'RESOLVED' };
}

// ==================================================================
// 2.5 -- Creative Battle
// ==================================================================
/**
 * Ranks creatives against each other, but refuses to name a leader when the
 * minimum-data rules are not met -- a table where the only available creative
 * is "winning" is a table that misleads.
 */
async function creativeBattle(campaign, opts) {
  const o = opts || {};
  const creatives = (await db.execute({
    sql: `SELECT * FROM ad_creatives WHERE campaign_id = ?`,
    args: [campaign.id]
  })).rows;

  const only = Array.isArray(o.creative_ids) && o.creative_ids.length
    ? creatives.filter(function (c) { return o.creative_ids.map(Number).includes(Number(c.id)); })
    : creatives;

  const scored = [];
  for (const c of only) {
    const s = await creativeScore(c, { skip_store: true });
    const metrics = await creativeMetrics(c.id);
    scored.push({
      creative_id: c.id,
      creative_name: c.creative_name,
      creative_type: c.creative_type,
      status: c.creative_status,
      score: s.score,
      score_status: s.status,
      metrics,
      ctr: metrics.impressions ? round4(Number(metrics.clicks || 0) / Number(metrics.impressions)) : null,
      conversion_rate: metrics.clicks ? round4(Number(metrics.conversions || 0) / Number(metrics.clicks)) : null
    });
  }

  const rankable = scored.filter(function (s) { return s.score !== null; });
  rankable.sort(function (a, b) { return b.score - a.score; });
  rankable.forEach(function (s, i) { s.rank = i + 1; });

  const unranked = scored.filter(function (s) { return s.score === null; }).map(function (s) {
    return { creative_id: s.creative_id, creative_name: s.creative_name, note: 'Not ranked: insufficient data to score.' };
  });

  await logActivity(campaign.id, o.actorId, 'CREATIVE_BATTLE_VIEWED', { ranked: rankable.length, unranked: unranked.length });

  return {
    ranked: rankable,
    unranked,
    leader: rankable.length > 1 ? rankable[0].creative_name : null,
    statement: rankable.length > 1
      ? rankable[0].creative_name + ' currently leads on the configured performance score.'
      : 'A leader cannot be named: at least two creatives with sufficient data are needed to compare.',
    disclaimer: 'Ranking is on this campaign\'s configured weights, not a prediction of future performance.'
  };
}

// ==================================================================
// 2.6 -- BANQ Recommends
// ==================================================================
async function listRecommendations(campaignId, opts) {
  const o = opts || {};
  const clauses = ['campaign_id = ?'];
  const args = [Number(campaignId)];
  if (o.status) { clauses.push('status = ?'); args.push(String(o.status).toUpperCase()); }
  const rows = (await db.execute({
    sql: `SELECT * FROM banq_recommendations WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT ?`,
    args: args.concat([Math.min(Number(o.limit) || 100, 300)])
  })).rows;
  return rows.map(function (r) { return Object.assign({}, r, { supporting_data: safeJson(r.supporting_data, null) }); });
}

async function createRecommendation(input, actor) {
  const type = String(input.recommendation_type || '').toUpperCase();
  if (!RECOMMENDATION_TYPES.includes(type)) {
    throw Object.assign(new Error('Unknown recommendation type. One of: ' + RECOMMENDATION_TYPES.join(', ')), { code: 400 });
  }
  const confidence = String(input.confidence_level || 'MODERATE').toUpperCase();
  const res = await db.execute({
    sql: `INSERT INTO banq_recommendations
          (campaign_id, recommendation_type, title, description, reason, supporting_data, confidence_level, source, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      Number(input.campaign_id), type, String(input.title || '').trim(),
      input.description || null, input.reason || null,
      input.supporting_data ? JSON.stringify(input.supporting_data) : null,
      CONFIDENCE.includes(confidence) ? confidence : 'MODERATE',
      String(input.source || 'SYSTEM').toUpperCase(),
      input.expires_at || null
    ]
  });
  const id = Number(res.lastInsertRowid);
  await timelineAdd(Number(input.campaign_id), 'RECOMMENDATION_CREATED', 'BANQ', actor ? actor.id : null, { recommendation_id: id, type });
  await logActivity(Number(input.campaign_id), actor ? actor.id : null, 'RECOMMENDATION_CREATED', { recommendation_id: id, type });
  return { id, recommendation_type: type };
}

/**
 * Generate recommendations from what the campaign data actually shows. Each one
 * carries the reason it exists and the data behind it, because "BANQ recommends
 * considering..." without a why is just an opinion with a logo on it.
 */
async function generateRecommendations(campaign, actor) {
  const pacer = await p1.budgetPacer(campaign, {});
  const fatigue = await detectFatigue(campaign, { actorId: actor ? actor.id : null });
  const trend = await p1.performanceTrend(campaign.id);
  const health = await p1.calculateHealth(campaign, null);

  const proposed = [];

  if (pacer.state === 'AT_RISK' || pacer.state === 'SPENDING_FAST') {
    proposed.push({
      recommendation_type: 'BUDGET_REVIEW',
      title: 'Review the budget pace',
      description: 'BANQ recommends considering a budget review, because spend is running ahead of the campaign timeline.',
      reason: 'Pacing state is ' + pacer.state + ' at ' + pacer.pacing_ratio_pct + '% of expected spend.',
      confidence_level: pacer.state === 'AT_RISK' ? 'HIGH' : 'MODERATE',
      supporting_data: { pacer }
    });
  }
  if (pacer.state === 'SPENDING_SLOW') {
    proposed.push({
      recommendation_type: 'PERFORMANCE_INVESTIGATION',
      title: 'Investigate the under-spend',
      description: 'BANQ recommends considering wider visibility or refreshed creative, because the campaign is under-spending.',
      reason: 'Pacing state is SPENDING_SLOW at ' + pacer.pacing_ratio_pct + '% of expected spend.',
      confidence_level: 'MODERATE',
      supporting_data: { pacer }
    });
  }

  const fatigued = fatigue.findings.filter(function (f) { return f.state === 'POSSIBLE_FATIGUE'; });
  fatigued.forEach(function (f) {
    proposed.push({
      recommendation_type: 'CREATIVE_REVIEW',
      title: 'Review ' + f.creative_name,
      description: 'BANQ recommends considering a creative review for ' + f.creative_name + '.',
      reason: f.detail,
      confidence_level: 'EARLY_SIGNAL',
      supporting_data: { creative_id: f.creative_id, consecutive_declining_periods: f.consecutive_declining_periods }
    });
  });

  if (trend && trend.change_pct !== null && trend.change_pct <= -15) {
    proposed.push({
      recommendation_type: 'PERFORMANCE_INVESTIGATION',
      title: 'Investigate the performance drop',
      description: 'BANQ recommends considering an investigation into the recent fall in ' + trend.metric_name + '.',
      reason: trend.metric_name + ' fell ' + Math.abs(trend.change_pct) + '% versus the previous period.',
      confidence_level: trend.change_pct <= -30 ? 'HIGH' : 'MODERATE',
      supporting_data: { trend }
    });
  }

  if (!proposed.length) {
    proposed.push({
      recommendation_type: 'MONITORING_ONLY',
      title: 'Continue monitoring',
      description: 'BANQ recommends considering no change at this time and continuing monitoring.',
      reason: 'Health is ' + health.status + ' and no pacing, fatigue or trend signal crossed its threshold.',
      confidence_level: 'MODERATE',
      supporting_data: { health_score: health.score, pacing: pacer.state }
    });
  }

  const existing = (await db.execute({
    sql: `SELECT recommendation_type, title FROM banq_recommendations WHERE campaign_id = ? AND status IN ('NEW','VIEWED')`,
    args: [campaign.id]
  })).rows;

  const created = [];
  const skipped = [];
  for (const p of proposed) {
    const dup = existing.find(function (e) { return e.recommendation_type === p.recommendation_type && e.title === p.title; });
    if (dup) { skipped.push({ type: p.recommendation_type, reason: 'already_open' }); continue; }
    const r = await createRecommendation(Object.assign({ campaign_id: campaign.id, source: 'SYSTEM' }, p), actor);
    created.push(r);
  }

  return { proposed: proposed.length, created, skipped };
}

// ==================================================================
// 2.7 -- Recommendation Approval Flow
// ==================================================================
/**
 * No campaign-changing action happens silently. A recommendation moves through
 * NEW -> VIEWED -> APPROVED/DECLINED, every transition is recorded in both
 * recommendation_history (where it came from and went to) and
 * recommendation_actions (who did it), and the timeline gets the event.
 */
async function setRecommendationStatus(recommendationId, status, actor, note) {
  const s = String(status || '').toUpperCase();
  if (!REC_STATUSES.includes(s)) {
    throw Object.assign(new Error('Status must be one of: ' + REC_STATUSES.join(', ')), { code: 400 });
  }
  const rec = (await db.execute({ sql: `SELECT * FROM banq_recommendations WHERE id = ?`, args: [Number(recommendationId)] })).rows[0];
  if (!rec) throw Object.assign(new Error('Recommendation not found.'), { code: 404 });

  const from = rec.status;
  const extra = [];
  const args = [];
  if (s === 'APPROVED' || s === 'COMPLETED') { extra.push('expires_at = NULL'); }
  await db.execute({
    sql: `UPDATE banq_recommendations SET status = ?${extra.length ? ', ' + extra.join(', ') : ''} WHERE id = ?`,
    args: args.concat([s, Number(recommendationId)])
  });
  await db.execute({
    sql: `INSERT INTO recommendation_history (recommendation_id, status_from, status_to, changed_by) VALUES (?, ?, ?, ?)`,
    args: [Number(recommendationId), from, s, actor ? actor.id : null]
  });
  await db.execute({
    sql: `INSERT INTO recommendation_actions (recommendation_id, action_type, actor_id, metadata) VALUES (?, ?, ?, ?)`,
    args: [Number(recommendationId), s, actor ? actor.id : null, note ? JSON.stringify({ note }) : null]
  });
  await timelineAdd(rec.campaign_id, 'RECOMMENDATION_' + s, core.noteRole(actor).startsWith('BANQ') ? 'BANQ' : 'ADVERTISER',
    actor ? actor.id : null, { recommendation_id: Number(recommendationId), from, to: s });
  await logActivity(rec.campaign_id, actor ? actor.id : null, 'RECOMMENDATION_UPDATED', { recommendation_id: Number(recommendationId), from, to: s });
  return { id: Number(recommendationId), status_from: from, status_to: s };
}

async function recommendationHistory(recommendationId) {
  const history = (await db.execute({
    sql: `SELECT * FROM recommendation_history WHERE recommendation_id = ? ORDER BY changed_at ASC`,
    args: [Number(recommendationId)]
  })).rows;
  const actions = (await db.execute({
    sql: `SELECT * FROM recommendation_actions WHERE recommendation_id = ? ORDER BY timestamp ASC`,
    args: [Number(recommendationId)]
  })).rows;
  return { history, actions: actions.map(function (a) { return Object.assign({}, a, { metadata: safeJson(a.metadata, null) }); }) };
}

// ==================================================================
// 2.8 -- BANQ Action Center
// ==================================================================
/** One workspace where everything needing a decision is visible together. */
async function actionCenter(campaign, opts) {
  const o = opts || {};
  const [recommendations, alerts, fatigue, battle, changed, health] = await Promise.all([
    listRecommendations(campaign.id, { status: 'NEW' }),
    p1.listAlerts(campaign.id, { status: 'NEW' }),
    fatigueEvents(campaign.id),
    creativeBattle(campaign, { actorId: o.actorId }),
    whatChanged(campaign, { period: '7d' }),
    p1.calculateHealth(campaign, null)
  ]);

  const openFatigue = fatigue.filter(function (f) { return !f.resolved_at; });

  return {
    campaign_id: campaign.id,
    campaign_name: campaign.campaign_name,
    health: { score: health.score, status: health.status, message: health.message },
    needs_decision: {
      recommendations: recommendations.map(function (r) {
        return {
          id: r.id, type: r.recommendation_type, title: r.title, reason: r.reason,
          confidence: r.confidence_level, source: r.source
        };
      }),
      alerts: alerts.map(function (a) {
        return { id: a.id, type: a.alert_type, severity: a.severity, message: a.message };
      }),
      fatigue: openFatigue.map(function (f) {
        return { id: f.id, creative_name: f.creative_name, state: f.state, metadata: f.metadata };
      })
    },
    informative: {
      leader: battle.leader,
      leader_statement: battle.statement,
      observed_changes: changed.observed,
      possible_factors: changed.possible_contributing_factors
    },
    next_step: recommendations.length
      ? 'Review the ' + recommendations.length + ' open recommendation(s) and approve, decline or dismiss each one.'
      : (alerts.length ? 'Acknowledge the open alerts so the work queue reflects reality.' : 'No decision is waiting. Continue monitoring.'),
    generated_at: new Date().toISOString()
  };
}

module.exports = {
  CREATIVE_TYPES, CREATIVE_STATUSES, STATUS_ACTIONS, SCORE_STATUSES, RECOMMENDATION_TYPES, CONFIDENCE, REC_STATUSES, PERIODS,
  listCreatives, creativeMetrics, createCreative, setCreativeStatus, creativeStatusHistory, recordCreativeMetric,
  creativeScore, creativeScoreHistory, creativeTrend,
  whatChanged,
  detectFatigue, fatigueEvents, resolveFatigue, creativePeriodSeries,
  creativeBattle,
  listRecommendations, createRecommendation, generateRecommendations,
  setRecommendationStatus, recommendationHistory,
  actionCenter
};
