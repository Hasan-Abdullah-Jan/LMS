import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { PageLoader } from '@/components/common/states';
import { TooltipProvider } from '@/components/ui/misc';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { HomeRedirect, PublicOnly, RequireAuth, RequireRole } from '@/features/auth/guards';
import { LoginPage } from '@/features/auth/LoginPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { ApiError } from '@/lib/api';
import { AppLayout } from './AppLayout';
import { NotFoundPage } from './ErrorPages';

// Route-level code splitting keeps the first load small.
function lazyNamed<K extends string>(
  loader: () => Promise<{ [P in K]: React.ComponentType }>,
  name: K,
) {
  return lazy(async () => ({ default: (await loader())[name] }));
}

const DashboardPage = lazyNamed(
  () => import('@/features/dashboard/DashboardPage'),
  'DashboardPage',
);
const MyCoursesPage = lazyNamed(() => import('@/features/courses/MyCoursesPage'), 'MyCoursesPage');
const CourseLayout = lazyNamed(() => import('@/features/courses/CourseLayout'), 'CourseLayout');
const CourseOverview = lazyNamed(
  () => import('@/features/courses/CourseOverview'),
  'CourseOverview',
);
const PeopleTab = lazyNamed(() => import('@/features/courses/PeopleTab'), 'PeopleTab');
const ResourcesTab = lazyNamed(() => import('@/features/resources/ResourcesTab'), 'ResourcesTab');
const AssignmentsTab = lazyNamed(
  () => import('@/features/assignments/AssignmentsTab'),
  'AssignmentsTab',
);
const AssignmentDetailPage = lazyNamed(
  () => import('@/features/assignments/AssignmentDetailPage'),
  'AssignmentDetailPage',
);
const QuizzesTab = lazyNamed(() => import('@/features/quizzes/QuizzesTab'), 'QuizzesTab');
const QuizBuilderPage = lazyNamed(
  () => import('@/features/quizzes/QuizBuilderPage'),
  'QuizBuilderPage',
);
const QuizDetailPage = lazyNamed(
  () => import('@/features/quizzes/QuizDetailPage'),
  'QuizDetailPage',
);
const QuizRunnerPage = lazyNamed(
  () => import('@/features/quizzes/QuizRunnerPage'),
  'QuizRunnerPage',
);
const QuizResultsPage = lazyNamed(
  () => import('@/features/quizzes/QuizResultsPage'),
  'QuizResultsPage',
);
const CourseAnnouncementsTab = lazyNamed(
  () => import('@/features/announcements/CourseAnnouncementsTab'),
  'CourseAnnouncementsTab',
);
const AnnouncementsPage = lazyNamed(
  () => import('@/features/announcements/AnnouncementsPage'),
  'AnnouncementsPage',
);
const GradebookTab = lazyNamed(() => import('@/features/marks/GradebookTab'), 'GradebookTab');
const MyMarksPage = lazyNamed(() => import('@/features/marks/MyMarksPage'), 'MyMarksPage');
const ChatPage = lazyNamed(() => import('@/features/chat/ChatPage'), 'ChatPage');
const ComplaintsPage = lazyNamed(
  () => import('@/features/complaints/ComplaintsPage'),
  'ComplaintsPage',
);
const AdminComplaintsPage = lazyNamed(
  () => import('@/features/complaints/AdminComplaintsPage'),
  'AdminComplaintsPage',
);
const UsersPage = lazyNamed(() => import('@/features/admin/UsersPage'), 'UsersPage');
const AdminCoursesPage = lazyNamed(
  () => import('@/features/admin/AdminCoursesPage'),
  'AdminCoursesPage',
);
const AdminCourseDetailPage = lazyNamed(
  () => import('@/features/admin/AdminCourseDetailPage'),
  'AdminCourseDetailPage',
);
const AuditLogPage = lazyNamed(() => import('@/features/admin/AuditLogPage'), 'AuditLogPage');
const ProfilePage = lazyNamed(() => import('@/features/auth/ProfilePage'), 'ProfilePage');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Don't retry errors the user can't fix by retrying.
      retry: (count, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

const suspense = (node: React.ReactNode) => <Suspense fallback={<PageLoader />}>{node}</Suspense>;

const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  // Reachable whether or not someone is signed in (the email link carries its own token).
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/change-password', element: <ChangePasswordPage /> },
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomeRedirect /> },
          { path: '/profile', element: suspense(<ProfilePage />) },
          { path: '/courses', element: suspense(<MyCoursesPage />) },
          {
            path: '/courses/:courseId',
            element: suspense(<CourseLayout />),
            children: [
              { index: true, element: suspense(<CourseOverview />) },
              { path: 'resources', element: suspense(<ResourcesTab />) },
              { path: 'assignments', element: suspense(<AssignmentsTab />) },
              { path: 'quizzes', element: suspense(<QuizzesTab />) },
              { path: 'announcements', element: suspense(<CourseAnnouncementsTab />) },
              { path: 'people', element: suspense(<PeopleTab />) },
              { path: 'gradebook', element: suspense(<GradebookTab />) },
            ],
          },
          { path: '/courses/:courseId/quizzes/new', element: suspense(<QuizBuilderPage />) },
          { path: '/assignments/:assignmentId', element: suspense(<AssignmentDetailPage />) },
          { path: '/quizzes/:quizId', element: suspense(<QuizDetailPage />) },
          { path: '/quizzes/:quizId/edit', element: suspense(<QuizBuilderPage />) },
          { path: '/quizzes/:quizId/take', element: suspense(<QuizRunnerPage />) },
          { path: '/quizzes/:quizId/results', element: suspense(<QuizResultsPage />) },
          { path: '/announcements', element: suspense(<AnnouncementsPage />) },
          { path: '/chat', element: suspense(<ChatPage />) },
          { path: '/chat/:courseId', element: suspense(<ChatPage />) },
          {
            element: <RequireRole roles={['student']} />,
            children: [
              { path: '/student', element: suspense(<DashboardPage />) },
              { path: '/marks', element: suspense(<MyMarksPage />) },
            ],
          },
          {
            element: <RequireRole roles={['teacher']} />,
            children: [{ path: '/teacher', element: suspense(<DashboardPage />) }],
          },
          {
            element: <RequireRole roles={['student', 'teacher']} />,
            children: [{ path: '/complaints', element: suspense(<ComplaintsPage />) }],
          },
          {
            element: <RequireRole roles={['admin']} />,
            children: [
              { path: '/admin', element: suspense(<DashboardPage />) },
              { path: '/admin/users', element: suspense(<UsersPage />) },
              { path: '/admin/courses', element: suspense(<AdminCoursesPage />) },
              { path: '/admin/courses/:courseId', element: suspense(<AdminCourseDetailPage />) },
              { path: '/admin/complaints', element: suspense(<AdminComplaintsPage />) },
              { path: '/admin/audit', element: suspense(<AuditLogPage />) },
            ],
          },
        ],
      },
    ],
  },
  { path: '/dashboard', element: <Navigate to="/" replace /> },
  // Everything else (including /signup) is a 404 - there is no public sign-up.
  { element: <CatchAllLayout />, children: [{ path: '*', element: <NotFoundPage /> }] },
]);

/** 404s keep the app shell for signed-in users and stay public otherwise. */
function CatchAllLayout() {
  const { status, user } = useAuth();
  if (status === 'loading') return <PageLoader />;
  return user ? <AppLayout /> : <Outlet />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster richColors closeButton position="top-right" />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
