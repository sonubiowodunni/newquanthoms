/*
 * BANQ-021 -- THE TWO RENDERERS
 *
 * One catalog (js/ad-catalog.js), two ways of showing it:
 *   mountPage()  -- the FULL marketplace on packages.html (every bullet)
 *   mountPopup() -- the PARTIAL preview inside index.html (two bullets per row)
 *
 * Section 23.8 requires the difference; keeping it here, in one file, is what
 * stops the preview and the page from describing different products. Neither
 * surface holds its own strings or its own prices.
 *
 * BUTTON BEHAVIOUR (23.8): priced packages show "SERVICE IS DELAYED FOR
 * TECHNICAL REVIEW"; the unannounced network placements show "AD PACKAGE WILL
 * BE ANNOUNCE SOON". Nothing fakes a checkout and nothing silently does nothing.
 */

(function () {
  'use strict';

  var CAT = window.BANQ_AD_CATALOG;

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(msg, kind) {
    if (window.BANQ && typeof window.BANQ.toast === 'function') {
      window.BANQ.toast(msg, kind || 'success');
    } else {
      // Never leave a click with no feedback at all.
      console.log('[BANQ ad] ' + msg);
    }
  }

  function bullets(list, cls) {
    return '<ul class="' + cls + '">' + list.map(function (b) {
      return '<li>' + esc(b) + '</li>';
    }).join('') + '</ul>';
  }

  // ------------------------------------------------------------------
  // NOTICE -- one behaviour for every launch button
  // ------------------------------------------------------------------
  function showNotice(key) {
    var entry = CAT.get(key);
    if (!entry) return;
    var headline = CAT.noticeFor(entry);
    var detail = CAT.noticeDetailFor(entry);
    toast(headline + ' -- ' + entry.label, entry.state === 'delayed' ? 'success' : 'error');

    // Inline, next to the button that was pressed, so the message cannot be
    // missed and does not depend on a toast surviving.
    var slot = document.querySelector('[data-notice-for="' + entry.key + '"]');
    if (slot) {
      slot.innerHTML = '<div class="banq-pkg-notice-head">' + esc(headline) + '</div>' +
        '<div class="banq-pkg-notice-body">' + esc(detail) + '</div>';
      slot.hidden = false;
    }
  }

  function wireNoticeButtons(root) {
    var nodes = (root || document).querySelectorAll('[data-launch]');
    Array.prototype.forEach.call(nodes, function (btn) {
      btn.addEventListener('click', function () {
        showNotice(this.getAttribute('data-launch'));
      });
    });
  }

  // ------------------------------------------------------------------
  // FULL PAGE
  // ------------------------------------------------------------------
  function cardHtml(entry) {
    var badge = entry.featured ? '<div class="banq-pkg-badge">Popular</div>' : '';
    var btnClass = entry.featured ? 'banq-pkg-btn' : 'banq-pkg-btn secondary';
    return '' +
      '<div class="banq-pkg-card' + (entry.featured ? ' featured' : '') + '">' +
        badge +
        '<div class="banq-pkg-icon">' + esc(entry.icon) + '</div>' +
        '<div class="banq-pkg-name">' + esc(entry.label) + '</div>' +
        '<div class="banq-pkg-price">' + esc(entry.price_display) + '</div>' +
        '<div class="banq-pkg-period">' + esc(entry.scope) + '</div>' +
        bullets(entry.bullets, 'banq-pkg-features') +
        '<button class="' + btnClass + '" data-launch="' + esc(entry.key) + '">' + esc(entry.button_label) + '</button>' +
        '<div class="banq-pkg-notice" data-notice-for="' + esc(entry.key) + '" hidden></div>' +
      '</div>';
  }

  function serviceHtml() {
    var s = CAT.service;
    return '' +
      '<div class="banq-ad-service" id="banqAdService">' +
        '<div class="banq-ad-service-head">' + esc(s.headline) + '</div>' +
        '<div class="banq-ad-service-name">' + esc(s.short_label) + ' -- ' + esc(s.price_display) + ' ' + esc(s.period) + '</div>' +
        '<div class="banq-ad-service-body">' + esc(s.body) + '</div>' +
        '<ul class="banq-pkg-features">' + s.rules.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' +
        '<button class="banq-pkg-btn" data-launch="full_reach" id="banqAdServiceCta">' + esc(s.cta) + '</button>' +
        '<div class="banq-ad-service-note">BANQ charges only this monthly monitoring service. Ad package prices belong to QWK Browser.</div>' +
      '</div>';
  }

  function pageHtml() {
    var placements = CAT.byGroup('placement');
    var packages = CAT.byGroup('package');
    var out = '';

    out += '<div class="banq-ad-hero">' +
      '<div class="banq-pkg-hero-title">QWK Browser Advertising</div>' +
      '<div class="banq-pkg-hero-sub">Reach customers across QWK Browser and the QwkBrowser Publisher Network. Choose your advertising format, targeting and distribution -- every campaign provides measurable impressions, clicks and engagement data.</div>' +
      '<div class="banq-ad-hero-note">Ad packages are QWK Browser advertising. BANQ adds the monitoring layer on top.</div>' +
      '</div>';

    out += '<section class="banq-ad-section">' +
      '<div class="banq-ad-section-head">' +
        '<div class="banq-ad-section-title">Individual placements</div>' +
        '<div class="banq-ad-section-sub">Build your own campaign -- pick a format and where it runs.</div>' +
      '</div>' +
      '<div class="banq-pkg-grid">' + placements.map(cardHtml).join('') + '</div>' +
      '</section>';

    out += '<section class="banq-ad-section">' +
      '<div class="banq-ad-section-head">' +
        '<div class="banq-ad-section-title">Campaign packages</div>' +
        '<div class="banq-ad-section-sub">Pre-built bundles for advertisers who would rather not assemble a campaign themselves.</div>' +
      '</div>' +
      '<div class="banq-pkg-grid banq-pkg-grid-2">' + packages.map(cardHtml).join('') + '</div>' +
      '</section>';

    out += serviceHtml();

    out += '<div class="banq-pkg-qap-section">' +
      '<div class="banq-pkg-qap-title">Your QAP identifies your advertising profile</div>' +
      '<div class="banq-pkg-qap-desc">A QAP (Quanthom Advertising Profile) number is issued on QwkBrowser when you create an advertising profile on mybmf.html. When you launch a package you will be asked for it -- it tells us which creatives and targeting to use, and it is how BANQ monitoring links to your adverts.</div>' +
      '<div style="font-size:11px;color:var(--muted);margin-top:10px;font-family:var(--font-m)">' +
        'Don\'t have a QAP number? <a href="https://localhost:3001/mybmf.html" target="_blank">Create an advertising profile on QwkBrowser</a>' +
      '</div>' +
    '</div>';

    return out;
  }

  function mountPage(container) {
    var el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    el.innerHTML = pageHtml();
    wireNoticeButtons(el);
  }

  // ------------------------------------------------------------------
  // POPUP (partial preview -- never the full bullet list)
  // ------------------------------------------------------------------
  function popupRowHtml(entry) {
    return '' +
      '<div class="banq-pkg-popup-item">' +
        '<div class="banq-pkg-popup-name">' + esc(entry.label) + '</div>' +
        '<div class="banq-pkg-popup-price">' + esc(entry.price_display) + '</div>' +
        '<div class="banq-pkg-popup-desc">' + esc(entry.scope) + ' -- ' + esc(entry.popup_bullets.join(', ')) + '.</div>' +
        '<div class="banq-pkg-popup-qap">' +
          '<button class="banq-pkg-popup-qap-btn" data-launch="' + esc(entry.key) + '" style="flex:1">' + esc(entry.button_label) + '</button>' +
        '</div>' +
        '<div class="banq-pkg-notice" data-notice-for="' + esc(entry.key) + '" hidden></div>' +
      '</div>';
  }

  function popupHtml() {
    return '' +
      CAT.all().map(popupRowHtml).join('') +
      '<div class="banq-pkg-popup-foot">' +
        'BANQ AD SERVICE adds monitoring for <strong>' + esc(CAT.service.price_display) + ' ' + esc(CAT.service.period) + '</strong> covering ' + esc(CAT.service.covers) + ', payable in ' + esc(CAT.service.payment) + '.<br>' +
        '<a href="packages.html">See full details on the Packages page</a>' +
        ' &middot; ' +
        '<a href="packages.html">Quanthom Network</a>' +
      '</div>';
  }

  function mountPopup(container) {
    var el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    el.innerHTML = popupHtml();
    wireNoticeButtons(el);
  }

  window.BANQ_AD_PAGE = {
    mountPage: mountPage,
    mountPopup: mountPopup,
    showNotice: showNotice
  };
})();
