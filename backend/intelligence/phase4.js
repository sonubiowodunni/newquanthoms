/*
 * New Quanthoms Billboard Agency (BANQ)
 * backend/intelligence/phase4.js -- PHASE 4: PLAN
 *
 * "What could happen, what should we prepare?"
 *
 *   4.1 readiness      4.2 planner      4.3 reporting      4.4 placement
 *   4.5 predictive alerts                4.6 scenarios       4.7 forecasts
 *   4.8 GTM workspace
 *
 * THE TWO STANDING RULES FOR THIS PHASE, quoted from the build plan:
 *
 *   AI / INTELLIGENCE ARCHITECTURE: the intelligence layer explains what it is
 *   doing. Every prediction carries its inputs.
 *
 *   HUMAN OVERRIDE: an intelligence layer that cannot be overridden by a human
 *   is not shippable. So readiness never blocks a launch on a judgement call,
 *   every predictive alert can be dismissed, and every forecast can be ignored
 *   without the system arguing back.
 *
 * AND ONE LANGUAGE RULE: predictions are phrased as possibilities with a range,
 * never as a single number presented as a fact. "May exhaust its budget before
 * the scheduled end" -- not "will run out on the 14th".
 */

const { db } = require('../db');
const core = require('./core');
const { cfg, logActivity, timelineAdd, pct, safeJson, parseDbDate } = core;
const p1 = require('./phase1');

const READINESS_STATES = ['READY', 'READY_WITH_OBSERVATIONS', 'NEEDS_ATTENTION', 'NOT_READY'];
const PREDICTION_TYPES = ['POSSIBLE_BUDGET_EXHAUSTION', 'POSSIBLE_GOAL_SHORTFALL', 'POSSIBLE_UNDERDELIVERY',
  'POSSIBLE_CREATIVE_DECLINE', 'POSSIBLE_TRACKING_ISSUE'];
const PREDICTION_STATUSES = ['ACTIVE', 'UPDATED', 'RESOLVED', 'EXPIRED', 'DISMISSED'];
const CONFIDENCE_LEVELS = ['HIGH_DATA_SUPPORT', 'MODERATE', 'LIMITED', 'INSUFFICIENT'];
const GTM_STAGES = ['PLANNING', 'CREATIVE_PREPARATION', 'CAMPAIGN_LAUNCH', 'OPTIMISATION',
  'EXPERIMENTATION', 'CAMPAIGN_REVIEW', 'LEARNING_ARCHIVE'];
const LEARNING_STATUSES = ['OBSERVED', 'TESTED', 'REPEATED', 'INCONCLUSIVE', 'SUPERSEDED'];

// ==================================================================
// 4.1 -- Campaign Readiness Check
// ==================================================================
/**
 * Ten checks, each reporting what was found rather than just pass/fail, so the
 * advertiser can see exactly what is missing.
 *
 * BANQ does not block a campaign on a judgement call. Only two checks are
 * BLOCKING (no objective, no destination), because those make the campaign
 * technically meaningless rather than merely improvable. Everything else is an
 * observation the advertiser may proceed past.
 */
async function readinessCheck(campaign, actor) {
  const [pacer, goals, creatives, config, health] = await Promise.all([
    p1.budgetPacer(campaign, {}),
    p1.listGoals(campaign.id),
    db.execute({ sql: `SELECT * FROM ad_creatives WHERE campaign_id = ?`, args: [campaign.id] }).then(function (r) { return r.rows; }),
    require('./phase3').getJourneyConfig(campaign.id),
    p1.calculateHealth(campaign, null)
  ]);

  const subs = (await db.execute({
    sql: `SELECT * FROM banq_service_subscriptions WHERE (campaign_id = ? OR advertiser_id = ?)
          AND banq_service_status IN ('ACTIVE','MONITORING','PAID','PAYMENT_CONFIRMED')
          ORDER BY period_end DESC LIMIT 1`,
    args: [campaign.id, campaign.advertiser_id]
  })).rows[0];

  const experiments = (await db.execute({
    sql: `SELECT COUNT(*) AS n FROM experiments WHERE campaign_id = ?`,
    args: [campaign.id]
  })).rows[0];

  const checks = [
    {
      key: 'objective_selected', label: 'Objective selected', blocking: true,
      passed: !!(campaign.campaign_source && campaign.campaign_name),
      detail: campaign.campaign_name ? 'Campaign objective is recorded as "' + campaign.campaign_name + '".' : 'No campaign objective recorded.'
    },
    {
      key: 'budget_configured', label: 'Budget configured', blocking: false,
      passed: Number(campaign.total_budget || 0) > 0,
      detail: Number(campaign.total_budget || 0) > 0 ? 'Budget of ' + campaign.total_budget + ' configured.' : 'No budget configured, so the pacer cannot run.'
    },
    {
      key: 'duration_configured', label: 'Duration configured', blocking: false,
      passed: !!(campaign.start_date && campaign.end_date),
      detail: (campaign.start_date && campaign.end_date) ? 'Runs ' + campaign.start_date + ' to ' + campaign.end_date + '.' : 'Start or end date is missing.'
    },
    {
      key: 'creative_attached', label: 'Creative attached', blocking: false,
      passed: creatives.length > 0,
      detail: creatives.length ? creatives.length + ' creative(s) attached.' : 'No creative attached yet.'
    },
    {
      key: 'goal_configured', label: 'Goal configured', blocking: false,
      passed: goals.length > 0,
      detail: goals.length ? goals.map(function (g) { return g.goal_type; }).join(', ') : 'No goal configured, so progress cannot be judged.'
    },
    {
      key: 'destination_available', label: 'Destination available', blocking: true,
      passed: !!campaign.qwk_banner_id,
      detail: campaign.qwk_banner_id ? 'A QWK banner/destination is linked.' : 'No destination linked, so the campaign has nowhere to send anyone.'
    },
    {
      key: 'tracking_configured', label: 'Tracking configured', blocking: false,
      passed: !!config,
      detail: config ? 'Journey tracking configured with ' + (config.journey_steps || []).length + ' step(s).' : 'Journey tracking has not been configured, so drop-off analysis cannot run.'
    },
    {
      key: 'banq_monitoring_selected', label: 'BANQ monitoring selected', blocking: false,
      passed: !!subs,
      detail: subs ? 'BANQ monitoring is ' + subs.banq_service_status + '.' : 'BANQ monitoring is not active, so monitoring tools stay locked.'
    },
    {
      key: 'experiment_configured', label: 'Experiment configured', blocking: false,
      passed: Number(experiments.n) > 0,
      detail: Number(experiments.n) > 0 ? 'An experiment is configured.' : 'No experiment configured. Optional.'
    },
    {
      key: 'required_approvals_completed', label: 'Required approvals completed', blocking: false,
      passed: true,
      detail: 'No approval step is required on the platform at this time.'
    }
  ];

  const blockingFailed = checks.filter(function (c) { return c.blocking && !c.passed; });
  const observations = checks.filter(function (c) { return !c.blocking && !c.passed; });
  const score = Math.round((checks.filter(function (c) { return c.passed; }).length / checks.length) * 100);

  let state;
  if (blockingFailed.length) state = 'NOT_READY';
  else if (observations.length === 0) state = 'READY';
  else if (observations.length <= 2) state = 'READY_WITH_OBSERVATIONS';
  else state = 'NEEDS_ATTENTION';

  await db.execute({
    sql: `INSERT INTO campaign_readiness_checks (campaign_id, score, checks, state) VALUES (?, ?, ?, ?)`,
    args: [campaign.id, score, JSON.stringify(checks), state]
  });
  await logActivity(campaign.id, actor ? actor.id : null, 'READINESS_CHECKED', { score, state });

  return {
    campaign_id: campaign.id,
    score,
    state,
    checks,
    missing: checks.filter(function (c) { return !c.passed; }).map(function (c) { return { key: c.key, label: c.label, blocking: c.blocking, detail: c.detail }; }),
    blocking: blockingFailed.map(function (c) { return c.label; }),
    health_at_check: { score: health.score, status: health.status },
    pacing_at_check: pacer.state,
    // HUMAN OVERRIDE, made explicit in the response rather than only in policy.
    override_note: blockingFailed.length
      ? 'A blocking item is missing. These are technical requirements, not opinions: ' + blockingFailed.map(function (c) { return c.label; }).join(', ') + '.'
      : 'BANQ does not block a launch on an observation. You may proceed and address the observations later.'
  };
}

async function latestReadiness(campaignId) {
  const row = (await db.execute({
    sql: `SELECT * FROM campaign_readiness_checks WHERE campaign_id = ? ORDER BY calculated_at DESC LIMIT 1`,
    args: [Number(campaignId)]
  })).rows[0];
  if (!row) return null;
  return Object.assign({}, row, { checks: safeJson(row.checks, []) });
}

// ==================================================================
// 4.2 -- Campaign Planner
// ==================================================================
/**
 * Turns an objective into a recommended structure. The plan output separates
 * SYSTEM_SUGGESTION from BANQ_RECOMMENDATION from ADVERTISER_DECISION, so a
 * template the platform generated is never mistaken for a human's advice.
 */
async function createPlan(input, actor) {
  const structure = recommendStructure(input);
  const res = await db.execute({
    sql: `INSERT INTO campaign_plans
          (advertiser_id, campaign_name, objective, duration, budget, creative_type, target_audience, region,
           primary_goal, secondary_goals, recommended_structure)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      Number(input.advertiser_id), String(input.campaign_name || 'Untitled plan'), String(input.objective || 'BRAND_AWARENESS'),
      Number(input.duration) || 30, Number(input.budget) || 0,
      String(input.creative_type || 'IMAGE'), input.target_audience || null, input.region || null,
      input.primary_goal || null,
      input.secondary_goals ? JSON.stringify(input.secondary_goals) : null,
      JSON.stringify(structure)
    ]
  });
  const id = Number(res.lastInsertRowid);
  await logActivity(null, actor ? actor.id : null, 'PLAN_CREATED', { plan_id: id });
  return { id, recommended_structure: structure };
}

function recommendStructure(input) {
  const budget = Number(input.budget) || 0;
  const duration = Number(input.duration) || 30;
  const objective = String(input.objective || 'BRAND_AWARENESS').toUpperCase();

  // Creative count scales with budget and duration, with a floor of one video
  // and a ceiling so the recommendation stays executable.
  const creativeCount = Math.max(2, Math.min(8, Math.round(budget / 5000) + Math.round(duration / 30) + 1));
  const banners = Math.max(1, creativeCount - 1);

  return {
    source_labels: {
      recommended_creatives: 'SYSTEM_SUGGESTION',
      review_schedule: 'SYSTEM_SUGGESTION',
      journey_tracking: 'BANQ_RECOMMENDATION',
      budget_split: 'BANQ_RECOMMENDATION'
    },
    recommended_creatives: {
      total: creativeCount,
      primary_video: 1,
      supporting_banners: banners,
      statement: 'A structure of 1 primary video and ' + banners + ' supporting banner(s) gives the campaign something to compare without spreading the budget thin.'
    },
    review_schedule: {
      cadence: 'weekly',
      first_review_day: Math.min(7, Math.max(3, Math.round(duration / 4))),
      statement: 'Review weekly, with the first check on day ' + Math.min(7, Math.max(3, Math.round(duration / 4))) + '.'
    },
    journey_tracking: {
      enabled: true,
      steps: objective === 'SALES' || objective === 'BOOKINGS'
        ? ['IMPRESSION', 'CLICK', 'LANDING_PAGE_VISIT', 'SIGN_UP', 'PURCHASE']
        : ['IMPRESSION', 'CLICK', 'LANDING_PAGE_VISIT', 'SIGN_UP'],
      statement: 'Journey tracking enabled so drop-off can be attributed to a step rather than guessed.'
    },
    budget_split: {
      awareness_share_pct: objective === 'BRAND_AWARENESS' ? 70 : 40,
      conversion_share_pct: objective === 'BRAND_AWARENESS' ? 30 : 60,
      statement: 'Split weighted toward ' + (objective === 'BRAND_AWARENESS' ? 'reach' : 'conversion') + ' because the objective is ' + objective + '.'
    },
    advertiser_decision_required: [
      'Which creative becomes the primary video',
      'Whether to raise the budget before launch',
      'Whether to run the suggested experiment'
    ]
  };
}

async function listPlans(advertiserId) {
  const rows = (await db.execute({
    sql: `SELECT * FROM campaign_plans WHERE advertiser_id = ? ORDER BY created_at DESC`,
    args: [Number(advertiserId)]
  })).rows;
  return rows.map(function (r) {
    return Object.assign({}, r, {
      secondary_goals: safeJson(r.secondary_goals, null),
      recommended_structure: safeJson(r.recommended_structure, null)
    });
  });
}

// ==================================================================
// 4.3 -- Automated Reporting
// ==================================================================
const REPORT_TYPES = ['Campaign Summary', 'Weekly', 'Monthly', 'Campaign Completion', 'Enterprise Summary'];

/**
 * Two tables on purpose: `reports` is the index, `report_snapshots` holds the
 * frozen data. A generated report is never rewritten, because a report that
 * changes after the fact is not evidence of anything.
 */
async function generateReport(input, actor) {
  const reportType = String(input.report_type || 'Campaign Summary');
  if (!REPORT_TYPES.includes(reportType)) {
    throw Object.assign(new Error('Report type must be one of: ' + REPORT_TYPES.join(', ')), { code: 400 });
  }
  const campaignId = input.campaign_id ? Number(input.campaign_id) : null;
  let snapshot;

  if (campaignId) {
    const campaign = (await db.execute({ sql: `SELECT * FROM campaigns WHERE id = ?`, args: [campaignId] })).rows[0];
    if (!campaign) throw Object.assign(new Error('Campaign not found.'), { code: 404 });
    const card = await p1.generateReport(campaign, {
      report_type: reportType, period_start: input.period_start, period_end: input.period_end
    }, actor);
    snapshot = Object.assign({}, card.snapshot, { report_kind: 'campaign', source_report_id: card.id });
  } else {
    snapshot = await enterpriseSnapshot(actor);
  }

  const res = await db.execute({
    sql: `INSERT INTO reports (report_type, campaign_id, period_start, period_end, generated_by, status)
          VALUES (?, ?, ?, ?, ?, 'generated')`,
    args: [reportType, campaignId, input.period_start || null, input.period_end || null, actor ? actor.id : null]
  });
  const reportId = Number(res.lastInsertRowid);
  await db.execute({
    sql: `INSERT INTO report_snapshots (report_id, data) VALUES (?, ?)`,
    args: [reportId, JSON.stringify(snapshot)]
  });
  await db.execute({
    sql: `UPDATE reports SET data_snapshot_reference = ? WHERE id = ?`,
    args: ['snapshot:' + reportId, reportId]
  });
  if (campaignId) {
    await logActivity(campaignId, actor ? actor.id : null, 'REPORT_GENERATED', { report_id: reportId, report_type: reportType });
  }
  return { id: reportId, report_type: reportType, snapshot, delivery: 'in-app' };
}

async function enterpriseSnapshot(actor) {
  const counts = (await db.execute({
    sql: `SELECT COUNT(*) AS campaigns,
                 (SELECT COUNT(*) FROM ad_creatives) AS creatives,
                 (SELECT COUNT(*) FROM banq_alerts WHERE status = 'NEW') AS open_alerts,
                 (SELECT COUNT(*) FROM banq_recommendations WHERE status = 'NEW') AS open_recommendations,
                 (SELECT COUNT(*) FROM experiments WHERE status = 'RUNNING') AS running_experiments
          FROM campaigns`
  })).rows[0];
  const health = (await db.execute({
    sql: `SELECT status, COUNT(*) AS n FROM campaign_health_scores
          WHERE id IN (SELECT MAX(id) FROM campaign_health_scores GROUP BY campaign_id) GROUP BY status`
  })).rows;
  return {
    report_kind: 'enterprise',
    campaigns: Number(counts.campaigns),
    creatives: Number(counts.creatives),
    open_alerts: Number(counts.open_alerts),
    open_recommendations: Number(counts.open_recommendations),
    running_experiments: Number(counts.running_experiments),
    health_mix: health.map(function (h) { return { status: h.status, count: Number(h.n) }; }),
    generated_by_role: actor && actor.is_admin ? 'BANQ_STAFF' : 'ADVERTISER'
  };
}

async function listReports(opts) {
  const o = opts || {};
  const clauses = [];
  const args = [];
  if (o.campaign_id) { clauses.push('campaign_id = ?'); args.push(Number(o.campaign_id)); }
  if (o.report_type) { clauses.push('report_type = ?'); args.push(String(o.report_type)); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  return (await db.execute({
    sql: `SELECT id, report_type, campaign_id, generated_at, period_start, period_end, status, data_snapshot_reference
          FROM reports ${where} ORDER BY generated_at DESC LIMIT 200`,
    args
  })).rows;
}

async function getReport(reportId, actor) {
  const report = (await db.execute({ sql: `SELECT * FROM reports WHERE id = ?`, args: [Number(reportId)] })).rows[0];
  if (!report) throw Object.assign(new Error('Report not found.'), { code: 404 });
  const snap = (await db.execute({
    sql: `SELECT * FROM report_snapshots WHERE report_id = ? ORDER BY created_at DESC LIMIT 1`,
    args: [Number(reportId)]
  })).rows[0];
  await logActivity(report.campaign_id, actor ? actor.id : null, 'REPORT_VIEWED', { report_id: Number(reportId) });
  return Object.assign({}, report, { snapshot: snap ? safeJson(snap.data, null) : null });
}

// ==================================================================
// 4.4 -- Placement Intelligence
// ==================================================================
async function createPlacement(input) {
  const res = await db.execute({
    sql: `INSERT INTO placement_profiles (publisher_category, placement_type, creative_format, region, device_type, historical_delivery_data, availability_status)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [input.publisher_category || null, input.placement_type || null, input.creative_format || null,
      input.region || null, input.device_type || null,
      input.historical_delivery_data ? JSON.stringify(input.historical_delivery_data) : null,
      String(input.availability_status || 'available')]
  });
  return { id: Number(res.lastInsertRowid) };
}

async function listPlacements(opts) {
  const o = opts || {};
  const rows = (await db.execute({
    sql: `SELECT p.*, (SELECT COUNT(*) FROM placement_insights i WHERE i.placement_id = p.id) AS insight_count
          FROM placement_profiles p ${o.region ? 'WHERE p.region = ?' : ''} ORDER BY p.id ASC`,
    args: o.region ? [String(o.region)] : []
  })).rows;
  return rows.map(function (r) {
    return Object.assign({}, r, { historical_delivery_data: safeJson(r.historical_delivery_data, null) });
  });
}

/**
 * Compares placements on authorised aggregate data only. QWK Browser owns the
 * Publisher Network; BANQ analyses what it is given and reports the rest as
 * unavailable rather than estimating it.
 */
async function comparePlacements(ids, actor) {
  if (!Array.isArray(ids) || ids.length < 1) {
    throw Object.assign(new Error('Provide at least one placement id to compare.'), { code: 400 });
  }
  const out = [];
  for (const id of ids.map(Number)) {
    const p = (await db.execute({ sql: `SELECT * FROM placement_profiles WHERE id = ?`, args: [id] })).rows[0];
    if (!p) { out.push({ placement_id: id, state: 'NOT_FOUND' }); continue; }
    const insights = (await db.execute({
      sql: `SELECT * FROM placement_insights WHERE placement_id = ?`,
      args: [id]
    })).rows;
    out.push({
      placement_id: id,
      publisher_category: p.publisher_category,
      placement_type: p.placement_type,
      creative_format: p.creative_format,
      region: p.region,
      device_type: p.device_type,
      availability_status: p.availability_status,
      metrics: insights.length
        ? insights.map(function (i) { return { metric_name: i.metric_name, metric_value: Number(i.metric_value) }; })
        : null,
      state: insights.length ? 'OK' : 'DATA_UNAVAILABLE',
      note: insights.length ? null : 'No authorised delivery data is available for this placement.'
    });
  }
  if (actor) await logActivity(null, actor.id, 'PLACEMENT_VIEWED', { ids: ids.length });
  return { placements: out, publisher_note: 'Publisher Network inventory is owned and controlled by QWK Browser. BANQ reports only authorised aggregate data.' };
}

// ==================================================================
// 4.5 -- Predictive Alerts
// ==================================================================
async function evaluatePredictiveAlerts(campaign, actor) {
  const pacer = await p1.budgetPacer(campaign, {});
  const goals = await p1.listGoals(campaign.id);
  const trend = await p1.performanceTrend(campaign.id);
  const endpoints = await p1.getDeliveryEndpoints(campaign);
  const metrics = (await db.execute({
    sql: `SELECT COUNT(*) AS n, MAX(timestamp) AS last FROM campaign_metrics WHERE campaign_id = ?`,
    args: [campaign.id]
  })).rows[0];

  const predictions = [];
  const now = Date.now();
  const daysLeft = Math.max(0, (endpoints.end.getTime() - now) / 86400000);

  if (pacer.state === 'AT_RISK' || pacer.state === 'SPENDING_FAST') {
    predictions.push({
      prediction_type: 'POSSIBLE_BUDGET_EXHAUSTION',
      prediction_window: 'next ' + Math.max(1, Math.round(daysLeft)) + ' days',
      confidence_level: pacer.state === 'AT_RISK' ? 'HIGH_DATA_SUPPORT' : 'MODERATE',
      supporting_data: { pacing_ratio_pct: pacer.pacing_ratio_pct, projected_exhaustion: pacer.projected_exhaustion, remaining: pacer.remaining },
      recommended_action: 'Consider reviewing the budget or the targeting scope before the projected exhaustion point.',
      // Phase 4 language: "may", not "will". The Phase 1 alert says what is
      // happening now; this one says what could happen next.
      message: 'Based on the current spending pattern, the campaign may exhaust its budget before the scheduled end date.'
    });
  }

  for (const g of goals) {
    if (!g.target || g.progress_pct === null) continue;
    const start = parseDbDate(campaign.start_date) || parseDbDate(campaign.created_at);
    const total = endpoints.end - start;
    const elapsedFraction = total > 0 ? Math.min(1, (now - start.getTime()) / total) : null;
    if (elapsedFraction === null) continue;
    if (g.progress_pct < elapsedFraction * 100 - 15) {
      predictions.push({
        prediction_type: 'POSSIBLE_GOAL_SHORTFALL',
        prediction_window: Math.max(1, Math.round(daysLeft)) + '-day remainder',
        confidence_level: elapsedFraction > 0.6 ? 'MODERATE' : 'LIMITED',
        supporting_data: { goal_type: g.goal_type, progress_pct: g.progress_pct, elapsed_pct: Math.round(elapsedFraction * 100) },
        recommended_action: 'Consider whether the target is still realistic, or whether the goal should be revised.',
        message: 'At the current rate the campaign may finish below its ' + g.goal_type + ' target.'
      });
    }
  }

  const lastAt = metrics && metrics.last ? parseDbDate(metrics.last) : null;
  const hoursSince = lastAt ? (now - lastAt.getTime()) / 3600000 : null;
  if (hoursSince !== null && hoursSince > 36) {
    predictions.push({
      prediction_type: 'POSSIBLE_UNDERDELIVERY',
      prediction_window: 'next 24 hours',
      confidence_level: hoursSince > 72 ? 'HIGH_DATA_SUPPORT' : 'MODERATE',
      supporting_data: { hours_since_last_metric: Math.round(hoursSince) },
      recommended_action: 'Consider checking that the destination and creative are still live.',
      message: 'Delivery has slowed recently, so the campaign may underdeliver against its schedule.'
    });
  }

  if (trend && trend.change_pct !== null && trend.change_pct < -10) {
    predictions.push({
      prediction_type: 'POSSIBLE_CREATIVE_DECLINE',
      prediction_window: 'next 1-2 weeks',
      confidence_level: trend.change_pct < -25 ? 'MODERATE' : 'LIMITED',
      supporting_data: { trend },
      recommended_action: 'Consider a creative review before the decline compounds.',
      message: 'If the current trend continues, ' + trend.metric_name + ' may keep falling over the coming weeks.'
    });
  }

  if (!metrics || !Number(metrics.n)) {
    predictions.push({
      prediction_type: 'POSSIBLE_TRACKING_ISSUE',
      prediction_window: 'immediate',
      confidence_level: 'INSUFFICIENT',
      supporting_data: { metric_rows: 0 },
      recommended_action: 'Consider verifying that tracking is installed and reporting.',
      message: 'No delivery data has arrived, so BANQ cannot predict campaign behaviour yet. Tracking may not be reporting.'
    });
  }

  const created = [];
  for (const p of predictions) {
    // Recalculate rather than duplicate: an ACTIVE prediction of the same type
    // is updated in place, which is what "recalculated as new data arrives"
    // means in the spec.
    const existing = (await db.execute({
      sql: `SELECT * FROM predictive_alerts WHERE campaign_id = ? AND prediction_type = ? AND status = 'ACTIVE' LIMIT 1`,
      args: [campaign.id, p.prediction_type]
    })).rows[0];
    if (existing) {
      await db.execute({
        sql: `UPDATE predictive_alerts SET confidence_level = ?, supporting_data = ?, recommended_action = ?,
              prediction_window = ?, generated_at = CURRENT_TIMESTAMP, status = 'UPDATED' WHERE id = ?`,
        args: [p.confidence_level, JSON.stringify(p.supporting_data), p.recommended_action, p.prediction_window, existing.id]
      });
      created.push({ id: existing.id, prediction_type: p.prediction_type, updated: true, message: p.message });
      continue;
    }
    const res = await db.execute({
      sql: `INSERT INTO predictive_alerts (campaign_id, prediction_type, prediction_window, confidence_level, supporting_data, recommended_action)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [campaign.id, p.prediction_type, p.prediction_window, p.confidence_level,
        JSON.stringify(p.supporting_data), p.recommended_action]
    });
    const id = Number(res.lastInsertRowid);
    await timerilineAddSafe(campaign.id, id, p.prediction_type, actor);
    created.push({ id, prediction_type: p.prediction_type, updated: false, message: p.message });
  }

  return {
    evaluated: predictions.length,
    alerts: created,
    language_rule: 'Predictions describe what may happen from the observed pattern. They are not guarantees.'
  };
}

async function timerilineAddSafe(campaignId, alertId, type, actor) {
  await timelineAdd(campaignId, 'PREDICTIVE_ALERT_GENERATED', 'BANQ', actor ? actor.id : null, { predictive_alert_id: alertId, prediction_type: type });
  await logActivity(campaignId, actor ? actor.id : null, 'PREDICTIVE_ALERT_GENERATED', { predictive_alert_id: alertId });
}

async function listPredictiveAlerts(campaignId, opts) {
  const o = opts || {};
  const rows = (await db.execute({
    sql: `SELECT * FROM predictive_alerts WHERE campaign_id = ? ${o.status ? 'AND status = ?' : ''}
          ORDER BY generated_at DESC LIMIT 100`,
    args: o.status ? [Number(campaignId), String(o.status).toUpperCase()] : [Number(campaignId)]
  })).rows;
  return rows.map(function (r) { return Object.assign({}, r, { supporting_data: safeJson(r.supporting_data, null) }); });
}

/** The human override: dismissing a prediction is always available. */
async function setPredictiveAlertStatus(alertId, status, actor) {
  const s = String(status || '').toUpperCase();
  if (!PREDICTION_STATUSES.includes(s)) {
    throw Object.assign(new Error('Status must be one of: ' + PREDICTION_STATUSES.join(', ')), { code: 400 });
  }
  const alert = (await db.execute({ sql: `SELECT * FROM predictive_alerts WHERE id = ?`, args: [Number(alertId)] })).rows[0];
  if (!alert) throw Object.assign(new Error('Predictive alert not found.'), { code: 404 });
  await db.execute({ sql: `UPDATE predictive_alerts SET status = ? WHERE id = ?`, args: [s, Number(alertId)] });
  await logActivity(alert.campaign_id, actor ? actor.id : null, 'PREDICTIVE_ALERT_' + s, { predictive_alert_id: Number(alertId) });
  return { id: Number(alertId), status: s };
}

// ==================================================================
// 4.6 -- Scenario Simulator
// ==================================================================
async function createScenario(planId, variables, actor) {
  if (!variables || typeof variables !== 'object') {
    throw Object.assign(new Error('A scenario needs variables, for example { budget, duration }.'), { code: 400 });
  }
  const plan = (await db.execute({ sql: `SELECT * FROM campaign_plans WHERE id = ?`, args: [Number(planId)] })).rows[0];
  if (!plan) throw Object.assign(new Error('Plan not found.'), { code: 404 });
  const res = await db.execute({
    sql: `INSERT INTO campaign_scenarios (plan_id, variables) VALUES (?, ?)`,
    args: [Number(planId), JSON.stringify(variables)]
  });
  return { id: Number(res.lastInsertRowid), variables };
}

/**
 * Simulation without fabrication. The model has two parts:
 *
 *  - If the advertiser has real history, it scales that observed rate and
 *    publishes a RANGE around it at HIGH_DATA_SUPPORT.
 *  - If it does not, it reports the comparison as relative only
 *    (more budget -> more reach) and labels the confidence LIMITED, because a
 *    speculative absolute number is precisely what the spec forbids.
 */
async function simulateScenario(scenarioId, actor) {
  const scenario = (await db.execute({ sql: `SELECT * FROM campaign_scenarios WHERE id = ?`, args: [Number(scenarioId)] })).rows[0];
  if (!scenario) throw Object.assign(new Error('Scenario not found.'), { code: 404 });
  const variables = safeJson(scenario.variables, {});
  const plan = (await db.execute({ sql: `SELECT * FROM campaign_plans WHERE id = ?`, args: [scenario.plan_id] })).rows[0];

  // History is scoped to the plan's OWN advertiser. Using another advertiser's
  // delivery rate to forecast this one would be a privacy leak dressed up as a
  // simulation input.
  const history = (await db.execute({
    sql: `SELECT SUM(m.metric_value) AS impressions, COUNT(DISTINCT m.campaign_id) AS campaigns
          FROM campaign_metrics m
          JOIN campaigns c ON c.id = m.campaign_id
          WHERE m.metric_name = 'impressions' AND c.advertiser_id = ?`,
    args: [plan ? plan.advertiser_id : 0]
  })).rows[0];

  const budget = Number(variables.budget || (plan && plan.budget) || 0);
  const duration = Number(variables.duration || (plan && plan.duration) || 30);
  const baselineImpressions = Number(history && history.impressions ? history.impressions : 0);
  const campaignsWithData = Number(history && history.campaigns ? history.campaigns : 0);

  let results;
  let confidence;

  if (baselineImpressions > 0 && campaignsWithData >= 3) {
    const observedPerBudgetDay = baselineImpressions / Math.max(1, campaignsWithData) / 30;
    const centre = Math.round(observedPerBudgetDay * budget * duration * 0.001);
    const spread = Math.round(centre * 0.25);
    confidence = 'HIGH_DATA_SUPPORT';
    results = {
      basis: 'observed_history',
      budget, duration,
      forecast_range: {
        low: Math.max(0, centre - spread),
        high: centre + spread,
        statement: 'A range of ' + Math.max(0, centre - spread) + ' to ' + (centre + spread) + ' estimated reach units, based on the rate your campaigns have actually delivered.'
      }
    };
  } else {
    confidence = 'LIMITED';
    results = {
      basis: 'relative_only',
      budget, duration,
      forecast_range: null,
      relative: {
        budget_vs_plan: plan && plan.budget ? Math.round(((budget - plan.budget) / plan.budget) * 100) : null,
        duration_vs_plan: plan && plan.duration ? Math.round(((duration - plan.duration) / plan.duration) * 100) : null,
        statement: 'Not enough of your own delivery history exists yet to state a number. What can be said is relative: more budget over a longer period reaches more people, and the reverse.'
      }
    };
  }

  const res = await db.execute({
    sql: `INSERT INTO scenario_simulations (scenario_id, results, confidence_level) VALUES (?, ?, ?)`,
    args: [Number(scenarioId), JSON.stringify(results), confidence]
  });

  return {
    scenario_id: Number(scenarioId),
    confidence_level: confidence,
    results,
    certainty_rule: 'A forecast is shown as a range. No single number is presented as certainty.'
  };
}

async function listScenarios(planId) {
  const rows = (await db.execute({
    sql: `SELECT s.*, (SELECT r.results FROM scenario_simulations r WHERE r.scenario_id = s.id ORDER BY r.calculated_at DESC LIMIT 1) AS latest_results,
                 (SELECT r.confidence_level FROM scenario_simulations r WHERE r.scenario_id = s.id ORDER BY r.calculated_at DESC LIMIT 1) AS confidence_level
          FROM campaign_scenarios s WHERE s.plan_id = ? ORDER BY s.created_at ASC`,
    args: [Number(planId)]
  })).rows;
  return rows.map(function (r) {
    return Object.assign({}, r, {
      variables: safeJson(r.variables, {}),
      latest_results: safeJson(r.latest_results, null)
    });
  });
}

// ==================================================================
// 4.7 -- Forecast Engine (versioned)
// ==================================================================
/**
 * Every forecast is stamped with a model version and stores its inputs, so a
 * forecast from three months ago can be re-read knowing exactly what the model
 * was and what it was fed. Without that, a history of forecasts is a history of
 * numbers with no provenance.
 */
async function generateForecast(campaign, forecastType, actor) {
  const version = await cfg('forecast_model_version', 'v1');
  const pacer = await p1.budgetPacer(campaign, {});
  const goals = await p1.listGoals(campaign.id);
  const trend = await p1.performanceTrend(campaign.id);
  const endpoints = await p1.getDeliveryEndpoints(campaign);
  const daysLeft = Math.max(0, (endpoints.end.getTime() - Date.now()) / 86400000);

  const inputs = {
    pacing_state: pacer.state,
    pacing_ratio_pct: pacer.pacing_ratio_pct,
    remaining_budget: pacer.remaining,
    days_remaining: Math.round(daysLeft),
    goal_progress: goals.map(function (g) { return { goal_type: g.goal_type, progress_pct: g.progress_pct }; }),
    trend: trend ? { metric_name: trend.metric_name, change_pct: trend.change_pct } : null
  };

  let range, confidence, type = forecastType;
  if (pacer.state === 'AT_RISK' || pacer.state === 'SPENDING_FAST') {
    type = type || 'BUDGET_EXHAUSTION';
    const days = pacer.projected_exhaustion
      ? Math.max(0, (new Date(pacer.projected_exhaustion).getTime() - Date.now()) / 86400000)
      : null;
    confidence = pacer.state === 'AT_RISK' ? 'HIGH_DATA_SUPPORT' : 'MODERATE';
    range = days === null
      ? 'Budget may exhaust before the campaign ends.'
      : Math.max(0, Math.round(days - 2)) + ' to ' + Math.round(days + 2) + ' days remaining before the budget is used.';
  } else {
    type = type || 'PERFORMANCE';
    confidence = trend && trend.change_pct !== null ? 'MODERATE' : 'LIMITED';
    if (trend && trend.change_pct !== null) {
      const projected = trend.recent * (1 + (trend.change_pct / 100));
      range = Math.round(Math.min(trend.recent, projected)) + ' to ' + Math.round(Math.max(trend.recent, projected)) + ' ' + trend.metric_name + ' expected in the next period.';
    } else {
      range = 'Not enough history for a range yet.';
    }
  }

  const res = await db.execute({
    sql: `INSERT INTO forecasts (campaign_id, forecast_type, forecast_range, confidence_level, model_version, inputs)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [campaign.id, type, range, confidence, version, JSON.stringify(inputs)]
  });
  const id = Number(res.lastInsertRowid);
  await db.execute({
    sql: `INSERT INTO forecast_history (forecast_id, snapshot) VALUES (?, ?)`,
    args: [id, JSON.stringify({ range, confidence, version, inputs })]
  });
  await logActivity(campaign.id, actor ? actor.id : null, 'FORECAST_GENERATED', { forecast_id: id, type, version });

  return {
    id, forecast_type: type, forecast_range: range, confidence_level: confidence,
    model_version: version, inputs,
    certainty_rule: 'Range and confidence, never a single number presented as certainty.'
  };
}

async function listForecasts(campaignId) {
  const rows = (await db.execute({
    sql: `SELECT * FROM forecasts WHERE campaign_id = ? ORDER BY generated_at DESC LIMIT 100`,
    args: [Number(campaignId)]
  })).rows;
  return rows.map(function (r) { return Object.assign({}, r, { inputs: safeJson(r.inputs, null) }); });
}

// ==================================================================
// 4.8 -- BANQ Go-To-Market Workspace
// ==================================================================
async function createGtmProject(input, actor) {
  const res = await db.execute({
    sql: `INSERT INTO gtm_projects (advertiser_id, name, objective) VALUES (?, ?, ?)`,
    args: [Number(input.advertiser_id), String(input.name), input.objective || null]
  });
  const id = Number(res.lastInsertRowid);
  // Every project starts with the full stage ladder, so the timeline exists
  // before anyone needs it.
  for (const stage of GTM_STAGES) {
    await db.execute({
      sql: `INSERT INTO gtm_timelines (project_id, stage, tasks) VALUES (?, ?, ?)`,
      args: [id, stage, JSON.stringify([])]
    });
  }
  await logActivity(null, actor ? actor.id : null, 'GTM_PROJECT_CREATED', { project_id: id });
  return { id, stages: GTM_STAGES };
}

async function getGtmProject(projectId, actor) {
  const project = (await db.execute({ sql: `SELECT * FROM gtm_projects WHERE id = ?`, args: [Number(projectId)] })).rows[0];
  if (!project) throw Object.assign(new Error('GTM project not found.'), { code: 404 });
  const objectives = (await db.execute({
    sql: `SELECT * FROM gtm_objectives WHERE project_id = ?`,
    args: [Number(projectId)]
  })).rows;
  const timeline = (await db.execute({
    sql: `SELECT * FROM gtm_timelines WHERE project_id = ?`,
    args: [Number(projectId)]
  })).rows;
  const tasks = (await db.execute({
    sql: `SELECT * FROM gtm_tasks WHERE project_id = ? ORDER BY created_at ASC`,
    args: [Number(projectId)]
  })).rows;
  const learning = (await db.execute({
    sql: `SELECT * FROM learning_archive WHERE advertiser_id = ? ORDER BY created_at DESC`,
    args: [project.advertiser_id]
  })).rows;
  return {
    project,
    objectives: objectives.map(function (o) {
      return Object.assign({}, o, {
        secondary_objectives: safeJson(o.secondary_objectives, null),
        success_metrics: safeJson(o.success_metrics, null),
        target_dates: safeJson(o.target_dates, null),
        responsible_teams: safeJson(o.responsible_teams, null)
      });
    }),
    timeline: GTM_STAGES.map(function (stage) {
      const row = timeline.find(function (t) { return t.stage === stage; });
      return { stage, tasks: row ? safeJson(row.tasks, []) : [] };
    }),
    tasks,
    learning_archive: learning,
    connects: 'BUSINESS_OBJECTIVE -> CAMPAIGN_STRATEGY -> CAMPAIGN_PLAN -> CREATIVE -> AD_DELIVERY -> CUSTOMER_JOURNEY -> MEASUREMENT -> LEARNING'
  };
}

async function addGtmTask(projectId, input, actor) {
  const res = await db.execute({
    sql: `INSERT INTO gtm_tasks (project_id, assigned_to, status) VALUES (?, ?, ?)`,
    args: [Number(projectId), input.assigned_to ? Number(input.assigned_to) : null, String(input.status || 'pending')]
  });
  return { id: Number(res.lastInsertRowid) };
}

async function addLearning(advertiserId, input, actor) {
  const status = String(input.status || 'OBSERVED').toUpperCase();
  if (!LEARNING_STATUSES.includes(status)) {
    throw Object.assign(new Error('Learning status must be one of: ' + LEARNING_STATUSES.join(', ')), { code: 400 });
  }
  const res = await db.execute({
    sql: `INSERT INTO learning_archive (advertiser_id, observation, evidence, status) VALUES (?, ?, ?, ?)`,
    args: [Number(advertiserId), String(input.observation), input.evidence || null, status]
  });
  return { id: Number(res.lastInsertRowid), status };
}

async function listGtmProjects(advertiserId) {
  return (await db.execute({
    sql: `SELECT p.*, (SELECT COUNT(*) FROM gtm_tasks t WHERE t.project_id = p.id) AS task_count
          FROM gtm_projects p WHERE p.advertiser_id = ? ORDER BY p.created_at DESC`,
    args: [Number(advertiserId)]
  })).rows;
}

module.exports = {
  READINESS_STATES, PREDICTION_TYPES, PREDICTION_STATUSES, CONFIDENCE_LEVELS,
  REPORT_TYPES, GTM_STAGES, LEARNING_STATUSES,
  readinessCheck, latestReadiness,
  createPlan, recommendStructure, listPlans,
  generateReport, listReports, getReport, enterpriseSnapshot,
  createPlacement, listPlacements, comparePlacements,
  evaluatePredictiveAlerts, listPredictiveAlerts, setPredictiveAlertStatus,
  createScenario, simulateScenario, listScenarios,
  generateForecast, listForecasts,
  createGtmProject, getGtmProject, addGtmTask, addLearning, listGtmProjects
};
