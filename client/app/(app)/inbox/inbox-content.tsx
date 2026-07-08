"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Inbox,
  Loader2,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { AiAgentIcon } from "@/components/icons/ai-agent-icon";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { InboxReplyComposer } from "@/components/inbox/inbox-reply-composer";
import { FormattedMessageBody } from "@/lib/format-message-body";
import { messageHtmlToPlain } from "@/lib/sanitize-message-html";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { InboxTicketToolbar } from "@/components/inbox/inbox-ticket-toolbar";
import { LiveChatTicketToolbar } from "@/components/inbox/ai-agent-ticket-toolbar";
import { InboxTicketDetailsPanel } from "@/components/inbox/inbox-ticket-details-panel";
import { ticketApi, teamApi, usersApi } from "@/lib/api";
import type {
  Attachment,
  Team,
  Ticket,
  TicketDetails,
  TicketMessage,
  TicketPriority,
  TicketStatus,
  User,
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
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import { TicketSourceBadge, TicketSourceIcon } from "@/lib/ticket-source";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const createSchema = z.object({
  ticket_title: z.string().min(1, "Title required").max(200),
  ticket_description: z.string().min(1, "Description required"),
});
type CreateForm = z.infer<typeof createSchema>;

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

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

function customerLabel(ticket: Ticket) {
  const customer = ticket.peoples?.find((p) => p.role === "customer")?.user;
  if (customer && typeof customer === "object") {
    return customer.fullName || `${customer.firstName} ${customer.lastName}`;
  }
  if (ticket.createdBy && typeof ticket.createdBy === "object") {
    return ticket.createdBy.fullName || ticket.createdBy.email;
  }
  return "Customer";
}

function lastPreview(ticket: Ticket) {
  const last = ticket.messages?.[ticket.messages.length - 1];
  return last?.body?.slice(0, 120) ?? ticket.ticket_description?.slice(0, 120) ?? "";
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
  const selectedCode = searchParams.get("ticket");

  const role = user?.role ?? "customer";
  const isStaff = ["owner", "admin", "agent"].includes(role);
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [msgBody, setMsgBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [toolbarBusy, setToolbarBusy] = useState(false);
  const [agents, setAgents] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

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

      const { data } = await ticketApi.list(params);
      setTickets(data.data.tickets);
    } catch {
      if (!silent) toast.error(isLiveChat ? "Failed to load AI Agent" : "Failed to load inbox");
    } finally {
      if (!silent) setLoadingList(false);
    }
  }, [search, view, apiScope, isLiveChat]);

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
          prev.lastActivity === ticket.lastActivity
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
    const loadAgents = role === "agent"
      ? usersApi.searchMembers("", undefined, 1, 100)
      : usersApi.searchStaff("", 1, 100);

    loadAgents.then(({ data }) => {
      const users = (data.data.users ?? []) as User[];
      setAgents(
        role === "agent"
          ? users.filter((member) => ["admin", "agent"].includes(member.role))
          : users,
      );
    }).catch(() => setAgents([]));

    teamApi.list({ limit: 100 }).then(({ data }) => {
      setTeams(data.data.teams ?? []);
    }).catch(() => setTeams([]));
  }, [isStaff, role]);

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

  // Background polling so new inbound messages / tickets appear without a manual reload.
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void fetchTickets(true);
      void fetchCounts();
      if (selectedCode) void fetchTicketDetail(selectedCode, true);
    }, 7000);
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
    try {
      await ticketApi.update(activeTicket.ticket_code, { inboxFolder: folder });
      const labels: Record<InboxFolder, string> = {
        inbox: "Moved to inbox",
        snoozed: "Conversation snoozed",
        trash: "Moved to trash",
        spam: "Marked as spam",
      };
      toast.success(labels[folder]);
      await refreshInbox();
      if (folder !== "inbox" && folder !== view) {
        router.replace(basePath, { scroll: false });
      } else {
        await fetchTicketDetail(activeTicket.ticket_code);
      }
    } catch {
      toast.error("Could not update conversation");
    }
  };

  const loadDemoTicket = async () => {
    setLoadingDemo(true);
    try {
      const { data } = await ticketApi.createDemo();
      const payload = data.data;
      const inboxCount = payload.inboxCount ?? 20;
      const liveChatCount = payload.liveChatCount ?? payload.aiAgentCount ?? 20;
      const created = payload.created ?? 0;
      toast.success(
        `Demo data ready: ${inboxCount} inbox + ${liveChatCount} AI Agent conversations (${created} new)`,
      );
      const tickets = (payload.tickets ?? [payload.ticket]).filter(Boolean);
      setView(isLiveChat ? "queue" : "all");
      await refreshInbox();
      const preferred = isLiveChat
        ? tickets.find((ticket: Ticket) => isLiveChatTicket(ticket)) ?? tickets[0]
        : tickets.find((ticket: Ticket) => !isLiveChatTicket(ticket)) ?? tickets[0];
      if (preferred?.ticket_code) {
        selectTicket(preferred.ticket_code);
      }
    } catch {
      toast.error("Could not load demo conversation");
    } finally {
      setLoadingDemo(false);
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
    setSending(true);
    try {
      await ticketApi.addMessage(activeTicket.ticket_code, {
        body,
        attachments: messageAttachments,
      });
      setMsgBody("");
      await fetchTicketDetail(activeTicket.ticket_code);
      await refreshInbox();
      toast.success("Reply sent");
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const patchTicket = async (
    patch: Record<string, unknown>,
    successMessage?: string,
  ) => {
    if (!activeTicket) return false;
    setToolbarBusy(true);
    try {
      await ticketApi.update(activeTicket.ticket_code, patch);
      await fetchTicketDetail(activeTicket.ticket_code);
      await refreshInbox();
      if (successMessage) toast.success(successMessage);
      return true;
    } catch {
      toast.error("Could not update conversation");
      return false;
    } finally {
      setToolbarBusy(false);
    }
  };

  const updateStatus = async (status: TicketStatus) => {
    await patchTicket({ status });
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
    const ok = await patchTicket(
      { assigned_agent: agent._id },
      `Transferred to ${agent.firstName} ${agent.lastName}`,
    );
    if (ok) return;
  };

  const updateTicketDetails = async (details: Partial<TicketDetails>) => {
    if (!activeTicket) return;
    setToolbarBusy(true);
    try {
      await ticketApi.update(activeTicket.ticket_code, {
        details: { ...activeTicket.details, ...details },
      });
      await fetchTicketDetail(activeTicket.ticket_code);
    } catch {
      toast.error("Could not save details");
    } finally {
      setToolbarBusy(false);
    }
  };

  const updateTicketTags = async (tags: string[]) => {
    await patchTicket({ tags });
  };

  const printTicket = () => {
    window.print();
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col bg-card">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {sidebarOpen ? (
          <aside className="flex w-[220px] shrink-0 flex-col border-r border-border/70 bg-muted/15">
            <div className={cn(
              "border-b border-border/60 px-4",
              isLiveChat ? "py-2" : "flex items-center justify-between py-3",
            )}>
              {!isLiveChat ? (
                <>
                  <h2 className="text-sm font-semibold text-foreground">Conversations</h2>
                  {!isOwner ? (
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setCreateOpen(true)}>
                      <Plus className="size-4" />
                    </Button>
                  ) : null}
                </>
              ) : (
                <span className="sr-only">AI Agent views</span>
              )}
            </div>
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
                className="h-9 pl-8"
              />
            </div>
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
                  <AiAgentIcon className="mb-3 size-10 text-muted-foreground/40" />
                ) : (
                  <Inbox className="mb-3 size-10 text-muted-foreground/40" />
                )}
                <p className="text-sm font-medium text-foreground">
                  {isLiveChat ? "No AI Agent conversations in this view" : "No conversations in this view"}
                </p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  {isStaff
                    ? isLiveChat
                      ? "Live chat is handled by AI first. Conversations appear here when a customer wants to speak with a person."
                      : "Start a new conversation or load a sample thread to preview the inbox."
                    : "When you open a support request it will appear here."}
                </p>
                {isStaff ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    disabled={loadingDemo}
                    onClick={() => void loadDemoTicket()}
                  >
                    {loadingDemo ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : isLiveChat ? (
                      <AiAgentIcon className="mr-2 size-4" />
                    ) : (
                      <Inbox className="mr-2 size-4" />
                    )}
                    {isLiveChat ? "Load demo conversations" : "Load demo conversation"}
                  </Button>
                ) : null}
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
              <Mail className="size-10 text-muted-foreground/40" />
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

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 print:px-0">
                {activeTicket.messages?.map((msg: TicketMessage) => {
                  const sender =
                    typeof msg.sender === "object"
                      ? msg.sender.fullName || msg.sender.email
                      : "Unknown";
                  const isMe = typeof msg.sender === "object" && msg.sender._id === user?._id;
                  return (
                    <div key={msg._id} className={cn("flex gap-3", isMe && "flex-row-reverse")}>
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className="bg-muted text-xs">{initials(sender)}</AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-[10px] border px-3 py-2.5 text-sm",
                          isMe ? "border-primary/20 bg-primary/8" : "border-border/60 bg-muted/30",
                        )}
                      >
                        <div
                          className={cn(
                            "mb-1 flex items-baseline gap-2",
                            isMe && "flex-row-reverse",
                          )}
                        >
                          <p className="text-xs font-medium text-muted-foreground">{sender}</p>
                          {msg.sentAt ? (
                            <span className="text-[10px] text-muted-foreground/70">
                              {formatMessageTime(msg.sentAt)}
                            </span>
                          ) : null}
                        </div>
                        <FormattedMessageBody body={msg.body} attachments={msg.attachments} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <InboxReplyComposer
                value={msgBody}
                onChange={setMsgBody}
                sending={sending}
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
                    {initials(customerLabel(activeTicket))}
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
