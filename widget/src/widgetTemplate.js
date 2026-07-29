/**
 * Agentra Widget Template — pure HTML/CSS string builders (no DOM).
 * Exported for use by widget.js and any other consumer.
 */

import chatcloseSvg from './chatclose.svg?raw';

// Launcher: closed state (widget sitting in corner, show chat bubble)
const SVG_LAUNCHER_CLOSED = `<svg width="22" height="22" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M3 3H27V10.5H33V33.927L25.1459 30H9V23.427L3 26.427V3ZM9 20.073V10.5H24V6H6V21.573L9 20.073ZM12 13.5V27H25.8541L30 29.073V13.5H12Z" fill="white"/></svg>`;

// Launcher: opened — exact uploaded chatclose.svg
const SVG_LAUNCHER_OPENED = chatcloseSvg.trim();

// Arrow — used for quick-reply chevrons and card arrows (no clipping: extra viewBox padding)
const SVG_ARROW = `<svg width="7" height="10" viewBox="-1 0 9 10" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible"><path d="M6.68552 4.35872L1.43528 0.191346C1.2568 0.0507239 1.02709 -0.0167999 0.796448 0.00356129C0.565808 0.0239225 0.353038 0.130509 0.20473 0.299981C0.0564228 0.469452 -0.0153345 0.687996 0.00517204 0.907755C0.0256786 1.12751 0.136778 1.33058 0.31414 1.47248L4.7577 4.99931L0.31414 8.52614C0.136094 8.66784 0.0243811 8.87107 0.00354121 9.09117C-0.0172987 9.31128 0.054439 9.53026 0.202996 9.70002C0.351552 9.86977 0.564778 9.97642 0.795834 9.99654C1.02689 10.0167 1.25688 9.94858 1.43528 9.80729L6.68552 5.63985C6.78397 5.56151 6.86316 5.46354 6.9175 5.35285C6.97184 5.24217 7 5.12147 7 4.99928C7 4.87709 6.97184 4.7564 6.9175 4.64571C6.86316 4.53503 6.78397 4.43706 6.68552 4.35872Z" fill="currentColor"/></svg>`;

// Tab bar icons — use currentColor so they match brand when active
const SVG_HOME_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.5 2.33497L3 7.50997C2.375 7.94697 2 8.62597 2 9.34997V19.7C2 20.965 3.125 22 4.5 22H19.5C20.875 22 22 20.965 22 19.7V9.34997C22 8.62597 21.625 7.94697 21 7.50997L13.5 2.33497C13.0565 2.03704 12.5343 1.87793 12 1.87793C11.4657 1.87793 10.9435 2.03704 10.5 2.33497ZM7.316 14.366C7.23309 14.2895 7.1358 14.2303 7.02979 14.1918C6.92378 14.1534 6.81117 14.1364 6.69853 14.1418C6.58588 14.1473 6.47545 14.1751 6.37367 14.2237C6.27189 14.2723 6.1808 14.3406 6.10569 14.4248C6.03058 14.5089 5.97297 14.6071 5.9362 14.7137C5.89944 14.8204 5.88426 14.9332 5.89155 15.0458C5.89884 15.1583 5.92845 15.2683 5.97866 15.3693C6.02887 15.4703 6.09867 15.5602 6.184 15.634C7.78279 17.0653 9.85414 17.8552 12 17.852C14.1459 17.8552 16.2172 17.0653 17.816 15.634C17.9013 15.5602 17.9711 15.4703 18.0213 15.3693C18.0716 15.2683 18.1012 15.1583 18.1085 15.0458C18.1157 14.9332 18.1006 14.8204 18.0638 14.7137C18.027 14.6071 17.9694 14.5089 17.8943 14.4248C17.8192 14.3406 17.7281 14.2723 17.6263 14.2237C17.5245 14.1751 17.4141 14.1473 17.3015 14.1418C17.1888 14.1364 17.0762 14.1534 16.9702 14.1918C16.8642 14.2303 16.7669 14.2895 16.684 14.366C15.3967 15.5191 13.7283 16.1553 12 16.152C10.2 16.152 8.56 15.477 7.316 14.366Z" fill="currentColor"/></svg>`;

const SVG_CHAT_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M19 2C19.7956 2 20.5587 2.31607 21.1213 2.87868C21.6839 3.44129 22 4.20435 22 5V20.806C22 22.141 20.387 22.811 19.441 21.868L15.56 18H5C4.20435 18 3.44129 17.6839 2.87868 17.1213C2.31607 16.5587 2 15.7956 2 15V5C2 4.20435 2.31607 3.44129 2.87868 2.87868C3.44129 2.31607 4.20435 2 5 2H19ZM17 7H7a.85.85 0 0 0 0 1.7H17A.85.85 0 0 0 17 7ZM12 11H7a.85.85 0 0 0 0 1.7H12A.85.85 0 0 0 12 11Z" fill="currentColor"/></svg>`;

// Header/input bar icons (replacing text labels)
const SVG_BACK_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SVG_MORE_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="1.75" fill="currentColor"/><circle cx="12" cy="12" r="1.75" fill="currentColor"/><circle cx="19" cy="12" r="1.75" fill="currentColor"/></svg>`;
const SVG_CLOSE_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SVG_SEND_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SVG_ATTACH_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 01-7.78-7.78l8.49-8.49a3.5 3.5 0 014.95 4.95l-8.49 8.49a1.5 1.5 0 01-2.12-2.12l7.78-7.78" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

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
  let raw = String(text == null ? '' : text)
    .replace(/\u2014|\u2013/g, ',')
    .replace(/\s+--\s+/g, ', ')
    .replace(/(^|[^\-])--([^\-]|$)/g, '$1, $2')
    .replace(/\s*,\s*,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
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
  const qr = (Array.isArray(c.quickReplies) && c.quickReplies.length ? c.quickReplies : DEFAULT_QUICK_REPLIES).slice(0, 8);
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
  // Only show real available agents — never fake placeholder initials when offline
  const stackAgents = teamAgents;
  const avatarStackInner = stackAgents.length
    ? stackAgents
        .map(function (a, i) {
          const color = a.color || '#a78bfa';
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
        .join('')
    : '<div class="agt-av" style="background:var(--brand)">' +
      esc((c.storeName || 'S').slice(0, 2).toUpperCase()) +
      '</div>';
  const teamStatusLine = teamAgents.length
    ? 'We typically reply in a few minutes'
    : 'Leave us a message';
  const launcherIco = '<span class="ico-chat">' + SVG_LAUNCHER_CLOSED + '</span>';
  const disclaimer = c.disclaimer || '';
  const powered = c.showBranding && disclaimer
    ? '<div class="agt-powered">' + esc(disclaimer) + '</div>'
    : '';
  const privacyText = c.privacyNotice
    || 'This chat is AI-powered for faster assistance. Chats are monitored and recorded.';
  const privacyLabel = c.privacyPolicyLabel || 'Privacy Policy';
  const privacyUrl = c.privacyPolicyUrl || '';
  const privacyLink = privacyUrl
    ? '<a class="agt-privacy-link" href="' + esc(privacyUrl) + '" target="_blank" rel="noopener">' + esc(privacyLabel) + '</a>'
    : '<span class="agt-privacy-link">' + esc(privacyLabel) + '</span>';
  // Compact one-liner for chat header
  const privacyChatBlock =
    '<div class="agt-privacy-note">' +
    '<p>' + esc(privacyText) + ' ' + privacyLink + '</p>' +
    '</div>';
  // Small footer under email form
  const privacyEmailBlock =
    '<div class="agt-email-privacy">' +
    esc(privacyText) +
    ' ' +
    privacyLink +
    '</div>';

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
    '<div class="agt-chat-header-actions">' +
    '<div class="agt-menu-wrap" id="agt-menu-wrap">' +
    '<button class="agt-menu-btn" id="agt-menu-btn" type="button" aria-label="More options" aria-haspopup="true" aria-expanded="false" title="More options">' +
    SVG_MORE_ICON +
    '</button>' +
    '<div class="agt-menu" id="agt-header-menu" role="menu" hidden>' +
    '<button type="button" class="agt-menu-item" role="menuitem" data-menu-action="new-chat">Start new conversation</button>' +
    '<button type="button" class="agt-menu-item danger" role="menuitem" data-menu-action="end-chat">End chat</button>' +
    '</div>' +
    '</div>' +
    '<button class="agt-chat-header-close" id="agt-close-btn" aria-label="Close">' + SVG_CLOSE_ICON + '</button>' +
    '</div>' +
    '</div>' +
    '<div class="agt-confirm" id="agt-confirm" hidden>' +
    '<div class="agt-confirm-card" role="dialog" aria-modal="true" aria-labelledby="agt-confirm-title">' +
    '<div class="agt-confirm-title" id="agt-confirm-title"></div>' +
    '<div class="agt-confirm-body" id="agt-confirm-body"></div>' +
    '<div class="agt-confirm-actions" id="agt-confirm-actions"></div>' +
    '</div>' +
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
    '<div class="agt-msg-card-sub">' + esc(teamStatusLine) + '</div>' +
    '</div>' +
    '<span class="agt-msg-card-arr">' + SVG_ARROW + '</span>' +
    '</div>' +
    '<div class="agt-history-section" id="agt-history-section">' +
    '<div class="agt-history-heading">Messages</div>' +
    '<div class="agt-history-list" id="agt-history-list">' +
    '<div class="agt-history-empty" id="agt-history-empty">No previous chats yet</div>' +
    '</div>' +
    '</div>' +
    powered +
    '</div>' +
    '</div>' +
    '<div class="agt-tabbar">' +
    '<button class="agt-tab active" id="tab-home"><span class="agt-tab-ico">' + SVG_HOME_ICON + '</span><span>Home</span></button>' +
    '<button class="agt-tab" id="tab-chat"><span class="agt-tab-ico">' + SVG_CHAT_ICON + '<span class="agt-tab-unread" id="agt-tab-unread"></span></span><span>Chat</span></button>' +
    '</div>' +
    '</div>' +
    '<div class="agt-screen gone" id="agt-email-gate">' +
    '<div class="agt-email-gate">' +
    '<div class="agt-email-gate-mid">' +
    '<h3 id="agt-email-title">' + esc(c.emailGateTitle || 'Start a conversation') + '</h3>' +
    '<p id="agt-email-sub">' + esc(c.emailGateSubtitle || 'Enter your email so we can follow up with you.') + '</p>' +
    '<input type="email" class="agt-email-input" id="agt-email-input" placeholder="you@example.com" autocomplete="email" />' +
    '<div class="agt-email-error gone" id="agt-email-error" role="alert"></div>' +
    '<button class="agt-email-btn" id="agt-email-btn" type="button">Continue to chat</button>' +
    privacyEmailBlock +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="agt-screen gone" id="agt-chat">' +
    '<div class="agt-chat-canvas">' +
    '<div class="agt-messages-wrap">' +
    '<div class="agt-messages" id="agt-messages">' +
    '<div class="agt-chat-privacy" id="agt-chat-privacy">' + privacyChatBlock + '</div>' +
    '<div class="agt-status-chip" id="agt-process-steps" aria-live="polite">' +
    '<span class="agt-status-ring" aria-hidden="true"></span>' +
    '<span class="agt-process-label">Working on it…</span>' +
    '</div>' +
    '<div class="agt-typing" id="agt-typing" aria-hidden="true">' +
    '<span class="agt-status-ring" aria-hidden="true"></span>' +
    '<span class="agt-process-label">Replying…</span>' +
    '</div>' +
    '</div>' +
    '<div class="agt-scroll" id="agt-scroll" aria-hidden="true">' +
    '<div class="agt-scroll-thumb" id="agt-scroll-thumb"></div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="agt-composer" id="agt-composer">' +
    '<div class="agt-input-bar gone" id="agt-input-bar">' +
    '<div class="agt-attach-preview gone" id="agt-attach-preview"></div>' +
    '<div class="agt-input-wrap">' +
    '<button type="button" class="agt-attach-btn gone" id="agt-attach-btn" aria-label="Attach a file" title="Attach a file">' +
    SVG_ATTACH_ICON +
    '</button>' +
    '<input type="file" id="agt-file-input" class="agt-file-input" multiple accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.png,.jpg,.jpeg,.gif,.webp" hidden />' +
    '<textarea class="agt-input" id="agt-input" rows="1" placeholder="Type your message…" aria-label="Message"></textarea>' +
    '<button class="agt-send-btn" id="agt-send-btn" disabled aria-label="Send">' + SVG_SEND_ICON + '</button>' +
    '</div>' +
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
  const fontNameOnly = String(font || 'Plus Jakarta Sans')
    .replace(/['"]/g, '')
    .split(',')[0]
    .trim() || 'Plus Jakarta Sans';
  const fontStack = font.includes(',')
    ? font
    : "'" + fontNameOnly + "', system-ui, -apple-system, sans-serif";
  const fontImportUrl =
    'https://fonts.googleapis.com/css2?family=' +
    encodeURIComponent(fontNameOnly).replace(/%20/g, '+') +
    ':wght@400..800&display=swap';
  return (
    '@import url("' + fontImportUrl + '");\n\n' +
    /* Hard reset so Shopify theme typography cannot leak into the widget */
    prefix + '*, ' + prefix + '*::before, ' + prefix + '*::after {\n' +
    '  box-sizing: border-box;\n' +
    '  margin: 0;\n' +
    '  padding: 0;\n' +
    '  letter-spacing: normal;\n' +
    '  text-transform: none;\n' +
    '}\n\n' +
    root + ',\n' +
    root + ' *,\n' +
    root + ' button,\n' +
    root + ' input,\n' +
    root + ' textarea,\n' +
    root + ' select,\n' +
    root + ' h1,\n' +
    root + ' h2,\n' +
    root + ' h3,\n' +
    root + ' h4,\n' +
    root + ' h5,\n' +
    root + ' h6,\n' +
    root + ' p,\n' +
    root + ' a,\n' +
    root + ' span,\n' +
    root + ' div,\n' +
    root + ' li,\n' +
    root + ' label {\n' +
    '  font-family: ' + fontStack + ' !important;\n' +
    '}\n\n' +
    prefix + 'h1, ' + prefix + 'h2, ' + prefix + 'h3, ' + prefix + 'h4, ' +
    prefix + 'h5, ' + prefix + 'h6, ' + prefix + 'p {\n' +
    '  margin: 0 !important;\n' +
    '  padding: 0 !important;\n' +
    '  line-height: 1.35;\n' +
    '  font-weight: inherit;\n' +
    '  color: inherit;\n' +
    '}\n\n' +
    prefix + 'button, ' + prefix + 'input, ' + prefix + 'textarea {\n' +
    '  font: inherit;\n' +
    '  letter-spacing: inherit;\n' +
    '}\n\n' +
    /* Kill native scrollbar arrow buttons everywhere inside the widget */
    prefix + '*::-webkit-scrollbar-button,\n' +
    prefix + '*::-webkit-scrollbar-button:single-button,\n' +
    prefix + '*::-webkit-scrollbar-button:vertical:start:decrement,\n' +
    prefix + '*::-webkit-scrollbar-button:vertical:end:increment,\n' +
    prefix + '*::-webkit-scrollbar-button:vertical:start:increment,\n' +
    prefix + '*::-webkit-scrollbar-button:vertical:end:decrement,\n' +
    prefix + '*::-webkit-scrollbar-button:decrement,\n' +
    prefix + '*::-webkit-scrollbar-button:increment {\n' +
    '  display: none !important;\n' +
    '  width: 0 !important;\n' +
    '  height: 0 !important;\n' +
    '  background: transparent !important;\n' +
    '  border: none !important;\n' +
    '}\n\n' +
    root + ' {\n' +
    '  font-family: ' + fontStack + ' !important;\n' +
    '  font-size: 14px;\n' +
    '  line-height: 1.4;\n' +
    '  -webkit-font-smoothing: antialiased;\n' +
    '  -moz-osx-font-smoothing: grayscale;\n' +
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
    '  --h: 560px;\n' +
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
    prefix + '#agt-launcher .ico-close {\n' +
    '  position: absolute; inset: 0;\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    '  line-height: 0;\n' +
    '  transition: opacity 0.2s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);\n' +
    '}\n' +
    prefix + '#agt-launcher .ico-chat img,\n' +
    prefix + '#agt-launcher .ico-close img { width: 22px; height: 22px; object-fit: contain; }\n' +
    prefix + '#agt-launcher .ico-close svg {\n' +
    '  width: 16px; height: 11px; display: block;\n' +
    '  transform: translateY(2px);\n' +
    '}\n' +
    prefix + '#agt-launcher .ico-chat  { opacity: 1; transform: scale(1); }\n' +
    prefix + '#agt-launcher .ico-close { opacity: 0; transform: scale(0.9); pointer-events: none; }\n' +
    prefix + '#agt-launcher.open .ico-chat  { opacity: 0; transform: scale(0.9); pointer-events: none; }\n' +
    prefix + '#agt-launcher.open .ico-close { opacity: 1; transform: scale(1); pointer-events: auto; }\n\n' +
    prefix + '.agt-badge {\n' +
    '  position: absolute; top: -2px; right: -2px;\n' +
    '  width: 18px; height: 18px; border-radius: 50%;\n' +
    '  background: #ef4444; border: 2px solid white;\n' +
    '  color: white; font-size: 10px; font-weight: 700;\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    '  opacity: 0; transform: scale(0);\n' +
    '  transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);\n' +
    '}\n' +
    prefix + '.agt-badge.show { opacity: 1; transform: scale(1); animation: agt-unread-pulse 1.8s ease-in-out infinite; }\n' +
    '@keyframes agt-unread-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); } 50% { box-shadow: 0 0 0 5px rgba(239,68,68,0); } }\n\n' +
    prefix + '#agt-panel {\n' +
    '  position: fixed; bottom: 96px; right: 26px;\n' +
    '  width: var(--w);\n' +
    '  height: var(--h);\n' +
    '  min-height: 0;\n' +
    '  max-height: calc(100dvh - 122px);\n' +
    '  background: var(--white);\n' +
    '  border-radius: var(--r);\n' +
    '  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.06);\n' +
    '  overflow: hidden;\n' +
    '  display: flex; flex-direction: column;\n' +
    '  z-index: 9998;\n' +
    '  overscroll-behavior: contain;\n' +
    '  touch-action: pan-y;\n' +
    '  transform: translate3d(0, 14px, 0) scale(0.96);\n' +
    '  transform-origin: bottom right;\n' +
    '  opacity: 0;\n' +
    '  pointer-events: none;\n' +
    '  visibility: hidden;\n' +
    '  transition:\n' +
    '    transform 0.2s cubic-bezier(0.4, 0, 1, 1),\n' +
    '    opacity 0.16s ease-in,\n' +
    '    visibility 0s linear 0.2s;\n' +
    '}\n' +
    // No transform once open: a lingering composited layer is re-sampled on
    // fractional display scaling, which visibly softens photos and text.
    prefix + '#agt-panel.open {\n' +
    '  transform: none;\n' +
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
    '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\n' +
    '}\n' +
    prefix + '.agt-chat-header-status {\n' +
    '  display: flex; align-items: center; gap: 5px;\n' +
    '  font-size: 11.5px; color: var(--gray-500); margin-top: 1px;\n' +
    '  white-space: nowrap; overflow: hidden;\n' +
    '}\n' +
    prefix + '.agt-chat-header-status span:last-child {\n' +
    '  overflow: hidden; text-overflow: ellipsis;\n' +
    '}\n' +
    prefix + '.agt-status-pip {\n' +
    '  width: 6px; height: 6px; border-radius: 50%;\n' +
    '  background: #16a34a; flex-shrink: 0;\n' +
    '}\n' +
    prefix + '.agt-chat-header-actions {\n' +
    '  display: flex; align-items: center; gap: 2px; flex-shrink: 0;\n' +
    '}\n' +
    prefix + '.agt-chat-header-close,\n' +
    prefix + '.agt-menu-btn {\n' +
    '  background: none; border: none; cursor: pointer;\n' +
    '  width: 28px; height: 28px; min-width: 28px; padding: 0; border-radius: 6px;\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    '  color: var(--gray-400); line-height: 0;\n' +
    '  transition: background 0.14s, color 0.14s; flex-shrink: 0;\n' +
    '}\n' +
    prefix + '.agt-chat-header-close svg,\n' +
    prefix + '.agt-menu-btn svg { width: 14px; height: 14px; display: block; }\n' +
    prefix + '.agt-chat-header-close:hover,\n' +
    prefix + '.agt-menu-btn:hover,\n' +
    prefix + '.agt-menu-btn[aria-expanded="true"] {\n' +
    '  background: var(--gray-100); color: var(--gray-700);\n' +
    '}\n' +
    prefix + '.agt-menu-wrap { position: relative; flex-shrink: 0; }\n' +
    prefix + '.agt-menu {\n' +
    '  position: absolute; top: calc(100% + 6px); right: 0; z-index: 40;\n' +
    '  min-width: 188px; padding: 6px;\n' +
    '  background: var(--white); border: 1px solid var(--gray-200);\n' +
    '  border-radius: 12px; box-shadow: 0 12px 28px rgba(15,23,42,0.12);\n' +
    '}\n' +
    prefix + '.agt-menu[hidden] { display: none !important; }\n' +
    prefix + '.agt-menu-item {\n' +
    '  appearance: none; width: 100%; border: none; background: transparent;\n' +
    '  text-align: left; cursor: pointer; border-radius: 8px;\n' +
    '  padding: 9px 10px; font: inherit; font-size: 12.5px; font-weight: 600;\n' +
    '  color: var(--ink); line-height: 1.25;\n' +
    '}\n' +
    prefix + '.agt-menu-item:hover { background: var(--gray-100); }\n' +
    prefix + '.agt-menu-item.danger { color: #b91c1c; }\n' +
    prefix + '.agt-menu-item.danger:hover { background: #fef2f2; }\n' +
    prefix + '.agt-menu-item:disabled { opacity: 0.45; cursor: default; }\n\n' +
    prefix + '.agt-confirm {\n' +
    '  position: absolute; inset: 0; z-index: 60;\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    '  padding: 18px; background: rgba(15,23,42,0.34);\n' +
    '  backdrop-filter: blur(2px);\n' +
    '}\n' +
    prefix + '.agt-confirm[hidden] { display: none !important; }\n' +
    prefix + '.agt-confirm-card {\n' +
    '  width: 100%; max-width: 280px; background: var(--white);\n' +
    '  border-radius: 16px; padding: 16px 16px 14px;\n' +
    '  box-shadow: 0 18px 40px rgba(15,23,42,0.18);\n' +
    '  border: 1px solid rgba(15,23,42,0.06);\n' +
    '}\n' +
    prefix + '.agt-confirm-title {\n' +
    '  font-size: 14.5px; font-weight: 750; color: var(--ink);\n' +
    '  letter-spacing: -0.01em; margin-bottom: 6px;\n' +
    '}\n' +
    prefix + '.agt-confirm-body {\n' +
    '  font-size: 12.5px; line-height: 1.45; color: var(--gray-500);\n' +
    '  margin-bottom: 14px;\n' +
    '}\n' +
    prefix + '.agt-confirm-actions {\n' +
    '  display: flex; flex-direction: column; gap: 7px;\n' +
    '}\n' +
    prefix + '.agt-confirm-btn {\n' +
    '  appearance: none; cursor: pointer; width: 100%;\n' +
    '  border-radius: 10px; height: 36px; padding: 0 12px;\n' +
    '  font: inherit; font-size: 12.5px; font-weight: 700; line-height: 1;\n' +
    '  border: 1px solid var(--gray-200); background: var(--white); color: var(--ink);\n' +
    '  transition: background 0.14s, border-color 0.14s, color 0.14s;\n' +
    '}\n' +
    prefix + '.agt-confirm-btn:hover { background: var(--gray-50); }\n' +
    prefix + '.agt-confirm-btn.primary {\n' +
    '  background: var(--brand); border-color: var(--brand); color: #fff;\n' +
    '}\n' +
    prefix + '.agt-confirm-btn.primary:hover { background: var(--brand-dk); border-color: var(--brand-dk); }\n' +
    prefix + '.agt-confirm-btn.danger {\n' +
    '  background: #b91c1c; border-color: #b91c1c; color: #fff;\n' +
    '}\n' +
    prefix + '.agt-confirm-btn.danger:hover { background: #991b1b; border-color: #991b1b; }\n' +
    prefix + '.agt-confirm-btn.ghost { color: var(--gray-500); border-color: transparent; background: transparent; }\n' +
    prefix + '.agt-confirm-btn.ghost:hover { background: var(--gray-100); color: var(--ink); }\n\n' +
    prefix + '.gone { display: none !important; }\n' +
    prefix + '.agt-screen { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }\n' +
    prefix + '.agt-screen.gone { display: none !important; }\n\n' +
    prefix + '#agt-home {\n' +
    '  background: #ffffff;\n' +
    '  overflow: hidden;\n' +
    '  display: flex;\n' +
    '  flex-direction: column;\n' +
    '  flex: 1 1 auto;\n' +
    '  min-height: 0;\n' +
    '  height: 100%;\n' +
    '  max-height: none;\n' +
    '}\n\n' +
    prefix + '.agt-home-scroll {\n' +
    '  flex: 1 1 auto;\n' +
    '  min-height: 0;\n' +
    '  overflow-y: auto;\n' +
    '  overflow-x: hidden;\n' +
    '  display: flex;\n' +
    '  flex-direction: column;\n' +
    '  scrollbar-width: none;\n' +
    '  -ms-overflow-style: none;\n' +
    '  overscroll-behavior: contain;\n' +
    '  -webkit-overflow-scrolling: touch;\n' +
    '}\n' +
    prefix + '.agt-home-scroll::-webkit-scrollbar { width: 0; height: 0; display: none; }\n' +
    prefix + '.agt-hero {\n' +
    '  background: var(--brand);\n' +
    '  padding: 28px 18px 56px;\n' +
    '  flex-shrink: 0;\n' +
    '  position: relative;\n' +
    '  display: flex;\n' +
    '  flex-direction: column;\n' +
    '  align-items: flex-start;\n' +
    '  gap: 0;\n' +
    '}\n' +
    prefix + '.agt-hero-logo {\n' +
    '  margin: 0 0 17px !important;\n' +
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
    '  margin: 0 0 17px !important;\n' +
    '  display: flex; align-items: center; gap: 7px;\n' +
    '}\n' +
    prefix + '.agt-hero-brand i { font-size: 11px; }\n' +
    prefix + '.agt-hero h2 {\n' +
    '  font-family: ' + font + ';\n' +
    '  font-size: 24px; font-weight: 800;\n' +
    '  color: white; line-height: 1.3;\n' +
    '  letter-spacing: -0.03em;\n' +
    '  margin: 0 0 10px !important;\n' +
    '  padding: 0 !important;\n' +
    '}\n' +
    prefix + '.agt-hero-sub {\n' +
    '  font-family: ' + font + ';\n' +
    '  font-size: 13.5px; color: rgba(255,255,255,0.72);\n' +
    '  margin: 0 !important; padding: 0 !important; font-weight: 400;\n' +
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
    prefix + '.agt-msg-card-text { flex: 1; min-width: 0; }\n' +
    prefix + '.agt-msg-card-title {\n' +
    '  font-size: 14px; font-weight: 700; color: var(--gray-900);\n' +
    '  line-height: 1.25 !important;\n' +
    '  margin: 0 !important;\n' +
    '}\n' +
    prefix + '.agt-msg-card-sub {\n' +
    '  font-size: 12px; color: var(--gray-400);\n' +
    '  margin-top: 3px !important;\n' +
    '  margin-bottom: 0 !important;\n' +
    '  font-weight: 400;\n' +
    '  line-height: 1.3 !important;\n' +
    '}\n' +
    prefix + '.agt-msg-card-arr { color: var(--gray-300); flex-shrink:0; display:flex; align-items:center; justify-content:center; width:16px; height:16px; overflow:visible; }\n\n' +
    prefix + '.agt-history-section {\n' +
    '  margin-top: 6px;\n' +
    '  background: #fff;\n' +
    '  border-radius: 16px;\n' +
    '  border: 1px solid rgba(15,23,42,0.06);\n' +
    '  box-shadow: 0 2px 10px rgba(15,23,42,0.05);\n' +
    '  overflow: hidden;\n' +
    '}\n' +
    prefix + '.agt-history-heading {\n' +
    '  font-size: 12px; font-weight: 700; color: var(--gray-500);\n' +
    '  letter-spacing: 0.04em; text-transform: uppercase;\n' +
    '  padding: 12px 16px 8px;\n' +
    '}\n' +
    prefix + '.agt-history-list { display: flex; flex-direction: column; }\n' +
    prefix + '.agt-history-empty {\n' +
    '  padding: 10px 16px 14px; font-size: 12.5px; color: var(--gray-400);\n' +
    '}\n' +
    prefix + '.agt-history-item {\n' +
    '  display: flex; align-items: center; gap: 12px;\n' +
    '  padding: 12px 16px; cursor: pointer;\n' +
    '  border-top: 1px solid var(--gray-100);\n' +
    '  transition: background 0.12s;\n' +
    '}\n' +
    prefix + '.agt-history-item:hover { background: var(--gray-50); }\n' +
    prefix + '.agt-history-av {\n' +
    '  width: 34px; height: 34px; border-radius: 50%; background: var(--brand);\n' +
    '  color: #fff; font-size: 12px; font-weight: 700;\n' +
    '  display: flex; align-items: center; justify-content: center; flex-shrink: 0;\n' +
    '  overflow: hidden;\n' +
    '}\n' +
    prefix + '.agt-history-av img { width: 100%; height: 100%; object-fit: cover; }\n' +
    prefix + '.agt-history-text { flex: 1; min-width: 0; }\n' +
    prefix + '.agt-history-title {\n' +
    '  font-size: 13.5px; font-weight: 650; color: var(--ink);\n' +
    '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\n' +
    '}\n' +
    prefix + '.agt-history-sub {\n' +
    '  font-size: 12px; color: var(--gray-400); margin-top: 2px;\n' +
    '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\n' +
    '}\n' +
    prefix + '.agt-history-chevron { color: var(--gray-300); flex-shrink: 0; }\n\n' +
    prefix + '.agt-tabbar {\n' +
    '  display: flex;\n' +
    '  border-top: 1px solid var(--gray-200);\n' +
    '  background: var(--white);\n' +
    '  flex-shrink: 0;\n' +
    '  z-index: 3;\n' +
    '  padding: 15px 0 calc(15px + env(safe-area-inset-bottom, 0px));\n' +
    '}\n' +
    prefix + '.agt-tab {\n' +
    '  flex: 1; padding: 0;\n' +
    '  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;\n' +
    '  cursor: pointer; border: none;\n' +
    '  background: var(--white);\n' +
    '  color: var(--gray-400); transition: color 0.14s;\n' +
    '  font-family: ' + font + ';\n' +
    '}\n' +
    prefix + '.agt-tab .agt-tab-ico { position: relative; display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; }\n' +
    prefix + '.agt-tab .agt-tab-ico svg { width: 20px; height: 20px; flex-shrink: 0; }\n' +
    prefix + '.agt-tab-unread {\n' +
    '  position: absolute; top: -3px; right: -5px;\n' +
    '  width: 8px; height: 8px; border-radius: 50%;\n' +
    '  background: #ef4444; border: 2px solid var(--white);\n' +
    '  opacity: 0; transform: scale(0); transition: all 0.18s ease;\n' +
    '}\n' +
    prefix + '.agt-tab-unread.show { opacity: 1; transform: scale(1); }\n' +
    prefix + '.agt-tab:hover { color: var(--gray-700); }\n' +
    prefix + '.agt-tab.active { color: var(--brand); font-weight: 600; }\n' +
    prefix + '.agt-tab > span:last-of-type { font-size: 11px; font-weight: 600; letter-spacing: 0.01em; line-height: 1; }\n\n' +
    prefix + '.agt-powered {\n' +
    '  text-align: center; font-size: 11px;\n' +
    '  color: var(--gray-300); padding: 6px 0 4px;\n' +
    '  font-weight: 400;\n' +
    '}\n' +
    prefix + '.agt-powered a { color: var(--gray-400); text-decoration: none; font-weight: 600; }\n\n' +
    prefix + '#agt-chat {\n' +
    '  background: #ffffff;\n' +
    '}\n\n' +
    prefix + '.agt-chat-canvas {\n' +
    '  flex: 1; min-height: 0;\n' +
    '  display: flex; flex-direction: column;\n' +
    '  position: relative;\n' +
    '  background: #ffffff;\n' +
    '}\n\n' +
    prefix + '.agt-chat-privacy {\n' +
    '  flex-shrink: 0;\n' +
    '  padding: 4px 4px 10px;\n' +
    '  background: transparent;\n' +
    '}\n' +
    prefix + '.agt-privacy-note {\n' +
    '  text-align: center;\n' +
    '  font-size: 11px;\n' +
    '  line-height: 1.45;\n' +
    '  color: var(--gray-500);\n' +
    '}\n' +
    prefix + '.agt-privacy-note p { margin: 0; }\n' +
    prefix + '.agt-privacy-link {\n' +
    '  color: var(--gray-700); font-weight: 650; text-decoration: underline;\n' +
    '  text-underline-offset: 2px;\n' +
    '  cursor: pointer;\n' +
    '}\n\n' +
    /* No native scrollbar chrome (Windows arrows). Scroll via JS + custom thumb only. */
    prefix + '.agt-messages-wrap {\n' +
    '  flex: 1;\n' +
    '  min-height: 0;\n' +
    '  width: 100%;\n' +
    '  align-self: stretch;\n' +
    '  display: flex;\n' +
    '  position: relative;\n' +
    '}\n' +
    prefix + '.agt-messages {\n' +
    '  flex: 1;\n' +
    '  min-height: 0;\n' +
    '  overflow: hidden;\n' +
    '  padding: 10px 24px 16px 14px;\n' +
    '  display: flex; flex-direction: column; gap: 20px;\n' +
    '  background: #ffffff;\n' +
    '  overscroll-behavior: contain;\n' +
    '  touch-action: none;\n' +
    '}\n' +
    prefix + '.agt-messages > * { flex-shrink: 0; }\n' +
    prefix + '.agt-scroll {\n' +
    '  position: absolute;\n' +
    '  top: 8px;\n' +
    '  right: 3px;\n' +
    '  bottom: 8px;\n' +
    '  width: 5px;\n' +
    '  pointer-events: none;\n' +
    '  opacity: 0;\n' +
    '  transition: opacity 0.15s ease;\n' +
    '  z-index: 2;\n' +
    '}\n' +
    prefix + '.agt-messages-wrap:hover .agt-scroll,\n' +
    prefix + '.agt-messages-wrap.is-scrolling .agt-scroll,\n' +
    prefix + '.agt-scroll.is-visible {\n' +
    '  opacity: 1;\n' +
    '}\n' +
    prefix + '.agt-scroll-thumb {\n' +
    '  position: absolute;\n' +
    '  top: 0;\n' +
    '  left: 0;\n' +
    '  width: 5px;\n' +
    '  min-height: 28px;\n' +
    '  border-radius: 999px;\n' +
    '  background: rgba(15, 23, 42, 0.28);\n' +
    '  pointer-events: auto;\n' +
    '  cursor: default;\n' +
    '}\n' +
    prefix + '.agt-scroll-thumb:hover,\n' +
    prefix + '.agt-scroll-thumb.is-dragging {\n' +
    '  background: rgba(15, 23, 42, 0.45);\n' +
    '}\n\n' +
    /* In-flow status (scrolls with messages) — compact white pill */
    prefix + '.agt-status-chip,\n' +
    prefix + '.agt-typing {\n' +
    '  display: none;\n' +
    '  align-items: center;\n' +
    '  align-self: flex-start;\n' +
    '  gap: 8px;\n' +
    '  width: max-content;\n' +
    '  max-width: 100%;\n' +
    '  margin: 0;\n' +
    '  padding: 7px 12px;\n' +
    '  background: #fff;\n' +
    '  border: 1px solid rgba(15, 23, 42, 0.08);\n' +
    '  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);\n' +
    '  border-radius: 999px;\n' +
    '  font-size: 12.5px;\n' +
    '  font-weight: 500;\n' +
    '  color: var(--gray-500);\n' +
    '  animation: msgIn 0.18s ease both;\n' +
    '  box-sizing: border-box;\n' +
    '}\n' +
    prefix + '.agt-status-chip.visible,\n' +
    prefix + '.agt-typing.visible {\n' +
    '  display: inline-flex;\n' +
    '}\n' +
    prefix + '.agt-process-label {\n' +
    '  line-height: 1.3;\n' +
    '  white-space: nowrap;\n' +
    '}\n' +
    prefix + '.agt-status-ring {\n' +
    '  width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0;\n' +
    '  border: 2px solid rgba(' + brandRgb + ', 0.2);\n' +
    '  border-top-color: var(--brand);\n' +
    '  animation: agt-spin 0.7s linear infinite;\n' +
    '}\n' +
    '@keyframes agt-spin { to { transform: rotate(360deg); } }\n\n' +
    prefix + '.agt-date-sep {\n' +
    '  align-self: center;\n' +
    '  font-size: 11px; font-weight: 500;\n' +
    '  color: var(--gray-400);\n' +
    '  background: none;\n' +
    '  border: none;\n' +
    '  padding: 6px 0;\n' +
    '  margin: 2px 0;\n' +
    '  letter-spacing: 0.01em;\n' +
    '}\n\n' +
    prefix + '.agt-msg-row {\n' +
    '  display: flex; flex-direction: column;\n' +
    '  margin-bottom: 0;\n' +
    '  position: relative;\n' +
    '  animation: msgIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;\n' +
    '}\n' +
    '@keyframes msgIn {\n' +
    '  from { opacity: 0; transform: translateY(10px) scale(0.98); }\n' +
    '  to   { opacity: 1; transform: translateY(0) scale(1); }\n' +
    '}\n\n' +
    prefix + '.agt-msg-row.customer { align-items: flex-end; width: 100%; }\n' +
    prefix + '.agt-msg-row.agent    { align-items: flex-start; width: 100%; }\n' +
    prefix + '.agt-customer-stack {\n' +
    '  display: flex; flex-direction: column; align-items: flex-end;\n' +
    '  gap: 6px; max-width: 82%; margin-left: auto;\n' +
    '}\n\n' +
    prefix + '.agt-msg-meta {\n' +
    '  display: flex; align-items: baseline; gap: 8px;\n' +
    '  font-size: 11px; font-weight: 600;\n' +
    '  color: var(--gray-500); margin: 0 0 2px; padding: 0 2px;\n' +
    '  letter-spacing: 0.01em; line-height: 1.2;\n' +
    '}\n' +
    prefix + '.agt-msg-meta .agt-msg-name { font-weight: 600; color: var(--gray-500); }\n\n' +
    prefix + '.agt-bubble {\n' +
    '  max-width: 100%; padding: 11px 14px;\n' +
    '  font-size: 13.5px; line-height: 1.55;\n' +
    '  border-radius: 16px; word-break: break-word;\n' +
    '  white-space: pre-wrap;\n' +
    '  font-weight: 400;\n' +
    '  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);\n' +
    '}\n' +
    prefix + '.agt-msg-row.customer .agt-bubble {\n' +
    '  max-width: 100%;\n' +
    '  background: var(--brand);\n' +
    '  color: #ffffff;\n' +
    '  border: none;\n' +
    '  border-bottom-right-radius: 5px;\n' +
    '  font-weight: 500;\n' +
    '}\n' +
    prefix + '.agt-msg-row.agent .agt-bubble {\n' +
    '  background: #fff;\n' +
    '  color: var(--gray-700);\n' +
    '  border: 1px solid rgba(15, 23, 42, 0.06);\n' +
    '  border-bottom-left-radius: 5px;\n' +
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
    prefix + '.agt-agent-row {\n' +
    '  display: flex; flex-direction: row; align-items: flex-end; gap: 8px;\n' +
    '  width: 100%; max-width: 100%;\n' +
    '  padding-right: 6px;\n' +
    '  box-sizing: border-box;\n' +
    '}\n' +
    prefix + '.agt-agent-col {\n' +
    '  display: flex; flex-direction: column; align-items: flex-start; gap: 8px;\n' +
    '  min-width: 0; flex: 1; max-width: calc(100% - 36px);\n' +
    '}\n' +
    prefix + '.agt-agent-av {\n' +
    '  width: 28px; height: 28px; border-radius: 50%;\n' +
    '  background: var(--brand); flex-shrink: 0;\n' +
    '  display: flex; align-items: center; justify-content: center;\n' +
    '  margin-bottom: 2px; color: white; font-size: 11px; font-weight: 700;\n' +
    '  overflow: hidden;\n' +
    '  box-shadow: 0 0 0 2px #fff, 0 1px 3px rgba(15,23,42,0.12);\n' +
    '}\n' +
    prefix + '.agt-agent-av img { width: 100%; height: 100%; object-fit: cover; display: block; }\n' +
    prefix + '.agt-agent-av-fallback { background: var(--brand); }\n' +
    prefix + '.agt-agent-av-human, ' + prefix + '.agt-header-av-human {\n' +
    '  background: var(--brand);\n' +
    '}\n' +
    prefix + '.agt-agent-av-human img, ' + prefix + '.agt-header-av-human img {\n' +
    '  width: 100%; height: 100%; object-fit: cover; display: block;\n' +
    '}\n' +
    prefix + '.agt-av-initial { line-height: 1; font-weight: 700; }\n\n' +
    prefix + '.agt-choice-stack {\n' +
    '  display: flex; flex-wrap: wrap; gap: 8px;\n' +
    '  width: 100%; margin-top: 4px;\n' +
    '  justify-content: flex-end;\n' +
    '  align-self: flex-end;\n' +
    '}\n' +
    prefix + '.agt-choice-btn {\n' +
    '  text-align: center;\n' +
    '  background: #fff;\n' +
    '  border: 1px solid rgba(15, 23, 42, 0.12);\n' +
    '  border-radius: 999px;\n' +
    '  padding: 9px 14px;\n' +
    '  font-size: 12.5px; font-weight: 600; color: var(--ink);\n' +
    '  font-family: inherit; cursor: pointer;\n' +
    '  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);\n' +
    '  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;\n' +
    '}\n' +
    prefix + '.agt-choice-btn:hover {\n' +
    '  border-color: color-mix(in srgb, var(--brand) 45%, transparent);\n' +
    '  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);\n' +
    '  transform: translateY(-1px);\n' +
    '}\n\n' +
    prefix + '.agt-composer {\n' +
    '  flex-shrink: 0;\n' +
    '  background: #ffffff;\n' +
    '  border-top: 1px solid var(--gray-100);\n' +
    '  padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px));\n' +
    '  display: flex; flex-direction: column; gap: 0;\n' +
    '}\n' +
    prefix + '.agt-composer:has(.agt-input-bar.gone) {\n' +
    '  padding: 0;\n' +
    '  border-top: none;\n' +
    '}\n' +
    prefix + '.agt-input-bar.gone { display: none !important; }\n\n' +
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
    prefix + '.agt-email-gate {\n' +
    '  flex: 1; min-height: 0;\n' +
    '  display: flex; flex-direction: column;\n' +
    '  background: #ffffff;\n' +
    '  padding: 16px 22px 28px;\n' +
    '  overflow: hidden;\n' +
    '}\n' +
    prefix + '.agt-email-gate-mid {\n' +
    '  flex: 1;\n' +
    '  display: flex; flex-direction: column; justify-content: center; gap: 12px;\n' +
    '  max-width: 100%;\n' +
    '}\n' +
    prefix + '.agt-email-gate h3 {\n' +
    '  font-size: 18px;\n' +
    '  font-weight: 700;\n' +
    '  color: var(--ink);\n' +
    '  text-align: left;\n' +
    '  margin: 0 !important;\n' +
    '  line-height: 1.25 !important;\n' +
    '}\n' +
    prefix + '.agt-email-gate p {\n' +
    '  font-size: 13px;\n' +
    '  color: var(--gray-500);\n' +
    '  line-height: 1.45 !important;\n' +
    '  text-align: left;\n' +
    '  margin: 0 !important;\n' +
    '}\n' +
    prefix + '.agt-email-privacy {\n' +
    '  margin-top: 4px;\n' +
    '  text-align: left;\n' +
    '  font-size: 11px;\n' +
    '  line-height: 1.45;\n' +
    '  color: var(--gray-400);\n' +
    '}\n' +
    prefix + '.agt-email-privacy .agt-privacy-link {\n' +
    '  font-size: 11px;\n' +
    '}\n' +
    prefix + '.agt-email-error { font-size:12px; line-height:1.4; color:#b42318; background:rgba(180,35,24,0.08); border:1px solid rgba(180,35,24,0.2); border-radius:10px; padding:10px 12px; }\n' +
    prefix + '.agt-email-input { width:100%; border:1.5px solid var(--gray-200); border-radius:12px; padding:12px 14px; font-size:14px; font-family:inherit; background:#fff; }\n' +
    prefix + '.agt-email-btn { width:100%; border:none; border-radius:12px; padding:12px 14px; background:var(--brand); color:#fff; font-weight:700; font-size:14px; cursor:pointer; }\n' +
    prefix + '.agt-email-btn:disabled { opacity:0.6; cursor:not-allowed; }\n' +
    prefix + '.agt-product-rail { position:relative; width:100%; max-width:100%; margin-top:4px; }\n' +
    prefix + '.agt-product-grid { display:flex; flex-wrap:nowrap; gap:10px; width:100%; max-width:100%; overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; touch-action:pan-x; overscroll-behavior-x:contain; scrollbar-width:none; -ms-overflow-style:none; padding:0 2px 2px; scroll-snap-type:x proximity; cursor:default; }\n' +
    prefix + '.agt-product-grid::-webkit-scrollbar { display:none; width:0; height:0; }\n' +
    prefix + '.agt-product-grid.is-dragging { scroll-snap-type:none; }\n' +
    '@media (hover: none) and (pointer: coarse) {\n' +
    '  ' + prefix + '.agt-product-grid { cursor:grab; }\n' +
    '  ' + prefix + '.agt-product-grid.is-dragging { cursor:grabbing; }\n' +
    '}\n' +
    prefix + '.agt-product-rail::before, ' + prefix + '.agt-product-rail::after { content:""; position:absolute; top:0; bottom:2px; width:14px; pointer-events:none; z-index:2; }\n' +
    prefix + '.agt-product-rail::before { left:0; background:linear-gradient(to right, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 100%); }\n' +
    prefix + '.agt-product-rail::after { right:0; background:linear-gradient(to left, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 100%); }\n' +
    prefix + '.agt-product-nav { position:absolute; top:42%; transform:translateY(-50%); z-index:4; width:28px; height:28px; border-radius:50%; border:1px solid var(--gray-200); background:rgba(255,255,255,0.96); color:var(--ink); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 1px 4px rgba(15,23,42,0.12); padding:0; transition:opacity .15s ease, background .15s ease; }\n' +
    prefix + '.agt-product-nav:hover { background:#fff; }\n' +
    prefix + '.agt-product-nav[disabled] { opacity:0.35; pointer-events:none; }\n' +
    prefix + '.agt-product-nav-prev { left:2px; }\n' +
    prefix + '.agt-product-nav-next { right:2px; }\n' +
    prefix + '.agt-product-nav svg { width:14px; height:14px; display:block; }\n' +
    prefix + '.agt-product-card { flex:0 0 148px; width:148px; display:flex; flex-direction:column; border:1px solid var(--gray-200); border-radius:12px; overflow:hidden; background:#fff; color:inherit; min-width:0; box-shadow:0 1px 2px rgba(15,23,42,0.04); scroll-snap-align:start; pointer-events:auto; }\n' +
    prefix + '.agt-product-media { position:relative; display:block; width:100%; background:var(--gray-100); overflow:hidden; }\n' +
    prefix + '.agt-product-card img { width:100%; aspect-ratio:1 / 1; height:auto; object-fit:cover; object-position:center top; display:block; pointer-events:none; user-select:none; }\n' +
    prefix + '.agt-product-card .agt-product-body { padding:8px 9px 10px; display:flex; flex-direction:column; gap:6px; flex:1; min-width:0; }\n' +
    prefix + '.agt-product-card .agt-product-title { font-size:11px; font-weight:600; line-height:1.3; color:var(--ink); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }\n' +
    prefix + '.agt-product-card .agt-product-row { display:flex; align-items:center; justify-content:space-between; gap:6px; }\n' +
    prefix + '.agt-product-card .agt-product-price { font-size:12px; color:var(--brand); font-weight:700; letter-spacing:0.01em; }\n' +
    prefix + '.agt-product-view { display:inline-flex; align-items:center; justify-content:center; width:100%; margin-top:auto; padding:7px 8px; border-radius:8px; border:1px solid var(--gray-200); background:var(--gray-50); color:var(--ink); font-size:11px; font-weight:600; line-height:1; text-decoration:none; cursor:pointer; transition:background .15s ease, border-color .15s ease, color .15s ease; }\n' +
    prefix + '.agt-product-view:hover { background:#fff; border-color:var(--brand); color:var(--brand); }\n' +
    prefix + '.agt-product-view.is-disabled { opacity:0.45; pointer-events:none; cursor:default; }\n' +
    prefix + '.agt-system-event { text-align:center; font-size:11.5px; color:var(--gray-500); padding:6px 12px; background:var(--gray-50); border-radius:999px; align-self:center; }\n\n' +
    prefix + '.agt-input-form {\n' +
    '  background: #fff;\n' +
    '  border: 1px solid rgba(15, 23, 42, 0.08);\n' +
    '  border-radius: 16px;\n' +
    '  padding: 14px;\n' +
    '  width: 100%;\n' +
    '  max-width: 100%;\n' +
    '  margin-top: 2px;\n' +
    '  display: flex;\n' +
    '  flex-direction: column;\n' +
    '  gap: 10px;\n' +
    '  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);\n' +
    '  animation: msgIn 0.3s ease both;\n' +
    '}\n' +
    prefix + '.agt-input-form.is-submitted { opacity: 0.72; pointer-events: none; }\n' +
    prefix + '.agt-form-title {\n' +
    '  font-size: 13px; font-weight: 700; color: var(--ink); margin-bottom: 2px;\n' +
    '}\n' +
    prefix + '.agt-form-summary {\n' +
    '  background: var(--gray-50);\n' +
    '  border-radius: 10px;\n' +
    '  padding: 10px 12px;\n' +
    '  display: flex; flex-direction: column; gap: 4px;\n' +
    '}\n' +
    prefix + '.agt-form-summary-line { font-size: 12px; color: var(--gray-600); font-weight: 500; }\n' +
    prefix + '.agt-form-field { display: flex; flex-direction: column; gap: 5px; }\n' +
    prefix + '.agt-form-label {\n' +
    '  font-size: 11px; font-weight: 600; color: var(--gray-500); letter-spacing: 0.01em;\n' +
    '}\n' +
    prefix + '.agt-form-label em { font-style: normal; font-weight: 500; color: var(--gray-400); }\n' +
    prefix + '.agt-form-input {\n' +
    '  width: 100%;\n' +
    '  border: 1.5px solid var(--gray-200);\n' +
    '  border-radius: 12px;\n' +
    '  padding: 11px 12px;\n' +
    '  font-size: 14px;\n' +
    '  font-family: inherit;\n' +
    '  background: #fff;\n' +
    '  color: var(--ink);\n' +
    '  outline: none;\n' +
    '  box-sizing: border-box;\n' +
    '  transition: border-color 0.15s ease;\n' +
    '}\n' +
    prefix + '.agt-form-input:focus { border-color: var(--brand); }\n' +
    prefix + '.agt-form-input.is-invalid { border-color: #e11d48; }\n' +
    prefix + '.agt-form-submit {\n' +
    '  width: 100%;\n' +
    '  border: none;\n' +
    '  border-radius: 12px;\n' +
    '  padding: 12px 14px;\n' +
    '  background: var(--brand);\n' +
    '  color: #fff;\n' +
    '  font-weight: 700;\n' +
    '  font-size: 14px;\n' +
    '  cursor: pointer;\n' +
    '  margin-top: 2px;\n' +
    '}\n' +
    prefix + '.agt-form-submit:disabled { opacity: 0.6; cursor: not-allowed; }\n\n' +
    prefix + '.agt-order-card {\n' +
    '  background: #fff;\n' +
    '  border: 1px solid rgba(15, 23, 42, 0.07);\n' +
    '  border-radius: 16px;\n' +
    '  padding: 14px;\n' +
    '  max-width: 100%; width: 100%;\n' +
    '  margin-top: 2px;\n' +
    '  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);\n' +
    '  animation: msgIn 0.3s ease both;\n' +
    '}\n' +
    prefix + '.agt-order-top {\n' +
    '  display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;\n' +
    '  margin-bottom: 14px;\n' +
    '}\n' +
    prefix + '.agt-order-id { font-size: 12px; font-weight: 700; color: var(--ink); }\n' +
    prefix + '.agt-order-total { font-size: 12px; color: var(--gray-500); margin-top: 2px; font-weight: 500; }\n' +
    prefix + '.agt-order-badge {\n' +
    '  font-size: 10px; font-weight: 700; letter-spacing: 0.02em;\n' +
    '  padding: 4px 8px; border-radius: 999px;\n' +
    '  background: #ecfdf5; color: #047857;\n' +
    '  border: 1px solid #a7f3d0; text-transform: capitalize; flex-shrink: 0;\n' +
    '}\n' +
    prefix + '.agt-order-badge.is-refunded,\n' +
    prefix + '.agt-order-badge.is-cancelled {\n' +
    '  background: #fef2f2; color: #b91c1c; border-color: #fecaca;\n' +
    '}\n' +
    prefix + '.agt-order-outcome {\n' +
    '  border-radius: 12px;\n' +
    '  padding: 12px 13px;\n' +
    '  margin-bottom: 12px;\n' +
    '  border: 1px solid transparent;\n' +
    '}\n' +
    prefix + '.agt-order-outcome-refunded {\n' +
    '  background: #fef2f2; border-color: #fecaca;\n' +
    '}\n' +
    prefix + '.agt-order-outcome-cancelled {\n' +
    '  background: #fff7ed; border-color: #fed7aa;\n' +
    '}\n' +
    prefix + '.agt-order-outcome-title {\n' +
    '  font-size: 13px; font-weight: 700; color: var(--ink); margin-bottom: 3px;\n' +
    '}\n' +
    prefix + '.agt-order-outcome-detail {\n' +
    '  font-size: 12px; color: var(--gray-600); line-height: 1.4; font-weight: 500;\n' +
    '}\n' +
    prefix + '.agt-order-stepper {\n' +
    '  display: flex; align-items: flex-start; justify-content: space-between;\n' +
    '  gap: 4px; margin-bottom: 14px; padding: 0 2px;\n' +
    '}\n' +
    prefix + '.agt-order-step {\n' +
    '  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;\n' +
    '  position: relative; min-width: 0;\n' +
    '}\n' +
    prefix + '.agt-order-step:not(:last-child)::after {\n' +
    '  content: ""; position: absolute; top: 7px; left: calc(50% + 10px); right: calc(-50% + 10px);\n' +
    '  height: 2px; background: var(--gray-200); border-radius: 2px;\n' +
    '}\n' +
    prefix + '.agt-order-step.done:not(:last-child)::after,\n' +
    prefix + '.agt-order-step.active:not(:last-child)::after { background: #22c55e; }\n' +
    prefix + '.agt-order-step-dot {\n' +
    '  width: 14px; height: 14px; border-radius: 50%;\n' +
    '  background: #fff; border: 2px solid var(--gray-300);\n' +
    '  z-index: 1; box-sizing: border-box;\n' +
    '}\n' +
    prefix + '.agt-order-step.done .agt-order-step-dot,\n' +
    prefix + '.agt-order-step.active .agt-order-step-dot {\n' +
    '  background: #22c55e; border-color: #22c55e;\n' +
    '  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);\n' +
    '}\n' +
    prefix + '.agt-order-step-label {\n' +
    '  font-size: 9.5px; font-weight: 600; color: var(--gray-400);\n' +
    '  text-align: center; line-height: 1.2;\n' +
    '}\n' +
    prefix + '.agt-order-step.done .agt-order-step-label,\n' +
    prefix + '.agt-order-step.active .agt-order-step-label { color: var(--gray-700); }\n' +
    prefix + '.agt-order-items { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }\n' +
    prefix + '.agt-order-item { font-size: 12px; color: var(--gray-600); font-weight: 500; }\n' +
    prefix + '.agt-order-num,\n' +
    prefix + '.agt-order-status-row,\n' +
    prefix + '.agt-order-track,\n' +
    prefix + '.agt-track-step,\n' +
    prefix + '.agt-track-dot,\n' +
    prefix + '.agt-track-label,\n' +
    prefix + '.agt-track-line { display: none !important; }\n' +
    prefix + '.agt-order-track-btn {\n' +
    '  display: inline-flex; align-items: center; justify-content: center; gap: 6px;\n' +
    '  width: 100%; padding: 10px 12px; border-radius: 12px;\n' +
    '  background: var(--ink); color: #fff; text-decoration: none;\n' +
    '  font-size: 12.5px; font-weight: 650;\n' +
    '}\n' +
    prefix + '.agt-order-track-btn:hover { opacity: 0.92; color: #fff; }\n\n' +
    prefix + '.agt-connecting {\n' +
    '  display: inline-flex; align-items: center; gap: 10px;\n' +
    '  align-self: center; margin: 4px 0;\n' +
    '  padding: 9px 14px; border-radius: 999px;\n' +
    '  background: rgba(255,255,255,0.95);\n' +
    '  border: 1px solid rgba(15, 23, 42, 0.06);\n' +
    '  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);\n' +
    '  font-size: 12.5px; font-weight: 550; color: var(--gray-700);\n' +
    '}\n' +
    prefix + '.agt-connecting .agt-status-ring {\n' +
    '  border-color: rgba(22,163,74,0.2); border-top-color: #16a34a;\n' +
    '}\n\n' +
    prefix + '.agt-rating {\n' +
    '  margin: 10px auto 4px;\n' +
    '  animation: msgIn 0.22s ease both;\n' +
    '  background: #fff; border: 1px solid rgba(15,23,42,0.07);\n' +
    '  border-radius: 16px; padding: 15px; width: calc(100% - 20px); box-sizing: border-box;\n' +
    '  box-shadow: 0 6px 18px rgba(15,23,42,0.05);\n' +
    '}\n' +
    prefix + '.agt-rating-label {\n' +
    '  font-size: 13px; color: var(--ink); margin-bottom: 12px; font-weight: 700; text-align: center;\n' +
    '}\n' +
    prefix + '.agt-rating-options { display: flex; justify-content: space-between; gap: 5px; }\n' +
    prefix + '.agt-rating-option {\n' +
    '  appearance: none; border: 1px solid transparent; background: transparent;\n' +
    '  border-radius: 10px; padding: 5px 3px; min-width: 0; flex: 1;\n' +
    '  color: var(--gray-500); font: inherit; font-size: 9px; cursor: pointer;\n' +
    '  display: flex; flex-direction: column; align-items: center; gap: 4px;\n' +
    '  transition: background 0.14s, border-color 0.14s, transform 0.14s;\n' +
    '}\n' +
    prefix + '.agt-rating-option:hover:not(:disabled) { background: var(--gray-100); transform: translateY(-1px); }\n' +
    prefix + '.agt-rating-option.selected { background: rgba(99,55,164,0.10); border-color: var(--brand); color: var(--brand); font-weight: 700; }\n' +
    prefix + '.agt-rating-option:disabled { cursor: default; }\n' +
    prefix + '.agt-rating-emoji { font-size: 25px; line-height: 1; }\n' +
    prefix + '.agt-rating-thanks {\n' +
    '  font-size: 11px; color: var(--gray-500); text-align: center;\n' +
    '  font-weight: 500; margin-top: 10px; display: none;\n' +
    '}\n\n' +
prefix + '.agt-input-bar {\n' +
    '  padding: 0;\n' +
    '  border-top: none;\n' +
    '  background: transparent;\n' +
    '  display: flex; flex-direction: column; align-items: stretch; gap: 8px;\n' +
    '  flex-shrink: 0;\n' +
    '  width: 100%;\n' +
    '}\n' +
    prefix + '.agt-attach-preview {\n' +
    '  display: flex; flex-wrap: wrap; gap: 6px;\n' +
    '  padding: 0 2px;\n' +
    '}\n' +
    prefix + '.agt-attach-preview.gone { display: none !important; }\n' +
    prefix + '.agt-attach-chip {\n' +
    '  display: inline-flex; align-items: center; gap: 6px;\n' +
    '  max-width: 100%;\n' +
    '  padding: 5px 8px;\n' +
    '  border-radius: 999px;\n' +
    '  background: var(--gray-100);\n' +
    '  border: 1px solid var(--gray-200);\n' +
    '  font-size: 12px; color: var(--gray-700);\n' +
    '}\n' +
    prefix + '.agt-attach-chip span {\n' +
    '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;\n' +
    '}\n' +
    prefix + '.agt-attach-chip button {\n' +
    '  border: none; background: transparent; color: var(--gray-500);\n' +
    '  cursor: pointer; padding: 0; line-height: 1; font-size: 14px;\n' +
    '}\n' +
    prefix + '.agt-input-wrap {\n' +
    '  flex: 1;\n' +
    '  width: 100%;\n' +
    '  min-height: 44px;\n' +
    '  background: var(--white);\n' +
    '  border: 1.5px solid var(--gray-200);\n' +
    '  border-radius: 22px;\n' +
    '  display: flex; align-items: center;\n' +
    '  padding: 4px 6px 4px 8px;\n' +
    '  gap: 4px;\n' +
    '  box-sizing: border-box;\n' +
    '  transition: border-color 0.2s;\n' +
    '  box-shadow: none !important;\n' +
    '  outline: none !important;\n' +
    '}\n' +
    prefix + '.agt-input-wrap:focus-within {\n' +
    '  border-color: var(--brand);\n' +
    '  box-shadow: none !important;\n' +
    '  outline: none !important;\n' +
    '}\n' +
    prefix + '.agt-attach-btn {\n' +
    '  width: 34px; height: 34px; padding: 0; border-radius: 50%;\n' +
    '  border: none; background: transparent; color: var(--gray-500);\n' +
    '  cursor: pointer; display: none; align-items: center; justify-content: center;\n' +
    '  flex-shrink: 0;\n' +
    '}\n' +
    prefix + '.agt-attach-btn:not(.gone) { display: flex; }\n' +
    prefix + '.agt-attach-btn.gone { display: none !important; }\n' +
    prefix + '.agt-attach-btn:hover { color: var(--brand); background: var(--gray-100); }\n' +
    prefix + '.agt-attach-btn:disabled { opacity: 0.45; cursor: not-allowed; }\n' +
    prefix + '.agt-file-input { display: none !important; }\n' +
    prefix + '.agt-input {\n' +
    '  flex: 1; min-width: 0;\n' +
    '  background: transparent !important;\n' +
    '  border: none !important;\n' +
    '  outline: none !important;\n' +
    '  box-shadow: none !important;\n' +
    '  -webkit-appearance: none;\n' +
    '  appearance: none;\n' +
    '  font-size: 14px; color: var(--gray-700);\n' +
    '  font-family: ' + font + ';\n' +
    '  resize: none;\n' +
    '  height: 36px;\n' +
    '  min-height: 36px;\n' +
    '  max-height: 96px;\n' +
    '  line-height: 20px;\n' +
    '  padding: 8px 2px;\n' +
    '  margin: 0;\n' +
    '  box-sizing: border-box;\n' +
    '  overflow-y: hidden;\n' +
    '  field-sizing: fixed;\n' +
    '}\n' +
    prefix + '.agt-input:focus,\n' +
    prefix + '.agt-input:focus-visible,\n' +
    prefix + '.agt-input:active {\n' +
    '  outline: none !important;\n' +
    '  box-shadow: none !important;\n' +
    '  -webkit-box-shadow: none !important;\n' +
    '  border: none !important;\n' +
    '  background: transparent !important;\n' +
    '}\n' +
    prefix + '.agt-input::placeholder { color: var(--gray-400); opacity: 1; line-height: 20px; }\n' +
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
    prefix + '.agt-send-btn svg { width: 18px; height: 18px; }\n' +
    prefix + '.agt-msg-attachments {\n' +
    '  display: flex; flex-direction: column; gap: 6px; margin-top: 0;\n' +
    '  align-items: flex-end;\n' +
    '  width: fit-content;\n' +
    '  max-width: 100%;\n' +
    '}\n' +
    prefix + '.agt-msg-row.customer .agt-msg-attachments {\n' +
    '  align-self: flex-end;\n' +
    '  margin-left: auto;\n' +
    '}\n' +
    prefix + '.agt-msg-row.agent .agt-msg-attachments {\n' +
    '  align-items: flex-start;\n' +
    '}\n' +
    prefix + '.agt-msg-attachments a {\n' +
    '  color: inherit; text-decoration: underline; font-size: 12px; word-break: break-all;\n' +
    '  display: block; max-width: 100%;\n' +
    '}\n' +
    prefix + '.agt-msg-attachments img {\n' +
    '  display: block; width: auto; height: auto;\n' +
    '  max-width: min(220px, 100%); border-radius: 12px;\n' +
    '  border: 1px solid rgba(0,0,0,0.08);\n' +
    '  float: none;\n' +
    '}\n\n' +
    '@media (max-width: 480px) {\n' +
    '  ' + root + ' #agt-panel {\n' +
    '    width: min(100% - 24px, 360px);\n' +
    '    max-width: calc(100vw - 24px);\n' +
    '    height: min(var(--h), calc(100dvh - 98px));\n' +
    '    min-height: 0;\n' +
    '    max-height: calc(100dvh - 98px);\n' +
    '    bottom: 80px; right: 12px; left: auto;\n' +
    '    border-radius: 20px;\n' +
    '  }\n' +
    '  ' + root + ' #agt-launcher { bottom: 18px; right: 18px; }\n' +
    '}\n' +
    '@media (max-width: 380px) {\n' +
    '  ' + root + ' #agt-panel {\n' +
    '    width: calc(100vw - 20px);\n' +
    '    right: 10px; left: 10px;\n' +
    '    height: min(var(--h), calc(100dvh - 98px));\n' +
    '    min-height: 0;\n' +
    '    max-height: calc(100dvh - 98px);\n' +
    '  }\n' +
    '}\n'
  );
}
