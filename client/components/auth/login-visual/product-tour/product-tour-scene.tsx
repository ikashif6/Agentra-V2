"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PRODUCT_TOUR_LOOP } from "./product-tour-config";
import { AnimatedConnection } from "./animated-connection";
import {
  AIReplyComposer,
  CustomerContextCard,
  IncomingMessageCard,
  OrderContextCard,
  TicketCard,
} from "./product-cards";

type SceneState = {
  incoming: boolean;
  ticket: boolean;
  scan: boolean;
  intent: boolean;
  context: boolean;
  messageConnection: boolean;
  connection: boolean;
  reply: boolean;
  highlightSend: boolean;
  resolved: boolean;
  shine: boolean;
  zoom: number;
  fade: number;
};

const HIDDEN: SceneState = {
  incoming: false,
  ticket: false,
  scan: false,
  intent: false,
  context: false,
  messageConnection: false,
  connection: false,
  reply: false,
  highlightSend: false,
  resolved: false,
  shine: false,
  zoom: 1,
  fade: 1,
};

const STATIC: SceneState = {
  incoming: false,
  ticket: true,
  scan: false,
  intent: true,
  context: true,
  messageConnection: false,
  connection: true,
  reply: true,
  highlightSend: false,
  resolved: true,
  shine: false,
  zoom: 1,
  fade: 1,
};

function wait(ms: number, signal: { cancelled: boolean }) {
  return new Promise<void>((resolve) => {
    const id = window.setTimeout(() => {
      if (!signal.cancelled) resolve();
    }, ms);
    if (signal.cancelled) {
      window.clearTimeout(id);
      resolve();
    }
  });
}

type ProductTourSceneProps = {
  parallaxX?: number;
  parallaxY?: number;
};

export function ProductTourScene({ parallaxX = 0, parallaxY = 0 }: ProductTourSceneProps) {
  const reduceMotion = useReducedMotion();
  const [scene, setScene] = useState<SceneState>(reduceMotion ? STATIC : HIDDEN);

  useEffect(() => {
    if (reduceMotion) {
      setScene(STATIC);
      return;
    }

    const signal = { cancelled: false };

    async function runLoop() {
      while (!signal.cancelled) {
        setScene({ ...HIDDEN, incoming: true, messageConnection: true, fade: 1, zoom: 1 });
        await wait(PRODUCT_TOUR_LOOP.incoming.duration * 1000, signal);

        setScene((s) => ({
          ...s,
          incoming: false,
          ticket: true,
          scan: true,
          shine: true,
        }));
        await wait(900, signal);
        setScene((s) => ({ ...s, scan: false, intent: true }));
        await wait((PRODUCT_TOUR_LOOP.understanding.duration - 0.9) * 1000, signal);

        setScene((s) => ({
          ...s,
          context: true,
          connection: true,
          messageConnection: false,
        }));
        await wait(PRODUCT_TOUR_LOOP.context.duration * 1000, signal);

        setScene((s) => ({ ...s, reply: true }));
        await wait(1800, signal);
        setScene((s) => ({ ...s, highlightSend: true }));
        await wait(1200, signal);

        setScene((s) => ({
          ...s,
          resolved: true,
          highlightSend: false,
          zoom: 0.96,
        }));
        await wait(PRODUCT_TOUR_LOOP.resolved.duration * 1000, signal);

        setScene((s) => ({
          ...HIDDEN,
          fade: 0,
          zoom: 0.98,
        }));
        await wait(PRODUCT_TOUR_LOOP.reset.duration * 1000, signal);
      }
    }

    runLoop();
    return () => {
      signal.cancelled = true;
    };
  }, [reduceMotion]);

  return (
    <motion.div
      className="relative mx-auto w-full max-w-[420px] px-2 xl:max-w-[460px]"
      animate={{
        opacity: scene.fade,
        x: parallaxX,
        y: parallaxY,
        scale: scene.zoom,
      }}
      transition={{
        opacity: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
        scale: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
        x: { type: "spring", stiffness: 120, damping: 20 },
        y: { type: "spring", stiffness: 120, damping: 20 },
      }}
      aria-hidden="true"
    >
      <div className="relative min-h-[360px] md:min-h-[390px]">
        <IncomingMessageCard show={scene.incoming} />

        <AnimatedConnection
          active={scene.messageConnection}
          className="pointer-events-none absolute right-[8%] top-[14%] z-0 h-20 w-[42%]"
          d="M 150 8 C 95 28, 55 48, 12 72"
        />

        <AnimatedConnection
          active={scene.connection}
          className="pointer-events-none absolute left-[18%] top-[24%] z-0 h-16 w-[58%]"
          d="M 8 40 C 60 10, 95 12, 150 38"
        />

        <div className="relative z-20 pt-16">
          <TicketCard
            show={scene.ticket}
            scan={scene.scan}
            shine={scene.shine}
            resolved={scene.resolved}
            showIntent={scene.intent}
          />
          <CustomerContextCard show={scene.context} />
          <OrderContextCard show={scene.context} />
          <AIReplyComposer show={scene.reply} highlightSend={scene.highlightSend} />
        </div>
      </div>
    </motion.div>
  );
}
