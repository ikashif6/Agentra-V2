"use client";

import { useState } from "react";
import axios from "axios";
import { Loader2, Search, KeyRound, CheckCircle2, AlertCircle,
  Send, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ticketApi } from "@/lib/api";
import { setTrackToken, getTrackToken } from "@/lib/auth";
import { API_BASE, STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/constants";
import type { Ticket } from "@/lib/types";

interface Props {
  subdomain: string;
  primaryColor: string;
}

type TrackStep = "form" | "otp" | "ticket";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(str: string) {
  return new Date(str).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function TicketTracker({ subdomain, primaryColor }: Props) {
  const [step, setStep] = useState<TrackStep>("form");
  const [ticketCode, setTicketCode] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [msgBody, setMsgBody] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!ticketCode || !email) { setError("Both fields are required."); return; }
    setLoading(true);
    try {
      await ticketApi.trackRequest({ ticket_code: ticketCode.toUpperCase(), email, subdomain });
      setStep("otp");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? "Failed to send OTP. Check your ticket code and email.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (otp.length !== 6) { setError("OTP must be 6 digits."); return; }
    setLoading(true);
    try {
      const { data } = await ticketApi.trackVerify({
        ticket_code: ticketCode.toUpperCase(), email, otp, subdomain,
      });
      setTrackToken(data.data.trackToken);
      await fetchTicket(data.data.trackToken);
      setStep("ticket");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? "Invalid OTP. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchTicket = async (token?: string) => {
    const t = token ?? getTrackToken();
    if (!t) return;
    const { data } = await axios.get(`${API_BASE}/tickets/${ticketCode.toUpperCase()}`, {
      headers: { Authorization: `Bearer ${t}`, "x-tenant": subdomain },
    });
    setTicket(data.data.ticket);
  };

  const sendMessage = async () => {
    if (!msgBody.trim()) return;
    setSending(true);
    const t = getTrackToken();
    try {
      await axios.post(
        `${API_BASE}/tickets/${ticketCode.toUpperCase()}/messages`,
        { body: msgBody },
        { headers: { Authorization: `Bearer ${t}`, "x-tenant": subdomain } }
      );
      setMsgBody("");
      await fetchTicket();
    } catch { setError("Failed to send message."); }
    finally { setSending(false); }
  };

  const closeTicket = async () => {
    setClosing(true);
    const t = getTrackToken();
    try {
      await axios.post(
        `${API_BASE}/tickets/${ticketCode.toUpperCase()}/close`,
        {},
        { headers: { Authorization: `Bearer ${t}`, "x-tenant": subdomain } }
      );
      await fetchTicket();
    } catch { setError("Failed to close ticket."); }
    finally { setClosing(false); }
  };

  if (step === "form") {
    return (
      <form onSubmit={handleRequestOtp} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">Ticket code</Label>
          <Input value={ticketCode} onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
            placeholder="TKT-00001" className="font-mono uppercase" required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">Email address used when creating the ticket</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com" required />
        </div>
        <Button type="submit" disabled={loading} className="w-full text-white" style={{ background: primaryColor }}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
          Send OTP to email
        </Button>
      </form>
    );
  }

  if (step === "otp") {
    return (
      <form onSubmit={handleVerifyOtp} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}
        <p className="text-sm text-gray-500">
          A 6-digit code was sent to <span className="font-medium text-gray-800">{email}</span>.
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">Enter OTP</Label>
          <Input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            maxLength={6} placeholder="••••••"
            className="text-center text-2xl tracking-[0.5em] font-mono" required />
        </div>
        <Button type="submit" disabled={loading} className="w-full text-white" style={{ background: primaryColor }}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
          View ticket
        </Button>
        <button type="button" onClick={() => { setStep("form"); setError(null); setOtp(""); }}
          className="w-full text-sm text-gray-400 hover:text-gray-600 text-center">
          ← Try a different code
        </button>
      </form>
    );
  }

  // step === "ticket"
  if (!ticket) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" style={{ color: primaryColor }} /></div>;

  const isClosed = ["closed", "self_closed", "resolved"].includes(ticket.status);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono text-gray-400">{ticket.ticket_code}</p>
          <h3 className="text-base font-bold text-gray-900">{ticket.ticket_title}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={PRIORITY_COLORS[ticket.priority]}>{PRIORITY_LABELS[ticket.priority]}</Badge>
          <Badge className={STATUS_COLORS[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
        </div>
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">{ticket.ticket_description}</p>
      {ticket.messages.filter((m) => !m.isInternal).length > 0 && (
        <div className="space-y-3 border-t border-gray-100 pt-4">
          {ticket.messages.filter((m) => !m.isInternal).map((msg) => (
            <div key={msg._id} className="flex gap-3">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-[10px]" style={{ background: "#FFF0EB", color: "#E8470A" }}>
                  {initials(msg.sender?.fullName ?? msg.senderEmail ?? "?")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-700">{msg.sender?.fullName ?? msg.senderEmail}</span>
                  <span className="text-xs text-gray-400">{formatDate(msg.sentAt)}</span>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-700 whitespace-pre-wrap">
                  {msg.body}
                </div>
                {msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {msg.attachments.map((a, i) => (
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-[#E8470A] hover:underline flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />{a.filename}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {!isClosed ? (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <Textarea value={msgBody} onChange={(e) => setMsgBody(e.target.value)}
            placeholder="Write a reply..." rows={3}
            className="resize-none focus-visible:ring-[#E8470A]" />
          <div className="flex items-center justify-between">
            <button onClick={closeTicket} disabled={closing}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              {closing ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
              Close this ticket
            </button>
            <Button size="sm" onClick={sendMessage} disabled={sending || !msgBody.trim()}
              style={{ background: primaryColor }}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
              Reply
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-sm text-gray-500">Ticket is <strong>{STATUS_LABELS[ticket.status]}</strong>.</p>
          <button onClick={() => { setStep("form"); setTicket(null); setTicketCode(""); setEmail(""); setOtp(""); }}
            className="mt-2 text-xs underline" style={{ color: primaryColor }}>
            Track another ticket
          </button>
        </div>
      )}
    </div>
  );
}
