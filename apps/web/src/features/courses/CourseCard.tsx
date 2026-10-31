import { ArrowRight, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import type { Course } from '@/lib/types';

const ACCENTS = [
  'from-sky-500 to-indigo-600',
  'from-amber-400 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-fuchsia-500 to-purple-600',
  'from-rose-500 to-red-600',
];

export function CourseCard({ course }: { course: Course }) {
  const accent =
    ACCENTS[[...course.code].reduce((s, c) => s + c.charCodeAt(0), 0) % ACCENTS.length];
  return (
    <Link
      to={`/courses/${course.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className={`h-2 bg-gradient-to-r ${accent}`} aria-hidden />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="font-mono">
            {course.code}
          </Badge>
          {course.isArchived && <Badge variant="muted">Archived</Badge>}
        </div>
        <div>
          <h3 className="font-semibold leading-snug group-hover:text-primary">{course.title}</h3>
          {course.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between pt-2 text-sm text-muted-foreground">
          <span className="truncate">
            {course.teachers.map((t) => t.fullName).join(', ') || 'No teacher assigned'}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Users className="size-4" /> {course.studentCount}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between border-t px-5 py-2.5 text-sm font-medium text-primary">
        Open course <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
