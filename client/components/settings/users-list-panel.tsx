"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpDown, Loader2, MoreHorizontal, Search, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usersApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import { getUserManagePermissions, ROLE_DISPLAY } from "@/lib/user-roles";
import type { Pagination, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import EditUserDialog from "./edit-user-dialog";

const PAGE_SIZE = 15;

function initials(user: User) {
  const first = user.firstName?.[0] ?? "";
  const last = user.lastName?.[0] ?? "";
  return `${first}${last}`.toUpperCase() || "?";
}

function displayName(user: User) {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  if (!name || name === "-") return user.email;
  return name;
}

type UsersListPanelProps = {
  currentUser: User | null;
  onCreateUser: () => void;
  canInvite: boolean;
  onUserUpdated?: () => void | Promise<void>;
};

export default function UsersListPanel({
  currentUser,
  onCreateUser,
  canInvite,
  onUserUpdated,
}: UsersListPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await usersApi.listWorkspace(search, page, PAGE_SIZE);
      setUsers(data.data.users);
      setPagination(data.data.pagination);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      await usersApi.remove(deleteUser._id);
      toast.success(`${displayName(deleteUser)} removed from workspace`);
      setDeleteUser(null);
      fetchUsers();
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not remove user");
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const pages = pagination?.pages ?? 1;
  const planHint = "Agentra Pro includes unlimited members, tickets, and all features.";
  const canManageAny = ["owner", "admin"].includes(currentUser?.role ?? "");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Users</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{planHint}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users…"
              className="pl-9"
            />
          </div>
          {canInvite ? (
            <Button onClick={onCreateUser}>Create user</Button>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div
          className={cn(
            "grid gap-4 border-b border-border/60 bg-muted/20 px-5 py-3",
            canManageAny
              ? "grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_40px]"
              : "grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)]",
          )}
        >
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            User
            <ArrowUpDown className="size-3 opacity-50" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Email
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Role
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            2FA
          </span>
          {canManageAny ? <span className="sr-only">Actions</span> : null}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">
            {search ? "No users match your search." : "No workspace users yet."}
            {canInvite && !search ? (
              <div className="mt-3">
                <Button onClick={onCreateUser}>Create your first user</Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {users.map((user) => {
              const roleMeta = ROLE_DISPLAY[user.role] ?? ROLE_DISPLAY.agent;
              const perms = currentUser ? getUserManagePermissions(currentUser, user) : null;
              const showMenu = perms && (perms.canEdit || perms.canDelete);

              return (
                <div
                  key={user._id}
                  className={cn(
                    "grid items-center gap-4 px-5 py-3.5",
                    canManageAny
                      ? "grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_40px]"
                      : "grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)]",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative shrink-0">
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-brand-muted text-xs font-bold text-primary">
                          {initials(user)}
                        </AvatarFallback>
                      </Avatar>
                      {user.isOnline ? (
                        <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white bg-emerald-500" />
                      ) : null}
                    </div>
                    <p className="truncate text-sm font-medium text-foreground">{displayName(user)}</p>
                  </div>

                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>

                  <Badge
                    variant="outline"
                    className={cn("w-fit text-[10px] font-semibold uppercase tracking-wide", roleMeta.badgeClass)}
                  >
                    {roleMeta.label}
                  </Badge>

                  <Badge
                    variant="outline"
                    className="w-fit text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Not enabled
                  </Badge>

                  {canManageAny ? (
                    <div className="flex justify-end">
                      {showMenu ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon-sm" aria-label={`Manage ${displayName(user)}`} />
                            }
                          >
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {perms.canEdit ? (
                              <DropdownMenuItem onClick={() => setEditUser(user)}>
                                <Settings2 />
                                Manage user
                              </DropdownMenuItem>
                            ) : null}
                            {perms.canDelete ? (
                              <DropdownMenuItem variant="destructive" onClick={() => setDeleteUser(user)}>
                                <Trash2 />
                                Remove user
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {pagination && pagination.pages > 1 ? (
          <div className="flex items-center justify-between border-t border-border/60 bg-muted/10 px-5 py-3">
            <span className="text-xs text-muted-foreground">
              {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, pagination.total)} of{" "}
              {pagination.total}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <EditUserDialog
        user={editUser}
        actor={currentUser}
        open={!!editUser}
        onOpenChange={(open) => {
          if (!open) setEditUser(null);
        }}
        onSaved={async () => {
          await fetchUsers();
          if (editUser && currentUser && editUser._id === currentUser._id) {
            await onUserUpdated?.();
          }
        }}
        onRemove={setDeleteUser}
      />

      <Dialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove user</DialogTitle>
            <DialogDescription>
              {deleteUser
                ? `${displayName(deleteUser)} will lose access to this workspace. Their account will be deactivated.`
                : "This user will lose access to this workspace."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteUser(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Remove user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
