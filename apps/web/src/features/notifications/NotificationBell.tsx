import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUser } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import { realtimeEnabled } from '@/lib/supabase';
import type { AppNotification } from '@/lib/types';
import { cn, timeAgo } from '@/lib/utils';

/** In-app notices (e.g. complaint status changes), pushed live via Realtime. */
export function NotificationBell() {
  const user = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    refetchInterval: realtimeEnabled ? false : 60_000,
  });
  const list = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api.page<AppNotification>('/notifications', { pageSize: 8 }),
  });
  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useRealtime<{ title: string }>({
    channel: `notifications-${user.id}`,
    table: 'notifications',
    event: 'INSERT',
    filter: `user_id=eq.${user.id}`,
    onChange: (payload) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      const title = (payload.new as { title?: string }).title;
      if (title) toast(title);
    },
  });

  const count = unread.data?.count ?? 0;
  const items = list.data?.data ?? [];

  return (
    <DropdownMenu onOpenChange={(open) => open && void list.refetch()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
        >
          <Bell />
          {count > 0 && (
            <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAll.mutate()}
              loading={markAll.isPending}
            >
              <CheckCheck /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto p-1">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="items-start gap-3 py-2.5"
                onSelect={() => {
                  if (!n.readAt) markAll.mutate();
                  if (n.link) navigate(n.link);
                }}
              >
                <span
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    n.readAt ? 'bg-transparent' : 'bg-primary',
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{n.title}</span>
                  {n.body && <span className="block text-xs text-muted-foreground">{n.body}</span>}
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {timeAgo(n.createdAt)}
                  </span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
