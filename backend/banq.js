/*
 * New Quanthoms Billboard Agency (BANQ)
 * backend/banq.js -- the /api/banq/* namespace
 *
 * First resident: the contact form (plan item C3).
 *
 * WHY IT EXISTS: about.html used to show "Message sent" and discard the
 * message. The client now posts here and reports success ONLY when this server
 * has written the row AND queued the notification, so a success message can
 * never outrun the work it claims.
 *
 * Mounted at /api/banq from server.js. Auth is BANQ-local (backend/auth.js);
 * nothing here touches qwkbrowser.
 */

const express = require('express');
const router = express.Router();
const { db } = require('./db');

const RATE_WINDOW_MS = 30 * 1000;      // one message per 30s per IP
const WEBHOOK_TIMEOUT_MS = 5000;
const MAX_NAME = 120;
const MAX_SUBJECT = 200;
const MAX_BODY = 5000;

/** Auth, then require is_admin. Mirrors the shape of requireAuth in auth.js. */
function requireAdmin(req, res, next) {
  const { requireAuth } = require('./auth');
  requireAuth(req, res, function () {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({ error: 'Admin only' });
    }
    next();
  });
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return (req.ip || req.connection && req.connection.remoteAddress || '').replace(/^::ffff:/, '');
}

function looksLikeEmail(v) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || ''));
}

/**
 * Queue the notification. The row is written FIRST, so the queue must contain
 * every message that returns ok:true. Delivery is attempted immediately when a
 * webhook is configured, but a delivery failure does NOT fail the submission:
 * the message is stored and the notification stays queued.
 */
async function enqueueNotification(messageId) {
  const target = process.env.CONTACT_WEBHOOK_URL || process.env.CONTACT_NOTIFY_EMAIL || null;
  const channel = process.env.CONTACT_WEBHOOK_URL ? 'webhook' : 'console';
  await db.execute({
    sql: `INSERT INTO contact_notifications (message_id, channel, target, status) VALUES (?, ?, ?, 'queued')`,
    args: [messageId, channel, target]
  });
  return { channel, target };
}

async function tryDeliver(messageId, message) {
  const url = process.env.CONTACT_WEBHOOK_URL;
  if (!url) {
    // No transport configured. The queue row is the honest record: the
    // notification is pending, not sent, and the admin view shows it.
    return { delivered: false, reason: 'no_transport_configured' };
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), WEBHOOK_TIMEOUT_MS);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'banq-contact', message }),
      signal: ctrl.signal
    });
    clearTimeout(t);
    if (!res.ok) throw new Error('webhook ' + res.status);
    await db.execute({
      sql: `UPDATE contact_notifications SET status='sent', attempts=attempts+1, sent_at=CURRENT_TIMESTAMP
            WHERE message_id = ?`,
      args: [messageId]
    });
    return { delivered: true };
  } catch (err) {
    await db.execute({
      sql: `UPDATE contact_notifications SET status='failed', attempts=attempts+1, last_error=?
            WHERE message_id = ?`,
      args: [String(err.message || err).slice(0, 300), messageId]
    });
    return { delivered: false, reason: String(err.message || err) };
  }
}

// ------------------------------------------------------------------
// POST /api/banq/contact -- public
// ------------------------------------------------------------------
router.post('/contact', async function (req, res) {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim();
    const subject = String(req.body.subject || '').trim();
    const body = String(req.body.message || '').trim();
    const honeypot = String(req.body.website || '').trim();
    const ip = clientIp(req);
    const ua = String(req.headers['user-agent'] || '').slice(0, 300);

    if (!name || !email || !body) {
      return res.status(400).json({ ok: false, error: 'missing_fields', message: 'Name, email and message are required.' });
    }
    if (!looksLikeEmail(email)) {
      return res.status(400).json({ ok: false, error: 'bad_email', message: 'That email address does not look right.' });
    }
    if (name.length > MAX_NAME || subject.length > MAX_SUBJECT || body.length > MAX_BODY) {
      return res.status(400).json({ ok: false, error: 'too_long', message: 'One of the fields is too long.' });
    }

    // Honeypot: only a bot fills a field a human cannot see. Store it as spam
    // and answer exactly like a success, so the bot learns nothing -- but never
    // notify the founder about it.
    if (honeypot) {
      await db.execute({
        sql: `INSERT INTO contact_messages (name, email, subject, body, ip, user_agent, status)
              VALUES (?, ?, ?, ?, ?, ?, 'spam')`,
        args: [name, email, subject, body, ip, ua]
      });
      return res.json({ ok: true, status: 'spam' });
    }

    // Rate limit, checked against the table so it survives a restart.
    const recent = (await db.execute({
      sql: `SELECT created_at FROM contact_messages
            WHERE ip = ? AND status != 'spam' ORDER BY created_at DESC LIMIT 1`,
      args: [ip]
    })).rows[0];
    if (recent && recent.created_at) {
      const age = Date.now() - new Date(String(recent.created_at).replace(' ', 'T') + 'Z').getTime();
      if (age >= 0 && age < RATE_WINDOW_MS) {
        const wait = Math.ceil((RATE_WINDOW_MS - age) / 1000);
        return res.status(429).json({
          ok: false,
          error: 'rate_limited',
          message: 'Please wait ' + wait + 's before sending another message.'
        });
      }
    }

    const inserted = await db.execute({
      sql: `INSERT INTO contact_messages (name, email, subject, body, ip, user_agent, status)
            VALUES (?, ?, ?, ?, ?, ?, 'new')`,
      args: [name, email, subject, body, ip, ua]
    });
    const messageId = Number(inserted.lastInsertRowid);

    // Row written. Now the notification, in that order, on purpose.
    await enqueueNotification(messageId);
    const delivery = await tryDeliver(messageId, { id: messageId, name, email, subject, body });

    return res.json({
      ok: true,
      id: messageId,
      status: 'new',
      notification: delivery.delivered ? 'sent' : 'queued'
    });
  } catch (err) {
    console.error('[BANQ banq] contact error:', err.message);
    return res.status(500).json({ ok: false, error: 'contact_failed', message: 'The message could not be stored. Please email us instead.' });
  }
});

// ------------------------------------------------------------------
// Admin: the message queue
// ------------------------------------------------------------------
router.get('/contact/messages', requireAdmin, async function (req, res) {
  try {
    const status = String(req.query.status || '').trim();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = status
      ? (await db.execute({
          sql: `SELECT * FROM contact_messages WHERE status = ? ORDER BY created_at DESC LIMIT ?`,
          args: [status, limit]
        })).rows
      : (await db.execute({
          sql: `SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT ?`,
          args: [limit]
        })).rows;
    res.json({ ok: true, count: rows.length, messages: rows });
  } catch (err) {
    console.error('[BANQ banq] list error:', err.message);
    res.status(500).json({ ok: false, error: 'list_failed' });
  }
});

router.get('/contact/stats', requireAdmin, async function (req, res) {
  try {
    const rows = (await db.execute({
      sql: `SELECT status, COUNT(*) AS n FROM contact_messages GROUP BY status`
    })).rows;
    const pending = (await db.execute({
      sql: `SELECT COUNT(*) AS n FROM contact_notifications WHERE status != 'sent'`
    })).rows[0];
    const byStatus = {};
    rows.forEach(function (r) { byStatus[r.status] = Number(r.n); });
    res.json({ ok: true, by_status: byStatus, notifications_pending: Number(pending ? pending.n : 0) });
  } catch (err) {
    console.error('[BANQ banq] stats error:', err.message);
    res.status(500).json({ ok: false, error: 'stats_failed' });
  }
});

router.patch('/contact/messages/:id', requireAdmin, async function (req, res) {
  try {
    const id = Number(req.params.id);
    const status = String(req.body.status || '').trim();
    const allowed = ['new', 'read', 'responded', 'spam'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ ok: false, error: 'bad_status', message: 'Status must be one of: ' + allowed.join(', ') });
    }
    await db.execute({
      sql: `UPDATE contact_messages SET status = ? WHERE id = ?`,
      args: [status, id]
    });
    res.json({ ok: true, id: id, status: status });
  } catch (err) {
    console.error('[BANQ banq] update error:', err.message);
    res.status(500).json({ ok: false, error: 'update_failed' });
  }
});

router.delete('/contact/messages/:id', requireAdmin, async function (req, res) {
  try {
    const id = Number(req.params.id);
    await db.execute({ sql: `DELETE FROM contact_notifications WHERE message_id = ?`, args: [id] });
    await db.execute({ sql: `DELETE FROM contact_messages WHERE id = ?`, args: [id] });
    res.json({ ok: true, id: id, deleted: true });
  } catch (err) {
    console.error('[BANQ banq] delete error:', err.message);
    res.status(500).json({ ok: false, error: 'delete_failed' });
  }
});

// Re-attempt queued notifications (admin action). Honest about transport.
router.post('/contact/notifications/retry', requireAdmin, async function (req, res) {
  try {
    const pending = (await db.execute({
      sql: `SELECT n.id AS nid, n.message_id, m.name, m.email, m.subject, m.body
            FROM contact_notifications n
            JOIN contact_messages m ON m.id = n.message_id
            WHERE n.status != 'sent' ORDER BY n.created_at ASC LIMIT 25`
    })).rows;
    if (!process.env.CONTACT_WEBHOOK_URL) {
      return res.json({ ok: true, attempted: 0, note: 'No CONTACT_WEBHOOK_URL configured, so nothing can be delivered yet. ' + pending.length + ' notification(s) remain queued.' });
    }
    let sent = 0;
    for (const row of pending) {
      const out = await tryDeliver(row.message_id, { id: row.message_id, name: row.name, email: row.email, subject: row.subject, body: row.body });
      if (out.delivered) sent++;
    }
    res.json({ ok: true, attempted: pending.length, sent: sent });
  } catch (err) {
    console.error('[BANQ banq] retry error:', err.message);
    res.status(500).json({ ok: false, error: 'retry_failed' });
  }
});

module.exports = { router, requireAdmin };
