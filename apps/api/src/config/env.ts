import { z } from 'zod';

/**
 * All runtime configuration comes from environment variables (12-factor).
 * The process refuses to start with a clear message when something is missing.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim().replace(/\/$/, ''))
        .filter(Boolean),
    ),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  /** Optional: defaults to https://<production domain>/reset-password on Vercel, localhost otherwise. */
  PASSWORD_RESET_REDIRECT: z.url().optional(),
  /** Set automatically by Vercel (production domain without protocol). */
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  SERVE_WEB: z.stringbool().default(false),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = Omit<z.infer<typeof envSchema>, 'PASSWORD_RESET_REDIRECT'> & {
  PASSWORD_RESET_REDIRECT: string;
};

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}\nSee apps/api/.env.example.`);
  }
  const data = parsed.data;
  const vercelOrigin = data.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${data.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined;
  return {
    ...data,
    CLIENT_ORIGIN: vercelOrigin ? [...data.CLIENT_ORIGIN, vercelOrigin] : data.CLIENT_ORIGIN,
    PASSWORD_RESET_REDIRECT:
      data.PASSWORD_RESET_REDIRECT ?? `${vercelOrigin ?? 'http://localhost:5173'}/reset-password`,
  };
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
