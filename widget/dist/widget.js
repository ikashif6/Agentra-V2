(function(){"use strict";const Q='<svg width="22" height="22" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M3 3H27V10.5H33V33.927L25.1459 30H9V23.427L3 26.427V3ZM9 20.073V10.5H24V6H6V21.573L9 20.073ZM12 13.5V27H25.8541L30 29.073V13.5H12Z" fill="white"/></svg>',X='<svg width="18" height="18" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.5 1.5L1.50135 21.4987M21.4987 21.5L1.5 1.50142" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',O='<svg width="7" height="10" viewBox="-1 0 9 10" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible"><path d="M6.68552 4.35872L1.43528 0.191346C1.2568 0.0507239 1.02709 -0.0167999 0.796448 0.00356129C0.565808 0.0239225 0.353038 0.130509 0.20473 0.299981C0.0564228 0.469452 -0.0153345 0.687996 0.00517204 0.907755C0.0256786 1.12751 0.136778 1.33058 0.31414 1.47248L4.7577 4.99931L0.31414 8.52614C0.136094 8.66784 0.0243811 8.87107 0.00354121 9.09117C-0.0172987 9.31128 0.054439 9.53026 0.202996 9.70002C0.351552 9.86977 0.564778 9.97642 0.795834 9.99654C1.02689 10.0167 1.25688 9.94858 1.43528 9.80729L6.68552 5.63985C6.78397 5.56151 6.86316 5.46354 6.9175 5.35285C6.97184 5.24217 7 5.12147 7 4.99928C7 4.87709 6.97184 4.7564 6.9175 4.64571C6.86316 4.53503 6.78397 4.43706 6.68552 4.35872Z" fill="currentColor"/></svg>',tt='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.5 2.33497L3 7.50997C2.375 7.94697 2 8.62597 2 9.34997V19.7C2 20.965 3.125 22 4.5 22H19.5C20.875 22 22 20.965 22 19.7V9.34997C22 8.62597 21.625 7.94697 21 7.50997L13.5 2.33497C13.0565 2.03704 12.5343 1.87793 12 1.87793C11.4657 1.87793 10.9435 2.03704 10.5 2.33497ZM7.316 14.366C7.23309 14.2895 7.1358 14.2303 7.02979 14.1918C6.92378 14.1534 6.81117 14.1364 6.69853 14.1418C6.58588 14.1473 6.47545 14.1751 6.37367 14.2237C6.27189 14.2723 6.1808 14.3406 6.10569 14.4248C6.03058 14.5089 5.97297 14.6071 5.9362 14.7137C5.89944 14.8204 5.88426 14.9332 5.89155 15.0458C5.89884 15.1583 5.92845 15.2683 5.97866 15.3693C6.02887 15.4703 6.09867 15.5602 6.184 15.634C7.78279 17.0653 9.85414 17.8552 12 17.852C14.1459 17.8552 16.2172 17.0653 17.816 15.634C17.9013 15.5602 17.9711 15.4703 18.0213 15.3693C18.0716 15.2683 18.1012 15.1583 18.1085 15.0458C18.1157 14.9332 18.1006 14.8204 18.0638 14.7137C18.027 14.6071 17.9694 14.5089 17.8943 14.4248C17.8192 14.3406 17.7281 14.2723 17.6263 14.2237C17.5245 14.1751 17.4141 14.1473 17.3015 14.1418C17.1888 14.1364 17.0762 14.1534 16.9702 14.1918C16.8642 14.2303 16.7669 14.2895 16.684 14.366C15.3967 15.5191 13.7283 16.1553 12 16.152C10.2 16.152 8.56 15.477 7.316 14.366Z" fill="currentColor"/></svg>',nt='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M19 2C19.7956 2 20.5587 2.31607 21.1213 2.87868C21.6839 3.44129 22 4.20435 22 5V20.806C22 22.141 20.387 22.811 19.441 21.868L15.56 18H5C4.20435 18 3.44129 17.6839 2.87868 17.1213C2.31607 16.5587 2 15.7956 2 15V5C2 4.20435 2.31607 3.44129 2.87868 2.87868C3.44129 2.31607 4.20435 2 5 2H19ZM17 7H7a.85.85 0 0 0 0 1.7H17A.85.85 0 0 0 17 7ZM12 11H7a.85.85 0 0 0 0 1.7H12A.85.85 0 0 0 12 11Z" fill="currentColor"/></svg>',et='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/></svg>',at='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',rt='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',ot='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',it=["Where is my order?","Return or refund policy","Talk to a human","Product recommendations"];function i(a){return String(a??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function q(a){return i(a).replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>")}function P(a){let s=String(a??"").trim();if(!s)return"";const C=s.split(`
`).map(function(y){return y.trim()});let b="",o=[],g=null,v=[];function u(){o.length&&(b+="<p>"+q(o.join(" "))+"</p>",o=[])}function t(){g&&v.length&&(b+="<"+g+">"+v.map(function(y){return"<li>"+q(y)+"</li>"}).join("")+"</"+g+">",g=null,v=[])}return C.forEach(function(y){if(!y){t(),u();return}const m=y.match(/^[-•*]\s+(.+)/),d=y.match(/^\d+[.)]\s+(.+)/);m?(u(),g!=="ul"&&(t(),g="ul"),v.push(m[1])):d?(u(),g!=="ol"&&(t(),g="ol"),v.push(d[1])):(t(),o.push(y))}),t(),u(),b||"<p>"+q(s)+"</p>"}function st(a){const s=a.replace("#",""),C=parseInt(s.slice(0,2),16),b=parseInt(s.slice(2,4),16),o=parseInt(s.slice(4,6),16);return"#"+[Math.max(0,C-18),Math.max(0,b-18),Math.max(0,o-18)].map(function(g){return g.toString(16).padStart(2,"0")}).join("")}function lt(a){const s=a.replace("#","");if(s.length!==6)return"0,34,83";const C=parseInt(s.slice(0,2),16),b=parseInt(s.slice(2,4),16),o=parseInt(s.slice(4,6),16);return C+","+b+","+o}function dt(a){return i(a==null||a===""?`Hi there 👋
How can we help?`:a).replace(/\n/g,"<br>")}function gt(a){const s=(Array.isArray(a.quickReplies)&&a.quickReplies.length?a.quickReplies:it).slice(0,4),C=a.faviconUrl?'<img src="'+i(a.faviconUrl)+'" alt="'+i(a.agentName)+'">':i(String(a.agentName||"S").charAt(0).toUpperCase()),b=typeof a.logoSizePx=="number"&&a.logoSizePx>=24&&a.logoSizePx<=64,o=Math.min(280,Math.max(24,Number(a.logoWidth)||0))||null,g=Math.min(120,Math.max(16,Number(a.logoHeight)||0))||null;let v="";o||g?v=' style="'+(o?"max-width:"+o+"px;":"")+(g?"max-height:"+g+"px;":b?"max-height:"+a.logoSizePx+"px;":"")+'width:auto;height:auto;"':b&&(v=' style="max-height:'+a.logoSizePx+'px;width:auto;height:auto;"');const u=v?"":" agt-hero-logo--"+(a.logoSize||"medium"),t=a.logoUrl?'<div class="agt-hero-logo'+u+'"><img src="'+i(a.logoUrl)+'" alt="'+i(a.storeName)+'"'+v+"></div>":"",y=a.logoUrl?"":'<div class="agt-hero-brand"><i class="fa-solid fa-building-columns"></i> '+i(a.storeName)+"</div>",m=Array.isArray(a.teamAgents)?a.teamAgents.slice(0,5):[],d=[{initials:"J",color:"#a78bfa"},{initials:"A",color:"#f97316"},{initials:"M",color:"#22c55e"}],M=(m.length?m:d).map(function(p,S){const f=p.color||d[S%d.length].color,I=p.avatarUrl?'<img src="'+i(p.avatarUrl)+'" alt="'+i(p.name||p.initials||"")+'">':i(p.initials||"?");return'<div class="agt-av" style="background:'+i(f)+'">'+I+"</div>"}).join(""),E='<span class="ico-chat">'+Q+"</span>",L=a.disclaimer||"",w=a.showBranding&&L?'<div class="agt-powered">'+i(L)+"</div>":"";return'<button id="agt-launcher" aria-label="Open chat">'+E+'<span class="ico-close">'+X+'</span><span class="agt-badge" id="agt-badge">1</span></button><div id="agt-panel" role="dialog" aria-label="Customer support chat"><div class="agt-chat-header" id="agt-chat-header" style="display:none;"><button class="agt-chat-header-back show" id="agt-back-btn" aria-label="Back">'+et+'</button><div class="agt-chat-header-av">'+C+'</div><div class="agt-chat-header-info"><div class="agt-chat-header-name">'+i(a.agentName)+'</div><div class="agt-chat-header-status"><span class="agt-status-pip"></span><span>Online · replies instantly</span></div></div><button class="agt-new-chat-btn" id="agt-new-chat-btn" aria-label="New chat" title="New chat">'+at+'</button><button class="agt-chat-header-close" id="agt-close-btn" aria-label="Close">'+rt+'</button></div><div class="agt-screen" id="agt-home"><div class="agt-home-scroll"><div class="agt-hero">'+t+y+"<h2>"+dt(a.welcomeTitle)+'</h2><div class="agt-hero-sub">'+i(a.welcomeSubtitle||"Ask about orders, products, returns & store support.")+'</div></div><div class="agt-home-body">'+(s.length?'<div class="agt-qr-card">'+s.map(function(p){return'<div class="agt-qr-item" data-msg="'+i(p)+'"><span class="agt-qr-label">'+i(p)+'</span><span class="agt-qr-chevron">'+O+"</span></div>"}).join("")+"</div>":"")+'<div class="agt-msg-card" id="agt-send-msg-card"><div class="agt-avatar-stack">'+M+'</div><div class="agt-msg-card-text"><div class="agt-msg-card-title">'+i(a.storeName)+'</div><div class="agt-msg-card-sub">Leave us a message</div></div><span class="agt-msg-card-arr">'+O+"</span></div>"+w+'</div></div><div class="agt-tabbar"><button class="agt-tab active" id="tab-home"><span class="agt-tab-ico">'+tt+'</span><span>Home</span></button><button class="agt-tab" id="tab-chat"><span class="agt-tab-ico">'+nt+'</span><span>Chat</span></button></div></div><div class="agt-screen gone" id="agt-email-gate"><div class="agt-email-gate"><h3 id="agt-email-title">'+i(a.emailGateTitle||"Start a conversation")+'</h3><p id="agt-email-sub">'+i(a.emailGateSubtitle||"Enter your email so we can help with your orders.")+'</p><input type="email" class="agt-email-input" id="agt-email-input" placeholder="you@example.com" autocomplete="email" /><button class="agt-email-btn" id="agt-email-btn" type="button">Continue to chat</button></div></div><div class="agt-screen gone" id="agt-chat"><div class="agt-messages" id="agt-messages"></div><div class="agt-process-steps" id="agt-process-steps"><div class="agt-process-step" data-step="1"><span class="agt-process-icon"></span><span class="agt-process-label">Understanding your question</span></div><div class="agt-process-step" data-step="2"><span class="agt-process-icon">✓</span><span class="agt-process-label">Searching knowledge base</span></div><div class="agt-process-step" data-step="3"><span class="agt-process-icon">✓</span><span class="agt-process-label">Checking store data</span></div><div class="agt-process-step" data-step="4"><span class="agt-process-icon">✓</span><span class="agt-process-label">Reviewing retrieved information</span></div><div class="agt-process-step" data-step="5"><span class="agt-process-icon agt-process-spinner"></span><span class="agt-process-label">Generating your answer</span></div></div><div class="agt-typing" id="agt-typing"><div class="agt-typing-av">'+C+'</div><div class="agt-typing-dots"><div class="agt-typing-dot"></div><div class="agt-typing-dot"></div><div class="agt-typing-dot"></div></div></div><div class="agt-input-bar"><div class="agt-input-wrap"><textarea class="agt-input" id="agt-input" rows="1" placeholder="Type your message..." aria-label="Message"></textarea><button class="agt-send-btn" id="agt-send-btn" disabled aria-label="Send">'+ot+"</button></div></div></div></div>"}function ct(a,s,C,b){const o=b&&b.backgroundColor||"#ffffff",g=st(a),v=lt(a),u="#"+C,t=u+" ",y=s.includes(",")?s:"'"+String(s).replace(/'/g,"")+"', system-ui, -apple-system, sans-serif";return t+"*, "+t+"*::before, "+t+`*::after { box-sizing: border-box; margin: 0; padding: 0; }

`+u+` {
  font-family: `+y+`;
  --brand:    `+a+`;
  --brand-dk: `+g+`;
  --ink:      #111214;
  --ink-2:    #1f2124;
  --white:    `+o+`;
  --gray-50:  #f7f8f9;
  --gray-100: #f0f2f4;
  --gray-200: #e4e7eb;
  --gray-300: #cbd0d8;
  --gray-400: #9aa1ac;
  --gray-500: #6b7280;
  --gray-700: #374151;
  --gray-900: #111827;
  --w: 370px;
  --h: 590px;
  --r: 20px;
  --shadow: none;
  --btn-shadow: none;
}

`+t+`#agt-launcher {
  position: fixed; bottom: 26px; right: 26px;
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
`+t+`#agt-launcher .ico-close { position: absolute; transition: opacity 0.2s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1); display:flex; align-items:center; justify-content:center; }
`+t+`#agt-launcher .ico-chat img,
`+t+`#agt-launcher .ico-close img { width: 22px; height: 22px; object-fit: contain; }
`+t+`#agt-launcher .ico-chat  { opacity: 1; transform: scale(1) rotate(0deg); }
`+t+`#agt-launcher .ico-close { opacity: 0; transform: scale(0.6) rotate(-45deg); }
`+t+`#agt-launcher.open .ico-chat  { opacity: 0; transform: scale(0.6) rotate(45deg); }
`+t+`#agt-launcher.open .ico-close { opacity: 1; transform: scale(1) rotate(0deg); }

`+t+`.agt-badge {
  position: absolute; top: -2px; right: -2px;
  width: 18px; height: 18px; border-radius: 50%;
  background: rgba(`+v+`, 0.35); border: 2px solid white;
  color: white; font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transform: scale(0);
  transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
}
`+t+`.agt-badge.show { opacity: 1; transform: scale(1); }

`+t+`#agt-panel {
  position: fixed; bottom: 96px; right: 26px;
  width: var(--w);
  height: auto;
  min-height: var(--h);
  background: var(--white);
  border-radius: var(--r);
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.06);
  overflow: hidden;
  display: flex; flex-direction: column;
  z-index: 9998;
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
`+t+`#agt-panel:has(#agt-home.gone) {
  height: var(--h);
  max-height: min(92dvh, 780px);
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
  min-width: 30px; height: 30px; padding: 0 8px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  color: var(--gray-400); font-size: 18px; font-weight: 300; line-height: 1;
  transition: background 0.14s; flex-shrink: 0;
}
`+t+`.agt-chat-header-close:hover { background: var(--gray-100); color: var(--gray-700); }
`+t+`.agt-new-chat-btn {
  background: none; border: none; cursor: pointer;
  min-width: 30px; height: 30px; padding: 0 8px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  color: var(--gray-400); font-size: 12px; font-weight: 500;
  transition: background 0.14s; flex-shrink: 0;
}
`+t+`.agt-new-chat-btn:hover { background: var(--gray-100); color: var(--brand); }

`+t+`.agt-screen { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
`+t+`.agt-screen.gone { display: none !important; }

`+t+`#agt-home {
  background: var(--gray-50);
  overflow: visible;
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  min-height: 0;
  height: auto;
}

`+t+`.agt-home-scroll {
  flex: 0 0 auto;
  overflow: visible;
  display: flex;
  flex-direction: column;
}
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
  font-family: `+s+`;
  font-size: 12px; font-weight: 700;
  color: rgba(255,255,255,0.6);
  letter-spacing: 0.1em; text-transform: uppercase;
  margin-bottom: 18px;
  display: flex; align-items: center; gap: 7px;
}
`+t+`.agt-hero-brand i { font-size: 11px; }
`+t+`.agt-hero h2 {
  font-family: `+s+`;
  font-size: 24px; font-weight: 800;
  color: white; line-height: 1.2;
  letter-spacing: -0.03em;
  margin: 18px 0 10px;
}
`+t+`.agt-hero-sub {
  font-family: `+s+`;
  font-size: 13.5px; color: rgba(255,255,255,0.72); margin: 0; font-weight: 400;
  line-height: 1.45; max-width: 92%;
}

`+t+`.agt-home-body {
  flex: 0 0 auto; overflow: visible;
  padding: 0 14px 24px;
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

`+t+`.agt-tabbar {
  display: flex;
  border-top: 1px solid var(--gray-200);
  background: var(--white);
  flex-shrink: 0;
  z-index: 3;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
`+t+`.agt-tab {
  flex: 1; padding: 12px 0 18px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  cursor: pointer; border: none;
  background: var(--white);
  color: var(--gray-400); transition: color 0.14s;
  font-family: `+s+`;
}
`+t+`.agt-tab .agt-tab-ico { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; }
`+t+`.agt-tab .agt-tab-ico svg { width: 20px; height: 20px; flex-shrink: 0; }
`+t+`.agt-tab:hover { color: var(--gray-700); }
`+t+`.agt-tab.active { color: var(--brand); font-weight: 600; }
`+t+`.agt-tab > span:last-of-type { font-size: 12px; font-weight: 600; letter-spacing: 0.01em; }

`+t+`.agt-powered {
  text-align: center; font-size: 11px;
  color: var(--gray-300); padding: 6px 0 4px;
  font-weight: 400;
}
`+t+`.agt-powered a { color: var(--gray-400); text-decoration: none; font-weight: 600; }

`+t+`#agt-chat { background: var(--white); }

`+t+`.agt-messages {
  flex: 1; overflow-y: auto;
  padding: 18px 15px 10px;
  display: flex; flex-direction: column; gap: 10px;
  scroll-behavior: smooth;
}
`+t+`.agt-messages::-webkit-scrollbar { width: 3px; }
`+t+`.agt-messages::-webkit-scrollbar-track { background: transparent; }
`+t+`.agt-messages::-webkit-scrollbar-thumb { background: var(--gray-200); border-radius: 4px; }

`+t+`.agt-process-steps {
  display: none;
  flex-direction: column;
  gap: 10px;
  padding: 14px 15px 16px;
  background: var(--gray-50);
  border-radius: 12px;
  margin: 0 15px 10px;
  border: 1px solid var(--gray-200);
}
`+t+`.agt-process-steps.visible { display: flex; }
`+t+`.agt-process-step {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: var(--gray-500);
}
`+t+`.agt-process-step.done .agt-process-label,
`+t+`.agt-process-step.active .agt-process-label { color: var(--gray-700); }
`+t+`.agt-process-step.done .agt-process-icon {
  width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  color: var(--brand); font-weight: 700; font-size: 12px;
}
`+t+`.agt-process-step.active .agt-process-icon.agt-process-spinner {
  width: 18px; height: 18px;
  border: 2px solid var(--gray-200);
  border-top-color: var(--brand);
  border-radius: 50%;
  animation: agt-spin 0.7s linear infinite;
}
@keyframes agt-spin { to { transform: rotate(360deg); } }

`+t+`.agt-process-icon { flex-shrink: 0; }
`+t+`.agt-process-step:not(.done):not(.active) .agt-process-icon { opacity: 0.3; }
`+t+`.agt-date-sep {
  text-align: center; font-size: 11.5px;
  color: var(--gray-400); margin: 8px 0 12px;
  font-weight: 500;
}

`+t+`.agt-msg-row {
  display: flex; flex-direction: column;
  margin-bottom: 2px;
  animation: msgIn 0.22s cubic-bezier(0.34,1.4,0.64,1) both;
}
@keyframes msgIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

`+t+`.agt-msg-row.customer { align-items: flex-end; }
`+t+`.agt-msg-row.agent    { align-items: flex-start; }

`+t+`.agt-msg-meta {
  font-size: 11px; font-weight: 500;
  color: var(--gray-400); margin-top: 6px; padding-left: 2px;
  letter-spacing: 0.01em;
}

`+t+`.agt-bubble {
  max-width: 80%; padding: 11px 15px;
  font-size: 13.5px; line-height: 1.58;
  border-radius: 16px; word-break: break-word;
  font-weight: 400;
}
`+t+`.agt-msg-row.customer .agt-bubble {
  background: var(--brand); color: white;
  border-bottom-right-radius: 4px; font-weight: 600;
}
`+t+`.agt-msg-row.agent .agt-bubble {
  background: var(--gray-100); color: var(--gray-700);
  border-bottom-left-radius: 4px;
  border: 1px solid var(--gray-200);
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

`+t+`.agt-agent-row { display: flex; align-items: flex-end; gap: 7px; }
`+t+`.agt-agent-av {
  width: 26px; height: 26px; border-radius: 50%;
  background: var(--ink); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 22px; color: white; font-size: 11px;
  overflow: hidden;
}
`+t+`.agt-agent-av img { width: 100%; height: 100%; object-fit: cover; }

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
  font-family: `+s+`;
  display: flex; align-items: center; justify-content: center;
  transition: border-color 0.14s, color 0.14s, background 0.14s;
  letter-spacing: -0.01em;
}
`+t+`.agt-action-btn:hover {
  border-color: var(--brand);
  color: var(--brand);
  background: rgba(`+v+`, 0.08);
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
  box-shadow: 0 1px 4px rgba(`+v+`, 0.12);
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

`+t+`.agt-email-gate { padding: 28px 22px; display:flex; flex-direction:column; gap:14px; }
`+t+`.agt-email-gate h3 { font-size:18px; font-weight:700; color:var(--ink); }
`+t+`.agt-email-gate p { font-size:13px; color:var(--gray-500); line-height:1.45; }
`+t+`.agt-email-input { width:100%; border:1.5px solid var(--gray-200); border-radius:12px; padding:12px 14px; font-size:14px; font-family:inherit; }
`+t+`.agt-email-btn { width:100%; border:none; border-radius:12px; padding:12px 14px; background:var(--brand); color:#fff; font-weight:700; font-size:14px; cursor:pointer; }
`+t+`.agt-email-btn:disabled { opacity:0.6; cursor:not-allowed; }
`+t+`.agt-product-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; max-width:92%; margin-left:33px; margin-top:8px; }
`+t+`.agt-product-card { border:1px solid var(--gray-200); border-radius:12px; overflow:hidden; background:#fff; text-decoration:none; color:inherit; }
`+t+`.agt-product-card img { width:100%; height:72px; object-fit:cover; background:var(--gray-100); display:block; }
`+t+`.agt-product-card .agt-product-body { padding:8px; }
`+t+`.agt-product-card .agt-product-title { font-size:11px; font-weight:600; line-height:1.3; color:var(--ink); }
`+t+`.agt-product-card .agt-product-price { font-size:11px; color:var(--brand); font-weight:700; margin-top:4px; }
`+t+`.agt-system-event { text-align:center; font-size:11.5px; color:var(--gray-500); padding:6px 12px; background:var(--gray-50); border-radius:999px; align-self:center; }

`+t+`.agt-order-card {
  background: var(--white);
  border: 1.5px solid var(--gray-200);
  border-radius: 14px;
  padding: 14px 15px;
  max-width: 82%;
  margin-top: 8px; margin-left: 33px;
  animation: msgIn 0.26s ease both;
  animation-delay: 0.1s;
}
`+t+`.agt-order-num {
  font-size: 10.5px; font-weight: 700;
  color: var(--gray-400); text-transform: uppercase;
  letter-spacing: 0.06em; margin-bottom: 8px;
  display: flex; align-items: center; gap: 5px;
}
`+t+`.agt-order-num i { font-size: 11px; }
`+t+`.agt-order-status-row {
  display: flex; align-items: center; gap: 7px; margin-bottom: 13px;
}
`+t+`.agt-order-status-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #3b82f6;
}
`+t+`.agt-order-status-dot.delivered { background: #16a34a; }
`+t+`.agt-order-status-label {
  font-size: 15px; font-weight: 700; color: var(--ink);
  letter-spacing: -0.01em;
}
`+t+`.agt-order-track {
  display: flex; align-items: center; margin-bottom: 13px;
}
`+t+`.agt-track-step { display: flex; flex-direction: column; align-items: center; gap: 4px; }
`+t+`.agt-track-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--gray-200); position: relative; z-index: 1;
}
`+t+`.agt-track-dot.done { background: var(--brand); }
`+t+`.agt-track-dot.current {
  background: var(--brand);
  outline: 3px solid var(--gray-200); outline-offset: 1.5px;
}
`+t+`.agt-track-label {
  font-size: 8.5px; font-weight: 600; color: var(--gray-400);
  text-align: center; white-space: nowrap;
}
`+t+`.agt-track-label.done { color: var(--brand); }
`+t+`.agt-track-line {
  flex: 1; height: 1.5px; background: var(--gray-200); margin-bottom: 13px;
}
`+t+`.agt-track-line.done { background: var(--brand); }
`+t+`.agt-order-track-btn {
  display: flex; align-items: center; gap: 7px;
  font-size: 12.5px; font-weight: 600;
  color: var(--ink); text-decoration: none;
  border-top: 1px solid var(--gray-100);
  padding-top: 10px; margin-top: 2px;
  transition: color 0.14s;
}
`+t+`.agt-order-track-btn i { font-size: 12px; color: var(--gray-400); }
`+t+`.agt-order-track-btn:hover { color: var(--brand); }
`+t+`.agt-order-track-btn:hover i { color: var(--brand); }

`+t+`.agt-typing {
  display: none; align-items: center; gap: 7px;
  padding: 0 15px 10px;
}
`+t+`.agt-typing.visible { display: flex; }
`+t+`.agt-typing-av {
  width: 26px; height: 26px; border-radius: 50%;
  background: var(--ink); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: 11px;
  overflow: hidden;
}
`+t+`.agt-typing-av img { width: 100%; height: 100%; object-fit: cover; }
`+t+`.agt-typing-dots {
  background: var(--gray-100); border: 1px solid var(--gray-200);
  border-radius: 14px; border-bottom-left-radius: 4px;
  padding: 9px 13px;
  display: flex; align-items: center; gap: 4px;
}
`+t+`.agt-typing-dot {
  width: 5.5px; height: 5.5px; border-radius: 50%;
  background: var(--gray-400);
  animation: wave 1.2s ease-in-out infinite;
}
`+t+`.agt-typing-dot:nth-child(2) { animation-delay: 0.14s; }
`+t+`.agt-typing-dot:nth-child(3) { animation-delay: 0.28s; }
@keyframes wave {
  0%,60%,100% { transform: translateY(0); }
  30%          { transform: translateY(-5px); }
}

`+t+`.agt-rating {
  margin-left: 33px; margin-top: 10px;
  animation: msgIn 0.22s ease both;
}
`+t+`.agt-rating-label {
  font-size: 12px; color: var(--gray-500); margin-bottom: 7px; font-weight: 500;
}
`+t+`.agt-stars { display: flex; gap: 4px; }
`+t+`.agt-star {
  font-size: 20px; cursor: pointer;
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
  padding: 12px 14px;
  border-top: 1px solid var(--gray-200);
  background: var(--white);
  display: flex; align-items: flex-end; gap: 10px;
  flex-shrink: 0;
}
`+t+`.agt-input-wrap {
  flex: 1;
  background: var(--white);
  border: 1.5px solid var(--gray-200);
  border-radius: 24px;
  display: flex; align-items: center;
  padding: 6px 8px 6px 16px; gap: 8px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
`+t+`.agt-input-wrap:focus-within {
  border-color: var(--brand);
  box-shadow: 0 0 0 1px var(--brand);
}
`+t+`.agt-input {
  flex: 1; min-width: 0;
  background: none; border: none; outline: none;
  font-size: 14px; color: var(--gray-700);
  font-family: `+s+`;
  resize: none; min-height: 22px; max-height: 88px; line-height: 1.5;
}
`+t+`.agt-input::placeholder { color: var(--gray-400); }
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

@media (max-width: 480px) {
  `+u+` #agt-panel {
    width: min(100% - 24px, 360px);
    max-width: calc(100vw - 24px);
    min-height: min(560px, 85dvh);
    bottom: 80px; right: 12px; left: auto;
    border-radius: 20px;
  }
  `+u+` #agt-panel:has(#agt-home.gone) {
    height: min(560px, 85dvh);
    max-height: min(560px, 85dvh);
  }
  `+u+` #agt-launcher { bottom: 18px; right: 18px; }
}
@media (max-width: 380px) {
  `+u+` #agt-panel {
    width: calc(100vw - 20px);
    right: 10px; left: 10px;
    min-height: min(520px, 80dvh);
  }
  `+u+` #agt-panel:has(#agt-home.gone) {
    height: min(520px, 80dvh);
    max-height: min(520px, 80dvh);
  }
}
`}(function(){const a=window.AgentraConfig||{},s=a.widgetKey||a.key||"",C=(a.apiBase||"http://localhost:5000/api/v1/widget").replace(/\/$/,""),b="data-agentra-widget-style";let o=null,g=null,v=null,u=null,t=!1,y=!1,m,d,z,M,E,L,w,p,S,f,I;const pt={retrieving:"Searching knowledge base…",checking_order:"Checking your order…",searching_products:"Finding products…",thinking:"Generating your answer…"};async function T(n,e,r){const l=C+n,h={method:e||"GET",headers:{"Content-Type":"application/json","x-widget-key":s}};r&&(h.body=JSON.stringify({...r,widgetKey:s}));const c=await(await fetch(l,h)).json();if(!c.success)throw new Error(c.message||"Request failed");return c.data}function ht(n){const e=String(n).replace(/['"]/g,"").split(",")[0].trim();if(!e)return;const r="agentra-gf-"+e.replace(/\s+/g,"-");if(document.querySelector("#"+r))return;const l=document.createElement("link");l.id=r,l.rel="stylesheet",l.href="https://fonts.googleapis.com/css2?family="+encodeURIComponent(e).replace(/%20/g,"+")+":wght@400;500;600;700&display=swap",document.head.appendChild(l)}function ut(){if(document.querySelector("#agentra-fa-css"))return;const n=document.createElement("link");n.id="agentra-fa-css",n.rel="stylesheet",n.href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css",document.head.appendChild(n)}function ft(){if(!(!g||!(o!=null&&o.wsUrl)))try{u&&u.close();const n=o.wsUrl+"?session="+encodeURIComponent(g)+"&role=visitor";u=new WebSocket(n),u.onmessage=function(e){var r,l,h,k;try{const c=JSON.parse(e.data);c.type==="message"&&c.data&&K(c.data),c.type==="system_event"&&((r=c.data)==null?void 0:r.event)==="agent_joined"&&V(c.data.agentName+" joined the chat"),c.type==="status"&&((l=c.data)!=null&&l.status)&&R(c.data.status),c.type==="typing"&&((h=c.data)==null?void 0:h.role)!=="customer"&&j(!!((k=c.data)!=null&&k.active))}catch{}}}catch{}}function R(n){var r;if(!L||!((r=o==null?void 0:o.behavior)!=null&&r.retrievalIndicator))return;const e=pt[n]||"Working on it…";L.querySelector(".agt-process-label").textContent=e,L.classList.add("visible")}function U(){L==null||L.classList.remove("visible")}function j(n){M&&(M.classList.toggle("visible",n),n&&N())}function N(){m&&(m.scrollTop=m.scrollHeight)}function G(n){if(!m)return;const e=mt(n),r=m.querySelector(".agt-date-sep:last-of-type");if(!r||r.textContent!==e){const l=document.createElement("div");l.className="agt-date-sep",l.textContent=e,m.appendChild(l)}}function mt(n){const e=n instanceof Date?n:new Date(n),r=new Date,l=new Date(r.getFullYear(),r.getMonth(),r.getDate());return new Date(e.getFullYear(),e.getMonth(),e.getDate()).getTime()===l.getTime()?"Today":e.toLocaleDateString(void 0,{month:"short",day:"numeric"})}function W(n){G(new Date);const e=document.createElement("div");e.className="agt-msg-row customer",e.innerHTML='<div class="agt-bubble">'+i(n)+"</div>",m.appendChild(e),N()}function V(n){const e=document.createElement("div");e.className="agt-system-event",e.textContent=n,m.appendChild(e),N()}function xt(n){var h;const e=n.fulfillmentStatus||n.financialStatus||"Processing",r=(n.lineItems||[]).map(function(k){return'<div style="font-size:12px;color:#555;">'+i(k.title)+" × "+(k.quantity||1)+"</div>"}).join(""),l=(h=n.tracking)!=null&&h.url?'<a class="agt-order-track-btn" href="'+i(n.tracking.url)+'" target="_blank" rel="noopener"><i class="fa-solid fa-truck"></i> Track shipment</a>':"";return'<div class="agt-order-card"><div class="agt-order-num"><i class="fa-solid fa-receipt"></i> '+i(n.orderNumber||"")+'</div><div class="agt-order-status-row"><span class="agt-order-status-dot"></span><span class="agt-order-status-label">'+i(e)+"</span></div>"+r+l+"</div>"}function bt(n){return'<div class="agt-product-grid">'+n.map(function(e){const r=e.imageUrl?'<img src="'+i(e.imageUrl)+'" alt="'+i(e.title)+'">':'<div style="height:72px;background:#f3f4f6;"></div>',l=e.price!=null?(e.currency||"$")+e.price:"";return'<a class="agt-product-card"'+(e.url?' href="'+i(e.url)+'" target="_blank" rel="noopener"':"")+"><div>"+r+'</div><div class="agt-product-body"><div class="agt-product-title">'+i(e.title)+'</div><div class="agt-product-price">'+i(l)+"</div></div></a>"}).join("")+"</div>"}function H(n){var k;U(),j(!1);const e=n.sentAt?new Date(n.sentAt):new Date;if(G(e),n.contentType==="system_event"){V(n.body||"Update");return}const r=document.createElement("div");r.className="agt-msg-row agent";const l=n.senderName||(o==null?void 0:o.agentName)||"Assistant";let h="";n.contentType==="order_card"&&n.payload?h='<div class="agt-agent-row"><div class="agt-agent-av"><i class="fa-solid fa-robot"></i></div><div class="agt-msg-meta">'+i(l)+"</div></div>"+(n.body?'<div class="agt-bubble">'+P(n.body)+"</div>":"")+xt(n.payload):n.contentType==="product_cards"&&((k=n.payload)!=null&&k.products)?h='<div class="agt-agent-row"><div class="agt-agent-av"><i class="fa-solid fa-robot"></i></div><div class="agt-msg-meta">'+i(l)+"</div></div>"+(n.body?'<div class="agt-bubble">'+P(n.body)+"</div>":"")+bt(n.payload.products):h='<div class="agt-agent-row"><div class="agt-agent-av"><i class="fa-solid fa-robot"></i></div><div class="agt-msg-meta">'+i(l)+'</div></div><div class="agt-bubble">'+P(n.body||"")+"</div>",r.innerHTML=h,m.appendChild(r),N()}function K(n){n.role==="customer"?W(n.body):H(n)}function Z(){var n,e,r;(n=document.getElementById("agt-home"))==null||n.classList.add("gone"),(e=document.getElementById("agt-chat"))==null||e.classList.add("gone"),S==null||S.classList.remove("gone"),w==null||w.classList.remove("active"),p==null||p.classList.add("active"),(r=document.getElementById("agt-chat-header"))==null||r.style.setProperty("display","flex")}function D(){var n,e,r;S==null||S.classList.add("gone"),(n=document.getElementById("agt-home"))==null||n.classList.add("gone"),(e=document.getElementById("agt-chat"))==null||e.classList.remove("gone"),(r=document.getElementById("agt-chat-header"))==null||r.style.setProperty("display","flex"),p==null||p.classList.add("active"),w==null||w.classList.remove("active"),d==null||d.focus()}async function vt(n){I.disabled=!0;try{const e=await T("/session/start","POST",{email:n,pageUrl:window.location.href,origin:window.location.origin,userAgent:navigator.userAgent});g=e.sessionToken,v=n,y=!0,m.innerHTML="",(e.messages||[]).forEach(function(r){K(r)}),ft(),D()}catch(e){alert(e.message||"Could not start chat")}finally{I.disabled=!1}}async function _(n){const e=String(n||"").trim();if(!(!e||!g)){W(e),d.value="",z.disabled=!0,j(!0),R("thinking");try{const r=await T("/session/message","POST",{sessionToken:g,message:e});j(!1),U(),(r.messages||[]).forEach(function(l){H(l)}),r.handoff&&V("Connecting you with a support agent…")}catch(r){j(!1),U(),H({body:r.message||"Something went wrong. Please try again.",senderName:o==null?void 0:o.agentName})}finally{z.disabled=!d.value.trim()}}}function F(n){if(f&&(n?f.dataset.initialMsg=n:delete f.dataset.initialMsg),!y){Z();return}D(),n&&_(n)}function yt(){var c;const n=document.getElementById("agt-launcher"),e=document.getElementById("agt-panel"),r=document.getElementById("agt-close-btn"),l=document.getElementById("agt-back-btn");m=document.getElementById("agt-messages"),d=document.getElementById("agt-input"),z=document.getElementById("agt-send-btn"),M=document.getElementById("agt-typing"),L=document.getElementById("agt-process-steps"),E=document.getElementById("agt-badge"),w=document.getElementById("tab-home"),p=document.getElementById("tab-chat"),S=document.getElementById("agt-email-gate"),f=document.getElementById("agt-email-input"),I=document.getElementById("agt-email-btn");function h(){t=!0,e.classList.add("open"),n.classList.add("open"),E==null||E.classList.remove("show")}function k(){t=!1,e.classList.remove("open"),n.classList.remove("open")}n==null||n.addEventListener("click",function(){return t?k():h()}),r==null||r.addEventListener("click",k),w==null||w.addEventListener("click",function(){var x,A,B;w.classList.add("active"),p.classList.remove("active"),(x=document.getElementById("agt-home"))==null||x.classList.remove("gone"),(A=document.getElementById("agt-chat"))==null||A.classList.add("gone"),S==null||S.classList.add("gone"),(B=document.getElementById("agt-chat-header"))==null||B.style.setProperty("display","none"),f&&delete f.dataset.initialMsg}),p==null||p.addEventListener("click",function(){y?D():Z()}),l==null||l.addEventListener("click",function(){w==null||w.click()}),document.querySelectorAll(".agt-qr-item").forEach(function(x){x.addEventListener("click",function(){F(x.getAttribute("data-msg"))})}),(c=document.getElementById("agt-send-msg-card"))==null||c.addEventListener("click",function(){F()}),I==null||I.addEventListener("click",function(){var B,J;const x=(B=f==null?void 0:f.value)==null?void 0:B.trim();if(!x||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)){f==null||f.focus();return}const A=(J=f==null?void 0:f.dataset)==null?void 0:J.initialMsg;f&&delete f.dataset.initialMsg,vt(x).then(function(){A&&_(A)})}),d==null||d.addEventListener("input",function(){z.disabled=!d.value.trim(),d.style.height="auto",d.style.height=Math.min(d.scrollHeight,120)+"px"}),z==null||z.addEventListener("click",function(){_(d.value)}),d==null||d.addEventListener("keydown",function(x){x.key==="Enter"&&!x.shiftKey&&(x.preventDefault(),_(d.value))})}function Y(n){if(o=n,!(o!=null&&o.enabled))return;const e="agentra-widget-root";let r=document.getElementById(e);r||(r=document.createElement("div"),r.id=e,document.body.appendChild(r));const l=o.widgetColor||"#2563eb",h=String(o.fontFamily||"Sora").replace(/['"]/g,"").split(",")[0].trim()||"Sora",k="'"+h+"', system-ui, -apple-system, sans-serif";ht(h),ut();const c=document.querySelector("style["+b+"]");c&&c.remove();const x=document.createElement("style");x.setAttribute(b,"1"),x.textContent=ct(l,k,e,{backgroundColor:o.backgroundColor||"#ffffff"}),document.head.appendChild(x),r.innerHTML=gt(o),yt(),o.position==="bottom-left"&&(r.style.setProperty("--launcher-left",o.launcherOffsetX+"px"),r.style.setProperty("--launcher-right","auto"))}async function $(){if(!s){console.warn("[Agentra] widgetKey missing in AgentraConfig");return}try{const n=await T("/config?widgetKey="+encodeURIComponent(s));if(!n.enabled)return;Y(n),setInterval(async function(){try{const e=await T("/config?widgetKey="+encodeURIComponent(s));e.widgetColor&&e.widgetColor!==(o==null?void 0:o.widgetColor)&&Y(e)}catch{}},3e4)}catch(n){console.error("[Agentra widget]",n.message)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",$):$()})()})();
