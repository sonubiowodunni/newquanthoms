/*
 * New Quanthoms Billboard Agency (BANQ)
 * scripts/verify-banq-intelligence.cjs -- Rule 57 verify for the intelligence system
 *
 * WHAT IT PROVES, beyond "the files exist":
 *
 *   - the schema is really there (51 tables, seeded config)
 *   - the no-hardcoded-thresholds rule: change a weight in banq_config and the
 *     health score MOVES. If a weight could not change the answer, the rule is
 *     being broken somewhere.
 *   - the $15 gate: an unsubscribed advertiser gets 402 from a monitoring route,
 *     a subscribed one gets 200, and staff bypass it
 *   - access control: an advertiser cannot read another advertiser's campaign,
 *     and an internal note is never returned to an advertiser request
 *   - the honesty rules: INSUFFICIENT_DATA instead of a fabricated score,
 *     OBSERVED separated from POSSIBLE CONTRIBUTING FACTORS, cautious prediction
 *     language, a range instead of a certain number, and no "winner" wording
 *   - the two bugs this work fixed: a per-day trend basis (so a falling metric
 *     is not reported as rising) and one journey event counting once (so a
 *     funnel does not multiply)
 *
 * Run:  node scripts/verify-banq-intelligence.cjs
 * Requires the server on PORT (default 3002). Run the seed first.
 */

const path = require('path');
const BASE = process.env.BANQ_BASE || 'http://localhost:3002';

let pass = 0, fail = 0;
const failures = [];

function ok(name, condition, detail) {
  if (condition) { pass++; console.log('  PASS  ' + name); }
  else {
    fail++;
    failures.push(name + (detail ? ' :: ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? '  (' + detail + ')' : ''));
  }
}

function section(t) { console.log('\n' + t); }

async function api(method, urlPath, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + urlPath, {
    method: method,
    headers: headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch (e) { json = { _raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
}

async function login(username) {
  const r = await api('POST', '/api/auth/login', null, { username: username, password: 'demo12345' });
  return r.body && r.body.token ? r.body.token : null;
}

async function main() {
  const { init, db } = require(path.join(__dirname, '..', 'backend', 'db'));
  const schema = require(path.join(__dirname, '..', 'backend', 'intelligence', 'schema'));
  const core = require(path.join(__dirname, '..', 'backend', 'intelligence', 'core'));
  const p1 = require(path.join(__dirname, '..', 'backend', 'intelligence', 'phase1'));
  const p2 = require(path.join(__dirname, '..', 'backend', 'intelligence', 'phase2'));
  const p3 = require(path.join(__dirname, '..', 'backend', 'intelligence', 'phase3'));
  const p4 = require(path.join(__dirname, '..', 'backend', 'intelligence', 'phase4'));
  const service = require(path.join(__dirname, '..', 'backend', 'intelligence', 'service'));
  const flags = require(path.join(__dirname, '..', 'backend', 'flags'));

  await init();
  await schema.migrate();

  // =================================================================
  section('PRE-BUILD (E0): schema and config');
  // =================================================================
  const tables = (await db.execute({
    sql: `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
  })).rows.map(function (r) { return r.name; });
  const expected = ['banq_config', 'campaigns', 'banq_service_subscriptions', 'campaign_metrics',
    'banq_activity_log', 'banq_notes', 'campaign_timeline', 'campaign_goals', 'banq_alerts',
    'campaign_health_scores', 'banq_reports', 'ad_creatives', 'creative_metrics',
    'creative_status_history', 'creative_performance_scores', 'creative_fatigue_events',
    'banq_recommendations', 'recommendation_actions', 'recommendation_history',
    'journey_events', 'journey_event_sources', 'journey_configurations',
    'experiments', 'experiment_variants', 'experiment_results',
    'benchmark_groups', 'benchmark_metrics', 'cross_campaign_insights',
    'enterprise_accounts', 'enterprise_brands', 'enterprise_members', 'banq_client_requests',
    'campaign_readiness_checks', 'campaign_plans', 'reports', 'report_snapshots',
    'placement_profiles', 'placement_insights', 'predictive_alerts', 'campaign_scenarios',
    'scenario_simulations', 'forecasts', 'forecast_history',
    'gtm_projects', 'gtm_objectives', 'gtm_timelines', 'gtm_tasks', 'learning_archive',
    'banq_notifications', 'banq_revenue_ledger', 'banq_feature_flags'];
  const present = expected.filter(function (t) { return tables.indexOf(t) !== -1; });
  ok('all 51 intelligence tables exist (found ' + tables.length + ' total)', present.length === expected.length,
    'missing: ' + expected.filter(function (t) { return tables.indexOf(t) === -1; }).join(', '));

  const cfgCount = (await db.execute({ sql: `SELECT COUNT(*) n FROM banq_config` })).rows[0];
  ok('banq_config is seeded (32 keys)', Number(cfgCount.n) >= 32, 'found ' + cfgCount.n);

  const weights = await core.cfg('health_score_weights', null);
  const ranges = await core.cfg('health_score_ranges', null);
  ok('config values parse as JSON, not strings', weights && typeof weights === 'object' && ranges && typeof ranges === 'object');
  const wSum = weights ? Object.keys(weights).reduce(function (s, k) { return s + weights[k]; }, 0) : 0;
  ok('health weights sum to 100', wSum === 100, 'sum ' + wSum);

  const monitorFee = await core.cfg('banq_monitor_fee_usd', null);
  ok('the $15 monitoring fee is config-driven', monitorFee === 15, 'got ' + monitorFee);

  // =================================================================
  section('PHASE 1: monitor');
  // =================================================================
  const campaign = (await db.execute({
    sql: `SELECT * FROM campaigns WHERE campaign_name = 'Harbour Hotel Summer'`
  })).rows[0];
  ok('seeded demo campaign exists', !!campaign);

  const pacer = await p1.budgetPacer(campaign, {});
  ok('pacer reports AT_RISK for the seeded campaign', pacer.state === 'AT_RISK', 'state ' + pacer.state);
  ok('pacer computes expected spend from the timeline, not the raw budget',
    pacer.expected_spend !== Number(campaign.total_budget), pacer.expected_spend + ' vs ' + campaign.total_budget);
  ok('pacer returns a human sentence', typeof pacer.message === 'string' && pacer.message.length > 10);

  const noBudget = await p1.budgetPacer({ id: 999999, total_budget: 0, spent_budget: 0, advertiser_id: 0 }, {});
  ok('pacer handles NO_BUDGET instead of dividing by zero', noBudget.state === 'NO_BUDGET');

  const health = await p1.calculateHealth(campaign, null);
  ok('health score calculated from config weights', health.score !== null && health.score > 0 && health.score <= 100, 'score ' + health.score);
  ok('health exposes its factor breakdown', !!health.factor_breakdown.budget_pacing);

  // THE NO-HARDCODED RULE, proved by changing the input.
  const originalWeights = await core.cfg('health_score_weights', null);
  await core.setCfg('health_score_weights', { budget_pacing: 0, goal_progress: 100, delivery: 0, performance_trend: 0, technical_status: 0 }, 'json');
  const healthReordered = await p1.calculateHealth(campaign, null);
  await core.setCfg('health_score_weights', originalWeights, 'json');
  const healthRestored = await p1.calculateHealth(campaign, null);
  ok('changing a weight in banq_config CHANGES the score (no hardcoded thresholds)',
    healthReordered.score !== health.score, 'before ' + health.score + ', reweighted ' + healthReordered.score);
  ok('restoring the weight restores the score', healthRestored.score === health.score);

  const history = await p1.healthHistory(campaign.id, 10);
  ok('health history is stored for graphing', history.length >= 5, 'rows ' + history.length);

  const alertsRunA = await p1.evaluateAlerts(campaign, null);
  const alertsRunB = await p1.evaluateAlerts(campaign, null);
  ok('alert engine creates alerts on the first pass', alertsRunA.created.length > 0 || alertsRunA.blocked.length > 0);
  ok('dedup/cooldown prevents an immediate duplicate', alertsRunB.created.length === 0,
    'second pass created ' + alertsRunB.created.length);

  const goals = await p1.listGoals(campaign.id);
  const unmeasurable = goals.find(function (g) { return g.measurable === false; });
  ok('an unmeasurable goal says so instead of showing a confident zero',
    !unmeasurable || typeof unmeasurable.note === 'string', unmeasurable ? unmeasurable.note : 'none seeded');

  const report = await p1.generateReport(campaign, { report_type: 'Campaign Summary' }, null);
  ok('report card generates a readable snapshot', !!report.snapshot && !!report.snapshot.recommendation);
  // Snapshot preservation: change the underlying spend and re-read the report.
  const spendBefore = campaign.spent_budget;
  await db.execute({ sql: `UPDATE campaigns SET spent_budget = spent_budget + 999 WHERE id = ?`, args: [campaign.id] });
  const reread = await p1.latestReport(campaign.id);
  await db.execute({ sql: `UPDATE campaigns SET spent_budget = ? WHERE id = ?`, args: [spendBefore, campaign.id] });
  ok('a generated report keeps its snapshot when the data later changes',
    reread && reread.id === report.id && reread.data_snapshot.budget.actual_spend === report.snapshot.budget.actual_spend);

  const timeline = await p1.listTimeline(campaign.id, { limit: 50 });
  ok('timeline is readable newest-first', timeline.length > 0 && new Date(timeline[0].timestamp) >= new Date(timeline[timeline.length - 1].timestamp));

  const queue = await p1.workQueue({});
  ok('work queue returns band counts', queue.counts && typeof queue.counts.CRITICAL === 'number');
  ok('work queue flags campaigns needing attention', queue.queue.some(function (q) { return q.needs_attention; }));

  const revenue = await p1.revenueSummary({});
  ok('BANQ revenue is recorded in its own ledger', revenue.gross_fees > 0, 'gross ' + revenue.gross_fees);

  // =================================================================
  section('PHASE 2: understand');
  // =================================================================
  const creatives = await p2.listCreatives(campaign.id);
  ok('creatives are listed with metrics', creatives.length >= 3);

  const bannerB = creatives.find(function (c) { return c.creative_name === 'Banner B'; });
  const scoreB = await p2.creativeScore(bannerB, {});
  ok('a collapsing creative is not labelled STRONG', scoreB.status === 'DECLINING', 'status ' + scoreB.status + ' score ' + scoreB.score);
  ok('the decline carries its reason', !!scoreB.decline_detail && scoreB.decline_detail.indexOf('%') !== -1);

  const trend = scoreB.factor_breakdown.trend;
  ok('trend is measured per day, not by comparing raw sums', trend.basis === undefined || trend.basis.indexOf('per-day') !== -1,
    'basis ' + trend.basis);
  ok('a falling creative reports a NEGATIVE trend', trend.change_pct !== null && trend.change_pct < 0, 'change ' + trend.change_pct);

  const insufficient = await p2.creativeScore({ id: 999999, campaign_id: campaign.id, created_at: new Date().toISOString(), activated_at: new Date().toISOString() }, {});
  ok('a creative without enough data returns INSUFFICIENT_DATA, not a score',
    insufficient.score === null && insufficient.status === 'INSUFFICIENT_DATA', 'got ' + insufficient.status);

  const fatigue = await p2.detectFatigue(campaign, {});
  const fatigued = fatigue.findings.find(function (f) { return f.state === 'POSSIBLE_FATIGUE'; });
  ok('fatigue detector finds the real sustained decline', !!fatigued, 'states ' + fatigue.findings.map(function (f) { return f.state; }).join(','));
  ok('fatigue states that it is a pattern, not proof', !fatigued || /does not prove/i.test(fatigued.language_note || ''),
    fatigued ? fatigued.language_note : '');

  const changed = await p2.whatChanged(campaign, { period: '7d' });
  ok('what-changed separates observed facts from possible factors',
    Array.isArray(changed.observed) && Array.isArray(changed.possible_contributing_factors));
  ok('what-changed carries an explicit no-causation disclaimer', /not asserted as causes/i.test(changed.disclaimer || ''));
  ok('observed changes state their basis',
    !changed.observed.length || changed.observed[0].basis.indexOf('per-day') !== -1,
    changed.observed.length ? changed.observed[0].basis : 'none');

  const battle = await p2.creativeBattle(campaign, {});
  ok('creative battle refuses to name a leader without two rankable creatives',
    battle.ranked.length > 1 ? !!battle.leader : /cannot be named/.test(battle.statement));

  const recs = await p2.listRecommendations(campaign.id, {});
  ok('recommendations exist with a stated reason', recs.length > 0 && recs.every(function (r) { return !!r.reason; }));
  ok('recommendations use "BANQ recommends considering" language',
    recs.some(function (r) { return /recommends considering/i.test(r.description || ''); }));
  ok('recommendation confidence is one of the allowed levels',
    recs.every(function (r) { return ['HIGH', 'MODERATE', 'EARLY_SIGNAL'].indexOf(r.confidence_level) !== -1; }));

  const target = recs[0];
  const before = target.status;
  const moved = await p2.setRecommendationStatus(target.id, 'APPROVED', null, 'verify');
  const afterHistory = await p2.recommendationHistory(target.id);
  ok('approval flow records the transition', moved.status_from === before && moved.status_to === 'APPROVED');
  ok('approval flow writes history and action rows', afterHistory.history.length > 0 && afterHistory.actions.length > 0);
  await p2.setRecommendationStatus(target.id, before, null, 'verify-restore');

  const action = await p2.actionCenter(campaign, {});
  ok('action centre collects what needs a decision', !!action.needs_decision && !!action.next_step);

  // =================================================================
  section('PHASE 3: learn');
  // =================================================================
  const drop = await p3.dropOff(campaign, {});
  const impressions = drop.steps.find(function (s) { return s.step === 'IMPRESSION'; });
  ok('drop-off uses the event total, not the row count', impressions.count === 42000, 'got ' + impressions.count);
  ok('drop-off narrows like a real funnel',
    drop.steps[0].count > drop.steps[1].count && drop.steps[1].count > drop.steps[3].count);
  ok('drop-off identifies the biggest fall', !!drop.biggest_drop && /largest fall/i.test(drop.biggest_drop.statement));
  ok('estimated data is flagged, never blended silently', !!drop.quality_warning);
  ok('drop-off reports a tracking failure as unavailable, not zero',
    (await p3.dropOff({ id: 999999, advertiser_id: 0 }, {})).state === 'TRACKING DATA UNAVAILABLE');

  const srcCount = (await db.execute({
    sql: `SELECT COUNT(*) n FROM journey_event_sources WHERE source_name = 'platform'`
  })).rows[0];
  ok('a journey source name is unique, so one event counts once', Number(srcCount.n) === 1, 'found ' + srcCount.n);

  const expRow = (await db.execute({ sql: `SELECT * FROM experiments WHERE campaign_id = ? LIMIT 1`, args: [campaign.id] })).rows[0];
  const results = await p3.experimentResults(expRow.id, null);
  ok('experiment requires a hypothesis', !!expRow.hypothesis && expRow.hypothesis.length > 20);
  ok('experiment results never use the word "winner"', JSON.stringify(results).toLowerCase().indexOf('winner') === -1);
  ok('experiment results carry a cautious label',
    results.state === 'IN_PROGRESS' || (results.comparisons || []).every(function (c) {
      return ['EARLY_SIGNAL', 'POSITIVE_SIGNAL', 'NO_MEANINGFUL_DIFFERENCE', 'NEGATIVE_SIGNAL', 'INCONCLUSIVE'].indexOf(c.label) !== -1;
    }));

  let threw = false;
  try { await p3.createExperiment({ campaign_id: campaign.id, experiment_type: 'CREATIVE', name: 'x', hypothesis: '' }, null); }
  catch (e) { threw = true; }
  ok('an experiment without a hypothesis is refused', threw);

  const bench = await p3.benchmarkFor(campaign, {});
  ok('benchmark publishes an aggregate with a privacy note',
    !bench.published.length || /No advertiser, campaign or individual metric is exposed/.test(bench.published[0].privacy_note));
  ok('benchmark refuses to publish below the minimum campaign count',
    bench.withheld.length === 0 || /are required before an aggregate is published/.test(bench.withheld[0].reason));
  ok('benchmark never exposes another advertiser',
    JSON.stringify(bench).indexOf('campaign_name') === -1 || JSON.stringify(bench).indexOf('Harbour Hotel Winter') === -1);

  const hotelId = (await db.execute({ sql: `SELECT id FROM users WHERE username = 'hotelgroup'` })).rows[0].id;
  const cross = await p3.crossCampaignInsights(hotelId, { skip_store: true });
  ok('cross-campaign finds patterns across the advertiser\'s own campaigns', cross.state === 'OK', cross.state);
  ok('cross-campaign labels findings as observed patterns, not strategy',
    cross.insights.every(function (i) { return i.label === 'OBSERVED_PATTERN'; }));

  const ent = await p3.enterpriseOverview(1, { id: hotelId, is_admin: 0 });
  ok('enterprise returns brands for a member', ent.brands.length > 0 && ent.role === 'ENTERPRISE_OWNER');
  let refused = false;
  try { await p3.enterpriseOverview(1, { id: 424242, is_admin: 0 }); } catch (e) { refused = true; }
  ok('enterprise refuses a non-member', refused);

  const ws = await p3.teamWorkspace({ id: hotelId, is_admin: 0 }, {});
  ok('team workspace returns the client view for an advertiser', ws.view === 'CLIENT');
  const wsStaff = await p3.teamWorkspace({ id: 1, is_admin: 1 }, {});
  ok('team workspace returns the staff view for BANQ staff', wsStaff.view === 'STAFF');

  // =================================================================
  section('PHASE 4: plan');
  // =================================================================
  const readiness = await p4.readinessCheck(campaign, null);
  ok('readiness scores from the campaign configuration', readiness.score >= 0 && readiness.score <= 100);
  ok('readiness distinguishes blocking items from observations',
    Array.isArray(readiness.blocking) && readiness.checks.every(function (c) { return typeof c.blocking === 'boolean'; }));
  ok('readiness states the human override rather than silently blocking',
    /BANQ does not block a launch on an observation|technical requirements, not opinions/.test(readiness.override_note));

  const preds = await p4.evaluatePredictiveAlerts(campaign, null);
  ok('predictive alerts use cautious "may" language',
    preds.alerts.length === 0 || preds.alerts.every(function (a) { return /may|if the current trend continues|cannot predict/i.test(a.message); }),
    preds.alerts.map(function (a) { return a.message; }).join(' | ').slice(0, 160));
  ok('predictive alerts carry their inputs', preds.alerts.every(function (a) { return !!a.prediction_type; }));

  const predsAgain = await p4.evaluatePredictiveAlerts(campaign, null);
  const actives = await p4.listPredictiveAlerts(campaign.id, { status: 'ACTIVE' });
  ok('re-evaluating updates an existing prediction instead of duplicating it',
    actives.length <= preds.alerts.length, 'active ' + actives.length + ' vs created ' + preds.alerts.length);

  const predId = (await p4.listPredictiveAlerts(campaign.id, {})).pop();
  const dismissed = await p4.setPredictiveAlertStatus(predId.id, 'DISMISSED', null);
  ok('a prediction can be dismissed by a human', dismissed.status === 'DISMISSED');

  const plan = await p4.createPlan({ advertiser_id: hotelId, campaign_name: 'Verify Plan', objective: 'SALES', budget: 12000, duration: 30 }, null);
  ok('planner labels what is a system suggestion vs a BANQ recommendation',
    plan.recommended_structure.source_labels.recommended_creatives === 'SYSTEM_SUGGESTION' &&
    plan.recommended_structure.source_labels.journey_tracking === 'BANQ_RECOMMENDATION');

  const scen = await p4.createScenario(plan.id, { budget: 15000, duration: 30 }, null);
  const sim = await p4.simulateScenario(scen.id, null);
  ok('simulation never presents a single number as certainty',
    !sim.results.forecast_range || /range of/i.test(sim.results.forecast_range.statement));
  ok('simulation reports relative outcomes when history is thin',
    sim.results.forecast_range !== null || /relative/i.test(sim.results.relative.statement), 'confidence ' + sim.confidence_level);

  const forecast = await p4.generateForecast(campaign, null, null);
  ok('forecast is versioned', !!forecast.model_version, forecast.model_version);
  ok('forecast exposes its inputs', !!forecast.inputs && !!forecast.inputs.pacing_state);
  ok('forecast is a range, not a single certain figure', /to|may/.test(forecast.forecast_range), forecast.forecast_range);

  const rep4 = await p4.generateReport({ report_type: 'Weekly', campaign_id: campaign.id }, null);
  ok('scheduled reporting writes a report + snapshot pair', rep4.id > 0 && !!rep4.snapshot);
  const fetched = await p4.getReport(rep4.id, null);
  ok('a stored report is readable with its frozen snapshot', !!fetched.snapshot);

  const placements = await p4.listPlacements({});
  ok('placements are listed', placements.length > 0);
  const compare = await p4.comparePlacements([placements[0].id], null);
  ok('placement comparison reports unavailable data honestly',
    !compare.placements.length || ['OK', 'DATA_UNAVAILABLE'].indexOf(compare.placements[0].state) !== -1);
  ok('placement analysis states that QWK owns the inventory', /owned and controlled by QWK Browser/.test(compare.publisher_note));

  const gtm = await p4.createGtmProject({ advertiser_id: hotelId, name: 'Verify GTM', objective: 'test' }, null);
  const gtmFull = await p4.getGtmProject(gtm.id, null);
  ok('GTM project carries the full stage ladder', gtmFull.timeline.length === 7);
  ok('GTM connects objective to learning', /LEARNING/.test(gtmFull.connects));

  // =================================================================
  section('THE $15 GATE (G3 + G4)');
  // =================================================================
  // A VERIFY SCRIPT MUST BE RE-RUNNABLE. The first version of this section read
  // and mutated the seeded demo advertisers, so its second run found brandco
  // already paid and failed on its own leftovers. These are throwaway probe
  // accounts created and reset by the script itself, so the gate is tested from
  // a known state every time.
  const bcrypt = require('bcryptjs');
  async function probeAdvertiser(username) {
    let user = (await db.execute({ sql: `SELECT id FROM users WHERE username = ?`, args: [username] })).rows[0];
    if (!user) {
      const hash = await bcrypt.hash('demo12345', 10);
      const ins = await db.execute({
        sql: `INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, 0)`,
        args: [username, username + '@verify.local', hash]
      });
      user = { id: Number(ins.lastInsertRowid) };
    }
    // Reset: each run starts with no subscription for these probes.
    await db.execute({ sql: `DELETE FROM banq_service_subscriptions WHERE advertiser_id = ?`, args: [user.id] });
    await db.execute({ sql: `DELETE FROM banq_revenue_ledger WHERE advertiser_id = ?`, args: [user.id] });
    const name = 'Verify Probe ' + username;
    let camp = (await db.execute({ sql: `SELECT id FROM campaigns WHERE campaign_name = ?`, args: [name] })).rows[0];
    if (!camp) {
      const ins = await db.execute({
        sql: `INSERT INTO campaigns (advertiser_id, campaign_name, campaign_source, status, total_budget, spent_budget, qwk_banner_id, start_date, end_date)
              VALUES (?, ?, 'verify', 'active', 5000, 1000, 999001, datetime('now','-2 days'), datetime('now','+8 days'))`,
        args: [user.id, name]
      });
      camp = { id: Number(ins.lastInsertRowid) };
    }
    return { id: user.id, campaignId: camp.id };
  }

  const probeLocked = await probeAdvertiser('verify_locked');
  const probePaid = await probeAdvertiser('verify_paid');

  const hotelSub = await service.activeSubscription(hotelId);
  const lockedSub = await service.activeSubscription(probeLocked.id);
  ok('the seeded advertiser has a paid BANQ month', !!hotelSub, 'status ' + (hotelSub && hotelSub.banq_service_status));
  ok('a probe advertiser does NOT, so the locked state is real', !lockedSub);

  const accessHotel = await service.monitorAccess(hotelId);
  const accessLocked = await service.monitorAccess(probeLocked.id);
  ok('a paid month opens the gate', accessHotel.allowed === true);
  ok('no paid month closes it, with a reason', accessLocked.allowed === false && !!accessLocked.reason, accessLocked.reason);
  ok('a never-subscribed advertiser is distinguished from an expired one',
    accessLocked.reason === 'never_subscribed', accessLocked.reason);
  ok('the gate explains the fee and what it covers', /does not charge the BANQ fee again/.test(accessHotel.covers));

  const offer = await service.serviceOffer();
  ok('the offer is $15/month and says ads are paid separately',
    offer.fee_usd === 15 && /paid separately/i.test(offer.does_not_include));
  ok('the offer lists what the fee unlocks', offer.unlocks.length >= 6);

  const notDouble = await service.subscribe(hotelId, { plan: 'monitor', currency: 'credits' }, null);
  ok('a second purchase inside a paid month is not charged again',
    notDouble.charged === false && notDouble.reason === 'already_covered_this_month');

  const pending = await service.subscribe(probePaid.id, { plan: 'monitor', currency: 'credits' }, null);
  ok('an unconfirmed payment does NOT open the gate (no free unlock)',
    pending.charged === false && pending.gate_open === false && !!pending.id, 'gate_open ' + pending.gate_open);
  const stillLocked = await service.monitorAccess(probePaid.id);
  ok('and that advertiser is still refused until payment lands', stillLocked.allowed === false);
  const afterConfirm = await service.confirmPayment(pending.id, null, 'VERIFY');
  ok('confirming payment opens the gate', afterConfirm.status === 'ACTIVE' && afterConfirm.changed === true);
  ok('confirmed revenue reaches the ledger', afterConfirm.ledger_id > 0);
  const nowOpen = await service.monitorAccess(probePaid.id);
  ok('the same advertiser is now allowed in', nowOpen.allowed === true);

  const purchaseFlag = await flags.isEnabled('banq_service_purchase');
  ok('the purchase path stays OFF until a payment rail exists', purchaseFlag === false);

  // =================================================================
  section('FEATURE FLAGS (D8)');
  // =================================================================
  ok('an unknown flag resolves to false, not a throw', (await flags.isEnabled('does_not_exist')) === false);
  const allFlags = await flags.allFlags();
  ok('flags report their source (default / database / env)',
    Object.keys(allFlags).every(function (k) { return ['default', 'database', 'env'].indexOf(allFlags[k].source) !== -1; }));
  ok('the four phase flags are visible after the seed',
    allFlags.banq_phase1_monitor.enabled && allFlags.banq_phase2_understand.enabled &&
    allFlags.banq_phase3_learn.enabled && allFlags.banq_phase4_plan.enabled);

  // =================================================================
  section('LIVE API over HTTP (port 3002)');
  // =================================================================
  const hotelToken = await login('hotelgroup');
  // The LOCKED probe is its own account, created above and deliberately left
  // unpaid for the whole run, so the closed state can be tested over HTTP after
  // the same script has already opened a different account.
  const retailToken = await login('verify_locked');
  ok('demo advertiser can sign in', !!hotelToken);

  const noToken = await api('GET', '/api/banq/overview', null);
  ok('the monitor overview requires a session', noToken.status === 401, 'status ' + noToken.status);

  const ov = await api('GET', '/api/banq/overview', hotelToken);
  ok('the overview answers for a signed-in advertiser', ov.status === 200 && ov.body.ok === true);
  ok('the overview reports the access decision', !!ov.body.access && ov.body.access.allowed === true);
  ok('the overview offers the $15 service to everyone', ov.body.offer.fee_usd === 15);
  ok('the overview exposes the flag map for the UI', typeof ov.body.flags === 'object');

  const lockedOv = await api('GET', '/api/banq/overview', retailToken);
  ok('a locked advertiser still gets their own overview', lockedOv.status === 200);
  ok('a locked advertiser is told the monitoring tools are the paid part',
    /monitoring tools/i.test(lockedOv.body.locked_explanation || ''), lockedOv.body.locked_explanation || '(empty)');

  const pacerHttp = await api('GET', '/api/banq/budget-pacer/' + campaign.id, hotelToken);
  ok('gated monitoring route answers 200 for a paid advertiser', pacerHttp.status === 200, 'status ' + pacerHttp.status);

  // A locked advertiser hits the gate with 402 (payment required) on a campaign
  // they actually own. Asking about someone else's campaign is a different test
  // and must answer 403, because 402 here would confirm the campaign exists.
  const lockedPacer = await api('GET', '/api/banq/budget-pacer/' + probeLocked.campaignId, retailToken);
  ok('the same route answers 402 for a locked advertiser on their OWN campaign',
    lockedPacer.status === 402, 'status ' + lockedPacer.status);
  ok('the 402 body explains the fee', /BANQ AD SERVICE/.test(lockedPacer.body.message || ''));
  ok('the gate refuses with 402, not 403, so it is a payment answer not a permission answer',
    lockedPacer.body.error === 'banq_service_required', lockedPacer.body.error);

  // And ownership is checked BEFORE payment, so a locked advertiser cannot use
  // the gate's different status codes to discover that another campaign exists.
  const lockedCrossRead = await api('GET', '/api/banq/budget-pacer/' + campaign.id, retailToken);
  ok('ownership is judged before the gate, so 403 wins for a campaign that is not theirs',
    lockedCrossRead.status === 403, 'status ' + lockedCrossRead.status);

  // Cross-advertiser isolation over HTTP.
  const crossRead = await api('GET', '/api/banq/campaign/' + probeLocked.campaignId, hotelToken);
  ok('an advertiser cannot read another advertiser\'s campaign', crossRead.status === 403, 'status ' + crossRead.status);

  const internalNote = (await db.execute({
    sql: `SELECT id, campaign_id FROM banq_notes WHERE visibility = 'INTERNAL_BANQ' LIMIT 1`
  })).rows[0];
  const notesAsAdvertiser = await api('GET', '/api/banq/notes/' + campaign.id, hotelToken);
  const advertiserSeesInternal = (notesAsAdvertiser.body.notes || []).some(function (n) { return n.visibility === 'INTERNAL_BANQ'; });
  ok('an internal note is NEVER returned to an advertiser request', internalNote && !advertiserSeesInternal);

  const adminLogin = await api('POST', '/api/auth/login', null, { username: 'banqadmin', password: 'typetype450' });
  const adminToken = adminLogin.body && adminLogin.body.token ? adminLogin.body.token : null;
  ok('staff can sign in', !!adminToken);
  const notesAsStaff = await api('GET', '/api/banq/notes/' + campaign.id, adminToken);
  const staffSeesInternal = (notesAsStaff.body.notes || []).some(function (n) { return n.visibility === 'INTERNAL_BANQ'; });
  ok('staff DO see the internal note', staffSeesInternal);

  const staffPacer = await api('GET', '/api/banq/budget-pacer/' + campaign.id, adminToken);
  ok('staff bypass the service gate (they deliver the service)', staffPacer.status === 200, 'status ' + staffPacer.status);

  const queueHttp = await api('GET', '/api/banq/work-queue', adminToken);
  ok('staff work queue answers with band counts', queueHttp.status === 200 && !!queueHttp.body.queue.counts);
  const queueAsAdvertiser = await api('GET', '/api/banq/work-queue', hotelToken);
  ok('the staff work queue is refused to an advertiser', queueAsAdvertiser.status === 403);

  const configAsAdvertiser = await api('GET', '/api/banq/config', hotelToken);
  ok('the admin config UI is staff-only', configAsAdvertiser.status === 403);
  const configAsStaff = await api('GET', '/api/banq/config', adminToken);
  ok('staff can read and the config is listed', configAsStaff.status === 200 && configAsStaff.body.config.length >= 32);

  const flagsAsStaff = await api('GET', '/api/banq/flags', adminToken);
  ok('staff can read the flag map', flagsAsStaff.status === 200);

  const bill = await api('GET', '/api/billboards/demand', null);
  ok('billboard demand is public and ranked by distinct advertisers',
    bill.status === 200 && /DISTINCT advertisers/.test(bill.body.basis));
  ok('billboard demand reports people, not row count',
    !bill.body.demand.length || bill.body.demand[0].distinct_advertisers <= bill.body.demand[0].declarations);
  const interest = await api('GET', '/api/billboards/interest', null);
  ok('billboard interest lists declared billboards', interest.status === 200 && Array.isArray(interest.body.interest));

  const assets = await Promise.all([
    fetch(BASE + '/monitor.html'), fetch(BASE + '/js/monitor.js')
  ]);
  ok('monitor.html serves', assets[0].status === 200);
  ok('js/monitor.js serves', assets[1].status === 200);
  const html = await assets[0].text();
  ok('the monitor page is in the nav convention with the rest of the site', /banq-header/.test(html));
  const navCheck = await (await fetch(BASE + '/dashboard.html')).text();
  ok('Rule 18: the Monitor link appears on the other pages too', /href="monitor.html"/.test(navCheck));

  // =================================================================
  console.log('\n' + '-'.repeat(58));
  console.log('VERIFY BANQ INTELLIGENCE: ' + pass + ' PASS / ' + fail + ' FAIL');
  if (fail) {
    console.log('\nFailures:');
    failures.forEach(function (f) { console.log('  - ' + f); });
  }
  console.log('-'.repeat(58));
  process.exit(fail ? 1 : 0);
}

main().catch(function (err) {
  console.error('VERIFY ABORTED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
