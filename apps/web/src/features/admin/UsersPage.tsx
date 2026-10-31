import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, MoreHorizontal, Pencil, Plus, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { RoleBadge } from '@/components/common/badges';
import { FormField, SearchInput } from '@/components/common/misc';
import { PageHeader, Pagination } from '@/components/common/page';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input, NativeSelect } from '@/components/ui/input';
import { Switch, UserAvatar } from '@/components/ui/misc';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useUser } from '@/features/auth/AuthProvider';
import { PasswordInput, passwordPolicy } from '@/features/auth/password';
import { ApiError, api, errorMessage } from '@/lib/api';
import type { Profile, Role } from '@/lib/types';
import { formatDate } from '@/lib/utils';

const PAGE_SIZE = 15;

function generatePassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0]! % set.length]!;
  return `${Array.from({ length: 8 }, () => pick(letters)).join('')}${pick(digits)}${pick(digits)}!`;
}

function UserDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: Profile;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <UserForm editing={editing} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Mounted fresh each time the dialog opens, so its state always starts from props. */
function UserForm({ editing, onDone }: { editing?: Profile; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(editing?.fullName ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [role, setRole] = useState<Role>(editing?.role ?? 'student');
  const [rollNo, setRollNo] = useState(editing?.rollNo ?? '');
  const [password, setPassword] = useState(() => (editing ? '' : generatePassword()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (fullName.trim().length < 2) next.fullName = 'Enter the full name.';
    if (!editing && !/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email.';
    if (!editing) {
      const check = passwordPolicy.safeParse(password);
      if (!check.success) next.temporaryPassword = check.error.issues[0]!.message;
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/users/${editing.id}`, {
          fullName: fullName.trim(),
          role,
          rollNo: role === 'student' ? rollNo.trim() || null : null,
        });
        toast.success('User updated');
      } else {
        await api.post('/admin/users', {
          fullName: fullName.trim(),
          email: email.trim(),
          role,
          rollNo: role === 'student' ? rollNo.trim() || undefined : undefined,
          temporaryPassword: password,
        });
        toast.success('Account created', {
          description: `Share the temporary password securely. ${fullName.split(' ')[0]} must change it at first sign-in.`,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      onDone();
    } catch (error) {
      if (error instanceof ApiError && error.details.length) {
        setErrors(Object.fromEntries(error.details.map((d) => [d.path ?? 'form', d.message])));
      } else setErrors({ form: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? 'Edit user' : 'Create user'}</DialogTitle>
        <DialogDescription>
          {editing
            ? editing.email
            : 'Accounts are created by the registrar only. The user must change the temporary password at first sign-in.'}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {errors.form && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive"
          >
            {errors.form}
          </p>
        )}
        <FormField id="u-name" label="Full name" error={errors.fullName} required>
          <Input
            id="u-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={120}
          />
        </FormField>
        {!editing && (
          <FormField id="u-email" label="Email" error={errors.email} required>
            <Input
              id="u-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="u-role" label="Role" error={errors.role} required>
            <NativeSelect
              id="u-role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Administrator</option>
            </NativeSelect>
          </FormField>
          {role === 'student' && (
            <FormField id="u-roll" label="Roll number" error={errors.rollNo}>
              <Input
                id="u-roll"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                maxLength={32}
                placeholder="GU-24-010"
              />
            </FormField>
          )}
        </div>
        {!editing && (
          <FormField
            id="u-pass"
            label="Temporary password"
            error={errors.temporaryPassword}
            hint="At least 10 characters with a letter and a number."
            required
          >
            <div className="flex gap-2">
              <PasswordInput
                id="u-pass"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setPassword(generatePassword())}
              >
                Generate
              </Button>
            </div>
          </FormField>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {editing ? 'Save' : 'Create account'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: Profile | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(user)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{user && <ResetPasswordForm user={user} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function ResetPasswordForm({ user, onClose }: { user: Profile; onClose: () => void }) {
  const [mode, setMode] = useState<'email' | 'temporary'>('email');
  const [password, setPassword] = useState(generatePassword);
  const [error, setError] = useState<string | null>(null);
  const reset = useMutation({
    mutationFn: () =>
      api.post<{ message: string }>(
        `/admin/users/${user.id}/reset-password`,
        mode === 'email' ? { mode } : { mode, temporaryPassword: password },
      ),
    onSuccess: (r) => {
      toast.success(r.message);
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <>
      <DialogHeader>
        <DialogTitle>Reset password</DialogTitle>
        <DialogDescription>
          {user.fullName} · {user.email}
        </DialogDescription>
      </DialogHeader>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <fieldset className="space-y-2">
        <legend className="sr-only">Reset method</legend>
        <label className="flex cursor-pointer gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <input
            type="radio"
            name="mode"
            checked={mode === 'email'}
            onChange={() => setMode('email')}
            className="mt-1 accent-[var(--primary)]"
          />
          <span>
            <span className="text-sm font-medium">Email a reset link</span>
            <span className="block text-xs text-muted-foreground">
              Single-use link, valid for 1 hour.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <input
            type="radio"
            name="mode"
            checked={mode === 'temporary'}
            onChange={() => setMode('temporary')}
            className="mt-1 accent-[var(--primary)]"
          />
          <span>
            <span className="text-sm font-medium">Set a temporary password</span>
            <span className="block text-xs text-muted-foreground">
              Signs the user out everywhere; they must change it at next sign-in.
            </span>
          </span>
        </label>
      </fieldset>
      {mode === 'temporary' && (
        <div className="flex gap-2">
          <PasswordInput
            aria-label="Temporary password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())}>
            Generate
          </Button>
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => reset.mutate()} loading={reset.isPending}>
          {mode === 'email' ? 'Send link' : 'Set password'}
        </Button>
      </DialogFooter>
    </>
  );
}

export function UsersPage() {
  const me = useUser();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ open: boolean; editing?: Profile }>({ open: false });
  const [resetting, setResetting] = useState<Profile | null>(null);

  const query = useQuery({
    queryKey: ['admin-users', search, role, status, page],
    queryFn: () =>
      api.page<Profile>('/admin/users', { search, role, status, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const toggleActive = useMutation({
    mutationFn: (u: Profile) =>
      api.patch<Profile>(`/admin/users/${u.id}`, { isActive: !u.isActive }),
    onSuccess: (u) => {
      toast.success(
        u.isActive ? `${u.fullName} reactivated` : `${u.fullName} deactivated and signed out`,
      );
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Users"
        description="Create accounts, change roles, deactivate access and reset passwords."
        actions={
          <Button onClick={() => setDialog({ open: true })}>
            <Plus /> Create user
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Name, email or roll no…"
          label="Search users"
        />
        <NativeSelect
          aria-label="Filter by role"
          className="sm:w-40"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="teacher">Teachers</option>
          <option value="admin">Admins</option>
        </NativeSelect>
        <NativeSelect
          aria-label="Filter by status"
          className="sm:w-40"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
        </NativeSelect>
      </div>
      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users found"
          description="Try a different search or filter."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Roll no.</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="sr-only">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((u) => (
                <TableRow key={u.id} className={u.isActive ? undefined : 'opacity-70'}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={u.fullName} className="size-8" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {u.fullName}{' '}
                          {u.id === me.id && (
                            <span className="text-xs text-muted-foreground">(you)</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      {u.mustChangePassword && (
                        <Badge variant="warning" className="hidden md:inline-flex">
                          Temp password
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={u.role} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{u.rollNo ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(u.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={u.isActive}
                      disabled={
                        u.id === me.id ||
                        (toggleActive.isPending && toggleActive.variables?.id === u.id)
                      }
                      onCheckedChange={() => toggleActive.mutate(u)}
                      aria-label={`${u.isActive ? 'Deactivate' : 'Activate'} ${u.fullName}`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${u.fullName}`}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setDialog({ open: true, editing: u })}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setResetting(u)}>
                          <KeyRound /> Reset password
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={query.data.meta.total}
            onPageChange={setPage}
          />
        </>
      )}
      <UserDialog
        open={dialog.open}
        editing={dialog.editing}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
    </div>
  );
}
