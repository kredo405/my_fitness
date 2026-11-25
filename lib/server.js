import { createHmac, timingSafeEqual } from 'node:crypto';

export function json(res, status, body) { res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').send(JSON.stringify(body)); }
export async function body(req) { if (req.body && typeof req.body === 'object') return req.body; let raw=''; for await (const chunk of req) raw+=chunk; try{return JSON.parse(raw||'{}')}catch{return {}} }
export function auth(req) {
  const raw=req.headers['x-telegram-init-data'] || '';
  const reject=(reason,details={})=>{ console.warn('Telegram Mini App auth rejected:',{reason,...details}); return null; };
  if (!raw) return reject('missing_init_data',{headerPresent:Boolean(req.headers['x-telegram-init-data'])});
  if (!process.env.TELEGRAM_BOT_TOKEN) return reject('missing_bot_token');
  try {
    const p=new URLSearchParams(raw), hash=p.get('hash');
    if(!hash)return reject('missing_hash',{length:raw.length,fields:[...p.keys()]});
    const makeCheck=entries=>entries.sort(([a],[b])=>a < b ? -1 : a > b ? 1 : 0).map(([k,v])=>`${k}=${v}`).join('\\n');
    const secret=createHmac('sha256','WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();
    const entries=[...p.entries()].filter(([key])=>key!=='hash');
    const digestFor=values=>createHmac('sha256',secret).update(makeCheck(values)).digest('hex');
    const valid=digest=>digest.length===hash.length && timingSafeEqual(Buffer.from(digest),Buffer.from(hash));
    // Support Telegram initData variants that include or omit the optional third-party signature in the bot HMAC.
    const signatureIncluded=valid(digestFor([...entries]));
    const signatureExcluded=!signatureIncluded && valid(digestFor(entries.filter(([key])=>key!=='signature')));
    if(!signatureIncluded&&!signatureExcluded)return reject('hash_mismatch',{length:raw.length,fields:[...p.keys()],hasSignature:p.has('signature'),configuredBotId:process.env.TELEGRAM_BOT_TOKEN.split(':')[0]});
    const now=Math.floor(Date.now()/1000), date=Number(p.get('auth_date'));
    if(!date||now-date>86400||date>now+60)return reject('invalid_auth_date',{ageSeconds:date?now-date:null});
    let user;
    try{user=JSON.parse(p.get('user')||'{}')}catch{return reject('invalid_user_json')}
    if(!user.id)return reject('missing_user_id');
    return user;
  } catch (error) { return reject('parse_or_crypto_error',{errorName:error?.name||'Error'}); }
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
