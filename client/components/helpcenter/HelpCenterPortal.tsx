"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { helpCenterApi } from "@/lib/api";
import type { HelpCenter } from "@/lib/types";
import { ClassicLayout } from "./portal/ClassicLayout";
import { SidebarLayout } from "./portal/SidebarLayout";
import { CardsLayout } from "./portal/CardsLayout";

/** Resolve subdomain from URL or query param */
function getSubdomain(searchParams: URLSearchParams): string {
  const ws = searchParams.get("workspace");
  if (ws) return ws;

  if (typeof window === "undefined") return "";

  const host = window.location.hostname;
  // help.acme.agentraa.com → "acme"
  if (host.startsWith("help.")) {
    const withoutHelp = host.slice("help.".length);
    const firstPart = withoutHelp.split(".")[0];
    return firstPart || "";
  }
  return "";
}

export default function HelpCenterPortal() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [helpCenter, setHelpCenter] = useState<HelpCenter | null>(null);
  const [subdomain, setSubdomain] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sd = getSubdomain(searchParams);
    setSubdomain(sd);
    if (!sd) {
      setError("Help center not found. Please check the URL.");
      setLoading(false);
      return;
    }
    helpCenterApi
      .getPublic(sd)
      .then(({ data }) => setHelpCenter(data.data.helpCenter))
      .catch((err) => {
        const msg = err?.response?.data?.message ?? "Help center not found or not published.";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#E8470A]" />
      </div>
    );
  }

  if (error || !helpCenter) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <h1 className="text-xl font-semibold text-gray-800">Help center not available</h1>
        <p className="text-sm text-gray-500 max-w-sm">
          {error ?? "This help center doesn't exist or hasn't been published yet."}
        </p>
      </div>
    );
  }

  const props = { hc: helpCenter, subdomain };
  if (helpCenter.layout === "sidebar") return <SidebarLayout {...props} />;
  if (helpCenter.layout === "cards")   return <CardsLayout {...props} />;
  return <ClassicLayout {...props} />;
}
