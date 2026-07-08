"use client";

import ProfileSettings from "@/components/settings/profile-settings";
import { useAuth } from "@/contexts/AuthContext";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="pb-6">
        <h2 className="text-xl font-bold text-foreground">Profile</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {user?.firstName} {user?.lastName} · {user?.email}
        </p>
      </div>
      <ProfileSettings />
    </div>
  );
}
