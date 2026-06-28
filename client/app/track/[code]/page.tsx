"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Send, Paperclip, X, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Ticket, TicketMessage } from "@/lib/types";
import { getTrackToken } from "@/lib/auth";
import { API_BASE, STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/constants";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(str: string) {
  return new Date(str).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function TrackTicketDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const subdomain = searchParams.get("subdomain") ?? "";

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msgBody, setMsgBody] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);

  const trackToken = getTrackToken();

  const authHeaders = trackToken ? { Authorization: `Bearer ${trackToken}`, "x-tenant": subdomain } : {};

  const fetchTicket = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/tickets/${code}`, { headers: authHeaders });
      setTicket(data.data.ticket);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        setError("Session expired. Please track again.");
      } else {
        setError("Ticket not found or access denied.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!trackToken) {
      router.replace("/track");
      return;
    }
    if (!subdomain) { setError("Invalid link."); setLoading(false); return; }
    fetchTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = async () => {
    if (!msgBody.trim()) return;
    setSending(true);
    try {
      await axios.post(`${API_BASE}/tickets/${code}/messages`, { body: msgBody }, { headers: authHeaders });
      setMsgBody("");
      await fetchTicket();
      toast.success("Message sent");
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const closeTicket = async () => {
    setClosing(true);
    try {
      await axios.post(`${API_BASE}/tickets/${code}/close`, {}, { headers: authHeaders });
      await fetchTicket();
      toast.success("Ticket closed");
    } catch {
      toast.error("Failed to close ticket");
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#D85A30" }} />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">{error ?? "Something went wrong"}</h2>
          <Button onClick={() => router.push("/track")}>
            Track another ticket
          </Button>
        </div>
      </div>
    );
  }

  const isClosed = ["closed", "self_closed", "resolved"].includes(ticket.status);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <div>
              <div className="font-semibold text-sm text-gray-900">{ticket.ticket_code}</div>
              <div className="text-xs text-gray-400">Tracking as guest</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={STATUS_COLORS[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
            <Lock className="h-4 w-4 text-gray-300" />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Ticket info card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl font-bold text-gray-900">{ticket.ticket_title}</h1>
            <Badge className={PRIORITY_COLORS[ticket.priority]}>{PRIORITY_LABELS[ticket.priority]}</Badge>
          </div>
          <p className="text-gray-600 text-sm leading-relaxed">{ticket.ticket_description}</p>

          {/* Meta row */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-400 pt-2 border-t border-gray-100">
            <span>Created {formatDate(ticket.createdAt)}</span>
            <span>Last activity {formatDate(ticket.lastActivity)}</span>
            {ticket.assigned_agent && (
              <span>Agent: {ticket.assigned_agent.firstName} {ticket.assigned_agent.lastName}</span>
            )}
          </div>

          {/* Attachments */}
          {ticket.attachments.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Attachments</p>
              <div className="flex flex-wrap gap-2">
                {ticket.attachments.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                    <Paperclip className="h-3 w-3 text-gray-400" />
                    {a.filename}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="space-y-3">
          {ticket.messages.filter((m) => !m.isInternal).map((msg: TicketMessage) => {
            const isOwn = false; // guest can't determine reliably without checking email
            return (
              <div key={msg._id} className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs" style={{ background: "#FDEBE4", color: "#D85A30" }}>
                    {initials(msg.sender?.fullName ?? msg.senderEmail ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 max-w-[85%]">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-700">
                      {msg.sender?.fullName ?? msg.senderEmail}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(msg.sentAt)}</span>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 shadow-sm whitespace-pre-wrap">
                    {msg.body}
                  </div>
                  {msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {msg.attachments.map((a, i) => (
                        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-[#D85A30] hover:underline flex items-center gap-1">
                          <Paperclip className="h-3 w-3" /> {a.filename}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {ticket.messages.filter((m) => !m.isInternal).length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">No messages yet</div>
          )}
        </div>

        <Separator />

        {/* Reply box */}
        {!isClosed ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <Textarea
              value={msgBody}
              onChange={(e) => setMsgBody(e.target.value)}
              placeholder="Write a reply..."
              className="min-h-[100px] resize-none focus-visible:ring-[#D85A30] border-gray-200"
            />
            <div className="flex items-center justify-between">
              <button
                onClick={closeTicket}
                disabled={closing}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                {closing ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                Close this ticket
              </button>
              <Button onClick={sendMessage} disabled={sending || !msgBody.trim()}
                size="sm">
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-500">This ticket is <strong>{STATUS_LABELS[ticket.status]}</strong>.</p>
            <Button variant="outline" className="mt-3" onClick={() => router.push("/track")}>
              Track another ticket
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
