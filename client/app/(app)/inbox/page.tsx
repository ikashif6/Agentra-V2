"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import InboxPage from "./inbox-content";

export default function InboxRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      }
    >
      <InboxPage />
    </Suspense>
  );
}
