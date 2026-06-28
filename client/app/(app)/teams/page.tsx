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
    <div className="space-y-4">
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Search teams…" className="pl-9 focus-visible:ring-[#E8470A]"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_32px] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Team</span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lead</span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Department</span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Members</span>
          <span />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#E8470A" }} />
          </div>
        ) : teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-sm text-gray-400">
            <Users className="h-8 w-8 text-gray-200" />
            {search ? "No teams match your search." : "No teams yet. Create one from a department."}
            {!search && (
              <Link href="/departments" className="text-sm font-medium hover:underline" style={{ color: "#E8470A" }}>
                Go to Departments →
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {teams.map((team) => (
              <Link key={team._id} href={`/teams/${team._id}`}
                className="grid grid-cols-[2fr_2fr_1fr_1fr_32px] gap-4 items-center px-5 py-4 hover:bg-gray-50 transition-colors group">
                {/* Team name */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-[#E8470A] truncate transition-colors">
                    {team.name}
                  </p>
                  {team.description && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{team.description}</p>
                  )}
                </div>

                {/* Lead */}
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="text-[10px] font-bold" style={{ background: "#E8470A", color: "white" }}>
                      {team.teamLead.firstName[0]}{team.teamLead.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-gray-700 truncate">
                    {team.teamLead.firstName} {team.teamLead.lastName}
                  </span>
                  <Crown className="h-3 w-3 shrink-0" style={{ color: "#E8470A" }} />
                </div>

                {/* Department */}
                <span className="text-xs text-gray-500 truncate">
                  {typeof team.department === "object" ? team.department?.name : "—"}
                </span>

                {/* Members */}
                <Badge variant="secondary" className="text-xs w-fit">
                  {team.members.length} member{team.members.length !== 1 ? "s" : ""}
                </Badge>

                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#E8470A] transition-colors" />
              </Link>
            ))}
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-400">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
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
