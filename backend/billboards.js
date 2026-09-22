/*
 * New Quanthoms Billboard Agency (BANQ)
 * backend/billboards.js -- billboard declarations (C2 / BANQ-009)
 *
 * WHY IT EXISTS: billboards.html has a sidebar and a demand table that have
 * always been placeholder data. "Declare" was a button that went nowhere, so
 * the demand the page claims to show was decorative.
 *
 * THREE ENDPOINTS, from NEEDED BACKEND section 1:
 *
 *   POST /declare   -- an advertiser declares where they want to be seen
 *   GET  /interest  -- per billboard: how many declarations, from how many
 *                      distinct advertisers
 *   GET  /demand    -- the ranked list the sidebar reads
 *
 * The distinction that matters is INTEREST vs DEMAND. One advertiser declaring
 * a billboard ten times is interest. Ten advertisers declaring it once is
 * demand. So the ranking is by DISTINCT advertisers, never by row count --
 * otherwise a single enthusiastic user could make a billboard look sold out.
 */

const express = require('express');
const router = express.Router();
const { db } = require('./db');
const { requireAuth } = require('./auth');

const DECLARATION_STATES = ['INTERESTED', 'COMMITTED', 'WITHDRAWN'];
const BILLBOARD_REGIONS = ['LOCAL', 'NATIONAL', 'INTERNATIONAL'];

function requireAdmin(req, res, next) {
  requireAuth(req, res, function () {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({ ok: false, error: 'admin_only' });
    }
    next();
  });
}

async function ensureTables() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS billboard_declarations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      advertiser_id INTEGER NOT NULL,
      billboard_key TEXT NOT NULL,
      billboard_region TEXT,
      campaign_id INTEGER,
      note TEXT,
      state TEXT DEFAULT 'INTERESTED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (advertiser_id) REFERENCES users(id)
    )
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_decl_billboard ON billboard_declarations(billboard_key, state)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_decl_advertiser ON billboard_declarations(advertiser_id)');
}

// ------------------------------------------------------------------
// POST /api/billboards/declare
// ------------------------------------------------------------------
router.post('/declare', requireAuth, async function (req, res) {
  try {
    await ensureTables();
    const key = String(req.body.billboard_key || '').trim();
    if (!key) {
      return res.status(400).json({ ok: false, error: 'billboard_key_required', message: 'Which billboard are you declaring interest in?' });
    }
    const region = String(req.body.billboard_region || '').toUpperCase();
    const state = String(req.body.state || 'INTERESTED').toUpperCase();
    if (!DECLARATION_STATES.includes(state)) {
      return res.status(400).json({ ok: false, error: 'bad_state', message: 'State must be one of: ' + DECLARATION_STATES.join(', ') });
    }

    // One live declaration per advertiser per billboard. Declaring again
    // updates the existing row instead of stacking, so a repeated click cannot
    // inflate demand.
    const existing = (await db.execute({
      sql: `SELECT id FROM billboard_declarations WHERE advertiser_id = ? AND billboard_key = ? AND state != 'WITHDRAWN' LIMIT 1`,
      args: [req.user.id, key]
    })).rows[0];

    if (existing) {
      await db.execute({
        sql: `UPDATE billboard_declarations SET state = ?, billboard_region = ?, note = ?, campaign_id = ? WHERE id = ?`,
        args: [state, region || null, req.body.note || null, req.body.campaign_id ? Number(req.body.campaign_id) : null, existing.id]
      });
      return res.json({
        ok: true, id: existing.id, updated: true, state,
        message: 'Your declaration for ' + key + ' has been updated. You are still counted once.'
      });
    }

    const ins = await db.execute({
      sql: `INSERT INTO billboard_declarations (advertiser_id, billboard_key, billboard_region, campaign_id, note, state)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [req.user.id, key, region || null, req.body.campaign_id ? Number(req.body.campaign_id) : null,
        req.body.note || null, state]
    });
    res.json({
      ok: true,
      id: Number(ins.lastInsertRowid),
      billboard_key: key,
      state,
      message: 'Declaration recorded. This now counts toward real demand for ' + key + '.'
    });
  } catch (err) {
    console.error('[BANQ billboards] declare failed:', err.message);
    res.status(500).json({ ok: false, error: 'declare_failed' });
  }
});

// ------------------------------------------------------------------
// GET /api/billboards/interest
// ------------------------------------------------------------------
router.get('/interest', async function (req, res) {
  try {
    await ensureTables();
    const rows = (await db.execute({
      sql: `SELECT billboard_key,
                   COUNT(DISTINCT advertiser_id) AS advertisers,
                   COUNT(*) AS declarations,
                   SUM(CASE WHEN state = 'COMMITTED' THEN 1 ELSE 0 END) AS committed
            FROM billboard_declarations
            WHERE state != 'WITHDRAWN'
            GROUP BY billboard_key
            ORDER BY advertisers DESC, billboard_key ASC`
    })).rows;
    res.json({
      ok: true,
      count: rows.length,
      interest: rows.map(function (r) {
        return {
          billboard_key: r.billboard_key,
          distinct_advertisers: Number(r.advertisers),
          declarations: Number(r.declarations),
          committed: Number(r.committed || 0),
          // The honest reading: interest is people, not clicks.
          reading: Number(r.advertisers) + ' advertiser(s) have declared interest'
        };
      })
    });
  } catch (err) {
    console.error('[BANQ billboards] interest failed:', err.message);
    res.status(500).json({ ok: false, error: 'interest_failed' });
  }
});

// ------------------------------------------------------------------
// GET /api/billboards/demand
// ------------------------------------------------------------------
router.get('/demand', async function (req, res) {
  try {
    await ensureTables();
    const rows = (await db.execute({
      sql: `SELECT billboard_key, billboard_region,
                   COUNT(DISTINCT advertiser_id) AS advertisers,
                   COUNT(*) AS declarations,
                   MIN(created_at) AS first_declared_at,
                   MAX(created_at) AS last_declared_at
            FROM billboard_declarations
            WHERE state != 'WITHDRAWN'
            GROUP BY billboard_key, billboard_region
            ORDER BY advertisers DESC, last_declared_at DESC`
    })).rows;

    const demand = rows.map(function (r, i) {
      return {
        rank: i + 1,
        billboard_key: r.billboard_key,
        billboard_region: r.billboard_region,
        distinct_advertisers: Number(r.advertisers),
        declarations: Number(r.declarations),
        first_declared_at: r.first_declared_at,
        last_declared_at: r.last_declared_at
      };
    });

    // With no declarations yet the page must say so rather than render an
    // empty table that looks like zero demand.
    res.json({
      ok: true,
      count: demand.length,
      basis: 'Ranked by DISTINCT advertisers. One advertiser declaring repeatedly is interest, not demand.',
      demand,
      empty_state: demand.length ? null : 'No declarations have been made yet, so there is no measured demand to rank.'
    });
  } catch (err) {
    console.error('[BANQ billboards] demand failed:', err.message);
    res.status(500).json({ ok: false, error: 'demand_failed' });
  }
});

// Withdraw your own declaration.
router.delete('/declare', requireAuth, async function (req, res) {
  try {
    await ensureTables();
    const key = String(req.query.billboard_key || req.body.billboard_key || '').trim();
    if (!key) return res.status(400).json({ ok: false, error: 'billboard_key_required' });
    await db.execute({
      sql: `UPDATE billboard_declarations SET state = 'WITHDRAWN' WHERE advertiser_id = ? AND billboard_key = ? AND state != 'WITHDRAWN'`,
      args: [req.user.id, key]
    });
    res.json({ ok: true, billboard_key: key, state: 'WITHDRAWN' });
  } catch (err) {
    console.error('[BANQ billboards] withdraw failed:', err.message);
    res.status(500).json({ ok: false, error: 'withdraw_failed' });
  }
});

router.get('/declarations/me', requireAuth, async function (req, res) {
  try {
    await ensureTables();
    const rows = (await db.execute({
      sql: `SELECT * FROM billboard_declarations WHERE advertiser_id = ? ORDER BY created_at DESC`,
      args: [req.user.id]
    })).rows;
    res.json({ ok: true, count: rows.length, declarations: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'list_failed' });
  }
});

// Staff-only raw view, for auditing the aggregates against the rows.
router.get('/admin/all', requireAdmin, async function (req, res) {
  try {
    await ensureTables();
    const rows = (await db.execute({
      sql: `SELECT d.*, u.username FROM billboard_declarations d
            LEFT JOIN users u ON u.id = d.advertiser_id
            ORDER BY d.created_at DESC LIMIT 500`
    })).rows;
    res.json({ ok: true, count: rows.length, declarations: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'admin_list_failed' });
  }
});

module.exports = { router, ensureTables, DECLARATION_STATES, BILLBOARD_REGIONS };
