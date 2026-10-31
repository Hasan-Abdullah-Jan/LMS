import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BookOpen,
  ClipboardList,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessagesSquare,
  ShieldAlert,
  User,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Logo } from '@/components/common/misc';
import { Button } from '@/components/ui/button';
import { Dialog, NavSheetContent } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/ui/misc';
import { useAuth, useUser } from '@/features/auth/AuthProvider';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { api } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import { realtimeEnabled } from '@/lib/supabase';
import { ROLE_LABEL, homeFor } from '@/lib/roles';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Bell;
  badge?: 'announcements';
  end?: boolean;
}

const NAV: Record<Role, NavItem[]> = {
  student: [
    { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/courses', label: 'My courses', icon: BookOpen },
    { to: '/announcements', label: 'Announcements', icon: Megaphone, badge: 'announcements' },
    { to: '/marks', label: 'My marks', icon: GraduationCap },
    { to: '/chat', label: 'Classroom chat', icon: MessagesSquare },
    { to: '/complaints', label: 'Complaints', icon: ShieldAlert },
  ],
  teacher: [
    { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/courses', label: 'My classes', icon: BookOpen },
    { to: '/announcements', label: 'Announcements', icon: Megaphone, badge: 'announcements' },
    { to: '/chat', label: 'Classroom chat', icon: MessagesSquare },
    { to: '/complaints', label: 'Complaints', icon: ShieldAlert },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/courses', label: 'Courses', icon: BookOpen },
    { to: '/admin/complaints', label: 'Complaints', icon: ClipboardList },
    { to: '/announcements', label: 'Announcements', icon: Megaphone, badge: 'announcements' },
    { to: '/chat', label: 'Classroom chats', icon: MessagesSquare },
    { to: '/admin/audit', label: 'Audit log', icon: History },
  ],
};

/** Unread announcement count, kept live through Supabase Realtime. */
function useUnreadAnnouncements() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['announcements', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/announcements/unread-count'),
    refetchInterval: realtimeEnabled ? false : 60_000,
  });
  useRealtime({
    channel: 'announcement-badge',
    table: 'announcements',
    event: 'INSERT',
    onChange: () => {
      void queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.info('New announcement posted');
    },
  });
  return query.data?.count ?? 0;
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const user = useUser();
  const unread = useUnreadAnnouncements();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Link
        to={homeFor(user.role)}
        onClick={onNavigate}
        className="flex h-16 items-center px-5 text-white"
      >
        <Logo />
      </Link>
      <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <p className="px-3 pt-2 pb-2 text-[11px] font-semibold tracking-wider text-sidebar-muted uppercase">
          {ROLE_LABEL[user.role]} portal
        </p>
        {NAV[user.role].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                isActive
                  ? 'bg-sidebar-accent text-white shadow-sm'
                  : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn('size-[18px]', isActive && 'text-brand')} aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.badge === 'announcements' && unread > 0 && (
                  <span
                    className="rounded-full bg-brand px-1.5 py-0.5 text-[11px] leading-none font-bold text-[oklch(0.25_0.05_60)]"
                    aria-label={`${unread} unread`}
                  >
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <NavLink
          to="/profile"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-sidebar-accent/60"
        >
          <UserAvatar name={user.fullName} className="size-8" />
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium text-white">{user.fullName}</p>
            <p className="truncate text-xs text-sidebar-muted">{user.email}</p>
          </div>
        </NavLink>
      </div>
    </div>
  );
}

export function AppLayout() {
  const user = useUser();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <NavSheetContent aria-describedby={undefined}>
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </NavSheetContent>
      </Dialog>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
          <Logo compact className="lg:hidden" />
          <div className="flex-1" />
          <ThemeToggle />
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="ml-1 flex items-center gap-2 rounded-full p-0.5 transition hover:ring-2 hover:ring-border"
                aria-label="Account menu"
              >
                <UserAvatar name={user.fullName} className="size-8" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
              <DropdownMenuLabel>
                <p className="truncate font-medium">{user.fullName}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">
                  {ROLE_LABEL[user.role]} · {user.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate('/profile')}>
                <User /> Profile & password
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  await logout();
                  navigate('/login', { replace: true });
                }}
              >
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main
          id="main"
          key={location.pathname.split('/')[1]}
          className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
