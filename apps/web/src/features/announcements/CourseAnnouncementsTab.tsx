import { useCourse } from '@/features/courses/useCourse';
import { isStaff } from '@/lib/roles';
import { AnnouncementFeed } from './AnnouncementsPage';

export function CourseAnnouncementsTab() {
  const course = useCourse();
  return <AnnouncementFeed courseId={course.id} canPost={isStaff(course.myRole)} />;
}
