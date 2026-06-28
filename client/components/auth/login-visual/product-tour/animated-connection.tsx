"use client";

import { motion } from "framer-motion";
import { PRODUCT_TOUR_EASE } from "./product-tour-config";

type AnimatedConnectionProps = {
  active: boolean;
  className?: string;
  d: string;
};

export function AnimatedConnection({ active, className, d }: AnimatedConnectionProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 80"
      fill="none"
      aria-hidden="true"
    >
      <motion.path
        d={d}
        stroke="url(#auth-line-gradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={
          active
            ? { pathLength: 1, opacity: 0.85 }
            : { pathLength: 0, opacity: 0 }
        }
        transition={{ duration: 0.9, ease: PRODUCT_TOUR_EASE }}
      />
      <defs>
        <linearGradient id="auth-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(240,153,123,0.1)" />
          <stop offset="50%" stopColor="rgba(240,153,123,0.75)" />
          <stop offset="100%" stopColor="rgba(216,90,48,0.35)" />
        </linearGradient>
      </defs>
      {active ? (
        <motion.circle
          r="2.5"
          fill="#F0997B"
          initial={{ offsetDistance: "0%" }}
          animate={{ offsetDistance: "100%" }}
          transition={{ duration: 1.2, ease: "linear", repeat: Infinity, repeatDelay: 2 }}
          style={{ offsetPath: `path('${d}')` }}
        />
      ) : null}
    </svg>
  );
}
