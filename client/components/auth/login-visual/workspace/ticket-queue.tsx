"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Ticket } from "./workspace-config";
import { TicketRow } from "./ticket-row";

type TicketQueueProps = {
  tickets: Ticket[];
  highlightedId: string | null;
  exitingId: string | null;
  slaCompleteId: string | null;
};

export function TicketQueue({
  tickets,
  highlightedId,
  exitingId,
  slaCompleteId,
}: TicketQueueProps) {
  return (
    <motion.div layout className="space-y-2 overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        {tickets.map((ticket) => (
          <motion.div
            key={ticket.id}
            layout
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <TicketRow
              ticket={ticket}
              highlighted={highlightedId === ticket.id}
              exiting={exitingId === ticket.id}
              slaComplete={slaCompleteId === ticket.id}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
