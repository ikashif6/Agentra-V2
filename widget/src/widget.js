/**
 * Agentra embeddable live chat widget.
 */
import { buildHTML, buildCSS, esc, formatAgentText } from './widgetTemplate.js';

(function () {
  'use strict';

  const cfg = window.AgentraConfig || {};
  const PREVIEW = Boolean(cfg.preview);
  const WIDGET_KEY = cfg.widgetKey || cfg.key || (PREVIEW ? 'preview' : '');
  const API_BASE = (cfg.apiBase || 'http://localhost:5000/api/v1/widget').replace(/\/$/, '');
  const STYLE_ATTR = 'data-agentra-widget-style';

  let agentCfg = null;
  let sessionToken = null;
  let visitorEmail = null;
  let ws = null;
  let isOpen = false;
  let inChat = false;
  let emailVerified = false;
  let freeHandMode = false;
  let lastMessageTs = null;
  let messagesEl, inputEl, sendBtnEl, typingEl, badgeEl, processStepsEl;
  let tabHomeEl, tabChatEl, emailGateEl, emailInputEl, emailBtnEl, emailErrorEl;
  let inputBarEl;
  let unreadCount = 0;
  let notificationAudio = null;
  let notificationEventsWired = false;
  const seenMessageKeys = new Set();

  function resetMessagesCanvas() {
    if (!messagesEl) return;
    const privacyText =
      agentCfg?.privacyNotice ||
      'This chat is AI-powered for faster assistance. Chats are monitored and recorded.';
    const privacyLabel = agentCfg?.privacyPolicyLabel || 'Privacy Policy';
    const privacyUrl = agentCfg?.privacyPolicyUrl || '';
    const privacyLink = privacyUrl
      ? '<a class="agt-privacy-link" href="' +
        esc(privacyUrl) +
        '" target="_blank" rel="noopener">' +
        esc(privacyLabel) +
        '</a>'
      : '<span class="agt-privacy-link">' + esc(privacyLabel) + '</span>';

    // Keep live status nodes across canvas resets (they live in the message list)
    const keep = [];
    if (processStepsEl) keep.push(processStepsEl);
    if (typingEl) keep.push(typingEl);
    keep.forEach(function (el) {
      el.remove();
    });

    messagesEl.innerHTML =
      '<div class="agt-chat-privacy" id="agt-chat-privacy">' +
      '<div class="agt-privacy-note"><p>' +
      esc(privacyText) +
      ' ' +
      privacyLink +
      '</p></div></div>';

    keep.forEach(function (el) {
      messagesEl.appendChild(el);
    });
    processStepsEl?.classList.remove('visible');
    if (typingEl) {
      typingEl.classList.remove('visible');
      typingEl.setAttribute('aria-hidden', 'true');
    }
    lastMessageTs = null;
  }

  function pinLiveIndicators() {
    if (!messagesEl) return;
    if (processStepsEl) messagesEl.appendChild(processStepsEl);
    if (typingEl) messagesEl.appendChild(typingEl);
  }

  function historyStorageKey() {
    return 'agentra_chat_history_' + (WIDGET_KEY || 'default');
  }

  function loadChatHistory() {
    try {
      const raw = localStorage.getItem(historyStorageKey());
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function saveChatHistoryEntry(entry) {
    if (!entry?.sessionToken) return;
    const list = loadChatHistory().filter(function (h) {
      return h.sessionToken !== entry.sessionToken;
    });
    list.unshift(entry);
    localStorage.setItem(historyStorageKey(), JSON.stringify(list.slice(0, 5)));
    renderChatHistory();
  }

  function renderChatHistory() {
    const listEl = document.getElementById('agt-history-list');
    const emptyEl = document.getElementById('agt-history-empty');
    if (!listEl) return;
    const history = loadChatHistory().slice(0, 5);
    listEl.querySelectorAll('.agt-history-item').forEach(function (el) {
      el.remove();
    });
    if (!history.length) {
      if (emptyEl) emptyEl.classList.remove('gone');
      return;
    }
    if (emptyEl) emptyEl.classList.add('gone');
    history.forEach(function (item) {
      const row = document.createElement('div');
      row.className = 'agt-history-item';
      row.setAttribute('data-session', item.sessionToken || '');
      const initial = esc(String(item.agentName || agentCfg?.agentName || 'C').charAt(0).toUpperCase());
      const av = agentCfg?.faviconUrl
        ? '<img src="' + esc(agentCfg.faviconUrl) + '" alt="">'
        : initial;
      const when = item.updatedAt
        ? new Date(item.updatedAt).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : '';
      row.innerHTML =
        '<div class="agt-history-av">' +
        av +
        '</div><div class="agt-history-text"><div class="agt-history-title">' +
        esc(item.preview || 'Previous conversation') +
        '</div><div class="agt-history-sub">' +
        esc(when) +
        (item.email ? ' · ' + esc(item.email) : '') +
        '</div></div><span class="agt-history-chevron">' +
        // chevron via CSS/text
        '›</span>';
      row.addEventListener('click', function () {
        resumeChat(item.sessionToken, item.email);
      });
      listEl.appendChild(row);
    });
  }

  function getQuickReplies() {
    const list = agentCfg?.quickReplies;
    return Array.isArray(list) && list.length
      ? list.slice(0, 8)
      : ['Where is my order?', 'Return or refund policy', 'Talk to a human', 'Product recommendations'];
  }

  function getAskAnythingLabel() {
    return agentCfg?.askAnythingLabel || 'Ask me anything';
  }

  function isBotCollectingInfo(text) {
    const t = String(text || '').toLowerCase();
    return /order number|email address|share your|please (share|provide|confirm|enter|send)|what(?:'s| is) your|used when placing|double-check both|try again/i.test(
      t,
    );
  }

  function isAgentsOfflineReply(text) {
    const t = String(text || '').toLowerCase();
    return /don'?t have a teammate|no teammate|not online|no (one|agent).{0,20}online|currently away|when someone is available|team will see this chat/i.test(
      t,
    );
  }

  function isOfferingHumanConnect(text) {
    const t = String(text || '').toLowerCase();
    if (isAgentsOfflineReply(t)) return false;
    return /(connect you with|would you like me to connect|i can connect you|talk to (a )?human|speak (to|with) (an? )?agent)/i.test(
      t,
    );
  }

  function isSimpleFollowUpPrompt(text) {
    const raw = String(text || '').trim();
    if (!raw || raw.length > 320) return false;
    if (isBotCollectingInfo(raw)) return false;
    if (isAgentsOfflineReply(raw)) return true;
    if (isOfferingHumanConnect(raw)) return true;
    const t = raw.toLowerCase();
    if (
      /(anything else|need (any )?more help|does that help|is there anything|glad i could|you(?:'re| are) all set|what else can i help)/i.test(
        t,
      )
    ) {
      return true;
    }
    // Short clear yes/no only
    if (raw.length <= 120 && /\?\s*$/.test(raw) && !/order|email|number|tracking|looking for/i.test(t)) {
      return true;
    }
    return false;
  }

  function buildContextualFollowUps(botText) {
    if (!isSimpleFollowUpPrompt(botText)) return [];
    const items = [];

    if (isAgentsOfflineReply(botText)) {
      items.push({ label: 'Keep helping me', message: 'Please keep helping me here' });
      items.push({ label: 'Leave a note for the team', message: 'Please leave a note for your team' });
    } else if (isOfferingHumanConnect(botText)) {
      items.push({ label: 'Yes, connect me', message: 'Yes, please connect me with an agent' });
      items.push({ label: 'No, keep helping here', message: 'No, please keep helping me here' });
    } else if (/(anything else|more help|does that help|all set|what else can i help)/i.test(botText)) {
      items.push({ label: 'All set, thanks', message: 'All set, thank you' });
      items.push({ label: 'I still need help', message: 'I still need help' });
    } else {
      // Very short yes/no prompts only
      items.push({ label: 'Yes', message: 'Yes' });
      items.push({ label: 'No', message: 'No' });
    }

    items.push({
      action: 'ask-anything',
      label: freeHandMode ? 'Something else…' : 'Type my own reply',
    });
    return items;
  }

  function setFreeHandMode(on) {
    freeHandMode = Boolean(on);
    if (inputBarEl) inputBarEl.classList.toggle('gone', !freeHandMode);
    if (freeHandMode) {
      messagesEl?.querySelectorAll('.agt-choice-stack').forEach(function (el) {
        el.remove();
      });
      resizeComposerInput();
      inputEl?.focus();
    }
  }

  function appendInlineChoices(items) {
    if (!messagesEl || !items?.length) return;
    messagesEl.querySelectorAll('.agt-choice-stack').forEach(function (el) {
      el.remove();
    });
    const wrap = document.createElement('div');
    wrap.className = 'agt-choice-stack';
    wrap.innerHTML = items
      .map(function (item) {
        if (typeof item === 'string') {
          return (
            '<button type="button" class="agt-choice-btn" data-msg="' +
            esc(item) +
            '">' +
            esc(item) +
            '</button>'
          );
        }
        if (item.action === 'ask-anything') {
          return (
            '<button type="button" class="agt-choice-btn" data-action="ask-anything">' +
            esc(item.label || getAskAnythingLabel()) +
            '</button>'
          );
        }
        return (
          '<button type="button" class="agt-choice-btn" data-msg="' +
          esc(item.message || item.label || '') +
          '">' +
          esc(item.label || item.message || '') +
          '</button>'
        );
      })
      .join('');
    messagesEl.appendChild(wrap);
    pinLiveIndicators();
    scrollMessages();
  }

  function appendStarterChoices() {
    appendInlineChoices(
      getQuickReplies()
        .map(function (label) {
          return { label: label, message: label };
        })
        .concat([{ action: 'ask-anything', label: getAskAnythingLabel() }]),
    );
  }

  const STATUS_LABELS = {
    retrieving: 'Searching knowledge…',
    checking_order: 'Looking up your order…',
    searching_products: 'Finding products…',
    thinking: 'Replying…',
  };

  function messageKey(msg) {
    if (!msg || typeof msg !== 'object') return '';
    if (msg._id) return String(msg._id);
    if (msg.id) return String(msg.id);
    return [
      msg.role || '',
      msg.contentType || '',
      String(msg.body || '').trim(),
      msg.sentAt || '',
      msg.senderName || '',
    ].join('|');
  }

  function markMessageSeen(msg) {
    const key = messageKey(msg);
    if (!key) return false;
    if (seenMessageKeys.has(key)) return true;
    seenMessageKeys.add(key);
    return false;
  }

  function updateUnreadIndicators() {
    const hasUnread = unreadCount > 0;
    if (badgeEl) {
      badgeEl.textContent = unreadCount > 9 ? '9+' : String(unreadCount || '');
      badgeEl.classList.toggle('show', hasUnread);
    }
    document.getElementById('agt-tab-unread')?.classList.toggle('show', hasUnread);
  }

  function clearUnreadMessages() {
    unreadCount = 0;
    updateUnreadIndicators();
  }

  function unlockNotificationAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!notificationAudio) notificationAudio = new AudioContext();
      if (notificationAudio.state === 'suspended') {
        notificationAudio.resume().catch(function () {});
      }
    } catch {
      // Audio is optional and may be blocked by the browser.
    }
  }

  function playMessageArrivalSound() {
    if (!notificationAudio || notificationAudio.state !== 'running') return;
    try {
      const now = notificationAudio.currentTime;
      const gain = notificationAudio.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
      gain.connect(notificationAudio.destination);

      [660, 880].forEach(function (frequency, index) {
        const oscillator = notificationAudio.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.connect(gain);
        oscillator.start(now + index * 0.09);
        oscillator.stop(now + 0.18 + index * 0.09);
      });
    } catch {
      // Keep chat functional if audio playback fails.
    }
  }

  function notifyIncomingMessage() {
    playMessageArrivalSound();
    const activelyViewingChat =
      isOpen && inChat && document.visibilityState !== 'hidden';
    if (activelyViewingChat) return;
    unreadCount += 1;
    updateUnreadIndicators();
  }

  function wireNotificationEvents() {
    if (notificationEventsWired) return;
    notificationEventsWired = true;
    document.addEventListener('pointerdown', unlockNotificationAudio, true);
    document.addEventListener('keydown', unlockNotificationAudio, true);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'hidden' && isOpen && inChat) {
        clearUnreadMessages();
      }
    });
  }

  function uid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  async function api(endpoint, method, body) {
    // Settings live-preview: exact UI, no real sessions / network.
    if (PREVIEW) {
      if (String(endpoint || '').indexOf('/session/start') === 0) {
        return {
          sessionToken: 'preview-session',
          messages: [
            {
              role: 'bot',
              body:
                (agentCfg && agentCfg.welcomeMsg) ||
                "I'm here to help with orders, products, and store questions.",
              senderName: (agentCfg && agentCfg.agentName) || 'Support Assistant',
            },
          ],
        };
      }
      if (String(endpoint || '').indexOf('/session/message') === 0) {
        return {
          messages: [
            {
              role: 'bot',
              body: 'Preview only — responses will come from your AI once the widget is live.',
              senderName: (agentCfg && agentCfg.agentName) || 'Support Assistant',
            },
          ],
        };
      }
      if (String(endpoint || '').indexOf('/session/') === 0) {
        return { session: { messages: [], visitorEmail: null } };
      }
      return {};
    }

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
    const name = String(fontFamilyName || 'Plus Jakarta Sans')
      .replace(/['"]/g, '')
      .split(',')[0]
      .trim();
    if (!name) return;

    if (!document.querySelector('link[href*="fonts.googleapis.com"][rel="preconnect"]')) {
      const preconnectApi = document.createElement('link');
      preconnectApi.rel = 'preconnect';
      preconnectApi.href = 'https://fonts.googleapis.com';
      document.head.appendChild(preconnectApi);

      const preconnectStatic = document.createElement('link');
      preconnectStatic.rel = 'preconnect';
      preconnectStatic.href = 'https://fonts.gstatic.com';
      preconnectStatic.crossOrigin = 'anonymous';
      document.head.appendChild(preconnectStatic);
    }

    const id = 'agentra-gf-' + name.replace(/\s+/g, '-');
    if (document.querySelector('#' + id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.crossOrigin = 'anonymous';
    link.href =
      'https://fonts.googleapis.com/css2?family=' +
      encodeURIComponent(name).replace(/%20/g, '+') +
      ':wght@400..800&display=swap';
    document.head.appendChild(link);

    // Bunny Fonts fallback if Google Fonts is blocked by the storefront CSP/theme.
    const bunnyId = id + '-bunny';
    if (!document.querySelector('#' + bunnyId)) {
      const bunny = document.createElement('link');
      bunny.id = bunnyId;
      bunny.rel = 'stylesheet';
      bunny.href =
        'https://fonts.bunny.net/css?family=' +
        encodeURIComponent(name).replace(/%20/g, '+').toLowerCase().replace(/\+/g, '-') +
        ':400,500,600,700,800';
      document.head.appendChild(bunny);
    }
  }

  // Start default font early so it is ready before config/API mount.
  loadFonts('Plus Jakarta Sans');

  function loadFA() {
    if (document.querySelector('#agentra-fa-css')) return;
    const link = document.createElement('link');
    link.id = 'agentra-fa-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(link);
  }

  function connectWebSocket() {
    if (PREVIEW) return;
    if (!sessionToken || !agentCfg?.wsUrl) return;
    try {
      if (ws) ws.close();
      const url = agentCfg.wsUrl + '?session=' + encodeURIComponent(sessionToken) + '&role=visitor';
      ws = new WebSocket(url);
      ws.onmessage = function (ev) {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'message' && msg.data) renderServerMessage(msg.data, true);
          if (msg.type === 'system_event' && msg.data?.event === 'agent_joined') {
            clearConnectingIndicator();
            addSystemEvent((msg.data.agentName || 'An agent') + ' joined the chat');
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

  function syncLiveIndicatorPad() {
    pinLiveIndicators();
    updateCustomScrollbar();
  }

  function showProcessStatus(status) {
    if (!processStepsEl || !agentCfg?.behavior?.retrievalIndicator) return;
    const label = STATUS_LABELS[status] || 'Working on it…';
    processStepsEl.querySelector('.agt-process-label').textContent = label;
    processStepsEl.classList.add('visible');
    if (typingEl) {
      typingEl.classList.remove('visible');
      typingEl.setAttribute('aria-hidden', 'true');
    }
    pinLiveIndicators();
    scrollMessages();
  }

  function hideProcessStatus() {
    processStepsEl?.classList.remove('visible');
    updateCustomScrollbar();
  }

  function toggleTyping(show) {
    if (!typingEl) return;
    if (show && processStepsEl?.classList.contains('visible')) {
      return;
    }
    typingEl.classList.toggle('visible', show);
    typingEl.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (show) {
      pinLiveIndicators();
      scrollMessages();
    } else {
      updateCustomScrollbar();
    }
  }

  function resizeComposerInput() {
    if (!inputEl) return;
    const MIN = 36;
    const MAX = 96;
    // Keep a stable single-line size; only grow when content truly wraps / has newlines.
    inputEl.style.lineHeight = '20px';
    inputEl.style.height = MIN + 'px';
    inputEl.style.overflowY = 'hidden';
    if (!inputEl.value) return;

    // Force layout, then measure. Cap runaway scrollHeight from browser quirks.
    void inputEl.offsetHeight;
    const needed = inputEl.scrollHeight;
    if (needed <= MIN + 2) return;

    const next = Math.min(Math.max(needed, MIN), MAX);
    inputEl.style.height = next + 'px';
    if (next >= MAX) inputEl.style.overflowY = 'auto';
  }

  function scrollMessages() {
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
      updateCustomScrollbar();
    }
  }

  function updateCustomScrollbar() {
    const rail = document.getElementById('agt-scroll');
    const thumb = document.getElementById('agt-scroll-thumb');
    const wrap = messagesEl && messagesEl.parentElement;
    if (!messagesEl || !rail || !thumb || !wrap) return;

    const viewH = messagesEl.clientHeight;
    const scrollH = messagesEl.scrollHeight;
    const maxScroll = Math.max(0, scrollH - viewH);

    if (maxScroll <= 2) {
      rail.classList.remove('is-visible');
      thumb.style.height = '0px';
      return;
    }

    const railH = rail.clientHeight || viewH;
    const thumbH = Math.max(28, Math.round((viewH / scrollH) * railH));
    const maxThumbTop = Math.max(0, railH - thumbH);
    const thumbTop = maxScroll === 0 ? 0 : Math.round((messagesEl.scrollTop / maxScroll) * maxThumbTop);

    thumb.style.height = thumbH + 'px';
    thumb.style.transform = 'translateY(' + thumbTop + 'px)';
    rail.classList.add('is-visible');
  }

  function wireCustomScrollbar() {
    const rail = document.getElementById('agt-scroll');
    const thumb = document.getElementById('agt-scroll-thumb');
    const wrap = messagesEl && messagesEl.parentElement;
    if (!messagesEl || !rail || !thumb || !wrap) return;

    let hideTimer = null;
    let dragging = false;
    let dragStartY = 0;
    let dragStartScroll = 0;
    let touchStartY = 0;
    let touchStartScroll = 0;

    function maxScrollTop() {
      return Math.max(0, messagesEl.scrollHeight - messagesEl.clientHeight);
    }

    function setScrollTop(next) {
      const max = maxScrollTop();
      messagesEl.scrollTop = Math.max(0, Math.min(max, next));
      updateCustomScrollbar();
      flashScrolling();
    }

    function flashScrolling() {
      wrap.classList.add('is-scrolling');
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        wrap.classList.remove('is-scrolling');
      }, 800);
    }

    // overflow:hidden kills native scrollbar chrome (Windows arrows). Drive scroll ourselves.
    messagesEl.addEventListener('wheel', function (e) {
      // Always stop page scroll chaining, even when content fits / is at an edge.
      e.preventDefault();
      if (maxScrollTop() <= 0) return;
      setScrollTop(messagesEl.scrollTop + e.deltaY);
    }, { passive: false });

    messagesEl.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches.length) return;
      touchStartY = e.touches[0].clientY;
      touchStartScroll = messagesEl.scrollTop;
    }, { passive: true });

    messagesEl.addEventListener('touchmove', function (e) {
      if (!e.touches || !e.touches.length) return;
      // Block page scroll even when the thread itself cannot move further.
      e.preventDefault();
      if (maxScrollTop() <= 0) return;
      const dy = touchStartY - e.touches[0].clientY;
      setScrollTop(touchStartScroll + dy);
    }, { passive: false });

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(function () {
        updateCustomScrollbar();
      });
      ro.observe(messagesEl);
      ro.observe(wrap);
    }

    thumb.addEventListener('mousedown', function (e) {
      e.preventDefault();
      dragging = true;
      thumb.classList.add('is-dragging');
      dragStartY = e.clientY;
      dragStartScroll = messagesEl.scrollTop;
      wrap.classList.add('is-scrolling');

      function onMove(ev) {
        if (!dragging) return;
        const viewH = messagesEl.clientHeight;
        const scrollH = messagesEl.scrollHeight;
        const maxScroll = Math.max(0, scrollH - viewH);
        const railH = rail.clientHeight || viewH;
        const thumbH = thumb.offsetHeight || 28;
        const maxThumbTop = Math.max(1, railH - thumbH);
        const delta = ev.clientY - dragStartY;
        setScrollTop(dragStartScroll + (delta / maxThumbTop) * maxScroll);
      }

      function onUp() {
        dragging = false;
        thumb.classList.remove('is-dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        flashScrolling();
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // Click on rail jumps thumb
    rail.addEventListener('mousedown', function (e) {
      if (e.target === thumb) return;
      const rect = rail.getBoundingClientRect();
      const viewH = messagesEl.clientHeight;
      const scrollH = messagesEl.scrollHeight;
      const maxScroll = Math.max(0, scrollH - viewH);
      const railH = rail.clientHeight || viewH;
      const thumbH = thumb.offsetHeight || 28;
      const maxThumbTop = Math.max(1, railH - thumbH);
      const y = e.clientY - rect.top - thumbH / 2;
      setScrollTop((Math.max(0, Math.min(maxThumbTop, y)) / maxThumbTop) * maxScroll);
    });

    updateCustomScrollbar();
  }

  function isElementScrollableY(el) {
    if (!(el instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') return false;
    return el.scrollHeight > el.clientHeight + 1;
  }

  function canScrollInDirection(el, deltaY) {
    if (!isElementScrollableY(el)) return false;
    const top = el.scrollTop;
    const max = el.scrollHeight - el.clientHeight;
    if (deltaY < 0) return top > 0;
    if (deltaY > 0) return top < max - 1;
    return false;
  }

  /** Keep wheel/touch scrolling inside the open panel — never chain to the host page. */
  function wirePanelScrollContainment() {
    const panel = document.getElementById('agt-panel');
    if (!panel || panel.dataset.agtScrollLock === '1') return;
    panel.dataset.agtScrollLock = '1';

    panel.addEventListener(
      'wheel',
      function (e) {
        let node = e.target instanceof Element ? e.target : null;
        while (node && node !== panel) {
          if (node.id === 'agt-messages') {
            // Messages uses a custom scroller that already preventDefaults.
            e.preventDefault();
            return;
          }
          if (isElementScrollableY(node)) {
            if (!canScrollInDirection(node, e.deltaY)) e.preventDefault();
            return;
          }
          node = node.parentElement;
        }
        e.preventDefault();
      },
      { passive: false },
    );

    let touchStartY = 0;
    panel.addEventListener(
      'touchstart',
      function (e) {
        if (!e.touches || !e.touches.length) return;
        touchStartY = e.touches[0].clientY;
      },
      { passive: true },
    );

    panel.addEventListener(
      'touchmove',
      function (e) {
        if (!e.touches || !e.touches.length) return;
        const deltaY = touchStartY - e.touches[0].clientY;
        let node = e.target instanceof Element ? e.target : null;
        while (node && node !== panel) {
          if (node.id === 'agt-messages') {
            // Handled by the messages custom touch scroller.
            return;
          }
          if (isElementScrollableY(node)) {
            if (!canScrollInDirection(node, deltaY)) e.preventDefault();
            return;
          }
          node = node.parentElement;
        }
        e.preventDefault();
      },
      { passive: false },
    );
  }

  const TIME_GAP_MS = 15 * 60 * 1000;

  function formatIntervalLabel(d) {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    const time = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const sameDay = dt.toDateString() === new Date().toDateString();
    if (sameDay) return time;
    return (
      dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + time
    );
  }

  function addTimeSepIfNeeded(ts) {
    if (!messagesEl) return;
    const at = ts instanceof Date ? ts : new Date(ts);
    if (Number.isNaN(at.getTime())) return;
    const shouldShow =
      !lastMessageTs ||
      lastMessageTs.toDateString() !== at.toDateString() ||
      at.getTime() - lastMessageTs.getTime() > TIME_GAP_MS;
    if (shouldShow) {
      const sep = document.createElement('div');
      sep.className = 'agt-date-sep';
      sep.textContent = formatIntervalLabel(at);
      messagesEl.appendChild(sep);
    }
    lastMessageTs = at;
  }

  function addCustomerMessage(text) {
    addTimeSepIfNeeded(new Date());
    const row = document.createElement('div');
    row.className = 'agt-msg-row customer';
    row.innerHTML = '<div class="agt-bubble">' + esc(text) + '</div>';
    messagesEl.appendChild(row);
    pinLiveIndicators();
    scrollMessages();
  }

  function addSystemEvent(text) {
    const el = document.createElement('div');
    el.className = 'agt-system-event';
    el.textContent = text;
    messagesEl.appendChild(el);
    pinLiveIndicators();
    scrollMessages();
  }

  function clearConnectingIndicator() {
    if (!messagesEl) return;
    messagesEl.querySelectorAll('.agt-connecting').forEach(function (el) {
      el.remove();
    });
  }

  function addConnectingIndicator(text) {
    clearConnectingIndicator();
    const el = document.createElement('div');
    el.className = 'agt-connecting';
    el.innerHTML =
      '<span class="agt-status-ring" aria-hidden="true"></span><span>' +
      esc(text || 'Connecting with an agent…') +
      '</span>';
    messagesEl.appendChild(el);
    pinLiveIndicators();
    scrollMessages();
  }

  function applyHandoffState(handoffState, clearConnectingFlag) {
    if (clearConnectingFlag) {
      clearConnectingIndicator();
      return;
    }
    if (!handoffState || !handoffState.display) return;
    if (handoffState.display.removeStatusComponent || handoffState.display.showSpinner === false) {
      if (
        handoffState.status === 'cancelled_by_customer' ||
        handoffState.status === 'unavailable' ||
        handoffState.status === 'outside_business_hours' ||
        handoffState.status === 'offered' ||
        handoffState.status === 'not_requested'
      ) {
        clearConnectingIndicator();
      }
    }
    if (handoffState.display.showSpinner) {
      addConnectingIndicator('Connecting with an agent…');
    }
  }

  function formatMoney(currency, amount) {
    if (amount == null || amount === '') return '';
    const n = Number(amount);
    const code = currency || '';
    if (!Number.isFinite(n)) return (code ? code + ' ' : '') + String(amount);
    const formatted = n.toLocaleString(undefined, {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    });
    return (code ? code + ' ' : '$') + formatted;
  }

  function orderStepIndex(status) {
    const s = String(status || '').toLowerCase();
    if (/deliver|complete/.test(s)) return 3;
    if (/ship|transit/.test(s)) return 2;
    if (/pack|process|ready|partial/.test(s)) return 1;
    if (/fulfill/.test(s) && !/unfulfill/.test(s)) return 3;
    return 0;
  }

  function buildOrderOutcome(kind, label) {
    const title =
      kind === 'refunded'
        ? 'Marked refunded by store'
        : kind === 'cancelled'
          ? 'Order cancelled'
          : 'Order update';
    const detail =
      kind === 'refunded'
        ? 'The store marked this order as refunded. That does not by itself confirm when funds will appear in your account.'
        : kind === 'cancelled'
          ? 'This order is cancelled and will not ship.'
          : label;
    return (
      '<div class="agt-order-outcome agt-order-outcome-' +
      esc(kind) +
      '">' +
      '<div class="agt-order-outcome-title">' +
      esc(title) +
      '</div>' +
      '<div class="agt-order-outcome-detail">' +
      esc(detail) +
      '</div></div>'
    );
  }

  function buildOrderStepper(activeIdx) {
    const steps = ['Placed', 'Packed', 'Shipped', 'Delivered'];
    return (
      '<div class="agt-order-stepper">' +
      steps
        .map(function (label, i) {
          const cls = i < activeIdx ? 'done' : i === activeIdx ? 'active' : '';
          return (
            '<div class="agt-order-step ' +
            cls +
            '"><span class="agt-order-step-dot"></span><span class="agt-order-step-label">' +
            label +
            '</span></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function buildOrderCard(payload) {
    const fulfillment = payload.fulfillmentStatus || '';
    const financial = payload.financialStatus || '';
    const fin = String(financial).toLowerCase();
    const ful = String(fulfillment).toLowerCase();
    const isRefunded = /refund/.test(fin);
    const isCancelled = /cancel|void/.test(fin) || ful === 'cancelled';
    const badgeRaw = financial || fulfillment || 'Update';
    const badge = String(badgeRaw).replace(/_/g, ' ');
    const total =
      payload.totalDisplay ||
      formatMoney(payload.currency, payload.totalPrice != null ? payload.totalPrice : payload.total);
    const items = (payload.lineItems || [])
      .slice(0, 4)
      .map(function (li) {
        return (
          '<div class="agt-order-item">' +
          esc(li.title) +
          ' × ' +
          (li.quantity || 1) +
          '</div>'
        );
      })
      .join('');

    let middle = '';
    if (isRefunded) {
      middle = buildOrderOutcome('refunded');
    } else if (isCancelled) {
      middle = buildOrderOutcome('cancelled');
    } else {
      middle = buildOrderStepper(orderStepIndex(fulfillment || financial));
    }

    const tracking =
      !isRefunded && !isCancelled && payload.tracking?.url
        ? '<a class="agt-order-track-btn" href="' +
          esc(payload.tracking.url) +
          '" target="_blank" rel="noopener">Track shipment</a>'
        : '';

    return (
      '<div class="agt-order-card">' +
      '<div class="agt-order-top">' +
      '<div><div class="agt-order-id">' +
      esc(payload.orderNumber ? 'Order ' + payload.orderNumber : 'Order update') +
      '</div>' +
      (total ? '<div class="agt-order-total">' + esc(total) + '</div>' : '') +
      '</div>' +
      '<span class="agt-order-badge' +
      (isRefunded ? ' is-refunded' : isCancelled ? ' is-cancelled' : '') +
      '">' +
      esc(badge) +
      '</span></div>' +
      middle +
      (items ? '<div class="agt-order-items">' + items + '</div>' : '') +
      tracking +
      '</div>'
    );
  }

  function buildInputForm(payload) {
    if (!payload || !payload.fields || !payload.fields.length) return '';
    const summary =
      Array.isArray(payload.summaryLines) && payload.summaryLines.length
        ? '<div class="agt-form-summary">' +
          payload.summaryLines
            .map(function (line) {
              return '<div class="agt-form-summary-line">' + esc(line) + '</div>';
            })
            .join('') +
          '</div>'
        : '';
    const fieldsHtml = payload.fields
      .map(function (f) {
        if (f.type === 'hidden') {
          return (
            '<input type="hidden" class="agt-form-input" name="' +
            esc(f.name) +
            '" value="' +
            esc(f.value || '') +
            '" />'
          );
        }
        const type = f.type || 'text';
        const req = f.required ? ' required' : '';
        const ph = f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '';
        const ac = f.autocomplete ? ' autocomplete="' + esc(f.autocomplete) + '"' : '';
        const im = f.inputMode ? ' inputmode="' + esc(f.inputMode) + '"' : '';
        return (
          '<label class="agt-form-field">' +
          '<span class="agt-form-label">' +
          esc(f.label || f.name) +
          (f.required ? '' : ' <em>(optional)</em>') +
          '</span>' +
          '<input class="agt-form-input" type="' +
          esc(type) +
          '" name="' +
          esc(f.name) +
          '"' +
          ph +
          ac +
          im +
          req +
          ' />' +
          '</label>'
        );
      })
      .join('');
    const title = payload.title
      ? '<div class="agt-form-title">' + esc(payload.title) + '</div>'
      : '';
    const actionAttrs =
      (payload._actionId ? ' data-action-id="' + esc(payload._actionId) + '"' : '') +
      (payload._confirmationToken
        ? ' data-confirm-token="' + esc(payload._confirmationToken) + '"'
        : '');
    return (
      '<form class="agt-input-form" data-form-id="' +
      esc(payload.formId || 'form') +
      '"' +
      actionAttrs +
      ' novalidate>' +
      title +
      summary +
      fieldsHtml +
      '<button type="submit" class="agt-form-submit">' +
      esc(payload.submitLabel || 'Submit') +
      '</button>' +
      '</form>'
    );
  }

  function formatFormValuesMessage(formId, values, formEl) {
    if (formId === 'action_confirm' || (formEl && formEl.getAttribute('data-action-id'))) {
      const actionId = (formEl && formEl.getAttribute('data-action-id')) || values.actionId;
      const token =
        (formEl && formEl.getAttribute('data-confirm-token')) || values.confirmationToken;
      if (/^\s*yes\s*$/i.test(values.confirmPayload || '') || values.confirmPayload) {
        return 'Yes, create the return\nactionId:' + actionId + '\nconfirmationToken:' + token;
      }
    }
    if (formId === 'return_reason') {
      return values.returnReason || '';
    }
    if (formId === 'refund_method') {
      return 'refundMethod:' + (values.refundMethod || '');
    }
    if (formId === 'select_return_item') {
      return values.selectedLineItemId || '';
    }
    if (formId === 'contact_request') {
      const parts = [];
      if (values.email) parts.push(values.email);
      if (values.phone) parts.push(values.phone);
      return parts.join(', ') || 'contact request';
    }
    if (formId === 'order_lookup') {
      const parts = [];
      if (values.orderNumber) {
        parts.push('Order #' + String(values.orderNumber).replace(/^#/, '').trim());
      }
      if (values.email) parts.push(String(values.email).trim());
      return parts.join(', ');
    }
    if (formId === 'shipping_address') {
      const lines = ['New shipping address:'];
      if (values.name) lines.push('Name: ' + values.name);
      if (values.address1) lines.push('Address: ' + values.address1);
      if (values.address2) lines.push('Address 2: ' + values.address2);
      if (values.city) lines.push('City: ' + values.city);
      if (values.province) lines.push('State: ' + values.province);
      if (values.zip) lines.push('ZIP: ' + values.zip);
      if (values.country) lines.push('Country: ' + values.country);
      if (values.phone) lines.push('Phone: ' + values.phone);
      return lines.join('\n');
    }
    return Object.keys(values)
      .filter(function (k) {
        return values[k];
      })
      .map(function (k) {
        return k + ': ' + values[k];
      })
      .join('\n');
  }

  function disableInputForm(form) {
    if (!form) return;
    form.classList.add('is-submitted');
    form.querySelectorAll('input, button').forEach(function (el) {
      el.disabled = true;
    });
  }

  function buildChoiceStack(choices) {
    if (!choices || !choices.length) return '';
    return (
      '<div class="agt-choice-stack">' +
      choices
        .map(function (c) {
          return (
            '<button type="button" class="agt-choice-btn" data-msg="' +
            esc(c) +
            '">' +
            esc(c) +
            '</button>'
          );
        })
        .join('') +
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

  function agentAvatarHtml() {
    const url = agentCfg?.faviconUrl || agentCfg?.logoUrl || '';
    const name = agentCfg?.agentName || 'Assistant';
    if (url) {
      return (
        '<div class="agt-agent-av"><img src="' +
        esc(url) +
        '" alt=""></div>'
      );
    }
    const initial = esc(String(name).charAt(0).toUpperCase() || 'A');
    return '<div class="agt-agent-av agt-agent-av-fallback">' + initial + '</div>';
  }

  function agentMessageShell(name, bodyHtml, extraHtml) {
    return (
      '<div class="agt-agent-row">' +
      agentAvatarHtml() +
      '<div class="agt-agent-col">' +
      '<div class="agt-msg-meta"><span class="agt-msg-name">' +
      esc(name) +
      '</span></div>' +
      (bodyHtml || '') +
      (extraHtml || '') +
      '</div></div>'
    );
  }

  function addAgentMessage(msg) {
    if (markMessageSeen(msg)) return false;
    hideProcessStatus();
    toggleTyping(false);
    const at = msg.sentAt ? new Date(msg.sentAt) : new Date();
    addTimeSepIfNeeded(at);

    if (msg.contentType === 'system_event') {
      if (msg.payload?.type === 'handoff_requested') {
        addConnectingIndicator(msg.body || 'Connecting with an agent…');
        return false;
      }
      if (msg.payload?.type === 'agent_joined') {
        clearConnectingIndicator();
      }
      addSystemEvent(msg.body || 'Update');
      return false;
    }

    const row = document.createElement('div');
    row.className = 'agt-msg-row agent';
    const name = msg.senderName || agentCfg?.agentName || 'Assistant';
    const bodyHtml = msg.body
      ? '<div class="agt-bubble">' + formatAgentText(msg.body) + '</div>'
      : '';

    if (msg.contentType === 'order_card' && msg.payload) {
      row.innerHTML = agentMessageShell(name, bodyHtml, buildOrderCard(msg.payload));
    } else if (msg.contentType === 'product_cards' && msg.payload?.products) {
      row.innerHTML = agentMessageShell(name, bodyHtml, buildProductGrid(msg.payload.products));
    } else if (msg.contentType === 'input_form' && msg.payload?.fields) {
      row.innerHTML = agentMessageShell(name, bodyHtml, buildInputForm(msg.payload));
    } else {
      row.innerHTML = agentMessageShell(
        name,
        '<div class="agt-bubble">' + formatAgentText(msg.body || '') + '</div>',
      );
    }

    messagesEl.appendChild(row);
    if (
      msg.role === 'bot' &&
      msg.contentType === 'text' &&
      msg.body &&
      freeHandMode
    ) {
      const followUps = buildContextualFollowUps(msg.body);
      if (followUps.length) {
        appendInlineChoices(followUps);
      } else {
        messagesEl.querySelectorAll('.agt-choice-stack').forEach(function (el) {
          el.remove();
        });
      }
    }
    pinLiveIndicators();
    scrollMessages();
    return true;
  }

  function renderServerMessage(msg, shouldNotify) {
    if (!msg) return false;
    if (msg.role === 'customer') {
      // Visitor already paints their own bubble optimistically.
      markMessageSeen(msg);
      return false;
    }
    const added = addAgentMessage(msg);
    if (added && shouldNotify) notifyIncomingMessage();
    return added;
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
    clearUnreadMessages();
    if (freeHandMode) {
      setFreeHandMode(true);
    } else if (inputBarEl) {
      inputBarEl.classList.add('gone');
    }
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
      freeHandMode = false;
      seenMessageKeys.clear();
      resetMessagesCanvas();
      (data.messages || []).forEach(function (m) {
        renderServerMessage(m);
      });
      const preview =
        (data.messages || []).find(function (m) {
          return m.role === 'bot' && m.body;
        })?.body || 'New conversation';
      saveChatHistoryEntry({
        sessionToken: sessionToken,
        email: email,
        preview: String(preview).slice(0, 80),
        agentName: agentCfg?.agentName,
        updatedAt: new Date().toISOString(),
      });
      connectWebSocket();
      showChatScreen();
      appendStarterChoices();
    } catch (err) {
      showEmailError(err.message || 'Could not start chat');
    } finally {
      emailBtnEl.disabled = false;
    }
  }

  async function resumeChat(token, email) {
    if (!token) return;
    try {
      const data = await api('/session/' + encodeURIComponent(token));
      sessionToken = token;
      visitorEmail = email || data?.session?.visitorEmail || visitorEmail;
      emailVerified = true;
      freeHandMode = true;
      seenMessageKeys.clear();
      resetMessagesCanvas();
      (data.session?.messages || []).forEach(function (m) {
        if (m.role === 'customer') {
          addCustomerMessage(m.body || '');
          markMessageSeen(m);
        } else {
          renderServerMessage(m);
        }
      });
      connectWebSocket();
      setFreeHandMode(true);
      showChatScreen();
    } catch (err) {
      showEmailGate();
      showEmailError(err.message || 'Could not open that chat');
    }
  }

  function startNewChat() {
    if (ws) {
      try {
        ws.close();
      } catch {
        // ignore
      }
      ws = null;
    }
    sessionToken = null;
    freeHandMode = false;
    seenMessageKeys.clear();
    resetMessagesCanvas();
    if (inputEl) {
      inputEl.value = '';
      sendBtnEl && (sendBtnEl.disabled = true);
    }
    if (inputBarEl) inputBarEl.classList.add('gone');
    if (emailVerified && visitorEmail) {
      startChatWithEmail(visitorEmail);
    } else {
      showEmailGate();
    }
  }

  async function sendMessage(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed || !sessionToken) return;
    // Choosing a suggestion or typing enters free-hand thereafter
    setFreeHandMode(true);
    document.querySelectorAll('.agt-choice-stack').forEach(function (el) {
      el.remove();
    });
    document.querySelectorAll('.agt-input-form:not(.is-submitted)').forEach(function (form) {
      disableInputForm(form);
    });

    // Declining handoff must clear connecting UI immediately (before server round-trip)
    if (
      /keep helping|don'?t connect|continue with (the )?ai|no[,.]?\s+(please\s+)?keep/i.test(trimmed)
    ) {
      clearConnectingIndicator();
    }

    addCustomerMessage(trimmed);
    inputEl.value = '';
    sendBtnEl.disabled = true;
    resizeComposerInput();
    toggleTyping(true);
    showProcessStatus('thinking');
    try {
      const data = await api('/session/message', 'POST', {
        sessionToken: sessionToken,
        message: trimmed,
      });
      if (data && (data.widgetBuild || data.orchestratorBuild)) {
        console.info('[Agentra builds]', {
          widgetBuild: data.widgetBuild || '2026-07-16-01',
          orchestratorBuild: data.orchestratorBuild,
          turnDebug: data.turnDebug || null,
        });
      }
      toggleTyping(false);
      hideProcessStatus();
      applyHandoffState(data.handoffState, data.clearConnecting);
      (data.messages || []).forEach(function (m) {
        if (addAgentMessage(m)) notifyIncomingMessage();
      });
      saveChatHistoryEntry({
        sessionToken: sessionToken,
        email: visitorEmail,
        preview: trimmed.slice(0, 80),
        agentName: agentCfg?.agentName,
        updatedAt: new Date().toISOString(),
      });
      // Only show connecting when backend explicitly requested a real handoff queue
      if (
        data.handoff &&
        data.handoffState &&
        data.handoffState.display &&
        data.handoffState.display.showSpinner
      ) {
        if (
          !(data.messages || []).some(function (m) {
            return m.payload?.type === 'handoff_requested';
          })
        ) {
          addConnectingIndicator('Connecting with an agent…');
        }
      }
    } catch (err) {
      toggleTyping(false);
      hideProcessStatus();
      addAgentMessage({
        role: 'bot',
        body: err.message || 'Something went wrong. Please try again.',
        senderName: agentCfg?.agentName,
      });
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
    inputBarEl = document.getElementById('agt-input-bar');
    wireNotificationEvents();
    wireCustomScrollbar();
    wirePanelScrollContainment();

    function openPanel() {
      isOpen = true;
      panel.classList.add('open');
      launcher.classList.add('open');
      if (inChat) clearUnreadMessages();
      renderChatHistory();
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
      renderChatHistory();
    });

    tabChatEl?.addEventListener('click', function () {
      if (!emailVerified) showEmailGate();
      else showChatScreen();
    });

    backBtn?.addEventListener('click', function () {
      tabHomeEl?.click();
    });

    document.getElementById('agt-new-chat-btn')?.addEventListener('click', function () {
      startNewChat();
    });

    document.querySelectorAll('.agt-qr-item').forEach(function (el) {
      el.addEventListener('click', function () {
        goToChat(el.getAttribute('data-msg'));
      });
    });

    messagesEl?.addEventListener('click', function (ev) {
      const btn = ev.target && ev.target.closest ? ev.target.closest('.agt-choice-btn') : null;
      if (!btn) return;
      if (btn.getAttribute('data-action') === 'ask-anything') {
        setFreeHandMode(true);
        return;
      }
      const msg = btn.getAttribute('data-msg');
      if (msg) sendMessage(msg);
    });

    messagesEl?.addEventListener('submit', function (ev) {
      const form = ev.target && ev.target.closest ? ev.target.closest('.agt-input-form') : null;
      if (!form || form.classList.contains('is-submitted')) return;
      ev.preventDefault();
      const formId = form.getAttribute('data-form-id') || 'form';
      const values = {};
      let valid = true;
      form.querySelectorAll('.agt-form-input').forEach(function (input) {
        const val = String(input.value || '').trim();
        if (input.required && !val) {
          valid = false;
          input.classList.add('is-invalid');
        } else {
          input.classList.remove('is-invalid');
          if (val) values[input.name] = val;
        }
      });
      if (!valid) return;
      if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
        const emailInput = form.querySelector('[name="email"]');
        if (emailInput) emailInput.classList.add('is-invalid');
        return;
      }
      const msg = formatFormValuesMessage(formId, values, form);
      if (!msg) return;
      disableInputForm(form);
      sendMessage(msg);
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
      resizeComposerInput();
    });
    inputEl?.addEventListener('focus', function () {
      resizeComposerInput();
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

    renderChatHistory();
  }

  function openPreviewPanel() {
    if (!PREVIEW) return;
    const panel = document.getElementById('agt-panel');
    const launcher = document.getElementById('agt-launcher');
    const badge = document.getElementById('agt-badge');
    if (!panel || !launcher) return;
    isOpen = true;
    panel.classList.add('open');
    launcher.classList.add('open');
    badge?.classList.remove('show');
  }

  function mount(cfgData) {
    agentCfg = cfgData;
    // Preview always renders so merchants can style before enabling.
    if (!PREVIEW && !agentCfg?.enabled) return;

    const rootId = 'agentra-widget-root';
    let root = document.getElementById(rootId);
    if (!root) {
      root = document.createElement('div');
      root.id = rootId;
      document.body.appendChild(root);
    }

    const brand = agentCfg.widgetColor || '#2563eb';
    const fontName = String(agentCfg.fontFamily || 'Plus Jakarta Sans')
      .replace(/['"]/g, '')
      .split(',')[0]
      .trim() || 'Plus Jakarta Sans';
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

    // Reset interaction state when remounting from settings edits.
    sessionToken = null;
    visitorEmail = null;
    inChat = false;
    emailVerified = false;
    freeHandMode = false;
    lastMessageTs = null;
    unreadCount = 0;
    seenMessageKeys.clear();
    isOpen = false;

    root.innerHTML = buildHTML(agentCfg);
    wireEvents();
    updateUnreadIndicators();

    if (agentCfg.position === 'bottom-left') {
      root.style.setProperty('--launcher-left', agentCfg.launcherOffsetX + 'px');
      root.style.setProperty('--launcher-right', 'auto');
    }

    if (PREVIEW) {
      requestAnimationFrame(function () {
        openPreviewPanel();
      });
    }
  }

  async function init() {
    if (PREVIEW) {
      const initial = cfg.previewConfig && typeof cfg.previewConfig === 'object'
        ? cfg.previewConfig
        : {
            enabled: true,
            widgetColor: '#2563eb',
            backgroundColor: '#ffffff',
            fontFamily: 'Plus Jakarta Sans',
            storeName: 'Your store',
            agentName: 'Support Assistant',
            welcomeTitle: 'Hi there 👋\nHow can we help?',
            welcomeSubtitle: 'Ask about orders, products, returns & store support.',
            quickReplies: [
              'Where is my order?',
              'Return or refund policy',
              'Talk to a human',
              'Product recommendations',
            ],
          };
      mount({ ...initial, enabled: true });
      window.AgentraWidgetPreview = {
        update: function (next) {
          if (!next || typeof next !== 'object') return;
          mount({ ...next, enabled: true });
        },
      };
      try {
        window.parent.postMessage({ type: 'agentra-preview-ready' }, '*');
      } catch {
        /* ignore */
      }
      return;
    }

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
