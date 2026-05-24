'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Notification, NotificationType } from '@/lib/supabase/types';
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
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

function notificationIcon(type: NotificationType) {
  const iconProps = { className: 'w-5 h-5 shrink-0' };
  const map: Record<NotificationType, React.ReactNode> = {
    minutes_80:          <AlertTriangle {...iconProps} />,
    minutes_100:         <AlertTriangle {...iconProps} />,
    campaign_completed:  <CheckCircle {...iconProps} />,
    contact_converted:   <TrendingUp {...iconProps} />,
    qa_alert:            <Volume2 {...iconProps} />,
    team_invite:         <UserPlus {...iconProps} />,
    payment_failed:      <CreditCard {...iconProps} />,
    broadcast:           <Megaphone {...iconProps} />,
  };
  return map[type] ?? <Bell {...iconProps} />;
}

function notificationAccent(type: NotificationType): string {
  const warnings: NotificationType[] = ['minutes_80', 'minutes_100', 'payment_failed', 'qa_alert'];
  if (warnings.includes(type)) return 'text-[#0a0a0a]';
  return 'text-[#6b6b6b]';
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/notifications?limit=100');
    if (res.ok) {
      const d = await res.json() as { notifications: Notification[] };
      setNotifications(d.notifications ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  async function markAllRead() {
    setMarkingAll(true);
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setMarkingAll(false);
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Notifications</h1>
            {unreadCount > 0 && (
              <Badge className="bg-[#0a0a0a] text-white border-transparent">
                {unreadCount}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-[#6b6b6b]">Stay up to date with your workspace activity.</p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={markingAll}
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            {markingAll ? 'Marking…' : 'Mark All Read'}
          </Button>
        )}
      </div>

      <Card>
        {loading ? (
          <CardContent className="p-0">
            <div className="divide-y divide-[#e0e0e0]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-4">
                  <div className="w-5 h-5 bg-[#f5f5f5] rounded animate-pulse shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="w-48 h-4 bg-[#f5f5f5] rounded animate-pulse" />
                    <div className="w-full h-3 bg-[#f5f5f5] rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        ) : notifications.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-20">
            <BellOff className="w-12 h-12 text-[#e0e0e0] mb-4" />
            <p className="text-[#0a0a0a] font-medium mb-1">No notifications</p>
            <p className="text-sm text-[#6b6b6b]">You're all caught up. Notifications will appear here.</p>
          </CardContent>
        ) : (
          <CardContent className="p-0">
            <div className="divide-y divide-[#e0e0e0]">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 px-5 py-4 transition-colors cursor-pointer hover:bg-[#f5f5f5] ${
                    !notification.read ? 'bg-[#fafafa]' : ''
                  }`}
                  onClick={() => { if (!notification.read) markRead(notification.id); }}
                >
                  {/* Unread dot */}
                  <div className="relative shrink-0 mt-0.5">
                    <span className={notificationAccent(notification.type)}>
                      {notificationIcon(notification.type)}
                    </span>
                    {!notification.read && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#0a0a0a]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className={`text-sm font-medium ${notification.read ? 'text-[#6b6b6b]' : 'text-[#0a0a0a]'}`}>
                        {notification.title}
                      </p>
                      <span
                        className="text-xs text-[#6b6b6b] shrink-0"
                        title={format(new Date(notification.created_at), 'PPpp')}
                      >
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className={`text-sm mt-0.5 ${notification.read ? 'text-[#6b6b6b]' : 'text-[#0a0a0a]'}`}>
                      {notification.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {!loading && notifications.length > 0 && (
        <p className="mt-3 text-xs text-[#6b6b6b] text-center">
          Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
