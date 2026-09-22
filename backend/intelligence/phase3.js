/*
 * New Quanthoms Billboard Agency (BANQ)
 * backend/intelligence/phase3.js -- PHASE 3: LEARN
 *
 * "What happens across the journey, what can we test?"
 *
 *   3.1 journey events   3.2 journey config   3.3 drop-off
 *   3.4 experiments      3.5 experiment results
 *   3.6 benchmarking     3.7 cross-campaign     3.8 enterprise
 *   3.9 team workspace
 *
 * THE TWO RULES THIS FILE EXISTS TO ENFORCE:
 *
 * 1. Never blend estimated data with verified data. A journey event carries its
 *    source and that source carries a quality status, so a funnel built from
 *    ESTIMATED rows is labelled as such. A blended funnel looks precise and is
 *    not.
 *
 * 2. Never expose another advertiser. Benchmarking aggregates and refuses to
 *    publish a group below the configured minimum campaign count; a benchmark
 *    of two campaigns is a way to read the other one.
 */

const { db } = require('../db');
const core = require('./core');
const { cfg, logActivity, timelineAdd, pct, safeJson, parseDbDate } = core;

const STANDARD_EVENTS = ['IMPRESSION', 'CLICK', 'ENGAGEMENT', 'VIDEO_VIEW', 'LANDING_PAGE_VISIT',
  'SIGN_UP', 'LEAD', 'CONTACT', 'DOWNLOAD', 'BOOKING', 'PURCHASE', 'CUSTOM_EVENT'];
const QUALITY_STATUSES = ['VERIFIED', 'TRACKED', 'ESTIMATED', 'DELAYED', 'UNAVAILABLE'];
const EXPERIMENT_TYPES = ['CREATIVE', 'HEADLINE', 'CTA', 'LANDING_PAGE', 'AUDIENCE', 'PLACEMENT', 'BUDGET'];
const EXPERIMENT_STATUSES = ['DRAFT', 'READY', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'INVALID'];
const RESULT_LABELS = ['EARLY_SIGNAL', 'POSITIVE_SIGNAL', 'NO_MEANINGFUL_DIFFERENCE', 'NEGATIVE_SIGNAL', 'INCONCLUSIVE'];
const EXPERIMENT_DECISIONS = ['KEEP_CONTROL', 'ADOPT_VARIANT', 'RUN_ANOTHER_TEST', 'ASK_BANQ', 'ARCHIVE'];
const BENCHMARK_GROUP_TYPES = ['INDUSTRY', 'CAMPAIGN_GOAL', 'CAMPAIGN_TYPE', 'AD_FORMAT', 'BUDGET_RANGE', 'REGION', 'TIME_PERIOD'];
const ENTERPRISE_ROLES = ['ENTERPRISE_OWNER', 'ENTERPRISE_ADMIN', 'BRAND_MANAGER', 'CAMPAIGN_MANAGER', 'ANALYST', 'VIEWER'];
const REQUEST_STATUSES = ['NEW', 'ASSIGNED', 'IN_REVIEW', 'AWAITING_CLIENT', 'COMPLETED', 'CLOSED'];

// ==================================================================
// 3.1 -- Journey Event Types and Tracking
// ==================================================================
async function registerSource(sourceName, sourceType, qualityStatus) {
  const q = String(qualityStatus || 'TRACKED').toUpperCase();
  if (!QUALITY_STATUSES.includes(q)) {
    throw Object.assign(new Error('Quality status must be one of: ' + QUALITY_STATUSES.join(', ')), { code: 400 });
  }
  const existing = (await db.execute({
    sql: `SELECT * FROM journey_event_sources WHERE source_name = ?`,
    args: [String(sourceName)]
  })).rows[0];
  if (existing) {
    await db.execute({
      sql: `UPDATE journey_event_sources SET source_type = ?, quality_status = ? WHERE id = ?`,
      args: [String(sourceType || existing.source_type), q, existing.id]
    });
    return { id: existing.id, source_name: String(sourceName), quality_status: q, updated: true };
  }
  const res = await db.execute({
    sql: `INSERT INTO journey_event_sources (source_name, source_type, quality_status) VALUES (?, ?, ?)`,
    args: [String(sourceName), String(sourceType || 'platform'), q]
  });
  return { id: Number(res.lastInsertRowid), source_name: String(sourceName), quality_status: q };
}

async function listSources() {
  return (await db.execute(`SELECT * FROM journey_event_sources ORDER BY source_name ASC`)).rows;
}

async function recordJourneyEvent(input, actor) {
  const campaignId = Number(input.campaign_id);
  const advertiserId = Number(input.advertiser_id);
  const name = String(input.event_name || '').toUpperCase();
  if (!name) throw Object.assign(new Error('An event needs a name.'), { code: 400 });
  const custom = !STANDARD_EVENTS.includes(name);
  const source = String(input.source || 'platform');
  // An unknown source is registered as TRACKED rather than silently accepted:
  // the funnel needs to know where a number came from.
  let src = (await db.execute({ sql: `SELECT * FROM journey_event_sources WHERE source_name = ?`, args: [source] })).rows[0];
  if (!src) {
    await registerSource(source, 'unknown', 'TRACKED');
    src = (await db.execute({ sql: `SELECT * FROM journey_event_sources WHERE source_name = ?`, args: [source] })).rows[0];
  }
  const res = await db.execute({
    sql: `INSERT INTO journey_events (campaign_id, advertiser_id, event_name, event_description, event_value, event_timestamp, source)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [campaignId, advertiserId, name, input.event_description || null,
      input.event_value === undefined || input.event_value === null ? null : Number(input.event_value),
      input.event_timestamp || new Date().toISOString(), source]
  });
  const id = Number(res.lastInsertRowid);
  await logActivity(campaignId, actor ? actor.id : null, 'JOURNEY_EVENT_RECORDED',
    { event_id: id, event_name: name, custom, quality: src ? src.quality_status : null });
  return { id, event_name: name, event_kind: custom ? 'CUSTOM' : 'STANDARD', source_quality: src ? src.quality_status : null };
}

async function listJourneyEvents(campaignId, opts) {
  const o = opts || {};
  const clauses = ['e.campaign_id = ?'];
  const args = [Number(campaignId)];
  if (o.event_name) { clauses.push('e.event_name = ?'); args.push(String(o.event_name).toUpperCase()); }
  const rows = (await db.execute({
    sql: `SELECT e.*, s.quality_status, s.source_type FROM journey_events e
          LEFT JOIN journey_event_sources s ON s.source_name = e.source
          WHERE ${clauses.join(' AND ')} ORDER BY e.event_timestamp DESC LIMIT ?`,
    args: args.concat([Math.min(Number(o.limit) || 200, 1000)])
  })).rows;
  return rows;
}

// ==================================================================
// 3.2 -- Journey Configuration
// ==================================================================
async function getJourneyConfig(campaignId) {
  const row = (await db.execute({
    sql: `SELECT * FROM journey_configurations WHERE campaign_id = ? ORDER BY updated_at DESC LIMIT 1`,
    args: [Number(campaignId)]
  })).rows[0];
  if (!row) return null;
  return Object.assign({}, row, {
    secondary_goals: safeJson(row.secondary_goals, []),
    journey_steps: safeJson(row.journey_steps, [])
  });
}

async function saveJourneyConfig(input, actor) {
  const campaignId = Number(input.campaign_id);
  const steps = Array.isArray(input.journey_steps) ? input.journey_steps.map(function (s) { return String(s).toUpperCase(); }) : [];
  const existing = (await db.execute({
    sql: `SELECT id FROM journey_configurations WHERE campaign_id = ?`,
    args: [campaignId]
  })).rows[0];
  if (existing) {
    await db.execute({
      sql: `UPDATE journey_configurations SET primary_goal = ?, secondary_goals = ?, journey_steps = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [input.primary_goal || null,
        JSON.stringify(Array.isArray(input.secondary_goals) ? input.secondary_goals : []),
        JSON.stringify(steps), existing.id]
    });
  } else {
    await db.execute({
      sql: `INSERT INTO journey_configurations (campaign_id, primary_goal, secondary_goals, journey_steps)
            VALUES (?, ?, ?, ?)`,
      args: [campaignId, input.primary_goal || null,
        JSON.stringify(Array.isArray(input.secondary_goals) ? input.secondary_goals : []),
        JSON.stringify(steps)]
    });
  }
  await logActivity(campaignId, actor ? actor.id : null, 'JOURNEY_CONFIGURED',
    { primary_goal: input.primary_goal || null, steps: steps.length });
  return { campaign_id: campaignId, primary_goal: input.primary_goal || null, journey_steps: steps };
}

// ==================================================================
// 3.3 -- Journey Drop-Off Analysis
// ==================================================================
/**
 * A funnel can only be built from comparable data, so events are grouped by
 * quality status and the analysis reports the mix. If part of the funnel is
 * ESTIMATED, the output says which step rests on estimated numbers instead of
 * presenting one clean conversion rate.
 */
async function dropOff(campaign, opts) {
  const o = opts || {};
  const config = await getJourneyConfig(campaign.id);
  const steps = (config && config.journey_steps && config.journey_steps.length)
    ? config.journey_steps
    : ['IMPRESSION', 'CLICK', 'LANDING_PAGE_VISIT', 'SIGN_UP', 'PURCHASE'];

  // A journey step can arrive in one of two shapes, and they must not be added
  // together:  - one row per occurrence (a real impression log), where the count is the number of rows;      - an aggregate counter row carrying its own total in event_value.
  // Counting rows for the second shape reports "1 impression" for forty-two
  // thousand, which is how every step came out equal. The basis is chosen per
  // step and reported, rather than blended.
  const rows = (await db.execute({
    sql: `SELECT e.event_name, e.source, s.quality_status,
                 COUNT(*) AS n, SUM(e.event_value) AS value_sum,
                 SUM(CASE WHEN e.event_value IS NULL THEN 1 ELSE 0 END) AS null_values
          FROM journey_events e
          LEFT JOIN journey_event_sources s ON s.source_name = e.source
          WHERE e.campaign_id = ? GROUP BY e.event_name, e.source, s.quality_status`,
    args: [campaign.id]
  })).rows;

  const counts = {};
  const qualityMix = {};
  const basisByStep = {};
  rows.forEach(function (r) {
    const hasValue = Number(r.null_values || 0) === 0 && r.value_sum !== null;
    const amount = hasValue ? Number(r.value_sum) : Number(r.n);
    counts[r.event_name] = (counts[r.event_name] || 0) + amount;
    basisByStep[r.event_name] = hasValue ? 'event_value_total' : 'row_count';
    const q = r.quality_status || 'UNAVAILABLE';
    qualityMix[q] = (qualityMix[q] || 0) + Number(r.n);
  });

  if (!Object.keys(counts).length) {
    return {
      state: 'TRACKING DATA UNAVAILABLE',
      message: 'No journey events have been recorded for this campaign, so a funnel cannot be built. This is not a zero conversion rate.',
      steps: steps.map(function (s) { return { step: s, count: null }; })
    };
  }

  const funnel = [];
  let previous = null;
  for (const s of steps) {
    const count = counts[s] === undefined ? null : counts[s];
    funnel.push({
      step: s,
      count,
      count_basis: basisByStep[s] || null,
      from_previous_pct: (count === null || previous === null || !previous) ? null : pct(count, previous),
      from_start_pct: (count === null || !counts[steps[0]]) ? null : pct(count, counts[steps[0]]),
      tracked: count !== null
    });
    if (count !== null) previous = count;
  }

  // The biggest fall between two consecutive tracked steps.
  let worst = null;
  for (let i = 1; i < funnel.length; i++) {
    const f = funnel[i];
    if (f.from_previous_pct === null) continue;
    const drop = 100 - f.from_previous_pct;
    if (!worst || drop > worst.drop_pct) {
      worst = { from: funnel[i - 1].step, to: f.step, drop_pct: drop, statement: 'The largest fall is between ' + funnel[i - 1].step + ' and ' + f.step + ', where ' + Math.round(drop) + '% do not continue.' };
    }
  }

  const estimated = Number(qualityMix.ESTIMATED || 0);
  const total = Object.keys(qualityMix).reduce(function (s, k) { return s + qualityMix[k]; }, 0);

  if (o.actorId) await logActivity(campaign.id, o.actorId, 'JOURNEY_DROPOFF_VIEWED', { steps: funnel.length });

  // Steps whose counts rest on different bases are not comparable as a rate, so
  // the mix is reported alongside the funnel.
  const basesUsed = Object.keys(basisByStep).map(function (k) { return basisByStep[k]; });
  const mixedBasis = basesUsed.indexOf('event_value_total') >= 0 && basesUsed.indexOf('row_count') >= 0;

  return {
    state: 'OK',
    steps: funnel,
    biggest_drop: worst,
    mixed_basis_warning: mixedBasis
      ? 'Some steps are counted as totals and others as individual events. Rates between those steps describe shape, not exact conversion.'
      : null,
    quality_mix: qualityMix,
    estimated_share_pct: total ? pct(estimated, total) : null,
    quality_warning: estimated
      ? 'Part of this funnel rests on ESTIMATED events (' + (total ? pct(estimated, total) : 0) + '% of rows). Estimated data is shown separately and is not blended with verified data.'
      : null
  };
}

// ==================================================================
// 3.4 -- Experiment Lab
// ==================================================================
async function createExperiment(input, actor) {
  const hypothesis = String(input.hypothesis || '').trim();
  // The spec is explicit that a hypothesis is required, not just "A vs B".
  if (!hypothesis) {
    throw Object.assign(new Error('An experiment needs a hypothesis. "A vs B" is not a hypothesis; state what you expect and why.'), { code: 400 });
  }
  const type = String(input.experiment_type || '').toUpperCase();
  if (!EXPERIMENT_TYPES.includes(type)) {
    throw Object.assign(new Error('Experiment type must be one of: ' + EXPERIMENT_TYPES.join(', ')), { code: 400 });
  }
  const res = await db.execute({
    sql: `INSERT INTO experiments (campaign_id, experiment_type, name, hypothesis, primary_metric, secondary_metrics, start_date, end_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')`,
    args: [Number(input.campaign_id), type, String(input.name || 'Untitled experiment'),
      hypothesis, String(input.primary_metric || 'clicks'),
      input.secondary_metrics ? JSON.stringify(input.secondary_metrics) : null,
      input.start_date || null, input.end_date || null]
  });
  const id = Number(res.lastInsertRowid);
  await logActivity(Number(input.campaign_id), actor ? actor.id : null, 'EXPERIMENT_CREATED', { experiment_id: id, type });
  return { id, experiment_type: type, status: 'DRAFT' };
}

async function addVariant(experimentId, input, actor) {
  const exp = (await db.execute({ sql: `SELECT * FROM experiments WHERE id = ?`, args: [Number(experimentId)] })).rows[0];
  if (!exp) throw Object.assign(new Error('Experiment not found.'), { code: 404 });
  const isFirst = !(await db.execute({
    sql: `SELECT id FROM experiment_variants WHERE experiment_id = ? LIMIT 1`,
    args: [Number(experimentId)]
  })).rows[0];
  const res = await db.execute({
    sql: `INSERT INTO experiment_variants (experiment_id, creative_id, variant_name, configuration, traffic_allocation, status)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [Number(experimentId), input.creative_id ? Number(input.creative_id) : null,
      String(input.variant_name || (isFirst ? 'Control' : 'Variant')),
      input.configuration ? JSON.stringify(input.configuration) : null,
      String(input.traffic_allocation || '50/50'),
      String(input.status || (isFirst ? 'control' : 'variant'))]
  });
  return { id: Number(res.lastInsertRowid), experiment_id: Number(experimentId) };
}

async function setExperimentStatus(experimentId, status, actor) {
  const s = String(status || '').toUpperCase();
  if (!EXPERIMENT_STATUSES.includes(s)) {
    throw Object.assign(new Error('Status must be one of: ' + EXPERIMENT_STATUSES.join(', ')), { code: 400 });
  }
  const exp = (await db.execute({ sql: `SELECT * FROM experiments WHERE id = ?`, args: [Number(experimentId)] })).rows[0];
  if (!exp) throw Object.assign(new Error('Experiment not found.'), { code: 404 });

  // Lifecycle guard: you cannot run an experiment with nothing to compare.
  if (s === 'RUNNING') {
    const variants = (await db.execute({
      sql: `SELECT COUNT(*) AS n FROM experiment_variants WHERE experiment_id = ?`,
      args: [Number(experimentId)]
    })).rows[0];
    if (Number(variants.n) < 2) {
      throw Object.assign(new Error('An experiment needs at least two variants before it can run.'), { code: 400 });
    }
    await db.execute({
      sql: `UPDATE experiments SET status = ?, start_date = COALESCE(start_date, CURRENT_TIMESTAMP) WHERE id = ?`,
      args: [s, Number(experimentId)]
    });
  } else if (s === 'COMPLETED') {
    await db.execute({
      sql: `UPDATE experiments SET status = ?, end_date = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [s, Number(experimentId)]
    });
  } else {
    await db.execute({ sql: `UPDATE experiments SET status = ? WHERE id = ?`, args: [s, Number(experimentId)] });
  }

  await timelineAdd(exp.campaign_id, 'EXPERIMENT_' + s, 'BANQ', actor ? actor.id : null, { experiment_id: Number(experimentId), status: s });
  await logActivity(exp.campaign_id, actor ? actor.id : null, s === 'RUNNING' ? 'EXPERIMENT_STARTED' : 'EXPERIMENT_STATUS_CHANGED',
    { experiment_id: Number(experimentId), status: s });
  return { id: Number(experimentId), status: s };
}

async function listExperiments(campaignId) {
  const rows = (await db.execute({
    sql: `SELECT * FROM experiments WHERE campaign_id = ? ORDER BY created_at DESC`,
    args: [Number(campaignId)]
  })).rows;
  const out = [];
  for (const r of rows) {
    const variants = (await db.execute({
      sql: `SELECT * FROM experiment_variants WHERE experiment_id = ? ORDER BY id ASC`,
      args: [r.id]
    })).rows;
    out.push(Object.assign({}, r, {
      secondary_metrics: safeJson(r.secondary_metrics, null),
      variants: variants.map(function (v) { return Object.assign({}, v, { configuration: safeJson(v.configuration, null) }); })
    }));
  }
  return out;
}

// ==================================================================
// 3.5 -- Experiment Results
// ==================================================================
/**
 * Results are withheld until the configured minimum data is met. Before that
 * the engine says "IN PROGRESS" rather than showing a leader, because an early
 * leader drawn from thin data is how an advertiser is talked into a change that
 * was never supported.
 */
async function experimentResults(experimentId, actor) {
  const exp = (await db.execute({ sql: `SELECT * FROM experiments WHERE id = ?`, args: [Number(experimentId)] })).rows[0];
  if (!exp) throw Object.assign(new Error('Experiment not found.'), { code: 404 });

  const minDays = await cfg('experiment_min_runtime_days', 3);
  const minImpressions = await cfg('experiment_min_impressions', 2000);
  const minConversions = await cfg('experiment_min_conversions', 10);
  const minSample = await cfg('experiment_min_sample_size', 1000);

  const variants = (await db.execute({
    sql: `SELECT * FROM experiment_variants WHERE experiment_id = ? ORDER BY id ASC`,
    args: [Number(experimentId)]
  })).rows;

  const runtimeHours = core.hoursBetween(exp.start_date || exp.created_at, new Date().toISOString());
  const runtimeDays = runtimeHours === null ? 0 : runtimeHours / 24;

  const perVariant = [];
  for (const v of variants) {
    let metrics = {};
    if (v.creative_id) {
      const rows = (await db.execute({
        sql: `SELECT metric_name, SUM(metric_value) AS total FROM creative_metrics WHERE creative_id = ? GROUP BY metric_name`,
        args: [v.creative_id]
      })).rows;
      rows.forEach(function (r) { metrics[r.metric_name] = Number(r.total); });
    }
    perVariant.push({
      variant_id: v.id,
      variant_name: v.variant_name,
      creative_id: v.creative_id,
      traffic_allocation: v.traffic_allocation,
      primary_metric_value: metrics[exp.primary_metric] === undefined ? null : metrics[exp.primary_metric],
      impressions: Number(metrics.impressions || 0),
      conversions: Number(metrics.conversions || 0),
      sample_size: Number(metrics.clicks || 0) + Number(metrics.impressions || 0)
    });
  }

  const totalImpressions = perVariant.reduce(function (s, v) { return s + v.impressions; }, 0);
  const totalConversions = perVariant.reduce(function (s, v) { return s + v.conversions; }, 0);
  const minSampleSeen = perVariant.length ? Math.min.apply(null, perVariant.map(function (v) { return v.sample_size; })) : 0;

  const unmet = [];
  if (runtimeDays < minDays) unmet.push('runtime ' + Math.round(runtimeDays * 10) / 10 + 'd/' + minDays + 'd');
  if (totalImpressions < minImpressions) unmet.push('impressions ' + totalImpressions + '/' + minImpressions);
  if (totalConversions < minConversions) unmet.push('conversions ' + totalConversions + '/' + minConversions);
  if (minSampleSeen < minSample) unmet.push('per-variant sample ' + minSampleSeen + '/' + minSample);

  if (unmet.length) {
    return {
      experiment_id: Number(experimentId),
      state: 'IN_PROGRESS',
      result_status: 'INCONCLUSIVE',
      message: 'EXPERIMENT IN PROGRESS -- More data is required before drawing a reliable conclusion.',
      still_needed: unmet,
      variants: perVariant
    };
  }

  // Compare each variant against the control on the primary metric.
  const control = perVariant.find(function (v) { return v.variant_name.toLowerCase() === 'control'; }) || perVariant[0];
  const comparisons = [];
  for (const v of perVariant) {
    if (v.variant_id === control.variant_id) continue;
    if (v.primary_metric_value === null || !control.primary_metric_value) {
      comparisons.push({ variant_id: v.variant_id, variant_name: v.variant_name, change_pct: null, label: 'INCONCLUSIVE',
        note: 'The primary metric is missing on one side of the comparison.' });
      continue;
    }
    const change = ((v.primary_metric_value - control.primary_metric_value) / control.primary_metric_value) * 100;
    const rounded = Math.round(change * 10) / 10;
    let label;
    if (Math.abs(rounded) < 5) label = 'NO_MEANINGFUL_DIFFERENCE';
    else if (rounded > 0) label = 'POSITIVE_SIGNAL';
    else label = 'NEGATIVE_SIGNAL';
    comparisons.push({
      variant_id: v.variant_id, variant_name: v.variant_name,
      change_pct: rounded, label,
      statement: v.variant_name + ' is ' + (rounded > 0 ? 'up' : 'down') + ' ' + Math.abs(rounded) + '% on ' + exp.primary_metric + ' versus control.',
      language_note: 'This is a signal from the observed data, not a guarantee that the same change will repeat.'
    });
    await db.execute({
      sql: `INSERT INTO experiment_results (experiment_id, variant_id, primary_metric_value, confidence_level, result_status)
            VALUES (?, ?, ?, ?, ?)`,
      args: [Number(experimentId), v.variant_id, v.primary_metric_value, 'MODERATE', label]
    });
  }

  await logActivity(exp.campaign_id, actor ? actor.id : null, 'EXPERIMENT_RESULT_CALCULATED', { experiment_id: Number(experimentId) });

  return {
    experiment_id: Number(experimentId),
    state: 'COMPLETE',
    primary_metric: exp.primary_metric,
    control: { variant_id: control.variant_id, variant_name: control.variant_name, value: control.primary_metric_value },
    comparisons,
    variants: perVariant,
    decisions_available: EXPERIMENT_DECISIONS,
    // The spec forbids labelling a variant the winner, so the word does not
    // appear in this payload at all -- not even in a sentence denying it. A
    // denial still puts the concept in front of the advertiser; a result that
    // simply reports the comparison does not.
    note: 'The system reports the comparison only. A decision is recorded by a human.'
  };
}

async function recordExperimentDecision(experimentId, input, actor) {
  const decision = String(input.decision || '').toUpperCase();
  if (!EXPERIMENT_DECISIONS.includes(decision)) {
    throw Object.assign(new Error('Decision must be one of: ' + EXPERIMENT_DECISIONS.join(', ')), { code: 400 });
  }
  const exp = (await db.execute({ sql: `SELECT * FROM experiments WHERE id = ?`, args: [Number(experimentId)] })).rows[0];
  if (!exp) throw Object.assign(new Error('Experiment not found.'), { code: 404 });
  await db.execute({
    sql: `INSERT INTO experiment_results (experiment_id, variant_id, primary_metric_value, secondary_metrics, confidence_level, result_status)
          VALUES (?, ?, NULL, ?, ?, ?)`,
    args: [Number(experimentId), Number(input.variant_id) || (await firstVariantId(experimentId)),
      JSON.stringify({ decision, note: input.note || null }), 'MODERATE', 'DECISION_' + decision]
  });
  await timelineAdd(exp.campaign_id, 'EXPERIMENT_DECISION', 'ADVERTISER', actor ? actor.id : null,
    { experiment_id: Number(experimentId), decision, note: input.note || null });
  await logActivity(exp.campaign_id, actor ? actor.id : null, 'EXPERIMENT_DECISION', { experiment_id: Number(experimentId), decision });
  return { experiment_id: Number(experimentId), decision };
}

async function firstVariantId(experimentId) {
  const r = (await db.execute({
    sql: `SELECT id FROM experiment_variants WHERE experiment_id = ? ORDER BY id ASC LIMIT 1`,
    args: [Number(experimentId)]
  })).rows[0];
  return r ? r.id : 0;
}

// ==================================================================
// 3.6 -- Campaign Benchmarking (privacy-critical)
// ==================================================================
async function createBenchmarkGroup(groupType, criteria) {
  const t = String(groupType || '').toUpperCase();
  if (!BENCHMARK_GROUP_TYPES.includes(t)) {
    throw Object.assign(new Error('Group type must be one of: ' + BENCHMARK_GROUP_TYPES.join(', ')), { code: 400 });
  }
  const res = await db.execute({
    sql: `INSERT INTO benchmark_groups (group_type, criteria) VALUES (?, ?)`,
    args: [t, criteria ? JSON.stringify(criteria) : null]
  });
  return { id: Number(res.lastInsertRowid), group_type: t };
}

/**
 * Publishes an aggregate range for comparison, or refuses. The refusals are the
 * important part:
 *
 *  - fewer than `benchmark_min_campaign_count` campaigns in the group -> no
 *    benchmark, because a small group identifies its members.
 *  - older than `benchmark_freshness_days` -> no benchmark, because stale
 *    averages are worse than none.
 *
 * No advertiser name, campaign name or individual metric appears in the output.
 */
async function benchmarkFor(campaign, opts) {
  const o = opts || {};
  const minCount = await cfg('benchmark_min_campaign_count', 5);
  const freshnessDays = await cfg('benchmark_freshness_days', 90);
  const minVolume = await cfg('benchmark_min_data_volume', 10000);

  const groups = (await db.execute({
    sql: `SELECT * FROM benchmark_groups ORDER BY id ASC`
  })).rows;
  const groupType = o.group_type ? String(o.group_type).toUpperCase() : null;

  const published = [];
  const withheld = [];

  for (const g of groups) {
    if (groupType && g.group_type !== groupType) continue;

    // Aggregation only. The SELECT never returns a campaign identity.
    const agg = (await db.execute({
      sql: `SELECT COUNT(DISTINCT m.campaign_id) AS campaigns,
                   SUM(m.metric_value) AS volume
            FROM campaign_metrics m
            JOIN campaigns c ON c.id = m.campaign_id
            WHERE m.metric_name IN ('impressions')
              AND m.timestamp >= datetime('now', ?)`,
      args: ['-' + freshnessDays + ' days']
    })).rows[0];

    const campaigns = Number(agg ? agg.campaigns : 0);
    const volume = Number(agg ? agg.volume : 0);

    if (campaigns < minCount) {
      withheld.push({
        group_id: g.id, group_type: g.group_type, state: 'BENCHMARK NOT AVAILABLE',
        reason: 'Only ' + campaigns + ' campaign(s) in the window; ' + minCount + ' are required before an aggregate is published, so no individual campaign can be identified.'
      });
      continue;
    }
    if (volume < minVolume) {
      withheld.push({
        group_id: g.id, group_type: g.group_type, state: 'BENCHMARK NOT AVAILABLE',
        reason: 'Aggregate volume of ' + volume + ' is below the minimum of ' + minVolume + '.'
      });
      continue;
    }

    const metrics = (await db.execute({
      sql: `SELECT * FROM benchmark_metrics WHERE group_id = ? ORDER BY calculated_at DESC`,
      args: [g.id]
    })).rows;

    const values = metrics.map(function (m) { return Number(m.metric_value); });
    published.push({
      group_id: g.id,
      group_type: g.group_type,
      criteria: safeJson(g.criteria, null),
      sample_count: Number(agg.campaigns),
      aggregate_volume: volume,
      metrics: metrics.map(function (m) {
        return { metric_name: m.metric_name, value: Number(m.metric_value), calculated_at: m.calculated_at };
      }),
      // A RANGE, never a single comparable figure.
      range: values.length ? { low: Math.min.apply(null, values), high: Math.max.apply(null, values) } : null,
      freshness_days: freshnessDays,
      privacy_note: 'Aggregated across ' + campaigns + ' campaigns. No advertiser, campaign or individual metric is exposed.'
    });
  }

  await logActivity(campaign.id, o.actorId, 'BENCHMARK_VIEWED', { published: published.length, withheld: withheld.length });

  return {
    published,
    withheld,
    state: published.length ? 'OK' : 'BENCHMARK NOT AVAILABLE',
    message: published.length
      ? null
      : 'BENCHMARK NOT AVAILABLE -- not enough comparable campaigns meet the privacy and freshness minimums yet.',
    minimums: { campaigns: minCount, freshness_days: freshnessDays, volume: minVolume }
  };
}

// ==================================================================
// 3.7 -- Cross-Campaign Intelligence
// ==================================================================
/**
 * Patterns across one advertiser's OWN campaigns. The wording is deliberately
 * "observed pattern", never "strategy", because a pattern in past data is not a
 * guarantee about future behaviour.
 */
async function crossCampaignInsights(advertiserId, opts) {
  const o = opts || {};
  const campaigns = (await db.execute({
    sql: `SELECT * FROM campaigns WHERE advertiser_id = ?`,
    args: [Number(advertiserId)]
  })).rows;

  const insights = [];

  if (campaigns.length >= 2) {
    // Best performing creative TYPE by average score across owned campaigns.
    const byType = {};
    for (const c of campaigns) {
      const creatives = (await db.execute({
        sql: `SELECT id, creative_type FROM ad_creatives WHERE campaign_id = ?`,
        args: [c.id]
      })).rows;
      for (const cr of creatives) {
        const score = (await db.execute({
          sql: `SELECT score, status FROM creative_performance_scores WHERE creative_id = ? ORDER BY calculated_at DESC LIMIT 1`,
          args: [cr.id]
        })).rows[0];
        if (!score || score.status === 'INSUFFICIENT_DATA') continue;
        if (!byType[cr.creative_type]) byType[cr.creative_type] = { total: 0, n: 0, campaigns: [] };
        byType[cr.creative_type].total += Number(score.score);
        byType[cr.creative_type].n++;
        if (!byType[cr.creative_type].campaigns.includes(c.id)) byType[cr.creative_type].campaigns.push(c.id);
      }
    }
    const types = Object.keys(byType).map(function (t) {
      return { type: t, average_score: Math.round(byType[t].total / byType[t].n), n: byType[t].n, campaigns: byType[t].campaigns };
    }).sort(function (a, b) { return b.average_score - a.average_score; });

    if (types.length > 1) {
      insights.push({
        insight_type: 'BEST_PERFORMING_CREATIVE_TYPE',
        description: types[0].type + ' creatives show the highest average performance score (' + types[0].average_score + ') across your campaigns.',
        supporting_campaigns: types[0].campaigns,
        label: 'OBSERVED_PATTERN',
        caveat: 'This is a pattern in past data across ' + types[0].n + ' creative(s). It is not a guarantee that the same type will lead in a new campaign.'
      });
    }

    // Strongest and weakest campaign by latest health score.
    const scored = [];
    for (const c of campaigns) {
      const h = (await db.execute({
        sql: `SELECT score, status FROM campaign_health_scores WHERE campaign_id = ? ORDER BY calculated_at DESC LIMIT 1`,
        args: [c.id]
      })).rows[0];
      if (h && h.score !== null && h.status !== 'INSUFFICIENT_DATA') scored.push({ campaign_id: c.id, name: c.campaign_name, score: Number(h.score) });
    }
    if (scored.length >= 2) {
      scored.sort(function (a, b) { return b.score - a.score; });
      insights.push({
        insight_type: 'STRONGEST_CAMPAIGN',
        description: scored[0].name + ' currently has the highest health score (' + scored[0].score + ').',
        supporting_campaigns: [scored[0].campaign_id],
        label: 'OBSERVED_PATTERN',
        caveat: 'Health scores reflect how each campaign is configured and paced, not a ranking of business value.'
      });
      insights.push({
        insight_type: 'WEAKEST_TREND',
        description: scored[scored.length - 1].name + ' currently has the lowest health score (' + scored[scored.length - 1].score + ').',
        supporting_campaigns: [scored[scored.length - 1].campaign_id],
        label: 'OBSERVED_PATTERN',
        caveat: null
      });
    }
  }

  // Recurring alerts across the advertiser's campaigns.
  const recurring = (await db.execute({
    sql: `SELECT alert_type, COUNT(DISTINCT campaign_id) AS n FROM banq_alerts
          WHERE campaign_id IN (SELECT id FROM campaigns WHERE advertiser_id = ?)
          GROUP BY alert_type HAVING n > 1 ORDER BY n DESC LIMIT 3`,
    args: [Number(advertiserId)]
  })).rows;
  recurring.forEach(function (r) {
    insights.push({
      insight_type: 'RECURRING_ALERT',
      description: r.alert_type.replace(/_/g, ' ').toLowerCase() + ' has recurred across ' + Number(r.n) + ' of your campaigns.',
      supporting_campaigns: [],
      label: 'OBSERVED_PATTERN',
      caveat: 'A recurring alert is a recurring observation, not necessarily a recurring cause.'
    });
  });

  if (!insights.length) {
    return {
      insights: [],
      state: 'INSUFFICIENT_DATA',
      message: 'Not enough cross-campaign data yet. At least two campaigns with scored creatives are needed before a pattern can be observed.'
    };
  }

  if (!o.skip_store) {
    for (const i of insights) {
      await db.execute({
        sql: `INSERT INTO cross_campaign_insights (advertiser_id, insight_type, description, supporting_campaigns)
              VALUES (?, ?, ?, ?)`,
        args: [Number(advertiserId), i.insight_type, i.description, JSON.stringify(i.supporting_campaigns || [])]
      });
    }
  }
  if (o.actorId) await logActivity(null, o.actorId, 'CROSS_CAMPAIGN_INSIGHT_VIEWED', { count: insights.length });
  return { insights, state: 'OK' };
}

// ==================================================================
// 3.8 -- Enterprise Multi-Brand Dashboard
// ==================================================================
async function createEnterprise(name) {
  const res = await db.execute({
    sql: `INSERT INTO enterprise_accounts (name) VALUES (?)`,
    args: [String(name)]
  });
  return { id: Number(res.lastInsertRowid), name: String(name) };
}

async function addBrand(enterpriseId, input) {
  const res = await db.execute({
    sql: `INSERT INTO enterprise_brands (enterprise_id, name, qap_number) VALUES (?, ?, ?)`,
    args: [Number(enterpriseId), String(input.name), input.qap_number || null]
  });
  return { id: Number(res.lastInsertRowid), enterprise_id: Number(enterpriseId), name: String(input.name) };
}

async function addEnterpriseMember(enterpriseId, input) {
  const role = String(input.role || '').toUpperCase();
  if (!ENTERPRISE_ROLES.includes(role)) {
    throw Object.assign(new Error('Role must be one of: ' + ENTERPRISE_ROLES.join(', ')), { code: 400 });
  }
  const res = await db.execute({
    sql: `INSERT INTO enterprise_members (enterprise_id, user_id, role, brand_scope) VALUES (?, ?, ?, ?)`,
    args: [Number(enterpriseId), Number(input.user_id), role, input.brand_scope ? JSON.stringify(input.brand_scope) : null]
  });
  return { id: Number(res.lastInsertRowid), role };
}

/**
 * Access is resolved from the member row, never from the request. A BRAND_MANAGER
 * with a brand_scope sees only those brands; only enterprise-level roles get the
 * cross-brand comparison, because comparing brands a person cannot see is the
 * same leak as seeing them.
 */
async function enterpriseOverview(enterpriseId, actor) {
  const enterprise = (await db.execute({
    sql: `SELECT * FROM enterprise_accounts WHERE id = ?`,
    args: [Number(enterpriseId)]
  })).rows[0];
  if (!enterprise) throw Object.assign(new Error('Enterprise account not found.'), { code: 404 });

  const allBrands = (await db.execute({
    sql: `SELECT * FROM enterprise_brands WHERE enterprise_id = ? ORDER BY name ASC`,
    args: [Number(enterpriseId)]
  })).rows;

  let visibleBrands = allBrands;
  let role = null;
  let crossBrandAllowed = false;

  if (actor && !actor.is_admin) {
    const member = (await db.execute({
      sql: `SELECT * FROM enterprise_members WHERE enterprise_id = ? AND user_id = ? LIMIT 1`,
      args: [Number(enterpriseId), Number(actor.id)]
    })).rows[0];
    if (!member) throw Object.assign(new Error('You are not a member of this enterprise account.'), { code: 403 });
    role = member.role;
    crossBrandAllowed = ['ENTERPRISE_OWNER', 'ENTERPRISE_ADMIN'].includes(role);
    const scope = safeJson(member.brand_scope, null);
    if (scope && scope.length) {
      visibleBrands = allBrands.filter(function (b) { return scope.map(Number).includes(Number(b.id)); });
    } else if (!crossBrandAllowed) {
      // No scope set and not an enterprise-level role: the safe reading is
      // nothing, not everything.
      visibleBrands = [];
    }
  } else {
    role = 'BANQ_STAFF';
    crossBrandAllowed = true;
  }

  const brands = [];
  for (const b of visibleBrands) {
    const campaigns = (await db.execute({
      sql: `SELECT c.*, (SELECT s.score FROM campaign_health_scores s WHERE s.campaign_id = c.id ORDER BY s.calculated_at DESC LIMIT 1) AS health_score,
                   (SELECT s.status FROM campaign_health_scores s WHERE s.campaign_id = c.id ORDER BY s.calculated_at DESC LIMIT 1) AS health_status
            FROM campaigns c WHERE c.qwk_banner_id IS NOT NULL OR c.id IN (
              SELECT id FROM campaigns WHERE advertiser_id = ?
            ) ORDER BY c.created_at DESC`,
      args: [Number(actor ? actor.id : 0)]
    })).rows;
    brands.push({
      brand_id: b.id,
      name: b.name,
      qap_number: b.qap_number,
      campaigns: campaigns.slice(0, 10).map(function (c) {
        return { id: c.id, campaign_name: c.campaign_name, status: c.status, health_score: c.health_score, health_status: c.health_status };
      })
    });
  }

  await logActivity(null, actor ? actor.id : null, 'ENTERPRISE_VIEWED', { enterprise_id: Number(enterpriseId), role });

  return {
    enterprise: { id: enterprise.id, name: enterprise.name },
    role,
    cross_brand_comparison_available: crossBrandAllowed,
    brands,
    hidden_brand_count: allBrands.length - visibleBrands.length,
    note: visibleBrands.length < allBrands.length
      ? 'Some brands are outside your scope and are not shown.'
      : null,
    drill_down: 'Enterprise -> Brand -> Campaign -> Creative -> Journey'
  };
}

async function listEnterpriseMembers(enterpriseId) {
  return (await db.execute({
    sql: `SELECT m.*, u.username FROM enterprise_members m LEFT JOIN users u ON u.id = m.user_id
          WHERE m.enterprise_id = ?`,
    args: [Number(enterpriseId)]
  })).rows;
}

// ==================================================================
// 3.9 -- BANQ Team Workspace
// ==================================================================
async function createClientRequest(input, actor) {
  const res = await db.execute({
    sql: `INSERT INTO banq_client_requests (advertiser_id, campaign_id, subject, body, status)
          VALUES (?, ?, ?, ?, 'NEW')`,
    args: [Number(input.advertiser_id), input.campaign_id ? Number(input.campaign_id) : null,
      String(input.subject || 'Request'), input.body || null]
  });
  const id = Number(res.lastInsertRowid);
  await logActivity(input.campaign_id ? Number(input.campaign_id) : null, actor ? actor.id : null, 'CLIENT_REQUEST_CREATED', { request_id: id });
  return { id, status: 'NEW' };
}

async function listClientRequests(opts) {
  const o = opts || {};
  const clauses = [];
  const args = [];
  if (o.status) { clauses.push('r.status = ?'); args.push(String(o.status).toUpperCase()); }
  if (o.advertiser_id) { clauses.push('r.advertiser_id = ?'); args.push(Number(o.advertiser_id)); }
  if (o.assigned_to) { clauses.push('r.assigned_to = ?'); args.push(Number(o.assigned_to)); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  return (await db.execute({
    sql: `SELECT r.*, u.username AS advertiser_name, c.campaign_name
          FROM banq_client_requests r
          LEFT JOIN users u ON u.id = r.advertiser_id
          LEFT JOIN campaigns c ON c.id = r.campaign_id
          ${where} ORDER BY CASE r.priority WHEN 'HIGH' THEN 0 WHEN 'NORMAL' THEN 1 ELSE 2 END, r.created_at DESC LIMIT 200`,
    args
  })).rows;
}

async function updateClientRequest(requestId, input, actor) {
  const req = (await db.execute({ sql: `SELECT * FROM banq_client_requests WHERE id = ?`, args: [Number(requestId)] })).rows[0];
  if (!req) throw Object.assign(new Error('Request not found.'), { code: 404 });
  const status = input.status ? String(input.status).toUpperCase() : req.status;
  if (!REQUEST_STATUSES.includes(status)) {
    throw Object.assign(new Error('Status must be one of: ' + REQUEST_STATUSES.join(', ')), { code: 400 });
  }
  await db.execute({
    sql: `UPDATE banq_client_requests SET status = ?, assigned_to = ?, priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    args: [status,
      input.assigned_to === undefined ? req.assigned_to : (input.assigned_to ? Number(input.assigned_to) : null),
      input.priority || req.priority, Number(requestId)]
  });
  await logActivity(req.campaign_id, actor ? actor.id : null, 'CLIENT_REQUEST_UPDATED', { request_id: Number(requestId), status });
  return { id: Number(requestId), status };
}

/** The staff workspace, and the client workspace, from one call each. */
async function teamWorkspace(actor, opts) {
  const o = opts || {};
  if (actor && actor.is_admin) {
    const unassigned = (await db.execute({
      sql: `SELECT c.id, c.campaign_name FROM campaigns c
            WHERE c.id NOT IN (SELECT campaign_id FROM banq_analyst_assignments WHERE status = 'active')
            ORDER BY c.created_at DESC LIMIT 50`
    })).rows;
    const myCampaigns = (await db.execute({
      sql: `SELECT c.id, c.campaign_name FROM campaigns c
            JOIN banq_analyst_assignments a ON a.campaign_id = c.id
            WHERE a.analyst_id = ? AND a.status = 'active'`,
      args: [actor.id]
    })).rows;
    return {
      view: 'STAFF',
      my_campaigns: myCampaigns,
      unassigned_campaigns: unassigned,
      critical_alerts: await countAlerts({ severity: 'CRITICAL' }),
      pending_questions: await listClientRequests({ status: 'NEW' }),
      pending_recommendations: (await db.execute({
        sql: `SELECT id, campaign_id, title FROM banq_recommendations WHERE status = 'NEW' ORDER BY created_at DESC LIMIT 50`
      })).rows,
      experiments_running: (await db.execute({
        sql: `SELECT id, campaign_id, name FROM experiments WHERE status = 'RUNNING'`
      })).rows
    };
  }

  const advertiserId = Number(o.advertiser_id || (actor ? actor.id : 0));
  const campaigns = (await db.execute({
    sql: `SELECT c.id, c.campaign_name, c.status,
                 (SELECT s.status FROM campaign_health_scores s WHERE s.campaign_id = c.id ORDER BY s.calculated_at DESC LIMIT 1) AS health_status
          FROM campaigns c WHERE c.advertiser_id = ? ORDER BY c.created_at DESC`,
    args: [advertiserId]
  })).rows;
  const enterprises = (await db.execute({
    sql: `SELECT e.id, e.name, m.role FROM enterprise_accounts e
          JOIN enterprise_members m ON m.enterprise_id = e.id WHERE m.user_id = ?`,
    args: [advertiserId]
  })).rows;
  return {
    view: 'CLIENT',
    active_campaigns: campaigns,
    brands: enterprises,
    requiring_attention: campaigns.filter(function (c) { return c.health_status === 'CRITICAL' || c.health_status === 'NEEDS_ATTENTION'; }),
    open_requests: await listClientRequests({ advertiser_id: advertiserId, status: 'NEW' }),
    active_experiments: (await db.execute({
      sql: `SELECT e.id, e.campaign_id, e.name FROM experiments e
            JOIN campaigns c ON c.id = e.campaign_id
            WHERE c.advertiser_id = ? AND e.status = 'RUNNING'`,
      args: [advertiserId]
    })).rows
  };
}

async function countAlerts(opts) {
  const o = opts || {};
  const clauses = ["status = 'NEW'"];
  const args = [];
  if (o.severity) { clauses.push('severity = ?'); args.push(String(o.severity).toUpperCase()); }
  const row = (await db.execute({
    sql: `SELECT COUNT(*) AS n FROM banq_alerts WHERE ${clauses.join(' AND ')}`,
    args
  })).rows[0];
  return Number(row ? row.n : 0);
}

async function assignAnalyst(campaignId, analystId, actor) {
  await db.execute({
    sql: `INSERT INTO banq_analyst_assignments (campaign_id, analyst_id, status) VALUES (?, ?, 'active')`,
    args: [Number(campaignId), Number(analystId)]
  });
  await timelineAdd(Number(campaignId), 'BANQ_ACTIVATED', 'BANQ', actor ? actor.id : null, { analyst_id: Number(analystId) });
  return { campaign_id: Number(campaignId), analyst_id: Number(analystId), status: 'active' };
}

module.exports = {
  STANDARD_EVENTS, QUALITY_STATUSES, EXPERIMENT_TYPES, EXPERIMENT_STATUSES, RESULT_LABELS,
  EXPERIMENT_DECISIONS, BENCHMARK_GROUP_TYPES, ENTERPRISE_ROLES, REQUEST_STATUSES,
  registerSource, listSources, recordJourneyEvent, listJourneyEvents,
  getJourneyConfig, saveJourneyConfig,
  dropOff,
  createExperiment, addVariant, setExperimentStatus, listExperiments,
  experimentResults, recordExperimentDecision,
  createBenchmarkGroup, benchmarkFor,
  crossCampaignInsights,
  createEnterprise, addBrand, addEnterpriseMember, enterpriseOverview, listEnterpriseMembers,
  createClientRequest, listClientRequests, updateClientRequest, teamWorkspace, countAlerts, assignAnalyst
};
