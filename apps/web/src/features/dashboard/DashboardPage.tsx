import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  History,
  Megaphone,
  PlayCircle,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader, StatCard } from '@/components/common/page';
import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
import { useUser } from '@/features/auth/AuthProvider';
import { AnnouncementCard } from '@/features/announcements/AnnouncementCard';
import { CourseCard } from '@/features/courses/CourseCard';
import { api } from '@/lib/api';
import type {
  AdminDashboard,
  Announcement,
  Dashboard,
  StudentDashboard,
  TeacherDashboard,
} from '@/lib/types';
import { formatDateTime, formatMarks, timeAgo } from '@/lib/utils';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

function LatestAnnouncements({ items }: { items: Announcement[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-4 text-muted-foreground" /> Latest announcements
        </CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link to="/announcements">View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No announcements yet.</p>
        ) : (
          items.map((a) => <AnnouncementCard key={a.id} announcement={a} compact />)
        )}
      </CardContent>
    </Card>
  );
}

function StudentView({ data }: { data: StudentDashboard }) {
  const pct = data.overall.percentage;
  const dueSoon = data.upcomingAssignments.filter((a) => !a.submitted);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Enrolled courses"
          value={data.courses.length}
          icon={BookOpen}
          to="/courses"
        />
        <StatCard
          label="Due in 14 days"
          value={dueSoon.length}
          hint="Not yet submitted"
          icon={CalendarClock}
          tone="warning"
        />
        <StatCard
          label="Open quizzes"
          value={data.openQuizzes.length}
          icon={PlayCircle}
          tone="info"
        />
        <StatCard
          label="Overall score"
          value={pct === null ? '—' : `${pct}%`}
          hint={`${data.overall.gradedCount} graded items`}
          icon={GraduationCap}
          tone="success"
          to="/marks"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-4 text-muted-foreground" /> Upcoming deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.upcomingAssignments.length === 0 && data.openQuizzes.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nothing due in the next two weeks. 🎉
                </p>
              ) : (
                <ul className="divide-y">
                  {data.openQuizzes.map((q) => (
                    <li key={q.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <Link to={`/quizzes/${q.id}`} className="font-medium hover:underline">
                          {q.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {q.course?.code} · Quiz · closes {timeAgo(q.closesAt)}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="brand">
                        <Link to={`/quizzes/${q.id}`}>Take quiz</Link>
                      </Button>
                    </li>
                  ))}
                  {data.upcomingAssignments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <Link to={`/assignments/${a.id}`} className="font-medium hover:underline">
                          {a.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {a.course?.code} · due {formatDateTime(a.dueAt)} ({timeAgo(a.dueAt)})
                        </p>
                      </div>
                      {a.submitted ? (
                        <Badge variant="success">
                          <CheckCircle2 /> Submitted
                        </Badge>
                      ) : (
                        <Badge variant="warning">To do</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <section aria-labelledby="my-courses">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="my-courses" className="font-semibold">
                My courses
              </h2>
              <Button asChild variant="ghost" size="sm">
                <Link to="/courses">View all</Link>
              </Button>
            </div>
            {data.courses.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No courses yet"
                description="You'll see your courses here once the registrar enrolls you."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {data.courses.slice(0, 4).map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
            )}
          </section>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="size-4 text-muted-foreground" /> Recent marks
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/marks">All marks</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {pct !== null && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Overall</span>
                    <span className="font-semibold">{pct}%</span>
                  </div>
                  <Progress value={pct} indicatorClassName="bg-success" />
                </div>
              )}
              {data.recentMarks.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No graded work yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.recentMarks.map((m) => (
                    <li
                      key={`${m.kind}-${m.itemId}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.course?.code} · {m.kind}
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums">
                        {formatMarks(m.obtained)}/{formatMarks(m.max)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <LatestAnnouncements items={data.announcements} />
        </div>
      </div>
    </>
  );
}

function TeacherView({ data }: { data: TeacherDashboard }) {
  const students = data.courses.reduce((sum, c) => sum + c.studentCount, 0);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="My classes" value={data.courses.length} icon={BookOpen} to="/courses" />
        <StatCard label="Students taught" value={students} icon={Users} tone="info" />
        <StatCard
          label="Waiting for grading"
          value={data.toGradeCount}
          icon={ClipboardCheck}
          tone={data.toGradeCount ? 'warning' : 'success'}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="size-4 text-muted-foreground" /> Grading queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.toGrade.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  All submissions are graded. Nice work!
                </p>
              ) : (
                <ul className="divide-y">
                  {data.toGrade.map((item) => (
                    <li
                      key={item.submissionId}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{item.student}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.course?.code} · {item.assignment.title} ·{' '}
                          {timeAgo(item.submittedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.isLate && <Badge variant="warning">Late</Badge>}
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/assignments/${item.assignment.id}`}>Grade</Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <section>
            <h2 className="mb-3 font-semibold">My classes</h2>
            {data.courses.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No classes assigned"
                description="An administrator assigns teachers to courses."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {data.courses.map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
            )}
          </section>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-4 text-muted-foreground" /> Upcoming deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.upcomingAssignments.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No deadlines in the next two weeks.
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.upcomingAssignments.map((a) => (
                    <li key={a.id} className="text-sm">
                      <Link to={`/assignments/${a.id}`} className="font-medium hover:underline">
                        {a.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {a.course?.code} · {formatDateTime(a.dueAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <LatestAnnouncements items={data.announcements} />
        </div>
      </div>
    </>
  );
}

function AdminView({ data }: { data: AdminDashboard }) {
  const openComplaints = data.complaints.open + data.complaints.in_review;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Students"
          value={data.users.student}
          icon={GraduationCap}
          to="/admin/users"
        />
        <StatCard
          label="Faculty"
          value={data.users.teacher}
          icon={Users}
          tone="info"
          to="/admin/users"
        />
        <StatCard
          label="Active courses"
          value={data.courses.active}
          hint={`${data.courses.archived} archived`}
          icon={BookOpen}
          tone="success"
          to="/admin/courses"
        />
        <StatCard
          label="Open complaints"
          value={openComplaints}
          hint={`${data.complaints.open} new · ${data.complaints.in_review} in review`}
          icon={ShieldAlert}
          tone={openComplaints ? 'warning' : 'success'}
          to="/admin/complaints"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" /> Recent activity
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/audit">Audit log</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No activity recorded yet.
              </p>
            ) : (
              <ul className="divide-y">
                {data.recentActivity.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span>
                      <span className="font-medium">{entry.actor?.fullName ?? 'System'}</span>{' '}
                      <span className="text-muted-foreground">
                        · {entry.action.replace(/[._]/g, ' ')}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {timeAgo(entry.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <LatestAnnouncements items={data.announcements} />
      </div>
      {openComplaints > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <span className="flex items-center gap-2">
            <AlertCircle className="size-4" /> {openComplaints} complaint(s) need attention.
          </span>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/complaints">Review</Link>
          </Button>
        </div>
      )}
    </>
  );
}

export function DashboardPage() {
  const user = useUser();
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<Dashboard>('/me/dashboard'),
  });
  const firstName = user.fullName.replace(/^Dr\.?\s+/, '').split(' ')[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        title={`${greeting()}, ${firstName}`}
        description={
          user.role === 'admin'
            ? 'Here is an overview of the portal.'
            : user.role === 'teacher'
              ? 'Here is what needs your attention today.'
              : "Here's what's coming up in your courses."
        }
      />
      {query.isPending ? (
        <CardGridSkeleton count={4} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.role === 'student' ? (
        <StudentView data={query.data} />
      ) : query.data.role === 'teacher' ? (
        <TeacherView data={query.data} />
      ) : (
        <AdminView data={query.data} />
      )}
    </div>
  );
}
