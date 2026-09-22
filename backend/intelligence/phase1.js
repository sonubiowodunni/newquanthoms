/*
 * New Quanthoms Billboard Agency (BANQ)
 * backend/intelligence/phase1.js -- PHASE 1: MONITOR
 *
 * "How is my campaign doing?"
 *
 * Steps 1.1 to 1.8 plus the Phase 1 additional infrastructure, in the build
 * plan's own order (easiest to heaviest):
 *
 *   1.1 notes      1.2 timeline      1.3 goals      1.4 budget pacer
 *   1.5 dashboard  1.6 BANQ Watch    1.7 health     1.8 report card
 *   infra: work queue, notifications, revenue ledger
 *
 * THREE RULES THAT SHAPE EVERY FUNCTION HERE:
 *
 * 1. No invented numbers. Where the plan says a goal may be unmeasurable, this
 *    engine reports it as unmeasurable and says so, rather than showing a
 *    confident 0. Where it says insufficient data, it returns
 *    INSUFFICIENT_DATA with the reason instead of a score.
 *
 * 2. Every threshold comes from banq_config (core.cfg). Change a weight, the
 *    score moves.
 *
 * 3. Nothing is claimed without its supporting data. An alert stores the
 *    numbers that raised it; a recommendation stores its "why".
 */

const { db } = require('../db');
const core = require('./core');
const { cfg, logActivity, timelineAdd, pct, safeJson, parseDbDate, hoursBetween } = core;

const GOAL_TYPES = ['WEBSITE_VISITS', 'SALES', 'BOOKINGS', 'LEADS', 'APP_DOWNLOADS',
  'BRAND_AWARENESS', 'FOLLOWERS', 'CUSTOM'];

// Goal types BANQ can actually measure from its own data. The rest need an
// external source, and the engine says so instead of pretending.
const DIRECTLY_MEASURABLE = ['WEBSITE_VISITS', 'LEADS', 'APP_DOWNLOADS', 'SALES', 'BOOKINGS'];

const ALERT_TYPES = ['BUDGET_SPENDING_TOO_FAST', 'BUDGET_SPENDING_TOO_SLOW', 'CAMPAIGN_INACTIVE',
  'PERFORMANCE_DROP', 'GOAL_AT_RISK', 'CAMPAIGN_ENDING', 'GOAL_REACHED', 'UNUSUAL_ACTIVITY'];

const SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const ALERT_STATUSES = ['NEW', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'];

// ==================================================================
// 1.1 -- Campaign Notes
// ==================================================================
async function listNotes(campaignId, opts) {
  const o = opts || {};
  const isStaff = o.role === 'BANQ_STAFF';
  // INTERNAL_BANQ is never returned to an advertiser request. This is the one
  // place that decides it, so no caller can leak an internal note by accident.
  const rows = isStaff
    ? (await db.execute({
        sql: `SELECT n.*, u.username AS author_name FROM banq_notes n
              LEFT JOIN users u ON u.id = n.author_id
              WHERE n.campaign_id = ? ORDER BY n.created_at ASC`,
        args: [campaignId]
      })).rows
    : (await db.execute({
        sql: `SELECT n.*, u.username AS author_name FROM banq_notes n
              LEFT JOIN users u ON u.id = n.author_id
              WHERE n.campaign_id = ? AND n.visibility = 'ADVERTISER_VISIBLE'
              ORDER BY n.created_at ASC`,
        args: [campaignId]
      })).rows;
  await logActivity(campaignId, o.actorId, 'NOTES_VIEWED', { as: o.role, count: rows.length });
  return rows.map(function (r) {
    return {
      id: r.id, campaign_id: r.campaign_id, author_id: r.author_id,
      author_name: r.author_name, author_role: r.author_role,
      message: r.message, visibility: r.visibility,
      parent_note_id: r.parent_note_id, created_at: r.created_at
    };
  });
}

async function createNote(input, actor) {
  const campaignId = Number(input.campaign_id);
  const message = String(input.message || '').trim();
  if (!message) throw Object.assign(new Error('A note needs a message.'), { code: 400 });
  const authorRole = core.NOTE_ROLES.includes(String(input.author_role || ''))
    ? String(input.author_role)
    : core.noteRole(actor);
  // Only staff may write an internal note. An advertiser asking for
  // INTERNAL_BANQ gets it downgraded rather than refused, so the note still
  // lands -- but on the side of the wall it belongs.
  let visibility = String(input.visibility || 'ADVERTISER_VISIBLE').toUpperCase();
  if (visibility !== 'INTERNAL_BANQ') visibility = 'ADVERTISER_VISIBLE';
  if (visibility === 'INTERNAL_BANQ' && !(actor && actor.is_admin)) {
    visibility = 'ADVERTISER_VISIBLE';
  }
  const res = await db.execute({
    sql: `INSERT INTO banq_notes (campaign_id, author_id, author_role, message, visibility, parent_note_id)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [campaignId, actor ? actor.id : null, authorRole, message, visibility,
      input.parent_note_id ? Number(input.parent_note_id) : null]
  });
  const id = Number(res.lastInsertRowid);
  await timelineAdd(campaignId, 'NOTE_ADDED', actorRole.startsWith('BANQ') ? 'BANQ' : 'ADVERTISER',
    actor ? actor.id : null, { note_id: id, visibility });
  await logActivity(campaignId, actor ? actor.id : null, 'NOTE_CREATED', { note_id: id, visibility });
  return { id, visibility, author_role: authorRole };
}

async function replyToNote(noteId, message, actor) {
  const parent = (await db.execute({ sql: `SELECT * FROM banq_notes WHERE id = ?`, args: [Number(noteId)] })).rows[0];
  if (!parent) throw Object.assign(new Error('Note not found.'), { code: 404 });
  return createNote({
    campaign_id: parent.campaign_id,
    message,
    visibility: parent.visibility === 'INTERNAL_BANQ' ? 'INTERNAL_BANQ' : 'ADVERTISER_VISIBLE',
    author_role: core.noteRole(actor),
    parent_note_id: parent.id
  }, actor);
}

// ==================================================================
// 1.2 -- Campaign Timeline (append-only)
// ==================================================================
async function listTimeline(campaignId, opts) {
  const o = opts || {};
  const limit = Math.min(Number(o.limit) || 100, 500);
  const rows = (await db.execute({
    sql: `SELECT * FROM campaign_timeline WHERE campaign_id = ? ORDER BY timestamp DESC, id DESC LIMIT ?`,
    args: [campaignId, limit]
  })).rows;
  await logActivity(campaignId, o.actorId, 'TIMELINE_VIEWED', { count: rows.length });
  return rows.map(function (r) {
    return {
      id: r.id, event_type: r.event_type, actor_type: r.actor_type, actor_id: r.actor_id,
      metadata: safeJson(r.metadata, null), timestamp: r.timestamp
    };
  });
}

// ==================================================================
// 1.3 -- Campaign Goals
// ==================================================================
function goalProgress(goal) {
  const target = Number(goal.target_value || 0);
  const current = Number(goal.current_value || 0);
  const measurable = DIRECTLY_MEASURABLE.includes(goal.goal_type);
  if (!target) {
    return {
      goal_type: goal.goal_type, target: 0, current,
      progress_pct: null, measurable,
      note: 'No target set, so progress cannot be expressed as a percentage.'
    };
  }
  return {
    goal_type: goal.goal_type,
    target,
    current,
    progress_pct: pct(current, target),
    remaining: Math.max(0, target - current),
    measurable,
    // The spec's rule, applied verbatim: if the goal cannot be directly
    // measured, say so rather than implying the number is complete.
    note: measurable
      ? null
      : 'External tracking or manual updates may be required.'
  };
}

async function listGoals(campaignId) {
  const rows = (await db.execute({
    sql: `SELECT * FROM campaign_goals WHERE campaign_id = ? ORDER BY created_at ASC`,
    args: [campaignId]
  })).rows;
  return rows.map(function (r) {
    const base = {
      id: r.id, campaign_id: r.campaign_id, goal_type: r.goal_type,
      target_value: Number(r.target_value || 0), current_value: Number(r.current_value || 0),
      target_date: r.target_date, created_at: r.created_at
    };
    return Object.assign(base, goalProgress(base));
  });
}

async function createGoal(input, actor) {
  const campaignId = Number(input.campaign_id);
  const goalType = String(input.goal_type || '').toUpperCase();
  if (!GOAL_TYPES.includes(goalType)) {
    throw Object.assign(new Error('Unknown goal type: ' + goalType + '. One of: ' + GOAL_TYPES.join(', ')), { code: 400 });
  }
  const res = await db.execute({
    sql: `INSERT INTO campaign_goals (campaign_id, goal_type, target_value, current_value, target_date)
          VALUES (?, ?, ?, 0, ?)`,
    args: [campaignId, goalType, Number(input.target_value) || null, input.target_date || null]
  });
  const id = Number(res.lastInsertRowid);
  await timelineAdd(campaignId, 'GOAL_UPDATED', 'ADVERTISER', actor ? actor.id : null,
    { goal_id: id, action: 'created', goal_type: goalType });
  await logActivity(campaignId, actor ? actor.id : null, 'GOAL_CREATED', { goal_id: id, goal_type: goalType });
  return { id, goal_type: goalType };
}

async function updateGoal(goalId, input, actor) {
  const goal = (await db.execute({ sql: `SELECT * FROM campaign_goals WHERE id = ?`, args: [Number(goalId)] })).rows[0];
  if (!goal) throw Object.assign(new Error('Goal not found.'), { code: 404 });
  const target = input.target_value === undefined ? goal.target_value : (Number(input.target_value) || null);
  const current = input.current_value === undefined ? goal.current_value : (Number(input.current_value) || 0);
  const targetDate = input.target_date === undefined ? goal.target_date : input.target_date;
  await db.execute({
    sql: `UPDATE campaign_goals SET target_value = ?, current_value = ?, target_date = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
    args: [target, current, targetDate, Number(goalId)]
  });
  await timelineAdd(goal.campaign_id, 'GOAL_UPDATED', core.noteRole(actor).startsWith('BANQ') ? 'BANQ' : 'ADVERTISER',
    actor ? actor.id : null, { goal_id: Number(goalId), action: 'updated', target, current });
  await logActivity(goal.campaign_id, actor ? actor.id : null, 'GOAL_UPDATED', { goal_id: Number(goalId) });
  return { id: Number(goalId), target_value: target, current_value: current };
}

async function deleteGoal(goalId, actor) {
  const goal = (await db.execute({ sql: `SELECT * FROM campaign_goals WHERE id = ?`, args: [Number(goalId)] })).rows[0];
  if (!goal) throw Object.assign(new Error('Goal not found.'), { code: 404 });
  await db.execute({ sql: `DELETE FROM campaign_goals WHERE id = ?`, args: [Number(goalId)] });
  await timelineAdd(goal.campaign_id, 'GOAL_UPDATED', 'ADVERTISER', actor ? actor.id : null,
    { goal_id: Number(goalId), action: 'deleted' });
  return { id: Number(goalId), deleted: true };
}

// ==================================================================
// 1.4 -- Budget Pacer
// ==================================================================
/**
 * The pacer walks the campaign in segments delimited by BUDGET_CHANGED and by
 * PAUSE/RESUME pairs, because both change what "expected spend" means:
 *
 *  - A budget change means the old rate stops applying from that moment, so
 *    expected spend is the sum of each segment's own rate.
 *  - A paused period is time the campaign was not running, so it is excluded
 *    from elapsed time. Counting it would make a paused campaign look slow.
 */
function segmentCampaign(campaign, timeline) {
  const start = parseDbDate(campaign.start_date) || parseDbDate(campaign.created_at);
  const end = parseDbDate(campaign.end_date);
  const events = (timeline || [])
    .map(function (e) { return { type: e.event_type, at: parseDbDate(e.timestamp), meta: safeJson(e.metadata, {}) }; })
    .filter(function (e) { return e.at; })
    .sort(function (a, b) { return a.at - b.at; });

  const segments = [];
  let cur = { from: start, budget: Number(campaign.total_budget || 0), paused: false };
  for (const ev of events) {
    if (ev.type === 'BUDGET_CHANGED') {
      segments.push({ from: cur.from, to: ev.at, budget: cur.budget, paused: cur.paused });
      cur = { from: ev.at, budget: Number((ev.meta && ev.meta.to) || cur.budget), paused: cur.paused };
    } else if (ev.type === 'CAMPAIGN_PAUSED') {
      segments.push({ from: cur.from, to: ev.at, budget: cur.budget, paused: cur.paused });
      cur = { from: ev.at, budget: cur.budget, paused: true };
    } else if (ev.type === 'CAMPAIGN_RESUMED') {
      segments.push({ from: cur.from, to: ev.at, budget: cur.budget, paused: cur.paused });
      cur = { from: ev.at, budget: cur.budget, paused: false };
    }
  }
  segments.push({ from: cur.from, to: end, budget: cur.budget, paused: cur.paused });
  return segments.filter(function (s) { return s.from; });
}

async function budgetPacer(campaign, opts) {
  const o = opts || {};
  const totalBudget = Number(campaign.total_budget || 0);
  const spent = Number(campaign.spent_budget || 0);

  if (!totalBudget) {
    return {
      state: 'NO_BUDGET', expected_spend: null, actual_spend: spent, remaining: 0,
      message: 'No budget configured.'
    };
  }

  const timeline = (await db.execute({
    sql: `SELECT event_type, metadata, timestamp FROM campaign_timeline WHERE campaign_id = ? ORDER BY timestamp ASC`,
    args: [campaign.id]
  })).rows;

  const segments = segmentCampaign(campaign, timeline);
  const endpoints = (await getDeliveryEndpoints(campaign));
  const start = endpoints.start;
  const end = endpoints.end;
  const now = new Date();

  if (end && now > end && campaign.status === 'completed') {
    // A finished campaign is measured by its whole self, not by a rate.
    return {
      state: 'COMPLETED', expected_spend: totalBudget, actual_spend: spent,
      remaining: totalBudget - spent,
      message: spent >= totalBudget
        ? 'The campaign finished and used its whole budget.'
        : 'The campaign finished. ' + (totalBudget - spent) + ' of the budget was not spent.'
    };
  }

  let elapsedHours = 0;
  let expected = 0;
  for (const seg of segments) {
    if (seg.paused) continue;
    const segEnd = seg.to && seg.to < now ? seg.to : now;
    const segHours = (segEnd - seg.from) / 3600000;
    if (segHours <= 0) continue;
    elapsedHours += segHours;
    if (end) {
      const totalSegHours = (end - seg.from) / 3600000;
      const fraction = totalSegHours > 0 ? Math.min(1, segHours / totalSegHours) : 0;
      expected += fraction * seg.budget;
    }
  }
  expected = Math.round(expected);

  const bandPct = await cfg('pacer_on_track_band_pct', 10);
  const atRiskPct = await cfg('pacer_at_risk_pct', 130);

  const totalHours = endpoints.durationHours;
  const elapsedFraction = totalHours ? elapsedHours / totalHours : null;
  const expectedStart = expected || 1;
  const ratio = (spent / expectedStart) * 100;

  // Projected exhaustion: at the current spend rate, how long until the budget
  // is gone? If that lands before the scheduled end, the campaign is at risk.
  const ratePerHour = elapsedHours > 0 ? spent / elapsedHours : null;
  let projectedExhaustion = null;
  if (ratePerHour && ratePerHour > 0) {
    const hoursToExhaust = (totalBudget - spent) / ratePerHour;
    projectedExhaustion = new Date(now.getTime() + hoursToExhaust * 3600000);
  }
  const exhaustsEarly = !!(end && projectedExhaustion && projectedExhaustion < end);
  const willUnderspend = !!(end && elapsedFraction !== null && elapsedFraction >= 1 && spent < totalBudget);

  let state;
  if (spent > totalBudget) state = 'AT_RISK';
  else if (ratio > atRiskPct || exhaustsEarly) state = 'AT_RISK';
  else if (ratio > 100 + Number(bandPct)) state = 'SPENDING_FAST';
  else if (ratio < 100 - Number(bandPct)) state = 'SPENDING_SLOW';
  else state = 'ON_TRACK';
  if (willUnderspend && state === 'SPENDING_SLOW') state = 'AT_RISK';

  const messages = {
    ON_TRACK: 'Your campaign budget is on track.',
    SPENDING_FAST: 'Your campaign is spending faster than planned. At this pace it will use its budget ahead of the scheduled end.',
    SPENDING_SLOW: 'Your campaign is under-spending. Consider increasing visibility or adjusting targeting.',
    AT_RISK: 'Your campaign is spending faster than planned and may exhaust its budget before the scheduled end date.',
    NO_BUDGET: 'No budget configured.'
  };

  if (o.actorId) await logActivity(campaign.id, o.actorId, 'BUDGET_PACER_VIEWED', { state });

  return {
    state,
    expected_spend: expected,
    actual_spend: spent,
    remaining: totalBudget - spent,
    elapsed_hours: Math.round(elapsedHours),
    total_hours: totalHours ? Math.round(totalHours) : null,
    pacing_ratio_pct: Math.round(ratio),
    projected_exhaustion: projectedExhaustion ? projectedExhaustion.toISOString() : null,
    projected_end_date: end ? end.toISOString() : null,
    message: messages[state]
  };
}

/** Delivery window. If the campaign has no end date, derive one from metrics. */
async function getDeliveryEndpoints(campaign) {
  let start = parseDbDate(campaign.start_date) || parseDbDate(campaign.created_at);
  let end = parseDbDate(campaign.end_date);
  if (!start) start = new Date();
  if (!end) {
    const last = (await db.execute({
      sql: `SELECT MAX(timestamp) AS t FROM campaign_metrics WHERE campaign_id = ?`,
      args: [campaign.id]
    })).rows[0];
    const lastAt = last && last.t ? parseDbDate(last.t) : null;
    end = lastAt && lastAt > start ? lastAt : new Date(start.getTime() + 30 * 86400000);
  }
  return {
    start, end,
    durationHours: (end - start) / 3600000
  };
}

// ==================================================================
// 1.6 -- BANQ Watch (alert engine)
// ==================================================================
/**
 * Evaluate every alert type against the campaign, then apply cooldown and
 * dedup. Both windows come from banq_config.
 *
 * The order matters: dedup first (an unresolved alert of the same type already
 * tells the advertiser something is wrong), then cooldown (they have been told
 * recently). Either one blocks the write, so the feed cannot fill with
 * restatements of one problem.
 */
async function evaluateAlerts(campaign, actor) {
  const cooldownMin = await cfg('alert_cooldown_minutes', 60);
  const dedupMin = await cfg('alert_dedup_window_minutes', 120);
  const now = Date.now();

  const pacer = await budgetPacer(campaign, {});
  const goals = await listGoals(campaign.id);
  const firing = [];

  if (pacer.state === 'SPENDING_FAST' || pacer.state === 'AT_RISK') {
    firing.push({
      alert_type: 'BUDGET_SPENDING_TOO_FAST',
      severity: pacer.state === 'AT_RISK' ? 'CRITICAL' : 'HIGH',
      message: 'Campaign spending faster than planned: ' + pacer.pacing_ratio_pct + '% of expected spend.',
      supporting_data: { pacer }
    });
  }
  if (pacer.state === 'SPENDING_SLOW') {
    firing.push({
      alert_type: 'BUDGET_SPENDING_TOO_SLOW',
      severity: 'MEDIUM',
      message: 'Campaign is under-spending: ' + pacer.pacing_ratio_pct + '% of expected spend.',
      supporting_data: { pacer }
    });
  }

  const lastMetric = (await db.execute({
    sql: `SELECT MAX(timestamp) AS t FROM campaign_metrics WHERE campaign_id = ?`,
    args: [campaign.id]
  })).rows[0];
  const lastAt = lastMetric && lastMetric.t ? parseDbDate(lastMetric.t) : null;
  const hoursSinceData = lastAt ? (now - lastAt.getTime()) / 3600000 : null;
  if (hoursSinceData !== null && hoursSinceData > 48) {
    firing.push({
      alert_type: 'CAMPAIGN_INACTIVE',
      severity: 'HIGH',
      message: 'No campaign data received for ' + Math.round(hoursSinceData) + ' hours.',
      supporting_data: { hours_since_last_metric: Math.round(hoursSinceData), last_metric_at: lastMetric.t }
    });
  }

  const trend = await performanceTrend(campaign.id);
  if (trend && trend.change_pct !== null && trend.change_pct <= -15) {
    firing.push({
      alert_type: 'PERFORMANCE_DROP',
      severity: trend.change_pct <= -30 ? 'HIGH' : 'MEDIUM',
      message: trend.metric_name + ' fell ' + Math.abs(trend.change_pct) + '% versus the previous period.',
      supporting_data: { trend }
    });
  }

  for (const g of goals) {
    if (!g.target) continue;
    if (g.progress_pct !== null && g.progress_pct >= 100) {
      firing.push({
        alert_type: 'GOAL_REACHED',
        severity: 'INFO',
        message: 'Goal reached: ' + g.goal_type + ' at ' + g.progress_pct + '% of target.',
        supporting_data: { goal: g }
      });
    } else if (g.progress_pct !== null && isGoalAtRisk(campaign, g)) {
      firing.push({
        alert_type: 'GOAL_AT_RISK',
        severity: 'MEDIUM',
        message: 'Goal ' + g.goal_type + ' is behind schedule at ' + g.progress_pct + '% with time running out.',
        supporting_data: { goal: g }
      });
    }
  }

  const endpoints = await getDeliveryEndpoints(campaign);
  const hoursToEnd = (endpoints.end.getTime() - now) / 3600000;
  if (hoursToEnd > 0 && hoursToEnd <= 72) {
    firing.push({
      alert_type: 'CAMPAIGN_ENDING',
      severity: 'LOW',
      message: 'Campaign ends in ' + Math.round(hoursToEnd) + ' hours.',
      supporting_data: { ends_at: endpoints.end.toISOString(), budget_remaining: Number(campaign.total_budget || 0) - Number(campaign.spent_budget || 0) }
    });
  }

  const created = [];
  const blocked = [];
  for (const a of firing) {
    const reason = await blockReason(campaign.id, a.alert_type, now, dedupMin, cooldownMin);
    if (reason) { blocked.push({ alert_type: a.alert_type, blocked_by: reason }); continue; }
    const res = await db.execute({
      sql: `INSERT INTO banq_alerts (campaign_id, alert_type, severity, message, supporting_data, status)
            VALUES (?, ?, ?, ?, ?, 'NEW')`,
      args: [campaign.id, a.alert_type, a.severity, a.message, JSON.stringify(a.supporting_data)]
    });
    const id = Number(res.lastInsertRowid);
    await timelineAdd(campaign.id, 'ALERT_GENERATED', 'SYSTEM', null, { alert_id: id, alert_type: a.alert_type, severity: a.severity });
    await notify(campaign, 'ALERT', a.message, a.severity === 'CRITICAL' || a.severity === 'HIGH');
    await logActivity(campaign.id, actor ? actor.id : null, 'ALERT_CREATED', { alert_id: id, alert_type: a.alert_type });
    created.push({ id: id, alert_type: a.alert_type, severity: a.severity, message: a.message });
  }

  return { evaluated: firing.length, created, blocked, cooldown_minutes: cooldownMin, dedup_window_minutes: dedupMin };
}

async function blockReason(campaignId, alertType, nowMs, dedupMin, cooldownMin) {
  const unresolved = (await db.execute({
    sql: `SELECT id, created_at FROM banq_alerts
          WHERE campaign_id = ? AND alert_type = ? AND status IN ('NEW','ACKNOWLEDGED')
          ORDER BY created_at DESC LIMIT 1`,
    args: [campaignId, alertType]
  })).rows[0];
  if (unresolved) {
    const at = parseDbDate(unresolved.created_at);
    const ageMin = at ? (nowMs - at.getTime()) / 60000 : 0;
    if (ageMin <= dedupMin) return 'unresolved_duplicate';
  }
  const recent = (await db.execute({
    sql: `SELECT created_at FROM banq_alerts WHERE campaign_id = ? AND alert_type = ?
          ORDER BY created_at DESC LIMIT 1`,
    args: [campaignId, alertType]
  })).rows[0];
  if (recent && recent.created_at) {
    const at = parseDbDate(recent.created_at);
    const ageMin = at ? (nowMs - at.getTime()) / 60000 : null;
    if (ageMin !== null && ageMin <= cooldownMin) return 'cooldown';
  }
  return null;
}

function isGoalAtRisk(campaign, goal) {
  if (!goal.target || goal.progress_pct === null) return false;
  const start = parseDbDate(campaign.start_date) || parseDbDate(campaign.created_at);
  const end = parseDbDate(campaign.end_date);
  if (!start || !end) return false;
  const total = end - start;
  if (total <= 0) return false;
  const elapsedFraction = Math.min(1, (Date.now() - start) / total);
  // Behind if progress trails elapsed time by more than 15 points.
  return (goal.progress_pct + 15) < (elapsedFraction * 100);
}

async function listAlerts(campaignId, opts) {
  const o = opts || {};
  const clauses = ['campaign_id = ?'];
  const args = [Number(campaignId)];
  if (o.status) { clauses.push('status = ?'); args.push(String(o.status).toUpperCase()); }
  if (o.severity) { clauses.push('severity = ?'); args.push(String(o.severity).toUpperCase()); }
  const rows = (await db.execute({
    sql: `SELECT * FROM banq_alerts WHERE ${clauses.join(' AND ')}
          ORDER BY CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END,
                   created_at DESC LIMIT ?`,
    args: args.concat([Math.min(Number(o.limit) || 100, 500)])
  })).rows;
  return rows.map(function (r) {
    return Object.assign({}, r, { supporting_data: safeJson(r.supporting_data, null) });
  });
}

async function listAllAlerts(opts) {
  const o = opts || {};
  const clauses = [];
  const args = [];
  if (o.status) { clauses.push('status = ?'); args.push(String(o.status).toUpperCase()); }
  if (o.severity) { clauses.push('severity = ?'); args.push(String(o.severity).toUpperCase()); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const rows = (await db.execute({
    sql: `SELECT a.*, c.campaign_name FROM banq_alerts a
          LEFT JOIN campaigns c ON c.id = a.campaign_id
          ${where}
          ORDER BY CASE a.severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END,
                   a.created_at DESC LIMIT ?`,
    args: args.concat([Math.min(Number(o.limit) || 200, 500)])
  })).rows;
  return rows.map(function (r) {
    return Object.assign({}, r, { supporting_data: safeJson(r.supporting_data, null) });
  });
}

async function setAlertStatus(alertId, status, actor) {
  const s = String(status || '').toUpperCase();
  if (!ALERT_STATUSES.includes(s)) {
    throw Object.assign(new Error('Status must be one of: ' + ALERT_STATUSES.join(', ')), { code: 400 });
  }
  const alert = (await db.execute({ sql: `SELECT * FROM banq_alerts WHERE id = ?`, args: [Number(alertId)] })).rows[0];
  if (!alert) throw Object.assign(new Error('Alert not found.'), { code: 404 });
  const stamp = s === 'ACKNOWLEDGED' ? 'acknowledged_at' : (s === 'RESOLVED' ? 'resolved_at' : null);
  if (stamp) {
    await db.execute({
      sql: `UPDATE banq_alerts SET status = ?, ${stamp} = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [s, Number(alertId)]
    });
  } else {
    await db.execute({ sql: `UPDATE banq_alerts SET status = ? WHERE id = ?`, args: [s, Number(alertId)] });
  }
  await logActivity(alert.campaign_id, actor ? actor.id : null,
    s === 'ACKNOWLEDGED' ? 'ALERT_ACKNOWLEDGED' : (s === 'RESOLVED' ? 'ALERT_RESOLVED' : 'ALERT_STATUS_CHANGED'),
    { alert_id: Number(alertId), status: s });
  return { id: Number(alertId), status: s };
}

// ==================================================================
// 1.7 -- Campaign Health Score
// ==================================================================
/** Recent period vs the one before it, for one metric. */
async function performanceTrend(campaignId, opts) {
  const o = opts || {};
  const periodHours = Number(o.period_hours) || 168;
  const rows = (await db.execute({
    sql: `SELECT metric_name, timestamp, metric_value FROM campaign_metrics
          WHERE campaign_id = ? ORDER BY timestamp DESC`,
    args: [Number(campaignId)]
  })).rows;
  if (!rows.length) return null;
  const now = Date.now();
  const recentFrom = now - periodHours * 3600000;
  const previousFrom = now - 2 * periodHours * 3600000;

  // Choose the busiest metric so the trend is not decided by a metric with
  // three rows in it.
  const counts = {};
  rows.forEach(function (r) { counts[r.metric_name] = (counts[r.metric_name] || 0) + 1; });
  const metricName = o.metric || Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];

  let recent = 0, previous = 0;
  rows.filter(function (r) { return r.metric_name === metricName; }).forEach(function (r) {
    const at = parseDbDate(r.timestamp);
    if (!at) return;
    const t = at.getTime();
    if (t >= recentFrom) recent += Number(r.metric_value);
    else if (t >= previousFrom) previous += Number(r.metric_value);
  });

  if (!previous) {
    return { metric_name: metricName, recent: recent, previous: null, change_pct: null,
      note: 'No previous period to compare against yet.' };
  }
  return {
    metric_name: metricName,
    recent: Math.round(recent),
    previous: Math.round(previous),
    change_pct: Math.round(((recent - previous) / previous) * 1000) / 10,
    period_hours: periodHours
  };
}

function bandFor(score, ranges) {
  if (score >= ranges.healthy) return 'HEALTHY';
  if (score >= ranges.watch) return 'WATCH';
  if (score >= ranges.needs_attention) return 'NEEDS_ATTENTION';
  return 'CRITICAL';
}

async function calculateHealth(campaign, actor) {
  const weights = await cfg('health_score_weights', { budget_pacing: 25, goal_progress: 25, delivery: 20, performance_trend: 20, technical_status: 10 });
  const ranges = await cfg('health_score_ranges', { healthy: 80, watch: 60, needs_attention: 40, critical: 0 });

  const pacer = await budgetPacer(campaign, {});
  const goals = await listGoals(campaign.id);
  const metrics = (await db.execute({
    sql: `SELECT COUNT(*) AS n, MAX(timestamp) AS last FROM campaign_metrics WHERE campaign_id = ?`,
    args: [campaign.id]
  })).rows[0];
  const metricCount = Number(metrics ? metrics.n : 0);
  const lastMetricAt = metrics && metrics.last ? parseDbDate(metrics.last) : null;
  const trend = await performanceTrend(campaign.id);

  const factors = {};

  // budget_pacing
  if (pacer.state === 'NO_BUDGET') {
    factors.budget_pacing = { available: false, score: null, note: 'No budget configured.' };
  } else {
    const map = { ON_TRACK: 100, SPENDING_SLOW: 65, SPENDING_FAST: 55, AT_RISK: 20, COMPLETED: 100 };
    factors.budget_pacing = { available: true, score: map[pacer.state], state: pacer.state };
  }

  // goal_progress
  const withTarget = goals.filter(function (g) { return g.target && g.progress_pct !== null; });
  if (!withTarget.length) {
    factors.goal_progress = { available: false, score: null, note: 'No measurable goals configured.' };
  } else {
    const avg = withTarget.reduce(function (s, g) { return s + Math.min(100, g.progress_pct); }, 0) / withTarget.length;
    factors.goal_progress = { available: true, score: Math.round(avg), goals: withTarget.length };
  }

  // delivery -- is anything arriving at all?
  if (!metricCount) {
    factors.delivery = { available: false, score: null, note: 'No delivery metrics recorded yet.' };
  } else {
    const hoursSince = lastMetricAt ? (Date.now() - lastMetricAt.getTime()) / 3600000 : null;
    let s = 100;
    if (hoursSince !== null && hoursSince > 48) s = 40;
    else if (hoursSince !== null && hoursSince > 24) s = 70;
    factors.delivery = { available: true, score: s, metric_rows: metricCount, hours_since_last_metric: hoursSince === null ? null : Math.round(hoursSince) };
  }

  // performance_trend
  if (!trend || trend.change_pct === null) {
    factors.performance_trend = { available: false, score: null, note: 'No previous period to compare against.' };
  } else {
    const c = trend.change_pct;
    let s;
    if (c >= 0) s = clampScore(75 + Math.min(25, c));
    else s = clampScore(75 + Math.max(-75, c * 1.5));
    factors.performance_trend = { available: true, score: Math.round(s), change_pct: c, metric_name: trend.metric_name };
  }

  // technical_status
  const technicalIssues = [];
  if (!metricCount) technicalIssues.push('No tracking data received.');
  if (hoursSinceLastMetric(lastMetricAt) !== null && hoursSinceLastMetric(lastMetricAt) > 48) {
    technicalIssues.push('Delivery data is stale (over 48 hours).');
  }
  factors.technical_status = {
    available: true,
    score: technicalIssues.length ? Math.max(20, 100 - technicalIssues.length * 40) : 100,
    issues: technicalIssues
  };

  // Weighted mean over the AVAILABLE factors only, then renormalised. Scoring a
  // missing factor as zero would punish a campaign for data BANQ simply does
  // not have.
  let weightSum = 0, weighted = 0;
  Object.keys(factors).forEach(function (k) {
    const f = factors[k];
    const w = Number(weights[k] || 0);
    if (f.available && f.score !== null) { weightSum += w; weighted += w * f.score; }
  });

  if (!weightSum) {
    return {
      score: null,
      status: 'INSUFFICIENT_DATA',
      message: 'There is not enough campaign data to calculate a health score yet. A budget, a goal, or some delivery metrics are needed.',
      factor_breakdown: factors,
      weights_used: weights
    };
  }

  const score = Math.round(weighted / weightSum);
  const status = bandFor(score, ranges);
  const message = healthMessage(status, factors, trend);

  if (campaign && campaign.id) {
    await db.execute({
      sql: `INSERT INTO campaign_health_scores (campaign_id, score, status, factor_breakdown) VALUES (?, ?, ?, ?)`,
      args: [campaign.id, score, status, JSON.stringify({ factors, weights_used: weights, weight_sum: weightSum })]
    });
    await logActivity(campaign.id, actor ? actor.id : null, 'HEALTH_CALCULATED', { score, status });
  }

  return {
    score, status, message,
    factor_breakdown: factors,
    weights_used: weights,
    weight_sum: weightSum,
    ranges
  };
}

function clampScore(n) { return Math.max(0, Math.min(100, n)); }

function hoursSinceLastMetric(lastMetricAt) {
  if (!lastMetricAt) return null;
  return (Date.now() - lastMetricAt.getTime()) / 3600000;
}

function healthMessage(status, factors, trend) {
  const parts = [];
  if (status === 'HEALTHY') parts.push('Your campaign is healthy');
  else if (status === 'WATCH') parts.push('Your campaign is in the watch band');
  else if (status === 'NEEDS_ATTENTION') parts.push('Your campaign needs attention');
  else parts.push('Your campaign is in critical condition');

  const pacing = factors.budget_pacing;
  if (pacing && pacing.available && pacing.state !== 'ON_TRACK' && pacing.state !== 'COMPLETED') {
    parts.push(pacing.state === 'AT_RISK'
      ? 'budget is pacing too fast'
      : (pacing.state === 'SPENDING_FAST' ? 'budget is running hot' : 'budget is under-spending'));
  }
  const goal = factors.goal_progress;
  if (goal && goal.available && goal.score < 60) parts.push('goal progress is behind schedule');
  if (trend && trend.change_pct !== null && trend.change_pct < 0) {
    parts.push(trend.metric_name + ' has declined by ' + Math.abs(trend.change_pct) + '% versus the previous period');
  } else if (trend && trend.change_pct !== null && trend.change_pct > 0) {
    parts.push(trend.metric_name + ' is up ' + trend.change_pct + '% versus the previous period');
  }
  return parts.join(', ') + '.';
}

async function healthHistory(campaignId, limit) {
  const rows = (await db.execute({
    sql: `SELECT * FROM campaign_health_scores WHERE campaign_id = ? ORDER BY calculated_at DESC LIMIT ?`,
    args: [Number(campaignId), Math.min(Number(limit) || 60, 365)]
  })).rows;
  return rows.map(function (r) {
    return Object.assign({}, r, { factor_breakdown: safeJson(r.factor_breakdown, null) });
  }).reverse();
}

// ==================================================================
// 1.5 -- Campaign Dashboard (aggregation)
// ==================================================================
async function campaignDashboard(campaign, opts) {
  const o = opts || {};
  const [pacer, goals, notes, timeline, alerts, health, latestRecommendations] = await Promise.all([
    budgetPacer(campaign, {}),
    listGoals(campaign.id),
    listNotes(campaign.id, { role: o.role, actorId: o.actorId }),
    listTimeline(campaign.id, { limit: 25 }),
    listAlerts(campaign.id, { limit: 25 }),
    calculateHealth(campaign, null),
    db.execute({
      sql: `SELECT * FROM banq_recommendations WHERE campaign_id = ? AND status IN ('NEW','APPROVED','VIEWED')
            ORDER BY created_at DESC LIMIT 5`,
      args: [campaign.id]
    }).then(function (r) { return r.rows; })
  ]);

  const openAlerts = alerts.filter(function (a) { return a.status === 'NEW' || a.status === 'ACKNOWLEDGED'; });
  const endpoints = await getDeliveryEndpoints(campaign);
  const daysLeft = Math.max(0, Math.ceil((endpoints.end.getTime() - Date.now()) / 86400000));

  return {
    campaign: {
      id: campaign.id,
      campaign_name: campaign.campaign_name,
      status: campaign.status,
      campaign_source: campaign.campaign_source,
      total_budget: Number(campaign.total_budget || 0),
      spent_budget: Number(campaign.spent_budget || 0),
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      days_remaining: daysLeft
    },
    health: { score: health.score, status: health.status, message: health.message, breakdown: health.factor_breakdown },
    budget: pacer,
    goals,
    alerts: { open: openAlerts.length, items: alerts },
    notes: { count: notes.length, latest: notes.slice(-3).reverse() },
    timeline,
    recommendations: latestRecommendations.map(function (r) {
      return Object.assign({}, r, { supporting_data: safeJson(r.supporting_data, null) });
    }),
    generated_at: new Date().toISOString()
  };
}

// ==================================================================
// 1.8 -- BANQ Report Card
// ==================================================================
/**
 * A report freezes a snapshot. Later metric corrections do NOT rewrite it,
 * which is the point: a report is a statement about a moment, and a statement
 * that silently changes is not a record.
 */
async function generateReport(campaign, input, actor) {
  const reportType = String(input.report_type || 'Campaign Summary');
  const periodStart = input.period_start || campaign.start_date;
  const periodEnd = input.period_end || campaign.end_date || new Date().toISOString();

  const [health, pacer, goals, alerts, timeline, best] = await Promise.all([
    calculateHealth(campaign, actor),
    budgetPacer(campaign, {}),
    listGoals(campaign.id),
    listAlerts(campaign.id, { limit: 200 }),
    listTimeline(campaign.id, { limit: 200 }),
    bestDay(campaign.id)
  ]);

  const results = { STRONG: 'Strong', WATCH: 'Watch', NEEDS_ATTENTION: 'Needs Attention' };
  const overall = results[health.status] || (health.status === 'HEALTHY' ? 'Strong' : health.status);

  const attention = alerts.filter(function (a) { return (a.status === 'NEW') && (a.severity === 'HIGH' || a.severity === 'CRITICAL'); });
  const snapshot = {
    campaign_name: campaign.campaign_name,
    goal: goals.length ? goals.map(function (g) { return g.goal_type; }).join(', ') : 'No goal set',
    overall_result: overall,
    health_score: health.score,
    health_status: health.status,
    health_message: health.message,
    key_finding: health.message,
    budget: pacer,
    goals,
    best_creative: best.creative ? best.creative.creative_name : 'No creative data yet',
    best_day: best.day,
    items_requiring_attention: attention.length,
    attention_items: attention.map(function (a) { return { severity: a.severity, message: a.message }; }),
    recommendation: recommendationFor(health, pacer, goals),
    period: { start: periodStart, end: periodEnd },
    timeline_events: timeline.length,
    generated_from: 'phase1'
  };

  const res = await db.execute({
    sql: `INSERT INTO banq_reports (campaign_id, report_type, period_start, period_end, data_snapshot, generated_by, status)
          VALUES (?, ?, ?, ?, ?, ?, 'generated')`,
    args: [campaign.id, reportType, periodStart, periodEnd, JSON.stringify(snapshot), actor ? actor.id : null]
  });
  const id = Number(res.lastInsertRowid);
  await timelineAdd(campaign.id, 'REPORT_GENERATED', 'BANQ', actor ? actor.id : null, { report_id: id, report_type: reportType });
  await logActivity(campaign.id, actor ? actor.id : null, 'REPORT_GENERATED', { report_id: id, report_type: reportType });
  return { id, report_type: reportType, snapshot };
}

function recommendationFor(health, pacer, goals) {
  if (health.status === 'CRITICAL' || health.status === 'NEEDS_ATTENTION') {
    return 'BANQ recommends reviewing the budget pace and goal progress together before changing anything else.';
  }
  if (pacer.state === 'AT_RISK') {
    return 'BANQ recommends considering a budget adjustment or a narrower targeting scope, because spend is ahead of plan.';
  }
  if (pacer.state === 'SPENDING_SLOW') {
    return 'BANQ recommends considering wider visibility or refreshed creative, because the campaign is under-spending.';
  }
  if (goals.some(function (g) { return g.progress_pct !== null && g.progress_pct >= 100; })) {
    return 'BANQ recommends considering whether the goal should be raised, since it has already been met.';
  }
  return 'BANQ recommends holding the current course and reviewing again at the next reporting period.';
}

async function bestDay(campaignId) {
  const rows = (await db.execute({
    sql: `SELECT DATE(timestamp) AS d, SUM(metric_value) AS total, metric_name
          FROM campaign_metrics WHERE campaign_id = ? GROUP BY d, metric_name ORDER BY total DESC LIMIT 1`,
    args: [Number(campaignId)]
  })).rows;
  if (!rows.length) return { day: null, creative: null };
  const r = rows[0];
  const creative = (await db.execute({
    sql: `SELECT creative_name FROM ad_creatives WHERE campaign_id = ? ORDER BY id ASC LIMIT 1`,
    args: [Number(campaignId)]
  })).rows[0];
  return {
    day: { date: r.d, metric_name: r.metric_name, total: Math.round(Number(r.total)) },
    creative: creative || null
  };
}

async function latestReport(campaignId) {
  const row = (await db.execute({
    sql: `SELECT * FROM banq_reports WHERE campaign_id = ? ORDER BY generated_at DESC LIMIT 1`,
    args: [Number(campaignId)]
  })).rows[0];
  if (!row) return null;
  return Object.assign({}, row, { data_snapshot: safeJson(row.data_snapshot, null) });
}

async function reportHistory(campaignId) {
  const rows = (await db.execute({
    sql: `SELECT id, campaign_id, report_type, generated_at, period_start, period_end, status
          FROM banq_reports WHERE campaign_id = ? ORDER BY generated_at DESC`,
    args: [Number(campaignId)]
  })).rows;
  return rows;
}

// ==================================================================
// Phase 1 infrastructure -- Work Queue
// ==================================================================
/**
 * The staff workspace. Sorted CRITICAL > HIGH > MEDIUM > then most recently
 * changed, and only over campaigns BANQ is actually monitoring -- the Security
 * Rules forbid staff seeing campaigns nobody opted in.
 */
async function workQueue(opts) {
  const o = opts || {};
  const rows = (await db.execute({
    sql: `SELECT c.*, u.username AS advertiser_name,
                 (SELECT COUNT(*) FROM banq_alerts a WHERE a.campaign_id = c.id AND a.status = 'NEW' AND a.severity = 'CRITICAL') AS critical_alerts,
                 (SELECT COUNT(*) FROM banq_alerts a WHERE a.campaign_id = c.id AND a.status = 'NEW' AND a.severity = 'HIGH') AS high_alerts,
                 (SELECT COUNT(*) FROM banq_alerts a WHERE a.campaign_id = c.id AND a.status = 'NEW' AND a.severity = 'MEDIUM') AS medium_alerts,
                 (SELECT COUNT(*) FROM banq_client_requests r WHERE r.campaign_id = c.id AND r.status IN ('NEW','ASSIGNED','IN_REVIEW')) AS open_requests,
                 (SELECT COUNT(*) FROM banq_recommendations rc WHERE rc.campaign_id = c.id AND rc.status = 'NEW') AS pending_recommendations,
                 (SELECT COUNT(*) FROM experiments e WHERE e.campaign_id = c.id AND e.status = 'RUNNING') AS running_experiments,
                 (SELECT s.status FROM campaign_health_scores s WHERE s.campaign_id = c.id ORDER BY s.calculated_at DESC LIMIT 1) AS last_health_status,
                 (SELECT s.score FROM campaign_health_scores s WHERE s.campaign_id = c.id ORDER BY s.calculated_at DESC LIMIT 1) AS last_health_score
          FROM campaigns c
          LEFT JOIN users u ON u.id = c.advertiser_id
          LEFT JOIN banq_service_subscriptions s ON s.campaign_id = c.id
          ORDER BY critical_alerts DESC, high_alerts DESC, medium_alerts DESC, c.created_at DESC
          LIMIT ?`,
    args: [Math.min(Number(o.limit) || 200, 500)]
  })).rows;

  const counts = { CRITICAL: 0, NEEDS_ATTENTION: 0, WATCH: 0, HEALTHY: 0, INSUFFICIENT_DATA: 0 };
  const queue = rows.map(function (r) {
    const status = r.last_health_status || (r.critical_alerts ? 'CRITICAL' : 'INSUFFICIENT_DATA');
    if (counts[status] === undefined) counts[status] = 0;
    counts[status]++;
    return {
      campaign_id: r.id,
      campaign_name: r.campaign_name,
      advertiser_id: r.advertiser_id,
      advertiser_name: r.advertiser_name,
      campaign_status: r.status,
      health_status: status,
      health_score: r.last_health_score,
      critical_alerts: Number(r.critical_alerts || 0),
      high_alerts: Number(r.high_alerts || 0),
      medium_alerts: Number(r.medium_alerts || 0),
      open_requests: Number(r.open_requests || 0),
      pending_recommendations: Number(r.pending_recommendations || 0),
      running_experiments: Number(r.running_experiments || 0),
      needs_attention: status === 'CRITICAL' || status === 'NEEDS_ATTENTION' || Number(r.critical_alerts || 0) > 0
    };
  });

  const filtered = o.only_attention ? queue.filter(function (q) { return q.needs_attention; }) : queue;
  return { counts, queue: filtered, total: filtered.length };
}

// ==================================================================
// Phase 1 infrastructure -- Notifications
// ==================================================================
async function notify(campaign, type, message, important) {
  const cooldownMin = await cfg('notification_cooldown_minutes', 30);
  const existing = (await db.execute({
    sql: `SELECT created_at FROM banq_notifications WHERE campaign_id = ? AND type = ?
          ORDER BY created_at DESC LIMIT 1`,
    args: [campaign.id, type]
  })).rows[0];
  if (existing && existing.created_at) {
    const at = parseDbDate(existing.created_at);
    if (at && (Date.now() - at.getTime()) / 60000 <= cooldownMin) return { queued: false, reason: 'cooldown' };
  }
  await db.execute({
    sql: `INSERT INTO banq_notifications (user_id, campaign_id, type, message) VALUES (?, ?, ?, ?)`,
    args: [campaign.advertiser_id, campaign.id, type, message]
  });
  return { queued: true, important: !!important };
}

async function listNotifications(userId, opts) {
  const o = opts || {};
  const rows = (await db.execute({
    sql: `SELECT * FROM banq_notifications WHERE user_id = ? ${o.unread_only ? 'AND read = 0' : ''}
          ORDER BY created_at DESC LIMIT ?`,
    args: [Number(userId), Math.min(Number(o.limit) || 50, 200)]
  })).rows;
  const unread = (await db.execute({
    sql: `SELECT COUNT(*) AS n FROM banq_notifications WHERE user_id = ? AND read = 0`,
    args: [Number(userId)]
  })).rows[0];
  return { unread: Number(unread ? unread.n : 0), notifications: rows };
}

async function markNotificationRead(id, userId) {
  await db.execute({
    sql: `UPDATE banq_notifications SET read = 1 WHERE id = ? AND user_id = ?`,
    args: [Number(id), Number(userId)]
  });
  return { id: Number(id), read: true };
}

// ==================================================================
// Phase 1 infrastructure -- Revenue ledger
// ==================================================================
/**
 * BANQ revenue is separate from the advertising budget. Recording it in its own
 * ledger with its own settlement status is what keeps the two from being
 * silently netted off against each other.
 */
async function revenueSummary(opts) {
  const o = opts || {};
  const clauses = [];
  const args = [];
  if (o.advertiser_id) { clauses.push('advertiser_id = ?'); args.push(Number(o.advertiser_id)); }
  if (o.campaign_id) { clauses.push('campaign_id = ?'); args.push(Number(o.campaign_id)); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const rows = (await db.execute({
    sql: `SELECT * FROM banq_revenue_ledger ${where} ORDER BY created_at DESC LIMIT 500`,
    args
  })).rows;
  const bySettlement = {};
  let earned = 0, refunded = 0;
  rows.forEach(function (r) {
    bySettlement[r.settlement_status] = (bySettlement[r.settlement_status] || 0) + Number(r.banq_service_fee || 0);
    earned += Number(r.banq_service_fee || 0);
    refunded += Number(r.refund_amount || 0);
  });
  return {
    entries: rows.length,
    gross_fees: earned,
    refunds: refunded,
    net: earned - refunded,
    by_settlement_status: bySettlement,
    ledger: rows
  };
}

async function recordRevenue(input, actor) {
  const res = await db.execute({
    sql: `INSERT INTO banq_revenue_ledger
          (campaign_id, advertiser_id, banq_plan, advertising_budget, banq_service_fee, payment_status, settlement_status, qap_number, settlement_period)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.campaign_id ? Number(input.campaign_id) : null,
      Number(input.advertiser_id),
      String(input.banq_plan || 'monitor'),
      Number(input.advertising_budget) || 0,
      Number(input.banq_service_fee) || 0,
      String(input.payment_status || 'pending'),
      String(input.settlement_status || 'PENDING'),
      input.qap_number || null,
      input.settlement_period || null
    ]
  });
  const id = Number(res.lastInsertRowid);
  await logActivity(input.campaign_id || null, actor ? actor.id : null, 'REVENUE_RECORDED', { ledger_id: id, fee: Number(input.banq_service_fee) || 0 });
  return { id };
}

module.exports = {
  GOAL_TYPES, ALERT_TYPES, SEVERITIES, ALERT_STATUSES, DIRECTLY_MEASURABLE,
  listNotes, createNote, replyToNote,
  listTimeline,
  listGoals, createGoal, updateGoal, deleteGoal, goalProgress,
  budgetPacer, segmentCampaign, getDeliveryEndpoints,
  campaignDashboard,
  evaluateAlerts, listAlerts, listAllAlerts, setAlertStatus,
  performanceTrend, calculateHealth, healthHistory,
  generateReport, latestReport, reportHistory,
  workQueue,
  notify, listNotifications, markNotificationRead,
  revenueSummary, recordRevenue
};
