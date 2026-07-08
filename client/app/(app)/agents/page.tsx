"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, UserPlus, Loader2, Mail, ShieldCheck, Headset } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usersApi } from "@/lib/api";
import { User, Pagination } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const PAGE_SIZE = 15;

const inviteSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName:  z.string().min(1, "Required"),
  email:     z.string().email("Valid email required"),
});
type InviteForm = z.infer<typeof inviteSchema>;

function initials(u: User) { return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase(); }

const ROLE_ICON: Record<string, React.ReactNode> = {
  admin: <ShieldCheck className="h-3.5 w-3.5" />,
  agent: <Headset className="h-3.5 w-3.5" />,
};
const ROLE_STYLE: Record<string, string> = {
  admin: "bg-purple-50 text-purple-700 border-purple-100",
  agent: "bg-blue-50 text-blue-700 border-blue-100",
};

export default function AgentsPage() {
  const { user: me } = useAuth();
  const [users,   setUsers]   = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [search,  setSearch]  = useState("");
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting,   setInviting]   = useState(false);
  const [selectedRole, setSelectedRole] = useState<"agent" | "admin">("agent");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await usersApi.searchStaff(search, page, PAGE_SIZE);
      setUsers(data.data.users);
      setPagination(data.data.pagination);
    } catch { toast.error("Failed to load staff"); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const onInvite = async (values: InviteForm) => {
    setInviting(true);
    try {
      await usersApi.invite({ ...values, role: selectedRole });
      toast.success(`Invitation sent to ${values.email}`);
      setInviteOpen(false);
      reset();
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed";
      toast.error(msg);
    } finally { setInviting(false); }
  };

  const isOwner = me?.role === "owner";
  const pages = pagination ? pagination.pages : 1;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or email…" className="pl-9 focus-visible:ring-primary/30"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {isOwner && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Invite agent
          </Button>
        )}
      </div>

      <div className="rounded-[10px] border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[2.5fr_2.5fr_1fr_1fr] gap-4 px-5 py-3 border-b border-border/60 bg-muted/30">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Member</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Email</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Role</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Title</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2 text-sm text-muted-foreground">
            <UserPlus className="h-8 w-8 text-muted-foreground/30" />
            {search ? "No staff found." : "No agents or admins yet."}
            {isOwner && !search && (
              <Button onClick={() => setInviteOpen(true)} className="mt-2">
                Invite your first agent
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {users.map((u) => (
              <div key={u._id} className="grid grid-cols-[2.5fr_2.5fr_1fr_1fr] gap-4 items-center px-5 py-3.5 hover:bg-accent/30 transition-colors">
                {/* Name + avatar */}
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs font-bold bg-brand-muted text-primary">
                      {initials(u)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-medium text-foreground truncate">
                    {u.firstName} {u.lastName}
                  </p>
                </div>

                {/* Email */}
                <div className="flex items-center gap-1.5 min-w-0 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  <span className="truncate">{u.email}</span>
                </div>

                {/* Role */}
                <Badge className={`text-xs capitalize gap-1 w-fit ${ROLE_STYLE[u.role] ?? ""}`} variant="secondary">
                  {ROLE_ICON[u.role]}
                  {u.role}
                </Badge>

                {/* Job title */}
                <span className="text-xs text-muted-foreground truncate">{u.jobTitle || "-"}</span>
              </div>
            ))}
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border/60 bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Invite a team member</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onInvite)} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First name</Label>
                <Input {...register("firstName")} placeholder="Jane" className="focus-visible:ring-primary/30" />
                {errors.firstName && <p className="text-xs text-red-500">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Last name</Label>
                <Input {...register("lastName")} placeholder="Doe" className="focus-visible:ring-primary/30" />
                {errors.lastName && <p className="text-xs text-red-500">{errors.lastName.message}</p>}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" {...register("email")} placeholder="jane@company.com"
                className="focus-visible:ring-primary/30" />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={selectedRole}
                onValueChange={(v: string | null) => { if (v === "agent" || v === "admin") setSelectedRole(v); }}>
                <SelectTrigger className="focus:ring-primary/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent: handles tickets</SelectItem>
                  <SelectItem value="admin">Admin: full workspace access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-brand-muted border border-brand-muted rounded-lg px-3 py-2.5 text-xs text-brand-muted-foreground">
              An invite email will be sent. They&apos;ll set their password on first login.
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={inviting}>
                {inviting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Send invite
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
