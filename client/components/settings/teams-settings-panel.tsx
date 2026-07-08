"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import TeamsListPanel from "./teams-list-panel";
import NewTeamPanel from "./new-team-panel";
import TeamDetailPanel from "./team-detail-panel";

export default function TeamsSettingsPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const view = searchParams.get("view");
  const teamId = searchParams.get("team");
  const canManage = ["owner", "admin"].includes(user?.role ?? "");

  const goToList = useCallback(() => {
    router.replace("/settings?item=teams", { scroll: false });
  }, [router]);

  const goToNew = useCallback(() => {
    router.replace("/settings?item=teams&view=new", { scroll: false });
  }, [router]);

  const goToTeam = useCallback(
    (id: string) => {
      router.replace(`/settings?item=teams&team=${id}`, { scroll: false });
    },
    [router],
  );

  if (teamId) {
    return <TeamDetailPanel teamId={teamId} onBack={goToList} />;
  }

  if (view === "new") {
    if (!canManage) {
      goToList();
      return null;
    }
    return <NewTeamPanel onBack={goToList} onCreated={(id) => goToTeam(id)} />;
  }

  return <TeamsListPanel onCreateTeam={goToNew} onOpenTeam={goToTeam} canManage={canManage} />;
}
