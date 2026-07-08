export type BillingCycle = "monthly" | "yearly";

/** Agentra ships a single Pro plan. */
export const AGENTRA_PRO_PLAN = {
  id: "pro" as const,
  label: "Pro",
  description: "Everything included: inbox, channels, integrations, and team collaboration.",
  priceMonthly: 6000,
  priceLabel: "$60",
  billingCycle: "monthly" as BillingCycle,
  highlights: [
    "Unlimited team members",
    "Unlimited tickets",
    "All channels & integrations",
    "Store & commerce connections",
  ],
};

export type PaymentMethodInfo = {
  type: "card" | "invoice";
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  name?: string;
};

export type BillingInvoice = {
  _id?: string;
  number: string;
  issuedAt: string;
  amount: number;
  currency: string;
  status: "paid" | "open" | "void" | "draft";
  description: string;
  pdfUrl?: string;
};

export type BillingOverview = {
  plan: {
    id: string;
    label: string;
    status: string;
    billingCycle: BillingCycle;
    priceMonthly: number;
    unlimited: boolean;
    trialEndsAt?: string | null;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: string | null;
    accessEndsAt?: string | null;
  };
  usage: {
    totalUsers: number;
    totalAgents: number;
    totalTickets: number;
    openTickets: number;
  };
  paymentMethod: PaymentMethodInfo | null;
  invoices: BillingInvoice[];
};

export function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

export function planStatusLabel(status: string, cancelAtPeriodEnd?: boolean) {
  if (cancelAtPeriodEnd) return "Canceling";
  const labels: Record<string, string> = {
    active: "Active",
    trialing: "Trial",
    past_due: "Past due",
    canceled: "Canceled",
    unpaid: "Unpaid",
  };
  return labels[status] ?? status;
}

export function formatBillingDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "long" });
}

export function invoiceStatusLabel(status: BillingInvoice["status"]) {
  const labels: Record<BillingInvoice["status"], string> = {
    paid: "Paid",
    open: "Open",
    draft: "Draft",
    void: "Void",
  };
  return labels[status];
}
