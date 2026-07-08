"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Loader2, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { teamApi } from "@/lib/api";
import type { Team } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function initials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

type TeamsListPanelProps = {
  onCreateTeam: () => void;
  onOpenTeam: (id: string) => void;
  canManage: boolean;
};

export default function TeamsListPanel({ onCreateTeam, onOpenTeam, canManage }: TeamsListPanelProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await teamApi.list({ limit: 100 });
      setTeams(data.data.teams);
    } catch {
      toast.error("Failed to load teams");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Teams</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Group workspace members into teams to control default inbox views, routing, and
            collaboration.
          </p>
        </div>
        {canManage ? (
          <Button onClick={onCreateTeam}>Create team</Button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-6 py-14 text-center">
          <UsersRound className="mx-auto size-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">No teams yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a team to organize agents around shared queues and responsibilities.
          </p>
          {canManage ? (
            <Button onClick={onCreateTeam} className="mt-4">
              Create your first team
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          {teams.map((team) => (
            <TeamRow key={team._id} team={team} onOpen={() => onOpenTeam(team._id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamRow({ team, onOpen }: { team: Team; onOpen: () => void }) {
  const memberCount = team.members?.length ?? 0;
  const previewMembers = (team.members ?? []).slice(0, 3);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-xl border border-border/80 bg-card px-4 py-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-primary/20 hover:bg-muted/10"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
        <UsersRound className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{team.name}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {previewMembers.map((member, index) => (
              <Avatar key={member.user._id} className={cn("size-6 border-2 border-white", index > 0 && "")}>
                <AvatarFallback className="bg-brand-muted text-[10px] font-bold text-primary">
                  {initials(member.user.firstName, member.user.lastName)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {memberCount} member{memberCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/70 text-muted-foreground">
        <ChevronRight className="size-4" />
      </span>
    </button>
  );
}
