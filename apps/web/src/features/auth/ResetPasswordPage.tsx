import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, KeyRound, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, setAccessToken } from '../../lib/api';

const schema = z.object({ password: z.string().min(10,'At least 10 characters').regex(/[A-Za-z]/,'Include one letter').regex(/[0-9]/,'Include one number'), confirm: z.string() }).refine(v=>v.password===v.confirm,{path:['confirm'],message:'Passwords do not match'});
export default function ResetPasswordPage() {
  const [error,setError]=useState(''); const [success,setSuccess]=useState(false);
  const token=useMemo(()=>new URLSearchParams(window.location.hash.slice(1)).get('access_token') ?? new URLSearchParams(window.location.search).get('token'),[]);
  const {register,watch,handleSubmit,formState:{errors,isSubmitting}}=useForm<{password:string;confirm:string}>({resolver:zodResolver(schema)});
  const password=watch('password','');
  const submit=handleSubmit(async ({password})=>{setError('');if(!token){setError('This reset link is invalid or expired.');return}try{await api('/auth/reset-password',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({newPassword:password})});setAccessToken(null);setSuccess(true)}catch{setError('This reset link is invalid or expired. Request a new one.')}});
  return <main className="simple-auth"><div className="brand"><span className="brand-mark"><Sparkles size={18}/></span><span>northstar learning</span></div><section className="simple-card"><div className="welcome-icon"><KeyRound size={20}/></div><span className="eyebrow">SECURE YOUR ACCOUNT</span><h1>{success?'Password updated':'Create a new password'}</h1>{success?<><p className="auth-subtitle">Your password has been changed. You can sign in with your new password now.</p><Link className="button button-primary button-wide centered" to="/login">Return to sign in</Link></>:<><p className="auth-subtitle">Choose a strong password you haven’t used before.</p><form onSubmit={submit}><label htmlFor="password">New password</label><input id="password" type="password" autoComplete="new-password" {...register('password')}/><div className="strength-meter"><span style={{width:`${Math.min(password.length*7,100)}%`}}/></div><div className="strength-label">{password.length>=10&&/[A-Za-z]/.test(password)&&/[0-9]/.test(password)?'Strong password':'At least 10 characters, one letter and one number'}</div>{errors.password&&<span className="field-error">{errors.password.message}</span>}<label htmlFor="confirm">Confirm new password</label><input id="confirm" type="password" autoComplete="new-password" {...register('confirm')}/>{errors.confirm&&<span className="field-error">{errors.confirm.message}</span>}{error&&<div className="alert alert-error">{error}</div>}<button className="button button-primary button-wide" disabled={isSubmitting}>{isSubmitting?'Saving…':'Reset password'} <Check size={16}/></button></form></>}<Link className="back-link" to="/login"><ArrowLeft size={16}/> Back to sign in</Link></section></main>;
}

