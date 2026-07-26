/**
 * Bridge only: approved design widget (vendor/widget.js) ↔ new chatbot API.
 * Does not change widget visuals. Does not import chatbot-design backend.
 */
(function () {
  const ENGINE_BASE = "http://localhost:5600";
  const WORKSPACE_ID = "default";

  const previewConfig = {
    enabled: true,
    widgetColor: "#d85a30",
    backgroundColor: "#ffffff",
    fontFamily: "Plus Jakarta Sans",
    storeName: "Store",
    agentName: "Store Assistant",
    logoUrl: new URL("./assets/whitelogo all.svg", window.location.href).href,
    faviconUrl: new URL("./assets/Favicon.png", window.location.href).href,
    logoWidth: 150,
    logoHeight: 40,
    welcomeTitle: "Hi there\nHow can we help?",
    welcomeSubtitle: "Ask about orders, products, returns & store support.",
    quickReplies: [
      "Where is my order?",
      "Return or refund policy",
      "Talk to a human",
      "Product recommendations",
    ],
    emailGateTitle: "Start a conversation",
    emailGateSubtitle: "Enter your email so we can follow up with you.",
    askAnythingLabel: "Ask me anything",
    privacyNotice:
      "This chat is AI-powered for faster assistance. Chats are monitored and recorded.",
    privacyPolicyLabel: "Privacy Policy",
    privacyPolicyUrl: "",
    showBranding: false,
    disclaimer: "",
    behavior: {
      retrievalIndicator: true,
    },
  };

  const originalFetch = window.fetch.bind(window);

  const session = {
    token: localStorage.getItem("cb_session") || "sess-" + Math.random().toString(36).slice(2, 10),
    conversationId: localStorage.getItem("cb_conversation") || null,
    visitorEmail: localStorage.getItem("cb_email") || null,
    messages: [],
  };

  let eventsSource = null;

  function stopEvents() {
    if (eventsSource) {
      try {
        eventsSource.close();
      } catch {
        /* ignore */
      }
      eventsSource = null;
    }
  }

  function startEvents(conversationId) {
    stopEvents();
    if (!conversationId) return;
    try {
      eventsSource = new EventSource(
        ENGINE_BASE + "/v1/chat/events?conversationId=" + encodeURIComponent(conversationId),
      );
      eventsSource.addEventListener("message", (ev) => {
        let payload = null;
        try {
          payload = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (!payload || !payload.type) return;

        if (payload.type === "agent_joined") {
          if (typeof window.ynSetAttach === "function") window.ynSetAttach(true);
          const msg = payload.message
            ? toWidgetMessage(payload.message)
            : {
                role: "system",
                contentType: "system_event",
                body: "An agent joined the conversation",
                payload: { type: "agent_joined", text: "An agent joined the conversation" },
                sentAt: new Date().toISOString(),
              };
          appendLiveMessage(msg);
          return;
        }

        if (payload.type === "agent_message" && payload.message) {
          appendLiveMessage(toWidgetMessage(payload.message));
          return;
        }

        if (payload.type === "ai_resumed") {
          if (typeof window.ynSetAttach === "function") window.ynSetAttach(false);
        }
      });
    } catch (err) {
      console.warn("[bridge] events unavailable", err);
    }
  }

  function appendLiveMessage(msg) {
    session.messages.push(msg);
    const root = document.getElementById("agt-messages");
    if (!root) return;

    if (msg.contentType === "system_event") {
      const el = document.createElement("div");
      el.className = "agt-system-event";
      el.textContent = msg.body || msg.payload?.text || "Update";
      root.appendChild(el);
      root.scrollTop = root.scrollHeight;
      return;
    }

    if (msg.role === "agent" || msg.role === "bot") {
      const row = document.createElement("div");
      row.className = "agt-msg-row agent";
      const name = msg.senderName || previewConfig.agentName;
      const body = msg.body || "";
      const atts = Array.isArray(msg.attachments) ? msg.attachments : [];
      const attachHtml = atts
        .map((a) => {
          const url = a.url || "";
          const nameEsc = String(a.filename || "file")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/"/g, "&quot;");
          const urlEsc = String(url)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;");
          if (a.kind === "image" || String(a.mimeType || "").startsWith("image/")) {
            return `<a href="${urlEsc}" target="_blank" rel="noopener"><img class="agt-attach-img" src="${urlEsc}" alt="${nameEsc}"></a>`;
          }
          return `<a class="agt-attach-file" href="${urlEsc}" target="_blank" rel="noopener" download><span>${nameEsc}</span></a>`;
        })
        .join("");
      const bubbleInner =
        (body
          ? String(body)
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/\n/g, "<br>")
          : "") +
        (body && attachHtml ? "<br>" : "") +
        (attachHtml ? `<div class="agt-attach-list">${attachHtml}</div>` : "");
      row.innerHTML =
        `<div class="agt-msg-meta"><span class="agt-msg-name">${String(name)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")}</span></div>` +
        (bubbleInner ? `<div class="agt-bubble">${bubbleInner}</div>` : "");
      root.appendChild(row);
      root.scrollTop = root.scrollHeight;
    }
  }

  function jsonResponse(data, status = 200) {
    return Promise.resolve(
      new Response(JSON.stringify({ success: true, data }), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }

  function errorResponse(message, status = 500) {
    return Promise.resolve(
      new Response(JSON.stringify({ success: false, message }), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }

  async function readJsonBody(options) {
    if (!options?.body) return {};
    if (typeof options.body === "string") {
      try {
        return JSON.parse(options.body);
      } catch {
        return {};
      }
    }
    return {};
  }

  /** Map new API messages → approved widget message shape */
  function toWidgetMessage(msg) {
    const role =
      msg.role === "assistant" || msg.role === "bot"
        ? "bot"
        : msg.role === "customer" || msg.role === "user"
          ? "customer"
          : msg.role === "agent"
            ? "agent"
            : msg.role === "system"
              ? "system"
              : "bot";

    const out = {
      id: msg.id,
      role,
      contentType: msg.contentType || "text",
      senderName: msg.senderName || previewConfig.agentName,
      body: msg.body || "",
      sentAt: msg.sentAt || new Date().toISOString(),
    };

    if (msg.attachments?.length) {
      out.attachments = msg.attachments.map(absolutizeAttachment);
      out.payload = { ...(out.payload || {}), attachments: out.attachments };
    }

    if (msg.contentType === "product_cards") {
      out.payload = { products: msg.products || [] };
      out.products = msg.products || [];
    } else if (msg.contentType === "order_card") {
      const order = mapOrderForWidget(msg.order || msg.payload || null);
      out.payload = order;
      out.order = order;
    } else if (msg.contentType === "input_form") {
      const form = msg.form || {};
      out.payload = {
        ...form,
        formId: form.formId || form.actionId || "form",
        // Approved widget reads these underscore fields for data-action-id
        _actionId: form.actionId || form._actionId || null,
        _confirmationToken: form.confirmToken || form._confirmationToken || null,
        summaryLines: form.summary || form.summaryLines || [],
      };
      out.form = form;
    } else if (msg.contentType === "choices") {
      const choices = (msg.choices || []).map((c) => ({
        label: c.label || c.value || c.id,
        message: c.value || c.label || c.id,
        id: c.id,
      }));
      out.payload = { choices, actionButtons: msg.actionButtons || [] };
      out.choices = choices;
    } else if (msg.contentType === "rating") {
      const rating = msg.rating || {
        prompt: msg.body || "How was this chat?",
        options: [],
      };
      out.contentType = "rating";
      out.payload = { rating, type: "rating" };
      out.rating = rating;
      out.body = msg.body || rating.prompt || "How was this chat?";
    } else if (msg.contentType === "system_event") {
      out.payload = msg.systemEvent || { type: "system", text: msg.body };
      out.systemEvent = msg.systemEvent;
    } else if (msg.contentType === "attachments" && msg.attachments?.length) {
      out.payload = { ...(out.payload || {}), attachments: out.attachments };
    }

    // Choices attached to a text reply (handoff confirm, etc.)
    if (msg.choices?.length && msg.contentType === "text") {
      const choices = msg.choices.map((c) => ({
        label: c.label || c.value || c.id,
        message: c.value || c.label || c.id,
        id: c.id,
      }));
      out.payload = { ...(out.payload || {}), choices };
      out.choices = choices;
    }

    return out;
  }

  function absolutizeAttachment(att) {
    if (!att || typeof att !== "object") return att;
    let url = String(att.url || "");
    if (url.startsWith("/")) url = ENGINE_BASE + url;
    return { ...att, url };
  }

  /**
   * Approved widget.js reads financialStatus / fulfillmentStatus for badge +
   * cancelled/refunded outcome UI — not our `outcome` / `cancellationStatus` fields.
   */
  function mapOrderForWidget(order) {
    if (!order) return null;
    const cancelled =
      order.outcome === "cancelled" ||
      String(order.cancellationStatus || "").toLowerCase() === "cancelled";
    const refunded =
      order.outcome === "refunded" ||
      /refund/i.test(String(order.refundStatus || "")) ||
      /refund/i.test(String(order.financialStatus || ""));

    const financialStatus = cancelled
      ? "cancelled"
      : refunded
        ? String(order.financialStatus || "refunded")
        : order.financialStatus;
    const fulfillmentStatus = cancelled
      ? "cancelled"
      : order.fulfillmentStatus;

    return {
      ...order,
      financialStatus,
      fulfillmentStatus,
      // Widget prefers these alternate keys for total / items
      totalDisplay:
        order.totalDisplay ||
        order.total ||
        (order.totalPrice != null
          ? `${order.currency || ""}${order.totalPrice}`
          : undefined),
      lineItems: order.lineItems || order.items || [],
      // Hide stepper when terminal — widget also hides when cancel/refund detected
      stepper: cancelled || refunded ? undefined : order.stepper,
      outcome: cancelled ? "cancelled" : refunded ? "refunded" : order.outcome || null,
      badge: cancelled
        ? "Cancelled"
        : refunded
          ? "Refunded"
          : order.badge || financialStatus || fulfillmentStatus,
    };
  }

  async function api(path, body) {
    const res = await originalFetch(ENGINE_BASE + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `Request failed (${res.status})`);
    }
    return data.data;
  }

  window.fetch = async function bridgedFetch(resource, options) {
    const url = String(resource);

    if (!url.includes("/api/v1/widget")) {
      return originalFetch(resource, options);
    }

    if (url.includes("/config")) {
      return jsonResponse(previewConfig);
    }

    if (url.includes("/session/start")) {
      const body = await readJsonBody(options);
      if (body.email) {
        session.visitorEmail = body.email;
        localStorage.setItem("cb_email", body.email);
      }
      // Always mint a fresh conversation (widget new-chat + email-gate start)
      session.token = "sess-" + Math.random().toString(36).slice(2, 12);
      session.conversationId = null;
      session.messages = [];
      stopEvents();
      localStorage.setItem("cb_session", session.token);
      localStorage.removeItem("cb_conversation");
      try {
        const data = await api("/v1/chat/session", {
          sessionToken: session.token,
          visitorEmail: session.visitorEmail,
          channel: "web",
          workspaceId: WORKSPACE_ID,
          forceNew: true,
        });
        session.token = data.sessionToken;
        session.conversationId = data.conversationId;
        localStorage.setItem("cb_session", session.token);
        localStorage.setItem("cb_conversation", session.conversationId);
        session.messages = (data.messages || []).map(toWidgetMessage);
        startEvents(session.conversationId);
        if (
          data.handoffState === "agent_joined" ||
          data.conversationState?.humanTakeover
        ) {
          setTimeout(() => {
            if (typeof window.ynSetAttach === "function") window.ynSetAttach(true);
          }, 300);
        }
        return jsonResponse({
          sessionToken: session.token,
          conversationId: session.conversationId,
          messages: session.messages,
        });
      } catch (err) {
        return errorResponse(err.message || "Session start failed", 500);
      }
    }

    if (url.includes("/session/upload")) {
      try {
        if (!session.conversationId || !session.token) {
          return errorResponse("Start a conversation before uploading.", 400);
        }
        const form = options?.body;
        if (!(form instanceof FormData)) {
          return errorResponse("Expected multipart form data", 400);
        }
        form.set("conversationId", session.conversationId);
        form.set("sessionToken", session.token);
        const res = await originalFetch(ENGINE_BASE + "/v1/uploads", {
          method: "POST",
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          return errorResponse(
            data.message || `Upload failed (${res.status})`,
            res.status || 400,
          );
        }
        const attachments = (data.data?.attachments || []).map(absolutizeAttachment);
        return jsonResponse({ attachments });
      } catch (err) {
        return errorResponse(err.message || "Upload failed", 500);
      }
    }

    if (url.includes("/session/message")) {
      const body = await readJsonBody(options);
      const message = String(body.message || "").trim();
      const attachments = Array.isArray(body.attachments) ? body.attachments : [];
      if (!message && !body.formSubmission && !attachments.length) {
        return errorResponse("message is required", 400);
      }

      session.messages.push({
        role: "customer",
        contentType: attachments.length ? "attachments" : "text",
        body: message,
        attachments: attachments.length ? attachments : undefined,
        sentAt: new Date().toISOString(),
      });

      try {
        const data = await api("/v1/chat/turn", {
          workspaceId: WORKSPACE_ID,
          sessionToken: session.token,
          conversationId: session.conversationId,
          message,
          visitorEmail: session.visitorEmail,
          formSubmission: body.formSubmission,
          choiceId: body.choiceId,
          attachments,
          channel: "web",
        });
        session.conversationId = data.conversationId;
        localStorage.setItem("cb_conversation", session.conversationId);
        startEvents(session.conversationId);
        const replies = (data.messages || []).map(toWidgetMessage);
        session.messages.push(...replies);

        const connecting = data.handoffState === "connecting";
        const agentJoined =
          data.handoffState === "agent_joined" ||
          Boolean(data.conversationState?.humanTakeover);

        return jsonResponse({
          messages: replies,
          // Queue status lives on the system_event message / connecting pill
          clearConnecting: true,
          handoff: connecting,
          allowAttachments: agentJoined,
          handoffState: {
            status: data.handoffState || "not_requested",
            queuePosition: data.queuePosition,
            estimatedWaitMinutes: data.estimatedWaitMinutes,
            queueLabel: data.queueLabel,
            display: {
              title: connecting ? "Connecting you with a human agent." : null,
              queueLabel: data.queueLabel || null,
              showSpinner: false,
              removeStatusComponent: true,
            },
          },
          conversationState: data.conversationState,
        });
      } catch (err) {
        const reply = {
          role: "bot",
          contentType: "text",
          senderName: previewConfig.agentName,
          body:
            err.message ||
            "I could not reach the conversation engine. Is it running on port 5600?",
          sentAt: new Date().toISOString(),
        };
        session.messages.push(reply);
        return jsonResponse({
          messages: [reply],
          clearConnecting: true,
        });
      }
    }

    if (url.includes("/session/")) {
      // Resume a past chat by session token (Messages list click)
      try {
        const path = String(url).split("?")[0];
        const parts = path.split("/").filter(Boolean);
        const idx = parts.lastIndexOf("session");
        const resumeToken = idx >= 0 ? decodeURIComponent(parts[idx + 1] || "") : "";
        if (!resumeToken || resumeToken === "start" || resumeToken === "message" || resumeToken === "upload") {
          return jsonResponse({
            session: {
              visitorEmail: session.visitorEmail,
              messages: session.messages,
            },
          });
        }

        const data = await api("/v1/chat/session", {
          sessionToken: resumeToken,
          visitorEmail: session.visitorEmail,
          channel: "web",
          workspaceId: WORKSPACE_ID,
          resumeOnly: true,
        });

        session.token = data.sessionToken || resumeToken;
        session.conversationId = data.conversationId || null;
        if (data.visitorEmail || session.visitorEmail) {
          session.visitorEmail = data.visitorEmail || session.visitorEmail;
        }
        session.messages = (data.messages || []).map(toWidgetMessage);
        localStorage.setItem("cb_session", session.token);
        if (session.conversationId) {
          localStorage.setItem("cb_conversation", session.conversationId);
        }
        stopEvents();
        if (session.conversationId) startEvents(session.conversationId);

        if (
          data.handoffState === "agent_joined" ||
          data.conversationState?.humanTakeover
        ) {
          setTimeout(() => {
            if (typeof window.ynSetAttach === "function") window.ynSetAttach(true);
          }, 300);
        }

        return jsonResponse({
          session: {
            visitorEmail: session.visitorEmail,
            sessionToken: session.token,
            conversationId: session.conversationId,
            messages: session.messages,
          },
        });
      } catch (err) {
        return errorResponse(err.message || "Could not open that chat", 404);
      }
    }

    return jsonResponse({});
  };

  window.AgentraConfig = {
    widgetKey: "ecommerce-chatbot",
    apiBase: window.location.origin + "/api/v1/widget",
  };

  const widgetScript = document.createElement("script");
  widgetScript.src = "./vendor/widget.js?v=resume-chat-history";
  widgetScript.async = true;
  widgetScript.onerror = function () {
    console.error("[widget] failed to load ./vendor/widget.js");
  };
  document.body.appendChild(widgetScript);

  const openWidget = window.setInterval(() => {
    const launcher = document.querySelector("#agt-launcher");
    if (!launcher) return;
    window.clearInterval(openWidget);
    launcher.click();
  }, 25);
})();
