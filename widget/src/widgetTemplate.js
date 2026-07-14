/**
 * Agentra Widget Template — pure HTML/CSS string builders (no DOM).
 * Exported for use by widget.js and any other consumer.
 */

// Launcher: closed state (widget sitting in corner, show chat bubble)
const SVG_LAUNCHER_CLOSED = `<svg width="22" height="22" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M3 3H27V10.5H33V33.927L25.1459 30H9V23.427L3 26.427V3ZM9 20.073V10.5H24V6H6V21.573L9 20.073ZM12 13.5V27H25.8541L30 29.073V13.5H12Z" fill="white"/></svg>`;

// Launcher: opened state (panel visible, show X to close)
const SVG_LAUNCHER_OPENED = `<svg width="18" height="18" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.5 1.5L1.50135 21.4987M21.4987 21.5L1.5 1.50142" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Arrow — used for quick-reply chevrons and card arrows (no clipping: extra viewBox padding)
const SVG_ARROW = `<svg width="7" height="10" viewBox="-1 0 9 10" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible"><path d="M6.68552 4.35872L1.43528 0.191346C1.2568 0.0507239 1.02709 -0.0167999 0.796448 0.00356129C0.565808 0.0239225 0.353038 0.130509 0.20473 0.299981C0.0564228 0.469452 -0.0153345 0.687996 0.00517204 0.907755C0.0256786 1.12751 0.136778 1.33058 0.31414 1.47248L4.7577 4.99931L0.31414 8.52614C0.136094 8.66784 0.0243811 8.87107 0.00354121 9.09117C-0.0172987 9.31128 0.054439 9.53026 0.202996 9.70002C0.351552 9.86977 0.564778 9.97642 0.795834 9.99654C1.02689 10.0167 1.25688 9.94858 1.43528 9.80729L6.68552 5.63985C6.78397 5.56151 6.86316 5.46354 6.9175 5.35285C6.97184 5.24217 7 5.12147 7 4.99928C7 4.87709 6.97184 4.7564 6.9175 4.64571C6.86316 4.53503 6.78397 4.43706 6.68552 4.35872Z" fill="currentColor"/></svg>`;

// Tab bar icons — use currentColor so they match brand when active
const SVG_HOME_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.5 2.33497L3 7.50997C2.375 7.94697 2 8.62597 2 9.34997V19.7C2 20.965 3.125 22 4.5 22H19.5C20.875 22 22 20.965 22 19.7V9.34997C22 8.62597 21.625 7.94697 21 7.50997L13.5 2.33497C13.0565 2.03704 12.5343 1.87793 12 1.87793C11.4657 1.87793 10.9435 2.03704 10.5 2.33497ZM7.316 14.366C7.23309 14.2895 7.1358 14.2303 7.02979 14.1918C6.92378 14.1534 6.81117 14.1364 6.69853 14.1418C6.58588 14.1473 6.47545 14.1751 6.37367 14.2237C6.27189 14.2723 6.1808 14.3406 6.10569 14.4248C6.03058 14.5089 5.97297 14.6071 5.9362 14.7137C5.89944 14.8204 5.88426 14.9332 5.89155 15.0458C5.89884 15.1583 5.92845 15.2683 5.97866 15.3693C6.02887 15.4703 6.09867 15.5602 6.184 15.634C7.78279 17.0653 9.85414 17.8552 12 17.852C14.1459 17.8552 16.2172 17.0653 17.816 15.634C17.9013 15.5602 17.9711 15.4703 18.0213 15.3693C18.0716 15.2683 18.1012 15.1583 18.1085 15.0458C18.1157 14.9332 18.1006 14.8204 18.0638 14.7137C18.027 14.6071 17.9694 14.5089 17.8943 14.4248C17.8192 14.3406 17.7281 14.2723 17.6263 14.2237C17.5245 14.1751 17.4141 14.1473 17.3015 14.1418C17.1888 14.1364 17.0762 14.1534 16.9702 14.1918C16.8642 14.2303 16.7669 14.2895 16.684 14.366C15.3967 15.5191 13.7283 16.1553 12 16.152C10.2 16.152 8.56 15.477 7.316 14.366Z" fill="currentColor"/></svg>`;

const SVG_CHAT_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M19 2C19.7956 2 20.5587 2.31607 21.1213 2.87868C21.6839 3.44129 22 4.20435 22 5V20.806C22 22.141 20.387 22.811 19.441 21.868L15.56 18H5C4.20435 18 3.44129 17.6839 2.87868 17.1213C2.31607 16.5587 2 15.7956 2 15V5C2 4.20435 2.31607 3.44129 2.87868 2.87868C3.44129 2.31607 4.20435 2 5 2H19ZM17 7H7a.85.85 0 0 0 0 1.7H17A.85.85 0 0 0 17 7ZM12 11H7a.85.85 0 0 0 0 1.7H12A.85.85 0 0 0 12 11Z" fill="currentColor"/></svg>`;

// Header/input bar icons (replacing text labels)
const SVG_BACK_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SVG_NEW_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const SVG_CLOSE_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SVG_SEND_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const DEFAULT_QUICK_REPLIES = [
  'Where is my order?',
  'Return or refund policy',
  'Talk to a human',
  'Product recommendations',
];

/** HTML-escape for safe use in attributes and text (no DOM). */
export function esc(t) {
  const s = String(t == null ? '' : t);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineFormat(text) {
  return esc(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/** Turn agent plain-text/markdown-lite into readable HTML (paragraphs, lists, bold). */
export function formatAgentText(text) {
  let raw = String(text == null ? '' : text).trim();
  if (!raw) return '';

  const lines = raw.split('\n').map(function (l) { return l.trim(); });
  let html = '';
  let para = [];
  let list = null;
  let listItems = [];

  function flushPara() {
    if (para.length) {
      html += '<p>' + inlineFormat(para.join(' ')) + '</p>';
      para = [];
    }
  }

  function flushList() {
    if (list && listItems.length) {
      html += '<' + list + '>' + listItems.map(function (item) {
        return '<li>' + inlineFormat(item) + '</li>';
      }).join('') + '</' + list + '>';
      list = null;
      listItems = [];
    }
  }

  lines.forEach(function (line) {
    if (!line) {
      flushList();
      flushPara();
      return;
    }
    const bullet = line.match(/^[-•*]\s+(.+)/);
    const numbered = line.match(/^\d+[.)]\s+(.+)/);
    if (bullet) {
      flushPara();
      if (list !== 'ul') { flushList(); list = 'ul'; }
      listItems.push(bullet[1]);
    } else if (numbered) {
      flushPara();
      if (list !== 'ol') { flushList(); list = 'ol'; }
      listItems.push(numbered[1]);
    } else {
      flushList();
      para.push(line);
    }
  });

  flushList();
  flushPara();
  return html || '<p>' + inlineFormat(raw) + '</p>';
}

function darken(hex) {
  const h = (hex || '#002253').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return '#' + [Math.max(0, r - 18), Math.max(0, g - 18), Math.max(0, b - 18)]
    .map(function (x) { return x.toString(16).padStart(2, '0'); })
    .join('');
}

function hexToRgb(hex) {
  const h = (hex || '#002253').replace('#', '');
  if (h.length !== 6) return '0,34,83';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return r + ',' + g + ',' + b;
}

function formatWelcomeTitle(text) {
  return esc(text == null || text === '' ? 'Hi there 👋\nHow can we help?' : text).replace(/\n/g, '<br>');
}

/**
 * Build the widget HTML string. Config c: agentName, storeName, logoUrl, faviconUrl, quickReplies, showBranding.
 */
export function buildHTML(c) {
  const qr = (Array.isArray(c.quickReplies) && c.quickReplies.length ? c.quickReplies : DEFAULT_QUICK_REPLIES).slice(0, 4);
  const faviconInner = c.faviconUrl
    ? '<img src="' + esc(c.faviconUrl) + '" alt="' + esc(c.agentName) + '">'
    : esc(String(c.agentName || 'S').charAt(0).toUpperCase());
  const logoSizePx = typeof c.logoSizePx === 'number' && c.logoSizePx >= 24 && c.logoSizePx <= 64;
  const logoW = Math.min(280, Math.max(24, Number(c.logoWidth) || 0)) || null;
  const logoH = Math.min(120, Math.max(16, Number(c.logoHeight) || 0)) || null;
  let logoSizeAttr = '';
  if (logoW || logoH) {
    logoSizeAttr =
      ' style="' +
      (logoW ? 'max-width:' + logoW + 'px;' : '') +
      (logoH ? 'max-height:' + logoH + 'px;' : logoSizePx ? 'max-height:' + c.logoSizePx + 'px;' : '') +
      'width:auto;height:auto;"';
  } else if (logoSizePx) {
    logoSizeAttr = ' style="max-height:' + c.logoSizePx + 'px;width:auto;height:auto;"';
  }
  const logoSizeClass = logoSizeAttr ? '' : ' agt-hero-logo--' + (c.logoSize || 'medium');
  const heroLogoInner = c.logoUrl
    ? '<div class="agt-hero-logo' + logoSizeClass + '"><img src="' + esc(c.logoUrl) + '" alt="' + esc(c.storeName) + '"' + logoSizeAttr + '></div>'
    : '';
  const heroBrandLine = c.logoUrl
    ? ''
    : '<div class="agt-hero-brand"><i class="fa-solid fa-building-columns"></i> ' + esc(c.storeName) + '</div>';
  const teamAgents = Array.isArray(c.teamAgents) ? c.teamAgents.slice(0, 5) : [];
  const defaultAvatars = [
    { initials: 'J', color: '#a78bfa' },
    { initials: 'A', color: '#f97316' },
    { initials: 'M', color: '#22c55e' },
  ];
  const stackAgents = teamAgents.length ? teamAgents : defaultAvatars;
  const avatarStackInner = stackAgents
    .map(function (a, i) {
      const color = a.color || defaultAvatars[i % defaultAvatars.length].color;
      const inner = a.avatarUrl
        ? '<img src="' + esc(a.avatarUrl) + '" alt="' + esc(a.name || a.initials || '') + '">'
        : esc(a.initials || '?');
      return (
        '<div class="agt-av" style="background:' +
        esc(color) +
        '">' +
        inner +
        '</div>'
      );
    })
    .join('');
  const launcherIco = '<span class="ico-chat">' + SVG_LAUNCHER_CLOSED + '</span>';
  const disclaimer = c.disclaimer || '';
  const powered = c.showBranding && disclaimer
    ? '<div class="agt-powered">' + esc(disclaimer) + '</div>'
    : '';
  return (
    '<button id="agt-launcher" aria-label="Open chat">' +
    launcherIco +
    '<span class="ico-close">' + SVG_LAUNCHER_OPENED + '</span>' +
    '<span class="agt-badge" id="agt-badge">1</span>' +
    '</button>' +
    '<div id="agt-panel" role="dialog" aria-label="Customer support chat">' +
    '<div class="agt-chat-header" id="agt-chat-header" style="display:none;">' +
    '<button class="agt-chat-header-back show" id="agt-back-btn" aria-label="Back">' + SVG_BACK_ICON + '</button>' +
    '<div class="agt-chat-header-av">' + faviconInner + '</div>' +
    '<div class="agt-chat-header-info">' +
    '<div class="agt-chat-header-name">' + esc(c.agentName) + '</div>' +
    '<div class="agt-chat-header-status"><span class="agt-status-pip"></span><span>Online · replies instantly</span></div>' +
    '</div>' +
    '<button class="agt-new-chat-btn" id="agt-new-chat-btn" aria-label="New chat" title="New chat">' + SVG_NEW_ICON + '</button>' +
    '<button class="agt-chat-header-close" id="agt-close-btn" aria-label="Close">' + SVG_CLOSE_ICON + '</button>' +
    '</div>' +
    '<div class="agt-screen" id="agt-home">' +
    '<div class="agt-home-scroll">' +
    '<div class="agt-hero">' +
    heroLogoInner +
    heroBrandLine +
    '<h2>' + formatWelcomeTitle(c.welcomeTitle) + '</h2>' +
    '<div class="agt-hero-sub">' +
    esc(c.welcomeSubtitle || 'Ask about orders, products, returns & store support.') +
    '</div>' +
    '</div>' +
    '<div class="agt-home-body">' +
    (qr.length
      ? '<div class="agt-qr-card">' +
        qr.map(function (q) {
          return '<div class="agt-qr-item" data-msg="' + esc(q) + '">' +
            '<span class="agt-qr-label">' + esc(q) + '</span>' +
            '<span class="agt-qr-chevron">' + SVG_ARROW + '</span></div>';
        }).join('') +
        '</div>'
      : '') +
    '<div class="agt-msg-card" id="agt-send-msg-card">' +
    '<div class="agt-avatar-stack">' +
    avatarStackInner +
    '</div>' +
    '<div class="agt-msg-card-text">' +
    '<div class="agt-msg-card-title">' + esc(c.storeName) + '</div>' +
    '<div class="agt-msg-card-sub">Leave us a message</div>' +
    '</div>' +
    '<span class="agt-msg-card-arr">' + SVG_ARROW + '</span>' +
    '</div>' +
    powered +
    '</div>' +
    '</div>' +
    '<div class="agt-tabbar">' +
    '<button class="agt-tab active" id="tab-home"><span class="agt-tab-ico">' + SVG_HOME_ICON + '</span><span>Home</span></button>' +
    '<button class="agt-tab" id="tab-chat"><span class="agt-tab-ico">' + SVG_CHAT_ICON + '</span><span>Chat</span></button>' +
    '</div>' +
    '</div>' +
    '<div class="agt-screen gone" id="agt-email-gate">' +
    '<div class="agt-email-gate">' +
    '<h3 id="agt-email-title">' + esc(c.emailGateTitle || 'Start a conversation') + '</h3>' +
    '<p id="agt-email-sub">' + esc(c.emailGateSubtitle || 'Enter your email so we can help with your orders.') + '</p>' +
    '<input type="email" class="agt-email-input" id="agt-email-input" placeholder="you@example.com" autocomplete="email" />' +
    '<button class="agt-email-btn" id="agt-email-btn" type="button">Continue to chat</button>' +
    '</div>' +
    '</div>' +
    '<div class="agt-screen gone" id="agt-chat">' +
    '<div class="agt-messages" id="agt-messages"></div>' +
    '<div class="agt-process-steps" id="agt-process-steps">' +
    '<div class="agt-process-step" data-step="1"><span class="agt-process-icon"></span><span class="agt-process-label">Understanding your question</span></div>' +
    '<div class="agt-process-step" data-step="2"><span class="agt-process-icon">✓</span><span class="agt-process-label">Searching knowledge base</span></div>' +
    '<div class="agt-process-step" data-step="3"><span class="agt-process-icon">✓</span><span class="agt-process-label">Checking store data</span></div>' +
    '<div class="agt-process-step" data-step="4"><span class="agt-process-icon">✓</span><span class="agt-process-label">Reviewing retrieved information</span></div>' +
    '<div class="agt-process-step" data-step="5"><span class="agt-process-icon agt-process-spinner"></span><span class="agt-process-label">Generating your answer</span></div>' +
    '</div>' +
    '<div class="agt-typing" id="agt-typing">' +
    '<div class="agt-typing-av">' + faviconInner + '</div>' +
    '<div class="agt-typing-dots"><div class="agt-typing-dot"></div><div class="agt-typing-dot"></div><div class="agt-typing-dot"></div></div>' +
    '</div>' +
    '<div class="agt-input-bar">' +
    '<div class="agt-input-wrap">' +
    '<textarea class="agt-input" id="agt-input" rows="1" placeholder="Type your message..." aria-label="Message"></textarea>' +
    '<button class="agt-send-btn" id="agt-send-btn" disabled aria-label="Send">' + SVG_SEND_ICON + '</button>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>'
  );
}

/**
 * Build the widget CSS string. Uses rootId for the root selector (default 'agentra-widget-root').
 * options.backgroundColor sets the panel / card surface (default white).
 */
export function buildCSS(brand, font, rootId, options) {
  if (rootId == null) rootId = 'agentra-widget-root';
  const surface = (options && options.backgroundColor) || '#ffffff';
  const dk = darken(brand);
  const brandRgb = hexToRgb(brand);
  const btnShadow = 'inset 0 1.5px 0 rgba(255,255,255,0.22), inset 0 -2px 0 rgba(0,0,0,0.18), inset 1px 0 0 rgba(255,255,255,0.07), inset -1px 0 0 rgba(0,0,0,0.08)';
  const root = '#' + rootId;
  const prefix = root + ' ';
  const fontStack = font.includes(',') ? font : "'" + String(font).replace(/'/g, '') + "', system-ui, -apple-system, sans-serif";
  return (
    prefix + '*, ' + prefix + '*::before, ' + prefix + '*::after { box-sizing: border-box; margin: 0; padding: 0; }\n\n' +
    root + ' {\n' +
    '  font-family: ' + fontStack + ';\n' +
    '  --brand:    ' + brand + ';\n' +
    '  --brand-dk: ' + dk + ';\n' +
    '  --ink:      #111214;\n' +
    '  --ink-2:    #1f2124;\n' +
    '  --white:    ' + surface + ';\n' +
    '  --gray-50:  #f7f8f9;\n' +
    '  --gray-100: #f0f2f4;\n' +
    '  --gray-200: #e4e7eb;\n' +
    '  --gray-300: #cbd0d8;\n' +
    '  --gray-400: #9aa1ac;\n' +
    '  --gray-500: #6b7280;\n' +
    '  --gray-700: #374151;\n' +
    '  --gray-900: #111827;\n' +
    '  --w: 370px;\n' +
    '  --h: 590px;\n' +
    '  --r: 20px;\n' +
    '  --shadow: none;\n' +
    '  --btn-shadow: none;\n' +
    '}\n\n' +
    prefix + '#agt-launcher {\n' +
    '  position: fixed; bottom: 26px; right: 26px;\n' +
    '  width: 56px; height: 56px; border-radius: 50%;\n' +
    '  background: var(--brand);\n' +
    '  border: none; outline: none; cursor: pointer;\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    '  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);\n' +
    '  z-index: 9999;\n' +
    '  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);\n' +
    '}\n' +
    prefix + '#agt-launcher:hover { transform: scale(1.05); }\n' +
    prefix + '#agt-launcher:active { transform: scale(0.96); }\n\n' +
    prefix + '#agt-launcher .ico-chat,\n' +
    prefix + '#agt-launcher .ico-close { position: absolute; transition: opacity 0.2s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1); display:flex; align-items:center; justify-content:center; }\n' +
    prefix + '#agt-launcher .ico-chat img,\n' +
    prefix + '#agt-launcher .ico-close img { width: 22px; height: 22px; object-fit: contain; }\n' +
    prefix + '#agt-launcher .ico-chat  { opacity: 1; transform: scale(1) rotate(0deg); }\n' +
    prefix + '#agt-launcher .ico-close { opacity: 0; transform: scale(0.6) rotate(-45deg); }\n' +
    prefix + '#agt-launcher.open .ico-chat  { opacity: 0; transform: scale(0.6) rotate(45deg); }\n' +
    prefix + '#agt-launcher.open .ico-close { opacity: 1; transform: scale(1) rotate(0deg); }\n\n' +
    prefix + '.agt-badge {\n' +
    '  position: absolute; top: -2px; right: -2px;\n' +
    '  width: 18px; height: 18px; border-radius: 50%;\n' +
    '  background: rgba(' + brandRgb + ', 0.35); border: 2px solid white;\n' +
    '  color: white; font-size: 10px; font-weight: 700;\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    '  opacity: 0; transform: scale(0);\n' +
    '  transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);\n' +
    '}\n' +
    prefix + '.agt-badge.show { opacity: 1; transform: scale(1); }\n\n' +
    prefix + '#agt-panel {\n' +
    '  position: fixed; bottom: 96px; right: 26px;\n' +
    '  width: var(--w);\n' +
    '  height: auto;\n' +
    '  min-height: var(--h);\n' +
    '  background: var(--white);\n' +
    '  border-radius: var(--r);\n' +
    '  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.06);\n' +
    '  overflow: hidden;\n' +
    '  display: flex; flex-direction: column;\n' +
    '  z-index: 9998;\n' +
    '  transform: translate3d(0, 14px, 0) scale(0.96);\n' +
    '  transform-origin: bottom right;\n' +
    '  opacity: 0;\n' +
    '  pointer-events: none;\n' +
    '  visibility: hidden;\n' +
    '  transition:\n' +
    '    transform 0.2s cubic-bezier(0.4, 0, 1, 1),\n' +
    '    opacity 0.16s ease-in,\n' +
    '    visibility 0s linear 0.2s;\n' +
    '  will-change: transform, opacity;\n' +
    '}\n' +
    prefix + '#agt-panel:has(#agt-home.gone) {\n' +
    '  height: var(--h);\n' +
    '  max-height: min(92dvh, 780px);\n' +
    '}\n' +
    prefix + '#agt-panel.open {\n' +
    '  transform: translate3d(0, 0, 0) scale(1);\n' +
    '  opacity: 1;\n' +
    '  pointer-events: all;\n' +
    '  visibility: visible;\n' +
    '  transition:\n' +
    '    transform 0.34s cubic-bezier(0.16, 1, 0.3, 1),\n' +
    '    opacity 0.22s ease-out,\n' +
    '    visibility 0s linear 0s;\n' +
    '}\n\n' +
    prefix + '.agt-chat-header {\n' +
    '  background: var(--white);\n' +
    '  border-bottom: 1px solid var(--gray-200);\n' +
    '  padding: 13px 16px;\n' +
    '  display: flex; align-items: center; gap: 10px;\n' +
    '  flex-shrink: 0;\n' +
    '}\n' +
    prefix + '.agt-chat-header-back {\n' +
    '  background: none; border: none; cursor: pointer;\n' +
    '  min-width: 30px; height: 30px; padding: 0 8px; border-radius: 6px;\n' +
    '  display: none; align-items: center; justify-content: center;\n' +
    '  color: var(--gray-500); font-size: 13px; font-weight: 500;\n' +
    '  transition: background 0.14s; flex-shrink: 0;\n' +
    '}\n' +
    prefix + '.agt-chat-header-back:hover { background: var(--gray-100); }\n' +
    prefix + '.agt-chat-header-back.show { display: flex; }\n' +
    prefix + '.agt-chat-header-av {\n' +
    '  width: 34px; height: 34px; border-radius: 50%;\n' +
    '  background: var(--brand);\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    '  flex-shrink: 0; color: white; font-size: 14px;\n' +
    '  overflow: hidden;\n' +
    '}\n' +
    prefix + '.agt-chat-header-av img { width: 100%; height: 100%; object-fit: cover; }\n' +
    prefix + '.agt-chat-header-info { flex: 1; min-width: 0; }\n' +
    prefix + '.agt-chat-header-name {\n' +
    '  font-size: 13.5px; font-weight: 700;\n' +
    '  color: var(--ink); letter-spacing: -0.01em;\n' +
    '}\n' +
    prefix + '.agt-chat-header-status {\n' +
    '  display: flex; align-items: center; gap: 5px;\n' +
    '  font-size: 11.5px; color: var(--gray-500); margin-top: 1px;\n' +
    '}\n' +
    prefix + '.agt-status-pip {\n' +
    '  width: 6px; height: 6px; border-radius: 50%;\n' +
    '  background: #16a34a; flex-shrink: 0;\n' +
    '}\n' +
    prefix + '.agt-chat-header-close {\n' +
    '  background: none; border: none; cursor: pointer;\n' +
    '  min-width: 30px; height: 30px; padding: 0 8px; border-radius: 6px;\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    '  color: var(--gray-400); font-size: 18px; font-weight: 300; line-height: 1;\n' +
    '  transition: background 0.14s; flex-shrink: 0;\n' +
    '}\n' +
    prefix + '.agt-chat-header-close:hover { background: var(--gray-100); color: var(--gray-700); }\n' +
    prefix + '.agt-new-chat-btn {\n' +
    '  background: none; border: none; cursor: pointer;\n' +
    '  min-width: 30px; height: 30px; padding: 0 8px; border-radius: 6px;\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    '  color: var(--gray-400); font-size: 12px; font-weight: 500;\n' +
    '  transition: background 0.14s; flex-shrink: 0;\n' +
    '}\n' +
    prefix + '.agt-new-chat-btn:hover { background: var(--gray-100); color: var(--brand); }\n\n' +
    prefix + '.agt-screen { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }\n' +
    prefix + '.agt-screen.gone { display: none !important; }\n\n' +
    prefix + '#agt-home {\n' +
    '  background: var(--gray-50);\n' +
    '  overflow: visible;\n' +
    '  display: flex;\n' +
    '  flex-direction: column;\n' +
    '  flex: 0 0 auto;\n' +
    '  min-height: 0;\n' +
    '  height: auto;\n' +
    '}\n\n' +
    prefix + '.agt-home-scroll {\n' +
    '  flex: 0 0 auto;\n' +
    '  overflow: visible;\n' +
    '  display: flex;\n' +
    '  flex-direction: column;\n' +
    '}\n' +
    prefix + '.agt-hero {\n' +
    '  background: var(--brand);\n' +
    '  padding: 28px 18px 56px;\n' +
    '  flex-shrink: 0;\n' +
    '  position: relative;\n' +
    '}\n' +
    prefix + '.agt-hero-logo {\n' +
    '  margin-bottom: 14px;\n' +
    '}\n' +
    prefix + '.agt-hero-logo img {\n' +
    '  width: auto; height: auto; object-fit: contain; display: block;\n' +
    '}\n' +
    prefix + '.agt-hero-logo--small img { max-width: 90px; max-height: 28px; }\n' +
    prefix + '.agt-hero-logo--medium img { max-width: 120px; max-height: 40px; }\n' +
    prefix + '.agt-hero-logo--large img { max-width: 150px; max-height: 52px; }\n' +
    prefix + '.agt-hero-brand {\n' +
    '  font-family: ' + font + ';\n' +
    '  font-size: 12px; font-weight: 700;\n' +
    '  color: rgba(255,255,255,0.6);\n' +
    '  letter-spacing: 0.1em; text-transform: uppercase;\n' +
    '  margin-bottom: 18px;\n' +
    '  display: flex; align-items: center; gap: 7px;\n' +
    '}\n' +
    prefix + '.agt-hero-brand i { font-size: 11px; }\n' +
    prefix + '.agt-hero h2 {\n' +
    '  font-family: ' + font + ';\n' +
    '  font-size: 24px; font-weight: 800;\n' +
    '  color: white; line-height: 1.2;\n' +
    '  letter-spacing: -0.03em;\n' +
    '  margin: 18px 0 10px;\n' +
    '}\n' +
    prefix + '.agt-hero-sub {\n' +
    '  font-family: ' + font + ';\n' +
    '  font-size: 13.5px; color: rgba(255,255,255,0.72); margin: 0; font-weight: 400;\n' +
    '  line-height: 1.45; max-width: 92%;\n' +
    '}\n\n' +
    prefix + '.agt-home-body {\n' +
    '  flex: 0 0 auto; overflow: visible;\n' +
    '  padding: 0 14px 24px;\n' +
    '  margin-top: -36px;\n' +
    '  display: flex; flex-direction: column; gap: 8px;\n' +
    '  position: relative; z-index: 2;\n' +
    '}\n\n' +
    prefix + '.agt-qr-card {\n' +
    '  flex-shrink: 0;\n' +
    '  background: var(--white);\n' +
    '  border-radius: 16px;\n' +
    '  border: 1px solid rgba(15,23,42,0.06);\n' +
    '  box-shadow: 0 4px 18px rgba(15,23,42,0.08);\n' +
    '  overflow: hidden;\n' +
    '}\n' +
    prefix + '.agt-qr-item {\n' +
    '  display: flex; align-items: center; gap: 12px;\n' +
    '  padding: 15px 16px;\n' +
    '  cursor: pointer;\n' +
    '  border-bottom: 1px solid var(--gray-100);\n' +
    '  transition: background 0.12s;\n' +
    '}\n' +
    prefix + '.agt-qr-item:last-child { border-bottom: none; }\n' +
    prefix + '.agt-qr-item:hover { background: var(--gray-50); }\n' +
    prefix + '.agt-qr-item:active { background: var(--gray-100); }\n' +
    prefix + '.agt-qr-label {\n' +
    '  flex: 1; font-size: 13.5px; font-weight: 500;\n' +
    '  color: var(--gray-700); line-height: 1.3;\n' +
    '}\n' +
    prefix + '.agt-qr-chevron { color: var(--gray-300); flex-shrink: 0; display:flex; align-items:center; justify-content:center; width:16px; height:16px; overflow:visible; }\n\n' +
    prefix + '.agt-msg-card {\n' +
    '  background: var(--white);\n' +
    '  border-radius: 16px;\n' +
    '  border: 1px solid rgba(15,23,42,0.06);\n' +
    '  box-shadow: 0 2px 10px rgba(15,23,42,0.05);\n' +
    '  padding: 14px 16px;\n' +
    '  display: flex; align-items: center; gap: 12px;\n' +
    '  cursor: pointer;\n' +
    '  transition: border-color 0.15s;\n' +
    '}\n' +
    prefix + '.agt-msg-card:hover { border-color: var(--brand); }\n' +
    prefix + '.agt-avatar-stack { display:flex; flex-direction:row; flex-shrink:0; align-items:center; }\n' +
    prefix + '.agt-av { width:28px; height:28px; border-radius:50%; border:2px solid #fff; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; color:#fff; flex-shrink:0; overflow:hidden; }\n' +
    prefix + '.agt-av + .agt-av { margin-left:-8px; }\n' +
    prefix + '.agt-av img { width:100%; height:100%; object-fit:cover; display:block; }\n' +
    prefix + '.agt-msg-card-text { flex: 1; }\n' +
    prefix + '.agt-msg-card-title {\n' +
    '  font-size: 14px; font-weight: 700; color: var(--gray-900);\n' +
    '}\n' +
    prefix + '.agt-msg-card-sub {\n' +
    '  font-size: 12px; color: var(--gray-400); margin-top: 3px; font-weight: 400;\n' +
    '}\n' +
    prefix + '.agt-msg-card-arr { color: var(--gray-300); flex-shrink:0; display:flex; align-items:center; justify-content:center; width:16px; height:16px; overflow:visible; }\n\n' +
    prefix + '.agt-tabbar {\n' +
    '  display: flex;\n' +
    '  border-top: 1px solid var(--gray-200);\n' +
    '  background: var(--white);\n' +
    '  flex-shrink: 0;\n' +
    '  z-index: 3;\n' +
    '  padding-bottom: env(safe-area-inset-bottom, 0px);\n' +
    '}\n' +
    prefix + '.agt-tab {\n' +
    '  flex: 1; padding: 10px 0 8px;\n' +
    '  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;\n' +
    '  cursor: pointer; border: none;\n' +
    '  background: var(--white);\n' +
    '  color: var(--gray-400); transition: color 0.14s;\n' +
    '  font-family: ' + font + ';\n' +
    '}\n' +
    prefix + '.agt-tab .agt-tab-ico { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; }\n' +
    prefix + '.agt-tab .agt-tab-ico svg { width: 20px; height: 20px; flex-shrink: 0; }\n' +
    prefix + '.agt-tab:hover { color: var(--gray-700); }\n' +
    prefix + '.agt-tab.active { color: var(--brand); font-weight: 600; }\n' +
    prefix + '.agt-tab > span:last-of-type { font-size: 11px; font-weight: 600; letter-spacing: 0.01em; line-height: 1; }\n\n' +
    prefix + '.agt-powered {\n' +
    '  text-align: center; font-size: 11px;\n' +
    '  color: var(--gray-300); padding: 6px 0 4px;\n' +
    '  font-weight: 400;\n' +
    '}\n' +
    prefix + '.agt-powered a { color: var(--gray-400); text-decoration: none; font-weight: 600; }\n\n' +
    prefix + '#agt-chat { background: var(--white); }\n\n' +
    prefix + '.agt-messages {\n' +
    '  flex: 1; overflow-y: auto;\n' +
    '  padding: 18px 15px 10px;\n' +
    '  display: flex; flex-direction: column; gap: 10px;\n' +
    '  scroll-behavior: smooth;\n' +
    '}\n' +
    prefix + '.agt-messages::-webkit-scrollbar { width: 3px; }\n' +
    prefix + '.agt-messages::-webkit-scrollbar-track { background: transparent; }\n' +
    prefix + '.agt-messages::-webkit-scrollbar-thumb { background: var(--gray-200); border-radius: 4px; }\n\n' +
    prefix + '.agt-process-steps {\n' +
    '  display: none;\n' +
    '  flex-direction: column;\n' +
    '  gap: 10px;\n' +
    '  padding: 14px 15px 16px;\n' +
    '  background: var(--gray-50);\n' +
    '  border-radius: 12px;\n' +
    '  margin: 0 15px 10px;\n' +
    '  border: 1px solid var(--gray-200);\n' +
    '}\n' +
    prefix + '.agt-process-steps.visible { display: flex; }\n' +
    prefix + '.agt-process-step {\n' +
    '  display: flex;\n' +
    '  align-items: center;\n' +
    '  gap: 10px;\n' +
    '  font-size: 12.5px;\n' +
    '  color: var(--gray-500);\n' +
    '}\n' +
    prefix + '.agt-process-step.done .agt-process-label,\n' +
    prefix + '.agt-process-step.active .agt-process-label { color: var(--gray-700); }\n' +
    prefix + '.agt-process-step.done .agt-process-icon {\n' +
    '  width: 18px; height: 18px;\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    '  color: var(--brand); font-weight: 700; font-size: 12px;\n' +
    '}\n' +
    prefix + '.agt-process-step.active .agt-process-icon.agt-process-spinner {\n' +
    '  width: 18px; height: 18px;\n' +
    '  border: 2px solid var(--gray-200);\n' +
    '  border-top-color: var(--brand);\n' +
    '  border-radius: 50%;\n' +
    '  animation: agt-spin 0.7s linear infinite;\n' +
    '}\n' +
    '@keyframes agt-spin { to { transform: rotate(360deg); } }\n\n' +
    prefix + '.agt-process-icon { flex-shrink: 0; }\n' +
    prefix + '.agt-process-step:not(.done):not(.active) .agt-process-icon { opacity: 0.3; }\n' +
    prefix + '.agt-date-sep {\n' +
    '  text-align: center; font-size: 11.5px;\n' +
    '  color: var(--gray-400); margin: 8px 0 12px;\n' +
    '  font-weight: 500;\n' +
    '}\n\n' +
    prefix + '.agt-msg-row {\n' +
    '  display: flex; flex-direction: column;\n' +
    '  margin-bottom: 2px;\n' +
    '  animation: msgIn 0.22s cubic-bezier(0.34,1.4,0.64,1) both;\n' +
    '}\n' +
    '@keyframes msgIn {\n' +
    '  from { opacity: 0; transform: translateY(8px); }\n' +
    '  to   { opacity: 1; transform: translateY(0); }\n' +
    '}\n\n' +
    prefix + '.agt-msg-row.customer { align-items: flex-end; }\n' +
    prefix + '.agt-msg-row.agent    { align-items: flex-start; }\n\n' +
    prefix + '.agt-msg-meta {\n' +
    '  font-size: 11px; font-weight: 500;\n' +
    '  color: var(--gray-400); margin-top: 6px; padding-left: 2px;\n' +
    '  letter-spacing: 0.01em;\n' +
    '}\n\n' +
    prefix + '.agt-bubble {\n' +
    '  max-width: 80%; padding: 11px 15px;\n' +
    '  font-size: 13.5px; line-height: 1.58;\n' +
    '  border-radius: 16px; word-break: break-word;\n' +
    '  font-weight: 400;\n' +
    '}\n' +
    prefix + '.agt-msg-row.customer .agt-bubble {\n' +
    '  background: var(--brand); color: white;\n' +
    '  border-bottom-right-radius: 4px; font-weight: 600;\n' +
    '}\n' +
    prefix + '.agt-msg-row.agent .agt-bubble {\n' +
    '  background: var(--gray-100); color: var(--gray-700);\n' +
    '  border-bottom-left-radius: 4px;\n' +
    '  border: 1px solid var(--gray-200);\n' +
    '  font-weight: 400;\n' +
    '  text-align: left;\n' +
    '}\n' +
    prefix + '.agt-msg-row.agent .agt-bubble p {\n' +
    '  margin: 0 0 8px;\n' +
    '  text-align: left;\n' +
    '}\n' +
    prefix + '.agt-msg-row.agent .agt-bubble p:last-child {\n' +
    '  margin-bottom: 0;\n' +
    '}\n' +
    prefix + '.agt-msg-row.agent .agt-bubble ul,\n' +
    prefix + '.agt-msg-row.agent .agt-bubble ol {\n' +
    '  margin: 4px 0 8px;\n' +
    '  padding-left: 18px;\n' +
    '  text-align: left;\n' +
    '  list-style-position: outside;\n' +
    '}\n' +
    prefix + '.agt-msg-row.agent .agt-bubble ol {\n' +
    '  margin: 4px 0 8px;\n' +
    '  padding-left: 20px;\n' +
    '  text-align: left;\n' +
    '  list-style-position: outside;\n' +
    '}\n' +
    prefix + '.agt-msg-row.agent .agt-bubble li {\n' +
    '  margin-bottom: 5px;\n' +
    '}\n' +
    prefix + '.agt-msg-row.agent .agt-bubble li:last-child {\n' +
    '  margin-bottom: 0;\n' +
    '}\n' +
    prefix + '.agt-msg-row.agent .agt-bubble strong { font-weight: 700; color: var(--gray-900); }\n\n' +
    prefix + '.agt-agent-row { display: flex; align-items: flex-end; gap: 7px; }\n' +
    prefix + '.agt-agent-av {\n' +
    '  width: 26px; height: 26px; border-radius: 50%;\n' +
    '  background: var(--ink); flex-shrink: 0;\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    '  margin-bottom: 22px; color: white; font-size: 11px;\n' +
    '  overflow: hidden;\n' +
    '}\n' +
    prefix + '.agt-agent-av img { width: 100%; height: 100%; object-fit: cover; }\n\n' +
    prefix + '.agt-action-btns {\n' +
    '  display: flex; flex-wrap: wrap; gap: 7px;\n' +
    '  justify-content: flex-end;\n' +
    '  margin-top: 8px; margin-bottom: 4px;\n' +
    '  animation: msgIn 0.22s ease both;\n' +
    '  animation-delay: 0.06s;\n' +
    '}\n' +
    prefix + '.agt-action-btn {\n' +
    '  padding: 8px 14px;\n' +
    '  border-radius: 20px;\n' +
    '  border: 1.5px solid var(--gray-300);\n' +
    '  background: var(--white); color: var(--gray-700);\n' +
    '  font-size: 12.5px; font-weight: 600;\n' +
    '  cursor: pointer;\n' +
    '  font-family: ' + font + ';\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    '  transition: border-color 0.14s, color 0.14s, background 0.14s;\n' +
    '  letter-spacing: -0.01em;\n' +
    '}\n' +
    prefix + '.agt-action-btn:hover {\n' +
    '  border-color: var(--brand);\n' +
    '  color: var(--brand);\n' +
    '  background: rgba(' + brandRgb + ', 0.08);\n' +
    '}\n' +
    prefix + '.agt-action-btn:active { transform: scale(0.97); }\n\n' +
    prefix + '.agt-sources-card {\n' +
    '  background: var(--white);\n' +
    '  border: 1px solid var(--gray-200);\n' +
    '  border-radius: 10px;\n' +
    '  padding: 6px 10px;\n' +
    '  margin-bottom: 6px;\n' +
    '  cursor: pointer;\n' +
    '  transition: border-color 0.15s, box-shadow 0.15s;\n' +
    '  text-align: left;\n' +
    '}\n' +
    prefix + '.agt-sources-card.open {\n' +
    '  border-color: var(--brand);\n' +
    '  box-shadow: 0 1px 4px rgba(' + brandRgb + ', 0.12);\n' +
    '}\n' +
    prefix + '.agt-sources-toggle {\n' +
    '  display: flex; align-items: center; gap: 6px;\n' +
    '  font-size: 11px; font-weight: 600; color: var(--gray-500);\n' +
    '  letter-spacing: 0.02em;\n' +
    '}\n' +
    prefix + '.agt-sources-toggle i:first-child { font-size: 10px; color: var(--brand); }\n' +
    prefix + '.agt-sources-chevron {\n' +
    '  margin-left: auto; font-size: 9px; color: var(--gray-400);\n' +
    '  transition: transform 0.15s;\n' +
    '}\n' +
    prefix + '.agt-sources-card.open .agt-sources-chevron {\n' +
    '  transform: rotate(180deg);\n' +
    '}\n' +
    prefix + '.agt-sources-body {\n' +
    '  display: none;\n' +
    '  margin-top: 6px;\n' +
    '  padding-top: 6px;\n' +
    '  border-top: 1px solid var(--gray-100);\n' +
    '}\n' +
    prefix + '.agt-sources-card.open .agt-sources-body {\n' +
    '  display: block;\n' +
    '}\n' +
    prefix + '.agt-sources-body ul {\n' +
    '  margin: 0; padding-left: 16px;\n' +
    '  font-size: 11.5px; color: var(--gray-700); line-height: 1.45;\n' +
    '  text-align: left;\n' +
    '}\n' +
    prefix + '.agt-sources-body li { margin-bottom: 4px; }\n' +
    prefix + '.agt-sources-body li:last-child { margin-bottom: 0; }\n' +
    prefix + '.agt-sources-body a { color: var(--brand); text-decoration: none; font-weight: 600; }\n' +
    prefix + '.agt-sources-body a:hover { text-decoration: underline; }\n\n' +
    prefix + '.agt-email-gate { padding: 28px 22px; display:flex; flex-direction:column; gap:14px; }\n' +
    prefix + '.agt-email-gate h3 { font-size:18px; font-weight:700; color:var(--ink); }\n' +
    prefix + '.agt-email-gate p { font-size:13px; color:var(--gray-500); line-height:1.45; }\n' +
    prefix + '.agt-email-input { width:100%; border:1.5px solid var(--gray-200); border-radius:12px; padding:12px 14px; font-size:14px; font-family:inherit; }\n' +
    prefix + '.agt-email-btn { width:100%; border:none; border-radius:12px; padding:12px 14px; background:var(--brand); color:#fff; font-weight:700; font-size:14px; cursor:pointer; }\n' +
    prefix + '.agt-email-btn:disabled { opacity:0.6; cursor:not-allowed; }\n' +
    prefix + '.agt-product-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; max-width:92%; margin-left:33px; margin-top:8px; }\n' +
    prefix + '.agt-product-card { border:1px solid var(--gray-200); border-radius:12px; overflow:hidden; background:#fff; text-decoration:none; color:inherit; }\n' +
    prefix + '.agt-product-card img { width:100%; height:72px; object-fit:cover; background:var(--gray-100); display:block; }\n' +
    prefix + '.agt-product-card .agt-product-body { padding:8px; }\n' +
    prefix + '.agt-product-card .agt-product-title { font-size:11px; font-weight:600; line-height:1.3; color:var(--ink); }\n' +
    prefix + '.agt-product-card .agt-product-price { font-size:11px; color:var(--brand); font-weight:700; margin-top:4px; }\n' +
    prefix + '.agt-system-event { text-align:center; font-size:11.5px; color:var(--gray-500); padding:6px 12px; background:var(--gray-50); border-radius:999px; align-self:center; }\n\n' +
    prefix + '.agt-order-card {\n' +
    '  background: var(--white);\n' +
    '  border: 1.5px solid var(--gray-200);\n' +
    '  border-radius: 14px;\n' +
    '  padding: 14px 15px;\n' +
    '  max-width: 82%;\n' +
    '  margin-top: 8px; margin-left: 33px;\n' +
    '  animation: msgIn 0.26s ease both;\n' +
    '  animation-delay: 0.1s;\n' +
    '}\n' +
    prefix + '.agt-order-num {\n' +
    '  font-size: 10.5px; font-weight: 700;\n' +
    '  color: var(--gray-400); text-transform: uppercase;\n' +
    '  letter-spacing: 0.06em; margin-bottom: 8px;\n' +
    '  display: flex; align-items: center; gap: 5px;\n' +
    '}\n' +
    prefix + '.agt-order-num i { font-size: 11px; }\n' +
    prefix + '.agt-order-status-row {\n' +
    '  display: flex; align-items: center; gap: 7px; margin-bottom: 13px;\n' +
    '}\n' +
    prefix + '.agt-order-status-dot {\n' +
    '  width: 8px; height: 8px; border-radius: 50%; background: #3b82f6;\n' +
    '}\n' +
    prefix + '.agt-order-status-dot.delivered { background: #16a34a; }\n' +
    prefix + '.agt-order-status-label {\n' +
    '  font-size: 15px; font-weight: 700; color: var(--ink);\n' +
    '  letter-spacing: -0.01em;\n' +
    '}\n' +
    prefix + '.agt-order-track {\n' +
    '  display: flex; align-items: center; margin-bottom: 13px;\n' +
    '}\n' +
    prefix + '.agt-track-step { display: flex; flex-direction: column; align-items: center; gap: 4px; }\n' +
    prefix + '.agt-track-dot {\n' +
    '  width: 8px; height: 8px; border-radius: 50%;\n' +
    '  background: var(--gray-200); position: relative; z-index: 1;\n' +
    '}\n' +
    prefix + '.agt-track-dot.done { background: var(--brand); }\n' +
    prefix + '.agt-track-dot.current {\n' +
    '  background: var(--brand);\n' +
    '  outline: 3px solid var(--gray-200); outline-offset: 1.5px;\n' +
    '}\n' +
    prefix + '.agt-track-label {\n' +
    '  font-size: 8.5px; font-weight: 600; color: var(--gray-400);\n' +
    '  text-align: center; white-space: nowrap;\n' +
    '}\n' +
    prefix + '.agt-track-label.done { color: var(--brand); }\n' +
    prefix + '.agt-track-line {\n' +
    '  flex: 1; height: 1.5px; background: var(--gray-200); margin-bottom: 13px;\n' +
    '}\n' +
    prefix + '.agt-track-line.done { background: var(--brand); }\n' +
    prefix + '.agt-order-track-btn {\n' +
    '  display: flex; align-items: center; gap: 7px;\n' +
    '  font-size: 12.5px; font-weight: 600;\n' +
    '  color: var(--ink); text-decoration: none;\n' +
    '  border-top: 1px solid var(--gray-100);\n' +
    '  padding-top: 10px; margin-top: 2px;\n' +
    '  transition: color 0.14s;\n' +
    '}\n' +
    prefix + '.agt-order-track-btn i { font-size: 12px; color: var(--gray-400); }\n' +
    prefix + '.agt-order-track-btn:hover { color: var(--brand); }\n' +
    prefix + '.agt-order-track-btn:hover i { color: var(--brand); }\n\n' +
    prefix + '.agt-typing {\n' +
    '  display: none; align-items: center; gap: 7px;\n' +
    '  padding: 0 15px 10px;\n' +
    '}\n' +
    prefix + '.agt-typing.visible { display: flex; }\n' +
    prefix + '.agt-typing-av {\n' +
    '  width: 26px; height: 26px; border-radius: 50%;\n' +
    '  background: var(--ink); flex-shrink: 0;\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    '  color: white; font-size: 11px;\n' +
    '  overflow: hidden;\n' +
    '}\n' +
    prefix + '.agt-typing-av img { width: 100%; height: 100%; object-fit: cover; }\n' +
    prefix + '.agt-typing-dots {\n' +
    '  background: var(--gray-100); border: 1px solid var(--gray-200);\n' +
    '  border-radius: 14px; border-bottom-left-radius: 4px;\n' +
    '  padding: 9px 13px;\n' +
    '  display: flex; align-items: center; gap: 4px;\n' +
    '}\n' +
    prefix + '.agt-typing-dot {\n' +
    '  width: 5.5px; height: 5.5px; border-radius: 50%;\n' +
    '  background: var(--gray-400);\n' +
    '  animation: wave 1.2s ease-in-out infinite;\n' +
    '}\n' +
    prefix + '.agt-typing-dot:nth-child(2) { animation-delay: 0.14s; }\n' +
    prefix + '.agt-typing-dot:nth-child(3) { animation-delay: 0.28s; }\n' +
    '@keyframes wave {\n' +
    '  0%,60%,100% { transform: translateY(0); }\n' +
    '  30%          { transform: translateY(-5px); }\n' +
    '}\n\n' +
    prefix + '.agt-rating {\n' +
    '  margin-left: 33px; margin-top: 10px;\n' +
    '  animation: msgIn 0.22s ease both;\n' +
    '}\n' +
    prefix + '.agt-rating-label {\n' +
    '  font-size: 12px; color: var(--gray-500); margin-bottom: 7px; font-weight: 500;\n' +
    '}\n' +
    prefix + '.agt-stars { display: flex; gap: 4px; }\n' +
    prefix + '.agt-star {\n' +
    '  font-size: 20px; cursor: pointer;\n' +
    '  color: var(--gray-300);\n' +
    '  transition: color 0.14s, transform 0.14s;\n' +
    '}\n' +
    prefix + '.agt-star:hover { color: #f59e0b; transform: scale(1.18); }\n' +
    prefix + '.agt-star.selected { color: #f59e0b; }\n' +
    prefix + '.agt-rating-thanks {\n' +
    '  font-size: 12px; color: var(--gray-500);\n' +
    '  font-weight: 500; margin-top: 7px; display: none;\n' +
    '}\n\n' +
    prefix + '.agt-input-bar {\n' +
    '  padding: 12px 14px;\n' +
    '  border-top: 1px solid var(--gray-200);\n' +
    '  background: var(--white);\n' +
    '  display: flex; align-items: flex-end; gap: 10px;\n' +
    '  flex-shrink: 0;\n' +
    '}\n' +
    prefix + '.agt-input-wrap {\n' +
    '  flex: 1;\n' +
    '  background: var(--white);\n' +
    '  border: 1.5px solid var(--gray-200);\n' +
    '  border-radius: 24px;\n' +
    '  display: flex; align-items: center;\n' +
    '  padding: 6px 8px 6px 16px; gap: 8px;\n' +
    '  transition: border-color 0.2s, box-shadow 0.2s;\n' +
    '}\n' +
    prefix + '.agt-input-wrap:focus-within {\n' +
    '  border-color: var(--brand);\n' +
    '  box-shadow: 0 0 0 1px var(--brand);\n' +
    '}\n' +
    prefix + '.agt-input {\n' +
    '  flex: 1; min-width: 0;\n' +
    '  background: none; border: none; outline: none;\n' +
    '  font-size: 14px; color: var(--gray-700);\n' +
    '  font-family: ' + font + ';\n' +
    '  resize: none; min-height: 22px; max-height: 88px; line-height: 1.5;\n' +
    '}\n' +
    prefix + '.agt-input::placeholder { color: var(--gray-400); }\n' +
    prefix + '.agt-send-btn {\n' +
    '  width: 36px; height: 36px; padding: 0; border-radius: 50%;\n' +
    '  background: var(--brand); border: none; cursor: pointer;\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    '  flex-shrink: 0; color: white;\n' +
    '  transition: background 0.16s, transform 0.16s;\n' +
    '}\n' +
    prefix + '.agt-send-btn:hover { background: var(--brand-dk); transform: scale(1.05); }\n' +
    prefix + '.agt-send-btn:active { transform: scale(0.94); }\n' +
    prefix + '.agt-send-btn:disabled {\n' +
    '  background: var(--gray-200); color: var(--gray-400); cursor: not-allowed; transform: none;\n' +
    '}\n' +
    prefix + '.agt-send-btn svg { width: 18px; height: 18px; }\n\n' +
    '@media (max-width: 480px) {\n' +
    '  ' + root + ' #agt-panel {\n' +
    '    width: min(100% - 24px, 360px);\n' +
    '    max-width: calc(100vw - 24px);\n' +
    '    min-height: min(560px, 85dvh);\n' +
    '    bottom: 80px; right: 12px; left: auto;\n' +
    '    border-radius: 20px;\n' +
    '  }\n' +
    '  ' + root + ' #agt-panel:has(#agt-home.gone) {\n' +
    '    height: min(560px, 85dvh);\n' +
    '    max-height: min(560px, 85dvh);\n' +
    '  }\n' +
    '  ' + root + ' #agt-launcher { bottom: 18px; right: 18px; }\n' +
    '}\n' +
    '@media (max-width: 380px) {\n' +
    '  ' + root + ' #agt-panel {\n' +
    '    width: calc(100vw - 20px);\n' +
    '    right: 10px; left: 10px;\n' +
    '    min-height: min(520px, 80dvh);\n' +
    '  }\n' +
    '  ' + root + ' #agt-panel:has(#agt-home.gone) {\n' +
    '    height: min(520px, 80dvh);\n' +
    '    max-height: min(520px, 80dvh);\n' +
    '  }\n' +
    '}\n'
  );
}
