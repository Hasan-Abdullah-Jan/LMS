import {
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutGrid,
  Megaphone,
  MessagesSquare,
  PenSquare,
  Users,
} from 'lucide-react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { PageLoader, ErrorState } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isStaff } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { useCourseQuery } from './useCourse';

export function CourseLayout() {
  const { courseId = '' } = useParams();
  const query = useCourseQuery(courseId);

  if (query.isPending) return <PageLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const course = query.data;
  const staff = isStaff(course.myRole);

  const tabs = [
    { to: '', label: 'Overview', icon: LayoutGrid, end: true },
    { to: 'resources', label: 'Resources', icon: FileText },
    { to: 'assignments', label: 'Assignments', icon: PenSquare },
    { to: 'quizzes', label: 'Quizzes', icon: ClipboardList },
    { to: 'announcements', label: 'Announcements', icon: Megaphone },
    { to: 'people', label: 'People', icon: Users },
    ...(staff ? [{ to: 'gradebook', label: 'Gradebook', icon: GraduationCap }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary to-[oklch(0.25_0.07_265)] text-primary-foreground shadow-sm dark:from-sidebar-accent dark:to-sidebar">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="border-white/25 bg-white/15 font-mono text-white">
                {course.code}
              </Badge>
              {course.isArchived && <Badge variant="muted">Archived</Badge>}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {course.title}
            </h1>
            <p className="text-sm text-white/75">
              <BookOpen className="mr-1 inline size-4" />
              {course.teachers.map((t) => t.fullName).join(' · ') || 'No teacher assigned'} ·{' '}
              {course.studentCount} students
            </p>
          </div>
          <Button asChild variant="brand">
            <Link to={`/chat/${course.id}`}>
              <MessagesSquare /> Classroom chat
            </Link>
          </Button>
        </div>
      </div>

      <nav
        aria-label="Course sections"
        className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto border-b px-1"
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )
            }
          >
            <tab.icon className="size-4" aria-hidden /> {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ course }} />
    </div>
  );
}
