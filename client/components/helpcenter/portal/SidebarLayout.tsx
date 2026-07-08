"use client";

import { useState } from "react";
import { MessageSquare, Ticket, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortalProps } from "./types";
import { ContactForm } from "./ContactForm";
import { TicketTracker } from "./TicketTracker";

type ActiveSection = "contact" | "ticket" | "track";

export function SidebarLayout({ hc, subdomain }: PortalProps) {
  const [active, setActive] = useState<ActiveSection>("contact");

  const items = [
    { id: "contact" as const, label: "Contact us", icon: MessageSquare, show: hc.features.contactForm },
    { id: "ticket" as const, label: "Raise a ticket", icon: Ticket, show: hc.features.raiseTicket },
    { id: "track" as const, label: "Track ticket", icon: BookOpen, show: hc.features.ticketTracking },
  ].filter((i) => i.show);

  // Default to first visible section
  const resolvedActive = items.some((i) => i.id === active) ? active : (items[0]?.id ?? "contact");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="py-8 px-6" style={{ background: hc.primaryColor }}>
        <h1 className="text-2xl font-bold text-white">{hc.title}</h1>
        <p className="text-white/80 mt-1">{hc.subtitle}</p>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 flex gap-6">
        {/* Sidebar nav */}
        <aside className="w-52 shrink-0 space-y-1">
          {items.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActive(id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                resolvedActive === id ? "text-white" : "text-gray-600 hover:bg-white hover:shadow-sm"
              )}
              style={resolvedActive === id ? { background: hc.primaryColor } : undefined}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 min-w-0">
          {resolvedActive === "contact" && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact us</h2>
              <ContactForm subdomain={subdomain} primaryColor={hc.primaryColor} />
            </>
          )}
          {resolvedActive === "ticket" && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Raise a support ticket</h2>
              <ContactForm subdomain={subdomain} primaryColor={hc.primaryColor} isTicket />
            </>
          )}
          {resolvedActive === "track" && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Track your ticket</h2>
              <TicketTracker subdomain={subdomain} primaryColor={hc.primaryColor} />
            </>
          )}
        </main>
      </div>

      <footer className="text-center py-6 text-xs text-gray-400">
        Powered by <span className="font-semibold text-[#D85A30]">Agentra</span>
      </footer>
    </div>
  );
}
