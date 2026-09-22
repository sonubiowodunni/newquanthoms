/*
 * New Quanthoms Billboard Agency (BANQ)
 * backend/load-env.js -- minimal .env loader (no dependency)
 *
 * WHY THIS EXISTS: this repo has always shipped a .env -- and the server never
 * read it. Nothing loaded it, dotenv is not a dependency, and the code simply
 * fell back to its defaults (PORT 3002, QWK_API_URL http://localhost:3001), so
 * everything appeared to work. That is a trap: an operator editing .env to
 * point at a real QwkBrowser host, or to set the shared identity secret, would
 * change nothing and have no way to tell. The BANQ_SSO_SECRET that the identity
 * bridge needs is exactly that kind of setting.
 *
 * RULES
 *   - Real environment variables WIN. .env only fills gaps, so a shell export
 *     or a process manager's config is never silently overridden by a file.
 *   - Values are never logged. Only the count of keys loaded.
 *   - Missing .env is not an error (defaults are still honest for local dev).
 *
 * ASCII-only (Rule 16).
 */

const fs = require('fs');
const path = require('path');

function parseEnv(text) {
  const out = {};
  String(text || '').split(/\r?\n/).forEach(function (line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip one layer of matching quotes, if present.
    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        value = value.slice(1, -1);
      }
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) out[key] = value;
  });
  return out;
}

function load(envPath) {
  const file = envPath || path.join(__dirname, '..', '.env');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return { loaded: 0, file: file, present: false };
  }
  const parsed = parseEnv(text);
  let loaded = 0;
  Object.keys(parsed).forEach(function (key) {
    if (process.env[key] === undefined) {
      process.env[key] = parsed[key];
      loaded++;
    }
  });
  return { loaded: loaded, file: file, present: true };
}

module.exports = { load: load, parseEnv: parseEnv };
