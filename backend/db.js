/*
 * New Quanthoms Billboard Agency (BANQ)
 * backend/db.js -- Database layer (SQLite via @libsql/client)
 *
 * Owns its own database. Not connected to qwkbrowser's database.
 * qwkbrowser is an external API service, not the identity provider.
 */

const { createClient } = require('@libsql/client');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const DB_URL = 'file:' + path.join(__dirname, '..', 'data', 'banq.db');

const db = createClient({ url: DB_URL });

// -- Token hashing (SHA-256, same pattern as qwkbrowser) --
function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// -- Schema init (idempotent -- runs every boot) --
async function init() {
  // Users table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      quanthom_unit INTEGER DEFAULT 0,
      quanthom_credit INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sessions table (token-based auth)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Contact messages (BANQ C3). The about.html form used to claim success and
  // discard the message; this table is where a message actually lands.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_messages(created_at DESC)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_contact_ip ON contact_messages(ip, created_at DESC)`);

  // Notification queue. A message is only reported as accepted once its row is
  // written AND a notification row exists, so "success" never outruns the work.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS contact_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      channel TEXT NOT NULL,
      target TEXT,
      status TEXT DEFAULT 'queued',
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME,
      FOREIGN KEY (message_id) REFERENCES contact_messages(id) ON DELETE CASCADE
    )
  `);

  // Seed admin account (idempotent -- runs every boot)
  const adminAccount = {
    username: 'banqadmin',
    email: 'banqadmin@newquanthoms.local',
    password: 'typetype450'
  };
  const adminExists = (await db.execute({
    sql: `SELECT id FROM users WHERE username = ?`,
    args: [adminAccount.username]
  })).rows[0];

  if (!adminExists) {
    const pwHash = await bcrypt.hash(adminAccount.password, 10);
    await db.execute({
      sql: `INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, 1)`,
      args: [adminAccount.username, adminAccount.email, pwHash]
    });
    console.log('[BANQ] Seeded admin account: ' + adminAccount.username);
  } else {
    // Ensure existing admin has is_admin = 1
    await db.execute({
      sql: `UPDATE users SET is_admin = 1 WHERE username = ? AND is_admin = 0`,
      args: [adminAccount.username]
    });
  }
}

module.exports = { db, init, tokenHash, bcrypt };
