"use client";

import { useState } from "react";
import { MessageSquare, Ticket, BookOpen, ArrowLeft } from "lucide-react";
import type { PortalProps } from "./types";
import { ContactForm } from "./ContactForm";
import { TicketTracker } from "./TicketTracker";

type ActiveSection = "contact" | "ticket" | "track" | null;

export function CardsLayout({ hc, subdomain }: PortalProps) {
  const [active, setActive] = useState<ActiveSection>(null);

  const cards = [
    { id: "contact" as const, icon: MessageSquare, label: "Contact us",
      desc: "Get in touch with our support team", show: hc.features.contactForm },
    { id: "ticket" as const, icon: Ticket, label: "Raise a ticket",
      desc: "Submit a new support request", show: hc.features.raiseTicket },
    { id: "track" as const, icon: BookOpen, label: "Track ticket",
      desc: "Check your ticket status", show: hc.features.ticketTracking },
  ].filter((c) => c.show);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="py-12 px-4 text-center" style={{ background: hc.primaryColor }}>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{hc.title}</h1>
        <p className="text-white/80">{hc.subtitle}</p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {!active ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {cards.map(({ id, icon: Icon, label, desc }) => (
              <button key={id} onClick={() => setActive(id)}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-left hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${hc.primaryColor}20` }}>
                  <Icon className="h-5 w-5" style={{ color: hc.primaryColor }} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{label}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <button onClick={() => setActive(null)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              {active === "contact" && (
                <>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact us</h2>
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
          </div>
        )}
      </div>

      <footer className="text-center py-6 text-xs text-gray-400">
        Powered by <span className="font-semibold text-[#D85A30]">Agentraa</span>
      </footer>
    </div>
  );
}
