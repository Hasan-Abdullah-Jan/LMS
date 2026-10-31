import { BookOpenCheck, MessagesSquare, ShieldCheck, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '@/components/common/misc';
import { ThemeToggle } from '@/app/ThemeToggle';

const HIGHLIGHTS = [
  {
    icon: BookOpenCheck,
    title: 'Courses & resources',
    text: 'Lecture material, assignments and quizzes in one place.',
  },
  {
    icon: Trophy,
    title: 'Marks you can trust',
    text: 'Server-graded quizzes and transparent gradebooks.',
  },
  {
    icon: MessagesSquare,
    title: 'Classroom chat',
    text: 'Real-time discussion with your teachers and classmates.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure by design',
    text: 'Role-based access enforced on the server and database.',
  },
];

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-40 -right-40 size-[28rem] rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 -left-24 size-[30rem] rounded-full bg-sky-500/15 blur-3xl" />
        <Logo className="relative text-white" />
        <div className="relative max-w-lg space-y-8">
          <div className="space-y-3">
            <h2 className="text-4xl leading-tight font-semibold tracking-tight text-white">
              Everything you need for the semester,{' '}
              <span className="text-brand">in one portal.</span>
            </h2>
            <p className="text-sidebar-muted">
              The student and faculty portal of the German University of Technology.
            </p>
          </div>
          <ul className="grid gap-5 sm:grid-cols-2">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="space-y-1.5">
                <Icon className="size-5 text-brand" aria-hidden />
                <p className="font-medium text-white">{title}</p>
                <p className="text-sm text-sidebar-muted">{text}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-sidebar-muted">
          © {new Date().getFullYear()} GUTECH LMS Portal · Prototype
        </p>
      </aside>

      <main className="flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <Logo className="lg:invisible" />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
          <div className="w-full max-w-sm space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
