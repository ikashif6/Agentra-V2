import { workspaceApi } from "@/lib/api";
import type { SetupStep } from "@/components/home/home-setup-panel";

/** Grouped setup checklist — detail lives in /setup step-by-step. */
export const WORKSPACE_SETUP_STEPS: Omit<SetupStep, "done">[] = [
  {
    id: "store",
    label: "Store",
    title: "Link your store",
    description: "Pull orders and customer context into conversations for faster support.",
    duration: "3 mins",
    href: "/setup?step=store",
    action: "Connect store",
    includes: ["Shopify", "WooCommerce", "Custom storefront"],
  },
  {
    id: "channels",
    label: "Channels",
    title: "Connect your channels",
    description:
      "Bring customer conversations into Agentra from email, live chat, and social messaging.",
    duration: "5 mins",
    href: "/setup?step=channels",
    action: "Connect channels",
    includes: ["Email", "Live chat", "WhatsApp", "Instagram", "Facebook"],
  },
  {
    id: "ai",
    label: "AI",
    title: "Configure AI assistance",
    description:
      "Turn on the AI Agent for channels you use, and set Helpdesk AI for inbox copilots and QA.",
    duration: "5 mins",
    href: "/setup?step=ai",
    action: "Configure AI",
    includes: ["AI Agent", "Channel permissions", "Helpdesk AI"],
  },
  {
    id: "workspace",
    label: "Workspace",
    title: "Customize your workspace",
    description: "Set your brand look — name, logos, colors, and how Agentra appears in the browser.",
    duration: "3 mins",
    href: "/setup?step=workspace",
    action: "Customize",
    includes: ["Logo", "Colors", "Browser title", "Theme"],
  },
  {
    id: "team",
    label: "Team",
    title: "Add your team and assign roles",
    description: "Invite people, set roles, and organize teams so conversations can be routed.",
    duration: "4 mins",
    href: "/setup?step=team",
    action: "Manage team",
    includes: ["Invite users", "Roles", "Teams"],
  },
];

export type WorkspaceSetupStatus = {
  steps: SetupStep[];
  remaining: SetupStep[];
  doneCount: number;
  totalMinsRemaining: number;
  loading: boolean;
  complete?: boolean;
};

function minsFromDuration(duration: string) {
  const n = parseInt(String(duration).replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Single request — server returns sticky checklist (completedAt short-circuits).
 * Home no longer fans out 8 channel/store probes on every reload.
 */
export async function fetchWorkspaceSetupStatus(): Promise<Omit<WorkspaceSetupStatus, "loading">> {
  const { data } = await workspaceApi.getSetupStatus();
  const checklist = data?.data?.setupChecklist ?? {};

  const doneById: Record<string, boolean> = {
    store: Boolean(checklist.store),
    channels: Boolean(checklist.channels),
    ai: Boolean(checklist.ai),
    workspace: Boolean(checklist.workspace),
    team: Boolean(checklist.team),
  };

  if (checklist.complete || checklist.completedAt) {
    for (const id of Object.keys(doneById)) doneById[id] = true;
  }

  const steps: SetupStep[] = WORKSPACE_SETUP_STEPS.map((step) => ({
    ...step,
    done: Boolean(doneById[step.id]),
  }));

  const remaining = steps.filter((s) => !s.done);

  return {
    steps,
    remaining,
    doneCount: steps.length - remaining.length,
    totalMinsRemaining: remaining.reduce((sum, s) => sum + minsFromDuration(s.duration), 0),
    complete: remaining.length === 0,
  };
}
