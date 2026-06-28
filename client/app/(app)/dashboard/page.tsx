"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ticket, AlertCircle, CheckCircle, Clock, TrendingUp, Building2, Users, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { ticketApi } from "@/lib/api";
import { Ticket as TicketType } from "@/lib/types";
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/constants";

interface StatusMap { [key: string]: number }
interface NameCount { _id: string; name: string; count: number }
interface DashStats {
  byStatus:     StatusMap;
  byDepartment: NameCount[];
  byTeam:       NameCount[];
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  open:        <AlertCircle className="h-5 w-5" />,
  in_progress: <Clock className="h-5 w-5" />,
  resolved:    <CheckCircle className="h-5 w-5" />,
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [recent,   setRecent]   = useState<TicketType[]>([]);
  const [stats,    setStats]    = useState<DashStats | null>(null);
  const [loading,  setLoading]  = useState(true);

  const isStaff = ["owner", "admin", "agent"].includes(user?.role ?? "");

  useEffect(() => {
    const loadAll = async () => {
      try {
        // Recent tickets
        const ticketsRes = await ticketApi.list({ limit: 6 });
        setRecent(ticketsRes.data.data.tickets);

        // Stats — staff only
        if (isStaff) {
          const statsRes = await ticketApi.dashboardStats();
          setStats(statsRes.data.data);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    loadAll();
  }, [isStaff]);

  const total  = stats ? Object.values(stats.byStatus).reduce((a, b) => a + b, 0) : 0;
  const open   = stats?.byStatus?.open ?? 0;
  const inProg = stats?.byStatus?.in_progress ?? 0;
  const solved = (stats?.byStatus?.resolved ?? 0) + (stats?.byStatus?.closed ?? 0);

  const STAT_CARDS = [
    { label: "Total",       value: total,  icon: <Ticket className="h-5 w-5" />,       color: "text-blue-600",   bg: "bg-blue-50" },
    { label: "Open",        value: open,   icon: <AlertCircle className="h-5 w-5" />,   color: "text-primary", bg: "bg-brand-muted" },
    { label: "In Progress", value: inProg, icon: <Clock className="h-5 w-5" />,         color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Resolved",    value: solved, icon: <CheckCircle className="h-5 w-5" />,   color: "text-green-600",  bg: "bg-green-50" },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{greeting}, {user?.firstName} 👋</h2>
        <p className="text-sm text-gray-400 mt-0.5">Here&apos;s what&apos;s happening in your workspace today.</p>
      </div>

      {/* Stats row — staff only */}
      {isStaff && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STAT_CARDS.map((s) => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {loading ? "—" : s.value}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg} ${s.color}`}>
                    {s.icon}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dept + Team breakdown row — staff only */}
      {isStaff && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* By Department */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" style={{ color: "#D85A30" }} />
                  Tickets by Department
                </CardTitle>
                <Link href="/departments" className="text-xs hover:underline" style={{ color: "#D85A30" }}>
                  Manage <ArrowRight className="inline h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {stats.byDepartment.length === 0 ? (
                <p className="px-5 pb-4 text-xs text-gray-400">No department-assigned tickets yet</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {stats.byDepartment.map((d) => (
                    <Link
                      key={d._id}
                      href={`/tickets?department=${d._id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors group"
                    >
                      <span className="text-sm text-gray-700 group-hover:text-[#D85A30] transition-colors truncate">
                        {d.name}
                      </span>
                      <Badge variant="secondary" className="text-xs ml-3 shrink-0">{d.count}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Team */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" style={{ color: "#D85A30" }} />
                  Tickets by Team
                </CardTitle>
                <Link href="/teams" className="text-xs hover:underline" style={{ color: "#D85A30" }}>
                  Manage <ArrowRight className="inline h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {stats.byTeam.length === 0 ? (
                <p className="px-5 pb-4 text-xs text-gray-400">No team-assigned tickets yet</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {stats.byTeam.map((t) => (
                    <Link
                      key={t._id}
                      href={`/tickets?team=${t._id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors group"
                    >
                      <span className="text-sm text-gray-700 group-hover:text-[#D85A30] transition-colors truncate">
                        {t.name}
                      </span>
                      <Badge variant="secondary" className="text-xs ml-3 shrink-0">{t.count}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent tickets */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Tickets</CardTitle>
            <Link href="/tickets" className="text-sm font-medium hover:underline flex items-center gap-1"
              style={{ color: "#D85A30" }}>
              View all <TrendingUp className="h-3.5 w-3.5" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-400">Loading…</div>
          ) : recent.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">No tickets yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recent.map((t) => (
                <Link key={t._id} href={`/tickets/${t.ticket_code}`}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-semibold shrink-0" style={{ color: "#D85A30" }}>
                      {t.ticket_code}
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate group-hover:text-[#D85A30] transition-colors">
                      {t.ticket_title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Badge className={PRIORITY_COLORS[t.priority]} variant="secondary">
                      {PRIORITY_LABELS[t.priority]}
                    </Badge>
                    <Badge className={STATUS_COLORS[t.status]} variant="secondary">
                      {STATUS_LABELS[t.status]}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
