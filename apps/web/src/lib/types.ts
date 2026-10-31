export type Role = 'admin' | 'teacher' | 'student';

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  rollNo: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  teachers: Person[];
  studentCount: number;
}

export interface CourseMember extends Person {
  rollNo: string | null;
  enrolledAt?: string;
}

export interface CourseDetail extends Course {
  myRole: Role;
}

export interface AdminCourseDetail extends Course {
  students: CourseMember[];
}

export interface Resource {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { id: string; fullName: string } | null;
}

export type SubmissionStatus = 'pending' | 'submitted' | 'late' | 'graded' | 'missed';

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  textAnswer: string | null;
  fileName: string | null;
  submittedAt: string;
  isLate: boolean;
  marksObtained: number | null;
  feedback: string | null;
  gradedAt: string | null;
  gradedBy: string | null;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  maxMarks: number;
  dueAt: string;
  allowLate: boolean;
  attachmentName: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // student view
  status?: SubmissionStatus;
  submission?: Submission | null;
  // staff view
  stats?: { enrolled: number; submitted: number; graded: number; late: number };
  myRole?: Role;
}

export interface GradingRow {
  student: { id: string; fullName: string; email: string; rollNo: string | null };
  status: SubmissionStatus;
  submission: Submission | null;
}

export type QuestionType = 'mcq_single' | 'mcq_multi' | 'true_false';

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  options: QuizOption[];
  marks: number;
  correctOptionIds?: string[];
}

export type StudentQuizStatus =
  'upcoming' | 'open' | 'in_progress' | 'submitted' | 'missed' | 'closed';

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  timeLimitMinutes: number;
  opensAt: string;
  closesAt: string;
  isPublished: boolean;
  shuffleQuestions: boolean;
  createdAt: string;
  questionCount: number;
  totalMarks: number;
  myRole?: Role;
  status?: StudentQuizStatus;
  myAttempt?: {
    startedAt: string;
    expiresAt: string;
    submittedAt: string | null;
    score: number | null;
  } | null;
  results?: Array<{ questionId: string; correct: boolean; marksAwarded: number }>;
  stats?: { enrolled: number; attempts: number; submitted: number };
  hasAttempts?: boolean;
  questions?: QuizQuestion[];
}

export interface AttemptPayload {
  attemptId: string;
  quiz: { id: string; title: string; description: string | null; timeLimitMinutes: number };
  startedAt: string;
  expiresAt: string;
  serverTime: string;
  graceSeconds: number;
  questions: Array<Omit<QuizQuestion, 'position' | 'correctOptionIds'>>;
}

export interface AttemptResult {
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt: string;
  results: Array<{ questionId: string; correct: boolean; marksAwarded: number }>;
}

export interface Totals {
  obtained: number;
  max: number;
  percentage: number | null;
  gradedCount: number;
  pendingCount: number;
}

export interface MyMarks {
  courses: Array<{
    course: { id: string; code: string; title: string };
    items: Array<{
      kind: 'assignment' | 'quiz';
      itemId: string;
      title: string;
      obtained: number | null;
      max: number;
      status: 'graded' | 'pending';
      gradedAt: string | null;
    }>;
    totals: Totals;
  }>;
  overall: Totals;
}

export interface Gradebook {
  course: { id: string; code: string; title: string };
  items: Array<{ id: string; kind: 'assignment' | 'quiz'; title: string; max: number }>;
  rows: Array<{
    student: { id: string; fullName: string; email: string; rollNo: string | null };
    cells: Record<
      string,
      { obtained: number | null; status: 'graded' | 'pending' | 'missing'; sourceId: string | null }
    >;
    totals: Totals;
  }>;
}

export interface Announcement {
  id: string;
  courseId: string | null;
  course: { id: string; code: string; title: string } | null;
  author: { id: string; fullName: string; role: Role } | null;
  authorId: string;
  title: string;
  body: string;
  isPinned: boolean;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  courseId: string;
  sender: { id: string; fullName: string; role: Role } | null;
  senderId: string;
  body: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export type ComplaintStatus = 'open' | 'in_review' | 'resolved' | 'rejected';
export type ComplaintCategory = 'academic' | 'technical' | 'facility' | 'conduct' | 'other';

export interface Complaint {
  id: string;
  raisedBy: { id: string; fullName: string; email: string; role: Role } | null;
  raisedById: string;
  course: { id: string; code: string; title: string } | null;
  category: ComplaintCategory;
  subject: string;
  description: string;
  attachmentName: string | null;
  status: ComplaintStatus;
  adminResponse: string | null;
  resolvedBy: { id: string; fullName: string } | null;
  resolvedAt: string | null;
  followUp: string | null;
  followUpAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: number;
  actor: { id: string; fullName: string } | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown>;
  at: string;
}

export interface EnrollmentReport {
  dryRun: boolean;
  enrolled: number;
  matched: Array<{ id: string; email: string; fullName: string }>;
  alreadyEnrolled: string[];
  duplicates: string[];
  unknown: string[];
  invalid: string[];
}

export interface UpcomingAssignment extends Assignment {
  course: { id: string; code: string; title: string } | null;
  submitted?: boolean;
}

export interface StudentDashboard {
  role: 'student';
  courses: Course[];
  upcomingAssignments: UpcomingAssignment[];
  openQuizzes: Array<Quiz & { course: { id: string; code: string; title: string } | null }>;
  recentMarks: Array<{
    kind: 'assignment' | 'quiz';
    itemId: string;
    title: string;
    obtained: number | null;
    max: number;
    gradedAt: string | null;
    course: { id: string; code: string; title: string } | null;
  }>;
  overall: Totals;
  announcements: Announcement[];
}

export interface TeacherDashboard {
  role: 'teacher';
  courses: Course[];
  toGradeCount: number;
  toGrade: Array<{
    submissionId: string;
    submittedAt: string;
    isLate: boolean;
    student: string;
    assignment: { id: string; title: string; courseId: string };
    course: { id: string; code: string; title: string } | null;
  }>;
  upcomingAssignments: UpcomingAssignment[];
  announcements: Announcement[];
}

export interface AdminDashboard {
  role: 'admin';
  users: Record<Role, number>;
  courses: { active: number; archived: number };
  complaints: Record<ComplaintStatus, number>;
  recentActivity: AuditEntry[];
  announcements: Announcement[];
}

export type Dashboard = StudentDashboard | TeacherDashboard | AdminDashboard;
