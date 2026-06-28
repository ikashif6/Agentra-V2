"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usersApi } from "@/lib/api";
import { User } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  /** 'staff' = admin+agent only (default), 'members' = all non-owner */
  scope?: "staff" | "members";
  /** Optionally pre-exclude already-selected user ids */
  excludeIds?: string[];
  onSelect: (user: User) => void;
  /** Allow picking multiple users at once */
  multi?: boolean;
  confirmLabel?: string;
}

function initials(u: User) {
  return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
}

export default function UserPicker({
  open,
  onOpenChange,
  title,
  scope = "staff",
  excludeIds = [],
  onSelect,
  multi = false,
  confirmLabel = "Confirm",
}: Props) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<User[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = async (q: string) => {
    setLoading(true);
    try {
      const fn = scope === "staff" ? usersApi.searchStaff : usersApi.searchMembers;
      const { data } = await fn(q);
      setUsers(data.data.users.filter((u: User) => !excludeIds.includes(u._id)));
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) { setSearch(""); setUsers([]); setSelected([]); return; }
    fetchUsers("");
  }, [open]); // eslint-disable-line

  useEffect(() => {
    if (!open) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchUsers(search), 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [search]); // eslint-disable-line

  const toggle = (u: User) => {
    if (!multi) {
      onSelect(u);
      onOpenChange(false);
      return;
    }
    setSelected((prev) =>
      prev.some((s) => s._id === u._id) ? prev.filter((s) => s._id !== u._id) : [...prev, u]
    );
  };

  const confirm = () => {
    selected.forEach((u) => onSelect(u));
    onOpenChange(false);
  };

  const ROLE_COLOR: Record<string, string> = {
    admin: "bg-purple-50 text-purple-700 border-purple-100",
    agent: "bg-blue-50 text-blue-700 border-blue-100",
    customer: "bg-gray-50 text-gray-600 border-gray-100",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-5 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              autoFocus
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 focus-visible:ring-[#E8470A]"
            />
          </div>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-72 px-2 pb-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#E8470A" }} />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">
              {search ? "No users found" : "No staff members yet"}
            </p>
          ) : (
            users.map((u) => {
              const isSelected = selected.some((s) => s._id === u._id);
              return (
                <button
                  key={u._id}
                  onClick={() => toggle(u)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback
                      className="text-xs font-semibold"
                      style={{ background: "#FFF0EB", color: "#E8470A" }}
                    >
                      {initials(u)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`text-xs capitalize ${ROLE_COLOR[u.role] ?? ""}`} variant="secondary">
                      {u.role}
                    </Badge>
                    {multi && isSelected && (
                      <Check className="h-4 w-4" style={{ color: "#E8470A" }} />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Multi confirm */}
        {multi && (
          <div className="px-5 pb-5 pt-2 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">{selected.length} selected</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" disabled={selected.length === 0} onClick={confirm}
                style={{ background: "#E8470A" }}>
                {confirmLabel}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
