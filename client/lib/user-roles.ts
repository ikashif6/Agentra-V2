import type { Role, User } from "@/lib/types";

/** Roles that can be assigned when inviting a new workspace member. */
export type InvitableRole = "agent" | "manager" | "admin";

export type InviteRoleOption = {
  id: InvitableRole;
  label: string;
  description: string;
};

export const INVITE_ROLE_OPTIONS: InviteRoleOption[] = [
  {
    id: "agent",
    label: "Support agent",
    description:
      "Inbox and AI Agent conversations (view and reply). No AI setup, analytics, or team management.",
  },
  {
    id: "manager",
    label: "Manager",
    description:
      "Inbox, AI Agent, analytics, and users/teams. Cannot connect channels or change workspace config.",
  },
  {
    id: "admin",
    label: "Workspace admin",
    description:
      "Full workspace setup: channels, store, AI configuration, users, and teams.",
  },
];

export const ROLE_DISPLAY: Record<Role, { label: string; badgeClass: string }> = {
  owner: {
    label: "Workspace owner",
    badgeClass: "border-border bg-muted/50 text-foreground",
  },
  admin: {
    label: "Workspace admin",
    badgeClass: "border-border bg-muted/50 text-foreground",
  },
  manager: {
    label: "Manager",
    badgeClass: "border-border bg-muted/50 text-foreground",
  },
  agent: {
    label: "Support agent",
    badgeClass: "border-border bg-muted/50 text-foreground",
  },
  customer: {
    label: "Customer",
    badgeClass: "border-border bg-muted/30 text-muted-foreground",
  },
};

export type PermissionLevel = "full" | "limited" | "none";

export type PermissionRow = {
  id: string;
  label: string;
  levels: Record<Role, PermissionLevel>;
};

export type WorkspaceRoleDefinition = {
  id: Role;
  label: string;
  summary: string;
};

export const WORKSPACE_ROLES: WorkspaceRoleDefinition[] = [
  {
    id: "owner",
    label: "Workspace owner",
    summary: "Billing, security, and full workspace control.",
  },
  {
    id: "admin",
    label: "Workspace admin",
    summary: "Users, channels, and settings. No billing or ownership transfer.",
  },
  {
    id: "manager",
    label: "Manager",
    summary: "Inbox, AI Agent, analytics, and team management. No channel or workspace config.",
  },
  {
    id: "agent",
    label: "Support agent",
    summary:
      "Inbox and AI Agent conversations (view how AI handles chats, reply, resolve). No AI setup or analytics.",
  },
  {
    id: "customer",
    label: "Customer",
    summary: "Portal only. Own tickets, no internal access.",
  },
];

export const PERMISSION_MATRIX: PermissionRow[] = [
  {
    id: "inbox",
    label: "Inbox & tickets",
    levels: { owner: "full", admin: "full", manager: "full", agent: "full", customer: "limited" },
  },
  {
    id: "teams",
    label: "Teams",
    levels: { owner: "full", admin: "full", manager: "full", agent: "limited", customer: "none" },
  },
  {
    id: "users",
    label: "Users",
    levels: { owner: "full", admin: "full", manager: "full", agent: "none", customer: "none" },
  },
  {
    id: "channels",
    label: "Channels",
    levels: { owner: "full", admin: "full", manager: "none", agent: "none", customer: "none" },
  },
  {
    id: "billing",
    label: "Billing",
    levels: { owner: "full", admin: "none", manager: "none", agent: "none", customer: "none" },
  },
  {
    id: "settings",
    label: "Workspace config",
    levels: { owner: "full", admin: "full", manager: "none", agent: "none", customer: "none" },
  },
  {
    id: "analytics",
    label: "Analytics",
    levels: { owner: "full", admin: "full", manager: "full", agent: "none", customer: "none" },
  },
  {
    id: "ai-agent",
    label: "AI Agent",
    levels: { owner: "full", admin: "full", manager: "full", agent: "limited", customer: "none" },
  },
];

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export type UserManagePermissions = {
  canEdit: boolean;
  canChangeRole: boolean;
  canDelete: boolean;
};

export function inviteRoleOptionsFor(actorRole?: Role | null): InviteRoleOption[] {
  if (actorRole === "owner" || actorRole === "admin") return INVITE_ROLE_OPTIONS;
  if (actorRole === "manager") {
    return INVITE_ROLE_OPTIONS.filter((option) => option.id === "agent");
  }
  return [];
}

export function getUserManagePermissions(
  actor: Pick<User, "_id" | "role"> | null | undefined,
  target: Pick<User, "_id" | "role">,
): UserManagePermissions {
  if (!actor) {
    return { canEdit: false, canChangeRole: false, canDelete: false };
  }

  const isSelf = actor._id === target._id;

  if (isSelf) {
    return { canEdit: true, canChangeRole: false, canDelete: false };
  }

  if (target.role === "owner") {
    return { canEdit: false, canChangeRole: false, canDelete: false };
  }

  if (actor.role === "owner") {
    return { canEdit: true, canChangeRole: true, canDelete: true };
  }

  if (actor.role === "admin" && ["agent", "manager"].includes(target.role)) {
    return { canEdit: true, canChangeRole: true, canDelete: true };
  }

  if (actor.role === "manager" && target.role === "agent") {
    return { canEdit: true, canChangeRole: true, canDelete: true };
  }

  return { canEdit: false, canChangeRole: false, canDelete: false };
}
