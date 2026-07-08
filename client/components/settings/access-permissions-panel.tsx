"use client";

import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  PERMISSION_MATRIX,
  WORKSPACE_ROLES,
  type PermissionLevel,
} from "@/lib/user-roles";
import type { Role } from "@/lib/types";

const MATRIX_ROLES: Role[] = ["owner", "admin", "agent", "customer"];

const ROLE_COLUMN: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  agent: "Agent",
  customer: "Customer",
};

export default function AccessPermissionsPanel() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Roles & permissions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Four built-in roles. Assign admin or agent when inviting someone from Users.
          </p>
        </div>
        <Link href="/settings?item=users" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Manage users
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/60 px-5 py-3">
          <p className="text-sm font-medium text-foreground">Roles</p>
        </div>
        <dl className="divide-y divide-border/40">
          {WORKSPACE_ROLES.map((role) => (
            <div key={role.id} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[180px_1fr] sm:gap-6">
              <dt className="text-sm font-medium text-foreground">{role.label}</dt>
              <dd className="text-sm text-muted-foreground">{role.summary}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/80 bg-card">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border/60">
              <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Capability</th>
              {MATRIX_ROLES.map((role) => (
                <th
                  key={role}
                  className="px-3 py-3 text-center text-xs font-medium text-muted-foreground"
                >
                  {ROLE_COLUMN[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {PERMISSION_MATRIX.map((row) => (
              <tr key={row.id}>
                <td className="px-5 py-3 font-medium text-foreground">{row.label}</td>
                {MATRIX_ROLES.map((role) => (
                  <td key={role} className="px-3 py-3 text-center">
                    <PermissionCell level={row.levels[role]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Permissions are fixed per role and cannot be customized yet.
      </p>
    </div>
  );
}

function PermissionCell({ level }: { level: PermissionLevel }) {
  if (level === "full") {
    return (
      <span className="inline-flex justify-center" title="Included">
        <Check className="size-4 text-foreground" strokeWidth={2} aria-hidden />
        <span className="sr-only">Included</span>
      </span>
    );
  }

  if (level === "limited") {
    return <span className="text-xs text-muted-foreground">Partial</span>;
  }

  return (
    <span className="inline-flex justify-center" title="Not included">
      <Minus className="size-4 text-muted-foreground/35" strokeWidth={2} aria-hidden />
      <span className="sr-only">Not included</span>
    </span>
  );
}
