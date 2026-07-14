import type { Role, User } from "@/lib/types";

/** Roles that can be assigned when inviting a new workspace member. */
export type InvitableRole = "agent" | "admin";

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
      "Works in the inbox, replies to customers, and updates tickets across connected channels.",
  },
  {
    id: "admin",
    label: "Workspace admin",
    description:
      "Everything a support agent can do, plus user invites, workspace settings, and channel configuration.",
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
    id: "agent",
    label: "Support agent",
    summary: "Inbox, tickets, and day-to-day customer replies.",
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
    levels: { owner: "full", admin: "full", agent: "full", customer: "limited" },
  },
  {
    id: "teams",
    label: "Teams",
    levels: { owner: "full", admin: "full", agent: "limited", customer: "none" },
  },
  {
    id: "users",
    label: "Users",
    levels: { owner: "full", admin: "full", agent: "none", customer: "none" },
  },
  {
    id: "channels",
    label: "Channels",
    levels: { owner: "full", admin: "full", agent: "none", customer: "none" },
  },
  {
    id: "billing",
    label: "Billing",
    levels: { owner: "full", admin: "none", agent: "none", customer: "none" },
  },
  {
    id: "settings",
    label: "Settings",
    levels: { owner: "full", admin: "full", agent: "none", customer: "none" },
  },
  {
    id: "analytics",
    label: "Analytics",
    levels: { owner: "full", admin: "full", agent: "none", customer: "none" },
  },
];

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "-" };
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

  if (actor.role === "admin" && target.role === "agent") {
    return { canEdit: true, canChangeRole: true, canDelete: true };
  }

  return { canEdit: false, canChangeRole: false, canDelete: false };
}
