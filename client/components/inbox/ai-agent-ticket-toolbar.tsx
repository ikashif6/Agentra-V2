"use client";

import { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  GitMerge,
  List,
  ListFilter,
  Mail,
  MessageSquarePlus,
  MoreHorizontal,
  Printer,
  Search,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Team, Ticket, TicketPriority, TicketStatus, User } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/constants";
import { PriorityIcon, TICKET_PRIORITY_OPTIONS } from "@/lib/ticket-priority";
import { TicketSourceBadge } from "@/lib/ticket-source";
import { cn } from "@/lib/utils";
import { formatUserDisplayName, userInitials } from "@/lib/user-display";

function agentName(user?: User | null) {
  if (!user) return "Unassigned";
  return formatUserDisplayName(user, "Unassigned");
}

function initials(user?: User | null) {
  return userInitials(user);
}

type AiAgentTicketToolbarProps = {
  ticket: Ticket;
  currentUser?: User | null;
  agents: User[];
  teams: Team[];
  onPriorityChange: (priority: TicketPriority) => void;
  onAssign: (agentId: string | null) => void;
  onTeamChange: (teamId: string | null) => void;
  onStatusChange: (status: TicketStatus) => void;
  onMarkUnread: () => void;
  onTrash: () => void;
  onTransfer: (agent: User) => void;
  onPrint: () => void;
  busy?: boolean;
};

export function LiveChatTicketToolbar({
  ticket,
  currentUser,
  agents,
  teams,
  onPriorityChange,
  onAssign,
  onTeamChange,
  onStatusChange,
  onMarkUnread,
  onTrash,
  onTransfer,
  onPrint,
  busy,
}: AiAgentTicketToolbarProps) {
  const [assignSearch, setAssignSearch] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [transferSearch, setTransferSearch] = useState("");

  const assigned =
    ticket.assigned_agent && typeof ticket.assigned_agent === "object"
      ? ticket.assigned_agent
      : null;

  const currentTeam =
    ticket.teams?.[0] && typeof ticket.teams[0] === "object" ? ticket.teams[0] : null;

  const filteredAgents = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (agent) =>
        `${agent.firstName} ${agent.lastName}`.toLowerCase().includes(q) ||
        agent.email.toLowerCase().includes(q),
    );
  }, [agents, assignSearch]);

  const filteredTeams = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((team) => team.name.toLowerCase().includes(q));
  }, [teams, teamSearch]);

  const transferAgents = useMemo(() => {
    const q = transferSearch.trim().toLowerCase();
    return agents.filter((agent) => {
      if (assigned && agent._id === assigned._id) return false;
      if (!q) return true;
      return (
        `${agent.firstName} ${agent.lastName}`.toLowerCase().includes(q) ||
        agent.email.toLowerCase().includes(q)
      );
    });
  }, [agents, assigned, transferSearch]);

  const isResolved = ["resolved", "closed", "self_closed"].includes(ticket.status);

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 px-3 py-2">
      <TicketSourceBadge source={ticket.source} />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5" disabled={busy} />}
        >
          <PriorityIcon priority={ticket.priority} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44 p-1">
          {TICKET_PRIORITY_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              className="flex items-center gap-2.5 px-3 py-2"
              onClick={() => onPriorityChange(option.value)}
            >
              <option.icon className={cn("size-4", option.iconClassName)} />
              <span className="flex-1">{option.label}</span>
              {ticket.priority === option.value ? <Check className="size-3.5 text-primary" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu onOpenChange={(open) => !open && setAssignSearch("")}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-8 max-w-[150px] gap-1.5 px-2.5"
              disabled={busy}
            />
          }
        >
          <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs">{agentName(assigned)}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 p-0">
          <div className="border-b border-border/60 p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                placeholder="Search agents…"
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
          {currentUser?.role === "agent" ? (
            <DropdownMenuItem
              className="gap-2.5 px-3 py-2"
              onClick={() => onAssign(currentUser._id)}
            >
              <Avatar className="size-6">
                <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                  {initials(currentUser)}
                </AvatarFallback>
              </Avatar>
              Take conversation
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem className="px-3 py-2 text-muted-foreground" onClick={() => onAssign(null)}>
            Unassigned
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="max-h-48 overflow-y-auto p-1">
            {filteredAgents.map((agent) => (
              <DropdownMenuItem
                key={agent._id}
                className="gap-2.5 px-3 py-2"
                onClick={() => onAssign(agent._id)}
              >
                <Avatar className="size-6">
                  <AvatarFallback className="bg-muted text-[10px]">
                    {initials(agent)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {agentName(agent)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{agent.email}</p>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu onOpenChange={(open) => !open && setTeamSearch("")}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-8 max-w-[140px] gap-1.5 px-2.5"
              disabled={busy}
            />
          }
        >
          <Users className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs">{currentTeam?.name ?? "No team"}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 p-0">
          <div className="border-b border-border/60 p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder="Search teams…"
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
          <DropdownMenuItem className="px-3 py-2 text-muted-foreground" onClick={() => onTeamChange(null)}>
            No team
          </DropdownMenuItem>
          <div className="max-h-48 overflow-y-auto p-1">
            {filteredTeams.map((team) => (
              <DropdownMenuItem
                key={team._id}
                className="gap-2 px-3 py-2"
                onClick={() => onTeamChange(team._id)}
              >
                <Users className="size-3.5 text-muted-foreground" />
                {team.name}
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {!isResolved ? (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs"
          disabled={busy}
          onClick={() => onStatusChange("resolved")}
        >
          <CheckCircle2 className="size-3.5 shrink-0 text-muted-foreground" />
          Resolve
        </Button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" disabled={busy} />
          }
        >
          <ListFilter className="size-3.5 shrink-0 text-muted-foreground" />
          Change status
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 p-1">
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <DropdownMenuItem
              key={value}
              className="flex items-center justify-between px-3 py-2"
              onClick={() => onStatusChange(value as TicketStatus)}
            >
              <span>{label}</span>
              {ticket.status === value ? <Check className="size-3.5 text-primary" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu onOpenChange={(open) => !open && setTransferSearch("")}>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" className="size-8" disabled={busy} />}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 p-1">
          <DropdownMenuItem className="gap-2.5 px-3 py-2" onClick={() => toast.message("Merge ticket is coming soon")}>
            <GitMerge className="size-4 text-muted-foreground" />
            Merge ticket
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 px-3 py-2" onClick={onMarkUnread}>
            <Mail className="size-4 text-muted-foreground" />
            Mark as unread
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 px-3 py-2" onClick={() => toast.message("Activity timeline is coming soon")}>
            <List className="size-4 text-muted-foreground" />
            Show all events
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 px-3 py-2" onClick={() => toast.message("Quick replies are coming soon")}>
            <MessageSquarePlus className="size-4 text-muted-foreground" />
            Show quick replies
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2.5 px-3 py-2" onClick={onPrint}>
            <Printer className="size-4 text-muted-foreground" />
            Print ticket
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Transfer to</p>
          <div className="border-t border-border/60 p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={transferSearch}
                onChange={(e) => setTransferSearch(e.target.value)}
                placeholder="Search agent…"
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto p-1">
            {transferAgents.map((agent) => (
              <DropdownMenuItem
                key={agent._id}
                className="gap-2 px-3 py-2"
                onClick={() => onTransfer(agent)}
              >
                {agentName(agent)}
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={busy}
        onClick={onTrash}
        aria-label="Move to trash"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

/** @deprecated Use LiveChatTicketToolbar */
export const AiAgentTicketToolbar = LiveChatTicketToolbar;
