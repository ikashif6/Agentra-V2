"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Crown, UserPlus, UserMinus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { teamApi } from "@/lib/api";
import { Team, User } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import UserPicker from "@/components/shared/UserPicker";

function initials(u: { firstName: string; lastName: string }) {
  return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
}

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const isOwnerAdmin = ["owner", "admin"].includes(user?.role ?? "");
  const isLead = team?.teamLead._id === user?._id;
  const canManage = isOwnerAdmin || isLead;

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await teamApi.get(id);
      setTeam(data.data.team);
    } catch { toast.error("Team not found"); router.push("/teams"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [id]); // eslint-disable-line

  const handleAddMember = async (u: User) => {
    try {
      await teamApi.addMember(id, u._id);
      toast.success(`${u.firstName} added to team`);
      fetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed";
      toast.error(msg);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Remove this member?")) return;
    setRemoving(userId);
    try {
      await teamApi.removeMember(id, userId);
      toast.success("Member removed");
      fetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed";
      toast.error(msg);
    } finally { setRemoving(null); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!team) return null;

  const memberIds = team.members.map((m) => m.user._id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button onClick={() => router.push("/teams")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gray-800 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back to teams
      </button>

      {/* Header card */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-foreground">{team.name}</h2>
            {team.description && <p className="text-sm text-muted-foreground mt-1">{team.description}</p>}
            {typeof team.department === "object" && team.department && (
              <p className="text-xs text-muted-foreground mt-1">Dept: <span className="text-gray-600">{team.department.name}</span></p>
            )}
          </div>
          {canManage && (
            <Button onClick={() => setPickerOpen(true)} size="sm">
              <UserPlus className="h-4 w-4 mr-2" /> Add member
            </Button>
          )}
        </div>

        {/* Team lead card */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-muted border border-brand-muted">
          <Crown className="h-4 w-4 shrink-0 text-primary" />
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-xs font-bold bg-primary text-primary-foreground">
              {initials(team.teamLead)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-primary">
              {team.teamLead.firstName} {team.teamLead.lastName}
            </p>
            <p className="text-xs text-orange-400">Team Lead</p>
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="rounded-[10px] border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground/80">
            Members
            <Badge variant="secondary" className="ml-2">{team.members.length}</Badge>
          </h3>
        </div>

        {team.members.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No members yet</div>
        ) : (
          <div className="divide-y divide-border/40">
            {team.members.map((m, i) => {
              const isTeamLead = m.user._id === team.teamLead._id;
              const isMe = m.user._id === user?._id;
              return (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs font-semibold"
                        className="bg-brand-muted text-primary">
                        {initials(m.user)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {m.user.firstName} {m.user.lastName}
                        {isMe && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isTeamLead && (
                      <Badge className="text-xs bg-brand-muted text-primary border-brand-muted">Lead</Badge>
                    )}
                    <Badge variant="secondary" className="text-xs capitalize">{m.user.role}</Badge>
                    {canManage && !isTeamLead && (
                      <button onClick={() => handleRemove(m.user._id)} disabled={removing === m.user._id}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground/50 hover:text-red-400 transition-colors">
                        {removing === m.user._id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <UserMinus className="h-3.5 w-3.5" />}
                      </button>
                    )}
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
