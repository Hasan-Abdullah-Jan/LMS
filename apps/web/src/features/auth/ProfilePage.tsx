import { KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { RoleBadge } from '@/components/common/badges';
import { PageHeader } from '@/components/common/page';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/misc';
import { formatDate } from '@/lib/utils';
import { useUser } from './AuthProvider';
import { ChangePasswordForm } from './ChangePasswordForm';

export function ProfilePage() {
  const user = useUser();
  return (
    <div>
      <PageHeader
        title="Profile"
        description="Your account details. Contact the registrar to change your name, email or role."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 pt-8 text-center">
            <UserAvatar name={user.fullName} className="size-20 text-xl" />
            <div>
              <p className="text-lg font-semibold">{user.fullName}</p>
              <RoleBadge role={user.role} />
            </div>
            <dl className="mt-4 w-full space-y-3 border-t pt-4 text-left text-sm">
              <div className="flex items-center gap-3">
                <Mail className="size-4 text-muted-foreground" />
                <dd className="truncate">{user.email}</dd>
              </div>
              {user.rollNo && (
                <div className="flex items-center gap-3">
                  <UserRound className="size-4 text-muted-foreground" />
                  <dd>Roll no. {user.rollNo}</dd>
                </div>
              )}
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-4 text-muted-foreground" />
                <dd>Member since {formatDate(user.createdAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" /> Change password
            </CardTitle>
            <CardDescription>
              After changing it, every other device you are signed in on will be signed out.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
