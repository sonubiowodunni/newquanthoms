/*
 * New Quanthoms Billboard Agency (BANQ)
 * backend/flags.js -- feature flags (D8 / BANQ-019)
 *
 * THE ECOSYSTEM CONVENTION, which this follows rather than inventing its own:
 * flags default to OFF, so unfinished work is invisible in production until
 * someone deliberately turns it on.
 *
 * A flag is therefore NOT a config value. banq_config holds numbers the engines
 * read; a flag holds a decision about whether a surface exists at all. Keeping
 * them in one table would make "turn the monitoring dashboard on" look like
 * "change a threshold", which is how a half-built page ends up live.
 *
 * Storage: `BANQ_FLAGS` env var (comma list, `+name` to force on, `-name` to
 * force off), then the banq_feature_flags table, then the default. That order
 * means an operator can overrule the database for one boot without a migration.
 */

const { db } = require('./db');

// Every flag, with its default. All false: nothing new is visible until the
// founder says so.
const FLAGS = {
  // QWK ad-package launch flow (the qwkbrowser half, B1-B4).
  ads_new_panel: false,
  // In-app video ad cards (decision 23.9 V2).
  ads_video_cards: false,
  // BANQ AD SERVICE purchase path. Stays off until Stripe is connected, so the
  // gate cannot be opened by a checkout that does not exist.
  banq_service_purchase: false,
  // The monitoring dashboard (G4). Off means the tools have no door yet.
  banq_monitor_dashboard: false,
  // The four Phase 1 monitors as a set.
  banq_phase1_monitor: false,
  banq_phase2_understand: false,
  banq_phase3_learn: false,
  banq_phase4_plan: false,
  // Billboards demand from real declarations (C2).
  billboards_real_demand: false,
  // Feed category filters + banner search (D4 + D5).
  ads_feed_filters: false,
  // Benchmarking, which is privacy-critical and published only when the
  // minimum-campaign threshold is met. Off until there is real volume.
  banq_benchmarking: false,
  // Forecasting and scenario simulation.
  banq_forecasting: false,
  // Enterprise multi-brand dashboard.
  banq_enterprise: false
};

let schemaReady = false;

async function ensureTable() {
  if (schemaReady) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS banq_feature_flags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flag_name TEXT NOT NULL UNIQUE,
      enabled INTEGER DEFAULT 0,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  schemaReady = true;
}

function envOverride() {
  const raw = process.env.BANQ_FLAGS;
  if (!raw) return {};
  const out = {};
  String(raw).split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (token) {
    if (token.startsWith('+')) out[token.slice(1)] = true;
    else if (token.startsWith('-')) out[token.slice(1)] = false;
    else out[token] = true;
  });
  return out;
}

/**
 * Is a flag on? Unknown flags resolve to FALSE rather than throwing, so a typo
 * hides work instead of crashing a page -- the safe direction.
 */
async function isEnabled(name) {
  const env = envOverride();
  if (Object.prototype.hasOwnProperty.call(env, name)) return env[name];
  await ensureTable();
  const row = (await db.execute({
    sql: `SELECT enabled FROM banq_feature_flags WHERE flag_name = ?`,
    args: [String(name)]
  })).rows[0];
  if (row) return Number(row.enabled) === 1;
  return FLAGS[name] === true;
}

async function allFlags() {
  await ensureTable();
  const rows = (await db.execute(`SELECT * FROM banq_feature_flags`)).rows;
  const stored = {};
  rows.forEach(function (r) { stored[r.flag_name] = r; });
  const env = envOverride();
  const out = {};
  Object.keys(FLAGS).forEach(function (name) {
    const forced = Object.prototype.hasOwnProperty.call(env, name);
    const enabled = forced ? env[name] : (stored[name] ? Number(stored[name].enabled) === 1 : FLAGS[name]);
    out[name] = {
      enabled,
      default: FLAGS[name],
      source: forced ? 'env' : (stored[name] ? 'database' : 'default'),
      description: stored[name] ? stored[name].description : null,
      updated_at: stored[name] ? stored[name].updated_at : null
    };
  });
  return out;
}

async function setFlag(name, enabled, description) {
  if (!Object.prototype.hasOwnProperty.call(FLAGS, name)) {
    throw Object.assign(new Error('Unknown flag: ' + name), { code: 400 });
  }
  await ensureTable();
  const existing = (await db.execute({
    sql: `SELECT id FROM banq_feature_flags WHERE flag_name = ?`,
    args: [name]
  })).rows[0];
  if (existing) {
    await db.execute({
      sql: `UPDATE banq_feature_flags SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE flag_name = ?`,
      args: [enabled ? 1 : 0, name]
    });
  } else {
    await db.execute({
      sql: `INSERT INTO banq_feature_flags (flag_name, enabled, description) VALUES (?, ?, ?)`,
      args: [name, enabled ? 1 : 0, description || null]
    });
  }
  return { name, enabled: !!enabled, default: FLAGS[name] };
}

module.exports = { FLAGS, isEnabled, allFlags, setFlag, ensureTable };
