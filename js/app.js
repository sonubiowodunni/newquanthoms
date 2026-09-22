/*
 * New Quanthoms Billboard Agency (BANQ)
 * js/app.js -- API helpers, auth, token management
 *
 * Content feed is PUBLIC (no auth needed to view).
 * Auth required only for earning rewards (click/dwell).
 */

(function() {
  'use strict';

  var BANQ = window.BANQ = window.BANQ || {};

  // -- API base (auth is local, ads/profile proxied to QWK backend) --
  BANQ.API_BASE = window.location.origin + '/api';

  // -- Token management (BANQ-local, not shared with qwkbrowser) --
  BANQ.getToken = function() {
    return localStorage.getItem('banq_token') || '';
  };

  BANQ.setToken = function(token) {
    localStorage.setItem('banq_token', token);
  };

  BANQ.clearToken = function() {
    localStorage.removeItem('banq_token');
    localStorage.removeItem('banq_user');
  };

  BANQ.getUser = function() {
    try {
      return JSON.parse(localStorage.getItem('banq_user') || 'null');
    } catch (e) {
      return null;
    }
  };

  BANQ.setUser = function(user) {
    localStorage.setItem('banq_user', JSON.stringify(user));
  };

  BANQ.signedIn = function() {
    return !!BANQ.getToken();
  };

  // -- API helpers --
  BANQ.fetchJson = function(path, options) {
    options = options || {};
    var headers = { 'Content-Type': 'application/json' };
    var token = BANQ.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    options.headers = Object.assign({}, headers, options.headers || {});
    return fetch(BANQ.API_BASE + path, options).then(function(res) {
      if (res.status === 401) {
        BANQ.clearToken();
        if (window.location.pathname !== '/login.html') {
          window.location.href = '/login.html';
        }
        throw { status: 401, message: 'Unauthorized' };
      }
      return res.json().then(function(data) {
        if (!res.ok) throw Object.assign({ status: res.status }, data);
        return data;
      });
    });
  };

  /* -- Calls that leave BANQ for QwkBrowser (proxied /ads/*, /profile/*) --
   *
   * WHY THIS IS NOT fetchJson: fetchJson treats a 401 as "the BANQ session is
   * over" -- it clears banq_token and redirects to the login page. That is
   * right for a BANQ route and WRONG for a QwkBrowser one, because those two
   * 401s mean completely different things:
   *
   *   BANQ  401 -> this person's BANQ session expired. Sign them out.
   *   QWK   401 -> QwkBrowser does not accept a BANQ token. The BANQ session
   *                is perfectly valid; the partner reward bridge simply is not
   *                open yet.
   *
   * With qwkFetch aliased to fetchJson, clicking a banner signed the person
   * OUT: the QWK 401 wiped their session and bounced them to login.html. From
   * the outside that looks exactly like "the login doesn't work" -- you sign
   * in, touch anything, and you are back at the sign-in page.
   *
   * So: never clear the session here. Surface the real reason instead.
   */
  BANQ.qwkFetch = function(path, options) {
    options = options || {};
    var headers = { 'Content-Type': 'application/json' };
    var token = BANQ.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    options.headers = Object.assign({}, headers, options.headers || {});
    return fetch(BANQ.API_BASE + path, options).then(function(res) {
      return res.json().catch(function() { return {}; }).then(function(data) {
        if (!res.ok) {
          throw Object.assign({ status: res.status }, data, {
            // One plain sentence for the UI, derived from what actually
            // happened rather than a generic "something went wrong".
            reason: BANQ.qwkReason(res.status, data)
          });
        }
        return data;
      });
    });
  };

  /* Translate a QwkBrowser answer into something a person can act on. */
  BANQ.qwkReason = function(status, data) {
    var code = (data && data.code) || '';
    if (status === 401) return 'Reward earning is not open yet: QwkBrowser does not accept a BANQ sign-in for it.';
    if (status === 403 && code === 'CSRF_MISSING') {
      return 'QwkBrowser blocked this as a cross-site request. The partner reward path is not enabled yet.';
    }
    if (status === 402) return 'This needs a paid QwkBrowser plan.';
    if (status === 429) return 'Too many clicks. Wait a few seconds.';
    if (status === 502 || status === 503) return 'QwkBrowser is not answering right now.';
    if (data && data.error) return data.error;
    return 'QwkBrowser answered ' + status + '.';
  };

  // -- Auth --
  BANQ.login = function(username, password) {
    return fetch(BANQ.API_BASE + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    }).then(function(res) {
      return res.json().then(function(data) {
        if (!res.ok) throw Object.assign({ status: res.status }, data);
        return data;
      });
    });
  };

  // -- Signed handoff from QwkBrowser --
  // Redeems a handoff token issued by qwkbrowser (POST /api/auth/sso/handoff).
  // The signature is verified by BANQ's own server with the shared secret, so
  // this path needs no live call back to QwkBrowser. Returns the same shape as
  // BANQ.login: { success, token, user }.
  BANQ.sso = function(handoffToken) {
    return fetch(BANQ.API_BASE + '/auth/sso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: handoffToken })
    }).then(function(res) {
      return res.json().then(function(data) {
        if (!res.ok) throw Object.assign({ status: res.status }, data);
        return data;
      });
    });
  };

  BANQ.checkAuth = function() {
    if (!BANQ.getToken()) return Promise.resolve(null);
    return BANQ.fetchJson('/auth/me').then(function(data) {
      if (data.user) BANQ.setUser(data.user);
      return data.user || null;
    }).catch(function() { return null; });
  };

  BANQ.logout = function() {
    BANQ.clearToken();
    window.location.href = '/login.html';
  };

  // -- Utils --
  BANQ.escapeHtml = function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  BANQ.formatTime = function(ms) {
    if (ms <= 0) return 'Ready!';
    var h = Math.floor(ms / 3600000);
    var m = Math.floor((ms % 3600000) / 60000);
    var s = Math.floor((ms % 60000) / 1000);
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + s + 's';
    return s + 's';
  };

  // -- Toast --
  BANQ.toast = function(msg, type) {
    type = type || 'info';
    var el = document.createElement('div');
    el.className = 'banq-toast banq-toast-' + type;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function() {
      el.classList.add('banq-toast-show');
    }, 10);
    setTimeout(function() {
      el.classList.remove('banq-toast-show');
      setTimeout(function() { el.remove(); }, 300);
    }, 3000);
  };

})();
