import { createHmac, timingSafeEqual } from 'node:crypto';

export function json(res, status, body) { res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').send(JSON.stringify(body)); }
export async function body(req) { if (req.body && typeof req.body === 'object') return req.body; let raw=''; for await (const chunk of req) raw+=chunk; try{return JSON.parse(raw||'{}')}catch{return {}} }
export function auth(req) {
  const raw=req.headers['x-telegram-init-data'] || '';
  if (!raw || !process.env.TELEGRAM_BOT_TOKEN) return null;
  try {
    const p=new URLSearchParams(raw), hash=p.get('hash'); if(!hash)return null; p.delete('hash'); p.delete('signature');
    const check=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
    const secret=createHmac('sha256','WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();
    const digest=createHmac('sha256',secret).update(check).digest('hex');
    if(digest.length!==hash.length || !timingSafeEqual(Buffer.from(digest),Buffer.from(hash)))return null;
    const now=Math.floor(Date.now()/1000), date=Number(p.get('auth_date')); if(!date || now-date>86400 || date>now+60)return null;
    const user=JSON.parse(p.get('user')||'{}'); return user.id?user:null;
  } catch { return null; }
}
export async function db(path, options={}) {
  const base=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!base||!key)throw new Error('Настрой SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в Vercel.');
  const response=await fetch(`${base}/rest/v1/${path}`,{...options,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation',...(options.headers||{})},signal:options.signal||AbortSignal.timeout(6000)});
  const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=null}
  if(!response.ok){const error=new Error(data?.message||data?.error_description||`Supabase returned HTTP ${response.status}`);error.status=response.status;error.code=data?.code||null;error.hint=data?.hint||null;throw error}
  return data;
}
export function today(req){const local=req?.headers?.['x-local-date'];if(typeof local==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(local)&&!Number.isNaN(Date.parse(`${local}T00:00:00Z`)))return local;return new Date().toISOString().slice(0,10)}
