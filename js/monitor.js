/*
 * New Quanthoms Billboard Agency (BANQ)
 * js/monitor.js -- the campaign monitor (G4)
 *
 * WHAT THIS PAGE IS: the tools the $15 BANQ AD SERVICE month buys. It reads
 * only, it renders only what the server returns, and when the service is not
 * active it shows what the fee unlocks instead of an error -- a locked door
 * should explain itself.
 *
 * TWO THINGS IT DELIBERATELY DOES NOT DO:
 *
 * 1. It never invents a number. Where the server says INSUFFICIENT_DATA or
 *    BENCHMARK NOT AVAILABLE, that sentence is displayed verbatim. A dash or a
 *    zero would be a claim the data does not support.
 *
 * 2. It never presents a 402 as a failure. Payment-required is a real answer,
 *    so it gets a real panel.
 */

(function () {
  'use strict';

  var TABS = ['overview', 'campaign', 'creatives', 'journey', 'plan'];
  var state = { overview: null, campaignId: null, tab: 'overview', data: {} };

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function chip(v) {
    var k = String(v || 'info').toLowerCase().replace(/\s+/g, '_');
    return '<span class="banq-mon-chip ' + esc(k) + '">' + esc(String(v).replace(/_/g, ' ')) + '</span>';
  }

  function money(n) {
    return Number(n || 0).toLocaleString();
  }

  function bar(pct) {
    var p = Math.max(0, Math.min(100, Number(pct) || 0));
    return '<div class="banq-mon-bar"><i style="width:' + p + '%"></i></div>';
  }

  function renderUserArea() {
    var area = document.getElementById('banqUserArea');
    if (!area) return;
    if (BANQ.signedIn()) {
      var user = BANQ.getUser();
      area.innerHTML = '<div class="banq-user-badge"><span>' + esc(user ? (user.username || 'User') : 'User') + '</span></div>' +
        '<button class="banq-signin-btn" id="banqLogoutBtn" style="margin-left:8px">Sign Out</button>';
      document.getElementById('banqLogoutBtn').addEventListener('click', function () { BANQ.logout(); });
    } else {
      area.innerHTML = '<a href="login.html?redirect=monitor.html" class="banq-signin-btn">Sign In</a>';
    }
  }

  // ------------------------------------------------------------------
  // Locked state -- explains the fee instead of showing an error
  // ------------------------------------------------------------------
  function renderLocked(access, offer) {
    var unlocks = (offer.unlocks || []).map(function (u) { return '<li>' + esc(u) + '</li>'; }).join('');
    var why = access.reason === 'not_paid_this_month'
      ? 'Your BANQ AD SERVICE month has ended, so the monitoring tools are locked again. Your campaign data is still yours.'
      : 'BANQ AD SERVICE is not active yet, so the monitoring tools have not been switched on for your account.';

    return '' +
      '<div class="banq-mon-locked">' +
        '<h2>BANQ AD SERVICE</h2>' +
        '<p>' + esc(why) + '</p>' +
        '<div class="banq-mon-fee">$' + esc(offer.fee_usd) + ' <span>/ month &middot; or ' + esc(offer.fee_credits) + ' credits</span></div>' +
        '<p>' + esc(offer.covers) + '</p>' +
        '<ul class="banq-mon-unlocks">' + unlocks + '</ul>' +
        '<p style="font-size:12px;color:var(--muted)">' + esc(offer.does_not_include || '') + '</p>' +
        '<p style="font-size:12px;color:var(--muted)">' + esc(offer.extra_plans_note || '') + '</p>' +
        '<button class="banq-mon-btn" id="banqMonSubscribe">Activate BANQ AD SERVICE</button>' +
        '<div id="banqMonSubscribeNote" class="banq-mon-note-lock" style="margin-top:10px"></div>' +
      '</div>';
  }

  function wireSubscribe() {
    var btn = document.getElementById('banqMonSubscribe');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var note = document.getElementById('banqMonSubscribeNote');
      note.textContent = 'Checking the purchase path...';
      BANQ.fetchJson('/banq/service/subscribe', { method: 'POST', body: JSON.stringify({ plan: 'monitor', currency: 'credits' }) })
        .then(function (r) {
          note.textContent = r.subscription && r.subscription.message ? r.subscription.message : 'Recorded.';
          load();
        })
        .catch(function (err) {
          // The purchase path is deliberately closed until a payment rail
          // exists, so this is an expected answer and it says so plainly.
          note.textContent = (err && err.message) ? err.message : 'The purchase path is not open yet.';
        });
    });
  }

  // ------------------------------------------------------------------
  // Overview
  // ------------------------------------------------------------------
  function renderOverview() {
    var o = state.overview;
    if (!o) return '<div class="banq-empty"><div class="banq-empty-title">No data yet</div></div>';

    var healthy = o.campaigns.filter(function (c) { return c.health_status === 'HEALTHY'; }).length;
    var stats = '' +
      '<div class="banq-mon-stats">' +
        '<div class="banq-mon-stat"><div class="l">Campaigns</div><div class="v">' + o.campaigns.length + '</div></div>' +
        '<div class="banq-mon-stat"><div class="l">Healthy</div><div class="v">' + healthy + '</div></div>' +
        '<div class="banq-mon-stat"><div class="l">Open alerts</div><div class="v">' + o.open_alerts + '</div></div>' +
        '<div class="banq-mon-stat"><div class="l">Unread</div><div class="v">' + (o.notifications ? o.notifications.unread : 0) + '</div></div>' +
      '</div>';

    var rows = o.campaigns.map(function (c) {
      return '<tr>' +
        '<td><a href="#" data-campaign="' + c.id + '" style="color:var(--accent)">' + esc(c.campaign_name) + '</a></td>' +
        '<td>' + esc(c.status) + '</td>' +
        '<td>' + (c.health_score === null || c.health_score === undefined ? '<span class="banq-mon-note-lock">not scored yet</span>' : esc(c.health_score)) + '</td>' +
        '<td>' + chip(c.health_status || 'INSUFFICIENT_DATA') + '</td>' +
        '<td>' + money(c.spent_budget) + ' / ' + money(c.total_budget) + '</td>' +
      '</tr>';
    }).join('');

    var notif = (o.notifications && o.notifications.notifications || []).map(function (n) {
      return '<div class="banq-mon-tl"><span class="t">' + esc(String(n.created_at).slice(0, 16)) + '</span>' + esc(n.message) + '</div>';
    }).join('');

    return stats +
      '<div class="banq-mon-card"><h3>Your campaigns</h3>' +
        '<div class="banq-mon-sub">Only campaigns belonging to this account are shown.</div>' +
        '<table class="banq-mon-table"><thead><tr><th>Campaign</th><th>Status</th><th>Health</th><th>Band</th><th>Spend</th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="5" class="banq-mon-note-lock">No campaigns recorded yet.</td></tr>') + '</tbody></table>' +
      '</div>' +
      '<div class="banq-mon-card"><h3>Notifications</h3>' +
        '<div class="banq-mon-sub">In-app only. Email, push and SMS are architected but not switched on.</div>' +
        (notif || '<div class="banq-mon-note-lock">Nothing unread.</div>') +
      '</div>';
  }

  // ------------------------------------------------------------------
  // Campaign detail -- Phase 1
  // ------------------------------------------------------------------
  function renderCampaign() {
    var d = state.data.campaign;
    if (!d) return '<div class="banq-mon-card"><h3>Select a campaign</h3><div class="banq-mon-sub">Pick one from the Overview tab.</div></div>';

    var h = d.health;
    var p = d.budget;

    var pacerBox = '<div class="banq-mon-card"><h3>Budget pacing</h3>' +
      '<div class="banq-mon-sub">Expected spend accounts for paused periods and for budget changes, so a pause does not read as slow spending.</div>' +
      '<div style="font-family:var(--font-m);font-size:12px;color:var(--text2);line-height:1.9">' +
        'State: ' + chip(p.state) + '<br>' +
        'Expected: ' + money(p.expected_spend) + ' &middot; Actual: ' + money(p.actual_spend) + ' &middot; Remaining: ' + money(p.remaining) +
        (p.pacing_ratio_pct ? '<br>Pacing: ' + esc(p.pacing_ratio_pct) + '% of expected' : '') +
        '<br><span style="color:var(--muted)">' + esc(p.message) + '</span>' +
      '</div></div>';

    var healthBox = '<div class="banq-mon-card"><h3>Health score</h3>' +
      '<div class="banq-mon-sub">Weights come from banq_config, so changing a weight changes the score.</div>' +
      (h.score === null
        ? '<div class="banq-mon-warn">' + esc(h.message || 'INSUFFICIENT_DATA') + '</div>'
        : '<div style="font-family:var(--font-d);font-size:32px;font-weight:800">' + esc(h.score) + ' ' + chip(h.status) + '</div>' +
          '<div style="font-family:var(--font-m);font-size:12px;color:var(--text2);margin-top:8px">' + esc(h.message) + '</div>' +
          Object.keys(h.breakdown || {}).map(function (k) {
            var f = h.breakdown[k];
            if (!f.available) {
              return '<div style="margin-top:12px"><div class="banq-mon-note-lock">' + esc(k.replace(/_/g, ' ')) + ': ' + esc(f.note || 'unavailable') + '</div></div>';
            }
            return '<div style="margin-top:12px"><div style="font-family:var(--font-m);font-size:11px;color:var(--text2)">' +
              esc(k.replace(/_/g, ' ')) + ' &middot; ' + esc(f.score) + '</div>' + bar(f.score) + '</div>';
          }).join('')) +
      '</div>';

    var goalRows = (d.goals || []).map(function (g) {
      return '<tr><td>' + esc(g.goal_type) + '</td><td>' + money(g.current_value) + ' / ' + money(g.target_value) + '</td>' +
        '<td>' + (g.progress_pct === null ? '<span class="banq-mon-note-lock">no target</span>' : esc(g.progress_pct) + '%') + '</td>' +
        '<td>' + (g.note ? '<span class="banq-mon-note-lock">' + esc(g.note) + '</span>' : '') + '</td></tr>';
    }).join('');

    var alertRows = (d.alerts.items || []).map(function (a) {
      return '<tr><td>' + chip(a.severity) + '</td><td>' + esc(a.alert_type.replace(/_/g, ' ')) + '</td>' +
        '<td>' + esc(a.message) + '</td><td>' + chip(a.status) + '</td></tr>';
    }).join('');

    var notes = (d.notes.latest || []).map(function (n) {
      var isInternal = n.visibility === 'INTERNAL_BANQ';
      return '<div class="banq-mon-note' + (isInternal ? ' internal' : '') + '">' +
        '<div class="who">' + esc(n.author_role) + (isInternal ? ' &middot; internal only' : '') + '</div>' +
        '<div class="msg">' + esc(n.message) + '</div></div>';
    }).join('');

    var timeline = (d.timeline || []).map(function (t) {
      return '<div class="banq-mon-tl"><span class="t">' + esc(String(t.timestamp).slice(0, 16)) + '</span>' +
        esc(t.event_type.replace(/_/g, ' ')) + ' <span style="color:var(--muted)">' + esc(t.actor_type) + '</span></div>';
    }).join('');

    var recs = (d.recommendations || []).map(function (r) {
      return '<div class="banq-mon-note"><div class="who">' + esc(r.confidence_level) + ' &middot; ' + esc(r.source) + '</div>' +
        '<div class="msg"><strong>' + esc(r.title) + '</strong><br>' + esc(r.description || '') +
        (r.reason ? '<br><span style="color:var(--muted)">Why: ' + esc(r.reason) + '</span>' : '') + '</div></div>';
    }).join('');

    return '' +
      '<div class="banq-mon-card"><h3>' + esc(d.campaign.campaign_name) + ' ' + chip(d.campaign.status) + '</h3>' +
        '<div class="banq-mon-sub">' + esc(d.campaign.days_remaining) + ' day(s) remaining &middot; source: ' + esc(d.campaign.campaign_source) + '</div>' +
        '<div style="font-family:var(--font-m);font-size:12px;color:var(--text2)">Budget ' + money(d.campaign.total_budget) + ' &middot; Spent ' + money(d.campaign.spent_budget) + '</div>' +
      '</div>' +
      healthBox + pacerBox +
      '<div class="banq-mon-card"><h3>Goals</h3><div class="banq-mon-sub">Unmeasurable goals say so rather than showing a confident zero.</div>' +
        '<table class="banq-mon-table"><thead><tr><th>Goal</th><th>Progress</th><th>%</th><th>Note</th></tr></thead><tbody>' +
        (goalRows || '<tr><td colspan="4" class="banq-mon-note-lock">No goals configured.</td></tr>') + '</tbody></table></div>' +
      '<div class="banq-mon-card"><h3>BANQ Watch</h3><div class="banq-mon-sub">Deduplicated and cooled down using banq_config windows.</div>' +
        '<table class="banq-mon-table"><thead><tr><th>Severity</th><th>Type</th><th>Message</th><th>Status</th></tr></thead><tbody>' +
        (alertRows || '<tr><td colspan="4" class="banq-mon-note-lock">No alerts.</td></tr>') + '</tbody></table>' +
        '<button class="banq-mon-btn ghost" id="banqMonCheckAlerts" style="margin-top:12px">Re-check alerts</button></div>' +
      '<div class="banq-mon-card"><h3>Recommendations</h3>' +
        '<div class="banq-mon-sub">"BANQ recommends considering..." Each one states why it was generated.</div>' +
        (recs || '<div class="banq-mon-note-lock">Nothing open.</div>') +
        '<button class="banq-mon-btn ghost" id="banqMonGenRecs" style="margin-top:12px">Generate recommendations</button></div>' +
      '<div class="banq-mon-card"><h3>BANQ Notes</h3>' +
        '<div class="banq-mon-sub">Internal notes are never returned to an advertiser request.</div>' +
        (notes || '<div class="banq-mon-note-lock">No notes yet.</div>') +
        '<textarea class="banq-mon-input" id="banqMonNoteText" rows="3" placeholder="Add a note to this campaign" style="margin-top:12px"></textarea>' +
        '<button class="banq-mon-btn" id="banqMonAddNote" style="margin-top:10px">Add note</button></div>' +
      '<div class="banq-mon-card"><h3>Timeline</h3>' +
        '<div class="banq-mon-sub">Append-only. Corrections create new events.</div>' +
        (timeline || '<div class="banq-mon-note-lock">No events.</div>') + '</div>' +
      '<div class="banq-mon-card"><h3>Report card</h3>' +
        '<div class="banq-mon-sub">A generated report keeps its snapshot; later corrections do not rewrite it.</div>' +
        '<button class="banq-mon-btn" id="banqMonReport">Generate report</button>' +
        '<div id="banqMonReportOut" style="margin-top:14px"></div></div>';
  }

  // ------------------------------------------------------------------
  // Creatives -- Phase 2
  // ------------------------------------------------------------------
  function renderCreatives() {
    var cr = state.data.creatives;
    var f = state.data.fatigue;
    var b = state.data.battle;
    var w = state.data.whatchanged;
    if (!cr) return '<div class="banq-mon-card"><h3>Select a campaign first</h3></div>';

    var rows = (cr.creatives || []).map(function (c) {
      var s = c.latest_score;
      return '<tr><td>' + esc(c.creative_name) + '</td><td>' + esc(c.creative_type) + '</td>' +
        '<td>' + chip(c.creative_status) + '</td>' +
        '<td>' + (s ? esc(s.score) + ' ' + chip(s.status) : '<span class="banq-mon-note-lock">not scored</span>') + '</td>' +
        '<td>' + esc(c.metrics.impressions || 0) + ' / ' + esc(c.metrics.clicks || 0) + '</td></tr>';
    }).join('');

    var fatigueRows = ((f && f.findings) || []).map(function (x) {
      return '<tr><td>' + esc(x.creative_name) + '</td><td>' + chip(x.state) + '</td><td>' + esc(x.detail) + '</td></tr>';
    }).join('');

    var factors = ((w && w.possible_contributing_factors) || []).map(function (x) {
      return '<div class="banq-mon-tl">' + esc(x.statement) + '</div>';
    }).join('');

    var observed = ((w && w.observed) || []).map(function (x) {
      return '<div class="banq-mon-tl">' + chip(x.direction) + ' ' + esc(x.detail) + '</div>';
    }).join('');

    return '' +
      '<div class="banq-mon-card"><h3>Creative battle</h3>' +
        '<div class="banq-mon-sub">' + esc((b && b.statement) || '') + '</div>' +
        '<div class="banq-mon-note-lock">' + esc((b && b.disclaimer) || '') + '</div></div>' +
      '<div class="banq-mon-card"><h3>Creatives</h3>' +
        '<div class="banq-mon-sub">Scores normalise each factor against a reference rate, then weight it by the campaign goal.</div>' +
        '<table class="banq-mon-table"><thead><tr><th>Creative</th><th>Type</th><th>Status</th><th>Score</th><th>Impr / Clicks</th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="5" class="banq-mon-note-lock">No creatives.</td></tr>') + '</tbody></table></div>' +
      '<div class="banq-mon-card"><h3>Ad fatigue</h3>' +
        '<div class="banq-mon-sub">Decline must be sustained across ' + esc((f && f.consecutive_required) || 3) + ' periods at ' + esc((f && f.threshold_pct) || 15) + '% or more before fatigue is claimed.</div>' +
        '<table class="banq-mon-table"><thead><tr><th>Creative</th><th>State</th><th>Detail</th></tr></thead><tbody>' +
        (fatigueRows || '<tr><td colspan="3" class="banq-mon-note-lock">Nothing to report.</td></tr>') + '</tbody></table></div>' +
      '<div class="banq-mon-card"><h3>What changed</h3>' +
        '<div class="banq-mon-sub">Observed facts and possible contributing factors are kept apart. No causation is claimed.</div>' +
        '<div style="font-family:var(--font-m);font-size:11px;color:var(--muted);margin-bottom:8px">OBSERVED</div>' +
        (observed || '<div class="banq-mon-note-lock">Nothing moved enough to report.</div>') +
        '<div style="font-family:var(--font-m);font-size:11px;color:var(--muted);margin:14px 0 8px">POSSIBLE CONTRIBUTING FACTORS</div>' +
        (factors || '<div class="banq-mon-note-lock">No coinciding events.</div>') +
        (w && w.disclaimer ? '<div class="banq-mon-note-lock" style="margin-top:12px">' + esc(w.disclaimer) + '</div>' : '') +
      '</div>';
  }

  // ------------------------------------------------------------------
  // Journey -- Phase 3
  // ------------------------------------------------------------------
  function renderJourney() {
    var d = state.data.dropoff;
    var e = state.data.experiment;
    var bm = state.data.benchmark;

    if (!d) return '<div class="banq-mon-card"><h3>Select a campaign first</h3></div>';

    var funnel = '';
    if (d.state === 'TRACKING DATA UNAVAILABLE') {
      funnel = '<div class="banq-mon-warn">' + esc(d.message) + '</div>';
    } else {
      var top = 0;
      (d.steps || []).forEach(function (s) { if (s.count && s.count > top) top = s.count; });
      funnel = '<div class="banq-mon-funnel">' + (d.steps || []).map(function (s) {
        var w = top && s.count ? Math.round((s.count / top) * 100) : 0;
        return '<div class="banq-mon-funnel-row">' +
          '<div>' + esc(s.step.replace(/_/g, ' ')) + '</div>' +
          '<div class="banq-mon-funnel-bar"><i style="width:' + w + '%"></i></div>' +
          '<div>' + (s.count === null ? 'not tracked' : money(s.count)) + '</div>' +
          '<div>' + (s.from_previous_pct === null ? '-' : esc(s.from_previous_pct) + '%') + '</div>' +
        '</div>';
      }).join('') + '</div>';
    }

    var exp = '';
    if (e) {
      if (e.state === 'IN_PROGRESS') {
        exp = '<div class="banq-mon-warn">' + esc(e.message) + '<br>' + esc((e.still_needed || []).join(', ')) + '</div>';
      } else {
        exp = (e.comparisons || []).map(function (c) {
          return '<div class="banq-mon-tl">' + chip(c.label) + ' ' + esc(c.statement) +
            (c.language_note ? '<br><span class="banq-mon-note-lock">' + esc(c.language_note) + '</span>' : '') + '</div>';
        }).join('') + '<div class="banq-mon-note-lock" style="margin-top:10px">' + esc(e.note || '') + '</div>';
      }
    } else {
      exp = '<div class="banq-mon-note-lock">No experiment on this campaign.</div>';
    }

    var bench = bm && bm.published && bm.published.length
      ? bm.published.map(function (g) {
          return '<div class="banq-mon-tl">' + esc(g.group_type.replace(/_/g, ' ')) + ' &middot; ' + esc(g.sample_count) +
            ' campaigns' + (g.range ? ' &middot; range ' + esc(g.range.low) + ' to ' + esc(g.range.high) : '') +
            '<br><span class="banq-mon-note-lock">' + esc(g.privacy_note) + '</span></div>';
        }).join('')
      : '<div class="banq-mon-warn">' + esc((bm && bm.message) || 'BENCHMARK NOT AVAILABLE') + '</div>' +
        ((bm && bm.withheld || []).map(function (x) { return '<div class="banq-mon-note-lock">' + esc(x.reason) + '</div>'; }).join(''));

    return '' +
      '<div class="banq-mon-card"><h3>Journey drop-off</h3>' +
        '<div class="banq-mon-sub">' + esc((d.biggest_drop && d.biggest_drop.statement) || '') + '</div>' +
        (d.quality_warning ? '<div class="banq-mon-warn">' + esc(d.quality_warning) + '</div>' : '') +
        (d.mixed_basis_warning ? '<div class="banq-mon-warn">' + esc(d.mixed_basis_warning) + '</div>' : '') +
        funnel + '</div>' +
      '<div class="banq-mon-card"><h3>Experiment results</h3>' +
        '<div class="banq-mon-sub">Results stay withheld until the configured minimum data is met. No winner is declared by the system.</div>' +
        exp + '</div>' +
      '<div class="banq-mon-card"><h3>Benchmarking</h3>' +
        '<div class="banq-mon-sub">Aggregates only. A group below the minimum campaign count is withheld, because a small group identifies its members.</div>' +
        bench + '</div>';
  }

  // ------------------------------------------------------------------
  // Plan -- Phase 4
  // ------------------------------------------------------------------
  function renderPlan() {
    var r = state.data.readiness;
    var p = state.data.predictive;
    var f = state.data.forecast;
    if (!r && !p) return '<div class="banq-mon-card"><h3>Select a campaign first</h3></div>';

    var checks = r && r.checks ? r.checks.map(function (c) {
      return '<tr><td>' + (c.passed ? 'yes' : 'no') + '</td><td>' + esc(c.label) + '</td>' +
        '<td>' + esc(c.detail) + '</td><td>' + (c.blocking ? 'blocking' : 'observation') + '</td></tr>';
    }).join('') : '';

    var preds = ((p && p.alerts) || []).map(function (a) {
      return '<div class="banq-mon-tl">' + chip(a.confidence_level) + ' ' + esc(a.message) +
        '<br><span class="banq-mon-note-lock">' + esc(a.recommended_action || '') + '</span></div>';
    }).join('');

    return '' +
      '<div class="banq-mon-card"><h3>Campaign readiness</h3>' +
        '<div class="banq-mon-sub">Only two items block a launch, and only because they make the campaign technically meaningless. Everything else is an observation you may proceed past.</div>' +
        (r
          ? '<div style="font-family:var(--font-d);font-size:28px;font-weight:800">' + esc(r.score) + ' ' + chip(r.state) + '</div>' +
            '<div class="banq-mon-note-lock" style="margin:8px 0 14px">' + esc(r.override_note || '') + '</div>' +
            '<table class="banq-mon-table"><thead><tr><th>Pass</th><th>Check</th><th>Detail</th><th>Kind</th></tr></thead><tbody>' + checks + '</tbody></table>' +
            '<button class="banq-mon-btn" id="banqMonReadiness" style="margin-top:12px">Re-run readiness check</button>'
          : '<div class="banq-mon-note-lock">No readiness check has been run for this campaign.</div>' +
            '<button class="banq-mon-btn" id="banqMonReadiness" style="margin-top:12px">Run readiness check</button>') +
      '</div>' +
      '<div class="banq-mon-card"><h3>Predictive alerts</h3>' +
        '<div class="banq-mon-sub">Cautious language: what may happen, with the inputs behind it. Every prediction can be dismissed.</div>' +
        (preds || '<div class="banq-mon-note-lock">No prediction is currently active.</div>') +
        '<button class="banq-mon-btn ghost" id="banqMonPredict" style="margin-top:12px">Re-evaluate predictions</button></div>' +
      '<div class="banq-mon-card"><h3>Forecast</h3>' +
        '<div class="banq-mon-sub">Stamped with its model version and its inputs, so a past forecast stays reproducible. Shown as a range, never a single certain number.</div>' +
        (f
          ? '<div style="font-family:var(--font-m);font-size:12px;color:var(--text2)">' + esc(f.forecast_range) +
            '<br><span class="banq-mon-note-lock">' + chip(f.confidence_level) + ' &middot; model ' + esc(f.model_version) + '</span></div>'
          : '<div class="banq-mon-note-lock">No forecast generated yet.</div>') +
        '<button class="banq-mon-btn" id="banqMonForecast" style="margin-top:12px">Generate forecast</button></div>';
  }

  // ------------------------------------------------------------------
  // Shell
  // ------------------------------------------------------------------
  function render() {
    var host = document.getElementById('banqMonContent');
    var o = state.overview;
    if (!o) return;

    if (!o.access.allowed) {
      host.innerHTML = renderLocked(o.access, o.offer);
      wireSubscribe();
      return;
    }

    var tabs = TABS.map(function (t) {
      return '<button class="banq-mon-tab' + (state.tab === t ? ' active' : '') + '" data-tab="' + t + '">' +
        t.charAt(0).toUpperCase() + t.slice(1) + '</button>';
    }).join('');

    var body = { overview: renderOverview, campaign: renderCampaign, creatives: renderCreatives, journey: renderJourney, plan: renderPlan }[state.tab]();

    var banner = '';
    if (o.access.staff) {
      banner = '<div class="banq-mon-card"><h3>BANQ staff view</h3><div class="banq-mon-sub">Staff see the same panels without the service gate, because they deliver the service.</div></div>';
    } else if (o.access.subscription) {
      var s = o.access.subscription;
      banner = '<div class="banq-mon-card"><h3>BANQ AD SERVICE active</h3>' +
        '<div class="banq-mon-sub">' + esc(s.plan) + ' &middot; ' + esc(s.days_left) + ' day(s) left this month &middot; ' + esc(o.offer.covers) + '</div></div>';
    }

    host.innerHTML = banner + '<div class="banq-mon-tabs">' + tabs + '</div><div class="banq-mon-panel active">' + body + '</div>';
    wire();
  }

  function wire() {
    document.querySelectorAll('.banq-mon-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        state.tab = b.getAttribute('data-tab');
        render();
      });
    });
    document.querySelectorAll('[data-campaign]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        state.campaignId = Number(a.getAttribute('data-campaign'));
        state.tab = 'campaign';
        loadCampaign().then(render);
      });
    });

    var addNote = document.getElementById('banqMonAddNote');
    if (addNote) addNote.addEventListener('click', function () {
      var text = document.getElementById('banqMonNoteText').value;
      if (!text.trim()) { BANQ.toast('A note needs a message.', 'error'); return; }
      BANQ.fetchJson('/banq/notes', { method: 'POST', body: JSON.stringify({ campaign_id: state.campaignId, message: text }) })
        .then(function () { BANQ.toast('Note added.', 'success'); return loadCampaign(); })
        .then(render)
        .catch(function (err) { BANQ.toast(err.message || 'Could not add the note.', 'error'); });
    });

    var checkAlerts = document.getElementById('banqMonCheckAlerts');
    if (checkAlerts) checkAlerts.addEventListener('click', function () {
      BANQ.fetchJson('/banq/alerts/check', { method: 'POST', body: JSON.stringify({ campaign_id: state.campaignId }) })
        .then(function (r) {
          BANQ.toast('Evaluated ' + r.result.evaluated + ', created ' + r.result.created.length + ', blocked ' + r.result.blocked.length + '.', 'info');
          return loadCampaign();
        }).then(render)
        .catch(function (err) { BANQ.toast(err.message || 'Check failed.', 'error'); });
    });

    var gen = document.getElementById('banqMonGenRecs');
    if (gen) gen.addEventListener('click', function () {
      BANQ.fetchJson('/banq/recommendations/' + state.campaignId + '/generate', { method: 'POST', body: '{}' })
        .then(function (r) { BANQ.toast('Proposed ' + r.generated.proposed + ', created ' + r.generated.created.length + '.', 'info'); return loadCampaign(); })
        .then(render)
        .catch(function (err) { BANQ.toast(err.message || 'Generation failed.', 'error'); });
    });

    var rep = document.getElementById('banqMonReport');
    if (rep) rep.addEventListener('click', function () {
      BANQ.fetchJson('/banq/report/generate', { method: 'POST', body: JSON.stringify({ campaign_id: state.campaignId, report_type: 'Campaign Summary' }) })
        .then(function (r) {
          var s = r.report.snapshot;
          document.getElementById('banqMonReportOut').innerHTML =
            '<div class="banq-mon-note"><div class="who">' + esc(s.overall_result) + ' &middot; report #' + esc(r.report.id) + '</div>' +
            '<div class="msg">' + esc(s.key_finding) + '<br><strong>' + esc(s.recommendation) + '</strong>' +
            '<br><span class="banq-mon-note-lock">Best day: ' + esc(s.best_day && s.best_day.date ? s.best_day.date : 'not enough data') +
            ' &middot; items needing attention: ' + esc(s.items_requiring_attention) + '</span></div></div>';
        })
        .catch(function (err) { BANQ.toast(err.message || 'Report failed.', 'error'); });
    });

    var rd = document.getElementById('banqMonReadiness');
    if (rd) rd.addEventListener('click', function () {
      BANQ.fetchJson('/banq/readiness/' + state.campaignId + '/check', { method: 'POST', body: '{}' })
        .then(function (r) { state.data.readiness = r.readiness; render(); })
        .catch(function (err) { BANQ.toast(err.message || 'Readiness failed.', 'error'); });
    });

    var pd = document.getElementById('banqMonPredict');
    if (pd) pd.addEventListener('click', function () {
      BANQ.fetchJson('/banq/predictive-alerts/check', { method: 'POST', body: JSON.stringify({ campaign_id: state.campaignId }) })
        .then(function () { return loadCampaign(); }).then(render)
        .catch(function (err) { BANQ.toast(err.message || 'Prediction failed.', 'error'); });
    });

    var fc = document.getElementById('banqMonForecast');
    if (fc) fc.addEventListener('click', function () {
      BANQ.fetchJson('/banq/forecasts/' + state.campaignId, { method: 'POST', body: '{}' })
        .then(function (r) { state.data.forecast = r.forecast; render(); })
        .catch(function (err) { BANQ.toast(err.message || 'Forecast failed.', 'error'); });
    });
  }

  // ------------------------------------------------------------------
  // Loading
  // ------------------------------------------------------------------
  function load() {
    return BANQ.fetchJson('/banq/overview')
      .then(function (r) {
        state.overview = r;
        if (!r.campaigns.length) return null;
        var first = r.campaigns.find(function (c) { return c.status === 'active'; }) || r.campaigns[0];
        state.campaignId = state.campaignId || first.id;
        if (!r.access.allowed) return null;
        return loadCampaign();
      })
      .then(render)
      .catch(function (err) {
        document.getElementById('banqMonContent').innerHTML =
          '<div class="banq-mon-card"><h3>Could not load the monitor</h3>' +
          '<div class="banq-mon-sub">' + esc(err.message || 'Unexpected error.') + '</div></div>';
      });
  }

  function loadCampaign() {
    if (!state.campaignId) return Promise.resolve();
    var id = state.campaignId;
    function safe(path, key, isPost) {
      return BANQ.fetchJson(path, isPost ? { method: 'POST', body: '{}' } : undefined)
        .then(function (r) { state.data[key] = r; })
        .catch(function (err) { state.data[key] = { error: err.message || 'unavailable' }; });
    }
    return Promise.all([
      safe('/banq/campaign/' + id, 'campaign'),
      safe('/banq/creatives/' + id, 'creatives'),
      safe('/banq/fatigue/' + id, 'fatigue'),
      safe('/banq/creative-battle/' + id, 'battle'),
      safe('/banq/what-changed/' + id + '?period=7d', 'whatchanged'),
      safe('/banq/journey/drop-off/' + id, 'dropoff'),
      safe('/banq/benchmark/' + id, 'benchmark'),
      safe('/banq/readiness/' + id, 'readiness'),
      safe('/banq/predictive-alerts/' + id, 'predictive'),
      safe('/banq/forecasts/' + id, 'forecastList')
    ]).then(function () {
      // Experiment results need an id, which the campaign payload does not carry.
      return BANQ.fetchJson('/banq/experiments/' + id).then(function (r) {
        var first = (r.experiments || [])[0];
        if (!first) { state.data.experiment = null; return; }
        return BANQ.fetchJson('/banq/experiments/' + first.id + '/results')
          .then(function (res) { state.data.experiment = res.results; })
          .catch(function () { state.data.experiment = null; });
      }).catch(function () { state.data.experiment = null; });
    }).then(function () {
      // The newest stored forecast is what the Plan tab shows until a new one is
      // generated, so the panel is never blank when history exists.
      if (state.data.forecastList && state.data.forecastList.forecasts && state.data.forecastList.forecasts.length) {
        state.data.forecast = state.data.forecastList.forecasts[0];
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderUserArea();
    if (!BANQ.signedIn()) {
      document.getElementById('banqMonContent').innerHTML =
        '<div class="banq-empty"><div class="banq-empty-title">Sign in to see your campaign monitor</div>' +
        '<div class="banq-empty-desc">The monitor shows your campaigns, their health, and what BANQ recommends. ' +
        '<a href="login.html?redirect=monitor.html" style="color:var(--accent)">Sign in</a>.</div></div>';
      return;
    }
    load();
  });

})();
