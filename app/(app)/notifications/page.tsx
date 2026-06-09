"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Notification, NotificationType } from "@/lib/supabase/types";
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  UserPlus,
  CreditCard,
  Megaphone,
  TrendingUp,
  Volume2,
  BellOff,
  Activity,
  ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";

function NotifIcon({ type }: { type: NotificationType }) {
  const cls = "w-4 h-4 shrink-0";
  const map: Record<NotificationType, React.ReactNode> = {
    minutes_80: <AlertTriangle className={cls} />,
    minutes_100: <AlertTriangle className={cls} />,
    campaign_completed: <CheckCircle className={cls} />,
    contact_converted: <TrendingUp className={cls} />,
    qa_alert: <Volume2 className={cls} />,
    team_invite: <UserPlus className={cls} />,
    payment_failed: <CreditCard className={cls} />,
    broadcast: <Megaphone className={cls} />,
    activity: <Activity className={cls} />,
  };
  return <>{map[type] ?? <Bell className={cls} />}</>;
}

function accentClass(type: NotificationType): string {
  if (
    ["minutes_80", "minutes_100", "payment_failed", "qa_alert"].includes(type)
  )
    return "text-amber-500";
  if (type === "broadcast") return "text-blue-500";
  if (type === "team_invite") return "text-violet-500";
  if (type === "contact_converted" || type === "campaign_completed")
    return "text-emerald-500";
  return "text-[#6b6b6b]";
}

function bgClass(type: NotificationType): string {
  if (
    ["minutes_80", "minutes_100", "payment_failed", "qa_alert"].includes(type)
  )
    return "bg-amber-50";
  if (type === "broadcast") return "bg-blue-50";
  if (type === "team_invite") return "bg-violet-50";
  if (type === "contact_converted" || type === "campaign_completed")
    return "bg-emerald-50";
  return "bg-[#f5f5f5]";
}

type Filter = "all" | "unread" | "broadcast" | "activity";

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread" },
  { label: "Broadcasts", value: "broadcast" },
  { label: "Activity", value: "activity" },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/notifications?limit=100");
    if (res.ok) {
      const d = (await res.json()) as
        | Notification[]
        | { notifications: Notification[] };
      const list = Array.isArray(d) ? d : (d.notifications ?? []);
      setNotifications(list);
      // Auto-mark all as read after a brief moment so the user sees the unread state first
      const hasUnread = list.some((n) => !n.read);
      if (hasUnread) {
        setTimeout(async () => {
          await fetch("/api/notifications/read-all", { method: "POST" });
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        }, 1200);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function markAllRead() {
    setMarkingAll(true);
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setMarkingAll(false);
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "broadcast") return n.type === "broadcast";
    if (filter === "activity")
      return (
        n.type === "activity" ||
        n.type === "team_invite" ||
        n.type === "campaign_completed"
      );
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <Badge className="bg-[#0a0a0a] text-white border-transparent text-xs">
                {unreadCount}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-[#6b6b6b]">
            Platform broadcasts, activity log, and workspace alerts.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={markingAll}
          >
            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
            {markingAll ? "Marking…" : "Mark All Read"}
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-[#e8e8e8]">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              filter === f.value
                ? "border-[#0a0a0a] text-[#0a0a0a]"
                : "border-transparent text-[#6b6b6b] hover:text-[#0a0a0a]"
            }`}
          >
            {f.label}
            {f.value === "unread" && unreadCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#0a0a0a] text-white text-[9px] font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <Card className="border-[#e8e8e8]">
        {loading ? (
          <CardContent className="p-0">
            <div className="divide-y divide-[#f0f0f0]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-4">
                  <div className="w-8 h-8 bg-[#f5f5f5] rounded-lg animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="w-48 h-3.5 bg-[#f5f5f5] rounded animate-pulse" />
                    <div className="w-full h-3 bg-[#f5f5f5] rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        ) : filtered.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-20">
            <BellOff className="w-10 h-10 text-[#e0e0e0] mb-3" />
            <p className="text-[#0a0a0a] font-medium mb-1">No notifications</p>
            <p className="text-sm text-[#6b6b6b]">
              {filter === "unread"
                ? "You're all caught up."
                : "Nothing here yet."}
            </p>
          </CardContent>
        ) : (
          <CardContent className="p-0">
            <div className="divide-y divide-[#f0f0f0]">
              {filtered.map((n) => {
                const row = (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                      !n.read ? "bg-[#fafafa]" : ""
                    } ${n.link ? "cursor-pointer hover:bg-[#f5f5f5]" : ""}`}
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                    }}
                  >
                    {/* Icon badge */}
                    <div
                      className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg ${bgClass(n.type)}`}
                    >
                      <span className={accentClass(n.type)}>
                        <NotifIcon type={n.type} />
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className={`text-sm font-semibold leading-tight ${n.read ? "text-[#6b6b6b]" : "text-[#0a0a0a]"}`}
                          >
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0a0a0a] shrink-0" />
                          )}
                        </div>
                        <span
                          className="text-[11px] text-[#9b9b9b] shrink-0 mt-0.5"
                          title={format(new Date(n.created_at), "PPpp")}
                        >
                          {formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <p
                        className={`text-sm mt-0.5 leading-snug ${n.read ? "text-[#9b9b9b]" : "text-[#3a3a3a]"}`}
                      >
                        {n.message}
                      </p>
                      {n.actor_name && (
                        <p className="text-[11px] text-[#b0b0b0] mt-0.5">
                          by {n.actor_name}
                        </p>
                      )}
                    </div>

                    {n.link && (
                      <ChevronRight className="w-4 h-4 text-[#c0c0c0] shrink-0 mt-2" />
                    )}
                  </div>
                );

                return n.link ? (
                  <Link
                    key={n.id}
                    href={n.link}
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                    }}
                  >
                    {row}
                  </Link>
                ) : (
                  <div key={n.id}>{row}</div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {!loading && filtered.length > 0 && (
        <p className="text-xs text-[#9b9b9b] text-center">
          {filtered.length} notification{filtered.length !== 1 ? "s" : ""}
          {filter !== "all" && ` · filtered by "${filter}"`}
        </p>
      )}
    </div>
  );
}
