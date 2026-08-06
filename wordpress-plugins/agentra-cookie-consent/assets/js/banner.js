(function () {
  'use strict';

  var cfg = window.agentraCookieConsent || {};
  var i18n = cfg.i18n || {};
  var COOKIE_NAME = cfg.cookieName || 'agentra_cookie_consent';
  var CONSENT_DAYS = Number(cfg.consentDays || 180);
  var VERSION = cfg.version || '1';

  var root = null;
  var shadow = null;
  var els = {};
  var state = { necessary: true, functional: false, analytics: false, marketing: false };

  var COOKIE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M21.4 12.2a9.4 9.4 0 1 1-9.6-9.6 4.2 4.2 0 0 0 4.3 4.9 4.2 4.2 0 0 0 5.3 4.7Z" ' +
    'stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>' +
    '<circle cx="9.1" cy="9.9" r="1.15" fill="currentColor"/>' +
    '<circle cx="13.4" cy="14.6" r="1.15" fill="currentColor"/>' +
    '<circle cx="8.4" cy="15.2" r="1" fill="currentColor"/>' +
    '</svg>';

  function t(key, fallback) {
    return i18n[key] || fallback;
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------- consent storage ---------- */

  function readCookie(name) {
    var re = new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)');
    var match = document.cookie.match(re);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function writeCookie(name, value, days) {
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie =
      name + '=' + encodeURIComponent(value) +
      '; Path=/; Max-Age=' + Math.max(1, days) * 86400 +
      '; SameSite=Lax' + secure;
  }

  function getStoredConsent() {
    var raw = readCookie(COOKIE_NAME);
    if (!raw) return null;
    try {
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      return {
        id: data.id || '',
        necessary: true,
        functional: !!data.functional,
        analytics: !!data.analytics,
        marketing: !!data.marketing,
      };
    } catch (e) {
      return null;
    }
  }

  function consentId() {
    var stored = getStoredConsent();
    if (stored && stored.id) return stored.id;
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'cc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  function saveConsent(next, action) {
    var id = consentId();
    state = {
      necessary: true,
      functional: !!next.functional,
      analytics: !!next.analytics,
      marketing: !!next.marketing,
    };

    writeCookie(
      COOKIE_NAME,
      JSON.stringify({
        id: id,
        necessary: true,
        functional: state.functional,
        analytics: state.analytics,
        marketing: state.marketing,
        version: VERSION,
        ts: Date.now(),
      }),
      CONSENT_DAYS
    );

    publishConsent(true);
    recordConsent(id, action || 'custom');
  }

  function recordConsent(id, action) {
    if (!cfg.logUrl || !cfg.logToken) return;

    var body = new URLSearchParams();
    body.set('action', 'agentra_cc_log_consent');
    body.set('token', cfg.logToken);
    body.set('consent_id', id);
    body.set('choice_action', action);
    body.set('necessary', '1');
    body.set('functional', state.functional ? '1' : '0');
    body.set('analytics', state.analytics ? '1' : '0');
    body.set('marketing', state.marketing ? '1' : '0');
    body.set('consent_version', cfg.noticeVersion || VERSION);
    body.set('page_url', window.location.href);

    window.fetch(cfg.logUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString(),
      keepalive: true,
    }).catch(function () {
      /* Consent still applies locally if audit logging is temporarily unavailable. */
    });
  }

  function publishConsent(fromUserAction) {
    var api = (window.AgentraConsent = window.AgentraConsent || {});
    api.get = function () {
      return {
        necessary: true,
        functional: !!state.functional,
        analytics: !!state.analytics,
        marketing: !!state.marketing,
      };
    };
    api.hasChoice = function () {
      return !!getStoredConsent();
    };
    api.openSettings = function () {
      openPanel(true);
    };
    api.acceptAll = acceptAll;
    api.rejectOptional = rejectOptional;

    var detail = api.get();
    detail.fromUserAction = !!fromUserAction;

    var el = document.documentElement;
    el.setAttribute('data-agentra-consent', getStoredConsent() ? '1' : '0');
    el.setAttribute('data-agentra-functional', detail.functional ? '1' : '0');
    el.setAttribute('data-agentra-analytics', detail.analytics ? '1' : '0');
    el.setAttribute('data-agentra-marketing', detail.marketing ? '1' : '0');

    applyGoogleConsent(detail);

    window.dispatchEvent(new CustomEvent('agentra:consent-updated', { detail: detail }));

    if (window.dataLayer && typeof window.dataLayer.push === 'function') {
      window.dataLayer.push({ event: 'agentra_consent_update', agentra_consent: detail });
    }
  }

  /**
   * Map Agentra categories → Google Consent Mode v2 signals.
   * Site Kit / gtag read these to decide whether GA4 / Ads may store cookies.
   */
  function applyGoogleConsent(detail) {
    var analytics = detail.analytics ? 'granted' : 'denied';
    var marketing = detail.marketing ? 'granted' : 'denied';
    var payload = {
      analytics_storage: analytics,
      ad_storage: marketing,
      ad_user_data: marketing,
      ad_personalization: marketing,
    };

    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
    }

    window.gtag('consent', 'update', payload);
    window.dataLayer.push({ event: 'agentra_google_consent_update', google_consent: payload });
  }

  /* ---------- markup ---------- */

  function rowMarkup(id, titleKey, descKey, locked) {
    if (id === 'functional' && cfg.enableFunctional === false) return '';
    if (id === 'analytics' && cfg.enableAnalytics === false) return '';
    if (id === 'marketing' && cfg.enableMarketing === false) return '';

    var control = locked
      ? '<span class="agentra-cc-locked">' + esc(t('alwaysOn', 'Always on')) + '</span>'
      : '<label class="agentra-cc-switch">' +
        '<input type="checkbox" data-cat="' + id + '" aria-label="' + esc(t(titleKey, id)) + '">' +
        '<span></span></label>';

    return (
      '<div class="agentra-cc-row">' +
      '<h3>' + esc(t(titleKey, id)) + '</h3>' +
      control +
      '<p>' + esc(t(descKey, '')) + '</p>' +
      '</div>'
    );
  }

  function whyMarkup(policy, privacy) {
    var items = Array.isArray(cfg.reasons) && cfg.reasons.length ? cfg.reasons : [];
    var list = items.length
      ? '<ul>' + items.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('') + '</ul>'
      : '';

    return (
      '<details class="agentra-cc-why">' +
      '<summary>' + esc(t('reasonsTitle', 'What we use cookies for')) + '</summary>' +
      list +
      '<p class="agentra-cc-why__links">' +
        '<a href="' + esc(policy) + '">' + esc(t('learnMore', 'Cookie Policy')) + '</a>' +
        ' &middot; ' +
        '<a href="' + esc(privacy) + '">' + esc(t('privacyLink', 'Privacy Policy')) + '</a>' +
      '</p>' +
      '</details>'
    );
  }

  function build() {
    var policy = cfg.policyUrl || 'https://agentraa.com/cookie-policy/';
    var privacy = cfg.privacyUrl || 'https://agentraa.com/privacy-policy/';

    shadow = root.shadowRoot || root.attachShadow({ mode: 'open' });

    var style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = cfg.cssUrl || '';

    var container = document.createElement('div');
    container.className = 'agentra-cc';

    shadow.innerHTML = '';
    shadow.appendChild(style);
    shadow.appendChild(container);

    container.innerHTML =
      '<div class="agentra-cc-scrim" data-scrim></div>' +

      '<div class="agentra-cc-panel" role="dialog" aria-modal="false" ' +
      'aria-labelledby="agentra-cc-title" data-panel hidden>' +

        '<div class="agentra-cc-panel__head">' +
          '<h2 class="agentra-cc-title" id="agentra-cc-title">' + esc(t('title', 'We use cookies')) + '</h2>' +
          '<p class="agentra-cc-text">' + esc(t('text', '')) + '</p>' +
          whyMarkup(policy, privacy) +
        '</div>' +

        '<div class="agentra-cc-panel__body" data-options hidden>' +
          rowMarkup('necessary', 'necessaryTitle', 'necessaryDesc', true) +
          rowMarkup('functional', 'functionalTitle', 'functionalDesc', false) +
          rowMarkup('analytics', 'analyticsTitle', 'analyticsDesc', false) +
          rowMarkup('marketing', 'marketingTitle', 'marketingDesc', false) +
        '</div>' +

        '<div class="agentra-cc-panel__foot">' +
          '<div class="agentra-cc-btns">' +
            '<button type="button" class="agentra-cc-btn" data-action="reject" data-reject>' +
              esc(t('rejectOptional', 'Only essentials')) +
            '</button>' +
            '<button type="button" class="agentra-cc-btn" data-action="go-back" data-back hidden>' +
              esc(t('goBack', 'Go back')) +
            '</button>' +
            '<button type="button" class="agentra-cc-btn" data-action="show-options" data-choose>' +
              esc(t('chooseLabel', 'Let me choose')) +
            '</button>' +
            '<button type="button" class="agentra-cc-btn" data-action="save" data-save hidden>' +
              esc(t('savePreferences', 'Save my choices')) +
            '</button>' +
            '<button type="button" class="agentra-cc-btn agentra-cc-btn--solid" data-action="accept-all">' +
              esc(t('acceptAll', 'Sounds good')) +
            '</button>' +
          '</div>' +
        '</div>' +

      '</div>' +

      '<button type="button" class="agentra-cc-launcher" data-launcher aria-haspopup="dialog" ' +
      'aria-label="' + esc(t('reopenLabel', 'Cookie settings')) + '">' +
        '<span class="agentra-cc-launcher__icon">' + COOKIE_ICON + '</span>' +
        '<span class="agentra-cc-launcher__label">' + esc(t('reopenLabel', 'Cookie settings')) + '</span>' +
      '</button>';

    els.container = container;
    els.scrim = container.querySelector('[data-scrim]');
    els.panel = container.querySelector('[data-panel]');
    els.launcher = container.querySelector('[data-launcher]');
    els.body = container.querySelector('[data-options]');
    els.chooseBtn = container.querySelector('[data-choose]');
    els.saveBtn = container.querySelector('[data-save]');
    els.rejectBtn = container.querySelector('[data-reject]');
    els.backBtn = container.querySelector('[data-back]');
  }

  /* ---------- panel state ---------- */

  function setOptionsVisible(visible) {
    els.body.hidden = !visible;
    els.chooseBtn.hidden = visible;
    els.saveBtn.hidden = !visible;
    els.rejectBtn.hidden = visible;
    els.backBtn.hidden = !visible;
    if (visible) syncToggles();
  }

  function openPanel(expanded) {
    setOptionsVisible(!!expanded);
    els.panel.hidden = false;
    els.launcher.setAttribute('aria-expanded', 'true');
    if (els.body) els.body.scrollTop = 0;
    requestAnimationFrame(function () {
      els.panel.classList.add('is-open');
      els.scrim.classList.add('is-open');
    });
  }

  function closePanel() {
    els.panel.classList.remove('is-open');
    els.scrim.classList.remove('is-open');
    els.launcher.setAttribute('aria-expanded', 'false');
    window.setTimeout(function () {
      if (!els.panel.classList.contains('is-open')) els.panel.hidden = true;
    }, 260);
  }

  function isOpen() {
    return els.panel && els.panel.classList.contains('is-open');
  }

  function syncToggles() {
    els.container.querySelectorAll('input[data-cat]').forEach(function (input) {
      input.checked = !!state[input.getAttribute('data-cat')];
    });
  }

  function readToggles() {
    var next = { necessary: true, functional: false, analytics: false, marketing: false };
    els.container.querySelectorAll('input[data-cat]').forEach(function (input) {
      next[input.getAttribute('data-cat')] = !!input.checked;
    });
    return next;
  }

  /* ---------- actions ---------- */

  function acceptAll() {
    saveConsent({
      functional: cfg.enableFunctional !== false,
      analytics: cfg.enableAnalytics !== false,
      marketing: cfg.enableMarketing !== false,
    }, 'accept_all');
    closePanel();
  }

  function rejectOptional() {
    saveConsent({ functional: false, analytics: false, marketing: false }, 'essentials_only');
    closePanel();
  }

  function savePreferences() {
    saveConsent(readToggles(), 'custom');
    closePanel();
  }

  function onDocumentClick(e) {
    var trigger = e.target.closest && e.target.closest('.agentra-cc-open-settings');
    if (trigger) {
      e.preventDefault();
      openPanel(true);
      return;
    }

    var path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    if (isOpen() && path.indexOf(root) === -1) {
      closePanel();
    }
  }

  function onWidgetClick(e) {
    if (e.target.closest('[data-launcher]')) {
      isOpen() ? closePanel() : openPanel(!!getStoredConsent());
      return;
    }

    if (e.target.closest('[data-scrim]')) {
      closePanel();
      return;
    }

    var actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    switch (actionEl.getAttribute('data-action')) {
      case 'accept-all':
        acceptAll();
        break;
      case 'reject':
        rejectOptional();
        break;
      case 'go-back':
        setOptionsVisible(false);
        break;
      case 'save':
        savePreferences();
        break;
      case 'show-options':
        setOptionsVisible(true);
        break;
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && isOpen()) closePanel();
  }

  function init() {
    root = document.getElementById('agentra-cc-root');
    if (!root) return;

    root.removeAttribute('hidden');

    var stored = getStoredConsent();
    if (stored) {
      state.functional = stored.functional;
      state.analytics = stored.analytics;
      state.marketing = stored.marketing;
    }

    build();
    els.container.addEventListener('click', onWidgetClick);
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKeydown);
    publishConsent(false);

    if (!stored) {
      window.setTimeout(function () {
        openPanel(false);
      }, 600);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
