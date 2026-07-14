import {
  aiAgentApi,
  emailChannelApi,
  facebookChannelApi,
  instagramChannelApi,
  liveChatApi,
  storeApi,
  whatsappChannelApi,
  workspaceApi,
} from "@/lib/api";
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
    includes: ["Email", "Live chat", "WhatsApp", "Instagram", "Facebook", "TikTok"],
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
};

function minsFromDuration(duration: string) {
  const n = parseInt(String(duration).replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function isConnectedStatus(value: unknown) {
  return value === "connected";
}

export async function fetchWorkspaceSetupStatus(): Promise<Omit<WorkspaceSetupStatus, "loading">> {
  const results = await Promise.allSettled([
    emailChannelApi.getStatus(),
    liveChatApi.getSettings(),
    storeApi.getStatus(),
    aiAgentApi.getSettings(),
    facebookChannelApi.getStatus(),
    instagramChannelApi.getStatus(),
    whatsappChannelApi.getStatus(),
    workspaceApi.getBranding(),
  ]);

  const emailConnected =
    results[0].status === "fulfilled"
    && isConnectedStatus(results[0].value.data?.data?.email?.status);

  const liveChat = results[1].status === "fulfilled" ? results[1].value.data?.data?.liveChat : null;
  const liveChatEnabled = Boolean(liveChat?.enabled);

  const storeConnected =
    results[2].status === "fulfilled"
    && isConnectedStatus(results[2].value.data?.data?.store?.status);

  const ai = results[3].status === "fulfilled" ? results[3].value.data?.data?.aiAgent : null;
  const channels = ai?.enabledChannels ?? {};

  const facebookConnected =
    results[4].status === "fulfilled"
    && isConnectedStatus(results[4].value.data?.data?.facebook?.status);
  const instagramConnected =
    results[5].status === "fulfilled"
    && isConnectedStatus(results[5].value.data?.data?.instagram?.status);
  const whatsappConnected =
    results[6].status === "fulfilled"
    && isConnectedStatus(results[6].value.data?.data?.whatsapp?.status);

  const setupChecklist =
    results[7].status === "fulfilled" ? results[7].value.data?.data?.setupChecklist : null;

  const hasAnyChannel =
    emailConnected
    || liveChatEnabled
    || facebookConnected
    || instagramConnected
    || whatsappConnected;

  const aiConfigured =
    (Boolean(channels.liveChat) && Boolean(ai?.liveChatAiEnabled) && liveChatEnabled)
    || (Boolean(channels.email) && emailConnected)
    || (Boolean(channels.facebook) && facebookConnected)
    || (Boolean(channels.instagram) && instagramConnected)
    || (Boolean(channels.whatsapp) && whatsappConnected);

  const doneById: Record<string, boolean> = {
    store: storeConnected,
    ai: aiConfigured,
    channels: hasAnyChannel,
    // Only after an intentional customize / invite — not pre-existing logo or members
    workspace: Boolean(setupChecklist?.workspace),
    team: Boolean(setupChecklist?.team),
  };

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
  };
}
