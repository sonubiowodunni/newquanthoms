/*
 * BANQ-021 -- THE ADVERTISING CATALOG (single source of truth)
 *
 * WHY THIS FILE EXISTS
 * The standalone page and the popup used to hold their own hand-written card
 * sets. They disagreed within days: the page sold Starter/Premium/Sponsored at
 * $50/$200/$500 while the QWK side billed Banner/Express ADS/Full Reach at
 * $50/$200/$450. Two copies of one marketplace always drift, so there is now
 * ONE copy and both surfaces render it.
 *
 * THE JOIN KEY
 * `key` MUST equal the package_key that the QWK launch endpoint accepts
 * (qwkbrowser/backend/routes/ads.js PACKAGE_TIERS): banner, video, launch,
 * full_reach. The network placements have no billing key yet, which is exactly
 * why they are the two `announced_soon` entries -- the catalog states the truth
 * instead of offering a button the server would reject.
 *
 * BANQ'S OWN PRICE
 * BANQ charges ONE thing: the $15/month monitoring subscription (all adverts,
 * credits or fiat). The package prices belong to QWK Browser. See
 * docs/BANQ-021-IMPLEMENTATION-DESIGN.md Section 4.1.
 *
 * AUTHORITY: docs/BANQ-AD-MONITORING-PARTNERSHIP.md Section 23 (23.3 canonical
 * copy, 23.8-23.11 frozen decisions). No price is invented here.
 */

(function () {
  'use strict';

  // ------------------------------------------------------------------
  // BANQ AD SERVICE -- the only price that belongs to BANQ
  // ------------------------------------------------------------------
  var SERVICE = {
    label: 'BANQ Campaign Monitoring & Analytics',
    short_label: 'BANQ AD SERVICE',
    monthly_usd: 15,
    price_display: '$15',
    period: 'per month',
    covers: 'every advert you run that month',
    payment: 'credits or fiat',
    all_ads: true,
    headline: 'Want someone to monitor your campaign?',
    body: 'Add BANQ AD SERVICE to receive dedicated campaign analysis, performance observations, alerts and customer support throughout your campaign.',
    rules: [
      '$15 per month covers ALL adverts you run that month -- one subscription, not one per advert.',
      'Run as many adverts as you like; the month is already paid.',
      'Monitoring and analytics appear on your newquanthoms.com dashboard.',
      'Payable in credits or fiat.',
      'At month end, another month keeps the monitoring running.',
      'Extra BANQ plans, tools and services are purchased through newquanthoms.com.'
    ],
    covered_note: 'Covered -- active this month ($0)',
    cta: 'Add BANQ Management'
  };

  // ------------------------------------------------------------------
  // BUTTON STATES -- three, never a fourth
  // ------------------------------------------------------------------
  var STATES = {
    DELAYED: 'delayed',
    ANNOUNCED_SOON: 'announced_soon',
    LIVE: 'live'
  };

  var NOTICES = {
    delayed: 'SERVICE IS DELAYED FOR TECHNICAL REVIEW',
    announced_soon: 'AD PACKAGE WILL BE ANNOUNCE SOON'
  };

  var NOTICE_DETAIL = {
    delayed: 'This package is real and its price is real. Activation waits on media object storage and checkout, which are not connected yet.',
    announced_soon: 'This placement is part of the Publishers Network. Its price has not been announced yet.'
  };

  // ------------------------------------------------------------------
  // THE MARKETPLACE -- six entries, prices frozen 2026-09-03
  // ------------------------------------------------------------------
  var ENTRIES = [
    {
      key: 'banner',
      label: 'Banner Ad Placement',
      group: 'placement',
      group_label: 'Individual placements',
      icon: 'IMAGE',
      format: 'image',
      media_label: 'image',
      price_usd: 50,
      price_display: '$50',
      duration_display: null,
      scope: 'Up to 500 clicks',
      unit_reward: 10,
      cooldown_hours: 24,
      targeting: 'Worldwide, country, audience or keyword',
      button_label: 'Launch Banner',
      state: STATES.DELAYED,
      featured: false,
      bullets: [
        'Image banner creative',
        'Impression tracking',
        'Click-through tracking',
        'Worldwide, country, audience or keyword targeting',
        'Custom image, logo and call-to-action',
        'Up to 500 clicks',
        '10 QU per click',
        '24-hour click cooldown'
      ],
      popup_bullets: ['Up to 500 clicks', '10 QU per click']
    },
    {
      key: 'video',
      label: 'Video Ad Placement',
      group: 'placement',
      group_label: 'Individual placements',
      icon: 'VIDEO',
      format: 'video',
      media_label: 'video',
      price_usd: 150,
      price_display: '$150',
      duration_display: null,
      scope: '15s / 30s click rate',
      unit_reward: 10,
      cooldown_hours: 24,
      targeting: 'Worldwide, country, audience or keyword',
      button_label: 'Launch Video',
      state: STATES.DELAYED,
      featured: false,
      bullets: [
        'Video creative',
        'Video impression tracking',
        'Engagement and click-through tracking',
        'Worldwide, country, audience or keyword targeting',
        'Custom video and destination URL',
        'Campaign performance analytics',
        'Viewers watching 30s+ earn from 10 QU on a first watch, once per cooldown -- never QC credits',
        'Advertiser billing: 15s+ watch = half a click (3 QC), 30s+ watch = a full click (6 QC)'
      ],
      popup_bullets: ['Video creative', '15s / 30s click rate']
    },
    {
      key: 'network_banner',
      label: 'Banner on Publishers Network',
      group: 'placement',
      group_label: 'Individual placements',
      icon: 'NETWORK',
      format: 'image',
      media_label: 'image',
      price_usd: null,
      price_display: '$',
      duration_display: null,
      scope: 'Up to 5,000 clicks',
      unit_reward: null,
      cooldown_hours: null,
      targeting: 'Country, audience or keyword',
      button_label: 'Launch Network Banner',
      state: STATES.ANNOUNCED_SOON,
      featured: false,
      bullets: [
        'Banner distribution across participating publishers',
        'Publisher Network reach',
        'Impression and click tracking',
        'Country, audience or keyword targeting',
        'Custom banner creative and call-to-action',
        'Publisher-level campaign analytics where available',
        'Up to 5,000 clicks'
      ],
      popup_bullets: ['Publisher Network reach', 'Up to 5,000 clicks']
    },
    {
      key: 'network_video',
      label: 'Video on Publishers Network',
      group: 'placement',
      group_label: 'Individual placements',
      icon: 'NETWORK',
      format: 'video',
      media_label: 'video',
      price_usd: null,
      price_display: '$',
      duration_display: null,
      scope: '15s / 30s click rate',
      unit_reward: null,
      cooldown_hours: null,
      targeting: 'Country, audience or keyword',
      button_label: 'Launch Network Video',
      state: STATES.ANNOUNCED_SOON,
      featured: false,
      bullets: [
        'Video distribution across participating publishers',
        'Video impression and engagement tracking',
        'Click-through destination support',
        'Country, audience or keyword targeting',
        'Custom promotional videos',
        'Brand storytelling support',
        'Network campaign analytics'
      ],
      popup_bullets: ['Publisher Network video', '15s / 30s click rate']
    },
    {
      key: 'launch',
      label: 'Express ADS',
      group: 'package',
      group_label: 'Campaign packages',
      icon: 'STAR',
      format: 'image_or_video',
      media_label: 'image or video',
      price_usd: 200,
      price_display: '$200',
      duration_display: null,
      scope: 'Up to 2,500 clicks',
      unit_reward: 25,
      cooldown_hours: 48,
      targeting: 'Country or keyword',
      button_label: 'Launch Campaign',
      state: STATES.DELAYED,
      featured: false,
      bullets: [
        'A broader campaign combining selected QWK Browser advertising placements',
        'Image or video',
        'Up to 2,500 clicks',
        'Country or keyword targeting',
        '25 QU per click',
        '48-hour click cooldown',
        'Priority placement',
        'Campaign analytics'
      ],
      popup_bullets: ['Up to 2,500 clicks', '25 QU per click']
    },
    {
      key: 'full_reach',
      label: 'Full Reach Package',
      group: 'package',
      group_label: 'Campaign packages',
      icon: 'STAR',
      format: 'image_or_video',
      media_label: 'image or video',
      price_usd: 450,
      price_display: '$450',
      duration_display: null,
      scope: 'Up to 6,000 clicks',
      unit_reward: 50,
      cooldown_hours: 72,
      targeting: 'Full targeting options',
      button_label: 'Launch Full Campaign',
      state: STATES.DELAYED,
      featured: true,
      bullets: [
        'A comprehensive campaign across QWK Browser and participating Publisher Network locations',
        'Image or video',
        'Up to 6,000 clicks',
        'Full targeting options',
        '50 QU per click',
        '72-hour click cooldown',
        'Top placement',
        'Dedicated BANQ manager',
        'Campaign analytics and monitoring'
      ],
      popup_bullets: ['Up to 6,000 clicks', '50 QU per click']
    }
  ];

  // The billing key set the QWK launch endpoint accepts. Kept here so the
  // verify script can fail loudly the day the two drift apart.
  var BILLING_KEYS = ['banner', 'video', 'launch', 'full_reach'];

  // ------------------------------------------------------------------
  // LOOKUPS
  // ------------------------------------------------------------------
  var BY_KEY = {};
  ENTRIES.forEach(function (e) { BY_KEY[e.key] = e; });

  function get(key) {
    return BY_KEY[String(key || '').toLowerCase()] || null;
  }

  function all() {
    return ENTRIES.slice();
  }

  function byGroup(group) {
    return ENTRIES.filter(function (e) { return e.group === group; });
  }

  function priceOf(entry) {
    if (!entry) return '$';
    return entry.price_usd == null ? '$' : '$' + entry.price_usd;
  }

  /** True when a button for this entry would do something real today. */
  function isBillable(entry) {
    return !!(entry && entry.price_usd != null && BILLING_KEYS.indexOf(entry.key) !== -1);
  }

  function noticeFor(entry) {
    if (!entry) return NOTICES.delayed;
    return NOTICES[entry.state] || NOTICES.delayed;
  }

  function noticeDetailFor(entry) {
    if (!entry) return NOTICE_DETAIL.delayed;
    return NOTICE_DETAIL[entry.state] || NOTICE_DETAIL.delayed;
  }

  // ------------------------------------------------------------------
  // QAP -- format and media requirement (23.9 V4)
  // ------------------------------------------------------------------
  var QAP_RE = /^QAP-[A-Z0-9]{6,}$/i;

  function validQap(qap) {
    return QAP_RE.test(String(qap || '').trim());
  }

  function normaliseQap(qap) {
    return String(qap || '').trim().toUpperCase();
  }

  /**
   * Does the profile's primary media satisfy this package?
   * Returns { ok, required, actual, message } -- message is the exact 23.9 V4
   * wording, so the customer is told what was needed and what they have.
   */
  function mediaCheck(entry, mediaType) {
    var required = entry ? entry.format : 'image_or_video';
    var actual = String(mediaType || 'url').toLowerCase();
    var ok;
    if (required === 'image_or_video') ok = (actual === 'image' || actual === 'video');
    else ok = (actual === required);

    if (ok) return { ok: true, required: required, actual: actual, message: '' };

    var article = /^[aeiou]/i.test(required) ? 'an' : 'a';
    var msg = 'Ad requirement not complete -- ' + (entry ? entry.label : 'This package') +
      ' AD requires ' + article + ' ' + required + ' (selected as primary file) in your advertising profile. Yours is ' + actual + '.';
    return { ok: false, required: required, actual: actual, message: msg };
  }

  window.BANQ_AD_CATALOG = {
    service: SERVICE,
    states: STATES,
    notices: NOTICES,
    notice_detail: NOTICE_DETAIL,
    entries: ENTRIES,
    billing_keys: BILLING_KEYS,
    get: get,
    all: all,
    byGroup: byGroup,
    priceOf: priceOf,
    isBillable: isBillable,
    noticeFor: noticeFor,
    noticeDetailFor: noticeDetailFor,
    validQap: validQap,
    normaliseQap: normaliseQap,
    mediaCheck: mediaCheck
  };
})();
