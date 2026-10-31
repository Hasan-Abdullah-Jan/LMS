import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { ArrowLeft, Loader2, MessagesSquare, RotateCw, Send, Trash2 } from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { RoleBadge } from '@/components/common/badges';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/misc';
import { useUser } from '@/features/auth/AuthProvider';
import { api, errorMessage, request } from '@/lib/api';
import { useRealtime } from '@/lib/realtime';
import { realtimeEnabled } from '@/lib/supabase';
import type { ChatMessage, Course, CourseMember, Role } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';

interface MessagePage {
  data: ChatMessage[];
  meta: { hasMore: boolean; nextBefore: string | null };
}

interface PendingMessage {
  tempId: string;
  body: string;
  status: 'sending' | 'failed';
  error?: string;
}

type MessageRow = {
  id: string;
  course_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
};

const DELETE_WINDOW_MS = 5 * 60 * 1000;

function upsertMessage(
  data: InfiniteData<MessagePage> | undefined,
  message: ChatMessage,
): InfiniteData<MessagePage> | undefined {
  if (!data || data.pages.length === 0) return data;
  const exists = data.pages.some((p) => p.data.some((m) => m.id === message.id));
  if (exists) {
    return {
      ...data,
      pages: data.pages.map((p) => ({
        ...p,
        data: p.data.map((m) =>
          m.id === message.id ? { ...m, ...message, sender: message.sender ?? m.sender } : m,
        ),
      })),
    };
  }
  const [newest, ...rest] = data.pages;
  return {
    ...data,
    pages: [
      {
        ...newest!,
        data: [...newest!.data, message].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      },
      ...rest,
    ],
  };
}

function MessagePane({ course }: { course: Course }) {
  const user = useUser();
  const queryClient = useQueryClient();
  const key = useMemo(() => ['messages', course.id], [course.id]);
  const scroller = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const prevHeight = useRef<number | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<PendingMessage[]>([]);

  const members = useQuery({
    queryKey: ['members', course.id],
    queryFn: () =>
      api.get<{ teachers: CourseMember[]; students: CourseMember[] }>(
        `/courses/${course.id}/members`,
      ),
  });
  const people = useMemo(() => {
    const map = new Map<string, { id: string; fullName: string; role: Role }>();
    for (const p of [...(members.data?.teachers ?? []), ...(members.data?.students ?? [])])
      map.set(p.id, { id: p.id, fullName: p.fullName, role: p.role });
    return map;
  }, [members.data]);

  const history = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) =>
      request<MessagePage>(`/courses/${course.id}/messages`, {
        query: { limit: 50, before: pageParam },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.meta.hasMore ? (last.meta.nextBefore ?? undefined) : undefined,
    refetchInterval: realtimeEnabled ? false : 4000,
  });

  const messages = useMemo(
    () => (history.data ? [...history.data.pages].reverse().flatMap((p) => p.data) : []),
    [history.data],
  );

  useRealtime<MessageRow>({
    channel: `chat-${course.id}`,
    table: 'chat_messages',
    filter: `course_id=eq.${course.id}`,
    onChange: (payload) => {
      if (payload.eventType === 'DELETE') return;
      const row = payload.new as MessageRow;
      const message: ChatMessage = {
        id: row.id,
        courseId: row.course_id,
        senderId: row.sender_id,
        sender: people.get(row.sender_id) ?? null,
        body: row.deleted_at ? null : row.body,
        createdAt: row.created_at,
        deletedAt: row.deleted_at,
      };
      queryClient.setQueryData<InfiniteData<MessagePage>>(key, (data) =>
        upsertMessage(data, message),
      );
      if (payload.eventType === 'INSERT' && !people.has(row.sender_id)) void members.refetch();
    },
  });

  // Keep the view pinned to the bottom when the user is already there; keep position when loading older messages.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current !== null) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, pending.length]);

  useEffect(() => {
    const sentinel = topSentinel.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && history.hasNextPage && !history.isFetchingNextPage) {
          prevHeight.current = scroller.current?.scrollHeight ?? null;
          void history.fetchNextPage();
        }
      },
      { root: scroller.current, rootMargin: '120px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [history]);

  const send = async (body: string, tempId: string) => {
    setPending((list) => [
      ...list.filter((p) => p.tempId !== tempId),
      { tempId, body, status: 'sending' },
    ]);
    atBottom.current = true;
    try {
      const saved = await api.post<ChatMessage>(`/courses/${course.id}/messages`, { body });
      queryClient.setQueryData<InfiniteData<MessagePage>>(key, (data) =>
        upsertMessage(data, saved),
      );
      setPending((list) => list.filter((p) => p.tempId !== tempId));
    } catch (error) {
      setPending((list) =>
        list.map((p) =>
          p.tempId === tempId ? { ...p, status: 'failed', error: errorMessage(error) } : p,
        ),
      );
    }
  };

  const onSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    if (body.length > 2000) return toast.error('Messages can be at most 2,000 characters.');
    setDraft('');
    void send(body, `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  };

  const remove = async (message: ChatMessage) => {
    try {
      await api.delete(`/messages/${message.id}`);
      queryClient.setQueryData<InfiniteData<MessagePage>>(key, (data) =>
        upsertMessage(data, { ...message, body: null, deletedAt: new Date().toISOString() }),
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const canDelete = (m: ChatMessage) =>
    !m.deletedAt &&
    (user.role === 'admin' ||
      user.role === 'teacher' ||
      (m.senderId === user.id && Date.now() - new Date(m.createdAt).getTime() < DELETE_WINDOW_MS));
  const canPost = user.role !== 'admin';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Link
          to="/chat"
          className="rounded-md p-1 hover:bg-muted lg:hidden"
          aria-label="Back to chats"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {course.code} · {course.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {course.teachers.length + course.studentCount} members{realtimeEnabled ? ' · live' : ''}
          </p>
        </div>
      </div>

      <div
        ref={scroller}
        className="scrollbar-thin min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4 sm:px-5"
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        aria-live="polite"
        aria-label="Messages"
      >
        <div ref={topSentinel} />
        {history.isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {history.isPending ? (
          <ListSkeleton rows={4} />
        ) : history.isError ? (
          <ErrorState error={history.error} onRetry={() => void history.refetch()} />
        ) : messages.length === 0 && pending.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No messages yet"
            description={
              canPost
                ? 'Start the conversation with your class.'
                : 'This classroom has no messages yet.'
            }
            className="border-0 bg-transparent"
          />
        ) : (
          <>
            {!history.hasNextPage && messages.length > 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                This is the beginning of the conversation.
              </p>
            )}
            {messages.map((m, i) => {
              const mine = m.senderId === user.id;
              const sender = m.sender ?? people.get(m.senderId);
              const grouped =
                i > 0 &&
                messages[i - 1]!.senderId === m.senderId &&
                new Date(m.createdAt).getTime() - new Date(messages[i - 1]!.createdAt).getTime() <
                  5 * 60_000;
              return (
                <div
                  key={m.id}
                  className={cn(
                    'group flex gap-2.5',
                    mine && 'flex-row-reverse',
                    !grouped && 'pt-3',
                  )}
                >
                  <div className="w-8 shrink-0">
                    {!grouped && <UserAvatar name={sender?.fullName ?? '?'} className="size-8" />}
                  </div>
                  <div className={cn('flex max-w-[78%] flex-col', mine && 'items-end')}>
                    {!grouped && (
                      <div
                        className={cn(
                          'mb-1 flex items-center gap-1.5 text-xs',
                          mine && 'flex-row-reverse',
                        )}
                      >
                        <span className="font-semibold">
                          {mine ? 'You' : (sender?.fullName ?? 'Former member')}
                        </span>
                        {sender && sender.role !== 'student' && <RoleBadge role={sender.role} />}
                        <span className="text-muted-foreground" title={formatDateTime(m.createdAt)}>
                          {new Date(m.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
                    <div className={cn('flex items-center gap-1', mine && 'flex-row-reverse')}>
                      {m.deletedAt ? (
                        <p className="rounded-2xl border border-dashed px-3.5 py-2 text-sm text-muted-foreground italic">
                          This message was deleted
                        </p>
                      ) : (
                        // Rendered as plain text: React escapes HTML, so markup in messages can never execute.
                        <p
                          className={cn(
                            'rounded-2xl px-3.5 py-2 text-sm break-words whitespace-pre-wrap',
                            mine
                              ? 'rounded-tr-sm bg-primary text-primary-foreground'
                              : 'rounded-tl-sm bg-muted',
                          )}
                        >
                          {m.body}
                        </p>
                      )}
                      {canDelete(m) && (
                        <button
                          onClick={() => void remove(m)}
                          className="rounded p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                          aria-label="Delete message"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {pending.map((p) => (
              <div key={p.tempId} className="flex flex-row-reverse gap-2.5 pt-1">
                <div className="w-8" />
                <div className="flex max-w-[78%] flex-col items-end gap-1">
                  <p
                    className={cn(
                      'rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm whitespace-pre-wrap',
                      p.status === 'failed'
                        ? 'border border-destructive/40 bg-destructive/5'
                        : 'bg-primary/70 text-primary-foreground',
                    )}
                  >
                    {p.body}
                  </p>
                  {p.status === 'sending' ? (
                    <span className="text-xs text-muted-foreground">Sending…</span>
                  ) : (
                    <span className="flex items-center gap-2 text-xs text-destructive">
                      {p.error ?? 'Not sent'}
                      <button
                        className="flex items-center gap-1 font-medium underline"
                        onClick={() => void send(p.body, p.tempId)}
                      >
                        <RotateCw className="size-3" /> Retry
                      </button>
                      <button
                        className="text-muted-foreground underline"
                        onClick={() => setPending((l) => l.filter((x) => x.tempId !== p.tempId))}
                      >
                        Discard
                      </button>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {canPost ? (
        <form onSubmit={onSubmit} className="flex items-end gap-2 border-t p-3">
          <Textarea
            aria-label="Message"
            rows={1}
            value={draft}
            maxLength={2000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
            className="max-h-36 min-h-10 resize-none"
          />
          <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send message">
            <Send />
          </Button>
        </form>
      ) : (
        <p className="border-t p-3 text-center text-xs text-muted-foreground">
          Administrators can read classroom chats but not post.
        </p>
      )}
    </div>
  );
}

export function ChatPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const courses = useQuery({
    queryKey: ['my-courses'],
    queryFn: () => api.get<Course[]>('/me/courses'),
  });
  const selected = courses.data?.find((c) => c.id === courseId);

  useEffect(() => {
    if (!courseId && courses.data?.length && window.matchMedia('(min-width: 1024px)').matches) {
      navigate(`/chat/${courses.data[0]!.id}`, { replace: true });
    }
  }, [courseId, courses.data, navigate]);

  return (
    <div className="-my-2 flex h-[calc(100dvh-8rem)] overflow-hidden rounded-xl border bg-card shadow-xs">
      <aside className={cn('w-full shrink-0 border-r lg:block lg:w-72', courseId && 'hidden')}>
        <div className="border-b px-4 py-3.5">
          <h1 className="font-semibold">Classroom chat</h1>
        </div>
        <nav aria-label="Course chats" className="overflow-y-auto p-2">
          {courses.isPending ? (
            <ListSkeleton rows={3} />
          ) : courses.isError ? (
            <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />
          ) : courses.data.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">You are not a member of any course.</p>
          ) : (
            courses.data.map((c) => (
              <Link
                key={c.id}
                to={`/chat/${c.id}`}
                aria-current={c.id === courseId ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-muted',
                  c.id === courseId && 'bg-muted',
                )}
              >
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  aria-hidden
                >
                  <MessagesSquare className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.code}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.title}</p>
                </div>
              </Link>
            ))
          )}
        </nav>
      </aside>
      <section
        className={cn(
          'min-w-0 flex-1',
          !courseId && 'hidden lg:flex lg:items-center lg:justify-center',
        )}
      >
        {selected ? (
          <MessagePane key={selected.id} course={selected} />
        ) : courseId && courses.data ? (
          <div className="p-6">
            <EmptyState
              icon={MessagesSquare}
              title="Chat not available"
              description="You are not a member of this course."
            />
          </div>
        ) : (
          <EmptyState
            icon={MessagesSquare}
            title="Select a course"
            description="Pick a course on the left to open its classroom chat."
            className="border-0"
          />
        )}
      </section>
    </div>
  );
}
