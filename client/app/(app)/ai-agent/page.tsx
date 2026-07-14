"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ConversationWorkspace } from "@/app/(app)/inbox/inbox-content";
import { useAuth } from "@/contexts/AuthContext";

export default function AiAgentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canViewAiAgent = ["owner", "admin", "manager"].includes(user?.role ?? "");

  useEffect(() => {
    if (user && !canViewAiAgent) {
      router.replace("/inbox");
    }
  }, [user, canViewAiAgent, router]);

  if (!canViewAiAgent) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      }
    >
      <ConversationWorkspace scope="live_chat" />
    </Suspense>
  );
}
