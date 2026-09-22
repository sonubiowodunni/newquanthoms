/*
 * New Quanthoms Billboard Agency (BANQ)
 * backend/intelligence/core.js -- config, activity log, timeline, access
 *
 * WHY IT EXISTS: 37 steps share four things -- reading banq_config, writing the
 * audit trail, appending to the campaign timeline, and deciding who may see a
 * campaign. Duplicating any of them would mean 37 chances to disagree, so they
 * live here once and every engine imports them.
 *
 * CONFIG RULE (Pre-Step 0.2 / Step 1.7): no threshold, weight or cooldown is
 * hardcoded anywhere. If an engine needs a number it calls cfg(), so changing
 * the value in banq_config changes behaviour without a redeploy.
 */

const { db } = require('../db');

// ------------------------------------------------------------------
// Config
// ------------------------------------------------------------------
function parseValue(row) {
  if (!row) return null;
  const raw = row.config_value;
  if (row.config_type === 'int') return Number(raw);
  if (row.config_type === 'float') return Number(raw);
  if (row.config_type === 'bool') return raw === '1' || raw === 'true';
  if (row.config_type === 'json') {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  return raw;
}

/** Read one config value, with a declared fallback. Never throws on absence. */
async function cfg(key, fallback) {
  const row = (await db.execute({
    sql: `SELECT config_key, config_value, config_type FROM banq_config WHERE config_key = ?`,
    args: [key]
  })).rows[0];
  if (!row) return fallback;
  const v = parseValue(row);
  return v === null ? fallback : v;
}

/** Read many config values in one query, as { key: value }. */
async function cfgAll(keys) {
  const rows = (await db.execute(`SELECT config_key, config_value, config_type FROM banq_config`)).rows;
  const out = {};
  for (const r of rows) out[r.config_key] = parseValue(r);
  if (Array.isArray(keys)) {
    const picked = {};
    for (const k of keys) picked[k] = out[k];
    return picked;
  }
  return out;
}

async function setCfg(key, value, type, description) {
  const existing = (await db.execute({
    sql: `SELECT id, config_type FROM banq_config WHERE config_key = ?`,
    args: [key]
  })).rows[0];
  const raw = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
  const t = type || (existing && existing.config_type) || 'string';
  if (existing) {
    await db.execute({
      sql: `UPDATE banq_config SET config_value = ?, config_type = ?, updated_at = CURRENT_TIMESTAMP WHERE config_key = ?`,
      args: [raw, t, key]
    });
  } else {
    await db.execute({
      sql: `INSERT INTO banq_config (config_key, config_value, config_type, description) VALUES (?, ?, ?, ?)`,
      args: [key, raw, t, description || null]
    });
  }
  return { key, value: raw, type: t };
}

async function listCfg() {
  const rows = (await db.execute(`SELECT * FROM banq_config ORDER BY config_key ASC`)).rows;
  return rows.map(function (r) {
    return {
      key: r.config_key,
      value: parseValue(r),
      raw: r.config_value,
      type: r.config_type,
      description: r.description,
      updated_at: r.updated_at
    };
  });
}

// ------------------------------------------------------------------
// Audit trail (Phase 1 infrastructure + the Security Rules on the spec)
// ------------------------------------------------------------------
async function logActivity(campaignId, actorId, actionType, metadata) {
  try {
    await db.execute({
      sql: `INSERT INTO banq_activity_log (campaign_id, actor_id, action_type, metadata) VALUES (?, ?, ?, ?)`,
      args: [campaignId || null, actorId || null, actionType, metadata ? JSON.stringify(metadata) : null]
    });
  } catch (e) {
    // The audit trail must never take down the action it is recording.
    console.error('[BANQ core] activity log failed:', e.message);
  }
}

/**
 * Append to the campaign timeline. APPEND-ONLY: there is deliberately no
 * update or delete counterpart, because a correctable history is not a record
 * of what happened.
 */
async function timelineAdd(campaignId, eventType, actorType, actorId, metadata) {
  try {
    await db.execute({
      sql: `INSERT INTO campaign_timeline (campaign_id, event_type, actor_type, actor_id, metadata)
            VALUES (?, ?, ?, ?, ?)`,
      args: [campaignId, eventType, actorType || 'SYSTEM', actorId || null, metadata ? JSON.stringify(metadata) : null]
    });
  } catch (e) {
    console.error('[BANQ core] timeline write failed:', e.message);
  }
}

// ------------------------------------------------------------------
// Access control
// ------------------------------------------------------------------
/**
 * BANQ staff = is_admin. Everything else is an ADVERTISER.
 *
 * SECURITY RULE (spec, Phase 1 infrastructure): staff see only opted-in
 * advertisers and assigned campaigns; advertisers see only their own. This
 * returns the role and the campaign row, or null when the caller may not see
 * it -- so a caller cannot forget the check and still get data back.
 */
function roleOf(user) {
  if (!user) return null;
  return user.is_admin ? 'BANQ_STAFF' : 'ADVERTISER';
}

async function campaignFor(user, campaignId) {
  const role = roleOf(user);
  if (!role) return { role: null, campaign: null, allowed: false, reason: 'no_session' };
  const campaign = (await db.execute({
    sql: `SELECT * FROM campaigns WHERE id = ?`,
    args: [Number(campaignId)]
  })).rows[0];
  if (!campaign) return { role, campaign: null, allowed: false, reason: 'not_found' };
  if (role === 'BANQ_STAFF') return { role, campaign, allowed: true, reason: null };
  if (Number(campaign.advertiser_id) !== Number(user.id)) {
    return { role, campaign: null, allowed: false, reason: 'not_yours' };
  }
  return { role, campaign, allowed: true, reason: null };
}

/** Human-readable role name used on notes, per the step 1.1 role list. */
function noteRole(user) {
  return user && user.is_admin ? 'BANQ_ANALYST' : 'ADVERTISER';
}

const NOTE_ROLES = ['ADVERTISER', 'BANQ_ANALYST', 'BANQ_MANAGER', 'QWK_ADMIN'];

// ------------------------------------------------------------------
// Small shared maths helpers
// ------------------------------------------------------------------
function pct(part, whole) {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function safeJson(v, fallback) {
  if (v === null || v === undefined) return fallback;
  try { return JSON.parse(v); } catch (e) { return fallback; }
}

/** SQLite stores 'YYYY-MM-DD HH:MM:SS' in UTC; JS needs the T and the Z. */
function parseDbDate(v) {
  if (!v) return null;
  const d = new Date(String(v).replace(' ', 'T') + (/[Zz]|[+-]\d\d:?\d\d$/.test(String(v)) ? '' : 'Z'));
  return isNaN(d.getTime()) ? null : d;
}

function hoursBetween(a, b) {
  const d1 = parseDbDate(a), d2 = parseDbDate(b);
  if (!d1 || !d2) return null;
  return (d2.getTime() - d1.getTime()) / 3600000;
}

module.exports = {
  cfg, cfgAll, setCfg, listCfg,
  logActivity, timelineAdd,
  roleOf, campaignFor, noteRole, NOTE_ROLES,
  pct, clamp, safeJson, parseDbDate, hoursBetween
};
