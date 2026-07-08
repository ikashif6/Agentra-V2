"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Inbox } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ticketApi } from "@/lib/api";
import { HomeMetricTile } from "@/components/home/home-metric-tile";

interface StatusMap {
  [key: string]: number;
}

export function HomeMetrics({
  monochrome = false,
  reloadToken = 0,
}: {
  monochrome?: boolean;
  reloadToken?: number;
}) {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatusMap | null>(null);
  const [loading, setLoading] = useState(true);

  const isStaff = ["owner", "admin", "agent"].includes(user?.role ?? "");

  useEffect(() => {
    if (!isStaff) {
      setLoading(false);
      return;
    }

    ticketApi
      .dashboardStats()
      .then(({ data }) => setStats(data.data.byStatus))
      .catch(() => setStats({}))
      .finally(() => setLoading(false));
  }, [isStaff, reloadToken]);

  if (!isStaff) return null;

  const total = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0;
  const open = stats?.open ?? 0;
  const inProg = stats?.in_progress ?? 0;
  const solved = (stats?.resolved ?? 0) + (stats?.closed ?? 0);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <HomeMetricTile
        label="Total tickets"
        value={loading ? "—" : total}
        icon={<Inbox className="size-[18px]" strokeWidth={1.75} />}
        monochrome={monochrome}
      />
      <HomeMetricTile
        label="Open"
        value={loading ? "—" : open}
        icon={<AlertCircle className="size-[18px]" strokeWidth={1.75} />}
        monochrome={monochrome}
      />
      <HomeMetricTile
        label="In progress"
        value={loading ? "—" : inProg}
        icon={<Clock className="size-[18px]" strokeWidth={1.75} />}
        monochrome={monochrome}
      />
      <HomeMetricTile
        label="Resolved"
        value={loading ? "—" : solved}
        icon={<CheckCircle2 className="size-[18px]" strokeWidth={1.75} />}
        monochrome={monochrome}
      />
    </div>
  );
}
