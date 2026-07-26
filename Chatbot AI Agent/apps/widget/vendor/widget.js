(function(){"use strict";const Pt=`<svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M13.5391 15.2812L23.5408 3.28065C23.8783 2.87269 24.0403 2.34763 23.9915 1.82045C23.9426 1.29328 23.6868 0.806943 23.28 0.467955C22.8733 0.128966 22.3488 -0.0350503 21.8214 0.0118218C21.294 0.058694 20.8066 0.312635 20.4661 0.718035L12.0017 10.8747L3.53726 0.718036C3.19718 0.311073 2.70944 0.0557285 2.18119 0.00809445C1.65294 -0.0395396 1.12738 0.124432 0.719961 0.46399C0.312542 0.803548 0.0565834 1.29092 0.00831225 1.81905C-0.0399608 2.34718 0.123402 2.87287 0.462513 3.28065L10.4644 15.2812C10.6524 15.5062 10.8875 15.6872 11.1532 15.8114C11.4188 15.9356 11.7085 16 12.0017 16C12.295 16 12.5847 15.9356 12.8503 15.8114C13.1159 15.6872 13.3511 15.5062 13.5391 15.2812Z" fill="white"/>
</svg>
`,qt='<svg width="22" height="22" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M3 3H27V10.5H33V33.927L25.1459 30H9V23.427L3 26.427V3ZM9 20.073V10.5H24V6H6V21.573L9 20.073ZM12 13.5V27H25.8541L30 29.073V13.5H12Z" fill="white"/></svg>',Ut=Pt.trim(),bt='<svg width="7" height="10" viewBox="-1 0 9 10" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible"><path d="M6.68552 4.35872L1.43528 0.191346C1.2568 0.0507239 1.02709 -0.0167999 0.796448 0.00356129C0.565808 0.0239225 0.353038 0.130509 0.20473 0.299981C0.0564228 0.469452 -0.0153345 0.687996 0.00517204 0.907755C0.0256786 1.12751 0.136778 1.33058 0.31414 1.47248L4.7577 4.99931L0.31414 8.52614C0.136094 8.66784 0.0243811 8.87107 0.00354121 9.09117C-0.0172987 9.31128 0.054439 9.53026 0.202996 9.70002C0.351552 9.86977 0.564778 9.97642 0.795834 9.99654C1.02689 10.0167 1.25688 9.94858 1.43528 9.80729L6.68552 5.63985C6.78397 5.56151 6.86316 5.46354 6.9175 5.35285C6.97184 5.24217 7 5.12147 7 4.99928C7 4.87709 6.97184 4.7564 6.9175 4.64571C6.86316 4.53503 6.78397 4.43706 6.68552 4.35872Z" fill="currentColor"/></svg>',Ot='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.5 2.33497L3 7.50997C2.375 7.94697 2 8.62597 2 9.34997V19.7C2 20.965 3.125 22 4.5 22H19.5C20.875 22 22 20.965 22 19.7V9.34997C22 8.62597 21.625 7.94697 21 7.50997L13.5 2.33497C13.0565 2.03704 12.5343 1.87793 12 1.87793C11.4657 1.87793 10.9435 2.03704 10.5 2.33497ZM7.316 14.366C7.23309 14.2895 7.1358 14.2303 7.02979 14.1918C6.92378 14.1534 6.81117 14.1364 6.69853 14.1418C6.58588 14.1473 6.47545 14.1751 6.37367 14.2237C6.27189 14.2723 6.1808 14.3406 6.10569 14.4248C6.03058 14.5089 5.97297 14.6071 5.9362 14.7137C5.89944 14.8204 5.88426 14.9332 5.89155 15.0458C5.89884 15.1583 5.92845 15.2683 5.97866 15.3693C6.02887 15.4703 6.09867 15.5602 6.184 15.634C7.78279 17.0653 9.85414 17.8552 12 17.852C14.1459 17.8552 16.2172 17.0653 17.816 15.634C17.9013 15.5602 17.9711 15.4703 18.0213 15.3693C18.0716 15.2683 18.1012 15.1583 18.1085 15.0458C18.1157 14.9332 18.1006 14.8204 18.0638 14.7137C18.027 14.6071 17.9694 14.5089 17.8943 14.4248C17.8192 14.3406 17.7281 14.2723 17.6263 14.2237C17.5245 14.1751 17.4141 14.1473 17.3015 14.1418C17.1888 14.1364 17.0762 14.1534 16.9702 14.1918C16.8642 14.2303 16.7669 14.2895 16.684 14.366C15.3967 15.5191 13.7283 16.1553 12 16.152C10.2 16.152 8.56 15.477 7.316 14.366Z" fill="currentColor"/></svg>',Dt='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M19 2C19.7956 2 20.5587 2.31607 21.1213 2.87868C21.6839 3.44129 22 4.20435 22 5V20.806C22 22.141 20.387 22.811 19.441 21.868L15.56 18H5C4.20435 18 3.44129 17.6839 2.87868 17.1213C2.31607 16.5587 2 15.7956 2 15V5C2 4.20435 2.31607 3.44129 2.87868 2.87868C3.44129 2.31607 4.20435 2 5 2H19ZM17 7H7a.85.85 0 0 0 0 1.7H17A.85.85 0 0 0 17 7ZM12 11H7a.85.85 0 0 0 0 1.7H12A.85.85 0 0 0 12 11Z" fill="currentColor"/></svg>',Rt='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/></svg>',Vt='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',Yt='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',Ft='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',Wt=["Where is my order?","Return or refund policy","Talk to a human","Product recommendations"];function o(l){return String(l??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function ot(l){return o(l).replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>")}function xt(l){let u=String(l??"").replace(/\u2014|\u2013/g,",").replace(/\s+--\s+/g,", ").replace(/(^|[^\-])--([^\-]|$)/g,"$1, $2").replace(/\s*,\s*,+/g,",").replace(/\s{2,}/g," ").trim();if(!u)return"";const B=u.split(`
`).map(function(L){return L.trim()});let E="",i=[],b=null,x=[];function w(){i.length&&(E+="<p>"+ot(i.join(" "))+"</p>",i=[])}function t(){b&&x.length&&(E+="<"+b+">"+x.map(function(L){return"<li>"+ot(L)+"</li>"}).join("")+"</"+b+">",b=null,x=[])}return B.forEach(function(L){if(!L){t(),w();return}const T=L.match(/^[-•*]\s+(.+)/),j=L.match(/^\d+[.)]\s+(.+)/);T?(w(),b!=="ul"&&(t(),b="ul"),x.push(T[1])):j?(w(),b!=="ol"&&(t(),b="ol"),x.push(j[1])):(t(),i.push(L))}),t(),w(),E||"<p>"+ot(u)+"</p>"}function Kt(l){const u=l.replace("#",""),B=parseInt(u.slice(0,2),16),E=parseInt(u.slice(2,4),16),i=parseInt(u.slice(4,6),16);return"#"+[Math.max(0,B-18),Math.max(0,E-18),Math.max(0,i-18)].map(function(b){return b.toString(16).padStart(2,"0")}).join("")}function Gt(l){const u=l.replace("#","");if(u.length!==6)return"0,34,83";const B=parseInt(u.slice(0,2),16),E=parseInt(u.slice(2,4),16),i=parseInt(u.slice(4,6),16);return B+","+E+","+i}function Zt(l){return o(l==null||l===""?`Hi there 👋
How can we help?`:l).replace(/\n/g,"<br>")}function $t(l){const u=(Array.isArray(l.quickReplies)&&l.quickReplies.length?l.quickReplies:Wt).slice(0,8),B=l.faviconUrl?'<img src="'+o(l.faviconUrl)+'" alt="'+o(l.agentName)+'">':o(String(l.agentName||"S").charAt(0).toUpperCase()),E=typeof l.logoSizePx=="number"&&l.logoSizePx>=24&&l.logoSizePx<=64,i=Math.min(280,Math.max(24,Number(l.logoWidth)||0))||null,b=Math.min(120,Math.max(16,Number(l.logoHeight)||0))||null;let x="";i||b?x=' style="'+(i?"max-width:"+i+"px;":"")+(b?"max-height:"+b+"px;":E?"max-height:"+l.logoSizePx+"px;":"")+'width:auto;height:auto;"':E&&(x=' style="max-height:'+l.logoSizePx+'px;width:auto;height:auto;"');const w=x?"":" agt-hero-logo--"+(l.logoSize||"medium"),t=l.logoUrl?'<div class="agt-hero-logo'+w+'"><img src="'+o(l.logoUrl)+'" alt="'+o(l.storeName)+'"'+x+"></div>":"",L=l.logoUrl?"":'<div class="agt-hero-brand"><i class="fa-solid fa-building-columns"></i> '+o(l.storeName)+"</div>",T=Array.isArray(l.teamAgents)?l.teamAgents.slice(0,5):[],j=T,c=j.length?j.map(function(A,U){const O=A.color||"#a78bfa",G=A.avatarUrl?'<img src="'+o(A.avatarUrl)+'" alt="'+o(A.name||A.initials||"")+'">':o(A.initials||"?");return'<div class="agt-av" style="background:'+o(O)+'">'+G+"</div>"}).join(""):'<div class="agt-av" style="background:var(--brand)">'+o((l.storeName||"S").slice(0,2).toUpperCase())+"</div>",f=T.length?"We typically reply in a few minutes":"Leave us a message",P='<span class="ico-chat">'+qt+"</span>",C=l.disclaimer||"",Y=l.showBranding&&C?'<div class="agt-powered">'+o(C)+"</div>":"",k=l.privacyNotice||"This chat is AI-powered for faster assistance. Chats are monitored and recorded.",z=l.privacyPolicyLabel||"Privacy Policy",N=l.privacyPolicyUrl||"",_=N?'<a class="agt-privacy-link" href="'+o(N)+'" target="_blank" rel="noopener">'+o(z)+"</a>":'<span class="agt-privacy-link">'+o(z)+"</span>",v='<div class="agt-privacy-note"><p>'+o(k)+" "+_+"</p></div>",q='<div class="agt-email-privacy">'+o(k)+" "+_+"</div>";return'<button id="agt-launcher" aria-label="Open chat">'+P+'<span class="ico-close">'+Ut+'</span><span class="agt-badge" id="agt-badge">1</span></button><div id="agt-panel" role="dialog" aria-label="Customer support chat"><div class="agt-chat-header" id="agt-chat-header" style="display:none;"><button class="agt-chat-header-back show" id="agt-back-btn" aria-label="Back">'+Rt+'</button><div class="agt-chat-header-av">'+B+'</div><div class="agt-chat-header-info"><div class="agt-chat-header-name">'+o(l.agentName)+'</div><div class="agt-chat-header-status"><span class="agt-status-pip"></span><span>Online · replies instantly</span></div></div><button class="agt-new-chat-btn" id="agt-new-chat-btn" aria-label="New chat" title="New chat">'+Vt+'</button><button class="agt-chat-header-close" id="agt-close-btn" aria-label="Close">'+Yt+'</button></div><div class="agt-screen" id="agt-home"><div class="agt-home-scroll"><div class="agt-hero">'+t+L+"<h2>"+Zt(l.welcomeTitle)+'</h2><div class="agt-hero-sub">'+o(l.welcomeSubtitle||"Ask about orders, products, returns & store support.")+'</div></div><div class="agt-home-body">'+(u.length?'<div class="agt-qr-card">'+u.map(function(A){return'<div class="agt-qr-item" data-msg="'+o(A)+'"><span class="agt-qr-label">'+o(A)+'</span><span class="agt-qr-chevron">'+bt+"</span></div>"}).join("")+"</div>":"")+'<div class="agt-msg-card" id="agt-send-msg-card"><div class="agt-avatar-stack">'+c+'</div><div class="agt-msg-card-text"><div class="agt-msg-card-title">'+o(l.storeName)+'</div><div class="agt-msg-card-sub">'+o(f)+'</div></div><span class="agt-msg-card-arr">'+bt+'</span></div><div class="agt-history-section" id="agt-history-section"><div class="agt-history-heading">Messages</div><div class="agt-history-list" id="agt-history-list"><div class="agt-history-empty" id="agt-history-empty">No previous chats yet</div></div></div>'+Y+'</div></div><div class="agt-tabbar"><button class="agt-tab active" id="tab-home"><span class="agt-tab-ico">'+Ot+'</span><span>Home</span></button><button class="agt-tab" id="tab-chat"><span class="agt-tab-ico">'+Dt+'</span><span>Chat</span></button></div></div><div class="agt-screen gone" id="agt-email-gate"><div class="agt-email-gate"><div class="agt-email-gate-mid"><h3 id="agt-email-title">'+o(l.emailGateTitle||"Start a conversation")+'</h3><p id="agt-email-sub">'+o(l.emailGateSubtitle||"Enter your email so we can follow up with you.")+'</p><input type="email" class="agt-email-input" id="agt-email-input" placeholder="you@example.com" autocomplete="email" /><div class="agt-email-error gone" id="agt-email-error" role="alert"></div><button class="agt-email-btn" id="agt-email-btn" type="button">Continue to chat</button>'+q+'</div></div></div><div class="agt-screen gone" id="agt-chat"><div class="agt-chat-canvas"><div class="agt-messages-wrap"><div class="agt-messages" id="agt-messages"><div class="agt-chat-privacy" id="agt-chat-privacy">'+v+'</div><div class="agt-status-chip" id="agt-process-steps" aria-live="polite"><span class="agt-status-ring" aria-hidden="true"></span><span class="agt-process-label">Working on it…</span></div><div class="agt-typing" id="agt-typing" aria-hidden="true"><span class="agt-status-ring" aria-hidden="true"></span><span class="agt-process-label">Replying…</span></div></div><div class="agt-scroll" id="agt-scroll" aria-hidden="true"><div class="agt-scroll-thumb" id="agt-scroll-thumb"></div></div></div></div><div class="agt-composer" id="agt-composer"><div class="agt-input-bar gone" id="agt-input-bar"><div class="agt-attach-preview gone" id="agt-attach-preview"></div><div class="agt-input-wrap"><button type="button" class="agt-attach-btn gone" id="agt-attach-btn" aria-label="Attach file" title="Attach a file"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button><input type="file" id="agt-attach-input" class="agt-attach-input" multiple accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.txt,.csv,.doc,.docx,application/pdf" hidden /><textarea class="agt-input" id="agt-input" rows="1" placeholder="Type your message…" aria-label="Message"></textarea><button class="agt-send-btn" id="agt-send-btn" disabled aria-label="Send">'+Ft+"</button></div></div></div></div></div>"}function Jt(l,u,B,E){const i=E&&E.backgroundColor||"#ffffff",b=Kt(l),x=Gt(l),w="#"+B,t=w+" ",L=u.includes(",")?u:"'"+String(u).replace(/'/g,"")+"', system-ui, -apple-system, sans-serif";return t+"*, "+t+"*::before, "+t+`*::after { box-sizing: border-box; margin: 0; padding: 0; }

`+t+"button, "+t+"input, "+t+`textarea {
  font: inherit;
  letter-spacing: inherit;
}

`+t+`*::-webkit-scrollbar-button,
`+t+`*::-webkit-scrollbar-button:single-button,
`+t+`*::-webkit-scrollbar-button:vertical:start:decrement,
`+t+`*::-webkit-scrollbar-button:vertical:end:increment,
`+t+`*::-webkit-scrollbar-button:vertical:start:increment,
`+t+`*::-webkit-scrollbar-button:vertical:end:decrement,
`+t+`*::-webkit-scrollbar-button:decrement,
`+t+`*::-webkit-scrollbar-button:increment {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  background: transparent !important;
  border: none !important;
}

`+w+` {
  font-family: `+L+`;
  --brand:    `+l+`;
  --brand-dk: `+b+`;
  --ink:      #111214;
  --ink-2:    #1f2124;
  --white:    `+i+`;
  --gray-50:  #f7f8f9;
  --gray-100: #f0f2f4;
  --gray-200: #e4e7eb;
  --gray-300: #cbd0d8;
  --gray-400: #9aa1ac;
  --gray-500: #6b7280;
  --gray-700: #374151;
  --gray-900: #111827;
  --w: 400px;
  --h: 560px;
  --r: 20px;
  --shadow: none;
  --btn-shadow: none;
}

`+t+`#agt-launcher {
  position: fixed; bottom: max(14px, env(safe-area-inset-bottom, 0px)); right: 26px;
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--brand);
  border: none; outline: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
  z-index: 9999;
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
`+t+`#agt-launcher:hover { transform: scale(1.05); }
`+t+`#agt-launcher:active { transform: scale(0.96); }

`+t+`#agt-launcher .ico-chat,
`+t+`#agt-launcher .ico-close {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  line-height: 0;
  transition: opacity 0.2s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
`+t+`#agt-launcher .ico-chat img,
`+t+`#agt-launcher .ico-close img { width: 22px; height: 22px; object-fit: contain; }
`+t+`#agt-launcher .ico-close svg {
  width: 16px; height: 11px; display: block;
  transform: translateY(2px);
}
`+t+`#agt-launcher .ico-chat  { opacity: 1; transform: scale(1); }
`+t+`#agt-launcher .ico-close { opacity: 0; transform: scale(0.9); pointer-events: none; }
`+t+`#agt-launcher.open .ico-chat  { opacity: 0; transform: scale(0.9); pointer-events: none; }
`+t+`#agt-launcher.open .ico-close { opacity: 1; transform: scale(1); pointer-events: auto; }

`+t+`.agt-badge {
  position: absolute; top: -2px; right: -2px;
  width: 18px; height: 18px; border-radius: 50%;
  background: rgba(`+x+`, 0.35); border: 2px solid white;
  color: white; font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transform: scale(0);
  transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
}
`+t+`.agt-badge.show { opacity: 1; transform: scale(1); }

`+t+`#agt-panel {
  position: fixed; bottom: 88px; right: 26px;
  width: var(--w);
  height: min(var(--h), calc(100svh - 112px));
  min-height: 0;
  max-height: calc(100svh - 112px);
  background: var(--white);
  border-radius: var(--r);
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.06);
  overflow: hidden;
  display: flex; flex-direction: column;
  z-index: 9998;
  transition: width 0.22s ease, height 0.22s ease, max-height 0.22s ease;
  transform: translate3d(0, 14px, 0) scale(0.96);
  transform-origin: bottom right;
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
  transition:
    transform 0.2s cubic-bezier(0.4, 0, 1, 1),
    opacity 0.16s ease-in,
    visibility 0s linear 0.2s;
  will-change: transform, opacity;
}
`+t+`#agt-panel.open {
  transform: translate3d(0, 0, 0) scale(1);
  opacity: 1;
  pointer-events: all;
  visibility: visible;
  transition:
    transform 0.34s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.22s ease-out,
    visibility 0s linear 0s;
}

`+t+`.agt-chat-header {
  background: var(--white);
  border-bottom: 1px solid var(--gray-200);
  padding: 13px 16px;
  display: flex; align-items: center; gap: 10px;
  flex-shrink: 0;
}
`+t+`.agt-chat-header-back {
  background: none; border: none; cursor: pointer;
  min-width: 30px; height: 30px; padding: 0 8px; border-radius: 6px;
  display: none; align-items: center; justify-content: center;
  color: var(--gray-500); font-size: 13px; font-weight: 500;
  transition: background 0.14s; flex-shrink: 0;
}
`+t+`.agt-chat-header-back:hover { background: var(--gray-100); }
`+t+`.agt-chat-header-back.show { display: flex; }
`+t+`.agt-chat-header-av {
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--brand);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; color: white; font-size: 14px;
  overflow: hidden;
}
`+t+`.agt-chat-header-av img { width: 100%; height: 100%; object-fit: cover; }
`+t+`.agt-chat-header-info { flex: 1; min-width: 0; }
`+t+`.agt-chat-header-name {
  font-size: 13.5px; font-weight: 700;
  color: var(--ink); letter-spacing: -0.01em;
}
`+t+`.agt-chat-header-status {
  display: flex; align-items: center; gap: 5px;
  font-size: 11.5px; color: var(--gray-500); margin-top: 1px;
}
`+t+`.agt-status-pip {
  width: 6px; height: 6px; border-radius: 50%;
  background: #16a34a; flex-shrink: 0;
}
`+t+`.agt-chat-header-close {
  background: none; border: none; cursor: pointer;
  width: 28px; height: 28px; min-width: 28px; padding: 0; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  color: var(--gray-400); line-height: 0;
  transition: background 0.14s; flex-shrink: 0;
}
`+t+`.agt-chat-header-close svg { width: 14px; height: 14px; display: block; }
`+t+`.agt-chat-header-close:hover { background: var(--gray-100); color: var(--gray-700); }
`+t+`.agt-new-chat-btn {
  background: none; border: none; cursor: pointer;
  width: 28px; height: 28px; min-width: 28px; padding: 0; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  color: var(--gray-400); line-height: 0;
  transition: background 0.14s; flex-shrink: 0;
}
`+t+`.agt-new-chat-btn svg { width: 15px; height: 15px; display: block; }
`+t+`.agt-new-chat-btn:hover { background: var(--gray-100); color: var(--brand); }

`+t+`.gone { display: none !important; }
`+t+`.agt-screen { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
`+t+`.agt-screen.gone { display: none !important; }

`+t+`#agt-home {
  background: #ffffff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  max-height: none;
}

`+t+`.agt-home-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  scrollbar-width: none;
  -ms-overflow-style: none;
  overscroll-behavior: contain;
}
`+t+`.agt-home-scroll::-webkit-scrollbar { width: 0; height: 0; display: none; }
`+t+`.agt-hero {
  background: var(--brand);
  padding: 28px 18px 56px;
  flex-shrink: 0;
  position: relative;
}
`+t+`.agt-hero-logo {
  margin-bottom: 14px;
}
`+t+`.agt-hero-logo img {
  width: auto; height: auto; object-fit: contain; display: block;
}
`+t+`.agt-hero-logo--small img { max-width: 90px; max-height: 28px; }
`+t+`.agt-hero-logo--medium img { max-width: 120px; max-height: 40px; }
`+t+`.agt-hero-logo--large img { max-width: 150px; max-height: 52px; }
`+t+`.agt-hero-brand {
  font-family: `+u+`;
  font-size: 12px; font-weight: 700;
  color: rgba(255,255,255,0.6);
  letter-spacing: 0.1em; text-transform: uppercase;
  margin-bottom: 18px;
  display: flex; align-items: center; gap: 7px;
}
`+t+`.agt-hero-brand i { font-size: 11px; }
`+t+`.agt-hero h2 {
  font-family: `+u+`;
  font-size: 24px; font-weight: 800;
  color: white; line-height: 1.2;
  letter-spacing: -0.03em;
  margin: 18px 0 10px;
}
`+t+`.agt-hero-sub {
  font-family: `+u+`;
  font-size: 13.5px; color: rgba(255,255,255,0.72); margin: 0; font-weight: 400;
  line-height: 1.45; max-width: 92%;
}

`+t+`.agt-home-body {
  flex: 0 0 auto; overflow: visible;
  padding: 0 14px 16px;
  margin-top: -36px;
  display: flex; flex-direction: column; gap: 8px;
  position: relative; z-index: 2;
}

`+t+`.agt-qr-card {
  flex-shrink: 0;
  background: var(--white);
  border-radius: 16px;
  border: 1px solid rgba(15,23,42,0.06);
  box-shadow: 0 4px 18px rgba(15,23,42,0.08);
  overflow: hidden;
}
`+t+`.agt-qr-item {
  display: flex; align-items: center; gap: 12px;
  padding: 15px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--gray-100);
  transition: background 0.12s;
}
`+t+`.agt-qr-item:last-child { border-bottom: none; }
`+t+`.agt-qr-item:hover { background: var(--gray-50); }
`+t+`.agt-qr-item:active { background: var(--gray-100); }
`+t+`.agt-qr-label {
  flex: 1; font-size: 13.5px; font-weight: 500;
  color: var(--gray-700); line-height: 1.3;
}
`+t+`.agt-qr-chevron { color: var(--gray-300); flex-shrink: 0; display:flex; align-items:center; justify-content:center; width:16px; height:16px; overflow:visible; }

`+t+`.agt-msg-card {
  background: var(--white);
  border-radius: 16px;
  border: 1px solid rgba(15,23,42,0.06);
  box-shadow: 0 2px 10px rgba(15,23,42,0.05);
  padding: 14px 16px;
  display: flex; align-items: center; gap: 12px;
  cursor: pointer;
  transition: border-color 0.15s;
}
`+t+`.agt-msg-card:hover { border-color: var(--brand); }
`+t+`.agt-avatar-stack { display:flex; flex-direction:row; flex-shrink:0; align-items:center; }
`+t+`.agt-av { width:28px; height:28px; border-radius:50%; border:2px solid #fff; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; color:#fff; flex-shrink:0; overflow:hidden; }
`+t+`.agt-av + .agt-av { margin-left:-8px; }
`+t+`.agt-av img { width:100%; height:100%; object-fit:cover; display:block; }
`+t+`.agt-msg-card-text { flex: 1; }
`+t+`.agt-msg-card-title {
  font-size: 14px; font-weight: 700; color: var(--gray-900);
}
`+t+`.agt-msg-card-sub {
  font-size: 12px; color: var(--gray-400); margin-top: 3px; font-weight: 400;
}
`+t+`.agt-msg-card-arr { color: var(--gray-300); flex-shrink:0; display:flex; align-items:center; justify-content:center; width:16px; height:16px; overflow:visible; }

`+t+`.agt-history-section {
  margin-top: 6px;
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(15,23,42,0.06);
  box-shadow: 0 2px 10px rgba(15,23,42,0.05);
  overflow: hidden;
}
`+t+`.agt-history-heading {
  font-size: 12px; font-weight: 700; color: var(--gray-500);
  letter-spacing: 0.04em; text-transform: uppercase;
  padding: 12px 16px 8px;
}
`+t+`.agt-history-list { display: flex; flex-direction: column; }
`+t+`.agt-history-empty {
  padding: 10px 16px 14px; font-size: 12.5px; color: var(--gray-400);
}
`+t+`.agt-history-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; cursor: pointer;
  border-top: 1px solid var(--gray-100);
  transition: background 0.12s;
}
`+t+`.agt-history-item:hover { background: var(--gray-50); }
`+t+`.agt-history-av {
  width: 34px; height: 34px; border-radius: 50%; background: var(--brand);
  color: #fff; font-size: 12px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  overflow: hidden;
}
`+t+`.agt-history-av img { width: 100%; height: 100%; object-fit: cover; }
`+t+`.agt-history-text { flex: 1; min-width: 0; }
`+t+`.agt-history-title {
  font-size: 13.5px; font-weight: 650; color: var(--ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
`+t+`.agt-history-sub {
  font-size: 12px; color: var(--gray-400); margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
`+t+`.agt-history-chevron { color: var(--gray-300); flex-shrink: 0; }

`+t+`.agt-tabbar {
  display: flex;
  align-items: stretch;
  border-top: 1px solid var(--gray-200);
  background: var(--white);
  flex-shrink: 0;
  z-index: 3;
  height: 64px;
  padding: 0;
  box-sizing: border-box;
}
`+t+`.agt-tab {
  flex: 1;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  border: none;
  background: var(--white);
  color: var(--gray-400);
  transition: color 0.14s;
  font-family: `+u+`;
}
`+t+`.agt-tab .agt-tab-ico {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  line-height: 0;
}
`+t+`.agt-tab .agt-tab-ico svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: block;
}
`+t+`.agt-tab:hover { color: var(--gray-700); }
`+t+`.agt-tab.active { color: var(--brand); font-weight: 600; }
`+t+`.agt-tab > span:last-of-type {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1;
  height: 11px;
  display: block;
}

`+t+`.agt-powered {
  text-align: center; font-size: 11px;
  color: var(--gray-300); padding: 6px 0 4px;
  font-weight: 400;
}
`+t+`.agt-powered a { color: var(--gray-400); text-decoration: none; font-weight: 600; }

`+t+`#agt-chat {
  background: #ffffff;
}

`+t+`.agt-chat-canvas {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column;
  position: relative;
  background: #ffffff;
}

`+t+`.agt-chat-privacy {
  flex-shrink: 0;
  padding: 4px 4px 10px;
  background: transparent;
}
`+t+`.agt-privacy-note {
  text-align: center;
  font-size: 11px;
  line-height: 1.45;
  color: var(--gray-500);
}
`+t+`.agt-privacy-note p { margin: 0; }
`+t+`.agt-privacy-link {
  color: var(--gray-700); font-weight: 650; text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

`+t+`.agt-messages-wrap {
  flex: 1;
  min-height: 0;
  width: 100%;
  align-self: stretch;
  display: flex;
  position: relative;
}
`+t+`.agt-messages {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 10px 24px 16px 14px;
  display: flex; flex-direction: column; gap: 20px;
  background: #ffffff;
  overscroll-behavior: contain;
  touch-action: pan-y;
}
`+t+`.agt-messages > * { flex-shrink: 0; }
`+t+`.agt-scroll {
  position: absolute;
  top: 8px;
  right: 3px;
  bottom: 8px;
  width: 5px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 2;
}
`+t+`.agt-messages-wrap:hover .agt-scroll,
`+t+`.agt-messages-wrap.is-scrolling .agt-scroll,
`+t+`.agt-scroll.is-visible {
  opacity: 1;
}
`+t+`.agt-scroll-thumb {
  position: absolute;
  top: 0;
  left: 0;
  width: 5px;
  min-height: 28px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.28);
  pointer-events: auto;
  cursor: default;
}
`+t+`.agt-scroll-thumb:hover,
`+t+`.agt-scroll-thumb.is-dragging {
  background: rgba(15, 23, 42, 0.45);
}

`+t+`.agt-status-chip,
`+t+`.agt-typing {
  display: none;
  align-items: center;
  align-self: flex-start;
  gap: 8px;
  width: max-content;
  max-width: 100%;
  margin: 0;
  padding: 7px 12px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--gray-500);
  animation: msgIn 0.18s ease both;
  box-sizing: border-box;
}
`+t+`.agt-status-chip.visible,
`+t+`.agt-typing.visible {
  display: inline-flex;
}
`+t+`.agt-process-label {
  line-height: 1.3;
  white-space: normal;
  max-width: 220px;
}
`+t+`.agt-status-ring {
  width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid rgba(`+x+`, 0.2);
  border-top-color: var(--brand);
  animation: agt-spin 0.7s linear infinite;
}
@keyframes agt-spin { to { transform: rotate(360deg); } }

`+t+`.agt-date-sep {
  align-self: center;
  font-size: 11px; font-weight: 500;
  color: var(--gray-400);
  background: none;
  border: none;
  padding: 6px 0;
  margin: 2px 0;
  letter-spacing: 0.01em;
}

`+t+`.agt-msg-row {
  display: flex; flex-direction: column;
  margin-bottom: 0;
  position: relative;
  animation: msgIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes msgIn {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

`+t+`.agt-msg-row.customer { align-items: flex-end; }
`+t+`.agt-msg-row.agent    { align-items: flex-start; width: 100%; }

`+t+`.agt-msg-meta {
  display: flex; align-items: baseline; gap: 8px;
  font-size: 11px; font-weight: 600;
  color: var(--gray-500); margin: 0 0 2px; padding: 0 2px;
  letter-spacing: 0.01em; line-height: 1.2;
}
`+t+`.agt-msg-meta .agt-msg-name { font-weight: 600; color: var(--gray-500); }

`+t+`.agt-bubble {
  max-width: 100%; padding: 11px 14px;
  font-size: 13.5px; line-height: 1.55;
  border-radius: 16px; word-break: break-word;
  white-space: pre-wrap;
  font-weight: 400;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
`+t+`.agt-msg-row.customer .agt-bubble {
  max-width: 82%;
  background: var(--brand);
  color: #ffffff;
  border: none;
  border-bottom-right-radius: 5px;
  font-weight: 500;
}
`+t+`.agt-msg-row.agent .agt-bubble {
  background: #fff;
  color: var(--gray-700);
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-bottom-left-radius: 5px;
  font-weight: 400;
  text-align: left;
}
`+t+`.agt-msg-row.agent .agt-bubble p {
  margin: 0 0 8px;
  text-align: left;
}
`+t+`.agt-msg-row.agent .agt-bubble p:last-child {
  margin-bottom: 0;
}
`+t+`.agt-msg-row.agent .agt-bubble ul,
`+t+`.agt-msg-row.agent .agt-bubble ol {
  margin: 4px 0 8px;
  padding-left: 18px;
  text-align: left;
  list-style-position: outside;
}
`+t+`.agt-msg-row.agent .agt-bubble ol {
  margin: 4px 0 8px;
  padding-left: 20px;
  text-align: left;
  list-style-position: outside;
}
`+t+`.agt-msg-row.agent .agt-bubble li {
  margin-bottom: 5px;
}
`+t+`.agt-msg-row.agent .agt-bubble li:last-child {
  margin-bottom: 0;
}
`+t+`.agt-msg-row.agent .agt-bubble strong { font-weight: 700; color: var(--gray-900); }

`+t+`.agt-agent-row {
  display: flex; flex-direction: row; align-items: flex-end; gap: 8px;
  width: 100%; max-width: 100%;
  padding-right: 6px;
  box-sizing: border-box;
}
`+t+`.agt-agent-col {
  display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
  min-width: 0; flex: 1; max-width: calc(100% - 36px);
}
`+t+`.agt-agent-av {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--brand); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 2px; color: white; font-size: 11px; font-weight: 700;
  overflow: hidden;
  box-shadow: 0 0 0 2px #fff, 0 1px 3px rgba(15,23,42,0.12);
}
`+t+`.agt-agent-av img { width: 100%; height: 100%; object-fit: cover; display: block; }
`+t+`.agt-agent-av-fallback { background: var(--brand); }

`+t+`.agt-choice-stack {
  display: flex; flex-wrap: wrap; gap: 8px;
  width: 100%; margin-top: 4px;
  justify-content: flex-end;
  align-self: flex-end;
}
`+t+`.agt-choice-btn {
  text-align: center;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 999px;
  padding: 9px 14px;
  font-size: 12.5px; font-weight: 600; color: var(--ink);
  font-family: inherit; cursor: pointer;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
}
`+t+`.agt-choice-btn:hover {
  border-color: color-mix(in srgb, var(--brand) 45%, transparent);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
  transform: translateY(-1px);
}

`+t+`.agt-composer {
  flex-shrink: 0;
  background: #ffffff;
  border-top: 1px solid var(--gray-100);
  padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px));
  display: flex; flex-direction: column; gap: 0;
}
`+t+`.agt-composer:has(.agt-input-bar.gone) {
  padding: 0;
  border-top: none;
}
`+t+`.agt-input-bar.gone { display: none !important; }

`+t+`.agt-action-btns {
  display: flex; flex-wrap: wrap; gap: 7px;
  justify-content: flex-end;
  margin-top: 8px; margin-bottom: 4px;
  animation: msgIn 0.22s ease both;
  animation-delay: 0.06s;
}
`+t+`.agt-action-btn {
  padding: 8px 14px;
  border-radius: 20px;
  border: 1.5px solid var(--gray-300);
  background: var(--white); color: var(--gray-700);
  font-size: 12.5px; font-weight: 600;
  cursor: pointer;
  font-family: `+u+`;
  display: flex; align-items: center; justify-content: center;
  transition: border-color 0.14s, color 0.14s, background 0.14s;
  letter-spacing: -0.01em;
}
`+t+`.agt-action-btn:hover {
  border-color: var(--brand);
  color: var(--brand);
  background: rgba(`+x+`, 0.08);
}
`+t+`.agt-action-btn:active { transform: scale(0.97); }

`+t+`.agt-sources-card {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: 10px;
  padding: 6px 10px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  text-align: left;
}
`+t+`.agt-sources-card.open {
  border-color: var(--brand);
  box-shadow: 0 1px 4px rgba(`+x+`, 0.12);
}
`+t+`.agt-sources-toggle {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 600; color: var(--gray-500);
  letter-spacing: 0.02em;
}
`+t+`.agt-sources-toggle i:first-child { font-size: 10px; color: var(--brand); }
`+t+`.agt-sources-chevron {
  margin-left: auto; font-size: 9px; color: var(--gray-400);
  transition: transform 0.15s;
}
`+t+`.agt-sources-card.open .agt-sources-chevron {
  transform: rotate(180deg);
}
`+t+`.agt-sources-body {
  display: none;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--gray-100);
}
`+t+`.agt-sources-card.open .agt-sources-body {
  display: block;
}
`+t+`.agt-sources-body ul {
  margin: 0; padding-left: 16px;
  font-size: 11.5px; color: var(--gray-700); line-height: 1.45;
  text-align: left;
}
`+t+`.agt-sources-body li { margin-bottom: 4px; }
`+t+`.agt-sources-body li:last-child { margin-bottom: 0; }
`+t+`.agt-sources-body a { color: var(--brand); text-decoration: none; font-weight: 600; }
`+t+`.agt-sources-body a:hover { text-decoration: underline; }

`+t+`.agt-email-gate {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column;
  background: #ffffff;
  padding: 16px 22px 28px;
  overflow: hidden;
}
`+t+`.agt-email-gate-mid {
  flex: 1;
  display: flex; flex-direction: column; justify-content: center; gap: 12px;
  max-width: 100%;
}
`+t+`.agt-email-gate h3 { font-size:18px; font-weight:700; color:var(--ink); text-align:left; }
`+t+`.agt-email-gate p { font-size:13px; color:var(--gray-500); line-height:1.45; text-align:left; }
`+t+`.agt-email-privacy {
  margin-top: 4px;
  text-align: left;
  font-size: 11px;
  line-height: 1.45;
  color: var(--gray-400);
}
`+t+`.agt-email-privacy .agt-privacy-link {
  font-size: 11px;
}
`+t+`.agt-email-error { font-size:12px; line-height:1.4; color:#b42318; background:rgba(180,35,24,0.08); border:1px solid rgba(180,35,24,0.2); border-radius:10px; padding:10px 12px; }
`+t+`.agt-email-input { width:100%; border:1.5px solid var(--gray-200); border-radius:12px; padding:12px 14px; font-size:14px; font-family:inherit; background:#fff; }
`+t+`.agt-email-btn { width:100%; border:none; border-radius:12px; padding:12px 14px; background:var(--brand); color:#fff; font-weight:700; font-size:14px; cursor:pointer; }
`+t+`.agt-email-btn:disabled { opacity:0.6; cursor:not-allowed; }
`+t+`.agt-product-rail { position:relative; width:100%; max-width:100%; margin-top:4px; }
`+t+`.agt-product-grid { display:flex; flex-wrap:nowrap; gap:10px; width:100%; max-width:100%; overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; touch-action:pan-x; overscroll-behavior-x:contain; scrollbar-width:none; -ms-overflow-style:none; padding:0 2px 2px; scroll-snap-type:x proximity; cursor:default; }
`+t+`.agt-product-grid::-webkit-scrollbar { display:none; width:0; height:0; }
`+t+`.agt-product-grid.is-dragging { scroll-snap-type:none; }
@media (hover: none) and (pointer: coarse) {
  `+t+`.agt-product-grid { cursor:grab; }
  `+t+`.agt-product-grid.is-dragging { cursor:grabbing; }
}
`+t+`.agt-product-rail::before, `+t+`.agt-product-rail::after { content:""; position:absolute; top:0; bottom:2px; width:14px; pointer-events:none; z-index:2; }
`+t+`.agt-product-rail::before { left:0; background:linear-gradient(to right, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 100%); }
`+t+`.agt-product-rail::after { right:0; background:linear-gradient(to left, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 100%); }
`+t+`.agt-product-nav { position:absolute; top:42%; transform:translateY(-50%); z-index:4; width:28px; height:28px; border-radius:50%; border:1px solid var(--gray-200); background:rgba(255,255,255,0.96); color:var(--ink); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 1px 4px rgba(15,23,42,0.12); padding:0; transition:opacity .15s ease, background .15s ease; }
`+t+`.agt-product-nav:hover { background:#fff; }
`+t+`.agt-product-nav[disabled] { opacity:0.35; pointer-events:none; }
`+t+`.agt-product-nav-prev { left:2px; }
`+t+`.agt-product-nav-next { right:2px; }
`+t+`.agt-product-nav svg { width:14px; height:14px; display:block; }
`+t+`.agt-product-card { flex:0 0 148px; width:148px; display:flex; flex-direction:column; border:1px solid var(--gray-200); border-radius:12px; overflow:hidden; background:#fff; color:inherit; min-width:0; box-shadow:0 1px 2px rgba(15,23,42,0.04); scroll-snap-align:start; pointer-events:auto; }
`+t+`.agt-product-media { position:relative; display:block; width:100%; background:var(--gray-100); overflow:hidden; }
`+t+`.agt-product-card img { width:100%; aspect-ratio:1 / 1; height:auto; object-fit:cover; object-position:center top; display:block; pointer-events:none; user-select:none; }
`+t+`.agt-product-card .agt-product-body { padding:8px 9px 10px; display:flex; flex-direction:column; gap:6px; flex:1; min-width:0; }
`+t+`.agt-product-card .agt-product-title { font-size:11px; font-weight:600; line-height:1.3; color:var(--ink); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
`+t+`.agt-product-card .agt-product-row { display:flex; align-items:center; justify-content:space-between; gap:6px; }
`+t+`.agt-product-card .agt-product-price { font-size:12px; color:var(--brand); font-weight:700; letter-spacing:0.01em; }
`+t+`.agt-product-view { display:inline-flex; align-items:center; justify-content:center; width:100%; margin-top:auto; padding:7px 8px; border-radius:8px; border:1px solid var(--gray-200); background:var(--gray-50); color:var(--ink); font-size:11px; font-weight:600; line-height:1; text-decoration:none; cursor:pointer; transition:background .15s ease, border-color .15s ease, color .15s ease; }
`+t+`.agt-product-view:hover { background:#fff; border-color:var(--brand); color:var(--brand); }
`+t+`.agt-product-view.is-disabled { opacity:0.45; pointer-events:none; cursor:default; }
`+t+`.agt-system-event { text-align:center; font-size:11.5px; color:var(--gray-500); padding:6px 12px; background:var(--gray-50); border-radius:999px; align-self:center; }

`+t+`.agt-input-form {
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  padding: 14px;
  width: 100%;
  max-width: 100%;
  margin-top: 2px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
  animation: msgIn 0.3s ease both;
}
`+t+`.agt-input-form.is-submitted { opacity: 0.72; pointer-events: none; }
`+t+`.agt-form-title {
  font-size: 13px; font-weight: 700; color: var(--ink); margin-bottom: 2px;
}
`+t+`.agt-form-summary {
  background: var(--gray-50);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 4px;
}
`+t+`.agt-form-summary-line { font-size: 12px; color: var(--gray-600); font-weight: 500; }
`+t+`.agt-form-field { display: flex; flex-direction: column; gap: 5px; }
`+t+`.agt-form-label {
  font-size: 11px; font-weight: 600; color: var(--gray-500); letter-spacing: 0.01em;
}
`+t+`.agt-form-label em { font-style: normal; font-weight: 500; color: var(--gray-400); }
`+t+`.agt-form-input {
  width: 100%;
  border: 1.5px solid var(--gray-200);
  border-radius: 12px;
  padding: 11px 12px;
  font-size: 14px;
  font-family: inherit;
  background: #fff;
  color: var(--ink);
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}
`+t+`.agt-form-input:focus { border-color: var(--brand); }
`+t+`.agt-form-input.is-invalid { border-color: #e11d48; }
`+t+`.agt-form-submit {
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 12px 14px;
  background: var(--brand);
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  margin-top: 2px;
}
`+t+`.agt-form-submit:disabled { opacity: 0.6; cursor: not-allowed; }

`+t+`.agt-order-card {
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 16px;
  padding: 14px;
  max-width: 100%; width: 100%;
  margin-top: 2px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
  animation: msgIn 0.3s ease both;
}
`+t+`.agt-order-top {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
  margin-bottom: 14px;
}
`+t+`.agt-order-id { font-size: 12px; font-weight: 700; color: var(--ink); }
`+t+`.agt-order-total { font-size: 12px; color: var(--gray-500); margin-top: 2px; font-weight: 500; }
`+t+`.agt-order-badge {
  font-size: 10px; font-weight: 700; letter-spacing: 0.02em;
  padding: 4px 8px; border-radius: 999px;
  background: #ecfdf5; color: #047857;
  border: 1px solid #a7f3d0; text-transform: capitalize; flex-shrink: 0;
}
`+t+`.agt-order-badge.is-refunded,
`+t+`.agt-order-badge.is-cancelled {
  background: #fef2f2; color: #b91c1c; border-color: #fecaca;
}
`+t+`.agt-order-outcome {
  border-radius: 12px;
  padding: 12px 13px;
  margin-bottom: 12px;
  border: 1px solid transparent;
}
`+t+`.agt-order-outcome-refunded {
  background: #fef2f2; border-color: #fecaca;
}
`+t+`.agt-order-outcome-cancelled {
  background: #fff7ed; border-color: #fed7aa;
}
`+t+`.agt-order-outcome-title {
  font-size: 13px; font-weight: 700; color: var(--ink); margin-bottom: 3px;
}
`+t+`.agt-order-outcome-detail {
  font-size: 12px; color: var(--gray-600); line-height: 1.4; font-weight: 500;
}
`+t+`.agt-order-stepper {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 4px; margin-bottom: 14px; padding: 0 2px;
}
`+t+`.agt-order-step {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
  position: relative; min-width: 0;
}
`+t+`.agt-order-step:not(:last-child)::after {
  content: ""; position: absolute; top: 7px; left: calc(50% + 10px); right: calc(-50% + 10px);
  height: 2px; background: var(--gray-200); border-radius: 2px;
}
`+t+`.agt-order-step.done:not(:last-child)::after,
`+t+`.agt-order-step.active:not(:last-child)::after { background: #22c55e; }
`+t+`.agt-order-step-dot {
  width: 14px; height: 14px; border-radius: 50%;
  background: #fff; border: 2px solid var(--gray-300);
  z-index: 1; box-sizing: border-box;
}
`+t+`.agt-order-step.done .agt-order-step-dot,
`+t+`.agt-order-step.active .agt-order-step-dot {
  background: #22c55e; border-color: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
}
`+t+`.agt-order-step-label {
  font-size: 9.5px; font-weight: 600; color: var(--gray-400);
  text-align: center; line-height: 1.2;
}
`+t+`.agt-order-step.done .agt-order-step-label,
`+t+`.agt-order-step.active .agt-order-step-label { color: var(--gray-700); }
`+t+`.agt-order-items { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
`+t+`.agt-order-item { font-size: 12px; color: var(--gray-600); font-weight: 500; }
`+t+`.agt-order-num,
`+t+`.agt-order-status-row,
`+t+`.agt-order-track,
`+t+`.agt-track-step,
`+t+`.agt-track-dot,
`+t+`.agt-track-label,
`+t+`.agt-track-line { display: none !important; }
`+t+`.agt-order-track-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; padding: 10px 12px; border-radius: 12px;
  background: var(--ink); color: #fff; text-decoration: none;
  font-size: 12.5px; font-weight: 650;
}
`+t+`.agt-order-track-btn:hover { opacity: 0.92; color: #fff; }

`+t+`.agt-connecting {
  display: inline-flex; align-items: center; gap: 10px;
  align-self: center; margin: 4px 0;
  padding: 10px 16px; border-radius: 999px;
  background: rgba(255,255,255,0.95);
  border: 1px solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
  font-size: 12.5px; font-weight: 550; color: var(--gray-700);
  max-width: 92%;
}
`+t+`.agt-connecting-copy {
  display: flex; flex-direction: column; gap: 2px; min-width: 0;
  text-align: left;
}
`+t+`.agt-connecting-title {
  font-size: 12.5px; font-weight: 600; color: var(--gray-700); line-height: 1.25;
}
`+t+`.agt-connecting-queue {
  font-size: 11.5px; font-weight: 550; color: var(--brand); line-height: 1.25;
}
`+t+`.agt-connecting .agt-status-ring {
  border-color: rgba(22,163,74,0.2); border-top-color: #16a34a;
}

`+t+`.agt-rating {
  margin-left: 0; margin-top: 8px;
  animation: msgIn 0.22s ease both;
  background: #fff; border: 1px solid rgba(15,23,42,0.07);
  border-radius: 16px; padding: 14px; width: 100%;
  box-shadow: 0 6px 18px rgba(15,23,42,0.05);
}
`+t+`.agt-rating-label {
  font-size: 13px; color: var(--ink); margin-bottom: 10px; font-weight: 650;
}
`+t+`.agt-rating-emojis { display: flex; gap: 8px; justify-content: space-between; }
`+t+`.agt-rating-emoji {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  border: 1px solid rgba(15,23,42,0.08);
  background: #fff;
  border-radius: 12px;
  padding: 10px 4px 8px;
  cursor: pointer;
  font-family: inherit;
  transition: transform .14s ease, border-color .14s ease, background .14s ease;
}
`+t+`.agt-rating-emoji:hover {
  transform: translateY(-2px) scale(1.04);
  border-color: var(--brand);
  background: rgba(216,90,48,0.04);
}
`+t+`.agt-rating-emoji.is-selected {
  border-color: var(--brand);
  background: rgba(216,90,48,0.08);
}
`+t+`.agt-rating-emoji .agt-rating-face { font-size: 26px; line-height: 1; }
`+t+`.agt-rating-emoji .agt-rating-caption {
  font-size: 10px; font-weight: 600; color: var(--gray-500);
}
`+t+`.agt-stars { display: flex; gap: 6px; }
`+t+`.agt-star {
  font-size: 22px; cursor: pointer;
  color: var(--gray-300);
  transition: color 0.14s, transform 0.14s;
}
`+t+`.agt-star:hover { color: #f59e0b; transform: scale(1.18); }
`+t+`.agt-star.selected { color: #f59e0b; }
`+t+`.agt-rating-thanks {
  font-size: 12px; color: var(--gray-500);
  font-weight: 500; margin-top: 7px; display: none;
}

`+t+`.agt-input-bar {
  padding: 0;
  border-top: none;
  background: transparent;
  display: flex; align-items: center; gap: 10px;
  flex-shrink: 0;
  width: 100%;
}
`+t+`.agt-attach-btn {
  flex-shrink: 0; width: 32px; height: 32px; border: none; background: transparent;
  color: var(--gray-500); border-radius: 50%; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0; margin: 0 0 0 -4px; transition: color 0.15s, background 0.15s;
}
`+t+`.agt-attach-btn:hover { color: var(--brand); background: rgba(0,0,0,0.04); }
`+t+`.agt-attach-btn.gone, `+t+`.agt-attach-preview.gone { display: none !important; }
`+t+`.agt-attach-preview {
  display: flex; flex-wrap: wrap; gap: 6px; padding: 0 2px 8px;
}
`+t+`.agt-attach-chip {
  display: inline-flex; align-items: center; gap: 6px; max-width: 100%;
  padding: 4px 8px; border-radius: 10px; background: var(--gray-100);
  font-size: 12px; color: var(--gray-700);
}
`+t+`.agt-attach-chip button {
  border: none; background: transparent; cursor: pointer; color: var(--gray-500);
  font-size: 14px; line-height: 1; padding: 0 2px;
}
`+t+`.agt-attach-list { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
`+t+`.agt-attach-list:first-child { margin-top: 0; }
`+t+`.agt-attach-img {
  display: block; max-width: 220px; max-height: 180px; border-radius: 10px;
  object-fit: cover; cursor: pointer;
}
`+t+`.agt-msg-row.customer .agt-attach-img { border: 1px solid rgba(255,255,255,0.25); }
`+t+`.agt-attach-file {
  display: inline-flex; align-items: center; gap: 8px; padding: 8px 10px;
  border-radius: 10px; background: rgba(0,0,0,0.06); text-decoration: none;
  color: inherit; font-size: 12.5px; max-width: 100%;
}
`+t+`.agt-msg-row.customer .agt-attach-file { background: rgba(255,255,255,0.18); color: #fff; }
`+t+`.agt-attach-file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`+t+`.agt-input-wrap {
  flex: 1;
  width: 100%;
  min-height: 44px;
  background: var(--white);
  border: 1.5px solid var(--gray-200);
  border-radius: 22px;
  display: flex; align-items: center;
  padding: 4px 6px 4px 14px;
  gap: 8px;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
`+t+`.agt-input-wrap:focus-within {
  border-color: var(--brand);
  box-shadow: none;
}
`+t+`.agt-input {
  flex: 1; min-width: 0;
  background: none; border: none; outline: none;
  font-size: 14px; color: var(--gray-700);
  font-family: `+u+`;
  resize: none;
  height: 36px;
  min-height: 36px;
  max-height: 96px;
  line-height: 20px;
  padding: 8px 2px;
  margin: 0;
  box-sizing: border-box;
  overflow-y: hidden;
  field-sizing: fixed;
}
`+t+`.agt-input::placeholder { color: var(--gray-400); opacity: 1; line-height: 20px; }
`+t+`.agt-send-btn {
  width: 36px; height: 36px; padding: 0; border-radius: 50%;
  background: var(--brand); border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; color: white;
  transition: background 0.16s, transform 0.16s;
}
`+t+`.agt-send-btn:hover { background: var(--brand-dk); transform: scale(1.05); }
`+t+`.agt-send-btn:active { transform: scale(0.94); }
`+t+`.agt-send-btn:disabled {
  background: var(--gray-200); color: var(--gray-400); cursor: not-allowed; transform: none;
}
`+t+`.agt-send-btn svg { width: 18px; height: 18px; }

@media (max-height: 780px) {
  `+w+` #agt-panel {
    height: min(var(--h), calc(100svh - 100px));
    max-height: calc(100svh - 100px);
    bottom: 78px;
  }
  `+w+` #agt-launcher { bottom: max(12px, env(safe-area-inset-bottom, 0px)); right: 18px; }
}
@media (max-width: 480px) {
  `+w+` #agt-panel {
    width: min(100% - 24px, 360px);
    max-width: calc(100vw - 24px);
    height: min(var(--h), calc(100svh - 98px));
    min-height: 0;
    max-height: calc(100svh - 98px);
    bottom: 80px; right: 12px; left: auto;
    border-radius: 20px;
  }
  `+w+` #agt-launcher { bottom: max(14px, env(safe-area-inset-bottom, 0px)); right: 18px; }
}
@media (max-width: 380px) {
  `+w+` #agt-panel {
    width: calc(100vw - 20px);
    right: 10px; left: 10px;
    height: min(var(--h), calc(100svh - 98px));
    min-height: 0;
    max-height: calc(100svh - 98px);
  }
}
`}(function(){const l=window.AgentraConfig||{},u=l.widgetKey||l.key||"",B=(l.apiBase||"http://localhost:5000/api/v1/widget").replace(/\/$/,""),E="data-agentra-widget-style";let i=null,b=null,x=null,w=null,t=!1,L=!1,T=!1,j=null,c,f,P,C,Y,k,z,N,_,v,q,A,U;const O=new Set;function G(){if(!c)return;const n=(i==null?void 0:i.privacyNotice)||"This chat is AI-powered for faster assistance. Chats are monitored and recorded.",e=(i==null?void 0:i.privacyPolicyLabel)||"Privacy Policy",a=(i==null?void 0:i.privacyPolicyUrl)||"",r=a?'<a class="agt-privacy-link" href="'+o(a)+'" target="_blank" rel="noopener">'+o(e)+"</a>":'<span class="agt-privacy-link">'+o(e)+"</span>",s=[];k&&s.push(k),C&&s.push(C),s.forEach(function(d){d.remove()}),c.innerHTML='<div class="agt-chat-privacy" id="agt-chat-privacy"><div class="agt-privacy-note"><p>'+o(n)+" "+r+"</p></div></div>",s.forEach(function(d){c.appendChild(d)}),k==null||k.classList.remove("visible"),C&&(C.classList.remove("visible"),C.setAttribute("aria-hidden","true")),j=null}function D(){c&&(k&&c.appendChild(k),C&&c.appendChild(C))}function vt(){return"agentra_chat_history_"+(u||"default")}function yt(){try{const n=localStorage.getItem(vt()),e=n?JSON.parse(n):[];return Array.isArray(e)?e:[]}catch{return[]}}function wt(n){if(!(n!=null&&n.sessionToken))return;const e=yt().filter(function(a){return a.sessionToken!==n.sessionToken});e.unshift(n),localStorage.setItem(vt(),JSON.stringify(e.slice(0,5))),J()}function J(){const n=document.getElementById("agt-history-list"),e=document.getElementById("agt-history-empty");if(!n)return;const a=yt().slice(0,5);if(n.querySelectorAll(".agt-history-item").forEach(function(r){r.remove()}),!a.length){e&&e.classList.remove("gone");return}e&&e.classList.add("gone"),a.forEach(function(r){const s=document.createElement("div");s.className="agt-history-item",s.setAttribute("data-session",r.sessionToken||"");const d=o(String(r.agentName||(i==null?void 0:i.agentName)||"C").charAt(0).toUpperCase()),g=i!=null&&i.faviconUrl?'<img src="'+o(i.faviconUrl)+'" alt="">':d,S=r.updatedAt?new Date(r.updatedAt).toLocaleString(void 0,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"";s.innerHTML='<div class="agt-history-av">'+g+'</div><div class="agt-history-text"><div class="agt-history-title">'+o(r.preview||"Previous conversation")+'</div><div class="agt-history-sub">'+o(S)+(r.email?" · "+o(r.email):"")+'</div></div><span class="agt-history-chevron">›</span>',s.addEventListener("click",function(){vn(r.sessionToken,r.email)}),n.appendChild(s)})}function Qt(){const n=i==null?void 0:i.quickReplies;return Array.isArray(n)&&n.length?n.slice(0,8):["Where is my order?","Return or refund policy","Talk to a human","Product recommendations"]}function kt(){return(i==null?void 0:i.askAnythingLabel)||"Ask me anything"}function Xt(n){const e=String(n||"").toLowerCase();return/order number|email address|share your|please (share|provide|confirm|enter|send)|what(?:'s| is) your|used when placing|double-check both|try again/i.test(e)}function st(n){const e=String(n||"").toLowerCase();return/don'?t have a teammate|no teammate|not online|no (one|agent).{0,20}online|currently away|when someone is available|team will see this chat/i.test(e)}function St(n){const e=String(n||"").toLowerCase();return st(e)?!1:/(connect you with|would you like me to connect|i can connect you|talk to (a )?human|speak (to|with) (an? )?agent)/i.test(e)}function tn(n){const e=String(n||"").trim();if(!e||e.length>320||Xt(e))return!1;if(st(e)||St(e))return!0;const a=e.toLowerCase();if(/(anything else|need (any )?more help|does that help|is there anything|glad i could|you(?:'re| are) all set|what else can i help)/i.test(a))return!0;if(e.length>140||!/\?\s*$/.test(e))return!1;if(/\b(what|which|where|how|who|when|why|any specific|tell me|interested in|looking for|prefer|style|color|colour|occasion|budget|size|type of)/i.test(a))return!1;return/\b(does that|is that|would you like|want me to|shall i|can i (help|connect)|do you want|should i|are you (sure|ready))/i.test(a)}function nn(n){if(!tn(n))return[];const e=[];return st(n)?(e.push({label:"Keep helping me",message:"Please keep helping me here"}),e.push({label:"Leave a note for the team",message:"Please leave a note for your team"})):St(n)?(e.push({label:"Yes, connect me",message:"Yes, please connect me with an agent"}),e.push({label:"No, keep helping here",message:"No, please keep helping me here"})):/(anything else|more help|does that help|all set|what else can i help)/i.test(n)?(e.push({id:"all_set",label:"All set, thanks",message:"All set, thank you"}),e.push({id:"still_need_help",label:"I still need help",message:"I still need help"})):(e.push({label:"Yes",message:"Yes"}),e.push({label:"No",message:"No"})),e.push({action:"ask-anything",label:T?"Something else…":"Type my own reply"}),e}function Q(n){T=!!n,U&&U.classList.toggle("gone",!T),T&&(c==null||c.querySelectorAll(".agt-choice-stack").forEach(function(e){e.remove()}),X(),f==null||f.focus())}function Lt(n){if(!c||!(n!=null&&n.length))return;c.querySelectorAll(".agt-choice-stack").forEach(function(a){a.remove()});const e=document.createElement("div");e.className="agt-choice-stack",e.innerHTML=n.map(function(a){return typeof a=="string"?'<button type="button" class="agt-choice-btn" data-msg="'+o(a)+'">'+o(a)+"</button>":a.action==="ask-anything"?'<button type="button" class="agt-choice-btn" data-action="ask-anything">'+o(a.label||kt())+"</button>":'<button type="button" class="agt-choice-btn" data-msg="'+o(a.message||a.label||"")+'"'+(a.id?' data-choice-id="'+o(a.id)+'"':"")+'>'+o(a.label||a.message||"")+"</button>"}).join(""),c.appendChild(e),D(),R()}function en(){Lt(Qt().map(function(n){return{label:n,message:n}}).concat([{action:"ask-anything",label:kt()}]))}const an={retrieving:"Searching store policies…",checking_order:"Looking up your order…",searching_products:"Finding products…",updating_address:"Checking address change…",cancelling_order:"Checking cancellation…",handoff:"Connecting you…",thinking:"Working on your request…"};function ynSanitizeHint(n){return String(n||"").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi," ").replace(/\+?\d[\d\s().-]{7,}\d/g," ").replace(/\border\s*#?\s*\d{3,8}\b/gi," order ").replace(/#[0-9]{3,8}\b/g," ").replace(/\s+/g," ").trim()}function ynSteps(n){const e=ynSanitizeHint(n).toLowerCase();if(/budget|under\s*\$|max\b|\$\s*\d|price|cheap|afford|\d+k\b/.test(e))return["Checking options within your budget…","Matching products to your range…","Preparing a short list…"];if(/size\s*(xxxl|xxl|xl|xs|s|m|l|\d{1,2})|\bin\s+(xxxl|xxl|xl|xs|s|m|l)\b|(xxxl|xxl|xl)\b/.test(e))return["Checking size availability…","Matching products in your size…","Preparing options…"];if(/recommend|product|dress|gown|veil|show me|looking for|no idea|suggest|white|ivory|lace|anything/.test(e))return["Finding products…","Checking your preferences…","Preparing product options…"];if(/order|track|where.*(package|order)|status|refund/.test(e))return["Looking up your order…","Verifying order details…","Preparing status update…"];if(/address|shipping address/.test(e))return["Checking address change options…","Verifying eligibility…"];if(/cancel/.test(e))return["Checking cancellation options…","Verifying eligibility…"];if(/human|agent|person|talk to/.test(e))return["Connecting you with support…"];if(/policy|return|ship|refund policy|hours/.test(e))return["Searching store policies…","Pulling the relevant details…"];return["Working on your request…","Putting a reply together…"]}function ynHint(n){const e=ynSanitizeHint(n).toLowerCase();return/budget|under\s*\$|max\b|\$\s*\d|price|cheap|afford|\d+k\b|recommend|product|dress|gown|veil|show me|looking for|no idea|suggest|white|ivory|lace|anything|size|xxl|xl/.test(e)?"searching_products":/order|track|where.*(package|order)|status|refund/.test(e)?"checking_order":/address|shipping address/.test(e)?"updating_address":/cancel/.test(e)?"cancelling_order":/human|agent|person|talk to/.test(e)?"handoff":/policy|return|ship|refund policy|hours/.test(e)?"retrieving":"thinking"}function rn(n){return!n||typeof n!="object"?"":n._id?String(n._id):n.id?String(n.id):[n.role||"",n.contentType||"",String(n.body||"").trim(),n.sentAt||"",n.senderName||""].join("|")}function lt(n){const e=rn(n);return e?O.has(e)?!0:(O.add(e),!1):!1}async function Z(n,e,a){const r=B+n,s={method:e||"GET",headers:{"Content-Type":"application/json","x-widget-key":u}};a&&(s.body=JSON.stringify({...a,widgetKey:u}));const g=await(await fetch(r,s)).json();if(!g.success)throw new Error(g.message||"Request failed");return g.data}function Ct(n){const e=String(n||"Plus Jakarta Sans").replace(/['"]/g,"").split(",")[0].trim();if(!e)return;if(!document.querySelector('link[href*="fonts.googleapis.com"][rel="preconnect"]')){const s=document.createElement("link");s.rel="preconnect",s.href="https://fonts.googleapis.com",document.head.appendChild(s);const d=document.createElement("link");d.rel="preconnect",d.href="https://fonts.gstatic.com",d.crossOrigin="anonymous",document.head.appendChild(d)}const a="agentra-gf-"+e.replace(/\s+/g,"-");if(document.querySelector("#"+a))return;const r=document.createElement("link");r.id=a,r.rel="stylesheet",r.href="https://fonts.googleapis.com/css2?family="+encodeURIComponent(e).replace(/%20/g,"+")+":wght@400..800&display=swap",document.head.appendChild(r)}Ct("Plus Jakarta Sans");function on(){if(document.querySelector("#agentra-fa-css"))return;const n=document.createElement("link");n.id="agentra-fa-css",n.rel="stylesheet",n.href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css",document.head.appendChild(n)}function zt(){if(!(!b||!(i!=null&&i.wsUrl)))try{w&&w.close();const n=i.wsUrl+"?session="+encodeURIComponent(b)+"&role=visitor";w=new WebSocket(n),w.onmessage=function(e){var a,r,s,d;try{const g=JSON.parse(e.data);g.type==="message"&&g.data&&pt(g.data),g.type==="system_event"&&((a=g.data)==null?void 0:a.event)==="agent_joined"&&(W(),typeof window.ynSetAttach==="function"&&window.ynSetAttach(!0),Tt((g.data.agentName||"An agent")+" joined the chat")),g.type==="status"&&((r=g.data)!=null&&r.status)&&At(g.data.status),g.type==="typing"&&((s=g.data)==null?void 0:s.role)!=="customer"&&$(!!((d=g.data)!=null&&d.active))}catch{}}}catch{}}let ynStepTimer=null,ynStepMsg="";function At(n,e){var a;if(!k||!((a=i==null?void 0:i.behavior)!=null&&a.retrievalIndicator)){if(C&&e){const steps=ynSteps(e),label=C.querySelector(".agt-process-label");label&&(label.textContent=steps[0]||an[n]||"Working on it…")}return}ynStepTimer&&(clearInterval(ynStepTimer),ynStepTimer=null);ynStepMsg=e||"";const steps=ynSteps(e||""),label=k.querySelector(".agt-process-label");let idx=0;label&&(label.textContent=steps[0]||an[n]||"Working on it…"),k.classList.add("visible"),C&&(C.classList.remove("visible"),C.setAttribute("aria-hidden","true")),D(),R();steps.length>1&&(ynStepTimer=setInterval(function(){idx=(idx+1)%steps.length;const el=k&&k.querySelector(".agt-process-label");el&&(el.textContent=steps[idx]),D(),R()},1400))}function ct(){ynStepTimer&&(clearInterval(ynStepTimer),ynStepTimer=null);ynStepMsg="";k==null||k.classList.remove("visible"),F()}function $(n){C&&(n&&(k!=null&&k.classList.contains("visible"))||(n&&ynStepMsg&&C.querySelector(".agt-process-label")&&(C.querySelector(".agt-process-label").textContent=ynSteps(ynStepMsg)[0]||"Working on it…"),C.classList.toggle("visible",n),C.setAttribute("aria-hidden",n?"false":"true"),n?(D(),R()):F()))}function X(){if(!f)return;const n=36,e=96;if(f.style.lineHeight="20px",f.style.height=n+"px",f.style.overflowY="hidden",!f.value)return;f.offsetHeight;const a=f.scrollHeight;if(a<=n+2)return;const r=Math.min(Math.max(a,n),e);f.style.height=r+"px",r>=e&&(f.style.overflowY="auto")}function R(){c&&(c.scrollTop=c.scrollHeight,F()),typeof ynBindProductRails==="function"&&ynBindProductRails(c)}function F(){const n=document.getElementById("agt-scroll"),e=document.getElementById("agt-scroll-thumb"),a=c&&c.parentElement;if(!c||!n||!e||!a)return;const r=c.clientHeight,s=c.scrollHeight,d=Math.max(0,s-r);if(d<=2){n.classList.remove("is-visible"),e.style.height="0px";return}const g=n.clientHeight||r,S=Math.max(28,Math.round(r/s*g)),p=Math.max(0,g-S),h=d===0?0:Math.round(c.scrollTop/d*p);e.style.height=S+"px",e.style.transform="translateY("+h+"px)",n.classList.add("is-visible")}function sn(){const n=document.getElementById("agt-scroll"),e=document.getElementById("agt-scroll-thumb"),a=c&&c.parentElement;if(!c||!n||!e||!a)return;let r=null,s=!1,d=0,g=0,S=0,p=0;function h(){return Math.max(0,c.scrollHeight-c.clientHeight)}function y(m){const H=h();c.scrollTop=Math.max(0,Math.min(H,m)),F(),M()}function M(){a.classList.add("is-scrolling"),r&&clearTimeout(r),r=setTimeout(function(){a.classList.remove("is-scrolling")},800)}if(c.addEventListener("wheel",function(m){const grid=m.target&&m.target.closest&&m.target.closest(".agt-product-grid");if(grid){m.preventDefault();if(h()>0)y(c.scrollTop+m.deltaY);return}h()<=0||(m.preventDefault(),y(c.scrollTop+m.deltaY))},{passive:!1}),c.addEventListener("touchstart",function(m){if(!m.touches||!m.touches.length)return;const t=m.touches[0];S=t.clientY;p=c.scrollTop;c._agtPx=t.clientX;c._agtPy=t.clientY;c._agtGrid=m.target&&m.target.closest&&m.target.closest(".agt-product-grid");c._agtGLeft=c._agtGrid?c._agtGrid.scrollLeft:0;c._agtHoriz=null},{passive:!0}),c.addEventListener("touchmove",function(m){if(!m.touches||!m.touches.length)return;const t=m.touches[0];const grid=c._agtGrid;if(grid&&grid.scrollWidth>grid.clientWidth+2){const dx=(c._agtPx||0)-t.clientX;const dy=(c._agtPy||0)-t.clientY;if(c._agtHoriz==null&&(Math.abs(dx)>6||Math.abs(dy)>6))c._agtHoriz=Math.abs(dx)>Math.abs(dy);if(c._agtHoriz){m.preventDefault();grid.scrollLeft=c._agtGLeft+dx;return}}if(h()<=0)return;m.preventDefault();const H=S-t.clientY;y(p+H)},{passive:!1}),typeof ResizeObserver<"u"){const m=new ResizeObserver(function(){F()});m.observe(c),m.observe(a)}if(!c._agtProdDrag){c._agtProdDrag=1;c.addEventListener("pointerdown",function(m){const grid=m.target&&m.target.closest&&m.target.closest(".agt-product-grid");if(!grid||m.button!==0||m.pointerType==="mouse")return;let sx=m.clientX,sl=grid.scrollLeft,moved=0;grid.classList.add("is-dragging");function move(e){const dx=e.clientX-sx;if(Math.abs(dx)>3)moved=1;grid.scrollLeft=sl-dx;e.preventDefault()}function up(e){document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",up);grid.classList.remove("is-dragging");if(moved){e.preventDefault();e.stopPropagation();const block=function(ev){ev.preventDefault();ev.stopPropagation();grid.removeEventListener("click",block,true)};grid.addEventListener("click",block,true)}}document.addEventListener("pointermove",move,{passive:!1});document.addEventListener("pointerup",up)})};e.addEventListener("mousedown",function(m){m.preventDefault(),s=!0,e.classList.add("is-dragging"),d=m.clientY,g=c.scrollTop,a.classList.add("is-scrolling");function H(V){if(!s)return;const at=c.clientHeight,ht=c.scrollHeight,rt=Math.max(0,ht-at),it=n.clientHeight||at,mt=e.offsetHeight||28,kn=Math.max(1,it-mt),Sn=V.clientY-d;y(g+Sn/kn*rt)}function I(){s=!1,e.classList.remove("is-dragging"),document.removeEventListener("mousemove",H),document.removeEventListener("mouseup",I),M()}document.addEventListener("mousemove",H),document.addEventListener("mouseup",I)}),n.addEventListener("mousedown",function(m){if(m.target===e)return;const H=n.getBoundingClientRect(),I=c.clientHeight,V=c.scrollHeight,at=Math.max(0,V-I),ht=n.clientHeight||I,rt=e.offsetHeight||28,it=Math.max(1,ht-rt),mt=m.clientY-H.top-rt/2;y(Math.max(0,Math.min(it,mt))/it*at)}),F()}const ln=15*60*1e3;function cn(n){const e=n instanceof Date?n:new Date(n);if(Number.isNaN(e.getTime()))return"";const a=e.toLocaleTimeString(void 0,{hour:"numeric",minute:"2-digit"});return e.toDateString()===new Date().toDateString()?a:e.toLocaleDateString(void 0,{month:"short",day:"numeric"})+" · "+a}function It(n){if(!c)return;const e=n instanceof Date?n:new Date(n);if(Number.isNaN(e.getTime()))return;if(!j||j.toDateString()!==e.toDateString()||e.getTime()-j.getTime()>ln){const r=document.createElement("div");r.className="agt-date-sep",r.textContent=cn(e),c.appendChild(r)}j=e}function ynAttachHtml(n){const e=n||[];if(!e.length)return"";return'<div class="agt-attach-list">'+e.map(function(a){const r=a.url||"",s=o(a.filename||"file");return a.kind==="image"||String(a.mimeType||"").indexOf("image/")===0?'<a href="'+o(r)+'" target="_blank" rel="noopener"><img class="agt-attach-img" src="'+o(r)+'" alt="'+s+'"></a>':'<a class="agt-attach-file" href="'+o(r)+'" target="_blank" rel="noopener" download><span>'+s+"</span></a>"}).join("")+"</div>"}function Et(n,e){It(new Date);const a=document.createElement("div");a.className="agt-msg-row customer";const r=String(n||"").trim(),s=ynAttachHtml(e);a.innerHTML='<div class="agt-bubble">'+(r?o(r):"")+(r&&s?"\n":"")+s+"</div>",(!r&&!s)||(c.appendChild(a),D(),R())}function Tt(n){const e=document.createElement("div");e.className="agt-system-event",e.textContent=n,c.appendChild(e),D(),R()}function W(){c&&c.querySelectorAll(".agt-connecting").forEach(function(n){n.remove()})}function dt(n,e){W();const a=document.createElement("div");a.className="agt-connecting";const r=String(n||"Connecting you with a human agent.");const q=(e&&e.queueLabel)||"";const parts=r.split(/\n/);const title=parts[0]||r;const queue=q||parts.slice(1).join(" ").trim();a.innerHTML='<span class="agt-status-ring" aria-hidden="true"></span><span class="agt-connecting-copy"><span class="agt-connecting-title">'+o(title)+"</span>"+(queue?'<span class="agt-connecting-queue">'+o(queue)+"</span>":"")+"</span>",c.appendChild(a),D(),R()}function dn(n,e){if(e){W();return}!n||!n.display||((n.display.removeStatusComponent||n.display.showSpinner===!1)&&(n.status==="cancelled_by_customer"||n.status==="unavailable"||n.status==="outside_business_hours"||n.status==="offered"||n.status==="not_requested")&&W(),n.display.showSpinner&&dt((n.display&&n.display.title)||"Connecting you with a human agent.",{queueLabel:(n.display&&n.display.queueLabel)||n.queueLabel||"",title:n.display&&n.display.title}))}function gn(n,e){if(e==null||e==="")return"";const a=Number(e),r=n||"";if(!Number.isFinite(a))return(r?r+" ":"")+String(e);const s=a.toLocaleString(void 0,{minimumFractionDigits:Number.isInteger(a)?0:2,maximumFractionDigits:2});return(r?r+" ":"$")+s}function pn(n){const e=String(n||"").toLowerCase();return/deliver|complete/.test(e)?3:/ship|transit/.test(e)?2:/pack|process|ready|partial/.test(e)?1:/fulfill/.test(e)&&!/unfulfill/.test(e)?3:0}function Mt(n,e){const a=n==="refunded"?"Marked refunded by store":n==="cancelled"?"Order cancelled":"Order update",r=n==="refunded"?"The store marked this order as refunded. That does not by itself confirm when funds will appear in your account.":n==="cancelled"?"This order is cancelled and will not ship.":e;return'<div class="agt-order-outcome agt-order-outcome-'+o(n)+'"><div class="agt-order-outcome-title">'+o(a)+'</div><div class="agt-order-outcome-detail">'+o(r)+"</div></div>"}function un(n){return'<div class="agt-order-stepper">'+["Placed","Packed","Shipped","Delivered"].map(function(a,r){return'<div class="agt-order-step '+(r<n?"done":r===n?"active":"")+'"><span class="agt-order-step-dot"></span><span class="agt-order-step-label">'+a+"</span></div>"}).join("")+"</div>"}function fn(n){var H;const e=n.fulfillmentStatus||"",a=n.financialStatus||"",r=String(a).toLowerCase(),s=String(e).toLowerCase(),d=/refund/.test(r),g=/cancel|void/.test(r)||s==="cancelled",p=String(a||e||"Update").replace(/_/g," "),h=n.totalDisplay||gn(n.currency,n.totalPrice!=null?n.totalPrice:n.total),y=(n.lineItems||[]).slice(0,4).map(function(I){return'<div class="agt-order-item">'+o(I.title)+" × "+(I.quantity||1)+"</div>"}).join("");let M="";d?M=Mt("refunded"):g?M=Mt("cancelled"):M=un(pn(e||a));const m=!d&&!g&&((H=n.tracking)!=null&&H.url)?'<a class="agt-order-track-btn" href="'+o(n.tracking.url)+'" target="_blank" rel="noopener">Track shipment</a>':"";return'<div class="agt-order-card"><div class="agt-order-top"><div><div class="agt-order-id">'+o(n.orderNumber?"Order "+n.orderNumber:"Order update")+"</div>"+(h?'<div class="agt-order-total">'+o(h)+"</div>":"")+'</div><span class="agt-order-badge'+(d?" is-refunded":g?" is-cancelled":"")+'">'+o(p)+"</span></div>"+M+(y?'<div class="agt-order-items">'+y+"</div>":"")+m+"</div>"}function hn(n){if(!n||!n.fields||!n.fields.length)return"";const e=Array.isArray(n.summaryLines)&&n.summaryLines.length?'<div class="agt-form-summary">'+n.summaryLines.map(function(d){return'<div class="agt-form-summary-line">'+o(d)+"</div>"}).join("")+"</div>":"",a=n.fields.map(function(d){if(d.type==="hidden")return'<input type="hidden" class="agt-form-input" name="'+o(d.name)+'" value="'+o(d.value||"")+'" />';const g=d.type||"text",S=d.required?" required":"",p=d.placeholder?' placeholder="'+o(d.placeholder)+'"':"",h=d.autocomplete?' autocomplete="'+o(d.autocomplete)+'"':"",y=d.inputMode?' inputmode="'+o(d.inputMode)+'"':"";return'<label class="agt-form-field"><span class="agt-form-label">'+o(d.label||d.name)+(d.required?"":" <em>(optional)</em>")+'</span><input class="agt-form-input" type="'+o(g)+'" name="'+o(d.name)+'"'+p+h+y+S+" /></label>"}).join(""),r=n.title?'<div class="agt-form-title">'+o(n.title)+"</div>":"",s=(n._actionId?' data-action-id="'+o(n._actionId)+'"':"")+(n._confirmationToken?' data-confirm-token="'+o(n._confirmationToken)+'"':"");return'<form class="agt-input-form" data-form-id="'+o(n.formId||"form")+'"'+s+" novalidate>"+r+e+a+'<button type="submit" class="agt-form-submit">'+o(n.submitLabel||"Submit")+"</button></form>"}function mn(n,e,a){if(n==="action_confirm"||a&&a.getAttribute("data-action-id")){const r=a&&a.getAttribute("data-action-id")||e.actionId,s=a&&a.getAttribute("data-confirm-token")||e.confirmationToken;if(/^\s*yes\s*$/i.test(e.confirmPayload||"")||e.confirmPayload)return`Yes, create the return
actionId:`+r+`
confirmationToken:`+s}if(n==="return_reason")return e.returnReason?"returnReason: "+e.returnReason:"";if(n==="refund_method")return"refundMethod:"+(e.refundMethod||"");if(n==="select_return_item")return e.selectedLineItemId||"";if(n==="contact_request"){const r=[];return e.email&&r.push(e.email),e.phone&&r.push(e.phone),r.join(", ")||"contact request"}if(n==="order_lookup"){const r=[];return e.orderNumber&&r.push("Order #"+String(e.orderNumber).replace(/^#/,"").trim()),e.email&&r.push(String(e.email).trim()),r.join(", ")}if(n==="shipping_address"){const r=["New shipping address:"];return e.name&&r.push("Name: "+e.name),e.address1&&r.push("Address: "+e.address1),e.address2&&r.push("Address 2: "+e.address2),e.city&&r.push("City: "+e.city),e.province&&r.push("State: "+e.province),e.zip&&r.push("ZIP: "+e.zip),e.country&&r.push("Country: "+e.country),e.phone&&r.push("Phone: "+e.phone),r.join(`
`)}return Object.keys(e).filter(function(r){return e[r]}).map(function(r){return r+": "+e[r]}).join(`
`)}function Nt(n){n&&(n.classList.add("is-submitted"),n.querySelectorAll("input, button").forEach(function(e){e.disabled=!0}))}function ynMoney(n,e){const a=Number(n);if(!Number.isFinite(a))return String(n||"");const r=a.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});return(e||"$")+r}function ynBindProductRails(root) {
  const scope = root || document;
  scope.querySelectorAll(".agt-product-rail").forEach(function (rail) {
    if (rail.dataset.bound === "1") return;
    rail.dataset.bound = "1";
    const grid = rail.querySelector(".agt-product-grid");
    const prev = rail.querySelector(".agt-product-nav-prev");
    const next = rail.querySelector(".agt-product-nav-next");
    if (!grid) return;
    function syncNav() {
      const max = grid.scrollWidth - grid.clientWidth - 4;
      if (prev) prev.disabled = grid.scrollLeft <= 4;
      if (next) next.disabled = grid.scrollLeft >= max;
    }
    function scrollByDir(dir) {
      const step = Math.max(160, Math.floor(grid.clientWidth * 0.85));
      grid.scrollBy({ left: dir * step, behavior: "smooth" });
    }
    prev &&
      prev.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        scrollByDir(-1);
      });
    next &&
      next.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        scrollByDir(1);
      });
    grid.addEventListener("scroll", syncNav, { passive: true });
    // Mouse: arrows only. Touch/pen: allow drag-scroll.
    let drag = false,
      startX = 0,
      startLeft = 0;
    grid.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      if (e.button && e.button !== 0) return;
      drag = true;
      startX = e.clientX;
      startLeft = grid.scrollLeft;
      grid.classList.add("is-dragging");
      try {
        grid.setPointerCapture(e.pointerId);
      } catch (_) {}
    });
    grid.addEventListener("pointermove", function (e) {
      if (!drag) return;
      grid.scrollLeft = startLeft - (e.clientX - startX);
    });
    function endDrag(e) {
      if (!drag) return;
      drag = false;
      grid.classList.remove("is-dragging");
      try {
        grid.releasePointerCapture(e.pointerId);
      } catch (_) {}
      syncNav();
    }
    grid.addEventListener("pointerup", endDrag);
    grid.addEventListener("pointercancel", endDrag);
    // Block mouse-wheel / trackpad scrolling the rail (arrows only; touch swipe still works)
    grid.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
      },
      { passive: false },
    );
    syncNav();
  });
}
function bn(n) {
  const list = (n || []).slice(0, 8);
  const cards = list
    .map(function (e) {
      const img = e.imageUrl
        ? '<img src="' +
          o(e.imageUrl) +
          '" alt="' +
          o(e.title) +
          '" draggable="false">'
        : '<div style="aspect-ratio:1/1;background:#f3f4f6;"></div>';
      const price =
        e.price != null ? ynMoney(e.price, e.currency || "$") : "";
      const href = e.url ? o(e.url) : "";
      const viewMore = href
        ? '<a class="agt-product-view" href="' +
          href +
          '" target="_blank" rel="noopener">Buy It Now</a>'
        : '<span class="agt-product-view is-disabled">Buy It Now</span>';
      return (
        '<div class="agt-product-card"><div class="agt-product-media">' +
        img +
        '</div><div class="agt-product-body">' +
        '<div class="agt-product-title">' +
        o(e.title) +
        "</div>" +
        '<div class="agt-product-row"><div class="agt-product-price">' +
        o(price) +
        "</div></div>" +
        viewMore +
        "</div></div>"
      );
    })
    .join("");
  const prevSvg =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const nextSvg =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const nav =
    list.length > 2
      ? '<button type="button" class="agt-product-nav agt-product-nav-prev" aria-label="Previous products">' +
        prevSvg +
        '</button><button type="button" class="agt-product-nav agt-product-nav-next" aria-label="Next products">' +
        nextSvg +
        "</button>"
      : "";
  return (
    '<div class="agt-product-rail">' +
    nav +
    '<div class="agt-product-grid">' +
    cards +
    "</div></div>"
  );
}
function xn(){const n=(i==null?void 0:i.faviconUrl)||(i==null?void 0:i.logoUrl)||"",e=(i==null?void 0:i.agentName)||"Assistant";return n?'<div class="agt-agent-av"><img src="'+o(n)+'" alt=""></div>':'<div class="agt-agent-av agt-agent-av-fallback">'+o(String(e).charAt(0).toUpperCase()||"A")+"</div>"}function tt(n,e,a){return'<div class="agt-agent-row">'+xn()+'<div class="agt-agent-col"><div class="agt-msg-meta"><span class="agt-msg-name">'+o(n)+"</span></div>"+(e||"")+(a||"")+"</div></div>"}function gt(n){var d,g,S,p;if(lt(n))return;ct(),$(!1);const e=n.sentAt?new Date(n.sentAt):new Date;if(It(e),n.contentType==="system_event"){if(((d=n.payload)==null?void 0:d.type)==="handoff_connecting"){dt(n.body||"Connecting with an agent…");return}if(((d=n.payload)==null?void 0:d.type)==="handoff_requested"){W();Tt(n.body||"Update");return}((g=n.payload)==null?void 0:g.type)==="agent_joined"&&(W(),typeof window.ynSetAttach==="function"&&window.ynSetAttach(!0)),Tt(n.body||"Update");return}const a=document.createElement("div");a.className="agt-msg-row agent";const r=n.senderName||(i==null?void 0:i.agentName)||"Assistant",ynAtt=typeof ynAttachHtml==="function"?ynAttachHtml(n.attachments||((n.payload||{}).attachments)||[]):"",s=(n.body||ynAtt)?'<div class="agt-bubble">'+(n.body?xt(n.body):"")+(n.body&&ynAtt?"\n":"")+ynAtt+"</div>":"";if(n.contentType==="order_card"&&n.payload?a.innerHTML=tt(r,s,fn(n.payload)):n.contentType==="product_cards"&&((S=n.payload)!=null&&S.products)?a.innerHTML=tt(r,s,bn(n.payload.products)):n.contentType==="input_form"&&((p=n.payload)!=null&&p.fields)?a.innerHTML=tt(r,s,hn(n.payload)):n.contentType==="choices"||n.contentType==="rating"?a.innerHTML=tt(r,n.contentType==="rating"?"":(n.body?'<div class="agt-bubble">'+xt(n.body)+"</div>":"")):a.innerHTML=tt(r,s||'<div class="agt-bubble">'+xt(n.body||"")+"</div>"),c.appendChild(a),n.role==="bot"){if(n.contentType==="rating"||(n.payload&&n.payload.rating)||n.rating){const rp=(n.payload&&n.payload.rating)||n.rating||{};const opts=rp.options||[];const label=rp.prompt||n.body||"How was this chat?";const box=document.createElement("div");box.className="agt-rating";box.innerHTML='<div class="agt-rating-label">'+o(label)+'</div><div class="agt-rating-emojis">'+opts.map(function(op){const id=op.id||("rate_"+(op.score||""));const face=op.emoji||"";const cap=op.label||"";const msg="Rating: "+(op.score||"");return '<button type="button" class="agt-rating-emoji" data-choice-id="'+o(String(id))+'" data-msg="'+o(msg)+'"><span class="agt-rating-face">'+face+'</span><span class="agt-rating-caption">'+o(cap)+"</span></button>"}).join("")+"</div>";c.appendChild(box);D();R()}else{const ch=((n.payload||{}).choices)||n.choices;if(ch&&ch.length)Lt(ch.map(function(y){return typeof y==="string"?y:{label:y.label||y.message||y.value||"",message:y.message||y.value||y.label||"",id:y.id}}));else if(n.contentType==="text"&&n.body&&T){const h=nn(n.body);h.length?Lt(h):c.querySelectorAll(".agt-choice-stack").forEach(function(y){y.remove()})}}}else if(!n.body&&n.contentType!=="text"){/* skip */}D(),R()}function pt(n){if(n){if(n.role==="customer"){lt(n);return}gt(n)}}function ut(){A&&(A.textContent="",A.classList.add("gone"))}function ft(n){A&&(A.textContent=n||"Something went wrong. Please try again.",A.classList.remove("gone"))}function nt(){var n,e,a;(n=document.getElementById("agt-home"))==null||n.classList.add("gone"),(e=document.getElementById("agt-chat"))==null||e.classList.add("gone"),_==null||_.classList.remove("gone"),ut(),z==null||z.classList.remove("active"),N==null||N.classList.add("active"),(a=document.getElementById("agt-chat-header"))==null||a.style.setProperty("display","flex")}function et(){var n,e,a;_==null||_.classList.add("gone"),(n=document.getElementById("agt-home"))==null||n.classList.add("gone"),(e=document.getElementById("agt-chat"))==null||e.classList.remove("gone"),(a=document.getElementById("agt-chat-header"))==null||a.style.setProperty("display","flex"),N==null||N.classList.add("active"),z==null||z.classList.remove("active"),T?Q(!0):U&&U.classList.add("gone")}async function Ht(n){var e;q.disabled=!0,ut();try{const a=await Z("/session/start","POST",{email:n,pageUrl:window.location.href,origin:window.location.origin,userAgent:navigator.userAgent});b=a.sessionToken,x=n,L=!0,T=!1,O.clear(),G(),(a.messages||[]).forEach(function(s){pt(s)});const r=((e=(a.messages||[]).find(function(s){return s.role==="bot"&&s.body}))==null?void 0:e.body)||"New conversation";wt({sessionToken:b,email:n,preview:String(r).slice(0,80),agentName:i==null?void 0:i.agentName,updatedAt:new Date().toISOString()}),zt(),et(),en()}catch(a){ft(a.message||"Could not start chat")}finally{q.disabled=!1}}async function vn(n,e){var a,r;if(n)try{const s=await Z("/session/"+encodeURIComponent(n));b=n,x=e||((a=s==null?void 0:s.session)==null?void 0:a.visitorEmail)||x,L=!0,T=!0,O.clear(),G(),(((r=s.session)==null?void 0:r.messages)||[]).forEach(function(d){d.role==="customer"?(Et(d.body||""),lt(d)):pt(d)}),zt(),Q(!0),et()}catch(s){nt(),ft(s.message||"Could not open that chat")}}function yn(){if(w){try{w.close()}catch{}w=null}b=null,T=!1,O.clear(),G(),f&&(f.value="",P&&(P.disabled=!0)),typeof window.ynSetAttach==="function"&&window.ynSetAttach(!1),U&&U.classList.add("gone"),L&&x?Ht(x):nt()}async function K(n,choiceId){const e=String(n||"").trim();const ynPend=(window.ynPendingFiles||[]).slice();if(!(e||ynPend.length||choiceId)||!b)return;{Q(!0),document.querySelectorAll(".agt-choice-stack").forEach(function(a){a.remove()}),document.querySelectorAll(".agt-input-form:not(.is-submitted)").forEach(function(a){Nt(a)}),/keep helping|don'?t connect|continue with (the )?ai|no[,.]?\s+(please\s+)?keep/i.test(e)&&W(),typeof window.ynClearPending==="function"&&window.ynClearPending();f.value="",P.disabled=!0,X(),At(ynHint(e),e),$(!0);try{let ynUploaded=[];if(ynPend.length){ynUploaded=await window.ynUploadFiles(ynPend);if(!ynUploaded.length&&!e){$(!1),ct(),P.disabled=!1;return}}Et(e,ynUploaded);const a=await Z("/session/message","POST",{sessionToken:b,message:e,attachments:ynUploaded,choiceId:choiceId||undefined});a&&(a.widgetBuild||a.orchestratorBuild)&&console.info("[Agentra builds]",{widgetBuild:a.widgetBuild||"2026-07-16-01",orchestratorBuild:a.orchestratorBuild,turnDebug:a.turnDebug||null}),$(!1),ct(),dn(a.handoffState,a.clearConnecting),(a.handoffState&&(a.handoffState.status==="agent_joined"||a.allowAttachments)&&typeof window.ynSetAttach==="function"&&window.ynSetAttach(!0)),(a.messages||[]).forEach(function(r){gt(r)}),wt({sessionToken:b,email:x,preview:e.slice(0,80),agentName:i==null?void 0:i.agentName,updatedAt:new Date().toISOString()}),a.handoff&&a.handoffState&&a.handoffState.display&&a.handoffState.display.showSpinner&&((a.messages||[]).some(function(r){var s;return((s=r.payload)==null?void 0:s.type)==="handoff_requested"})||dt("Connecting with an agent…"))}catch(a){$(!1),ct(),gt({role:"bot",body:a.message||"Something went wrong. Please try again.",senderName:i==null?void 0:i.agentName})}finally{P.disabled=!f.value.trim()}}}function _t(n){if(v&&(n?v.dataset.initialMsg=n:delete v.dataset.initialMsg),!L){nt();return}et(),n&&K(n)}function wn(){var g,S;const n=document.getElementById("agt-launcher"),e=document.getElementById("agt-panel"),a=document.getElementById("agt-close-btn"),r=document.getElementById("agt-back-btn");c=document.getElementById("agt-messages"),f=document.getElementById("agt-input"),P=document.getElementById("agt-send-btn"),C=document.getElementById("agt-typing"),k=document.getElementById("agt-process-steps"),Y=document.getElementById("agt-badge"),z=document.getElementById("tab-home"),N=document.getElementById("tab-chat"),_=document.getElementById("agt-email-gate"),v=document.getElementById("agt-email-input"),q=document.getElementById("agt-email-btn"),A=document.getElementById("agt-email-error"),U=document.getElementById("agt-input-bar"),sn();function s(){t=!0,e.classList.add("open"),n.classList.add("open"),Y==null||Y.classList.remove("show"),J()}function d(){t=!1,e.classList.remove("open"),n.classList.remove("open")}n==null||n.addEventListener("click",function(){return t?d():s()}),a==null||a.addEventListener("click",d),z==null||z.addEventListener("click",function(){var p,h,y;z.classList.add("active"),N.classList.remove("active"),(p=document.getElementById("agt-home"))==null||p.classList.remove("gone"),(h=document.getElementById("agt-chat"))==null||h.classList.add("gone"),_==null||_.classList.add("gone"),(y=document.getElementById("agt-chat-header"))==null||y.style.setProperty("display","none"),v&&delete v.dataset.initialMsg,J()}),N==null||N.addEventListener("click",function(){L?et():nt()}),r==null||r.addEventListener("click",function(){z==null||z.click()}),(g=document.getElementById("agt-new-chat-btn"))==null||g.addEventListener("click",function(){yn()}),document.querySelectorAll(".agt-qr-item").forEach(function(p){p.addEventListener("click",function(){_t(p.getAttribute("data-msg"))})}),c==null||c.addEventListener("click",function(p){const rateBtn=p.target&&p.target.closest?p.target.closest(".agt-rating-emoji"):null;if(rateBtn){const rid=rateBtn.getAttribute("data-choice-id");const msg=rateBtn.getAttribute("data-msg")||"";const wrap=rateBtn.closest(".agt-rating");if(wrap&&wrap.getAttribute("data-rated")==="1")return;wrap&&wrap.setAttribute("data-rated","1");wrap&&wrap.querySelectorAll(".agt-rating-emoji").forEach(function(b){b.classList.toggle("is-selected",b===rateBtn);b.disabled=!0});K(msg,rid||undefined);return}const h=p.target&&p.target.closest?p.target.closest(".agt-choice-btn"):null;if(!h)return;if(h.getAttribute("data-action")==="ask-anything"){Q(!0);return}const y=h.getAttribute("data-msg");const cid=h.getAttribute("data-choice-id");y&&K(y,cid||undefined)}),c==null||c.addEventListener("submit",function(p){const h=p.target&&p.target.closest?p.target.closest(".agt-input-form"):null;if(!h||h.classList.contains("is-submitted"))return;p.preventDefault();const y=h.getAttribute("data-form-id")||"form",M={};let m=!0;if(h.querySelectorAll(".agt-form-input").forEach(function(I){const V=String(I.value||"").trim();I.required&&!V?(m=!1,I.classList.add("is-invalid")):(I.classList.remove("is-invalid"),V&&(M[I.name]=V))}),!m)return;if(M.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(M.email)){const I=h.querySelector('[name="email"]');I&&I.classList.add("is-invalid");return}const H=mn(y,M,h);H&&(Nt(h),K(H))}),(S=document.getElementById("agt-send-msg-card"))==null||S.addEventListener("click",function(){_t()}),v==null||v.addEventListener("input",ut),q==null||q.addEventListener("click",function(){var y,M;const p=(y=v==null?void 0:v.value)==null?void 0:y.trim();if(!p||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)){ft("Enter a valid email address to continue."),v==null||v.focus();return}const h=(M=v==null?void 0:v.dataset)==null?void 0:M.initialMsg;v&&delete v.dataset.initialMsg,Ht(p).then(function(){h&&K(h)})}),window.ynPendingFiles=[];window.ynAgentJoined=!1;window.ynSetAttach=function(n){window.ynAgentJoined=!!n;const e=document.getElementById("agt-attach-btn");e&&(n?e.classList.remove("gone"):e.classList.add("gone"));!n&&window.ynClearPending&&window.ynClearPending()};window.ynClearPending=function(){window.ynPendingFiles=[];const e=document.getElementById("agt-attach-preview");e&&(e.innerHTML="",e.classList.add("gone"));P&&(P.disabled=!((f&&f.value.trim())||window.ynPendingFiles.length))};window.ynRenderPending=function(){const e=document.getElementById("agt-attach-preview");if(!e)return;const a=window.ynPendingFiles||[];if(!a.length){e.classList.add("gone");return}e.classList.remove("gone");e.innerHTML=a.map(function(r,s){return'<span class="agt-attach-chip">'+o(r.name||"file")+' <button type="button" data-i="'+s+'" aria-label="Remove">&times;</button></span>'}).join("");e.querySelectorAll("button[data-i]").forEach(function(r){r.addEventListener("click",function(){const s=Number(r.getAttribute("data-i"));window.ynPendingFiles.splice(s,1);window.ynRenderPending();P&&(P.disabled=!((f&&f.value.trim())||window.ynPendingFiles.length))})})};window.ynUploadFiles=async function(n){if(!n||!n.length)return[];const e=new FormData;n.forEach(function(a){e.append("files",a)});try{const a=await fetch(B+"/session/upload",{method:"POST",headers:{"x-widget-key":u},body:e});const r=await a.json();if(!r.success)throw new Error(r.message||"Upload failed");return(r.data&&r.data.attachments)||[]}catch(a){console.error(a);alert((a&&a.message)||"Could not upload file");return[]}};f==null||f.addEventListener("input",function(){P.disabled=!((f.value.trim())||window.ynPendingFiles.length),X()}),f==null||f.addEventListener("focus",function(){X()}),P==null||P.addEventListener("click",function(){K(f.value)}),f==null||f.addEventListener("keydown",function(p){p.key==="Enter"&&!p.shiftKey&&(p.preventDefault(),K(f.value))});(function(){const e=document.getElementById("agt-attach-btn"),a=document.getElementById("agt-attach-input");e&&a&&(e.addEventListener("click",function(){a.click()}),a.addEventListener("change",function(){const r=Array.from(a.files||[]);a.value="";if(!r.length)return;const s=(window.ynPendingFiles||[]).concat(r).slice(0,3);window.ynPendingFiles=s;window.ynRenderPending();P&&(P.disabled=!((f&&f.value.trim())||s.length))}))})(),J()}function Bt(n){if(i=n,!(i!=null&&i.enabled))return;const e="agentra-widget-root";let a=document.getElementById(e);a||(a=document.createElement("div"),a.id=e,document.body.appendChild(a));const r=i.widgetColor||"#2563eb",s=String(i.fontFamily||"Plus Jakarta Sans").replace(/['"]/g,"").split(",")[0].trim()||"Plus Jakarta Sans",d="'"+s+"', system-ui, -apple-system, sans-serif";Ct(s),on();const g=document.querySelector("style["+E+"]");g&&g.remove();const S=document.createElement("style");S.setAttribute(E,"1"),S.textContent=Jt(r,d,e,{backgroundColor:i.backgroundColor||"#ffffff"}),document.head.appendChild(S),a.innerHTML=$t(i),wn(),i.position==="bottom-left"&&(a.style.setProperty("--launcher-left",i.launcherOffsetX+"px"),a.style.setProperty("--launcher-right","auto"))}async function jt(){if(!u){console.warn("[Agentra] widgetKey missing in AgentraConfig");return}try{const n=await Z("/config?widgetKey="+encodeURIComponent(u));if(!n.enabled)return;Bt(n),setInterval(async function(){try{const e=await Z("/config?widgetKey="+encodeURIComponent(u));e.widgetColor&&e.widgetColor!==(i==null?void 0:i.widgetColor)&&Bt(e)}catch{}},3e4)}catch(n){console.error("[Agentra widget]",n.message)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",jt):jt()})()})();
