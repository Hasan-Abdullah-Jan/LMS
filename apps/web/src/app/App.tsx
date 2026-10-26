import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { roleHome } from '../lib/roles';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '../features/auth/LoginPage';
import ForgotPasswordPage from '../features/auth/ForgotPasswordPage';
import ResetPasswordPage from '../features/auth/ResetPasswordPage';
import AppShell from '../components/AppShell';
import DashboardPage from '../features/dashboard/DashboardPage';
import UsersPage from '../features/admin/UsersPage';
import CoursesPage from '../features/admin/CoursesPage';
import CoursePage from '../features/courses/CoursePage';
import AssignmentsPage from '../features/assignments/AssignmentsPage';
import QuizzesPage from '../features/quizzes/QuizzesPage';
import MarksPage from '../features/marks/MarksPage';
import GradebookPage from '../features/marks/GradebookPage';
import AnnouncementsPage from '../features/announcements/AnnouncementsPage';
import ChatPage from '../features/chat/ChatPage';
import ComplaintsPage from '../features/complaints/ComplaintsPage';

function HomeRedirect() {
  const { profile } = useAuth();
  return profile ? <Navigate to={roleHome(profile.role)} replace /> : <Navigate to="/login" replace />;
}
function AppRoutes() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/admin" element={<ProtectedRoute roles={['admin']} />}>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="complaints" element={<ComplaintsPage />} />
        </Route>
        <Route path="/teacher" element={<ProtectedRoute roles={['teacher']} />}><Route index element={<DashboardPage />} /></Route>
        <Route path="/student" element={<ProtectedRoute roles={['student']} />}><Route index element={<DashboardPage />} /></Route>
        <Route path="/courses/:id" element={<CoursePage />} />
        <Route path="/courses/:id/assignments" element={<AssignmentsPage />} />
        <Route path="/courses/:id/quizzes" element={<QuizzesPage />} />
        <Route path="/courses/:id/gradebook" element={<ProtectedRoute roles={['teacher','admin']} />}><Route index element={<GradebookPage />} /></Route>
        <Route path="/marks" element={<ProtectedRoute roles={['student']} />}><Route index element={<MarksPage />} /></Route>
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/complaints" element={<ProtectedRoute roles={['teacher','student']} />}><Route index element={<ComplaintsPage />} /></Route>
      </Route>
    </Route>
    <Route path="*" element={<HomeRedirect />} />
  </Routes>;
}
export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}

