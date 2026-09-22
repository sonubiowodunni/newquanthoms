/*
 * New Quanthoms Billboard Agency (BANQ)
 * scripts/seed-banq-intelligence.js -- demo content for all four phases
 *
 * WHY IT EXISTS: the build plan asks for placeholder content at nearly every
 * step ("seed 2-3 sample notes", "seed 5 days of historical scores", "seed 3
 * scenarios"). Without it every panel renders empty and nobody can see whether
 * the maths works.
 *
 * WHAT IT DOES NOT DO: it does not fabricate a paid subscription for everyone.
 * Three advertisers are created and only ONE of them has a BANQ month, so both
 * states are visible in the same environment -- the open dashboard and the
 * locked one that explains what the $15 buys. A demo where the gate is always
 * open would prove nothing about the gate.
 *
 * Idempotent: re-running updates in place rather than piling up duplicates.
 *
 * Run:  node scripts/seed-banq-intelligence.js
 */

const path = require('path');
const bcrypt = require('bcryptjs');
const { db, init } = require(path.join(__dirname, '..', 'backend', 'db'));
const schema = require(path.join(__dirname, '..', 'backend', 'intelligence', 'schema'));
const flags = require(path.join(__dirname, '..', 'backend', 'flags'));
const service = require(path.join(__dirname, '..', 'backend', 'intelligence', 'service'));

const DEMO_PASSWORD = 'demo12345';

function daysAgo(n) { return "datetime('now', '-" + n + " days')"; }
function daysAhead(n) { return "datetime('now', '+" + n + " days')"; }

async function one(sql, args) {
  return (await db.execute({ sql, args: args || [] })).rows[0];
}
async function run(sql, args) {
  return db.execute({ sql, args: args || [] });
}

async function upsertUser(username, email, isAdmin) {
  const existing = await one(`SELECT id FROM users WHERE username = ?`, [username]);
  if (existing) return Number(existing.id);
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const res = await run(
    `INSERT INTO users (username, email, password_hash, is_admin, quanthom_unit, quanthom_credit) VALUES (?, ?, ?, ?, 500, 5000)`,
    [username, email, hash, isAdmin ? 1 : 0]
  );
  return Number(res.lastInsertRowid);
}

async function upsertCampaign(advertiserId, name, opts) {
  const o = opts || {};
  const existing = await one(`SELECT id FROM campaigns WHERE advertiser_id = ? AND campaign_name = ?`, [advertiserId, name]);
  if (existing) {
    await run(`UPDATE campaigns SET total_budget = ?, spent_budget = ?, status = ?, qwk_banner_id = ? WHERE id = ?`,
      [o.budget || 0, o.spent || 0, o.status || 'active', o.bannerId || null, existing.id]);
    return Number(existing.id);
  }
  const res = await run(
    `INSERT INTO campaigns (qwk_banner_id, advertiser_id, campaign_name, campaign_source, status, total_budget, spent_budget, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ${daysAgo(o.startedDaysAgo === undefined ? 5 : o.startedDaysAgo)}, ${daysAhead(o.endsInDays === undefined ? 10 : o.endsInDays)})`,
    [o.bannerId || null, advertiserId, name, o.source || 'banq_standalone', o.status || 'active', o.budget || 0, o.spent || 0]
  );
  return Number(res.lastInsertRowid);
}

async function upsertCreative(campaignId, name, type, activatedDaysAgo) {
  const existing = await one(`SELECT id FROM ad_creatives WHERE campaign_id = ? AND creative_name = ?`, [campaignId, name]);
  if (existing) return Number(existing.id);
  const res = await run(
    `INSERT INTO ad_creatives (campaign_id, creative_name, creative_type, creative_status, created_at, activated_at)
     VALUES (?, ?, ?, 'active', ${daysAgo(activatedDaysAgo)}, ${daysAgo(activatedDaysAgo)})`,
    [campaignId, name, type]
  );
  return Number(res.lastInsertRowid);
}

/** Insert a daily metric series, so trends and fatigue have real shapes. */
async function metricSeries(creativeId, campaignId, name, values) {
  const existing = await one(
    `SELECT COUNT(*) AS n FROM creative_metrics WHERE creative_id = ? AND metric_name = ?`,
    [creativeId, name]
  );
  if (Number(existing.n) > 0) return;
  for (let i = 0; i < values.length; i++) {
    const daysBack = values.length - i;
    await run(
      `INSERT INTO creative_metrics (creative_id, campaign_id, metric_name, metric_value, timestamp)
       VALUES (?, ?, ?, ?, ${daysAgo(daysBack)})`,
      [creativeId, campaignId, name, values[i]]
    );
    await run(
      `INSERT INTO campaign_metrics (campaign_id, metric_name, metric_value, timestamp)
       VALUES (?, ?, ?, ${daysAgo(daysBack)})`,
      [campaignId, name, values[i]]
    );
  }
}

async function seed() {
  await init();
  await schema.migrate();

  console.log('[seed] creating demo advertisers...');
  const hotelId = await upsertUser('hotelgroup', 'hotel@demo.banq', false);
  const brandId = await upsertUser('brandco', 'brand@demo.banq', false);
  const retailId = await upsertUser('retailco', 'retail@demo.banq', false);
  const admin = await one(`SELECT id FROM users WHERE username = 'banqadmin'`);
  const adminId = admin ? Number(admin.id) : null;

  // ------------------------------------------------------------------
  // The $15 month: ONE advertiser has it, the others do not.
  // ------------------------------------------------------------------
  console.log('[seed] BANQ AD SERVICE subscriptions (one paid, two not)...');
  const already = await service.activeSubscription(hotelId);
  if (!already) {
    const sub = await service.subscribe(hotelId, { plan: 'monitor', currency: 'credits' }, { id: hotelId });
    if (sub.id) await service.confirmPayment(sub.id, { id: adminId }, 'DEMO-SEED');
  }

  // ------------------------------------------------------------------
  // Phase 1 -- the demo campaign (plan: 10000 budget, 6200 spent, day 5 of 10)
  // ------------------------------------------------------------------
  console.log('[seed] campaigns...');
  const mainId = await upsertCampaign(hotelId, 'Harbour Hotel Summer', {
    budget: 10000, spent: 6200, bannerId: 900001, startedDaysAgo: 5, endsInDays: 5
  });
  const c2 = await upsertCampaign(hotelId, 'Harbour Hotel Winter', { budget: 8000, spent: 8000, bannerId: 900002, startedDaysAgo: 60, endsInDays: -30, status: 'completed' });
  const c3 = await upsertCampaign(hotelId, 'Harbour Suites Launch', { budget: 12000, spent: 3100, bannerId: 900003, startedDaysAgo: 4, endsInDays: 26 });
  const c4 = await upsertCampaign(brandId, 'BrandCo Spring Push', { budget: 15000, spent: 4200, bannerId: 900004, startedDaysAgo: 6, endsInDays: 24 });
  const c5 = await upsertCampaign(brandId, 'BrandCo Awareness', { budget: 6000, spent: 500, bannerId: 900005, startedDaysAgo: 2, endsInDays: 28 });
  const c6 = await upsertCampaign(retailId, 'RetailCo Weekend', { budget: 9000, spent: 7400, bannerId: 900006, startedDaysAgo: 9, endsInDays: 1 });

  console.log('[seed] creatives + metric series...');
  const bannerA = await upsertCreative(mainId, 'Banner A', 'BANNER', 9);
  // Banner B runs longer than the others on purpose: fatigue is judged across
  // consecutive periods, so it needs enough history for three of them to be
  // measurable. Seeding nine days while claiming a three-period decline would
  // make the recommendation untrue.
  const bannerB = await upsertCreative(mainId, 'Banner B', 'BANNER', 12);
  const videoA = await upsertCreative(mainId, 'Video A', 'VIDEO', 9);

  // Banner A: steady. Clears the minimum-data rules with room to spare.
  await metricSeries(bannerA, mainId, 'impressions', [900, 940, 960, 980, 1000, 1010, 990, 1020, 1030]);
  await metricSeries(bannerA, mainId, 'clicks', [90, 95, 97, 99, 101, 102, 100, 103, 104]);
  await metricSeries(bannerA, mainId, 'conversions', [4, 4, 5, 5, 5, 6, 5, 6, 6]);
  await metricSeries(bannerA, mainId, 'engagements', [120, 125, 128, 130, 132, 134, 131, 135, 137]);
  await metricSeries(bannerA, mainId, 'spend', [30, 31, 32, 33, 34, 34, 33, 34, 35]);

  // Banner B: a genuinely monotone decline of roughly a third every three days,
  // so the fatigue detector finds a pattern that is really there and the
  // recommendation it produces is supported by the data underneath it.
  await metricSeries(bannerB, mainId, 'impressions', [2000, 1750, 1550, 1350, 1180, 1030, 900, 780, 680, 600, 520, 450]);
  await metricSeries(bannerB, mainId, 'clicks', [220, 196, 175, 155, 137, 120, 105, 91, 79, 68, 59, 51]);
  await metricSeries(bannerB, mainId, 'conversions', [10, 9, 8, 7, 7, 6, 5, 5, 4, 4, 3, 3]);
  await metricSeries(bannerB, mainId, 'engagements', [300, 265, 235, 208, 184, 163, 144, 127, 112, 99, 88, 78]);

  // Video A: strong, and the experiment's winning side.
  await metricSeries(videoA, mainId, 'impressions', [1500, 1550, 1600, 1620, 1650, 1700, 1680, 1720, 1750]);
  await metricSeries(videoA, mainId, 'clicks', [150, 158, 165, 170, 176, 182, 180, 186, 190]);
  await metricSeries(videoA, mainId, 'conversions', [12, 13, 14, 14, 15, 16, 15, 16, 17]);
  await metricSeries(videoA, mainId, 'engagements', [300, 315, 330, 340, 350, 365, 360, 372, 380]);

  // Enough impressions elsewhere for benchmarking and cross-campaign insight.
  for (const [cid, base] of [[c2, 1100], [c3, 700], [c4, 950], [c5, 300], [c6, 1300]]) {
    const cr = await upsertCreative(cid, 'Primary', 'IMAGE', 10);
    await metricSeries(cr, cid, 'impressions', [base, base + 20, base + 30, base + 40, base + 50]);
    await metricSeries(cr, cid, 'clicks', [Math.round(base / 10), Math.round(base / 10) + 2, Math.round(base / 10) + 3, Math.round(base / 10) + 4, Math.round(base / 10) + 5]);
    await metricSeries(cr, cid, 'conversions', [3, 3, 4, 4, 5]);
  }

  // ------------------------------------------------------------------
  // 1.1 notes (2 advertiser-visible + 1 internal)
  // ------------------------------------------------------------------
  console.log('[seed] notes...');
  const noteCount = Number((await one(`SELECT COUNT(*) AS n FROM banq_notes WHERE campaign_id = ?`, [mainId])).n);
  if (!noteCount) {
    const notes = [
      ['BANQ_ANALYST', 'ADVERTISER_VISIBLE', 'Monitoring has started on Harbour Hotel Summer. Budget pacing is the first thing we are watching.'],
      ['BANQ_ANALYST', 'ADVERTISER_VISIBLE', 'Banner B is showing a sustained fall in clicks. We will bring a recommendation rather than a guess.'],
      ['BANQ_ANALYST', 'INTERNAL_BANQ', 'Internal: Banner B looks like fatigue rather than a delivery problem. Do not tell the advertiser it is proven -- the evidence is a pattern, not a cause.']
    ];
    for (const n of notes) {
      await run(`INSERT INTO banq_notes (campaign_id, author_id, author_role, message, visibility) VALUES (?, ?, ?, ?, ?)`,
        [mainId, adminId, n[0], n[2], n[1]]);
    }
  }

  // ------------------------------------------------------------------
  // 1.2 timeline (6 events, including the ones the pacer reads)
  // ------------------------------------------------------------------
  console.log('[seed] timeline...');
  const tlCount = Number((await one(`SELECT COUNT(*) AS n FROM campaign_timeline WHERE campaign_id = ?`, [mainId])).n);
  if (!tlCount) {
    const events = [
      ['CAMPAIGN_CREATED', 'ADVERTISER', null],
      ['CAMPAIGN_LAUNCHED', 'ADVERTISER', null],
      ['BANQ_ACTIVATED', 'BANQ', null],
      ['CREATIVE_ADDED', 'ADVERTISER', JSON.stringify({ creative_id: videoA, creative_type: 'VIDEO' })],
      ['BUDGET_CHANGED', 'ADVERTISER', JSON.stringify({ from: 8000, to: 10000 })],
      ['CREATIVE_PAUSED', 'ADVERTISER', JSON.stringify({ creative_id: null, action: 'PAUSED' })]
    ];
    for (const e of events) {
      await run(`INSERT INTO campaign_timeline (campaign_id, event_type, actor_type, actor_id, metadata, timestamp)
                 VALUES (?, ?, ?, ?, ?, ${daysAgo(5)})`, [mainId, e[0], e[1], adminId, e[2]]);
    }
  }

  // ------------------------------------------------------------------
  // 1.3 goals
  // ------------------------------------------------------------------
  console.log('[seed] goals...');
  const goalCount = Number((await one(`SELECT COUNT(*) AS n FROM campaign_goals WHERE campaign_id = ?`, [mainId])).n);
  if (!goalCount) {
    await run(`INSERT INTO campaign_goals (campaign_id, goal_type, target_value, current_value, target_date)
               VALUES (?, 'BOOKINGS', 150, 96, ${daysAhead(5)})`, [mainId]);
    await run(`INSERT INTO campaign_goals (campaign_id, goal_type, target_value, current_value, target_date)
               VALUES (?, 'BRAND_AWARENESS', 50000, 31000, ${daysAhead(5)})`, [mainId]);
  }

  // ------------------------------------------------------------------
  // 1.6 alerts (1 CRITICAL, 1 MEDIUM, 1 INFO)
  // ------------------------------------------------------------------
  console.log('[seed] alerts...');
  const alertCount = Number((await one(`SELECT COUNT(*) AS n FROM banq_alerts WHERE campaign_id = ?`, [mainId])).n);
  if (!alertCount) {
    const alerts = [
      ['BUDGET_SPENDING_TOO_FAST', 'CRITICAL', 'Campaign spending faster than planned: 124% of expected spend.', 'NEW'],
      ['PERFORMANCE_DROP', 'MEDIUM', 'clicks fell 22% versus the previous period.', 'ACKNOWLEDGED'],
      ['GOAL_REACHED', 'INFO', 'Goal progress on BOOKINGS crossed 60% of target.', 'RESOLVED']
    ];
    for (const a of alerts) {
      await run(`INSERT INTO banq_alerts (campaign_id, alert_type, severity, message, supporting_data, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ${daysAgo(1)})`,
        [mainId, a[0], a[1], a[2], JSON.stringify({ seeded: true }), a[3]]);
    }
  }

  // ------------------------------------------------------------------
  // 1.7 health history -- 5 days: 82, 78, 85, 80, 82
  // ------------------------------------------------------------------
  console.log('[seed] health history (82, 78, 85, 80, 82)...');
  const healthCount = Number((await one(`SELECT COUNT(*) AS n FROM campaign_health_scores WHERE campaign_id = ?`, [mainId])).n);
  if (!healthCount) {
    const series = [[82, 'HEALTHY'], [78, 'WATCH'], [85, 'HEALTHY'], [80, 'HEALTHY'], [82, 'HEALTHY']];
    for (let i = 0; i < series.length; i++) {
      await run(`INSERT INTO campaign_health_scores (campaign_id, score, status, factor_breakdown, calculated_at)
                 VALUES (?, ?, ?, ?, ${daysAgo(series.length - i)})`,
        [mainId, series[i][0], series[i][1], JSON.stringify({ seeded: true })]);
    }
  }

  // ------------------------------------------------------------------
  // 2.6 + 2.7 recommendations
  // ------------------------------------------------------------------
  console.log('[seed] recommendations (generated by the engine, not written by hand)...');
  const recCount = Number((await one(`SELECT COUNT(*) AS n FROM banq_recommendations WHERE campaign_id = ?`, [mainId])).n);
  if (!recCount) {
    // The engine writes these, so a seeded recommendation can never claim more
    // than the data supports. If the detector finds nothing, nothing is claimed.
    const phase2 = require(path.join(__dirname, '..', 'backend', 'intelligence', 'phase2'));
    const campaign = (await one(`SELECT * FROM campaigns WHERE id = ?`, [mainId]));
    const generated = await phase2.generateRecommendations(campaign, { id: adminId });
    console.log('        engine proposed ' + generated.proposed + ', created ' + generated.created.length);
    await run(`INSERT INTO banq_recommendations (campaign_id, recommendation_type, title, description, reason, confidence_level, source)
               VALUES (?, 'MONITORING_ONLY', 'Continue monitoring',
                       'RECOMMENDED BY BANQ. No change recommended at this time.',
                       'Reviewed manually by BANQ staff.', 'MODERATE', 'MANUAL')`,
      [mainId]);
  }

  // ------------------------------------------------------------------
  // 3.1 + 3.2 + 3.3 journey: config, sources, events
  // ------------------------------------------------------------------
  console.log('[seed] journey...');
  // Through the engine's own registerSource, which looks the name up and
  // UPDATES it. The raw INSERT OR IGNORE this replaces had no uniqueness to
  // conflict with and quietly duplicated the sources on every run, which
  // multiplied every funnel number by the number of copies.
  const journey = require(path.join(__dirname, '..', 'backend', 'intelligence', 'phase3'));
  await journey.registerSource('platform', 'platform', 'TRACKED');
  await journey.registerSource('pixel', 'site', 'VERIFIED');
  await journey.registerSource('modelled', 'inferred', 'ESTIMATED');

  const jc = await one(`SELECT id FROM journey_configurations WHERE campaign_id = ?`, [mainId]);
  if (!jc) {
    await run(`INSERT INTO journey_configurations (campaign_id, primary_goal, secondary_goals, journey_steps)
               VALUES (?, 'BOOKINGS', ?, ?)`,
      [mainId, JSON.stringify(['BRAND_AWARENESS']),
        JSON.stringify(['IMPRESSION', 'CLICK', 'LANDING_PAGE_VISIT', 'SIGN_UP', 'PURCHASE'])]);
  }

  const je = Number((await one(`SELECT COUNT(*) AS n FROM journey_events WHERE campaign_id = ?`, [mainId])).n);
  if (!je) {
    // A funnel that narrows the way a real one does, with the last step carried
    // by an ESTIMATED source so the quality warning has something true to show.
    const funnel = [
      ['IMPRESSION', 42000, 'platform'], ['CLICK', 3100, 'platform'], ['LANDING_PAGE_VISIT', 2400, 'pixel'],
      ['SIGN_UP', 96, 'pixel'], ['PURCHASE', 41, 'modelled']
    ];
    for (const f of funnel) {
      await run(`INSERT INTO journey_events (campaign_id, advertiser_id, event_name, event_value, source, event_timestamp)
                 VALUES (?, ?, ?, ?, ?, ${daysAgo(3)})`, [mainId, hotelId, f[0], f[1], f[2]]);
    }
  }

  // ------------------------------------------------------------------
  // 3.4 + 3.5 experiment with a real result
  // ------------------------------------------------------------------
  console.log('[seed] experiment + result...');
  let expId = null;
  const exp = await one(`SELECT id FROM experiments WHERE campaign_id = ? LIMIT 1`, [mainId]);
  if (exp) {
    expId = Number(exp.id);
  } else {
    const res = await run(`INSERT INTO experiments (campaign_id, experiment_type, name, hypothesis, primary_metric, status, start_date)
                           VALUES (?, 'CREATIVE', 'Video vs Banner',
                                   'Video generates more booking activity than a static banner because it carries more of the offer in the first three seconds.',
                                   'conversions', 'COMPLETED', ${daysAgo(9)})`, [mainId]);
    expId = Number(res.lastInsertRowid);
    await run(`INSERT INTO experiment_variants (experiment_id, creative_id, variant_name, traffic_allocation, status)
               VALUES (?, ?, 'Control', '50/50', 'control')`, [expId, bannerA]);
    await run(`INSERT INTO experiment_variants (experiment_id, creative_id, variant_name, traffic_allocation, status)
               VALUES (?, ?, 'Variant B', '50/50', 'variant')`, [expId, videoA]);
  }

  const expRes = Number((await one(`SELECT COUNT(*) AS n FROM experiment_results WHERE experiment_id = ?`, [expId])).n);
  if (!expRes) {
    const variantB = await one(`SELECT id FROM experiment_variants WHERE experiment_id = ? AND variant_name = 'Variant B'`, [expId]);
    await run(`INSERT INTO experiment_results (experiment_id, variant_id, primary_metric_value, confidence_level, result_status)
               VALUES (?, ?, 17, 'MODERATE', 'POSITIVE_SIGNAL')`, [expId, variantB ? variantB.id : 0]);
  }

  // ------------------------------------------------------------------
  // 3.6 benchmark group (5+ campaigns now carry impressions)
  // ------------------------------------------------------------------
  console.log('[seed] benchmark group...');
  let groupId = null;
  const grp = await one(`SELECT id FROM benchmark_groups WHERE group_type = 'CAMPAIGN_GOAL' LIMIT 1`);
  if (grp) {
    groupId = Number(grp.id);
  } else {
    const res = await run(`INSERT INTO benchmark_groups (group_type, criteria) VALUES ('CAMPAIGN_GOAL', ?)`,
      [JSON.stringify({ goal: 'BOOKINGS', industry: 'hospitality' })]);
    groupId = Number(res.lastInsertRowid);
    await run(`INSERT INTO benchmark_metrics (group_id, metric_name, metric_value, sample_count) VALUES (?, 'health_score', 71, 6)`, [groupId]);
  }

  // ------------------------------------------------------------------
  // 3.8 + 3.9 enterprise with 3 brands, and a client request
  // ------------------------------------------------------------------
  console.log('[seed] enterprise + 3 brands...');
  let entId = null;
  const ent = await one(`SELECT id FROM enterprise_accounts LIMIT 1`);
  if (ent) {
    entId = Number(ent.id);
  } else {
    const res = await run(`INSERT INTO enterprise_accounts (name) VALUES ('Harbour Group')`);
    entId = Number(res.lastInsertRowid);
    await run(`INSERT INTO enterprise_brands (enterprise_id, name, qap_number) VALUES (?, 'Harbour Hotel', 'QAP-10001')`, [entId]);
    await run(`INSERT INTO enterprise_brands (enterprise_id, name, qap_number) VALUES (?, 'Harbour Restaurant', 'QAP-10002')`, [entId]);
    await run(`INSERT INTO enterprise_brands (enterprise_id, name, qap_number) VALUES (?, 'Harbour Retail', 'QAP-10003')`, [entId]);
    await run(`INSERT INTO enterprise_members (enterprise_id, user_id, role) VALUES (?, ?, 'ENTERPRISE_OWNER')`, [entId, hotelId]);
  }

  const reqCount = Number((await one(`SELECT COUNT(*) AS n FROM banq_client_requests LIMIT 1`)).n);
  if (!reqCount) {
    await run(`INSERT INTO banq_client_requests (advertiser_id, campaign_id, subject, body, priority, status)
               VALUES (?, ?, 'Can we extend the booking window?', 'We would like the campaign to keep running past the current end date.', 'NORMAL', 'NEW')`,
      [hotelId, mainId]);
  }

  // ------------------------------------------------------------------
  // 4.1 + 4.4 + 4.5 + 4.6 + 4.7 + 4.8 Phase 4 content
  // ------------------------------------------------------------------
  console.log('[seed] placements, predictive alert, plan + scenarios, forecast, GTM...');
  const plCount = Number((await one(`SELECT COUNT(*) AS n FROM placement_profiles`)).n);
  let pl1 = null, pl2 = null;
  if (!plCount) {
    const a = await run(`INSERT INTO placement_profiles (publisher_category, placement_type, creative_format, region, device_type, availability_status, historical_delivery_data)
                         VALUES ('travel', 'in-feed', 'BANNER', 'NATIONAL', 'mobile', 'available', ?)`,
      [JSON.stringify({ impressions: 48000, clicks: 2900 })]);
    pl1 = Number(a.lastInsertRowid);
    const b = await run(`INSERT INTO placement_profiles (publisher_category, placement_type, creative_format, region, device_type, availability_status)
                         VALUES ('news', 'interstitial', 'VIDEO', 'NATIONAL', 'desktop', 'limited')`);
    pl2 = Number(b.lastInsertRowid);
    await run(`INSERT INTO placement_insights (placement_id, metric_name, metric_value) VALUES (?, 'ctr', 0.0604)`, [pl1]);
    await run(`INSERT INTO placement_insights (placement_id, metric_name, metric_value) VALUES (?, 'ctr', 0.0411)`, [pl1]);
  } else {
    const p = await one(`SELECT id FROM placement_profiles ORDER BY id ASC LIMIT 1`);
    pl1 = p ? Number(p.id) : null;
    const p2 = await one(`SELECT id FROM placement_profiles ORDER BY id ASC LIMIT 1 OFFSET 1`);
    pl2 = p2 ? Number(p2.id) : null;
  }

  const predCount = Number((await one(`SELECT COUNT(*) AS n FROM predictive_alerts WHERE campaign_id = ?`, [mainId])).n);
  if (!predCount) {
    await run(`INSERT INTO predictive_alerts (campaign_id, prediction_type, prediction_window, confidence_level, supporting_data, recommended_action, status)
               VALUES (?, 'POSSIBLE_BUDGET_EXHAUSTION', 'next 4 days', 'MODERATE', ?,
                       'Consider reviewing the budget or the targeting scope before the projected exhaustion point.', 'ACTIVE')`,
      [mainId, JSON.stringify({ pacing_ratio_pct: 124, remaining: 3800 })]);
  }

  let planId = null;
  const plan = await one(`SELECT id FROM campaign_plans WHERE advertiser_id = ? LIMIT 1`, [hotelId]);
  if (plan) {
    planId = Number(plan.id);
  } else {
    const res = await run(`INSERT INTO campaign_plans (advertiser_id, campaign_name, objective, duration, budget, creative_type, primary_goal)
                           VALUES (?, 'Harbour Autumn Plan', 'BOOKINGS', 30, 10000, 'VIDEO', 'BOOKINGS')`, [hotelId]);
    planId = Number(res.lastInsertRowid);
  }

  const scenCount = Number((await one(`SELECT COUNT(*) AS n FROM campaign_scenarios WHERE plan_id = ?`, [planId])).n);
  if (!scenCount) {
    const scenarios = [
      [{ budget: 10000, duration: 30 }, 'HIGH_DATA_SUPPORT'],
      [{ budget: 15000, duration: 30 }, 'HIGH_DATA_SUPPORT'],
      [{ budget: 10000, duration: 45 }, 'MODERATE']
    ];
    for (const s of scenarios) {
      const res = await run(`INSERT INTO campaign_scenarios (plan_id, variables) VALUES (?, ?)`, [planId, JSON.stringify(s[0])]);
      const sid = Number(res.lastInsertRowid);
      await run(`INSERT INTO scenario_simulations (scenario_id, results, confidence_level) VALUES (?, ?, ?)`,
        [sid, JSON.stringify({ seeded: true, budget: s[0].budget, duration: s[0].duration }), s[1]]);
    }
  }

  const fcCount = Number((await one(`SELECT COUNT(*) AS n FROM forecasts WHERE campaign_id = ?`, [mainId])).n);
  if (!fcCount) {
    const res = await run(`INSERT INTO forecasts (campaign_id, forecast_type, forecast_range, confidence_level, model_version, inputs)
                           VALUES (?, 'BUDGET_EXHAUSTION', ?, 'MODERATE', 'v1', ?)`,
      [mainId, '3 to 5 days remaining before the budget is used.', JSON.stringify({ seeded: true, pacing_state: 'SPENDING_FAST' })]);
    await run(`INSERT INTO forecast_history (forecast_id, snapshot) VALUES (?, ?)`,
      [Number(res.lastInsertRowid), JSON.stringify({ seeded: true })]);
  }

  const gtmCount = Number((await one(`SELECT COUNT(*) AS n FROM gtm_projects`)).n);
  if (!gtmCount) {
    const res = await run(`INSERT INTO gtm_projects (advertiser_id, name, objective) VALUES (?, 'Harbour Autumn Go-To-Market', 'Fill the shoulder season')`, [hotelId]);
    const pid = Number(res.lastInsertRowid);
    for (const stage of ['PLANNING', 'CREATIVE_PREPARATION', 'CAMPAIGN_LAUNCH', 'OPTIMISATION', 'EXPERIMENTATION', 'CAMPAIGN_REVIEW', 'LEARNING_ARCHIVE']) {
      await run(`INSERT INTO gtm_timelines (project_id, stage, tasks) VALUES (?, ?, ?)`, [pid, stage, JSON.stringify([])]);
    }
    await run(`INSERT INTO gtm_objectives (project_id, primary_objective, success_metrics) VALUES (?, 'Fill the shoulder season', ?)`,
      [pid, JSON.stringify(['Booking volume', 'Cost per booking'])]);
  }

  const learnCount = Number((await one(`SELECT COUNT(*) AS n FROM learning_archive`)).n);
  if (!learnCount) {
    await run(`INSERT INTO learning_archive (advertiser_id, observation, evidence, status)
               VALUES (?, 'Video creatives produced the highest average engagement across recent campaigns.',
                       'Observed across 5 campaigns with scored creatives.', 'OBSERVED')`, [hotelId]);
  }

  // ------------------------------------------------------------------
  // C2 billboards: three advertisers declare, so demand has distinct people
  // ------------------------------------------------------------------
  console.log('[seed] billboard declarations...');
  const { ensureTables } = require(path.join(__dirname, '..', 'backend', 'billboards'));
  await ensureTables();
  const declCount = Number((await one(`SELECT COUNT(*) AS n FROM billboard_declarations`)).n);
  if (!declCount) {
    const decls = [
      [hotelId, 'billboard-harbour-front', 'LOCAL'],
      [brandId, 'billboard-harbour-front', 'LOCAL'],
      [retailId, 'billboard-harbour-front', 'LOCAL'],
      [hotelId, 'billboard-airport', 'NATIONAL'],
      [retailId, 'billboard-airport', 'NATIONAL']
    ];
    for (const d of decls) {
      await run(`INSERT INTO billboard_declarations (advertiser_id, billboard_key, billboard_region, state) VALUES (?, ?, ?, 'INTERESTED')`,
        [d[0], d[1], d[2]]);
    }
  }

  // ------------------------------------------------------------------
  // Score every creative, not just the demo campaign's. Creatives kept in
  // separate campaigns are what make benchmarking and cross-campaign pattern
  // detection possible, and an unscored creative is invisible to both.
  // ------------------------------------------------------------------
  console.log('[seed] scoring creatives across all campaigns...');
  const scoring = require(path.join(__dirname, '..', 'backend', 'intelligence', 'phase2'));
  const allCreatives = (await db.execute(`SELECT * FROM ad_creatives`)).rows;
  let scored = 0, insufficient = 0;
  for (const cr of allCreatives) {
    // Stored, not ephemeral: cross-campaign pattern detection reads the stored
    // scores, so a score that is only calculated and discarded is invisible to it.
    const s = await scoring.creativeScore(cr, {});
    if (s.score === null) insufficient++; else scored++;
  }
  console.log('        scored ' + scored + ', insufficient data ' + insufficient);

  // ------------------------------------------------------------------
  // Flags: turn the finished work ON so it is visible. The PURCHASE path stays
  // OFF because no payment rail is connected -- opening it would hand out a
  // paid month for free.
  // ------------------------------------------------------------------
  console.log('[seed] enabling the finished phases (purchase stays OFF)...');
  const enable = ['banq_monitor_dashboard', 'banq_phase1_monitor', 'banq_phase2_understand',
    'banq_phase3_learn', 'banq_phase4_plan', 'banq_benchmarking', 'banq_forecasting',
    'banq_enterprise', 'billboards_real_demand'];
  for (const f of enable) await flags.setFlag(f, true, 'enabled by seed-banq-intelligence');
  await flags.setFlag('banq_service_purchase', false, 'stays off until a payment rail is connected');

  console.log('');
  console.log('[seed] DONE');
  console.log('  demo advertisers: hotelgroup (BANQ month PAID), brandco, retailco (both locked)');
  console.log('  password for all demo accounts: ' + DEMO_PASSWORD);
  console.log('  main campaign id: ' + mainId + ' (Harbour Hotel Summer)');
  console.log('  creatives: Banner A ' + bannerA + ', Banner B ' + bannerB + ', Video A ' + videoA);
  console.log('  experiment id: ' + expId + '  plan id: ' + planId + '  enterprise id: ' + entId);
  console.log('  placements: ' + pl1 + ', ' + pl2);
  console.log('  phases enabled; banq_service_purchase remains OFF by design');
}

seed().then(function () {
  process.exit(0);
}).catch(function (err) {
  console.error('[seed] FAILED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
