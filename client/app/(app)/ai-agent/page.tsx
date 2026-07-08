"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ConversationWorkspace } from "@/app/(app)/inbox/inbox-content";

export default function AiAgentPage() {
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
