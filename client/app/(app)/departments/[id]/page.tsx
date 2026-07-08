"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Loader2, Users, Crown, UserPlus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { departmentApi } from "@/lib/api";
import { Department, Team, User } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import Link from "next/link";
import UserPicker from "@/components/shared/UserPicker";

function initials(u: User) { return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase(); }

export default function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [department, setDepartment] = useState<Department | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // team create
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamDesc, setTeamDesc] = useState("");
  const [teamLead, setTeamLead] = useState<User | null>(null);
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);

  // heads
  const [headPickerOpen, setHeadPickerOpen] = useState(false);
  const [removingHead, setRemovingHead] = useState<string | null>(null);

  const isOwnerAdmin = ["owner", "admin"].includes(user?.role ?? "");
  const isHead = department?.heads.some((h) => h._id === user?._id) ?? false;
  const canManage = isOwnerAdmin || isHead;

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await departmentApi.get(id);
      setDepartment(data.data.department);
      setTeams(data.data.teams);
    } catch { toast.error("Department not found"); router.push("/departments"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [id]); // eslint-disable-line

  const handleAddHead = async (u: User) => {
    try {
      await departmentApi.addHead(id, u._id);
      toast.success(`${u.firstName} added as department head`);
      fetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed";
      toast.error(msg);
    }
  };

  const handleRemoveHead = async (userId: string) => {
    setRemovingHead(userId);
    try {
      await departmentApi.removeHead(id, userId);
      toast.success("Department head removed");
      fetch();
    } catch { toast.error("Failed to remove"); }
    finally { setRemovingHead(null); }
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) { toast.error("Team name required"); return; }
    if (!teamLead) { toast.error("Please select a team lead"); return; }
    setCreating(true);
    try {
      await departmentApi.createTeam(id, { name: teamName, description: teamDesc, teamLead: teamLead._id });
      toast.success("Team created");
      setCreateTeamOpen(false);
      setTeamName(""); setTeamDesc(""); setTeamLead(null);
      fetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed";
      toast.error(msg);
    } finally { setCreating(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!department) return null;

  const headIds = department.heads.map((h) => h._id);

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => router.push("/departments")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gray-800 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back to departments
      </button>

      {/* Dept header */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-foreground">{department.name}</h2>
            {department.description && <p className="text-sm text-muted-foreground mt-1">{department.description}</p>}
          </div>
          {canManage && (
            <Button onClick={() => setCreateTeamOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" /> New team
            </Button>
          )}
        </div>

        {/* Heads section */}
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground/80">Department Heads</p>
            {isOwnerAdmin && (
              <Button size="sm" variant="outline" onClick={() => setHeadPickerOpen(true)}
                className="h-7 text-xs">
                <UserPlus className="h-3 w-3 mr-1" /> Add head
              </Button>
            )}
          </div>
          {department.heads.length === 0 ? (
            <p className="text-xs text-muted-foreground">No heads assigned yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {department.heads.map((h) => (
                <div key={h._id}
                  className="flex items-center gap-2 bg-brand-muted border border-brand-muted px-3 py-1.5 rounded-full">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[10px] font-bold bg-primary text-primary-foreground">
                      {initials(h)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-[#D85A30]">{h.firstName} {h.lastName}</span>
                  {isOwnerAdmin && (
                    <button
                      onClick={() => handleRemoveHead(h._id)}
                      disabled={removingHead === h._id}
                      className="ml-0.5 text-orange-300 hover:text-red-500 transition-colors"
                    >
                      {removingHead === h._id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <UserMinus className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Teams */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground/80">Teams ({teams.length})</h3>
        {teams.length === 0 ? (
          <div className="bg-card rounded-xl border border-border/60 shadow-sm p-8 text-center">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No teams in this department yet</p>
            {canManage && (
              <Button onClick={() => setCreateTeamOpen(true)} className="mt-3" size="sm">
                Create first team
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((team) => (
              <Link key={team._id} href={`/teams/${team._id}`}
                className="bg-card rounded-xl border border-border/60 shadow-sm p-4 hover:border-[#D85A30] hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">{team.name}</h4>
                  <Badge variant="secondary" className="text-xs">{team.members.length} members</Badge>
                </div>
                {team.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{team.description}</p>}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-2 border-t border-gray-50">
                  <Crown className="h-3 w-3 text-primary" />
                  <span>{team.teamLead.firstName} {team.teamLead.lastName}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Head picker */}
      <UserPicker
        open={headPickerOpen}
        onOpenChange={setHeadPickerOpen}
        title="Add department head"
        scope="staff"
        excludeIds={headIds}
        onSelect={handleAddHead}
      />

      {/* Create team dialog */}
      <Dialog open={createTeamOpen} onOpenChange={setCreateTeamOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create team in {department.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Team name</Label>
              <Input value={teamName} onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Frontend Support" className="focus-visible:ring-primary/30" />
            </div>
            <div className="space-y-1">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input value={teamDesc} onChange={(e) => setTeamDesc(e.target.value)}
                placeholder="What does this team handle?" className="focus-visible:ring-primary/30" />
            </div>

            {/* Team lead picker */}
            <div className="space-y-1">
              <Label>Team Lead</Label>
              {teamLead ? (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-brand-muted bg-brand-muted">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs font-bold bg-primary text-primary-foreground">
                      {initials(teamLead)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{teamLead.firstName} {teamLead.lastName}</p>
                    <p className="text-xs text-muted-foreground">{teamLead.email}</p>
                  </div>
                  <button onClick={() => setTeamLead(null)} className="text-muted-foreground hover:text-red-500 text-xs">
                    Change
                  </button>
                </div>
              ) : (
                <Button variant="outline" type="button" className="w-full justify-start text-muted-foreground"
                  onClick={() => setLeadPickerOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" /> Select team lead
                </Button>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setCreateTeamOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateTeam} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create team
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lead picker */}
      <UserPicker
        open={leadPickerOpen}
        onOpenChange={setLeadPickerOpen}
        title="Select team lead"
        scope="staff"
        onSelect={(u) => { setTeamLead(u); setLeadPickerOpen(false); }}
      />
    </div>
  );
}
