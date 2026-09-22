/*
 * New Quanthoms Billboard Agency (BANQ)
 * backend/banq-intelligence.js -- the /api/banq/* intelligence namespace
 *
 * Mounted at /api/banq alongside backend/banq.js (the contact form). Express
 * allows both because the paths do not overlap.
 *
 * TWO GATES, and it matters which is which:
 *
 * 1. AUTH (requireAuth) -- who you are.
 * 2. ACCESS (service.requireMonitorAccess) -- whether the BANQ service is paid
 *    for this month. Applied to the MONITORING tools only. An advertiser's own
 *    notes, goals and timeline stay reachable without it, because taking away
 *    someone's own data for non-payment is a hostage situation, not a service
 *    boundary.
 *
 * Staff (is_admin) bypass the second gate: they deliver the service.
 *
 * Every route resolves the campaign through core.campaignFor, which is the one
 * place that enforces "advertisers see only their own campaigns".
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('./auth');
const core = require('./intelligence/core');
const p1 = require('./intelligence/phase1');
const p2 = require('./intelligence/phase2');
const p3 = require('./intelligence/phase3');
const p4 = require('./intelligence/phase4');
const service = require('./intelligence/service');
const flags = require('./flags');

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function fail(res, err, fallback) {
  const code = err && err.code ? err.code : 500;
  if (code >= 500) console.error('[BANQ intel]', err && err.message);
  res.status(code).json({ ok: false, error: fallback || 'request_failed', message: err ? err.message : 'Request failed.' });
}

function requireStaff(req, res, next) {
  requireAuth(req, res, function () {
    if (!req.user || !req.user.is_admin) return res.status(403).json({ ok: false, error: 'banq_staff_only' });
    next();
  });
}

/** Resolve a campaign and refuse when the caller may not see it. */
function campaignGuard(paramName) {
  return function (req, res, next) {
    requireAuth(req, res, function () {
      const id = Number(req.params[paramName] || req.query.campaign_id || req.body[paramName] || req.body.campaign_id);
      if (!id) return res.status(400).json({ ok: false, error: 'campaign_id_required' });
      core.campaignFor(req.user, id).then(function (r) {
        if (!r.allowed) {
          const status = r.reason === 'not_found' ? 404 : (r.reason === 'not_yours' ? 403 : 401);
          return res.status(status).json({ ok: false, error: r.reason, message: 'This campaign is not available to you.' });
        }
        req.campaign = r.campaign;
        req.role = r.role;
        next();
      }).catch(function (e) { fail(res, e, 'campaign_lookup_failed'); });
    });
  };
}

// ==================================================================
// Phase gates -- each phase's tools sit behind its own flag AND the service.
// ==================================================================
function phaseGate(flagName) {
  return async function (req, res, next) {
    const on = await flags.isEnabled(flagName);
    if (!on) {
      return res.status(404).json({
        ok: false,
        error: 'phase_not_enabled',
        flag: flagName,
        message: 'This part of BANQ is not switched on yet.'
      });
    }
    next();
  };
}

// ==================================================================
// Service: the $15 month (G3 + G4)
// ==================================================================
router.get('/service', async function (req, res) {
  try {
    res.json({ ok: true, offer: await service.serviceOffer() });
  } catch (err) { fail(res, err, 'service_offer_failed'); }
});

router.get('/service/status', requireAuth, async function (req, res) {
  try {
    if (req.user.is_admin) {
      return res.json({ ok: true, staff: true, allowed: true, offer: await service.serviceOffer() });
    }
    res.json({ ok: true, access: await service.monitorAccess(req.user.id), offer: await service.serviceOffer() });
  } catch (err) { fail(res, err, 'service_status_failed'); }
});

router.post('/service/subscribe', requireAuth, async function (req, res) {
  try {
    // The purchase path is flagged off until a payment rail exists, so this
    // cannot hand out a paid month for free.
    const purchasable = await flags.isEnabled('banq_service_purchase');
    if (!purchasable) {
      return res.status(503).json({
        ok: false,
        error: 'purchase_not_open',
        message: 'BANQ AD SERVICE checkout is not open yet. The fee is $15/month once payment is connected.',
        offer: await service.serviceOffer()
      });
    }
    res.json({ ok: true, subscription: await service.subscribe(req.user.id, req.body, req.user) });
  } catch (err) { fail(res, err, 'subscribe_failed'); }
});

router.post('/service/:id/confirm', requireStaff, async function (req, res) {
  try {
    res.json({ ok: true, subscription: await service.confirmPayment(Number(req.params.id), req.user, req.body.reference) });
  } catch (err) { fail(res, err, 'confirm_failed'); }
});

router.put('/service/:id/status', requireStaff, async function (req, res) {
  try {
    res.json({ ok: true, subscription: await service.setStatus(Number(req.params.id), req.body.status, req.user) });
  } catch (err) { fail(res, err, 'status_failed'); }
});

router.get('/service/subscriptions', requireAuth, async function (req, res) {
  try {
    const id = req.user.is_admin && req.query.advertiser_id ? Number(req.query.advertiser_id) : req.user.id;
    res.json({ ok: true, subscriptions: await service.listSubscriptions(id) });
  } catch (err) { fail(res, err, 'list_failed'); }
});

// ==================================================================
// PHASE 1 -- MONITOR
// ==================================================================
const p1gate = [phaseGate('banq_phase1_monitor'), service.requireMonitorAccess];

// 1.1 notes
router.get('/notes/:campaign_id', campaignGuard('campaign_id'), async function (req, res) {
  try {
    res.json({ ok: true, notes: await p1.listNotes(req.campaign.id, { role: req.role, actorId: req.user.id }) });
  } catch (err) { fail(res, err, 'notes_failed'); }
});
router.post('/notes', async function (req, res) {
  try {
    const r = await core.campaignFor(req.user, req.body.campaign_id);
    if (!r.allowed) return res.status(403).json({ ok: false, error: r.reason });
    res.json({ ok: true, note: await p1.createNote(req.body, req.user) });
  } catch (err) { fail(res, err, 'note_create_failed'); }
});
router.post('/notes/:id/reply', requireAuth, async function (req, res) {
  try {
    res.json({ ok: true, note: await p1.replyToNote(Number(req.params.id), String(req.body.message || ''), req.user) });
  } catch (err) { fail(res, err, 'reply_failed'); }
});

// 1.2 timeline
router.get('/timeline/:campaign_id', campaignGuard('campaign_id'), async function (req, res) {
  try {
    res.json({ ok: true, timeline: await p1.listTimeline(req.campaign.id, { limit: req.query.limit, actorId: req.user.id }) });
  } catch (err) { fail(res, err, 'timeline_failed'); }
});
// Internal POST: other BANQ modules call this; it is not an advertiser API.
router.post('/timeline', async function (req, res) {
  try {
    const r = await core.campaignFor(req.user, req.body.campaign_id);
    if (!r.allowed) return res.status(403).json({ ok: false, error: r.reason });
    await core.timelineAdd(Number(req.body.campaign_id), String(req.body.event_type), String(req.body.actor_type || 'SYSTEM'), req.user.id, req.body.metadata);
    res.json({ ok: true });
  } catch (err) { fail(res, err, 'timeline_write_failed'); }
});

// 1.3 goals
router.get('/goals/:campaign_id', campaignGuard('campaign_id'), async function (req, res) {
  try { res.json({ ok: true, goals: await p1.listGoals(req.campaign.id) }); }
  catch (err) { fail(res, err, 'goals_failed'); }
});
router.post('/goals', async function (req, res) {
  try {
    const r = await core.campaignFor(req.user, req.body.campaign_id);
    if (!r.allowed) return res.status(403).json({ ok: false, error: r.reason });
    res.json({ ok: true, goal: await p1.createGoal(req.body, req.user) });
  } catch (err) { fail(res, err, 'goal_create_failed'); }
});
router.put('/goals/:id', requireAuth, async function (req, res) {
  try { res.json({ ok: true, goal: await p1.updateGoal(Number(req.params.id), req.body, req.user) }); }
  catch (err) { fail(res, err, 'goal_update_failed'); }
});
router.delete('/goals/:id', requireAuth, async function (req, res) {
  try { res.json({ ok: true, goal: await p1.deleteGoal(Number(req.params.id), req.user) }); }
  catch (err) { fail(res, err, 'goal_delete_failed'); }
});

// 1.4 budget pacer -- the monitoring tool, so it is gated.
router.get('/budget-pacer/:campaign_id', campaignGuard('campaign_id'), p1gate, async function (req, res) {
  try { res.json({ ok: true, pacer: await p1.budgetPacer(req.campaign, { actorId: req.user.id }) }); }
  catch (err) { fail(res, err, 'pacer_failed'); }
});

// 1.5 dashboard
router.get('/campaign/:campaign_id', campaignGuard('campaign_id'), p1gate, async function (req, res) {
  try {
    res.json({ ok: true, dashboard: await p1.campaignDashboard(req.campaign, { role: req.role, actorId: req.user.id }) });
  } catch (err) { fail(res, err, 'dashboard_failed'); }
});

router.get('/my-campaigns', requireAuth, async function (req, res) {
  try {
    const { db } = require('./db');
    const which = req.user.is_admin && req.query.advertiser_id ? Number(req.query.advertiser_id) : req.user.id;
    const rows = (await db.execute({
      sql: `SELECT c.*, (SELECT s.score FROM campaign_health_scores s WHERE s.campaign_id = c.id ORDER BY s.calculated_at DESC LIMIT 1) AS health_score,
                   (SELECT s.status FROM campaign_health_scores s WHERE s.campaign_id = c.id ORDER BY s.calculated_at DESC LIMIT 1) AS health_status
            FROM campaigns c WHERE c.advertiser_id = ? ORDER BY c.created_at DESC`,
      args: [which]
    })).rows;
    res.json({ ok: true, campaigns: rows });
  } catch (err) { fail(res, err, 'campaigns_failed'); }
});

// 1.6 BANQ Watch
router.get('/alerts/:campaign_id', campaignGuard('campaign_id'), p1gate, async function (req, res) {
  try { res.json({ ok: true, alerts: await p1.listAlerts(req.campaign.id, { status: req.query.status, severity: req.query.severity, limit: req.query.limit }) }); }
  catch (err) { fail(res, err, 'alerts_failed'); }
});
router.get('/alerts', requireStaff, phaseGate('banq_phase1_monitor'), async function (req, res) {
  try { res.json({ ok: true, alerts: await p1.listAllAlerts({ status: req.query.status, severity: req.query.severity, limit: req.query.limit }) }); }
  catch (err) { fail(res, err, 'alerts_failed'); }
});
router.put('/alerts/:id', requireAuth, async function (req, res) {
  try { res.json({ ok: true, alert: await p1.setAlertStatus(Number(req.params.id), req.body.status, req.user) }); }
  catch (err) { fail(res, err, 'alert_update_failed'); }
});
// Internal: evaluate alerts for one campaign.
router.post('/alerts/check', campaignGuard('campaign_id'), phaseGate('banq_phase1_monitor'), async function (req, res) {
  try { res.json({ ok: true, result: await p1.evaluateAlerts(req.campaign, req.user) }); }
  catch (err) { fail(res, err, 'alert_check_failed'); }
});

// 1.7 health
router.get('/health/:campaign_id', campaignGuard('campaign_id'), p1gate, async function (req, res) {
  try { res.json({ ok: true, health: await p1.calculateHealth(req.campaign, req.user) }); }
  catch (err) { fail(res, err, 'health_failed'); }
});
router.post('/health/:campaign_id/calculate', campaignGuard('campaign_id'), phaseGate('banq_phase1_monitor'), async function (req, res) {
  try { res.json({ ok: true, health: await p1.calculateHealth(req.campaign, req.user) }); }
  catch (err) { fail(res, err, 'health_failed'); }
});
router.get('/health/:campaign_id/history', campaignGuard('campaign_id'), p1gate, async function (req, res) {
  try { res.json({ ok: true, history: await p1.healthHistory(req.campaign.id, req.query.limit) }); }
  catch (err) { fail(res, err, 'health_history_failed'); }
});

// 1.8 report card
router.get('/report/:campaign_id', campaignGuard('campaign_id'), p1gate, async function (req, res) {
  try { res.json({ ok: true, report: await p1.latestReport(req.campaign.id) }); }
  catch (err) { fail(res, err, 'report_failed'); }
});
router.post('/report/generate', campaignGuard('campaign_id'), p1gate, async function (req, res) {
  try { res.json({ ok: true, report: await p1.generateReport(req.campaign, req.body, req.user) }); }
  catch (err) { fail(res, err, 'report_generate_failed'); }
});
router.get('/report/:campaign_id/history', campaignGuard('campaign_id'), p1gate, async function (req, res) {
  try { res.json({ ok: true, reports: await p1.reportHistory(req.campaign.id) }); }
  catch (err) { fail(res, err, 'report_history_failed'); }
});

// Phase 1 infrastructure
router.get('/work-queue', requireStaff, phaseGate('banq_phase1_monitor'), async function (req, res) {
  try { res.json({ ok: true, queue: await p1.workQueue({ only_attention: req.query.only_attention === '1' }) }); }
  catch (err) { fail(res, err, 'work_queue_failed'); }
});
router.get('/notifications', requireAuth, async function (req, res) {
  try { res.json({ ok: true, inbox: await p1.listNotifications(req.user.id, { unread_only: req.query.unread === '1', limit: req.query.limit }) }); }
  catch (err) { fail(res, err, 'notifications_failed'); }
});
router.put('/notifications/:id/read', requireAuth, async function (req, res) {
  try { res.json({ ok: true, notification: await p1.markNotificationRead(Number(req.params.id), req.user.id) }); }
  catch (err) { fail(res, err, 'notification_read_failed'); }
});
router.get('/revenue', requireStaff, async function (req, res) {
  try { res.json({ ok: true, revenue: await p1.revenueSummary({ campaign_id: req.query.campaign_id }) }); }
  catch (err) { fail(res, err, 'revenue_failed'); }
});
router.get('/revenue/:campaign_id', campaignGuard('campaign_id'), async function (req, res) {
  try { res.json({ ok: true, revenue: await p1.revenueSummary({ campaign_id: req.campaign.id }) }); }
  catch (err) { fail(res, err, 'revenue_failed'); }
});
router.post('/revenue', requireStaff, async function (req, res) {
  try { res.json({ ok: true, entry: await p1.recordRevenue(req.body, req.user) }); }
  catch (err) { fail(res, err, 'revenue_record_failed'); }
});

// Admin configuration UI (Step 1.7 infrastructure)
router.get('/config', requireStaff, async function (req, res) {
  try { res.json({ ok: true, config: await core.listCfg() }); }
  catch (err) { fail(res, err, 'config_failed'); }
});
router.put('/config/:key', requireStaff, async function (req, res) {
  try {
    const out = await core.setCfg(req.params.key, req.body.value, req.body.type, req.body.description);
    await core.logActivity(null, req.user.id, 'CONFIG_UPDATED', { key: out.key });
    res.json({ ok: true, config: out });
  } catch (err) { fail(res, err, 'config_write_failed'); }
});

// ==================================================================
// PHASE 2 -- UNDERSTAND
// ==================================================================
const p2gate = [phaseGate('banq_phase2_understand'), service.requireMonitorAccess];

router.get('/creatives/:campaign_id', campaignGuard('campaign_id'), p2gate, async function (req, res) {
  try { res.json({ ok: true, creatives: await p2.listCreatives(req.campaign.id) }); }
  catch (err) { fail(res, err, 'creatives_failed'); }
});
router.post('/creatives', campaignGuard('campaign_id'), p2gate, async function (req, res) {
  try { res.json({ ok: true, creative: await p2.createCreative(req.body, req.user) }); }
  catch (err) { fail(res, err, 'creative_create_failed'); }
});
router.post('/creatives/:id/status', campaignGuard('campaign_id'), p2gate, async function (req, res) {
  try { res.json({ ok: true, creative: await p2.setCreativeStatus(Number(req.params.id), req.body.action, req.user, req.body.reason) }); }
  catch (err) { fail(res, err, 'creative_status_failed'); }
});
router.get('/creatives/:id/status-history', requireAuth, async function (req, res) {
  try { res.json({ ok: true, history: await p2.creativeStatusHistory(Number(req.params.id)) }); }
  catch (err) { fail(res, err, 'status_history_failed'); }
});
router.get('/creatives/:id/metrics', requireAuth, async function (req, res) {
  try { res.json({ ok: true, metrics: await p2.creativeMetrics(Number(req.params.id)) }); }
  catch (err) { fail(res, err, 'creative_metrics_failed'); }
});
router.post('/creatives/:id/metrics', requireStaff, async function (req, res) {
  try { res.json({ ok: true, result: await p2.recordCreativeMetric(Number(req.params.id), req.body.metric_name, req.body.metric_value, req.body.source) }); }
  catch (err) { fail(res, err, 'metric_record_failed'); }
});
router.get('/creatives/:id/score', requireAuth, async function (req, res) {
  try {
    const { db } = require('./db');
    const c = (await db.execute({ sql: `SELECT * FROM ad_creatives WHERE id = ?`, args: [Number(req.params.id)] })).rows[0];
    if (!c) return res.status(404).json({ ok: false, error: 'creative_not_found' });
    const guard = await core.campaignFor(req.user, c.campaign_id);
    if (!guard.allowed) return res.status(403).json({ ok: false, error: guard.reason });
    res.json({ ok: true, score: await p2.creativeScore(c, { actorId: req.user.id }) });
  } catch (err) { fail(res, err, 'creative_score_failed'); }
});
router.get('/creatives/:id/score/history', requireAuth, async function (req, res) {
  try { res.json({ ok: true, history: await p2.creativeScoreHistory(Number(req.params.id), req.query.limit) }); }
  catch (err) { fail(res, err, 'score_history_failed'); }
});

router.get('/what-changed/:campaign_id', campaignGuard('campaign_id'), p2gate, async function (req, res) {
  try { res.json({ ok: true, analysis: await p2.whatChanged(req.campaign, { period: req.query.period, actorId: req.user.id }) }); }
  catch (err) { fail(res, err, 'what_changed_failed'); }
});
router.get('/fatigue/:campaign_id', campaignGuard('campaign_id'), p2gate, async function (req, res) {
  try { res.json({ ok: true, fatigue: await p2.detectFatigue(req.campaign, { actorId: req.user.id }) }); }
  catch (err) { fail(res, err, 'fatigue_failed'); }
});
router.get('/fatigue-events/:campaign_id', campaignGuard('campaign_id'), p2gate, async function (req, res) {
  try { res.json({ ok: true, events: await p2.fatigueEvents(req.campaign.id) }); }
  catch (err) { fail(res, err, 'fatigue_events_failed'); }
});
router.put('/fatigue-events/:id/resolve', requireAuth, async function (req, res) {
  try { res.json({ ok: true, event: await p2.resolveFatigue(Number(req.params.id), req.user) }); }
  catch (err) { fail(res, err, 'fatigue_resolve_failed'); }
});
router.get('/creative-battle/:campaign_id', campaignGuard('campaign_id'), p2gate, async function (req, res) {
  try {
    const ids = req.query.creative_ids ? String(req.query.creative_ids).split(',').map(Number) : null;
    res.json({ ok: true, battle: await p2.creativeBattle(req.campaign, { creative_ids: ids, actorId: req.user.id }) });
  } catch (err) { fail(res, err, 'battle_failed'); }
});
router.get('/recommendations/:campaign_id', campaignGuard('campaign_id'), p2gate, async function (req, res) {
  try { res.json({ ok: true, recommendations: await p2.listRecommendations(req.campaign.id, { status: req.query.status }) }); }
  catch (err) { fail(res, err, 'recommendations_failed'); }
});
router.post('/recommendations', campaignGuard('campaign_id'), p2gate, async function (req, res) {
  try { res.json({ ok: true, recommendation: await p2.createRecommendation(req.body, req.user) }); }
  catch (err) { fail(res, err, 'recommendation_create_failed'); }
});
router.post('/recommendations/:campaign_id/generate', campaignGuard('campaign_id'), p2gate, async function (req, res) {
  try { res.json({ ok: true, generated: await p2.generateRecommendations(req.campaign, req.user) }); }
  catch (err) { fail(res, err, 'recommendation_generate_failed'); }
});
router.put('/recommendations/:id', requireAuth, async function (req, res) {
  try { res.json({ ok: true, recommendation: await p2.setRecommendationStatus(Number(req.params.id), req.body.status, req.user, req.body.note) }); }
  catch (err) { fail(res, err, 'recommendation_update_failed'); }
});
router.get('/recommendations/:id/history', requireAuth, async function (req, res) {
  try { res.json({ ok: true, history: await p2.recommendationHistory(Number(req.params.id)) }); }
  catch (err) { fail(res, err, 'recommendation_history_failed'); }
});
router.get('/action-center/:campaign_id', campaignGuard('campaign_id'), p2gate, async function (req, res) {
  try { res.json({ ok: true, action_center: await p2.actionCenter(req.campaign, { actorId: req.user.id }) }); }
  catch (err) { fail(res, err, 'action_center_failed'); }
});

// ==================================================================
// PHASE 3 -- LEARN
// ==================================================================
const p3gate = [phaseGate('banq_phase3_learn'), service.requireMonitorAccess];

router.post('/journey/sources', requireStaff, phaseGate('banq_phase3_learn'), async function (req, res) {
  try { res.json({ ok: true, source: await p3.registerSource(req.body.source_name, req.body.source_type, req.body.quality_status) }); }
  catch (err) { fail(res, err, 'source_failed'); }
});
router.get('/journey/sources', requireAuth, async function (req, res) {
  try { res.json({ ok: true, sources: await p3.listSources() }); }
  catch (err) { fail(res, err, 'sources_failed'); }
});
router.post('/journey/events', phaseGate('banq_phase3_learn'), async function (req, res) {
  try {
    const guard = await core.campaignFor(req.user, req.body.campaign_id);
    if (!guard.allowed) return res.status(403).json({ ok: false, error: guard.reason });
    res.json({ ok: true, event: await p3.recordJourneyEvent(Object.assign({}, req.body, { advertiser_id: guard.campaign.advertiser_id }), req.user) });
  } catch (err) { fail(res, err, 'journey_event_failed'); }
});
router.get('/journey/events/:campaign_id', campaignGuard('campaign_id'), p3gate, async function (req, res) {
  try { res.json({ ok: true, events: await p3.listJourneyEvents(req.campaign.id, { event_name: req.query.event_name, limit: req.query.limit }) }); }
  catch (err) { fail(res, err, 'journey_events_failed'); }
});
router.get('/journey/configure/:campaign_id', campaignGuard('campaign_id'), async function (req, res) {
  try { res.json({ ok: true, configuration: await p3.getJourneyConfig(req.campaign.id) }); }
  catch (err) { fail(res, err, 'journey_config_failed'); }
});
router.post('/journey/configure', campaignGuard('campaign_id'), async function (req, res) {
  try { res.json({ ok: true, configuration: await p3.saveJourneyConfig(req.body, req.user) }); }
  catch (err) { fail(res, err, 'journey_config_save_failed'); }
});
router.get('/journey/drop-off/:campaign_id', campaignGuard('campaign_id'), p3gate, async function (req, res) {
  try { res.json({ ok: true, drop_off: await p3.dropOff(req.campaign, { actorId: req.user.id }) }); }
  catch (err) { fail(res, err, 'dropoff_failed'); }
});

router.post('/experiments', campaignGuard('campaign_id'), p3gate, async function (req, res) {
  try { res.json({ ok: true, experiment: await p3.createExperiment(req.body, req.user) }); }
  catch (err) { fail(res, err, 'experiment_create_failed'); }
});
router.get('/experiments/:campaign_id', campaignGuard('campaign_id'), p3gate, async function (req, res) {
  try { res.json({ ok: true, experiments: await p3.listExperiments(req.campaign.id) }); }
  catch (err) { fail(res, err, 'experiments_failed'); }
});
router.put('/experiments/:id', requireAuth, async function (req, res) {
  try { res.json({ ok: true, experiment: await p3.setExperimentStatus(Number(req.params.id), req.body.status, req.user) }); }
  catch (err) { fail(res, err, 'experiment_update_failed'); }
});
router.post('/experiments/:id/variants', requireAuth, async function (req, res) {
  try { res.json({ ok: true, variant: await p3.addVariant(Number(req.params.id), req.body, req.user) }); }
  catch (err) { fail(res, err, 'variant_failed'); }
});
router.get('/experiments/:id/results', requireAuth, async function (req, res) {
  try { res.json({ ok: true, results: await p3.experimentResults(Number(req.params.id), req.user) }); }
  catch (err) { fail(res, err, 'experiment_results_failed'); }
});
router.post('/experiments/:id/decision', requireAuth, async function (req, res) {
  try { res.json({ ok: true, decision: await p3.recordExperimentDecision(Number(req.params.id), req.body, req.user) }); }
  catch (err) { fail(res, err, 'experiment_decision_failed'); }
});

router.get('/benchmark/:campaign_id', campaignGuard('campaign_id'), phaseGate('banq_benchmarking'), service.requireMonitorAccess, async function (req, res) {
  try { res.json({ ok: true, benchmark: await p3.benchmarkFor(req.campaign, { group_type: req.query.group_type, actorId: req.user.id }) }); }
  catch (err) { fail(res, err, 'benchmark_failed'); }
});
router.post('/benchmark/groups', requireStaff, async function (req, res) {
  try { res.json({ ok: true, group: await p3.createBenchmarkGroup(req.body.group_type, req.body.criteria) }); }
  catch (err) { fail(res, err, 'benchmark_group_failed'); }
});
router.get('/cross-campaign/:advertiser_id', requireAuth, phaseGate('banq_phase3_learn'), async function (req, res) {
  try {
    const id = Number(req.params.advertiser_id);
    if (!req.user.is_admin && id !== Number(req.user.id)) {
      return res.status(403).json({ ok: false, error: 'not_yours' });
    }
    res.json({ ok: true, insights: await p3.crossCampaignInsights(id, { actorId: req.user.id }) });
  } catch (err) { fail(res, err, 'cross_campaign_failed'); }
});

router.post('/enterprise', requireStaff, phaseGate('banq_enterprise'), async function (req, res) {
  try { res.json({ ok: true, enterprise: await p3.createEnterprise(req.body.name) }); }
  catch (err) { fail(res, err, 'enterprise_create_failed'); }
});
router.post('/enterprise/:id/brands', requireStaff, phaseGate('banq_enterprise'), async function (req, res) {
  try { res.json({ ok: true, brand: await p3.addBrand(Number(req.params.id), req.body) }); }
  catch (err) { fail(res, err, 'brand_failed'); }
});
router.post('/enterprise/:id/members', requireStaff, phaseGate('banq_enterprise'), async function (req, res) {
  try { res.json({ ok: true, member: await p3.addEnterpriseMember(Number(req.params.id), req.body) }); }
  catch (err) { fail(res, err, 'member_failed'); }
});
router.get('/enterprise/:id', requireAuth, phaseGate('banq_enterprise'), async function (req, res) {
  try { res.json({ ok: true, overview: await p3.enterpriseOverview(Number(req.params.id), req.user) }); }
  catch (err) { fail(res, err, 'enterprise_failed'); }
});
router.get('/enterprise/:id/brands', requireAuth, phaseGate('banq_enterprise'), async function (req, res) {
  try {
    const o = await p3.enterpriseOverview(Number(req.params.id), req.user);
    res.json({ ok: true, brands: o.brands, hidden_brand_count: o.hidden_brand_count });
  } catch (err) { fail(res, err, 'brands_failed'); }
});

router.post('/requests', requireAuth, phaseGate('banq_phase3_learn'), async function (req, res) {
  try {
    const advertiserId = req.user.is_admin && req.body.advertiser_id ? Number(req.body.advertiser_id) : req.user.id;
    res.json({ ok: true, request: await p3.createClientRequest(Object.assign({}, req.body, { advertiser_id: advertiserId }), req.user) });
  } catch (err) { fail(res, err, 'request_create_failed'); }
});
router.get('/requests', requireAuth, phaseGate('banq_phase3_learn'), async function (req, res) {
  try {
    const opts = { status: req.query.status };
    if (!req.user.is_admin) opts.advertiser_id = req.user.id;
    else if (req.query.advertiser_id) opts.advertiser_id = Number(req.query.advertiser_id);
    if (req.query.assigned_to) opts.assigned_to = Number(req.query.assigned_to);
    res.json({ ok: true, requests: await p3.listClientRequests(opts) });
  } catch (err) { fail(res, err, 'requests_failed'); }
});
router.put('/requests/:id', requireAuth, phaseGate('banq_phase3_learn'), async function (req, res) {
  try { res.json({ ok: true, request: await p3.updateClientRequest(Number(req.params.id), req.body, req.user) }); }
  catch (err) { fail(res, err, 'request_update_failed'); }
});
router.get('/team-workspace', requireAuth, phaseGate('banq_phase3_learn'), async function (req, res) {
  try { res.json({ ok: true, workspace: await p3.teamWorkspace(req.user, { advertiser_id: req.query.advertiser_id }) }); }
  catch (err) { fail(res, err, 'workspace_failed'); }
});
router.post('/assign', requireStaff, phaseGate('banq_phase3_learn'), async function (req, res) {
  try { res.json({ ok: true, assignment: await p3.assignAnalyst(Number(req.body.campaign_id), Number(req.body.analyst_id), req.user) }); }
  catch (err) { fail(res, err, 'assign_failed'); }
});

// ==================================================================
// PHASE 4 -- PLAN
// ==================================================================
const p4gate = [phaseGate('banq_phase4_plan'), service.requireMonitorAccess];

router.get('/readiness/:campaign_id', campaignGuard('campaign_id'), phaseGate('banq_phase4_plan'), async function (req, res) {
  try {
    const latest = await p4.latestReadiness(req.campaign.id);
    res.json({ ok: true, readiness: latest });
  } catch (err) { fail(res, err, 'readiness_failed'); }
});
router.post('/readiness/:campaign_id/check', campaignGuard('campaign_id'), phaseGate('banq_phase4_plan'), async function (req, res) {
  try { res.json({ ok: true, readiness: await p4.readinessCheck(req.campaign, req.user) }); }
  catch (err) { fail(res, err, 'readiness_check_failed'); }
});

router.post('/plans', requireAuth, phaseGate('banq_phase4_plan'), async function (req, res) {
  try {
    const advertiserId = req.user.is_admin && req.body.advertiser_id ? Number(req.body.advertiser_id) : req.user.id;
    res.json({ ok: true, plan: await p4.createPlan(Object.assign({}, req.body, { advertiser_id: advertiserId }), req.user) });
  } catch (err) { fail(res, err, 'plan_create_failed'); }
});
router.get('/plans/:advertiser_id', requireAuth, phaseGate('banq_phase4_plan'), async function (req, res) {
  try {
    const id = Number(req.params.advertiser_id);
    if (!req.user.is_admin && id !== Number(req.user.id)) return res.status(403).json({ ok: false, error: 'not_yours' });
    res.json({ ok: true, plans: await p4.listPlans(id) });
  } catch (err) { fail(res, err, 'plans_failed'); }
});

router.post('/reports/generate', requireAuth, phaseGate('banq_phase4_plan'), async function (req, res) {
  try {
    if (req.body.campaign_id) {
      const guard = await core.campaignFor(req.user, req.body.campaign_id);
      if (!guard.allowed) return res.status(403).json({ ok: false, error: guard.reason });
    } else if (!req.user.is_admin) {
      req.body.campaign_id = null;
    }
    res.json({ ok: true, report: await p4.generateReport(req.body, req.user) });
  } catch (err) { fail(res, err, 'report_generate_failed'); }
});
router.get('/reports', requireAuth, phaseGate('banq_phase4_plan'), async function (req, res) {
  try {
    res.json({ ok: true, reports: await p4.listReports({ campaign_id: req.query.campaign_id, report_type: req.query.report_type }) });
  } catch (err) { fail(res, err, 'reports_failed'); }
});
router.get('/reports/:id', requireAuth, phaseGate('banq_phase4_plan'), async function (req, res) {
  try { res.json({ ok: true, report: await p4.getReport(Number(req.params.id), req.user) }); }
  catch (err) { fail(res, err, 'report_failed'); }
});

router.post('/placements', requireStaff, phaseGate('banq_phase4_plan'), async function (req, res) {
  try { res.json({ ok: true, placement: await p4.createPlacement(req.body) }); }
  catch (err) { fail(res, err, 'placement_create_failed'); }
});
router.get('/placements', requireAuth, phaseGate('banq_phase4_plan'), async function (req, res) {
  try { res.json({ ok: true, placements: await p4.listPlacements({ region: req.query.region }) }); }
  catch (err) { fail(res, err, 'placements_failed'); }
});
router.get('/placements/compare', requireAuth, phaseGate('banq_phase4_plan'), async function (req, res) {
  try {
    const ids = String(req.query.ids || '').split(',').filter(Boolean).map(Number);
    res.json({ ok: true, comparison: await p4.comparePlacements(ids, req.user) });
  } catch (err) { fail(res, err, 'placement_compare_failed'); }
});

router.get('/predictive-alerts/:campaign_id', campaignGuard('campaign_id'), phaseGate('banq_forecasting'), service.requireMonitorAccess, async function (req, res) {
  try { res.json({ ok: true, alerts: await p4.listPredictiveAlerts(req.campaign.id, { status: req.query.status }) }); }
  catch (err) { fail(res, err, 'predictive_alerts_failed'); }
});
router.post('/predictive-alerts/check', campaignGuard('campaign_id'), phaseGate('banq_forecasting'), async function (req, res) {
  try { res.json({ ok: true, result: await p4.evaluatePredictiveAlerts(req.campaign, req.user) }); }
  catch (err) { fail(res, err, 'predictive_check_failed'); }
});
router.put('/predictive-alerts/:id', requireAuth, phaseGate('banq_forecasting'), async function (req, res) {
  try { res.json({ ok: true, alert: await p4.setPredictiveAlertStatus(Number(req.params.id), req.body.status, req.user) }); }
  catch (err) { fail(res, err, 'predictive_update_failed'); }
});

router.post('/scenarios', requireAuth, phaseGate('banq_forecasting'), async function (req, res) {
  try { res.json({ ok: true, scenario: await p4.createScenario(Number(req.body.plan_id), req.body.variables, req.user) }); }
  catch (err) { fail(res, err, 'scenario_create_failed'); }
});
router.get('/scenarios/:plan_id', requireAuth, phaseGate('banq_forecasting'), async function (req, res) {
  try { res.json({ ok: true, scenarios: await p4.listScenarios(Number(req.params.plan_id)) }); }
  catch (err) { fail(res, err, 'scenarios_failed'); }
});
router.post('/scenarios/:id/simulate', requireAuth, phaseGate('banq_forecasting'), async function (req, res) {
  try { res.json({ ok: true, simulation: await p4.simulateScenario(Number(req.params.id), req.user) }); }
  catch (err) { fail(res, err, 'simulate_failed'); }
});

router.post('/forecasts/:campaign_id', campaignGuard('campaign_id'), phaseGate('banq_forecasting'), async function (req, res) {
  try { res.json({ ok: true, forecast: await p4.generateForecast(req.campaign, req.body.forecast_type, req.user) }); }
  catch (err) { fail(res, err, 'forecast_failed'); }
});
router.get('/forecasts/:campaign_id', campaignGuard('campaign_id'), phaseGate('banq_forecasting'), async function (req, res) {
  try { res.json({ ok: true, forecasts: await p4.listForecasts(req.campaign.id) }); }
  catch (err) { fail(res, err, 'forecasts_failed'); }
});

router.post('/gtm/projects', requireAuth, phaseGate('banq_phase4_plan'), async function (req, res) {
  try {
    const advertiserId = req.user.is_admin && req.body.advertiser_id ? Number(req.body.advertiser_id) : req.user.id;
    res.json({ ok: true, project: await p4.createGtmProject(Object.assign({}, req.body, { advertiser_id: advertiserId }), req.user) });
  } catch (err) { fail(res, err, 'gtm_create_failed'); }
});
router.get('/gtm/projects/:advertiser_id', requireAuth, phaseGate('banq_phase4_plan'), async function (req, res) {
  try {
    const id = Number(req.params.advertiser_id);
    if (!req.user.is_admin && id !== Number(req.user.id)) return res.status(403).json({ ok: false, error: 'not_yours' });
    res.json({ ok: true, projects: await p4.listGtmProjects(id) });
  } catch (err) { fail(res, err, 'gtm_list_failed'); }
});
router.get('/gtm/project/:id', requireAuth, phaseGate('banq_phase4_plan'), async function (req, res) {
  try { res.json({ ok: true, project: await p4.getGtmProject(Number(req.params.id), req.user) }); }
  catch (err) { fail(res, err, 'gtm_project_failed'); }
});
router.post('/gtm/project/:id/tasks', requireAuth, phaseGate('banq_phase4_plan'), async function (req, res) {
  try { res.json({ ok: true, task: await p4.addGtmTask(Number(req.params.id), req.body, req.user) }); }
  catch (err) { fail(res, err, 'gtm_task_failed'); }
});
router.post('/gtm/learning', requireAuth, phaseGate('banq_phase4_plan'), async function (req, res) {
  try {
    const advertiserId = req.user.is_admin && req.body.advertiser_id ? Number(req.body.advertiser_id) : req.user.id;
    res.json({ ok: true, learning: await p4.addLearning(advertiserId, req.body, req.user) });
  } catch (err) { fail(res, err, 'learning_failed'); }
});

// ==================================================================
// Flags (D8) and the feed filters (D4 + D5)
// ==================================================================
router.get('/flags', requireStaff, async function (req, res) {
  try { res.json({ ok: true, flags: await flags.allFlags() }); }
  catch (err) { fail(res, err, 'flags_failed'); }
});
// Public read: the UI needs to know what to show without a staff token.
router.get('/flags/public', async function (req, res) {
  try {
    const all = await flags.allFlags();
    const out = {};
    Object.keys(all).forEach(function (k) { out[k] = all[k].enabled; });
    res.json({ ok: true, flags: out });
  } catch (err) { fail(res, err, 'flags_failed'); }
});
router.put('/flags/:name', requireStaff, async function (req, res) {
  try { res.json({ ok: true, flag: await flags.setFlag(req.params.name, req.body.enabled === true, req.body.description) }); }
  catch (err) { fail(res, err, 'flag_set_failed'); }
});

/**
 * D4 + D5: category filter and banner search over the proxied QWK feed.
 *
 * BANQ does not own this inventory, so the endpoint READS the QWK feed and
 * filters the response. It never writes, and it never caches a mutation it
 * cannot make. When the feed is unreachable the answer says so instead of
 * returning an empty list that looks like "no ads match".
 */
router.get('/ads/search', async function (req, res) {
  try {
    const on = await flags.isEnabled('ads_feed_filters');
    if (!on) {
      return res.status(404).json({ ok: false, error: 'feature_off', flag: 'ads_feed_filters' });
    }
    const q = String(req.query.q || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim().toLowerCase();
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const base = process.env.QWK_API_URL || 'http://localhost:3001';
    let feed = [];
    let upstreamError = null;
    try {
      const r = await fetch(base + '/api/ads/public?limit=' + Math.min(limit * 4, 500), { signal: AbortSignal.timeout(4000) });
      if (!r.ok) throw new Error('upstream ' + r.status);
      const body = await r.json();
      feed = Array.isArray(body) ? body : (body.banners || body.ads || body.items || []);
    } catch (e) {
      upstreamError = String(e.message || e);
    }

    if (upstreamError) {
      return res.json({
        ok: true,
        count: 0,
        results: [],
        state: 'FEED_UNAVAILABLE',
        message: 'The QWK advertising feed could not be reached, so this is not an empty result set. ' + upstreamError
      });
    }

    const categories = {};
    feed.forEach(function (a) {
      const c = String(a.category || a.ad_category || 'uncategorised').toLowerCase();
      categories[c] = (categories[c] || 0) + 1;
    });

    let results = feed;
    if (category) results = results.filter(function (a) { return String(a.category || a.ad_category || 'uncategorised').toLowerCase() === category; });
    if (q) {
      results = results.filter(function (a) {
        return [a.title, a.name, a.description, a.advertiser, a.category, a.url]
          .filter(Boolean).join(' ').toLowerCase().includes(q);
      });
    }

    res.json({
      ok: true,
      query: q || null,
      category: category || null,
      count: results.length,
      total_scanned: feed.length,
      categories: Object.keys(categories).map(function (c) { return { category: c, count: categories[c] }; }),
      results: results.slice(0, limit)
    });
  } catch (err) { fail(res, err, 'ads_search_failed'); }
});

// ==================================================================
// Overview -- the single call the monitoring dashboard makes on load.
// ==================================================================
router.get('/overview', requireAuth, async function (req, res) {
  try {
    const { db } = require('./db');
    const access = req.user.is_admin
      ? { allowed: true, reason: 'banq_staff', staff: true }
      : await service.monitorAccess(req.user.id);

    const advertiserId = req.user.is_admin && req.query.advertiser_id ? Number(req.query.advertiser_id) : req.user.id;
    const campaigns = (await db.execute({
      sql: `SELECT c.*, (SELECT s.score FROM campaign_health_scores s WHERE s.campaign_id = c.id ORDER BY s.calculated_at DESC LIMIT 1) AS health_score,
                   (SELECT s.status FROM campaign_health_scores s WHERE s.campaign_id = c.id ORDER BY s.calculated_at DESC LIMIT 1) AS health_status
            FROM campaigns c WHERE c.advertiser_id = ? ORDER BY c.created_at DESC LIMIT 50`,
      args: [advertiserId]
    })).rows;

    const openAlerts = (await db.execute({
      sql: `SELECT COUNT(*) AS n FROM banq_alerts a
            WHERE a.status = 'NEW' AND a.campaign_id IN (SELECT id FROM campaigns WHERE advertiser_id = ?)`,
      args: [advertiserId]
    })).rows[0];

    const inbox = await p1.listNotifications(advertiserId, { unread_only: true, limit: 10 });

    res.json({
      ok: true,
      access,
      offer: await service.serviceOffer(),
      flags: await flags.allFlags().then(function (f) {
        const o = {};
        Object.keys(f).forEach(function (k) { o[k] = f[k].enabled; });
        return o;
      }),
      advertiser_id: advertiserId,
      campaigns,
      open_alerts: Number(openAlerts ? openAlerts.n : 0),
      notifications: inbox,
      // Stated in the payload so the UI never has to invent an explanation.
      locked_explanation: access.allowed ? null
        : 'Monitoring tools are the $15/month BANQ AD SERVICE. Your campaigns and their basic information remain yours either way.'
    });
  } catch (err) { fail(res, err, 'overview_failed'); }
});

module.exports = { router };
