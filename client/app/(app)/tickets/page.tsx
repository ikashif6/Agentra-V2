"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ticketApi, departmentApi, teamApi } from "@/lib/api";
import { Ticket, Pagination, Department, Team } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const createSchema = z.object({
  ticket_title: z.string().min(1, "Title required").max(200),
  ticket_description: z.string().min(1, "Description required"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});
type CreateForm = z.infer<typeof createSchema>;

function formatDate(str: string) {
  return new Date(str).toLocaleDateString(undefined, { dateStyle: "medium" });
}

const PAGE_SIZE = 15;

export default function TicketsPage() {
  const { user } = useAuth();
  const [tickets,    setTickets]    = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [statusFilter,   setStatusFilter]   = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [deptFilter,     setDeptFilter]     = useState("all");
  const [teamFilter,     setTeamFilter]     = useState("all");
  const [page, setPage] = useState(1);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating,   setCreating]   = useState(false);
  const [createDept, setCreateDept] = useState("none");
  const [createTeam, setCreateTeam] = useState("none");

  // Dept + team lists for filter dropdowns
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams,       setTeams]       = useState<Team[]>([]);

  const isOwner    = user?.role === "owner";
  const isCustomer = user?.role === "customer";
  const isStaff    = ["owner", "admin", "manager", "agent"].includes(user?.role ?? "");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { priority: "medium" },
  });

  // Load department + team lists for filter (staff only)
  useEffect(() => {
    if (!isStaff) return;
    departmentApi.list({ limit: 100 }).then(({ data }) => setDepartments(data.data.departments)).catch(() => {});
    teamApi.list({ limit: 100 }).then(({ data }) => setTeams(data.data.teams)).catch(() => {});
  }, [isStaff]); // eslint-disable-line

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: PAGE_SIZE };
      if (search)                params.search     = search;
      if (statusFilter   !== "all") params.status   = statusFilter;
      if (priorityFilter !== "all") params.priority = priorityFilter;
      if (deptFilter     !== "all") params.department = deptFilter;
      if (teamFilter     !== "all") params.team      = teamFilter;
      const { data } = await ticketApi.list(params);
      setTickets(data.data.tickets);
      setPagination(data.data.pagination);
    } catch { toast.error("Failed to load tickets"); }
    finally { setLoading(false); }
  }, [page, search, statusFilter, priorityFilter, deptFilter, teamFilter]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter, priorityFilter, deptFilter, teamFilter]);
  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const onCreateSubmit = async (values: CreateForm) => {
    setCreating(true);
    try {
      await ticketApi.create({
        ...values,
        department: createDept !== "none" ? createDept : undefined,
        teams: createTeam !== "none" ? [createTeam] : [],
      });
      toast.success("Ticket created");
      setCreateOpen(false);
      reset();
      setCreateDept("none");
      setCreateTeam("none");
      fetchTickets();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create";
      toast.error(msg);
    } finally { setCreating(false); }
  };

  const pages = pagination?.pages ?? 1;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search tickets…" className="pl-9 focus-visible:ring-primary/30"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {/* Status */}
          <Select value={statusFilter} onValueChange={(v: string | null) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="w-36 focus:ring-primary/30">
              <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Priority */}
          <Select value={priorityFilter} onValueChange={(v: string | null) => setPriorityFilter(v ?? "all")}>
            <SelectTrigger className="w-32 focus:ring-primary/30">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Department filter — staff only */}
          {isStaff && departments.length > 0 && (
            <Select value={deptFilter} onValueChange={(v: string | null) => setDeptFilter(v ?? "all")}>
              <SelectTrigger className="w-40 focus:ring-primary/30">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Team filter — staff only */}
          {isStaff && teams.length > 0 && (
            <Select value={teamFilter} onValueChange={(v: string | null) => setTeamFilter(v ?? "all")}>
              <SelectTrigger className="w-36 focus:ring-primary/30">
                <SelectValue placeholder="Team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {!isOwner && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New ticket
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-[10px] border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/[0.06] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)] dark:border-white/[0.06] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            {isCustomer ? "You have no tickets yet." : "No tickets found."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Code</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Title</th>
                {isStaff && <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Department</th>}
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Priority</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {tickets.map((t) => (
                <tr key={t._id} className="hover:bg-accent/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <Link href={`/tickets/${t.ticket_code}`}
                      className="font-mono text-xs font-semibold hover:underline text-primary">
                      {t.ticket_code}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <Link href={`/tickets/${t.ticket_code}`}
                      className="font-medium text-foreground hover:text-primary truncate max-w-[220px] block transition-colors">
                      {t.ticket_title}
                    </Link>
                  </td>
                  {isStaff && (
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {t.department && typeof t.department === "object"
                          ? t.department.name
                          : "-"}
                      </span>
                    </td>
                  )}
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <Badge className={PRIORITY_COLORS[t.priority]} variant="secondary">{PRIORITY_LABELS[t.priority]}</Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge className={STATUS_COLORS[t.status]} variant="secondary">{STATUS_LABELS[t.status]}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground hidden md:table-cell">{formatDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
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

      {/* Create ticket dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create new ticket</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onCreateSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input {...register("ticket_title")} placeholder="Describe the issue briefly"
                className="focus-visible:ring-primary/30" />
              {errors.ticket_title && <p className="text-xs text-destructive">{errors.ticket_title.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea {...register("ticket_description")} placeholder="Provide as much detail as possible…"
                className="min-h-[100px] focus-visible:ring-primary/30" />
              {errors.ticket_description && <p className="text-xs text-destructive">{errors.ticket_description.message}</p>}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Priority */}
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select defaultValue="medium"
                  onValueChange={(v: string | null) => {
                    if (v) reset((prev) => ({ ...prev, priority: v as CreateForm["priority"] }));
                  }}>
                  <SelectTrigger className="focus:ring-primary/30"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Department — staff only */}
              {isStaff && (
                <div className="space-y-1">
                  <Label>Department</Label>
                  <Select value={createDept} onValueChange={(v: string | null) => setCreateDept(v ?? "none")}>
                    <SelectTrigger className="focus:ring-primary/30"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Team — staff only */}
              {isStaff && (
                <div className="space-y-1">
                  <Label>Team</Label>
                  <Select value={createTeam} onValueChange={(v: string | null) => setCreateTeam(v ?? "none")}>
                    <SelectTrigger className="focus:ring-primary/30"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {teams.map((t) => (
                        <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create ticket
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
