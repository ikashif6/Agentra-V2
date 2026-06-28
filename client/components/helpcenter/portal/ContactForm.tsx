"use client";

import { useState } from "react";
import { Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { helpCenterApi } from "@/lib/api";

interface Props {
  subdomain: string;
  primaryColor: string;
  /** When true, shows "Raise a ticket" wording instead of "Contact us" */
  isTicket?: boolean;
}

export function ContactForm({ subdomain, primaryColor, isTicket = false }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("medium");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name || !email || !subject || !message) {
      setError("All fields are required.");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await helpCenterApi.submitContact(subdomain, {
        name, email, subject, message, priority,
        type: isTicket ? "ticket" : "contact",
      });
      setSuccess(data.data?.ticket_code ?? "submitted");
      setName(""); setEmail(""); setSubject(""); setMessage("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? "Failed to submit. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <p className="text-lg font-semibold text-gray-900">
          {isTicket ? "Ticket created!" : "Message sent!"}
        </p>
        <p className="text-sm text-gray-500">
          Reference: <span className="font-mono font-bold">{success}</span>
        </p>
        <p className="text-xs text-gray-400">We'll get back to you shortly.</p>
        <Button variant="outline" size="sm" onClick={() => setSuccess(null)} className="mt-2">
          {isTicket ? "Raise another ticket" : "Send another message"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">Your name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith" required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">Email address</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-600">Subject</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)}
          placeholder="What do you need help with?" required />
      </div>
      {isTicket && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-600">Priority</Label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
            style={{ "--tw-ring-color": primaryColor } as React.CSSProperties}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-600">
          {isTicket ? "Describe the issue" : "Message"}
        </Label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your issue or question in detail..."
          rows={5}
          required
          className="resize-none focus-visible:ring-[#D85A30]"
        />
      </div>
      <Button type="submit" disabled={submitting} className="w-full text-white"
        style={{ background: primaryColor }}>
        {submitting
          ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
          : <Send className="h-4 w-4 mr-2" />}
        {isTicket ? "Submit ticket" : "Send message"}
      </Button>
    </form>
  );
}
