"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2, Send, Paperclip, ChevronLeft, Lock,
  UserPlus, UserMinus, X, RotateCcw, Building2, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ticketApi, departmentApi, teamApi, usersApi } from "@/lib/api";
import { Ticket, TicketMessage, TicketPerson, Department, Team, User } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/constants";
import UserPicker from "@/components/shared/UserPicker";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}
function formatDate(str: string) {
  return new Date(str).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function TicketDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [ticket,        setTicket]        = useState<Ticket | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [msgBody,       setMsgBody]       = useState("");
  const [isInternal,    setIsInternal]    = useState(false);
  const [sending,       setSending]       = useState(false);
  const [statusUpdating,setStatusUpdating]= useState(false);

  // People picker
  const [personPickerOpen, setPersonPickerOpen] = useState(false);
  const [removingPerson,   setRemovingPerson]   = useState<string | null>(null);
  const [personRole,       setPersonRole]       = useState<"customer" | "agent" | "cc">("agent");

  // Dept / team assignment
  const [departments,    setDepartments]    = useState<Department[]>([]);
  const [teams,          setTeams]          = useState<Team[]>([]);
  const [assigningDept,  setAssigningDept]  = useState(false);
  const [assigningTeam,  setAssigningTeam]  = useState(false);
  const [agentPickerOpen,setAgentPickerOpen]= useState(false);
  const [assigningAgent, setAssigningAgent] = useState(false);

  const isStaff    = ["owner", "admin", "manager", "agent"].includes(user?.role ?? "");
  const isCustomer = user?.role === "customer";

  const fetchTicket = async () => {
    try {
      const { data } = await ticketApi.get(code);
      setTicket(data.data.ticket);
    } catch {
      toast.error("Ticket not found");
      router.push("/tickets");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchTicket(); }, [code]); // eslint-disable-line

  // Load dept + team lists for staff assignment
  useEffect(() => {
    if (!isStaff) return;
    departmentApi.list({ limit: 100 }).then(({ data }) => setDepartments(data.data.departments)).catch(() => {});
    teamApi.list({ limit: 100 }).then(({ data }) => setTeams(data.data.teams)).catch(() => {});
  }, [isStaff]); // eslint-disable-line

  // ── Actions ────────────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!msgBody.trim()) return;
    setSending(true);
    try {
      await ticketApi.addMessage(code, { body: msgBody, isInternal });
      setMsgBody(""); setIsInternal(false);
      await fetchTicket();
      toast.success("Message sent");
    } catch { toast.error("Failed to send"); }
    finally { setSending(false); }
  };

  const updateStatus = async (status: string) => {
    setStatusUpdating(true);
    try {
      await ticketApi.update(code, { status });
      await fetchTicket();
      toast.success("Status updated");
    } catch { toast.error("Failed to update status"); }
    finally { setStatusUpdating(false); }
  };

  const closeTicket = async () => {
    setStatusUpdating(true);
    try {
      await ticketApi.close(code);
      await fetchTicket();
      toast.success("Ticket closed");
    } catch { toast.error("Failed to close"); }
    finally { setStatusUpdating(false); }
  };

  const reopenTicket = async () => {
    setStatusUpdating(true);
    try {
      await ticketApi.reopen(code);
      await fetchTicket();
      toast.success("Ticket reopened");
    } catch { toast.error("Failed to reopen"); }
    finally { setStatusUpdating(false); }
  };

  const handleAddPerson = async (u: User) => {
    try {
      await ticketApi.addPerson(code, { userId: u._id, role: personRole });
      toast.success(`${u.firstName} added to ticket`);
      await fetchTicket();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed";
      toast.error(msg);
    }
  };

  const handleRemovePerson = async (userId: string) => {
    setRemovingPerson(userId);
    try {
      await ticketApi.removePerson(code, userId);
      toast.success("Person removed");
      await fetchTicket();
    } catch { toast.error("Failed to remove"); }
    finally { setRemovingPerson(null); }
  };

  const handleAssignDept = async (deptId: string) => {
    setAssigningDept(true);
    try {
      await ticketApi.update(code, { department: deptId === "none" ? null : deptId });
      await fetchTicket();
      toast.success("Department updated");
    } catch { toast.error("Failed to update department"); }
    finally { setAssigningDept(false); }
  };

  const handleAssignTeam = async (teamId: string) => {
    setAssigningTeam(true);
    try {
      // Replace teams array with the selected single team (or clear)
      await ticketApi.update(code, { teams: teamId === "none" ? [] : [teamId] });
      await fetchTicket();
      toast.success("Team updated");
    } catch { toast.error("Failed to update team"); }
    finally { setAssigningTeam(false); }
  };

  const handleAssignAgent = async (u: User) => {
    setAssigningAgent(true);
    try {
      await ticketApi.update(code, { assigned_agent: u._id });
      await fetchTicket();
      toast.success(`Assigned to ${u.firstName} ${u.lastName}`);
    } catch { toast.error("Failed to assign agent"); }
    finally { setAssigningAgent(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!ticket) return null;

  const isClosed = ["closed", "self_closed", "resolved"].includes(ticket.status);
  const messages = isStaff ? ticket.messages : ticket.messages.filter((m) => !m.isInternal);
  const currentDeptId = ticket.department && typeof ticket.department === "object"
    ? ticket.department._id
    : (ticket.department as string | undefined) ?? "none";
  const currentTeamId = ticket.teams && ticket.teams.length > 0
    ? (typeof ticket.teams[0] === "object" ? ticket.teams[0]._id : ticket.teams[0] as string)
    : "none";

  const existingPeopleIds = ticket.peoples.map((p) => p.user._id);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back */}
      <button onClick={() => router.push("/tickets")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back to tickets
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 items-start">
        {/* ── Main column ───────────────────────────────────────────────────── */}
        <div className="space-y-5 min-w-0">
          {/* Header card */}
          <div className="bg-card rounded-xl border border-border/60 shadow-sm p-6 space-y-4">
            <div className="flex items-start gap-4 justify-between flex-wrap">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">{ticket.ticket_code}</span>
                  <Badge className={STATUS_COLORS[ticket.status]} variant="secondary">{STATUS_LABELS[ticket.status]}</Badge>
                  <Badge className={PRIORITY_COLORS[ticket.priority]} variant="secondary">{PRIORITY_LABELS[ticket.priority]}</Badge>
                </div>
                <h1 className="text-xl font-bold text-foreground">{ticket.ticket_title}</h1>
              </div>

              {/* Status actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {isStaff && !isClosed && (
                  <Select onValueChange={(v: string | null) => { if (v) updateStatus(v); }} disabled={statusUpdating}>
                    <SelectTrigger className="w-36 text-xs focus:ring-[#D85A30]">
                      <SelectValue placeholder="Change status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS)
                        .filter(([v]) => v !== "self_closed")
                        .map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {!isClosed && (
                  <Button variant="outline" size="sm" onClick={closeTicket} disabled={statusUpdating}>
                    <X className="h-3.5 w-3.5 mr-1" />
                    {isCustomer ? "Self-close" : "Close"}
                  </Button>
                )}
                {isStaff && isClosed && (
                  <Button variant="outline" size="sm" onClick={reopenTicket} disabled={statusUpdating}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reopen
                  </Button>
                )}
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{ticket.ticket_description}</p>

            {/* Meta row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-2 border-t border-border">
              <span>Created {formatDate(ticket.createdAt)}</span>
              <span>Last activity {formatDate(ticket.lastActivity)}</span>
              <span>By {ticket.createdBy?.firstName} {ticket.createdBy?.lastName}</span>
              {ticket.department && typeof ticket.department === "object" && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {ticket.department.name}
                </span>
              )}
              {ticket.teams && ticket.teams.length > 0 && typeof ticket.teams[0] === "object" && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {(ticket.teams[0] as Team).name}
                </span>
              )}
            </div>

            {/* Top-level attachments */}
            {ticket.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {ticket.attachments.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-muted/30 border border-border rounded-lg hover:bg-muted">
                    <Paperclip className="h-3 w-3 text-muted-foreground" /> {a.filename}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground/80">
              Conversation{" "}
              {isStaff && (
                <span className="text-xs font-normal text-muted-foreground">
                  Internal notes are staff-only
                </span>
              )}
            </h3>

            {messages.length === 0 && (
              <div className="bg-card rounded-xl border border-border/60 shadow-sm p-8 text-center text-sm text-muted-foreground">
                No messages yet. Start the conversation below.
              </div>
            )}

            {messages.map((msg: TicketMessage) => {
              const isMe = msg.sender?._id === user?._id;
              return (
                <div key={msg._id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs font-semibold"
                      style={{ background: isMe ? "#D85A30" : "#F3F4F6", color: isMe ? "white" : "#374151" }}>
                      {initials(msg.sender?.fullName ?? msg.senderEmail ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`flex-1 max-w-[80%] space-y-1 flex flex-col ${isMe ? "items-end" : ""}`}>
                    <div className={`flex items-baseline gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                      <span className="text-xs font-medium text-foreground/80">
                        {msg.sender?.firstName ?? msg.senderEmail}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(msg.sentAt)}</span>
                      {msg.isInternal && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          <Lock className="h-2.5 w-2.5" /> Internal
                        </span>
                      )}
                    </div>
                    <div
                      className={`px-4 py-3 rounded-xl text-sm whitespace-pre-wrap shadow-sm ${
                        msg.isInternal
                          ? "bg-amber-50 border border-amber-100 text-amber-900"
                          : isMe ? "text-white" : "bg-card border border-border/60 text-foreground/80"
                      }`}
                      style={isMe && !msg.isInternal ? { background: "#D85A30" } : {}}>
                      {msg.body}
                    </div>
                    {msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.attachments.map((a, i) => (
                          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs flex items-center gap-1 hover:underline text-primary">
                            <Paperclip className="h-3 w-3" /> {a.filename}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Reply / close */}
          {!isClosed ? (
            <div className="bg-card rounded-xl border border-border/60 shadow-sm p-4 space-y-3">
              <Textarea
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendMessage();
                }}
                placeholder={isInternal ? "Write an internal note…" : "Write a reply… (Ctrl+Enter to send)"}
                className={`min-h-[100px] resize-none focus-visible:ring-primary/30 ${isInternal ? "bg-amber-50 border-amber-200" : ""}`}
              />
              <div className="flex items-center justify-between flex-wrap gap-3">
                {isStaff ? (
                  <div className="flex items-center gap-2">
                    <Switch id="internal" checked={isInternal} onCheckedChange={setIsInternal} />
                    <Label htmlFor="internal" className="text-xs text-muted-foreground cursor-pointer">
                      Internal note
                    </Label>
                  </div>
                ) : <div />}
                <Button onClick={sendMessage} disabled={sending || !msgBody.trim()} size="sm">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  {isInternal ? "Add note" : "Send reply"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-muted/30 rounded-xl border border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">
                This ticket is <strong>{STATUS_LABELS[ticket.status]}</strong>.
                {isStaff && " You can reopen it from the button above."}
              </p>
            </div>
          )}
        </div>

        {/* ── Sidebar column (staff only) ───────────────────────────────────── */}
        {isStaff && (
          <div className="space-y-4">

            {/* Assign agent */}
            <div className="bg-card rounded-xl border border-border/60 shadow-sm p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assigned Agent</p>
              {ticket.assigned_agent ? (
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs font-bold bg-primary text-primary-foreground">
                      {initials(ticket.assigned_agent.firstName + " " + ticket.assigned_agent.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {ticket.assigned_agent.firstName} {ticket.assigned_agent.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{ticket.assigned_agent.email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Not assigned</p>
              )}
              <Button size="sm" variant="outline" className="w-full text-xs"
                onClick={() => setAgentPickerOpen(true)} disabled={assigningAgent}>
                {assigningAgent ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                {ticket.assigned_agent ? "Reassign" : "Assign agent"}
              </Button>
            </div>

            {/* Department */}
            <div className="bg-card rounded-xl border border-border/60 shadow-sm p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Department</p>
              <Select
                value={currentDeptId}
                onValueChange={(v: string | null) => { if (v) handleAssignDept(v); }}
                disabled={assigningDept}
              >
                <SelectTrigger className="text-sm focus:ring-[#D85A30]">
                  {assigningDept ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SelectValue placeholder="None" />}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {departments.map((d) => <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Team */}
            <div className="bg-card rounded-xl border border-border/60 shadow-sm p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Team</p>
              <Select
                value={currentTeamId}
                onValueChange={(v: string | null) => { if (v) handleAssignTeam(v); }}
                disabled={assigningTeam}
              >
                <SelectTrigger className="text-sm focus:ring-[#D85A30]">
                  {assigningTeam ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SelectValue placeholder="None" />}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {teams.map((t) => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* People */}
            <div className="bg-card rounded-xl border border-border/60 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">People</p>
                <div className="flex items-center gap-1.5">
                  {/* Role selector for next add */}
                  <select
                    value={personRole}
                    onChange={(e) => setPersonRole(e.target.value as typeof personRole)}
                    className="text-xs border border-border rounded-lg px-1.5 py-1 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D85A30]"
                  >
                    <option value="agent">agent</option>
                    <option value="customer">customer</option>
                    <option value="cc">cc</option>
                  </select>
                  <button
                    onClick={() => setPersonPickerOpen(true)}
                    className="flex items-center gap-1 text-xs font-medium hover:underline text-primary"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
              </div>

              {ticket.peoples.length === 0 ? (
                <p className="text-xs text-muted-foreground">No people added yet</p>
              ) : (
                <div className="space-y-2">
                  {ticket.peoples.map((p: TicketPerson, i: number) => (
                    <div key={i} className="flex items-center gap-2 group">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-[10px] font-bold"
                          style={{ background: "#FDEBE4", color: "#D85A30" }}>
                          {initials(p.user?.fullName ?? p.user?.firstName ?? "?")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate leading-tight">
                          {p.user?.firstName} {p.user?.lastName}
                        </p>
                        <p className="text-[10px] text-muted-foreground capitalize">{p.role}</p>
                      </div>
                      <button
                        onClick={() => handleRemovePerson(p.user._id)}
                        disabled={removingPerson === p.user._id}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground/50 hover:text-red-400 transition-all"
                      >
                        {removingPerson === p.user._id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <UserMinus className="h-3 w-3" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* People picker */}
      <UserPicker
        open={personPickerOpen}
        onOpenChange={setPersonPickerOpen}
        title={`Add person as ${personRole}`}
        scope="members"
        excludeIds={existingPeopleIds}
        onSelect={handleAddPerson}
      />

      {/* Agent picker */}
      <UserPicker
        open={agentPickerOpen}
        onOpenChange={setAgentPickerOpen}
        title="Assign agent"
        scope="staff"
        onSelect={handleAssignAgent}
      />
    </div>
  );
}
