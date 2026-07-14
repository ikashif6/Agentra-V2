"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Loader2, Building2, ChevronRight, Trash2, Crown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { departmentApi } from "@/lib/api";
import { Department, User } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { toast } from "sonner";

const PAGE_SIZE = 10;

function initials(u: User) { return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase(); }

export default function DepartmentsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const isOwnerAdmin = ["owner", "admin"].includes(user?.role ?? "");
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await departmentApi.list({ page, limit: PAGE_SIZE, search: search.trim() });
      setDepartments(data.data.departments);
      setTotal(data.data.pagination?.total ?? 0);
    } catch { toast.error("Failed to load departments"); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { fetch(); }, [fetch]);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setCreating(true);
    try {
      await departmentApi.create({ name: form.name, description: form.description });
      toast.success("Department created");
      setCreateOpen(false);
      setForm({ name: "", description: "" });
      fetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed";
      toast.error(msg);
    } finally { setCreating(false); }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    const ok = await confirm({
      title: "Deactivate department?",
      description: "All teams inside this department will also be deactivated.",
      confirmLabel: "Deactivate",
    });
    if (!ok) return;
    try {
      await departmentApi.delete(id);
      toast.success("Department deactivated");
      fetch();
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 justify-between flex-wrap">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search departments…" className="pl-9 focus-visible:ring-primary/30"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {isOwnerAdmin && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New department
          </Button>
        )}
      </div>

      {/* List */}
      <div className="rounded-[10px] border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[2fr_3fr_1fr_40px] gap-4 px-5 py-3 border-b border-border/60 bg-muted/30">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Department</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Heads</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
          <span />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground gap-2">
            <Building2 className="h-8 w-8 text-muted-foreground/30" />
            {search ? "No departments match your search." : "No departments yet."}
            {isOwnerAdmin && !search && (
              <Button onClick={() => setCreateOpen(true)} className="mt-2">
                Create first department
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {departments.map((dept) => (
              <Link key={dept._id} href={`/departments/${dept._id}`}
                className="grid grid-cols-[2fr_3fr_1fr_40px] gap-4 items-center px-5 py-4 hover:bg-accent/30 transition-colors group">
                {/* Name */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {dept.name}
                  </p>
                  {dept.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{dept.description}</p>
                  )}
                </div>

                {/* Heads */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {dept.heads.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No heads assigned</span>
                  ) : (
                    dept.heads.slice(0, 3).map((h) => (
                      <div key={h._id} className="flex items-center gap-1.5 bg-brand-muted px-2 py-1 rounded-full">
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[9px] font-bold bg-primary text-primary-foreground">
                            {initials(h)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-primary font-medium whitespace-nowrap">
                          {h.firstName} {h.lastName}
                        </span>
                        <Crown className="h-2.5 w-2.5 text-orange-300" />
                      </div>
                    ))
                  )}
                  {dept.heads.length > 3 && (
                    <Badge variant="secondary" className="text-xs">+{dept.heads.length - 3}</Badge>
                  )}
                </div>

                {/* Status */}
                <Badge variant="secondary"
                  className={dept.isActive ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-100 text-muted-foreground"}>
                  {dept.isActive ? "Active" : "Inactive"}
                </Badge>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1">
                  {isOwnerAdmin && (
                    <button onClick={(e) => handleDelete(dept._id, e)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-muted-foreground/50 hover:text-red-400 transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border/60 bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create department</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Technical Support" className="focus-visible:ring-primary/30" autoFocus />
            </div>
            <div className="space-y-1">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this department handle?" className="focus-visible:ring-primary/30" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
