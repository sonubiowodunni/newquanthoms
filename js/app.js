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

  // -- API base (proxied to QWK backend) --
  BANQ.API_BASE = window.location.origin + '/api';

  // -- Token management --
  BANQ.getToken = function() {
    return localStorage.getItem('qwk_token') || '';
  };

  BANQ.setToken = function(token) {
    localStorage.setItem('qwk_token', token);
  };

  BANQ.clearToken = function() {
    localStorage.removeItem('qwk_token');
    localStorage.removeItem('qwk_user');
  };

  BANQ.getUser = function() {
    try {
      return JSON.parse(localStorage.getItem('qwk_user') || 'null');
    } catch (e) {
      return null;
    }
  };

  BANQ.setUser = function(user) {
    localStorage.setItem('qwk_user', JSON.stringify(user));
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
        if (window.location.pathname !== '/signin.html') {
          window.location.href = '/signin.html';
        }
        throw { status: 401, message: 'Unauthorized' };
      }
      return res.json().then(function(data) {
        if (!res.ok) throw Object.assign({ status: res.status }, data);
        return data;
      });
    });
  };

  BANQ.qwkFetch = function(path, options) {
    return BANQ.fetchJson(path, options);
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

  BANQ.checkAuth = function() {
    if (!BANQ.getToken()) return Promise.resolve(null);
    return BANQ.fetchJson('/auth/me').then(function(data) {
      if (data.user) BANQ.setUser(data.user);
      return data.user || null;
    }).catch(function() { return null; });
  };

  BANQ.logout = function() {
    BANQ.clearToken();
    window.location.href = '/signin.html';
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
