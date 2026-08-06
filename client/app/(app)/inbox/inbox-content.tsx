"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  Check,
  Inbox,
  ListFilter,
  Loader2,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { InboxReplyComposer } from "@/components/inbox/inbox-reply-composer";
import { FormattedMessageBody, extractTicketSenderPrefix, stripTicketSenderPrefix } from "@/lib/format-message-body";
import { messageHtmlToPlain, isMessageHtml } from "@/lib/sanitize-message-html";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { InboxTicketToolbar } from "@/components/inbox/inbox-ticket-toolbar";
import { LiveChatTicketToolbar } from "@/components/inbox/ai-agent-ticket-toolbar";
import { InboxTicketDetailsPanel } from "@/components/inbox/inbox-ticket-details-panel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ticketApi, teamApi, usersApi, liveChatApi, ticketAiApi } from "@/lib/api";
import type {
  Attachment,
  Team,
  Ticket,
  TicketDetails,
  TicketMessage,
  TicketPriority,
  TicketSource,
  TicketStatus,
  User,
  LiveChatAgent,
  InboxFolder,
  ConversationScope,
  ConversationView,
} from "@/lib/types";
import {
  defaultInboxViewForRole,
  inboxViewsForRole,
} from "@/lib/inbox-navigation";
import {
  defaultLiveChatViewForRole,
  liveChatViewsForRole,
} from "@/lib/live-chat-navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import { TicketSourceBadge, TicketSourceIcon } from "@/lib/ticket-source";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatUserDisplayName, userInitials } from "@/lib/user-display";

const createSchema = z.object({
  ticket_title: z.string().min(1, "Title required").max(200),
  ticket_description: z.string().min(1, "Description required"),
});

type CreateForm = z.infer<typeof createSchema>;

function customerEmailFromTicket(ticket: Ticket) {
  const detailsEmail = ticket.details?.customerEmail?.trim();
  if (detailsEmail) return detailsEmail;

  const customer = ticket.peoples?.find((p) => p.role === "customer")?.user;
  if (customer && typeof customer === "object" && customer.email) return customer.email;

  if (ticket.createdBy && typeof ticket.createdBy === "object" && ticket.createdBy.email) {
    return ticket.createdBy.email;
  }

  return "";
}

function customerLabel(ticket: Ticket) {
  // Live-chat visitors identify by the email they entered — prefer that over stored first names.
  const email = customerEmailFromTicket(ticket);
  if ((ticket.source === "chatbot" || ticket.source === "chat") && email) return email;

  const customer = ticket.peoples?.find((p) => p.role === "customer")?.user;
  if (customer && typeof customer === "object") {
    return formatUserDisplayName(customer, email || "Customer");
  }
  if (ticket.createdBy && typeof ticket.createdBy === "object") {
    return formatUserDisplayName(ticket.createdBy, email || "Customer");
  }
  return email || "Customer";
}

function lastPreview(ticket: Ticket) {
  const last = ticket.messages?.[ticket.messages.length - 1];
  const raw = stripTicketSenderPrefix(last?.body ?? ticket.ticket_description ?? "");
  const plain = isMessageHtml(raw) ? messageHtmlToPlain(raw) : raw;
  return plain.replace(/\s+/g, " ").trim().slice(0, 120);
}

/** Apply a PATCH-shaped update to local ticket state so the UI can move before the network returns. */
function applyOptimisticTicketPatch(
  ticket: Ticket,
  patch: Record<string, unknown>,
  ctx: { agents: User[]; teams: Team[] },
): Ticket {
  const next: Ticket = {
    ...ticket,
    lastActivity: new Date().toISOString(),
  };

  if ("status" in patch && patch.status != null) {
    next.status = patch.status as TicketStatus;
  }
  if ("priority" in patch && patch.priority != null) {
    next.priority = patch.priority as TicketPriority;
  }
  if ("isUnread" in patch) {
    next.isUnread = Boolean(patch.isUnread);
  }
  if ("tags" in patch && Array.isArray(patch.tags)) {
    next.tags = patch.tags as string[];
  }
  if ("inboxFolder" in patch) {
    next.inboxFolder = patch.inboxFolder as InboxFolder;
  }
  if ("details" in patch && patch.details && typeof patch.details === "object") {
    next.details = {
      ...(ticket.details || {}),
      ...(patch.details as TicketDetails),
    };
  }
  if ("assigned_agent" in patch) {
    const id = patch.assigned_agent as string | null | undefined;
    if (!id) {
      next.assigned_agent = undefined;
    } else {
      next.assigned_agent =
        ctx.agents.find((agent) => agent._id === id) ||
        (ticket.assigned_agent &&
        typeof ticket.assigned_agent === "object" &&
        ticket.assigned_agent._id === id
          ? ticket.assigned_agent
          : undefined);
    }
  }
  if ("teams" in patch) {
    const ids = Array.isArray(patch.teams) ? (patch.teams as string[]) : [];
    next.teams = ids
      .map((id) => ctx.teams.find((team) => team._id === id))
      .filter((team): team is Team => Boolean(team));
  }

  return next;
}

/** Agent / AI replies sit on the right; customer messages on the left. */
function isSystemMessage(msg: TicketMessage) {
  return Boolean(msg.isSystem || msg.contentType === "system_event");
}

function isOutboundMessage(msg: TicketMessage, currentUserId?: string) {
  if (isSystemMessage(msg)) return false;
  if (msg.isAi) return true;
  const email = String(msg.senderEmail || "").toLowerCase();
  if (email.includes("bot@agentra")) return true;
  if (email.includes("system@agentra")) return false;

  if (typeof msg.sender === "object" && msg.sender) {
    if (currentUserId && msg.sender._id === currentUserId) return true;
    if (["agent", "admin", "owner"].includes(msg.sender.role)) return true;
  }

  return false;
}

/** Staff profile picture for their bubbles — AI and customer bubbles keep initials. */
function messageSenderAvatar(msg: TicketMessage) {
  if (isSystemMessage(msg) || msg.isAi) return "";
  const sender = typeof msg.sender === "object" ? msg.sender : null;
  if (!sender || sender.role === "customer") return "";
  return sender.avatar || "";
}

function messageSenderLabel(msg: TicketMessage) {
  if (isSystemMessage(msg)) return "System";
  if (msg.isAi || String(msg.senderEmail || "").toLowerCase().includes("bot@agentra")) {
    const named =
      msg.senderName?.trim() ||
      extractTicketSenderPrefix(msg.body) ||
      "";
    if (named && !/customer|visitor/i.test(named)) {
      return named;
    }
    return "Support Assistant";
  }

  const email =
    msg.senderEmail ||
    (typeof msg.sender === "object" && msg.sender ? msg.sender.email : "") ||
    "";

  // Customer / visitor bubbles: show the email they entered, not a stored first name.
  if (typeof msg.sender === "object" && msg.sender?.role === "customer") {
    return email || formatUserDisplayName(msg.sender, "Customer");
  }
  if (email && !["agent", "admin", "owner"].includes(
    typeof msg.sender === "object" && msg.sender ? msg.sender.role : "",
  )) {
    return email;
  }

  if (typeof msg.sender === "object" && msg.sender) {
    return formatUserDisplayName(msg.sender, email || "Agent");
  }
  return email || "Unknown";
}

// Channel filters shared by Inbox + AI Agent (ownership decides which surface lists them).
const CHANNEL_FILTERS: { id: string; label: string; source?: TicketSource }[] = [
  { id: "all", label: "All channels" },
  { id: "email", label: "Email", source: "email" },
  { id: "live_chat", label: "Live chat", source: "chatbot" },
  { id: "facebook", label: "Facebook", source: "facebook" },
  { id: "instagram", label: "Instagram", source: "instagram" },
  { id: "whatsapp", label: "WhatsApp", source: "whatsapp" },
];

function formatRelative(str: string) {
  const diff = Date.now() - new Date(str).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(str).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatMessageTime(str?: string) {
  if (!str) return "";
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameDay = date.toDateString() === new Date().toDateString();
  if (sameDay) return time;
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${time}`;
}

// Whether to show a centered time divider before a message (start, new day,
// or a gap of more than ~15 minutes since the previous one).
function hasTimeGap(prev?: string, current?: string) {
  if (!prev || !current) return true;
  const a = new Date(prev);
  const b = new Date(current);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  if (a.toDateString() !== b.toDateString()) return true;
  return b.getTime() - a.getTime() > 15 * 60 * 1000;
}

function systemEventLabel(msg: TicketMessage) {
  return String(msg.body || "")
    .replace(/^\[System\]\s*/i, "")
    .replace(/^\[system\]\s*/i, "")
    .trim();
}

function isLiveChatScope(scope: ConversationScope) {
  return scope === "live_chat" || scope === "ai_agents";
}

function isLiveChatTicket(ticket: Ticket) {
  return ticket.source === "chatbot" || ticket.source === "chat";
}

function defaultViewForScope(scope: ConversationScope, role: string): ConversationView {
  return isLiveChatScope(scope) ? defaultLiveChatViewForRole(role) : defaultInboxViewForRole(role);
}

function viewsForScope(scope: ConversationScope, role: string) {
  return isLiveChatScope(scope) ? liveChatViewsForRole(role) : inboxViewsForRole(role);
}

type ConversationWorkspaceProps = {
  scope: ConversationScope;
};

export function ConversationWorkspace({ scope }: ConversationWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const confirm = useConfirm();
  const selectedCode = searchParams.get("ticket");

  const role = user?.role ?? "customer";
  const isStaff = ["owner", "admin", "manager", "agent"].includes(role);
  const isOwner = role === "owner";
  const isLiveChat = isLiveChatScope(scope);
  const basePath = isLiveChat ? "/ai-agent" : "/inbox";
  const sidebarViews = viewsForScope(scope, role);

  const [view, setView] = useState<ConversationView>(() => defaultViewForScope(scope, role));
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [viewCounts, setViewCounts] = useState<Partial<Record<ConversationView, number>>>({});
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [msgBody, setMsgBody] = useState("");
  const [sending, setSending] = useState(false);
  const [toolbarBusy, setToolbarBusy] = useState(false);
  const [agents, setAgents] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [newCount, setNewCount] = useState(0);

  const messagesRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const prevTicketRef = useRef<string | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = messagesRef.current;
    if (container) container.scrollTo({ top: container.scrollHeight, behavior });
  }, []);

  const jumpToLatest = useCallback(() => {
    scrollToBottom("smooth");
    setNewCount(0);
  }, [scrollToBottom]);

  const handleMessagesScroll = useCallback(() => {
    const container = messagesRef.current;
    if (!container) return;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (nearBottom) setNewCount(0);
  }, []);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  });

  const apiScope = isLiveChat ? "live_chat" : scope;

  const fetchCounts = useCallback(async () => {
    if (!isStaff) return;
    try {
      const { data } = await ticketApi.inboxCounts(apiScope);
      setViewCounts(data.data.counts ?? {});
    } catch {
      setViewCounts({});
    }
  }, [isStaff, apiScope]);

  const fetchTickets = useCallback(async (silent = false) => {
    if (!silent) setLoadingList(true);
    try {
      const params: Record<string, unknown> = { limit: 50, view, scope: apiScope };
      if (search) params.search = search;
      if (channelFilter !== "all") {
        params.channel = channelFilter === "live_chat" ? "chatbot" : channelFilter;
      }

      const { data } = await ticketApi.list(params);
      setTickets(data.data.tickets);
    } catch {
      if (!silent) toast.error(isLiveChat ? "Failed to load AI Agent" : "Failed to load inbox");
    } finally {
      if (!silent) setLoadingList(false);
    }
  }, [search, view, apiScope, isLiveChat, channelFilter]);

  const fetchTicketDetail = useCallback(async (code: string, silent = false) => {
    if (!silent) setLoadingDetail(true);
    try {
      const { data } = await ticketApi.get(code);
      const ticket = data.data.ticket as Ticket;
      setActiveTicket((prev) => {
        // Avoid needless re-renders when nothing changed (keeps chat scroll steady).
        if (
          silent &&
          prev &&
          prev.ticket_code === ticket.ticket_code &&
          (prev.messages?.length ?? 0) === (ticket.messages?.length ?? 0) &&
          prev.lastActivity === ticket.lastActivity &&
          prev.status === ticket.status &&
          prev.priority === ticket.priority &&
          prev.isUnread === ticket.isUnread &&
          String(
            typeof prev.assigned_agent === "object"
              ? prev.assigned_agent?._id
              : prev.assigned_agent || "",
          ) ===
            String(
              typeof ticket.assigned_agent === "object"
                ? ticket.assigned_agent?._id
                : ticket.assigned_agent || "",
            )
        ) {
          return prev;
        }
        return ticket;
      });
      if (isStaff && ticket.isUnread) {
        void ticketApi.update(code, { isUnread: false });
      }
    } catch {
      if (!silent) {
        toast.error("Could not load conversation");
        setActiveTicket(null);
      }
    } finally {
      if (!silent) setLoadingDetail(false);
    }
  }, [isStaff]);

  useEffect(() => {
    if (!isStaff) return;

    const applyStaffList = (users: User[]) => {
      setAgents(
        role === "agent"
          ? users.filter((member) => ["admin", "manager", "agent"].includes(member.role))
          : users,
      );
    };

    const loadAgents = async () => {
      try {
        if (isLiveChat) {
          try {
            const { data } = await liveChatApi.getSettings();
            const configured = (data.data.liveChat?.agents ?? []) as LiveChatAgent[];
            if (configured.length > 0) {
              setAgents(
                configured.map((a) => ({
                  _id: a._id,
                  firstName: a.firstName,
                  lastName: a.lastName,
                  fullName: a.fullName,
                  email: "",
                  role: (a.role || "agent") as User["role"],
                  avatar: a.avatar,
                  company: "",
                  isEmailVerified: true,
                  isActive: true,
                  isOnline: a.isOnline,
                })),
              );
              return;
            }
          } catch {
            // Agents (and others without live-chat settings access) fall back to member search.
          }
        }

        const { data } =
          role === "agent"
            ? await usersApi.searchMembers("", undefined, 1, 100)
            : await usersApi.searchStaff("", 1, 100);
        applyStaffList((data.data.users ?? []) as User[]);
      } catch {
        setAgents([]);
      }
    };

    void loadAgents();

    teamApi.list({ limit: 100 }).then(({ data }) => {
      setTeams(data.data.teams ?? []);
    }).catch(() => setTeams([]));
  }, [isStaff, role, isLiveChat]);

  useEffect(() => {
    fetchTickets();
    void fetchCounts();
  }, [fetchTickets, fetchCounts]);

  useEffect(() => {
    if (!sidebarViews.some((item) => item.id === view)) {
      setView(defaultViewForScope(scope, role));
    }
  }, [role, sidebarViews, view, scope]);

  useEffect(() => {
    setView(defaultViewForScope(scope, role));
  }, [scope, role]);

  useEffect(() => {
    if (selectedCode) {
      fetchTicketDetail(selectedCode);
    } else {
      setActiveTicket(null);
    }
  }, [selectedCode, fetchTicketDetail]);

  // Track message growth: auto-scroll when already at the bottom, otherwise
  // surface a "N new messages" pill the agent can click to jump down.
  const messageCount = activeTicket?.messages?.length ?? 0;
  const activeCode = activeTicket?.ticket_code ?? null;
  useEffect(() => {
    if (activeCode !== prevTicketRef.current) {
      prevTicketRef.current = activeCode;
      prevCountRef.current = messageCount;
      setNewCount(0);
      requestAnimationFrame(() => scrollToBottom("auto"));
      return;
    }

    if (messageCount > prevCountRef.current) {
      const added = messageCount - prevCountRef.current;
      const container = messagesRef.current;
      const nearBottom = container
        ? container.scrollHeight - container.scrollTop - container.clientHeight < 160
        : true;

      if (nearBottom) {
        requestAnimationFrame(() => scrollToBottom("smooth"));
        setNewCount(0);
      } else {
        setNewCount((count) => count + added);
      }
    }
    prevCountRef.current = messageCount;
  }, [messageCount, activeCode, scrollToBottom]);

  // Background polling so new inbound messages / tickets appear without a manual reload.
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void fetchTickets(true);
      void fetchCounts();
      if (selectedCode) void fetchTicketDetail(selectedCode, true);
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchTickets, fetchCounts, fetchTicketDetail, selectedCode]);

  const selectTicket = (code: string) => {
    router.replace(`${basePath}?ticket=${code}`, { scroll: false });
  };

  const refreshInbox = async () => {
    await Promise.all([fetchTickets(), fetchCounts()]);
  };

  const moveToFolder = async (folder: InboxFolder) => {
    if (!activeTicket) return;
    const code = activeTicket.ticket_code;
    const prevTicket = activeTicket;
    const prevList = tickets;
    const labels: Record<InboxFolder, string> = {
      inbox: "Moved to inbox",
      snoozed: "Conversation snoozed",
      trash: "Moved to trash",
      spam: "Marked as spam",
    };
    const leavesCurrentView = folder !== "inbox" && folder !== view;

    const optimistic = applyOptimisticTicketPatch(
      activeTicket,
      { inboxFolder: folder },
      { agents, teams },
    );
    setActiveTicket(optimistic);
    setTickets((list) =>
      leavesCurrentView
        ? list.filter((ticket) => ticket.ticket_code !== code)
        : list.map((ticket) =>
            ticket.ticket_code === code
              ? applyOptimisticTicketPatch(ticket, { inboxFolder: folder }, { agents, teams })
              : ticket,
          ),
    );
    toast.success(labels[folder]);
    if (leavesCurrentView) {
      router.replace(basePath, { scroll: false });
    }

    try {
      await ticketApi.update(code, { inboxFolder: folder });
      void fetchTickets(true);
      void fetchCounts();
      if (!leavesCurrentView) {
        void fetchTicketDetail(code, true);
      }
    } catch {
      setActiveTicket(prevTicket);
      setTickets(prevList);
      toast.error("Could not update conversation");
    }
  };

  const onCreateSubmit = async (values: CreateForm) => {
    setCreating(true);
    try {
      const { data } = await ticketApi.create(values);
      toast.success("Conversation created");
      setCreateOpen(false);
      reset();
      await refreshInbox();
      selectTicket(data.data.ticket.ticket_code);
    } catch {
      toast.error("Failed to create conversation");
    } finally {
      setCreating(false);
    }
  };

  const sendMessage = async (payload?: { body: string; attachments?: Attachment[] }) => {
    const body = payload?.body ?? msgBody;
    const messageAttachments = payload?.attachments ?? [];
    if (!activeTicket || (!messageHtmlToPlain(body) && messageAttachments.length === 0)) return;

    const ticketCode = activeTicket.ticket_code;
    setSending(true);

    // Optimistically show the reply straight away so the thread feels instant.
    const optimistic: TicketMessage = {
      _id: `tmp-${Date.now()}`,
      sender: user as User,
      senderEmail: user?.email,
      body,
      attachments: messageAttachments,
      isInternal: false,
      sentAt: new Date().toISOString(),
    };
    setActiveTicket((prev) =>
      prev && prev.ticket_code === ticketCode
        ? { ...prev, messages: [...(prev.messages ?? []), optimistic], lastActivity: optimistic.sentAt }
        : prev,
    );
    setMsgBody("");

    try {
      await ticketApi.addMessage(ticketCode, { body, attachments: messageAttachments });
      // Reconcile silently with the server copy (replaces the temp message).
      void fetchTicketDetail(ticketCode, true);
      void fetchTickets(true);
      void fetchCounts();
    } catch {
      toast.error("Failed to send reply");
      void fetchTicketDetail(ticketCode, true);
    } finally {
      setSending(false);
    }
  };

  const patchTicket = async (
    patch: Record<string, unknown>,
    successMessage?: string,
  ) => {
    if (!activeTicket) return false;
    const code = activeTicket.ticket_code;
    const prevTicket = activeTicket;
    const prevList = tickets;
    const optimistic = applyOptimisticTicketPatch(activeTicket, patch, { agents, teams });

    setActiveTicket(optimistic);
    setTickets((list) =>
      list.map((ticket) =>
        ticket.ticket_code === code
          ? applyOptimisticTicketPatch(ticket, patch, { agents, teams })
          : ticket,
      ),
    );
    if (successMessage) toast.success(successMessage);

    try {
      await ticketApi.update(code, patch);
      void fetchTicketDetail(code, true);
      void fetchTickets(true);
      void fetchCounts();
      return true;
    } catch {
      setActiveTicket(prevTicket);
      setTickets(prevList);
      toast.error("Could not update conversation");
      return false;
    }
  };

  const updateStatus = async (status: TicketStatus) => {
    if (!activeTicket) return;
    const previousStatus = activeTicket.status;
    const code = activeTicket.ticket_code;
    const draftReply = messageHtmlToPlain(msgBody);

    // Paint the new status immediately; resolution quality check runs after.
    const ok = await patchTicket({ status });
    if (!ok) return;

    if (status !== "resolved" && status !== "closed") return;

    try {
      const { data } = await ticketAiApi.checkResolution(code, { draftReply });
      const issues = (data.data.issues || []) as Array<{ severity?: string; message?: string }>;
      const high = issues.filter((i) => i.severity === "high");
      if (high.length || (issues.length && data.data.ok === false)) {
        const lines = issues
          .slice(0, 4)
          .map((i) => `• ${i.message}`)
          .join("\n");
        const keep = await confirm({
          title: "Resolution check found issues",
          description: `${lines}\n\nKeep this conversation ${status === "resolved" ? "resolved" : "closed"}?`,
          confirmLabel: status === "resolved" ? "Keep resolved" : "Keep closed",
          cancelLabel: "Undo",
          variant: "default",
        });
        if (!keep) {
          await patchTicket({ status: previousStatus });
        }
      } else if (issues.length) {
        toast.message("Resolution notes", {
          description: issues[0]?.message || "Review before closing if needed.",
        });
      }
    } catch {
      // Don't undo a successful resolve if the check fails.
    }
  };

  const updatePriority = async (priority: TicketPriority) => {
    await patchTicket({ priority });
  };

  const assignAgent = async (agentId: string | null) => {
    await patchTicket({ assigned_agent: agentId });
  };

  const assignTeam = async (teamId: string | null) => {
    await patchTicket({ teams: teamId ? [teamId] : [] });
  };

  const markUnread = async () => {
    await patchTicket({ isUnread: true });
  };

  const transferTicket = async (agent: User) => {
    // Include the target so the assignee paints immediately even if the agents list is stale.
    if (!activeTicket) return;
    const code = activeTicket.ticket_code;
    const prevTicket = activeTicket;
    const prevList = tickets;
    const patch = { assigned_agent: agent._id };
    const ctx = { agents: [...agents, agent], teams };
    const optimistic = {
      ...applyOptimisticTicketPatch(activeTicket, patch, ctx),
      assigned_agent: agent,
    };

    setActiveTicket(optimistic);
    setTickets((list) =>
      list.map((ticket) =>
        ticket.ticket_code === code
          ? { ...applyOptimisticTicketPatch(ticket, patch, ctx), assigned_agent: agent }
          : ticket,
      ),
    );
    toast.success(`Transferred to ${formatUserDisplayName(agent)}`);

    try {
      await ticketApi.update(code, patch);
      void fetchTicketDetail(code, true);
      void fetchTickets(true);
      void fetchCounts();
    } catch {
      setActiveTicket(prevTicket);
      setTickets(prevList);
      toast.error("Could not update conversation");
    }
  };

  const updateTicketDetails = async (details: Partial<TicketDetails>) => {
    if (!activeTicket) return;
    const code = activeTicket.ticket_code;
    const prevTicket = activeTicket;
    const prevList = tickets;
    const mergedDetails = { ...(activeTicket.details || {}), ...details };
    const optimistic = applyOptimisticTicketPatch(
      activeTicket,
      { details: mergedDetails },
      { agents, teams },
    );

    setActiveTicket(optimistic);
    setTickets((list) =>
      list.map((ticket) =>
        ticket.ticket_code === code
          ? applyOptimisticTicketPatch(ticket, { details: mergedDetails }, { agents, teams })
          : ticket,
      ),
    );

    try {
      await ticketApi.update(code, { details: mergedDetails });
      void fetchTicketDetail(code, true);
    } catch {
      setActiveTicket(prevTicket);
      setTickets(prevList);
      toast.error("Could not save details");
    }
  };

  const updateTicketTags = async (tags: string[]) => {
    await patchTicket({ tags });
  };

  const printTicket = () => {
    window.print();
  };

  const emailTranscript = async () => {
    if (!activeTicket) return;
    setToolbarBusy(true);
    try {
      const { data } = await ticketApi.emailTranscript(activeTicket.ticket_code, {
        force: true,
      });
      const payload = data.data;
      if (payload?.skipped) {
        toast.message("Transcript was already emailed", {
          description: payload.to ? `Previously sent to ${payload.to}` : undefined,
        });
      } else {
        toast.success(
          payload?.to
            ? `Transcript emailed to ${payload.to}`
            : "Conversation transcript emailed",
        );
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not email transcript";
      toast.error(message);
    } finally {
      setToolbarBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {sidebarOpen ? (
          <aside className="flex w-[220px] shrink-0 flex-col border-r border-border/70 bg-muted/15">
            {!isLiveChat ? (
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Conversations</h2>
                {!isOwner ? (
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setCreateOpen(true)}>
                    <Plus className="size-4" />
                  </Button>
                ) : null}
              </div>
            ) : (
              <span className="sr-only">AI Agent views</span>
            )}
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
              {sidebarViews.map((v) => {
                const Icon = v.icon;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setView(v.id);
                      router.replace(basePath, { scroll: false });
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors",
                      view === v.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon className="size-4 shrink-0 opacity-80" />
                      <span className="truncate">{v.label}</span>
                    </span>
                    {isStaff ? (
                      <span className="text-xs tabular-nums opacity-70">
                        {viewCounts[v.id] ?? 0}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </aside>
        ) : null}

        <section className="flex min-w-0 flex-1 flex-col border-r border-border/70">
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              aria-label={sidebarOpen ? "Hide views" : "Show views"}
            >
              {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
            </button>
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="h-9 pl-8 pr-9"
              />
              <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="Filter by channel"
                    className={cn(
                      "absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md transition-colors hover:bg-muted",
                      channelFilter !== "all" ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <ListFilter className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Filter by channel</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {CHANNEL_FILTERS.map((option) => (
                        <DropdownMenuItem
                          key={option.id}
                          onClick={() => setChannelFilter(option.id)}
                          className="gap-2"
                        >
                          {option.source ? (
                            <TicketSourceIcon source={option.source} />
                          ) : (
                            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/40">
                              <Inbox className="size-3" />
                            </span>
                          )}
                          <span className="flex-1 truncate">{option.label}</span>
                          {channelFilter === option.id ? (
                            <Check className="size-4 text-primary" />
                          ) : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
            {channelFilter !== "all" ? (
              <Badge
                variant="secondary"
                className="hidden h-9 items-center gap-1 whitespace-nowrap px-2.5 sm:inline-flex"
              >
                {CHANNEL_FILTERS.find((c) => c.id === channelFilter)?.label}
                <button
                  type="button"
                  aria-label="Clear channel filter"
                  onClick={() => setChannelFilter("all")}
                  className="rounded-full p-0.5 hover:bg-background/60"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ) : null}
            <Button variant="outline" size="sm" className="h-9" onClick={() => void refreshInbox()}>
              <RefreshCw className="size-3.5" />
            </Button>
            {!isOwner && !isLiveChat ? (
              <Button size="sm" className="h-9" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 size-3.5" />
                New
              </Button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="flex justify-center py-16">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                {isLiveChat ? (
                  <Sparkles className="mb-3 size-10 text-muted-foreground/70" strokeWidth={1.5} />
                ) : (
                  <Inbox className="mb-3 size-10 text-muted-foreground/70" />
                )}
                <p className="text-sm font-medium text-foreground">
                  {isLiveChat ? "No AI Agent conversations to show here" : "No conversations to show here"}
                </p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  {isStaff
                    ? isLiveChat
                      ? "AI-owned threads across email, chat, and social appear here until they are handed to a human agent."
                      : search || channelFilter !== "all"
                        ? "Try adjusting your search or channel filter."
                        : "Human-owned conversations, including live chat after handoff, appear here."
                    : "When you open a support request it will appear here."}
                </p>
              </div>
            ) : (
              tickets.map((ticket) => {
                const selected = ticket.ticket_code === selectedCode;
                return (
                  <button
                    key={ticket._id}
                    type="button"
                    onClick={() => selectTicket(ticket.ticket_code)}
                    className={cn(
                      "flex w-full flex-col gap-1 border-b border-border/40 px-4 py-3 text-left transition-colors",
                      selected ? "bg-primary/5" : "hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-semibold text-foreground">
                        {ticket.ticket_title}
                      </p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatRelative(ticket.lastActivity || ticket.createdAt)}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{lastPreview(ticket)}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2.5 truncate text-xs text-muted-foreground">
                        <TicketSourceIcon source={ticket.source} />
                        <span className="truncate">{customerLabel(ticket)}</span>
                      </span>
                      <Badge className={STATUS_COLORS[ticket.status]} variant="secondary">
                        {STATUS_LABELS[ticket.status]}
                      </Badge>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="hidden min-w-0 flex-[1.4] flex-col lg:flex">
          {!selectedCode ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <Mail className="size-10 text-muted-foreground/70" />
              <p className="text-sm font-medium text-foreground">Select a conversation</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Choose a thread from the list to read messages and reply.
              </p>
            </div>
          ) : loadingDetail || !activeTicket ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-foreground">
                      {activeTicket.ticket_title}
                    </h3>
                    {activeTicket.isUnread ? (
                      <span className="size-2 rounded-full bg-primary" title="Unread" />
                    ) : null}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{activeTicket.ticket_code}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => router.replace(basePath, { scroll: false })}
                >
                  <X className="size-4" />
                </Button>
              </div>

              {isStaff ? (
                isLiveChat ? (
                  <LiveChatTicketToolbar
                    ticket={activeTicket}
                    currentUser={user}
                    agents={agents}
                    teams={teams}
                    busy={toolbarBusy}
                    onPriorityChange={updatePriority}
                    onAssign={assignAgent}
                    onTeamChange={assignTeam}
                    onStatusChange={updateStatus}
                    onMarkUnread={() => void markUnread()}
                    onTrash={() => void moveToFolder("trash")}
                    onTransfer={(agent) => void transferTicket(agent)}
                    onPrint={printTicket}
                    onEmailTranscript={() => void emailTranscript()}
                  />
                ) : (
                  <InboxTicketToolbar
                    ticket={activeTicket}
                    currentUser={user}
                    agents={agents}
                    teams={teams}
                    busy={toolbarBusy}
                    onPriorityChange={updatePriority}
                    onAssign={assignAgent}
                    onTeamChange={assignTeam}
                    onStatusChange={updateStatus}
                    onSnooze={() => void moveToFolder("snoozed")}
                    onUnsnooze={() => void moveToFolder("inbox")}
                    onMarkUnread={() => void markUnread()}
                    onMarkSpam={() => void moveToFolder("spam")}
                    onTrash={() => void moveToFolder("trash")}
                    onTransfer={(agent) => void transferTicket(agent)}
                    onPrint={printTicket}
                  />
                )
              ) : null}

              <div className="relative min-h-0 flex-1">
              <div
                ref={messagesRef}
                onScroll={handleMessagesScroll}
                className="h-full space-y-4 overflow-y-auto px-4 py-4 print:px-0"
              >
                {activeTicket.messages?.map((msg: TicketMessage, index) => {
                  const prev = activeTicket.messages?.[index - 1];
                  const showDivider = index === 0 || hasTimeGap(prev?.sentAt, msg.sentAt);

                  if (isSystemMessage(msg)) {
                    const label = systemEventLabel(msg);
                    if (!label) return null;
                    return (
                      <Fragment key={msg._id}>
                        {showDivider && msg.sentAt ? (
                          <div className="flex justify-center py-1">
                            <span className="text-[11px] font-medium text-muted-foreground/60">
                              {formatMessageTime(msg.sentAt)}
                            </span>
                          </div>
                        ) : null}
                        <div className="flex justify-center px-2 py-1">
                          <span className="max-w-[90%] rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-center text-[11px] font-medium text-muted-foreground">
                            {label}
                          </span>
                        </div>
                      </Fragment>
                    );
                  }

                  const sender = messageSenderLabel(msg);
                  const isOutbound = isOutboundMessage(msg, user?._id);
                  return (
                    <Fragment key={msg._id}>
                      {showDivider && msg.sentAt ? (
                        <div className="flex justify-center py-1">
                          <span className="text-[11px] font-medium text-muted-foreground/60">
                            {formatMessageTime(msg.sentAt)}
                          </span>
                        </div>
                      ) : null}
                      <div className={cn("group flex items-center gap-3", isOutbound && "flex-row-reverse")}>
                        <Avatar className="size-8 shrink-0 self-end">
                          {messageSenderAvatar(msg) ? (
                            <AvatarImage src={messageSenderAvatar(msg)} alt={sender} />
                          ) : null}
                          <AvatarFallback className="bg-muted text-xs">
                            {userInitials(sender)}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={cn(
                            "max-w-[85%] rounded-[10px] border px-3 py-2.5 text-sm",
                            isOutbound ? "border-primary/20 bg-primary/8" : "border-border/60 bg-muted/30",
                          )}
                        >
                          <p className="mb-1 text-xs font-medium text-muted-foreground">{sender}</p>
                          <FormattedMessageBody body={msg.body} attachments={msg.attachments} />
                        </div>
                        {msg.sentAt ? (
                          <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100">
                            {formatMessageTime(msg.sentAt)}
                          </span>
                        ) : null}
                      </div>
                    </Fragment>
                  );
                })}
              </div>

                {newCount > 0 ? (
                  <button
                    type="button"
                    onClick={jumpToLatest}
                    className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border/60 bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg transition-transform hover:scale-[1.03]"
                  >
                    <ArrowDown className="size-3.5" />
                    {newCount} new message{newCount > 1 ? "s" : ""}
                  </button>
                ) : null}
              </div>

              <InboxReplyComposer
                value={msgBody}
                onChange={setMsgBody}
                sending={sending}
                ticketCode={activeTicket.ticket_code}
                onSend={(payload) => void sendMessage(payload)}
              />
            </>
          )}
        </section>

        {activeTicket && isStaff ? (
          <InboxTicketDetailsPanel
            ticket={activeTicket}
            ticketCount={1}
            onUpdateDetails={(details) => void updateTicketDetails(details)}
            onUpdateTags={(tags) => void updateTicketTags(tags)}
            onUseSuggestedReply={(reply) => {
              const html = reply
                .split(/\n+/)
                .map((line) => `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
                .join("");
              setMsgBody(html || `<p>${reply}</p>`);
            }}
            onIntelligenceUpdated={(intelligence, meta) => {
              setActiveTicket((prev) =>
                prev
                  ? {
                      ...prev,
                      aiIntelligence: intelligence,
                      ...(meta?.priority ? { priority: meta.priority } : {}),
                      ...(meta?.tags ? { tags: meta.tags } : {}),
                      ...(meta?.details ? { details: { ...prev.details, ...meta.details } } : {}),
                    }
                  : prev,
              );
            }}
          />
        ) : activeTicket ? (
          <aside className="hidden w-[260px] shrink-0 flex-col border-l border-border/70 bg-muted/10 xl:flex">
            <div className="border-b border-border/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Customer
              </p>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {userInitials(customerLabel(activeTicket))}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{customerLabel(activeTicket)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {typeof activeTicket.createdBy === "object" ? activeTicket.createdBy.email : ""}
                  </p>
                </div>
              </div>
              {activeTicket.source ? (
                <TicketSourceBadge source={activeTicket.source} className="w-full justify-center" />
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      <Dialog open={createOpen && !isLiveChat} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New conversation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onCreateSubmit)} className="mt-2 space-y-4">
            <div className="space-y-1">
              <Label>Subject</Label>
              <Input {...register("ticket_title")} placeholder="What does the customer need?" />
              {errors.ticket_title ? (
                <p className="text-xs text-destructive">{errors.ticket_title.message}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>Message</Label>
              <Textarea
                {...register("ticket_description")}
                placeholder="Describe the request…"
                className="min-h-[100px]"
              />
              {errors.ticket_description ? (
                <p className="text-xs text-destructive">{errors.ticket_description.message}</p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InboxPage() {
  return <ConversationWorkspace scope="inbox" />;
}
