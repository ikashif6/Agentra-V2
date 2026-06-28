"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import HelpCenterPortal from "@/components/helpcenter/HelpCenterPortal";

export default function HelpCenterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#D85A30]" />
        </div>
      }
    >
      <HelpCenterPortal />
    </Suspense>
  );
}
