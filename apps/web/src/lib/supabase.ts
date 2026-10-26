import { createClient } from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL;
const anonKey=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const realtimeClient=url&&anonKey?createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}}):null;
export function setRealtimeToken(token:string|null){if(token&&realtimeClient)void realtimeClient.realtime.setAuth(token);}

