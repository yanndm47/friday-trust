// Conçu par La TEAM 0 — API Netlify (Functions v2 + Netlify Blobs)
import {getStore} from '@netlify/blobs';
import crypto from 'node:crypto';
import ADMIN_JS from './admin-panel.mjs';
const ADM={salt:'164d4316468a7e49757be3fdcd3ab75f',fp:'ad7178f5b4ae7ac2adf90f74159f88159ec09bd5acc6eccfaf872762ebcd2740'};
const MAXPART=4*1024*1024,MAXFILE=25*1024*1024,SEX=['Masculin','Féminin'],RID=/^\d{13}-[0-9a-f]{6}$/;
const EXT=new Set(['pdf','doc','docx','ppt','pptx','xls','xlsx','zip','png','jpg','jpeg','txt']);
const db=()=>getStore({name:'fs',consistency:'strong'}),fl=()=>getStore({name:'files',consistency:'strong'});
const now=()=>Math.floor(Date.now()/1000),rid=()=>Date.now().toString().padStart(13,'0')+'-'+crypto.randomBytes(3).toString('hex');
const cl=(s,n=80)=>String(s??'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,n);
const scr=(p,s)=>new Promise((ok,ko)=>crypto.scrypt(String(p),s,32,{N:16384,r:8,p:1},(e,k)=>e?ko(e):ok(k.toString('hex'))));
const norm=s=>String(s).replace(/[\u2018\u2019\u02bc`´]/g,"'").normalize('NFKD').replace(/[^\x00-\x7f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const fp=(...a)=>scr(a.map(norm).join('|'),ADM.salt);
const teq=(a,b)=>{a=Buffer.from(String(a));b=Buffer.from(String(b));return a.length===b.length&&crypto.timingSafeEqual(a,b)};
const hpw=async(pw,salt=crypto.randomBytes(16).toString('hex'))=>salt+'$'+await scr(pw,salt);
const vpw=async(pw,h)=>teq(await hpw(pw,h.split('$')[0]),h);
const key=()=>{const k=process.env.SESSION_SECRET;if(!k||k.length<16)throw new Error('SESSION_SECRET manquant');return k};
const mac=v=>crypto.createHmac('sha256',key()).update(v).digest('hex');
const sign=v=>v+'.'+mac(v);
const unsign=t=>{const i=t.lastIndexOf('.');if(i<1)return null;const v=t.slice(0,i);return teq(t.slice(i+1),mac(v))?v:null};
const ck=(req,n)=>{for(const p of (req.headers.get('cookie')||'').split(';')){const i=p.indexOf('=');if(i>0&&p.slice(0,i).trim()===n)return unsign(p.slice(i+1).trim())}return null};
const setc=(n,v,age,sec)=>`${n}=${v?sign(v):''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${sec?'; Secure':''}`;
const res=(b,s=200,h={},ct='application/json')=>new Response(typeof b==='string'||b instanceof ArrayBuffer?b:JSON.stringify(b),{status:s,headers:{'Content-Type':ct+(/json|text|javascript/.test(ct)?'; charset=utf-8':''),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...h}});
const err=(s,m)=>res({error:m},s);
const phoneOk=p=>/^\+?\d{8,15}$/.test(p||'');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16);
async function limited(k,max,win){const w=Math.floor(Date.now()/(win*1000)),kk=`rl/${k}/${w}`,c=(await db().get(kk,{type:'json'}))?.n||0;if(c>=max)return true;await db().setJSON(kk,{n:c+1});return false}
const keys=async(s,pre)=>(await s.list({prefix:pre})).blobs.map(b=>b.key);
export default async(req,ctx)=>{
 const u=new URL(req.url),p=u.pathname.replace(/^\/api/,''),m=req.method,ip=ctx?.ip||'?',sec=u.protocol==='https:';
 const L=(ev,d)=>db().setJSON('lg/'+rid(),{ts:now(),ev,detail:String(d??'').slice(0,300),ip});
 try{
  if(m!=='GET'&&req.headers.get('x-requested-with')!=='fs')return err(403,'Requête refusée');
  const bj=async()=>{const t=await req.text();if(t.length>20000)throw new Error('big');return JSON.parse(t||'{}')};
  const user=async()=>{const v=ck(req,'s');if(!v)return null;const[id,exp]=v.split(':');if(!RID.test(id)||+exp<now())return null;const x=await db().get('u/'+id,{type:'json'});return x?{...x,id}:null};
  const admin=async()=>{const x=await user();return x&&x.admin?x:null};
  if(m==='GET'){
   if(p==='/me'){const x=await user();return res({user:x?{name:x.name,level:x.level,filiere:x.filiere,cursus:x.cursus,admin:!!x.admin}:null,visitor:!!ck(req,'v')})}
   if(p==='/docs'){const ds=await Promise.all((await keys(db(),'d/')).map(k=>db().get(k,{type:'json'})));return res(ds.filter(Boolean).sort((a,b)=>b.ts-a.ts).map(({id,title,level,filiere,matiere,kind,size,ts})=>({id,title,level,filiere,matiere,kind,size,ts})))}
   let r=p.match(/^\/dl\/([^/]+)\/(\d+)$/);
   if(r){const x=await user(),v=ck(req,'v');if(!x&&!v)return err(401,'Identification requise');if(!RID.test(r[1]))return err(404,'Introuvable');
    const d=await db().get('d/'+r[1],{type:'json'}),n=+r[2];if(!d||n>=d.parts)return err(404,'Introuvable');
    if(n===0){await db().setJSON(`dl/${Date.now().toString().padStart(13,'0')}_${d.id}_${x?x.id:'v'+v}`,{});await L('download',`doc ${d.id} par ${x?'user '+x.id:'visiteur '+v}`)}
    const b=await fl().get(`${d.fileId}/${n}`,{type:'arrayBuffer'});if(!b)return err(404,'Fichier manquant');
    return res(b,200,{'X-Parts':String(d.parts),'X-Name':encodeURIComponent(d.orig)},'application/octet-stream')}
   if(p.startsWith('/admin/')){
    if(!await admin()){await L('admin_denied',p);return err(403,'Interdit')}
    if(p==='/admin/panel.js')return res(ADMIN_JS,200,{},'text/javascript');
    if(p==='/admin/stats'){
     const [us,vs,ds,dls]=await Promise.all(['u/','v/','d/','dl/'].map(x=>keys(db(),x)));
     const day={},top={};for(const k of dls){const[t,did]=k.slice(3).split('_');const dd=new Date(+t).toISOString().slice(0,10);if(+t>Date.now()-7*864e5)day[dd]=(day[dd]||0)+1;top[did]=(top[did]||0)+1}
     const tops=await Promise.all(Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,5).map(async([i,n])=>({title:(await db().get('d/'+i,{type:'json'}))?.title||'(supprimé)',n})));
     const ppl=async(ks,reg)=>(await Promise.all(ks.sort().reverse().slice(0,100).map(k=>db().get(k,{type:'json'})))).filter(Boolean).map(x=>({name:x.name,sex:x.sex,phone:x.phone,level:reg?x.level:null,filiere:reg?x.filiere:null,ts:x.ts,reg:reg?1:0}));
     return res({users:us.length,visitors:vs.length,docs:ds.length,dl:dls.length,dl7:Object.entries(day).sort().map(([d,n])=>({d,n})),top:tops,people:[...await ppl(us,1),...await ppl(vs,0)]})}
    if(p==='/admin/logs'){const ks=(await keys(db(),'lg/')).sort().reverse().slice(0,150);return res((await Promise.all(ks.map(k=>db().get(k,{type:'json'})))).filter(Boolean))}
   }
   return err(404,'Introuvable')}
  if(m==='DELETE'){const r=p.match(/^\/admin\/doc\/([^/]+)$/);if(!r||!await admin()){return err(403,'Interdit')}
   if(!RID.test(r[1]))return err(404,'Introuvable');const d=await db().get('d/'+r[1],{type:'json'});
   if(d){for(const k of await keys(fl(),d.fileId+'/'))await fl().delete(k);await db().delete('d/'+r[1]);await L('doc_delete',r[1])}return res({ok:1})}
  if(m!=='POST')return err(405,'Méthode refusée');
  if(p==='/admin/upload'){
   const a=await admin();if(!a){await L('admin_denied',p);return err(403,'Interdit')}
   const h=n=>req.headers.get(n)||'',uid=h('x-upload-id'),part=+h('x-part'),parts=+h('x-parts');
   if(!/^[0-9a-f]{32}$/.test(uid)||!Number.isInteger(part)||!Number.isInteger(parts)||parts<1||parts>7||part<0||part>=parts)return err(400,'Paramètres invalides');
   const meta=JSON.parse(decodeURIComponent(h('x-meta'))),name=cl(meta.name,200),ext=name.split('.').pop().toLowerCase();
   if(!EXT.has(ext))return err(400,'Type de fichier refusé');
   const buf=await req.arrayBuffer();if(!buf.byteLength||buf.byteLength>MAXPART+1024)return err(400,'Fragment invalide');
   await fl().set(`${uid}/${part}`,buf);
   if(part===parts-1){if((await keys(fl(),uid+'/')).length!==parts)return err(400,'Fragments manquants');
    const id=rid();await db().setJSON('d/'+id,{id,title:cl(meta.title)||'Sans titre',level:cl(meta.level,20),filiere:cl(meta.filiere),matiere:cl(meta.matiere),kind:cl(meta.kind,30),fileId:uid,parts,orig:name,size:Math.min(+h('x-size')||0,MAXFILE),ts:now()});await L('doc_upload',meta.title)}
   return res({ok:1})}
  const ipk=sha(ip);
  if(['/login','/register','/visitor'].includes(p)&&await limited('ip'+ipk,12,300)){await L('rate_limit',p);return err(429,'Trop de tentatives, patiente 5 minutes')}
  if(p==='/logout')return res({ok:1},200,{'Set-Cookie':setc('s','',0,sec)});
  const j=await bj();
  if(p==='/visitor'){const n=cl(j.name),s=j.sex,t=cl(j.phone,20).replace(/\s/g,'');
   if(n.length<3||!SEX.includes(s)||!phoneOk(t))return err(400,'Nom complet, sexe et téléphone valides requis');
   const id=rid();await db().setJSON('v/'+id,{name:n,sex:s,phone:t,ts:now()});await L('visitor_id',id);return res({ok:1},200,{'Set-Cookie':setc('v',id,31536000,sec)})}
  if(p==='/register'){const n=cl(j.name),lv=cl(j.level,20),fi=cl(j.filiere),cu=cl(j.cursus),t=cl(j.phone,20).replace(/\s/g,''),s=j.sex,pw=String(j.password||'');
   if(n.length<3||!lv||!fi||!cu||!SEX.includes(s)||!phoneOk(t))return err(400,'Tous les champs sont requis et valides');
   if(pw.length<8||pw.length>128)return err(400,'Mot de passe : 8 caractères minimum');
   const adm=teq(await fp(n,lv,fi,cu,t,s),ADM.fp),AP=process.env.ADMIN_PASSWORD||'';
   if(adm&&!(AP&&teq(pw,AP))){await L('admin_spoof_attempt',ip);return err(400,'Inscription impossible')}
   const id=rid();
   if(adm)await db().setJSON('up/'+t,{id});else if(!(await db().setJSON('up/'+t,{id},{onlyIfNew:true})).modified)return err(400,'Ce numéro a déjà un compte');
   await db().setJSON('u/'+id,{name:n,level:lv,filiere:fi,cursus:cu,phone:t,sex:s,pw:await hpw(pw),admin:adm,ts:now()});await L('register',id);
   return res({ok:1},200,{'Set-Cookie':setc('s',`${id}:${now()+604800}`,604800,sec)})}
  if(p==='/login'){const t=cl(j.phone,20).replace(/\s/g,'');
   if(await limited('ph'+sha(t),8,900)){await L('rate_limit',p);return err(429,'Trop de tentatives, patiente 15 minutes')}
   const ref=await db().get('up/'+t,{type:'json'}),x=ref&&RID.test(ref.id)?await db().get('u/'+ref.id,{type:'json'}):null;
   const ok=await vpw(String(j.password||'').slice(0,128),x?x.pw:await hpw('x'));
   if(!x||!ok){await L('login_fail',t.slice(-3));return err(401,'Identifiants incorrects')}
   await L('login',ref.id);return res({ok:1},200,{'Set-Cookie':setc('s',`${ref.id}:${now()+604800}`,604800,sec)})}
  return err(404,'Introuvable')
 }catch(e){console.error(e);return err(500,'Erreur serveur')}
};
export const config={path:'/api/*'};
