/** Product-tour animation — preserved for signup / marketing pages. */
export const PRODUCT_TOUR_LOOP = {
  total: 14,
  incoming: { start: 0, duration: 2 },
  understanding: { start: 2, duration: 2.5 },
  context: { start: 4.5, duration: 3 },
  reply: { start: 7.5, duration: 3 },
  resolved: { start: 10.5, duration: 2 },
  reset: { start: 12.5, duration: 1.5 },
} as const;

export const PRODUCT_TOUR_COPY = {
  message: "Hi, my order still hasn't arrived. Can you check it?",
  intent: "Delivery issue",
  customer: "Sarah Miller",
  orderId: "#AG-2841",
  orderStatus: "In transit",
  orderEta: "Expected tomorrow",
  reply:
    "Hi Sarah, I've checked order #AG-2841. It is currently in transit and expected to arrive tomorrow.",
  sendLabel: "Send reply",
} as const;

export const PRODUCT_TOUR_SPRING = {
  card: { type: "spring" as const, stiffness: 260, damping: 28, mass: 0.9 },
  soft: { type: "spring" as const, stiffness: 180, damping: 26, mass: 1 },
};

export const PRODUCT_TOUR_EASE = [0.22, 1, 0.36, 1] as const;
