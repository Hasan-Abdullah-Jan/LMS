import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';

const schema = z.object({ email: z.string().email('Enter a valid email address') });
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{email:string}>({resolver:zodResolver(schema)});
  const submit = handleSubmit(async (values) => {
    setError('');
    try { await api('/auth/forgot-password', {method:'POST',body:JSON.stringify(values)}); setSent(true); }
    catch { setError('Unable to request a reset right now. Please try again shortly.'); }
  });
  return <main className="simple-auth"><div className="brand"><span className="brand-mark"><Sparkles size={18}/></span><span>northstar learning</span></div><section className="simple-card">
    <div className="welcome-icon"><Mail size={20}/></div><span className="eyebrow">ACCOUNT RECOVERY</span><h1>{sent?'Check your inbox':'Forgot your password?'}</h1>
    {sent?<><p className="auth-subtitle">If an account exists for that email, a reset link has been sent.</p><div className="alert alert-success">The link is valid for one hour. Check your spam folder if it doesn’t arrive.</div></>:<><p className="auth-subtitle">Enter your work email and we’ll send you a link to reset your password.</p><form onSubmit={submit}><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...register('email')}/>{errors.email&&<span className="field-error">{errors.email.message}</span>}{error&&<div className="alert alert-error">{error}</div>}<button className="button button-primary button-wide" disabled={isSubmitting}>{isSubmitting?'Sending…':'Send reset link'}</button></form></>}
    <Link className="back-link" to="/login"><ArrowLeft size={16}/> Back to sign in</Link>
  </section></main>;
}

