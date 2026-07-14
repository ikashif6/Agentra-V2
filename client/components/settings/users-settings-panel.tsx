"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import UsersListPanel from "./users-list-panel";
import NewUserPanel from "./new-user-panel";

export default function UsersSettingsPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUser } = useAuth();

  const view = searchParams.get("view");
  const isNewUser = view === "new";
  const canInvite = ["owner", "admin", "manager"].includes(user?.role ?? "");

  const goToList = useCallback(() => {
    router.replace("/settings?item=users", { scroll: false });
  }, [router]);

  const goToNew = useCallback(() => {
    router.replace("/settings?item=users&view=new", { scroll: false });
  }, [router]);

  if (isNewUser) {
    if (!canInvite) {
      goToList();
      return null;
    }
    return <NewUserPanel onBack={goToList} onCreated={goToList} />;
  }

  return (
    <UsersListPanel
      currentUser={user}
      onCreateUser={goToNew}
      canInvite={canInvite}
      onUserUpdated={refreshUser}
    />
  );
}
