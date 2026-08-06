export type WorkspaceSetupStepId = "store" | "ai" | "channels" | "workspace" | "team";

export type WorkspaceSetupTask = {
  id: string;
  title: string;
  description: string;
  /** Settings deep-link fallback */
  href: string;
  action: string;
  /** Panel key rendered inside the setup wizard */
  panel: SetupPanelId;
};

export type SetupPanelId =
  | "store"
  | "ai-agent"
  | "helpdesk-ai"
  | "email"
  | "chat"
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "customize"
  | "invite-user"
  | "create-team";

export type WorkspaceSetupStep = {
  id: WorkspaceSetupStepId;
  label: string;
  title: string;
  description: string;
  tasks: WorkspaceSetupTask[];
};

export const WORKSPACE_SETUP_FLOW: WorkspaceSetupStep[] = [
  {
    id: "store",
    label: "Store",
    title: "Link your commerce store",
    description: "Sync orders and customer context so agents can help without switching tools.",
    tasks: [
      {
        id: "store",
        title: "Store connection",
        description: "Shopify, WooCommerce, or a custom storefront.",
        href: "/settings?item=store",
        action: "Connect store",
        panel: "store",
      },
    ],
  },
  {
    id: "channels",
    label: "Channels",
    title: "Connect how customers reach you",
    description:
      "Add the channels your team already uses. You can start with one and come back for the rest.",
    tasks: [
      {
        id: "email",
        title: "Support email",
        description: "Route inbound mail into the inbox.",
        href: "/settings?item=email",
        action: "Connect email",
        panel: "email",
      },
      {
        id: "chat",
        title: "Live chat widget",
        description: "Publish chat on your website.",
        href: "/settings?item=chat",
        action: "Enable live chat",
        panel: "chat",
      },
      {
        id: "whatsapp",
        title: "WhatsApp",
        description: "Receive WhatsApp Business messages.",
        href: "/settings?item=whatsapp",
        action: "Connect WhatsApp",
        panel: "whatsapp",
      },
      {
        id: "instagram",
        title: "Instagram",
        description: "Reply to DMs alongside other channels.",
        href: "/settings?item=instagram",
        action: "Connect Instagram",
        panel: "instagram",
      },
      {
        id: "facebook",
        title: "Facebook",
        description: "Bring Messenger into your inbox.",
        href: "/settings?item=facebook",
        action: "Connect Facebook",
        panel: "facebook",
      },
    ],
  },
  {
    id: "ai",
    label: "AI",
    title: "Configure AI Agent and Helpdesk AI",
    description:
      "Turn AI on for the channels you connected, then tune Helpdesk AI for copilots and QA.",
    tasks: [
      {
        id: "ai-agent",
        title: "AI Agent",
        description: "Enable AI on live channels and set permissions.",
        href: "/settings?item=ai-agent",
        action: "Configure AI Agent",
        panel: "ai-agent",
      },
      {
        id: "helpdesk-ai",
        title: "Helpdesk AI",
        description: "Inbox copilot, manager QA, and knowledge tools.",
        href: "/settings?item=helpdesk-ai",
        action: "Configure Helpdesk AI",
        panel: "helpdesk-ai",
      },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    title: "Customize your workspace",
    description: "Make Agentra feel like your brand before you invite the rest of your team.",
    tasks: [
      {
        id: "customize",
        title: "Branding & appearance",
        description: "Logo, colors, favicon, and browser title.",
        href: "/settings?item=customize-workspace",
        action: "Customize workspace",
        panel: "customize",
      },
    ],
  },
  {
    id: "team",
    label: "Team",
    title: "Add your team and assign roles",
    description: "Invite people, choose roles, and organize teams for routing.",
    tasks: [
      {
        id: "users",
        title: "Invite a teammate",
        description: "Send an invite with the right role.",
        href: "/settings?item=users&view=new",
        action: "Invite user",
        panel: "invite-user",
      },
      {
        id: "teams",
        title: "Create a team",
        description: "Optional. Groups help with routing and ownership.",
        href: "/settings?item=teams&view=new",
        action: "Create team",
        panel: "create-team",
      },
    ],
  },
];

export function resolveSetupStepId(value: string | null | undefined): WorkspaceSetupStepId {
  if (
    value === "channels"
    || value === "store"
    || value === "team"
    || value === "ai"
    || value === "workspace"
  ) {
    return value;
  }
  return "store";
}

export function resolveSetupTaskId(
  stepId: WorkspaceSetupStepId,
  value: string | null | undefined,
): string {
  const step = WORKSPACE_SETUP_FLOW.find((entry) => entry.id === stepId);
  if (!step?.tasks.length) return "store";
  if (value && step.tasks.some((task) => task.id === value)) return value;
  return step.tasks[0].id;
}

export function setupStepHref(stepId: WorkspaceSetupStepId, taskId?: string) {
  const params = new URLSearchParams({ step: stepId });
  if (taskId) params.set("task", taskId);
  return `/setup?${params.toString()}`;
}
