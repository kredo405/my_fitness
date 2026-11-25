import {auth,json,body,db,today} from '../lib/server.js';
export default async function handler(req,res){
 if(req.method!=='GET'&&req.method!=='POST')return json(res,405,{error:'Method not allowed'});
 const user=auth(req);
 if(!user){
  // Safe one-shot diagnostic: confirm which Telegram bot token the deployed function actually has.
  if(req.headers['x-telegram-init-data']&&process.env.TELEGRAM_BOT_TOKEN){
   try{
    const check=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`,{signal:AbortSignal.timeout(2500)});
    const result=await check.json();
    console.warn('Telegram bot token check:',{httpStatus:check.status,ok:result.ok===true,botId:result.result?.id||null,username:result.result?.username||null});
   }catch(error){console.warn('Telegram bot token check failed:',{errorName:error?.name||'Error'})}
  }
  return json(res,401,{error:'Открой приложение через Telegram.'});
 }
 try{
  if(req.method==='GET'){
   const profiles=await db(`profiles?telegram_id=eq.${user.id}&select=*`), logs=await db(`daily_logs?telegram_id=eq.${user.id}&log_date=eq.${today(req)}&select=*`), recent=await db(`daily_logs?telegram_id=eq.${user.id}&select=*&order=log_date.desc&limit=14`), workouts=await db(`workouts?telegram_id=eq.${user.id}&select=*&order=completed_at.desc&limit=10`);
   return json(res,200,{user:{id:user.id,first_name:user.first_name},profile:profiles[0]||null,today:logs[0]||null,recent,workouts});
  }
  const input=await body(req), kind=input.kind;
  if(kind==='delete'){
   await db(`profiles?telegram_id=eq.${user.id}`,{method:'DELETE'});return json(res,200,{deleted:true});
  }
  if(kind==='profile'){
   if(!['strength','fat_loss','fitness','endurance'].includes(input.goal)||!['beginner','intermediate','advanced'].includes(input.experience))return json(res,400,{error:'Выбери допустимые цель и уровень опыта.'});
   const safe={telegram_id:user.id,first_name:String(user.first_name||'').slice(0,80),goal:String(input.goal||'fitness').slice(0,30),experience:String(input.experience||'beginner').slice(0,30),age:bounded(input.age,16,100),sessions_per_week:bounded(input.sessions_per_week,1,14),height_cm:bounded(input.height_cm,100,230),weight_kg:bounded(input.weight_kg,30,300),limitations:String(input.limitations||'').slice(0,1000),equipment:String(input.equipment||'').slice(0,1000),dietary_preferences:String(input.dietary_preferences||'').slice(0,1000),updated_at:new Date().toISOString()};
   const rows=await db('profiles?on_conflict=telegram_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(safe)});if(!rows?.[0])throw new Error('Supabase не вернул сохранённый профиль.');return json(res,200,{profile:rows[0]});
  }
  if(kind==='daily'){
   const safe={telegram_id:user.id,log_date:today(req),mood:bounded(input.mood,1,5),stress:bounded(input.stress,1,5),sleep_hours:bounded(input.sleep_hours,0,24),weight_kg:bounded(input.weight_kg,30,300),calories_kcal:bounded(input.calories_kcal,0,10000),protein_g:bounded(input.protein_g,0,1000),water_ml:bounded(input.water_ml,0,10000)||0,notes:String(input.notes||'').slice(0,2000),updated_at:new Date().toISOString()};
   const rows=await db('daily_logs?on_conflict=telegram_id,log_date',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(safe)});return json(res,200,{today:rows[0]});
  }
  if(kind==='water'){
   const date=today(req), old=await db(`daily_logs?telegram_id=eq.${user.id}&log_date=eq.${date}&select=id,water_ml`), water=Math.min(10000,(old[0]?.water_ml||0)+250);
   const rows=old[0]
    ? await db(`daily_logs?id=eq.${old[0].id}`,{method:'PATCH',body:JSON.stringify({water_ml:water,updated_at:new Date().toISOString()})})
    : await db('daily_logs',{method:'POST',body:JSON.stringify({telegram_id:user.id,log_date:date,water_ml:water})});
   return json(res,200,{today:rows[0]});
  }
  if(kind==='workout'){
   const rows=await db('workouts',{method:'POST',body:JSON.stringify({telegram_id:user.id,title:String(input.title||'Тренировка').slice(0,100),details:input.details||{},completed_at:new Date().toISOString()})});return json(res,200,{workout:rows[0]});
  }
  return json(res,400,{error:'Unknown action'});
 }catch(e){console.error('profile API error:',{status:e.status,code:e.code,message:e.message,hint:e.hint});return json(res,e.status===401||e.status===403?503:500,{error:profileError(e)})}
}
function bounded(v,min,max){if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):null}
function profileError(e){
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return 'Серверная БД не настроена. Проверь SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в Vercel.';
 if(e.code==='42P01'||e.code==='PGRST205')return 'В Supabase не найдена таблица профилей. Выполни обновлённый файл supabase/schema.sql в SQL Editor.';
 if(e.code==='42703'||e.code==='PGRST204')return `Схема Supabase не содержит нужное поле${e.message?`: ${e.message.slice(0,180)}`:''}. Повторно выполни supabase/schema.sql в SQL Editor.`;
 if(e.status===401||e.status===403)return 'Supabase отклонил серверный ключ. Проверь SUPABASE_SERVICE_ROLE_KEY в Vercel и передеплой.';
 return `Не удалось сохранить данные в Supabase${e.status?` (HTTP ${e.status})`:''}${e.code?` [${e.code}]`:''}: ${String(e.message||'неизвестная ошибка').slice(0,180)}`;
}
