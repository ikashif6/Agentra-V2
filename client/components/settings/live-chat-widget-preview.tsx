"use client";

import { useEffect, useMemo, useState } from "react";
import type { LiveChatSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

type Screen = "home" | "email" | "chat";

type PreviewMessage = { role: "agent" | "user"; text: string };

function darken(hex: string) {
  const h = (hex || "#2563eb").replace("#", "");
  if (h.length !== 6) return "#1d4ed8";
  const r = Math.max(0, parseInt(h.slice(0, 2), 16) - 18);
  const g = Math.max(0, parseInt(h.slice(2, 4), 16) - 18);
  const b = Math.max(0, parseInt(h.slice(4, 6), 16) - 18);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 36 36" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 3H27V10.5H33V33.927L25.1459 30H9V23.427L3 26.427V3ZM9 20.073V10.5H24V6H6V21.573L9 20.073ZM12 13.5V27H25.8541L30 29.073V13.5H12Z"
        fill="white"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" fill="none" aria-hidden>
      <path
        d="M21.5 1.5L1.50135 21.4987M21.4987 21.5L1.5 1.50142"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="7" height="10" viewBox="-1 0 9 10" className="shrink-0 text-gray-400" aria-hidden>
      <path
        d="M6.68552 4.35872L1.43528 0.191346C1.2568 0.0507239 1.02709 -0.0167999 0.796448 0.00356129C0.565808 0.0239225 0.353038 0.130509 0.20473 0.299981C0.0564228 0.469452 -0.0153345 0.687996 0.00517204 0.907755C0.0256786 1.12751 0.136778 1.33058 0.31414 1.47248L4.7577 4.99931L0.31414 8.52614C0.136094 8.66784 0.0243811 8.87107 0.00354121 9.09117C-0.0172987 9.31128 0.054439 9.53026 0.202996 9.70002C0.351552 9.86977 0.564778 9.97642 0.795834 9.99654C1.02689 10.0167 1.25688 9.94858 1.43528 9.80729L6.68552 5.63985C6.78397 5.56151 6.86316 5.46354 6.9175 5.35285C6.97184 5.24217 7 5.12147 7 4.99928C7 4.87709 6.97184 4.7564 6.9175 4.64571C6.86316 4.53503 6.78397 4.43706 6.68552 4.35872Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HomeTabIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.5 2.33497L3 7.50997C2.375 7.94697 2 8.62597 2 9.34997V19.7C2 20.965 3.125 22 4.5 22H19.5C20.875 22 22 20.965 22 19.7V9.34997C22 8.62597 21.625 7.94697 21 7.50997L13.5 2.33497C13.0565 2.03704 12.5343 1.87793 12 1.87793C11.4657 1.87793 10.9435 2.03704 10.5 2.33497ZM7.316 14.366C7.23309 14.2895 7.1358 14.2303 7.02979 14.1918C6.92378 14.1534 6.81117 14.1364 6.69853 14.1418C6.58588 14.1473 6.47545 14.1751 6.37367 14.2237C6.27189 14.2723 6.1808 14.3406 6.10569 14.4248C6.03058 14.5089 5.97297 14.6071 5.9362 14.7137C5.89944 14.8204 5.88426 14.9332 5.89155 15.0458C5.89884 15.1583 5.92845 15.2683 5.97866 15.3693C6.02887 15.4703 6.09867 15.5602 6.184 15.634C7.78279 17.0653 9.85414 17.8552 12 17.852C14.1459 17.8552 16.2172 17.0653 17.816 15.634C17.9013 15.5602 17.9711 15.4703 18.0213 15.3693C18.0716 15.2683 18.1012 15.1583 18.1085 15.0458C18.1157 14.9332 18.1006 14.8204 18.0638 14.7137C18.027 14.6071 17.9694 14.5089 17.8943 14.4248C17.8192 14.3406 17.7281 14.2723 17.6263 14.2237C17.5245 14.1751 17.4141 14.1473 17.3015 14.1418C17.1888 14.1364 17.0762 14.1534 16.9702 14.1918C16.8642 14.2303 16.7669 14.2895 16.684 14.366C15.3967 15.5191 13.7283 16.1553 12 16.152C10.2 16.152 8.56 15.477 7.316 14.366Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChatTabIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M19 2C19.7956 2 20.5587 2.31607 21.1213 2.87868C21.6839 3.44129 22 4.20435 22 5V20.806C22 22.141 20.387 22.811 19.441 21.868L15.56 18H5C4.20435 18 3.44129 17.6839 2.87868 17.1213C2.31607 16.5587 2 15.7956 2 15V5C2 4.20435 2.31607 3.44129 2.87868 2.87868C3.44129 2.31607 4.20435 2 5 2H19ZM17 7H7a.85.85 0 0 0 0 1.7H17A.85.85 0 0 0 17 7ZM12 11H7a.85.85 0 0 0 0 1.7H12A.85.85 0 0 0 12 11Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function LiveChatWidgetPreview({ settings }: { settings: LiveChatSettings }) {
  const [open, setOpen] = useState(true);
  const [screen, setScreen] = useState<Screen>("home");
  const [email, setEmail] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<PreviewMessage[]>([]);

  const brand = settings.appearance.brandColor || "#2563eb";
  const brandDk = useMemo(() => darken(brand), [brand]);
  const surface = settings.appearance.backgroundColor || "#ffffff";
  const fontName =
    String(settings.appearance.fontFamily || "Sora")
      .replace(/['"]/g, "")
      .split(",")[0]
      .trim() || "Sora";
  const font = `'${fontName}', system-ui, -apple-system, sans-serif`;
  const storeName = settings.content.storeDisplayName || "Your store";
  const agentName = settings.content.agentName || "Support Assistant";
  const logoWidth = settings.appearance.logoWidth || 120;
  const logoHeight = settings.appearance.logoHeight || 40;
  const quickReplies = (settings.content.quickReplies ?? [])
    .map((q) => String(q || "").trim())
    .filter(Boolean)
    .slice(0, 4);

  useEffect(() => {
    const id = `agentra-preview-gf-${fontName.replace(/\s+/g, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName).replace(
      /%20/g,
      "+",
    )}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }, [fontName]);

  useEffect(() => {
    setScreen("home");
    setMessages([]);
    setDraft("");
  }, [
    settings.appearance.brandColor,
    settings.appearance.backgroundColor,
    settings.appearance.fontFamily,
    settings.appearance.logoUrl,
    settings.appearance.logoWidth,
    settings.appearance.logoHeight,
    settings.content.welcomeTitle,
    settings.content.welcomeSubtitle,
    settings.content.agentName,
    settings.content.emailGateTitle,
    settings.content.emailGateSubtitle,
  ]);

  const closePanel = () => {
    setOpen(false);
  };
  const toggle = () => {
    if (open) {
      closePanel();
      return;
    }
    setScreen("home");
    setOpen(true);
  };

  const startChat = (seed?: string) => {
    setDraft(seed?.trim() || "");
    setScreen("email");
  };

  const continueFromEmail = () => {
    if (!email.trim() || !email.includes("@")) return;
    const welcome =
      settings.content.welcomeMessage ||
      "I'm here to help with orders, products, and store questions.";
    const initial: PreviewMessage[] = [{ role: "agent", text: welcome }];
    if (draft.trim()) {
      initial.push({ role: "user", text: draft.trim() });
      initial.push({
        role: "agent",
        text: "Thanks — this is a preview. On your live store, the AI would reply here.",
      });
    }
    setMessages(initial);
    setDraft("");
    setScreen("chat");
  };

  const sendDraft = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      {
        role: "agent",
        text: "Preview only — responses will come from your AI once the widget is live.",
      },
    ]);
    setDraft("");
  };

  return (
    <div className="w-full min-w-0">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Live preview</p>
          <p className="text-xs text-muted-foreground">
            Open and close the widget to try the experience
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="shrink-0 rounded-lg border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          {open ? "Close" : "Open"}
        </button>
      </div>

      {/* Phone-like stage — grows with home content; no home scrollbar */}
      <div
        className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-2xl border border-border/70 bg-[#e8ecf0] shadow-sm"
        style={{ minHeight: 640, fontFamily: font }}
      >
        <div className="pointer-events-none absolute inset-0 p-4 opacity-60">
          <div className="mb-3 h-2.5 w-20 rounded bg-white/80" />
          <div className="mb-2 h-2 w-[70%] rounded bg-white/55" />
          <div className="mb-5 h-2 w-[45%] rounded bg-white/45" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-20 rounded-xl bg-white/65" />
            <div className="h-20 rounded-xl bg-white/65" />
            <div className="h-20 rounded-xl bg-white/50" />
            <div className="h-20 rounded-xl bg-white/50" />
          </div>
        </div>

        {/* Widget panel — opens from launcher corner (bottom-right) */}
        <div
          className={cn(
            "relative z-20 mx-3 mt-3 mb-[80px] flex h-auto origin-bottom-right flex-col overflow-hidden rounded-[18px] shadow-[0_12px_40px_rgba(15,23,42,0.18),0_2px_8px_rgba(15,23,42,0.06)]",
            screen !== "home" && "min-h-[520px]",
            open
              ? "translate-y-0 scale-100 opacity-100"
              : "pointer-events-none translate-y-3.5 scale-[0.96] opacity-0",
          )}
          style={{
            backgroundColor: surface,
            transition: open
              ? "transform 0.34s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease-out"
              : "transform 0.2s cubic-bezier(0.4, 0, 1, 1), opacity 0.16s ease-in",
          }}
          role="dialog"
          aria-label="Customer support chat preview"
        >
          {screen === "chat" || screen === "email" ? (
            <header
              className="flex shrink-0 items-center gap-2 px-3 py-2.5 text-white"
              style={{ background: `linear-gradient(160deg, ${brand} 0%, ${brandDk} 100%)` }}
            >
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-lg text-white/90 hover:bg-white/10"
                aria-label="Back"
                onClick={() => {
                  setDraft("");
                  setScreen("home");
                }}
              >
                <BackIcon />
              </button>
              <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15 text-sm font-semibold">
                {settings.appearance.faviconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.appearance.faviconUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  agentName.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{agentName}</p>
                <p className="flex items-center gap-1.5 text-[11px] text-white/85">
                  <span className="size-1.5 shrink-0 rounded-full bg-emerald-300" />
                  Online · replies instantly
                </p>
              </div>
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-lg text-white/90 hover:bg-white/10"
                aria-label="Close"
                onClick={closePanel}
              >
                ✕
              </button>
            </header>
          ) : null}

          {screen === "home" ? (
            <div className="flex flex-col" style={{ backgroundColor: "#f7f8f9" }}>
              <div
                className="shrink-0 px-[18px] pb-14 pt-7 text-white"
                style={{ background: `linear-gradient(165deg, ${brand} 0%, ${brandDk} 100%)` }}
              >
                {settings.appearance.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.appearance.logoUrl}
                    alt={storeName}
                    className="mb-3.5 object-contain"
                    style={{
                      maxWidth: logoWidth,
                      maxHeight: logoHeight,
                      width: "auto",
                      height: "auto",
                    }}
                  />
                ) : (
                  <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em] text-white/60">
                    {storeName}
                  </p>
                )}
                <h2
                  className="mt-[18px] mb-2.5 text-[24px] font-extrabold leading-[1.2] tracking-[-0.03em]"
                  style={{ fontFamily: font }}
                >
                  {(settings.content.welcomeTitle || "Hi there 👋\nHow can we help?")
                    .split("\n")
                    .map((line, i) => (
                      <span key={i}>
                        {i > 0 ? <br /> : null}
                        {line}
                      </span>
                    ))}
                </h2>
                <p
                  className="m-0 max-w-[92%] text-[13.5px] font-normal leading-[1.45] text-white/70"
                  style={{ fontFamily: font }}
                >
                  {settings.content.welcomeSubtitle ||
                    "Ask about orders, products, returns & store support."}
                </p>
              </div>

              <div className="relative z-[2] -mt-9 flex flex-col gap-2 px-3.5 pb-6">
                {quickReplies.length ? (
                  <div
                    className="overflow-hidden rounded-2xl border border-black/[0.06] shadow-[0_4px_18px_rgba(15,23,42,0.08)]"
                    style={{ backgroundColor: surface }}
                  >
                    {quickReplies.map((q, i) => (
                      <button
                        key={`${q}-${i}`}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 border-b border-[#f0f2f4] px-4 py-[15px] text-left text-[13.5px] font-medium text-[#374151] last:border-b-0 hover:bg-black/[0.03]"
                        style={{ fontFamily: font }}
                        onClick={() => startChat(q)}
                      >
                        <span className="min-w-0">{q}</span>
                        <Chevron />
                      </button>
                    ))}
                  </div>
                ) : null}

                <button
                  type="button"
                  className="flex items-center gap-3 rounded-2xl border border-black/[0.06] px-4 py-3.5 text-left shadow-[0_2px_10px_rgba(15,23,42,0.05)] hover:bg-black/[0.02]"
                  style={{ backgroundColor: surface, fontFamily: font }}
                  onClick={() => startChat()}
                >
                  <div className="flex shrink-0 -space-x-2">
                    {(settings.agents?.length
                      ? settings.agents.slice(0, 5)
                      : [
                          { _id: "fallback-j", initials: "J", color: "#a78bfa", fullName: "J", firstName: "J", lastName: "" },
                          { _id: "fallback-a", initials: "A", color: "#f97316", fullName: "A", firstName: "A", lastName: "" },
                          { _id: "fallback-m", initials: "M", color: "#22c55e", fullName: "M", firstName: "M", lastName: "" },
                        ]
                    ).map((agent, i) => (
                      <span
                        key={agent._id}
                        className="flex size-7 items-center justify-center overflow-hidden rounded-full border-2 border-white text-[10px] font-bold text-white"
                        style={{
                          background: agent.color || ["#a78bfa", "#f97316", "#22c55e"][i % 3],
                          zIndex: 5 - i,
                        }}
                        title={agent.fullName}
                      >
                        {agent.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={agent.avatar} alt="" className="size-full object-cover" />
                        ) : (
                          agent.initials
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-[#111827]">{storeName}</p>
                    <p className="mt-0.5 text-[11.5px] text-[#9aa1ac]">Leave us a message</p>
                  </div>
                  <Chevron />
                </button>
              </div>

              <div
                className="z-[3] grid shrink-0 grid-cols-2 border-t border-[#e4e7eb]"
                style={{ backgroundColor: surface }}
              >
                <button
                  type="button"
                  className="flex flex-col items-center gap-1 pb-[18px] pt-3 text-[11px] font-semibold"
                  style={{ color: brand, fontFamily: font }}
                >
                  <HomeTabIcon />
                  Home
                </button>
                <button
                  type="button"
                  className="flex flex-col items-center gap-1 pb-[18px] pt-3 text-[11px] font-medium text-[#9aa1ac]"
                  style={{ fontFamily: font }}
                  onClick={() => startChat()}
                >
                  <ChatTabIcon />
                  Chat
                </button>
              </div>
            </div>
          ) : null}

          {screen === "email" ? (
            <div
              className="flex flex-1 flex-col justify-center gap-3 overflow-y-auto px-4 py-5"
              style={{ backgroundColor: surface, fontFamily: font }}
            >
              <h3 className="text-base font-bold text-[#111214]">
                {settings.content.emailGateTitle || "Start a conversation"}
              </h3>
              <p className="text-sm text-[#6b7280]">
                {settings.content.emailGateSubtitle ||
                  "Enter your email so we can help you with your orders."}
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="rounded-xl border border-[#e4e7eb] px-3 py-2.5 text-sm outline-none"
                style={{ backgroundColor: surface, color: "#111214" }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = brand;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#e4e7eb";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") continueFromEmail();
                }}
              />
              <button
                type="button"
                className="rounded-xl px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: brand }}
                disabled={!email.includes("@")}
                onClick={continueFromEmail}
              >
                Continue to chat
              </button>
              {draft ? (
                <p className="truncate text-xs text-[#9aa1ac]">
                  Will send: <span className="text-[#374151]">{draft}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          {screen === "chat" ? (
            <div className="flex min-h-0 flex-1 flex-col" style={{ backgroundColor: surface, fontFamily: font }}>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 py-2.5">
                {messages.map((m, i) => (
                  <div
                    key={`${m.role}-${i}`}
                    className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                        m.role === "user"
                          ? "rounded-br-md text-white"
                          : "rounded-bl-md border border-[#e4e7eb] text-[#111214]",
                      )}
                      style={
                        m.role === "user"
                          ? { background: brand }
                          : { backgroundColor: surface }
                      }
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className="shrink-0 border-t border-[#e4e7eb] p-2" style={{ backgroundColor: surface }}>
                <div
                  className="flex items-end gap-2 rounded-2xl border border-[#e4e7eb] px-2 py-1"
                  style={{ backgroundColor: surface === "#ffffff" || surface === "#fff" ? "#f7f8f9" : surface }}
                >
                  <textarea
                    rows={1}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type your message..."
                    className="max-h-16 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendDraft();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!draft.trim()}
                    className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
                    style={{ background: brand }}
                    aria-label="Send"
                    onClick={sendDraft}
                  >
                    ↑
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          aria-label={open ? "Close chat" : "Open chat"}
          onClick={toggle}
          className="absolute bottom-4 right-4 z-30 flex size-12 items-center justify-center rounded-full shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition-transform duration-200 ease-out hover:scale-105 active:scale-95"
          style={{ background: brand }}
        >
          <span
            className={cn(
              "absolute",
              open ? "scale-[0.6] rotate-45 opacity-0" : "scale-100 rotate-0 opacity-100",
            )}
            style={{
              transitionProperty: "opacity, transform",
              transitionDuration: "280ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <ChatIcon />
          </span>
          <span
            className={cn(
              "absolute",
              open ? "scale-100 rotate-0 opacity-100" : "scale-[0.6] -rotate-45 opacity-0",
            )}
            style={{
              transitionProperty: "opacity, transform",
              transitionDuration: "280ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <CloseIcon />
          </span>
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white transition-[opacity,transform] duration-200",
              open ? "scale-0 opacity-0" : "scale-100 opacity-100",
            )}
          >
            1
          </span>
        </button>
      </div>
    </div>
  );
}
