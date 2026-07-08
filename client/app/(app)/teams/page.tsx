"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, Users, ChevronRight, Crown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { teamApi } from "@/lib/api";
import { Team } from "@/lib/types";
import { toast } from "sonner";

const PAGE_SIZE = 10;

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await teamApi.list({ page, limit: PAGE_SIZE, search: search.trim() });
      setTeams(data.data.teams);
      setTotal(data.data.pagination?.total ?? 0);
    } catch { toast.error("Failed to load teams"); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { fetch(); }, [fetch]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search teams…" className="pl-9 focus-visible:ring-primary/30"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-[10px] border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_32px] gap-4 px-5 py-3 border-b border-border/60 bg-muted/30">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Team</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lead</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Department</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Members</span>
          <span />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-sm text-muted-foreground">
            <Users className="h-8 w-8 text-muted-foreground/30" />
            {search ? "No teams match your search." : "No teams yet. Create one from a department."}
            {!search && (
              <Link href="/departments" className="text-sm font-medium hover:underline text-primary">
                Go to Departments →
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {teams.map((team) => (
              <Link key={team._id} href={`/teams/${team._id}`}
                className="grid grid-cols-[2fr_2fr_1fr_1fr_32px] gap-4 items-center px-5 py-4 hover:bg-accent/30 transition-colors group">
                {/* Team name */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary truncate transition-colors">
                    {team.name}
                  </p>
                  {team.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{team.description}</p>
                  )}
                </div>

                {/* Lead */}
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="text-[10px] font-bold bg-primary text-primary-foreground">
                      {team.teamLead.firstName[0]}{team.teamLead.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-foreground/80 truncate">
                    {team.teamLead.firstName} {team.teamLead.lastName}
                  </span>
                  <Crown className="h-3 w-3 shrink-0 text-primary" />
                </div>

                {/* Department */}
                <span className="text-xs text-muted-foreground truncate">
                  {typeof team.department === "object" ? team.department?.name : "-"}
                </span>

                {/* Members */}
                <Badge variant="secondary" className="text-xs w-fit">
                  {team.members.length} member{team.members.length !== 1 ? "s" : ""}
                </Badge>

                <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
        )}

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
    </div>
  );
}
