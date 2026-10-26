import { useState } from 'react';
import { Check, KeyRound } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function ChangePasswordDialog() {
  const {profile,changePassword,logout}=useAuth(); const [current,setCurrent]=useState(''); const [next,setNext]=useState(''); const [confirm,setConfirm]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  if(!profile?.mustChangePassword)return null;
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');if(next.length<10||!/[A-Za-z]/.test(next)||!/[0-9]/.test(next)){setError('Use at least 10 characters, including a letter and a number.');return}if(next!==confirm){setError('Your passwords do not match.');return}setBusy(true);try{await changePassword(current,next)}catch{setError('We couldn’t change your password. Check your current password and try again.')}finally{setBusy(false)}};
  return <div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="change-title"><div className="modal-icon"><KeyRound size={20}/></div><span className="eyebrow">ONE QUICK STEP</span><h2 id="change-title">Set a new password</h2><p>Your administrator gave you a temporary password. Create a private one to continue.</p><form onSubmit={submit}><label htmlFor="current">Temporary password</label><input id="current" type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)}/><label htmlFor="new">New password</label><input id="new" type="password" autoComplete="new-password" value={next} onChange={e=>setNext(e.target.value)}/><label htmlFor="confirm-new">Confirm new password</label><input id="confirm-new" type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/>{error&&<div className="alert alert-error">{error}</div>}<button className="button button-primary button-wide" disabled={busy}>{busy?'Updating…':'Update password'} <Check size={16}/></button><button type="button" className="dialog-signout" onClick={()=>void logout()}>Sign out instead</button></form></section></div>;
}

