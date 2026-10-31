import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { api } from '@/lib/api';
import type { CourseDetail } from '@/lib/types';

export function useCourseQuery(courseId: string) {
  return useQuery({
    queryKey: ['course', courseId],
    queryFn: () => api.get<CourseDetail>(`/courses/${courseId}`),
    enabled: Boolean(courseId),
  });
}

/** The course loaded by CourseLayout. */
export function useCourse(): CourseDetail {
  return useOutletContext<{ course: CourseDetail }>().course;
}
