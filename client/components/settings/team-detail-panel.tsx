"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Crown, Loader2, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import UserPicker from "@/components/shared/UserPicker";
import { teamApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type { Team, User } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";

function initials(u: { firstName: string; lastName: string }) {
  return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
}

type TeamDetailPanelProps = {
  teamId: string;
  onBack: () => void;
};

export default function TeamDetailPanel({ teamId, onBack }: TeamDetailPanelProps) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await teamApi.get(teamId);
      setTeam(data.data.team);
    } catch {
      toast.error("Team not found");
      onBack();
    } finally {
      setLoading(false);
    }
  }, [teamId, onBack]);

  useEffect(() => {
    load();
  }, [load]);

  const isOwnerAdmin = ["owner", "admin", "manager"].includes(user?.role ?? "");
  const isLead = team?.teamLead._id === user?._id;
  const canManage = isOwnerAdmin || isLead;

  const handleAddMember = async (selected: User) => {
    try {
      await teamApi.addMember(teamId, selected._id);
      toast.success(`${selected.firstName} added to team`);
      load();
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to add member");
      toast.error(message);
    }
  };

  const handleRemove = async (userId: string) => {
    const ok = await confirm({
      title: "Remove team member?",
      description: "They will lose access to conversations routed to this team.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    setRemoving(userId);
    try {
      await teamApi.removeMember(teamId, userId);
      toast.success("Member removed");
      load();
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to remove member");
      toast.error(message);
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!team) return null;

  const memberIds = team.members.map((m) => m.user._id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-border/60 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-lg border border-border/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Back to teams"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold text-foreground">{team.name}</h2>
          {typeof team.department === "object" && team.department ? (
            <p className="text-xs text-muted-foreground">Group: {team.department.name}</p>
          ) : null}
        </div>
      </div>

      {team.description ? (
        <p className="text-sm text-muted-foreground">{team.description}</p>
      ) : null}

      <div className="flex items-center gap-3 rounded-xl border border-brand-muted bg-brand-muted/50 p-4">
        <Crown className="size-4 shrink-0 text-primary" />
        <Avatar className="size-9">
          <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
            {initials(team.teamLead)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {team.teamLead.firstName} {team.teamLead.lastName}
          </p>
          <p className="text-xs text-muted-foreground">Team lead</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/[0.06] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)] dark:border-white/[0.06] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Members
            <Badge variant="secondary" className="ml-2">
              {team.members.length}
            </Badge>
          </h3>
          {canManage ? (
            <Button size="sm" onClick={() => setPickerOpen(true)}>
              <UserPlus className="mr-2 size-4" />
              Add member
            </Button>
          ) : null}
        </div>

        {team.members.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No members yet</p>
        ) : (
          <div className="divide-y divide-border/40">
            {team.members.map((member) => {
              const isTeamLead = member.user._id === team.teamLead._id;
              const isMe = member.user._id === user?._id;
              return (
                <div key={member.user._id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-brand-muted text-xs font-semibold text-primary">
                        {initials(member.user)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {member.user.firstName} {member.user.lastName}
                        {isMe ? (
                          <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isTeamLead ? (
                      <Badge className="border-brand-muted bg-brand-muted text-primary">Lead</Badge>
                    ) : null}
                    <Badge variant="secondary" className="text-xs capitalize">
                      {member.user.role}
                    </Badge>
                    {canManage && !isTeamLead ? (
                      <button
                        type="button"
                        onClick={() => handleRemove(member.user._id)}
                        disabled={removing === member.user._id}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        {removing === member.user._id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <UserMinus className="size-3.5" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <UserPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={`Add member to ${team.name}`}
        scope="staff"
        excludeIds={memberIds}
        onSelect={handleAddMember}
      />
    </div>
  );
}
