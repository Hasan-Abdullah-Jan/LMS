import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError, conflict, forbidden, notFound } from '../lib/errors.js';
import type { Pagination } from '../lib/pagination.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { authRepository } from '../repositories/auth.repository.js';
import {
  countCourseLinks,
  profilesRepository,
  type Profile,
  type ProfilePatch,
} from '../repositories/profiles.repository.js';
import type { RequestContext, Role } from '../types/auth.js';

export interface CreateUserInput {
  fullName: string;
  email: string;
  role: Role;
  rollNo?: string | undefined;
  temporaryPassword: string;
}

export interface UpdateUserInput {
  fullName?: string | undefined;
  role?: Role | undefined;
  rollNo?: string | null | undefined;
  isActive?: boolean | undefined;
}

export type AdminResetInput = { mode: 'email' } | { mode: 'temporary'; temporaryPassword: string };

export const usersService = {
  list(
    ctx: RequestContext,
    filters: Pagination & {
      search?: string | undefined;
      role?: Role | undefined;
      status?: 'active' | 'inactive' | undefined;
    },
  ) {
    return profilesRepository.list(ctx.db, {
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search,
      role: filters.role,
      isActive: filters.status === undefined ? undefined : filters.status === 'active',
    });
  },

  async get(ctx: RequestContext, id: string): Promise<Profile> {
    const profile = await profilesRepository.findById(ctx.db, id);
    if (!profile) throw notFound('User');
    return profile;
  },

  /** Admin-only account creation. There is no public sign-up anywhere. */
  async create(ctx: RequestContext, input: CreateUserInput): Promise<Profile> {
    if (await profilesRepository.findByEmail(supabaseAdmin, input.email)) {
      throw conflict('A user with this email already exists.');
    }

    const { user, error } = await authRepository.createUser({
      email: input.email,
      password: input.temporaryPassword,
      fullName: input.fullName,
      role: input.role,
    });
    if (error || !user) {
      if (error?.code === 'email_exists' || error?.status === 422) {
        throw conflict('A user with this email already exists.');
      }
      throw new AppError(
        502,
        'INTERNAL_ERROR',
        'The account could not be created. Please try again.',
      );
    }

    try {
      const profile = await profilesRepository.insert(supabaseAdmin, {
        id: user.id,
        fullName: input.fullName,
        email: input.email,
        role: input.role,
        rollNo: input.role === 'student' ? (input.rollNo ?? null) : null,
        mustChangePassword: true,
      });
      await auditRepository.record(ctx.user.id, 'user.create', 'user', profile.id, {
        email: profile.email,
        role: profile.role,
      });
      return profile;
    } catch (err) {
      // Keep Auth and profiles consistent if the profile insert fails (e.g. duplicate roll no).
      await authRepository.deleteUser(user.id);
      throw err;
    }
  },

  async update(ctx: RequestContext, id: string, input: UpdateUserInput): Promise<Profile> {
    const existing = await profilesRepository.findById(ctx.db, id);
    if (!existing) throw notFound('User');

    const roleChanges = input.role !== undefined && input.role !== existing.role;
    const statusChanges = input.isActive !== undefined && input.isActive !== existing.isActive;

    if (id === ctx.user.id && (roleChanges || statusChanges)) {
      throw forbidden('You cannot change your own role or deactivate your own account.');
    }
    if (roleChanges && (await countCourseLinks(supabaseAdmin, id)) > 0) {
      throw conflict('Remove this user from their courses before changing their role.');
    }

    const nextRole = input.role ?? existing.role;
    const patch: ProfilePatch = {
      fullName: input.fullName,
      role: input.role,
      isActive: input.isActive,
      rollNo: nextRole === 'student' ? input.rollNo : null,
    };
    if (nextRole !== 'student' && input.rollNo) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Only students have a roll number.', [
        { path: 'rollNo', message: 'Only students have a roll number.' },
      ]);
    }

    const updated = await profilesRepository.update(ctx.db, id, patch);

    if (statusChanges) {
      await authRepository.setBanned(id, !updated.isActive);
      if (!updated.isActive) await authRepository.revokeSessions(id);
    }

    await auditRepository.record(ctx.user.id, 'user.update', 'user', id, {
      ...(input.fullName !== undefined && { fullName: input.fullName }),
      ...(roleChanges && { role: input.role }),
      ...(statusChanges && { isActive: input.isActive }),
      ...(input.rollNo !== undefined && { rollNo: input.rollNo }),
    });
    return updated;
  },

  /** Send a reset email, or set a temporary password that must be changed at next login. */
  async resetPassword(ctx: RequestContext, id: string, input: AdminResetInput) {
    const target = await profilesRepository.findById(ctx.db, id);
    if (!target) throw notFound('User');

    if (input.mode === 'email') {
      const error = await authRepository.sendPasswordResetEmail(
        target.email,
        env.PASSWORD_RESET_REDIRECT,
      );
      if (error) {
        throw new AppError(
          502,
          'INTERNAL_ERROR',
          'The reset email could not be sent. Try a temporary password instead.',
        );
      }
      await auditRepository.record(ctx.user.id, 'user.reset_password_email', 'user', id);
      return { message: `A password reset link was sent to ${target.email}.` };
    }

    const error = await authRepository.setPassword(id, input.temporaryPassword);
    if (error) throw new AppError(502, 'INTERNAL_ERROR', 'The password could not be updated.');
    await profilesRepository.update(supabaseAdmin, id, { mustChangePassword: true });
    await authRepository.revokeSessions(id);
    await auditRepository.record(ctx.user.id, 'user.reset_password_temporary', 'user', id);
    return {
      message: `A temporary password was set. ${target.fullName} must change it at next sign-in.`,
    };
  },
};
