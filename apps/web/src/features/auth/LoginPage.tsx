import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, MoveRight, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { roleHome } from '../../lib/roles';
import { ApiError } from '../../lib/api';

const schema = z.object({ email: z.string().email('Enter a valid email address'), password: z.string().min(1, 'Enter your password') });
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const { login, profile, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });
  if (!loading && profile) return <Navigate to={roleHome(profile.role)} replace />;
  const submit = handleSubmit(async ({ email, password }) => {
    setBusy(true); setServerError('');
    try { await login(email, password); }
    catch (error) {
      setServerError(error instanceof ApiError && error.status === 429
        ? 'Too many sign-in attempts. Wait 15 minutes, then try again.'
        : 'Invalid email or password. Check your details and try again.');
    }
    finally { setBusy(false); }
  });
  return <main className="auth-layout">
    <section className="auth-aside">
      <div className="brand brand-light"><span className="brand-mark"><Sparkles size={19} /></span><span>northstar<span className="brand-light-weight"> learning</span></span></div>
      <div className="aside-copy"><span className="aside-kicker">A place to grow</span><h1>Good things<br/>happen when<br/><em>you keep learning.</em></h1><p>One space for every course, idea, and next step.</p></div>
      <div className="aside-bottom"><span className="aside-orbit">✳</span><span>Curiosity looks good on you.</span></div>
      <div className="shape shape-one"/><div className="shape shape-two"/>
    </section>
    <section className="auth-main">
      <div className="mobile-brand brand"><span className="brand-mark"><Sparkles size={18} /></span><span>northstar learning</span></div>
      <div className="auth-card">
        <div className="welcome-icon"><LockKeyhole size={20}/></div>
        <span className="eyebrow">WELCOME BACK</span>
        <h2>Sign in to your account</h2>
        <p className="auth-subtitle">Pick up right where you left off.</p>
        <form onSubmit={submit} noValidate>
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="username" placeholder="you@company.com" {...register('email')} aria-invalid={!!errors.email} />
          {errors.email && <span className="field-error">{errors.email.message}</span>}
          <div className="password-label"><label htmlFor="password">Password</label></div>
          <div className="password-field"><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" {...register('password')} aria-invalid={!!errors.password}/><button type="button" className="icon-button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
          {errors.password && <span className="field-error">{errors.password.message}</span>}
          <div className="forgot-row"><Link to="/forgot-password">Forgot password?</Link></div>
          {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}
          <button className="button button-primary button-wide" disabled={busy}>{busy?'Signing in…':<>Sign in <MoveRight size={17}/></>}</button>
        </form>
        <div className="secure-note"><span className="secure-dot"/> Private workspace · Secure sign in</div>
      </div>
      <footer className="auth-footer"><span>© 2026 Northstar Learning</span><span>Built for your next step</span></footer>
    </section>
  </main>;
}

