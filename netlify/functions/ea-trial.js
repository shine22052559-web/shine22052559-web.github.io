import { getStore } from '@netlify/blobs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const files={
 scalping:{name:'BF_Scalping_14D.mq5',path:'BF_Scalping_7D.mq5'},
 trend:{name:'BF_Trend_14D.mq5',path:'BF_Trend_7D.mq5'},
 hft:{name:'BF_FastTick_14D.mq5',path:'BF_FastTick_7D.mq5'}
};
const validEmail=s=>typeof s==='string'&&s.length<=160&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export default async req=>{
 if(req.method!=='GET')return Response.json({error:'method_not_allowed'},{status:405});
 const u=new URL(req.url), type=u.searchParams.get('type'), email=(u.searchParams.get('email')||'').trim().toLowerCase();
 if(!files[type])return Response.json({error:'invalid_type'},{status:400});
 if(!validEmail(email))return Response.json({error:'invalid_email'},{status:400});
 const now=new Date();
 const dateLiteral=d=>d.toISOString().slice(0,16).replace('T',' ').replace(/^(\d{4})-(\d{2})-(\d{2}) (.*)$/,'$1.$2.$3 $4');
 const f=files[type];
 let source;try{source=await readFile(fileURLToPath(new URL('../lib/templates/'+f.path,import.meta.url)),'utf8');}catch{return Response.json({error:'template_missing'},{status:500});}
 let store, trial, trialKey;
 try{
  store=getStore('bf-ea-trial-downloads');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email));
  trialKey='email-'+Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  trial=await store.get(trialKey,{type:'json'});
  if(!trial){trial={email,type,trialStartedAt:now.toISOString(),expiresAt:new Date(now.getTime()+14*24*60*60*1000).toISOString()};await store.set(trialKey,JSON.stringify(trial));}
 }catch(e){console.error('trial state unavailable',e?.message);return Response.json({error:'trial_state_unavailable'},{status:503});}
 const expires=new Date(trial.expiresAt);
 if(now.getTime()>=expires.getTime())return Response.json({error:'trial_expired',message:'สิทธิ์ทดลอง 14 วันสำหรับอีเมลนี้หมดอายุแล้ว'},{status:410});
 source=source.replace(/7-Day Trial/g,'14-Day Trial').replace(/7D/g,'14D').replace("D'EXPIRY_PLACEHOLDER'",`D'${dateLiteral(expires)}'`);
 if(source.includes('EXPIRY_PLACEHOLDER'))return Response.json({error:'template_invalid'},{status:500});
 return new Response(source,{status:200,headers:{'content-type':'text/plain; charset=utf-8','content-disposition':`attachment; filename="${f.name}"`,'cache-control':'no-store, private','x-content-type-options':'nosniff','x-trial-started-utc':trial.trialStartedAt,'x-trial-expires-utc':expires.toISOString()}});
};
export const config={path:'/api/ea-trial'};
