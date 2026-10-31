import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ClipboardList, FileText, Megaphone, PenSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SubmissionStatusBadge, QuizStatusBadge } from '@/components/common/badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { AnnouncementCard } from '@/features/announcements/AnnouncementCard';
import { api } from '@/lib/api';
import type { Announcement, Assignment, Quiz, Resource } from '@/lib/types';
import { formatDateTime, timeAgo } from '@/lib/utils';
import { useCourse } from './useCourse';

export function CourseOverview() {
  const course = useCourse();
  const assignments = useQuery({
    queryKey: ['assignments', course.id],
    queryFn: () => api.page<Assignment>(`/courses/${course.id}/assignments`, { pageSize: 100 }),
  });
  const quizzes = useQuery({
    queryKey: ['quizzes', course.id],
    queryFn: () => api.page<Quiz>(`/courses/${course.id}/quizzes`),
  });
  const resources = useQuery({
    queryKey: ['resources', course.id, '', 1],
    queryFn: () => api.page<Resource>(`/courses/${course.id}/resources`, { pageSize: 5 }),
  });
  const announcements = useQuery({
    queryKey: ['announcements', 'feed', course.id, 1],
    queryFn: () => api.page<Announcement>('/announcements', { courseId: course.id, pageSize: 3 }),
  });

  const upcoming = (assignments.data?.data ?? [])
    .filter((a) => new Date(a.dueAt) > new Date())
    .slice(0, 5);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {course.description && (
          <Card>
            <CardHeader>
              <CardTitle>About this course</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{course.description}</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" /> Upcoming assignments
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="assignments">All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {assignments.isPending ? (
              <Skeleton className="h-20" />
            ) : upcoming.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No upcoming deadlines.
              </p>
            ) : (
              <ul className="divide-y">
                {upcoming.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link to={`/assignments/${a.id}`} className="font-medium hover:underline">
                        <PenSquare className="mr-1.5 inline size-4 text-muted-foreground" />
                        {a.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Due {formatDateTime(a.dueAt)} · {timeAgo(a.dueAt)}
                      </p>
                    </div>
                    {a.status && <SubmissionStatusBadge status={a.status} />}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-4 text-muted-foreground" /> Quizzes
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="quizzes">All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {quizzes.isPending ? (
              <Skeleton className="h-16" />
            ) : (quizzes.data?.data.length ?? 0) === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No quizzes yet.</p>
            ) : (
              <ul className="divide-y">
                {quizzes.data!.data.slice(0, 4).map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link to={`/quizzes/${q.id}`} className="font-medium hover:underline">
                        {q.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {q.questionCount} questions · {q.timeLimitMinutes} min · closes{' '}
                        {formatDateTime(q.closesAt)}
                      </p>
                    </div>
                    {q.status ? <QuizStatusBadge status={q.status} /> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" /> Latest resources
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="resources">All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {resources.isPending ? (
              <Skeleton className="h-16" />
            ) : (resources.data?.data.length ?? 0) === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No resources uploaded yet.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {resources.data!.data.map((r) => (
                  <li key={r.id} className="truncate">
                    · {r.title}{' '}
                    <span className="text-xs text-muted-foreground">({timeAgo(r.createdAt)})</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="size-4 text-muted-foreground" /> Announcements
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="announcements">All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(announcements.data?.data ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No course announcements.
              </p>
            ) : (
              announcements.data!.data.map((a) => (
                <AnnouncementCard key={a.id} announcement={a} compact />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
