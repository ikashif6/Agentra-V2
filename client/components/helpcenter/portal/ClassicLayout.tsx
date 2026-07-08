"use client";

import { useState } from "react";
import { Search, MessageSquare, Ticket, BookOpen, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PortalProps, Section } from "./types";
import { ContactForm } from "./ContactForm";
import { TicketTracker } from "./TicketTracker";

export function ClassicLayout({ hc, subdomain }: PortalProps) {
  const [active, setActive] = useState<Section>(null);

  const cards = [
    { id: "contact" as const, icon: MessageSquare, label: "Contact us",
      desc: "Send us a message and we'll reply shortly", show: hc.features.contactForm },
    { id: "ticket" as const, icon: Ticket, label: "Raise a ticket",
      desc: "Create a support request and track progress", show: hc.features.raiseTicket },
    { id: "track" as const, icon: BookOpen, label: "Track your ticket",
      desc: "Check the status of an existing support request", show: hc.features.ticketTracking },
  ].filter((c) => c.show);

  return (
    <div className="min-h-screen" style={{ background: "#fafaf9" }}>
      {/* Hero */}
      <div className="py-16 px-4 text-center" style={{ background: hc.primaryColor }}>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">{hc.title}</h1>
        <p className="text-white/80 text-lg mb-6">{hc.subtitle}</p>
        {hc.features.search && (
          <div className="max-w-lg mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search for answers..." className="pl-10 py-3 text-base bg-white" />
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(({ id, icon: Icon, label, desc }) => (
            <button key={id} onClick={() => setActive(active === id ? null : id)}
              className={cn(
                "text-left p-5 rounded-2xl border-2 transition-all",
                active === id
                  ? "bg-brand-muted"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              )}
              style={active === id ? { borderColor: hc.primaryColor } : undefined}>
              <Icon className="h-6 w-6 mb-3" style={{ color: hc.primaryColor }} />
              <h3 className={cn("font-semibold", active === id ? "text-[#D85A30]" : "text-gray-900")}>{label}</h3>
              <p className="text-sm text-gray-500 mt-1">{desc}</p>
              <ArrowRight className="h-4 w-4 mt-3 text-gray-400" />
            </button>
          ))}
        </div>

        {/* Expanded panel */}
        {active && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            {active === "contact" && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Send us a message</h2>
                <ContactForm subdomain={subdomain} primaryColor={hc.primaryColor} />
              </>
            )}
            {active === "ticket" && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Raise a support ticket</h2>
                <ContactForm subdomain={subdomain} primaryColor={hc.primaryColor} isTicket />
              </>
            )}
            {active === "track" && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Track your ticket</h2>
                <TicketTracker subdomain={subdomain} primaryColor={hc.primaryColor} />
              </>
            )}
          </div>
        )}
      </div>

      <footer className="text-center py-6 text-xs text-gray-400">
        Powered by <span className="font-semibold text-[#D85A30]">Agentra</span>
      </footer>
    </div>
  );
}
