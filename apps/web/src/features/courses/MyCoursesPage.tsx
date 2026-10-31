import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SearchInput } from '@/components/common/misc';
import { PageHeader } from '@/components/common/page';
import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/common/states';
import { useUser } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import type { Course } from '@/lib/types';
import { CourseCard } from './CourseCard';

export function MyCoursesPage() {
  const user = useUser();
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['my-courses'],
    queryFn: () => api.get<Course[]>('/me/courses'),
  });
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data ?? []).filter(
      (c) => !term || `${c.code} ${c.title}`.toLowerCase().includes(term),
    );
  }, [query.data, search]);
  const title =
    user.role === 'teacher'
      ? 'My classes'
      : user.role === 'admin'
        ? 'All active courses'
        : 'My courses';

  return (
    <div>
      <PageHeader
        title={title}
        description={
          user.role === 'student'
            ? 'Courses you are enrolled in this semester.'
            : 'Courses you teach.'
        }
        actions={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search courses…"
            label="Search courses"
          />
        }
      />
      {query.isPending ? (
        <CardGridSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={search ? 'No matching courses' : 'No courses yet'}
          description={
            search
              ? 'Try a different search term.'
              : 'Courses appear here once the registrar assigns them to you.'
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
