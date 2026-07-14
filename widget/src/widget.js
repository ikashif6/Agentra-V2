/**
 * Agentra embeddable live chat widget.
 */
import { buildHTML, buildCSS, esc, formatAgentText } from './widgetTemplate.js';

(function () {
  'use strict';

  const cfg = window.AgentraConfig || {};
  const WIDGET_KEY = cfg.widgetKey || cfg.key || '';
  const API_BASE = (cfg.apiBase || 'http://localhost:5000/api/v1/widget').replace(/\/$/, '');
  const STYLE_ATTR = 'data-agentra-widget-style';

  let agentCfg = null;
  let sessionToken = null;
  let visitorEmail = null;
  let ws = null;
  let isOpen = false;
  let inChat = false;
  let emailVerified = false;
  let lastMessageTs = null;
  let messagesEl, inputEl, sendBtnEl, typingEl, badgeEl, processStepsEl;
  let tabHomeEl, tabChatEl, emailGateEl, emailInputEl, emailBtnEl, emailErrorEl;

  const STATUS_LABELS = {
    retrieving: 'Searching knowledge base…',
    checking_order: 'Checking your order…',
    searching_products: 'Finding products…',
    thinking: 'Generating your answer…',
  };

  function uid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  async function api(endpoint, method, body) {
    const url = API_BASE + endpoint;
    const opts = {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-widget-key': WIDGET_KEY,
      },
    };
    if (body) {
      opts.body = JSON.stringify({ ...body, widgetKey: WIDGET_KEY });
    }
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Request failed');
    return data.data;
  }

  function loadFonts(fontFamilyName) {
    const name = String(fontFamilyName || 'Sora')
      .replace(/['"]/g, '')
      .split(',')[0]
      .trim();
    if (!name) return;
    const id = 'agentra-gf-' + name.replace(/\s+/g, '-');
    if (document.querySelector('#' + id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=' +
      encodeURIComponent(name).replace(/%20/g, '+') +
      ':wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }

  function loadFA() {
    if (document.querySelector('#agentra-fa-css')) return;
    const link = document.createElement('link');
    link.id = 'agentra-fa-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(link);
  }

  function connectWebSocket() {
    if (!sessionToken || !agentCfg?.wsUrl) return;
    try {
      if (ws) ws.close();
      const url = agentCfg.wsUrl + '?session=' + encodeURIComponent(sessionToken) + '&role=visitor';
      ws = new WebSocket(url);
      ws.onmessage = function (ev) {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'message' && msg.data) renderServerMessage(msg.data);
          if (msg.type === 'system_event' && msg.data?.event === 'agent_joined') {
            addSystemEvent(msg.data.agentName + ' joined the chat');
          }
          if (msg.type === 'status' && msg.data?.status) {
            showProcessStatus(msg.data.status);
          }
          if (msg.type === 'typing') {
            if (msg.data?.role !== 'customer') toggleTyping(Boolean(msg.data?.active));
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // websocket optional
    }
  }

  function showProcessStatus(status) {
    if (!processStepsEl || !agentCfg?.behavior?.retrievalIndicator) return;
    const label = STATUS_LABELS[status] || 'Working on it…';
    processStepsEl.querySelector('.agt-process-label').textContent = label;
    processStepsEl.classList.add('visible');
  }

  function hideProcessStatus() {
    processStepsEl?.classList.remove('visible');
  }

  function toggleTyping(show) {
    if (!typingEl) return;
    typingEl.classList.toggle('visible', show);
    if (show) scrollMessages();
  }

  function scrollMessages() {
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addDateSepIfNeeded(ts) {
    if (!messagesEl) return;
    const label = formatDayLabel(ts);
    const lastSep = messagesEl.querySelector('.agt-date-sep:last-of-type');
    if (!lastSep || lastSep.textContent !== label) {
      const sep = document.createElement('div');
      sep.className = 'agt-date-sep';
      sep.textContent = label;
      messagesEl.appendChild(sep);
    }
  }

  function formatDayLabel(d) {
    const dt = d instanceof Date ? d : new Date(d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    if (dDay.getTime() === today.getTime()) return 'Today';
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function addCustomerMessage(text) {
    addDateSepIfNeeded(new Date());
    const row = document.createElement('div');
    row.className = 'agt-msg-row customer';
    row.innerHTML = '<div class="agt-bubble">' + esc(text) + '</div>';
    messagesEl.appendChild(row);
    scrollMessages();
  }

  function addSystemEvent(text) {
    const el = document.createElement('div');
    el.className = 'agt-system-event';
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollMessages();
  }

  function buildOrderCard(payload) {
    const status = payload.fulfillmentStatus || payload.financialStatus || 'Processing';
    const items = (payload.lineItems || [])
      .map(function (li) {
        return '<div style="font-size:12px;color:#555;">' + esc(li.title) + ' × ' + (li.quantity || 1) + '</div>';
      })
      .join('');
    const tracking = payload.tracking?.url
      ? '<a class="agt-order-track-btn" href="' +
        esc(payload.tracking.url) +
        '" target="_blank" rel="noopener"><i class="fa-solid fa-truck"></i> Track shipment</a>'
      : '';
    return (
      '<div class="agt-order-card">' +
      '<div class="agt-order-num"><i class="fa-solid fa-receipt"></i> ' +
      esc(payload.orderNumber || '') +
      '</div>' +
      '<div class="agt-order-status-row"><span class="agt-order-status-dot"></span><span class="agt-order-status-label">' +
      esc(status) +
      '</span></div>' +
      items +
      tracking +
      '</div>'
    );
  }

  function buildProductGrid(products) {
    return (
      '<div class="agt-product-grid">' +
      products
        .map(function (p) {
          const img = p.imageUrl
            ? '<img src="' + esc(p.imageUrl) + '" alt="' + esc(p.title) + '">'
            : '<div style="height:72px;background:#f3f4f6;"></div>';
          const price = p.price != null ? (p.currency || '$') + p.price : '';
          const href = p.url ? ' href="' + esc(p.url) + '" target="_blank" rel="noopener"' : '';
          return (
            '<a class="agt-product-card"' +
            href +
            '><div>' +
            img +
            '</div><div class="agt-product-body"><div class="agt-product-title">' +
            esc(p.title) +
            '</div><div class="agt-product-price">' +
            esc(price) +
            '</div></div></a>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function addAgentMessage(msg) {
    hideProcessStatus();
    toggleTyping(false);
    const at = msg.sentAt ? new Date(msg.sentAt) : new Date();
    addDateSepIfNeeded(at);

    if (msg.contentType === 'system_event') {
      addSystemEvent(msg.body || 'Update');
      return;
    }

    const row = document.createElement('div');
    row.className = 'agt-msg-row agent';
    const name = msg.senderName || agentCfg?.agentName || 'Assistant';
    let inner = '';

    if (msg.contentType === 'order_card' && msg.payload) {
      inner =
        '<div class="agt-agent-row"><div class="agt-agent-av"><i class="fa-solid fa-robot"></i></div><div class="agt-msg-meta">' +
        esc(name) +
        '</div></div>' +
        (msg.body ? '<div class="agt-bubble">' + formatAgentText(msg.body) + '</div>' : '') +
        buildOrderCard(msg.payload);
    } else if (msg.contentType === 'product_cards' && msg.payload?.products) {
      inner =
        '<div class="agt-agent-row"><div class="agt-agent-av"><i class="fa-solid fa-robot"></i></div><div class="agt-msg-meta">' +
        esc(name) +
        '</div></div>' +
        (msg.body ? '<div class="agt-bubble">' + formatAgentText(msg.body) + '</div>' : '') +
        buildProductGrid(msg.payload.products);
    } else {
      inner =
        '<div class="agt-agent-row"><div class="agt-agent-av"><i class="fa-solid fa-robot"></i></div><div class="agt-msg-meta">' +
        esc(name) +
        '</div></div>' +
        '<div class="agt-bubble">' +
        formatAgentText(msg.body || '') +
        '</div>';
    }

    row.innerHTML = inner;
    messagesEl.appendChild(row);
    scrollMessages();
  }

  function renderServerMessage(msg) {
    if (msg.role === 'customer') addCustomerMessage(msg.body);
    else addAgentMessage(msg);
  }

  function clearEmailError() {
    if (!emailErrorEl) return;
    emailErrorEl.textContent = '';
    emailErrorEl.classList.add('gone');
  }

  function showEmailError(message) {
    if (!emailErrorEl) return;
    emailErrorEl.textContent = message || 'Something went wrong. Please try again.';
    emailErrorEl.classList.remove('gone');
  }

  function showEmailGate() {
    document.getElementById('agt-home')?.classList.add('gone');
    document.getElementById('agt-chat')?.classList.add('gone');
    emailGateEl?.classList.remove('gone');
    clearEmailError();
    tabHomeEl?.classList.remove('active');
    tabChatEl?.classList.add('active');
    document.getElementById('agt-chat-header')?.style.setProperty('display', 'flex');
  }

  function showChatScreen() {
    emailGateEl?.classList.add('gone');
    document.getElementById('agt-home')?.classList.add('gone');
    document.getElementById('agt-chat')?.classList.remove('gone');
    inChat = true;
    document.getElementById('agt-chat-header')?.style.setProperty('display', 'flex');
    tabChatEl?.classList.add('active');
    tabHomeEl?.classList.remove('active');
    inputEl?.focus();
  }

  async function startChatWithEmail(email) {
    emailBtnEl.disabled = true;
    clearEmailError();
    try {
      const data = await api('/session/start', 'POST', {
        email: email,
        pageUrl: window.location.href,
        origin: window.location.origin,
        userAgent: navigator.userAgent,
      });
      sessionToken = data.sessionToken;
      visitorEmail = email;
      emailVerified = true;
      messagesEl.innerHTML = '';
      (data.messages || []).forEach(function (m) {
        renderServerMessage(m);
      });
      connectWebSocket();
      showChatScreen();
    } catch (err) {
      showEmailError(err.message || 'Could not start chat');
    } finally {
      emailBtnEl.disabled = false;
    }
  }

  async function sendMessage(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed || !sessionToken) return;
    addCustomerMessage(trimmed);
    inputEl.value = '';
    sendBtnEl.disabled = true;
    toggleTyping(true);
    showProcessStatus('thinking');
    try {
      const data = await api('/session/message', 'POST', {
        sessionToken: sessionToken,
        message: trimmed,
      });
      toggleTyping(false);
      hideProcessStatus();
      (data.messages || []).forEach(function (m) {
        addAgentMessage(m);
      });
      if (data.handoff) {
        addSystemEvent('Connecting you with a support agent…');
      }
    } catch (err) {
      toggleTyping(false);
      hideProcessStatus();
      addAgentMessage({ role: 'bot', body: err.message || 'Something went wrong. Please try again.', senderName: agentCfg?.agentName });
    } finally {
      sendBtnEl.disabled = !inputEl.value.trim();
    }
  }

  function goToChat(initialMsg) {
    if (emailInputEl) {
      if (initialMsg) emailInputEl.dataset.initialMsg = initialMsg;
      else delete emailInputEl.dataset.initialMsg;
    }
    if (!emailVerified) {
      showEmailGate();
      return;
    }
    showChatScreen();
    if (initialMsg) sendMessage(initialMsg);
  }

  function wireEvents() {
    const launcher = document.getElementById('agt-launcher');
    const panel = document.getElementById('agt-panel');
    const closeBtn = document.getElementById('agt-close-btn');
    const backBtn = document.getElementById('agt-back-btn');
    messagesEl = document.getElementById('agt-messages');
    inputEl = document.getElementById('agt-input');
    sendBtnEl = document.getElementById('agt-send-btn');
    typingEl = document.getElementById('agt-typing');
    processStepsEl = document.getElementById('agt-process-steps');
    badgeEl = document.getElementById('agt-badge');
    tabHomeEl = document.getElementById('tab-home');
    tabChatEl = document.getElementById('tab-chat');
    emailGateEl = document.getElementById('agt-email-gate');
    emailInputEl = document.getElementById('agt-email-input');
    emailBtnEl = document.getElementById('agt-email-btn');
    emailErrorEl = document.getElementById('agt-email-error');

    function openPanel() {
      isOpen = true;
      panel.classList.add('open');
      launcher.classList.add('open');
      badgeEl?.classList.remove('show');
    }
    function closePanel() {
      isOpen = false;
      panel.classList.remove('open');
      launcher.classList.remove('open');
    }

    launcher?.addEventListener('click', function () {
      return isOpen ? closePanel() : openPanel();
    });
    closeBtn?.addEventListener('click', closePanel);

    tabHomeEl?.addEventListener('click', function () {
      tabHomeEl.classList.add('active');
      tabChatEl.classList.remove('active');
      document.getElementById('agt-home')?.classList.remove('gone');
      document.getElementById('agt-chat')?.classList.add('gone');
      emailGateEl?.classList.add('gone');
      document.getElementById('agt-chat-header')?.style.setProperty('display', 'none');
      if (emailInputEl) delete emailInputEl.dataset.initialMsg;
      inChat = false;
    });

    tabChatEl?.addEventListener('click', function () {
      if (!emailVerified) showEmailGate();
      else showChatScreen();
    });

    backBtn?.addEventListener('click', function () {
      tabHomeEl?.click();
    });

    document.querySelectorAll('.agt-qr-item').forEach(function (el) {
      el.addEventListener('click', function () {
        goToChat(el.getAttribute('data-msg'));
      });
    });

    document.getElementById('agt-send-msg-card')?.addEventListener('click', function () {
      goToChat();
    });

    emailInputEl?.addEventListener('input', clearEmailError);

    emailBtnEl?.addEventListener('click', function () {
      const email = emailInputEl?.value?.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showEmailError('Enter a valid email address to continue.');
        emailInputEl?.focus();
        return;
      }
      const initial = emailInputEl?.dataset?.initialMsg;
      if (emailInputEl) delete emailInputEl.dataset.initialMsg;
      startChatWithEmail(email).then(function () {
        if (initial) sendMessage(initial);
      });
    });

    inputEl?.addEventListener('input', function () {
      sendBtnEl.disabled = !inputEl.value.trim();
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    });

    sendBtnEl?.addEventListener('click', function () {
      sendMessage(inputEl.value);
    });

    inputEl?.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(inputEl.value);
      }
    });
  }

  function mount(cfgData) {
    agentCfg = cfgData;
    if (!agentCfg?.enabled) return;

    const rootId = 'agentra-widget-root';
    let root = document.getElementById(rootId);
    if (!root) {
      root = document.createElement('div');
      root.id = rootId;
      document.body.appendChild(root);
    }

    const brand = agentCfg.widgetColor || '#2563eb';
    const fontName = String(agentCfg.fontFamily || 'Sora')
      .replace(/['"]/g, '')
      .split(',')[0]
      .trim() || 'Sora';
    const font = "'" + fontName + "', system-ui, -apple-system, sans-serif";
    loadFonts(fontName);
    loadFA();

    const oldStyle = document.querySelector('style[' + STYLE_ATTR + ']');
    if (oldStyle) oldStyle.remove();
    const style = document.createElement('style');
    style.setAttribute(STYLE_ATTR, '1');
    style.textContent = buildCSS(brand, font, rootId, {
      backgroundColor: agentCfg.backgroundColor || '#ffffff',
    });
    document.head.appendChild(style);

    root.innerHTML = buildHTML(agentCfg);
    wireEvents();

    if (agentCfg.position === 'bottom-left') {
      root.style.setProperty('--launcher-left', agentCfg.launcherOffsetX + 'px');
      root.style.setProperty('--launcher-right', 'auto');
    }
  }

  async function init() {
    if (!WIDGET_KEY) {
      console.warn('[Agentra] widgetKey missing in AgentraConfig');
      return;
    }
    try {
      const config = await api('/config?widgetKey=' + encodeURIComponent(WIDGET_KEY));
      if (!config.enabled) return;
      mount(config);
      setInterval(async function () {
        try {
          const next = await api('/config?widgetKey=' + encodeURIComponent(WIDGET_KEY));
          if (next.widgetColor && next.widgetColor !== agentCfg?.widgetColor) mount(next);
        } catch {
          // ignore polling errors
        }
      }, 30000);
    } catch (err) {
      console.error('[Agentra widget]', err.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
