import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { RoleBadge } from '@/components/common/badges';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/common/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/misc';
import { api } from '@/lib/api';
import type { CourseMember } from '@/lib/types';
import { useCourse } from './useCourse';

export function PeopleTab() {
  const course = useCourse();
  const query = useQuery({
    queryKey: ['members', course.id],
    queryFn: () =>
      api.get<{ teachers: CourseMember[]; students: CourseMember[] }>(
        `/courses/${course.id}/members`,
      ),
  });
  if (query.isPending) return <ListSkeleton rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const { teachers, students } = query.data;

  const Person = ({ p }: { p: CourseMember }) => (
    <li className="flex items-center gap-3 py-2.5">
      <UserAvatar name={p.fullName} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{p.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[p.rollNo, p.email].filter(Boolean).join(' · ')}
        </p>
      </div>
      <RoleBadge role={p.role} />
    </li>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Teachers ({teachers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {teachers.map((p) => (
              <Person key={p.id} p={p} />
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Students ({students.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <EmptyState icon={Users} title="No students enrolled" className="border-0" />
          ) : (
            <ul className="grid divide-y sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
              {students.map((p) => (
                <Person key={p.id} p={p} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
