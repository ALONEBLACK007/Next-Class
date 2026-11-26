// ---------- อ่าน/เขียนไฟล์ (CSV · Excel · JSON) ----------
function parseCSV(t){t=String(t).replace(/^﻿/,'');const r=[];let row=[],c='',q=false;for(let i=0;i<t.length;i++){const h=t[i];if(q){if(h=='"'){if(t[i+1]=='"'){c+='"';i++}else q=false}else c+=h}else if(h=='"')q=true;else if(h==','){row.push(c);c=''}else if(h=='\n'||h=='\r'){if(h=='\r'&&t[i+1]=='\n')i++;row.push(c);c='';if(row.some(x=>x.trim()))r.push(row);row=[]}else c+=h}row.push(c);if(row.some(x=>x.trim()))r.push(row);
 if(!r.length)return[];const hd=r[0].map(x=>x.trim().toLowerCase());return r.slice(1).map(a=>Object.fromEntries(hd.map((k,i)=>[k,(a[i]||'').trim()])))}
const toCSV=(h,rows)=>'﻿'+[h,...rows].map(r=>r.map(v=>{v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(',')).join('\n');
const lowerObj=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[String(k).trim().toLowerCase(),String(v??'').trim()]));
async function readAny(f){const n=f.name.toLowerCase();
 if(n.endsWith('.json')){const j=JSON.parse(await f.text());if(j&&j.data&&Array.isArray(j.data.courses))return{project:j};const out=[];
  const put=(k,v)=>{if(Array.isArray(v)&&v.length&&typeof v[0]=='object')out.push({name:f.name+' › '+k,rows:v.map(lowerObj)})};if(Array.isArray(j))put('data',j);else for(const k in j)put(k,j[k]);return{tables:out}}
 if(/\.xlsx?$/.test(n)){if(typeof XLSX=='undefined')throw new Error('โหลดไลบรารี Excel ไม่ได้ (ต้องต่ออินเทอร์เน็ต) — ใช้ไฟล์ CSV แทนได้');
  const wb=XLSX.read(await f.arrayBuffer(),{type:'array'});return{tables:wb.SheetNames.map(s=>({name:f.name+' › '+s,rows:XLSX.utils.sheet_to_json(wb.Sheets[s],{defval:'',raw:false}).map(lowerObj)})).filter(x=>x.rows.length)}}
 return{tables:[{name:f.name,rows:parseCSV(await f.text())}]}}
async function save(name,data){const blob=data instanceof Blob?data:new Blob([data],{type:name.endsWith('.json')?'application/json':'text/csv;charset=utf-8'});
 try{if(typeof claude!='undefined'&&claude.use){const d=await claude.use('downloads');if(d){await d.save({filename:name,data:blob});return}}}catch(e){if(e&&e.code==='declined')return;console.warn('downloads capability ไม่พร้อม ใช้การดาวน์โหลดปกติแทน',e)}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}

// ---------- โครงสร้างไฟล์ ----------
const HEAD={courses:['code','name','group','teacher','periods','room_type'],teachers:['name','max_hours','unavailable'],rooms:['name','capacity','type'],groups:['name','size'],students:['student_id','name','group']};
const NEWH={output:['group_id','timeslot_id','subject_id','teacher_id','room_id'],register:['group_id','subject_id'],room:['room_id','room_name'],student_group:['group_id','group_name','student_count'],subject:['subject_id','subject_name','theory','practice'],teach:['teacher_id','subject_id'],teacher:['teacher_id','teacher_name'],timeslot:['timeslot_id','day','period','start','end']};
const OPTCOL={room:['capacity','type'],student_group:['advisor','unavailable'],subject:['credit','room_type'],teacher:['max_hours','unavailable']};
const PV={courses:['code','name','group','teacher','theory','practice','periods','room_type'],teachers:['id','name','max_hours','unavailable'],rooms:['id','name','capacity','type'],groups:['id','name','size','advisor'],students:['student_id','name','group']};
const PVN={courses:'รายวิชา-กลุ่ม (ลงทะเบียน)',teachers:'ครู',rooms:'ห้อง',groups:'กลุ่มเรียน',students:'นักเรียน'};
const TTK=['วัน','คาบ','รหัสวิชา','กลุ่มเรียน','ครู','ห้อง'];   // หัวคอลัมน์ไฟล์ timetable.csv / timetable_by_group.csv ที่ระบบส่งออก
function detect(rows){const k=Object.keys(rows[0]||{});if(TTK.every(h=>k.includes(h)))return'timetable';for(const t in NEWH)if(NEWH[t].every(h=>k.includes(h)))return t;for(const t in HEAD)if(HEAD[t].every(h=>k.includes(h)))return t;return null}
const num=v=>v===''||v==null?null:isFinite(+v)?+v:null;
function parseUnav(str){const set=new Set(),bad=[];String(str||'').split(/[;,]/).map(s=>s.trim()).filter(Boolean).forEach(u=>{const m=u.match(/^(พฤ|จ|อ|พ|ศ|mon|tue|wed|thu|fri)\s*(\d{1,2})?(?:\s*-\s*(\d{1,2}))?$/i);if(!m){bad.push(u);return}
 const d=DM[m[1].toLowerCase()],a=m[2]?+m[2]:1,b=m[3]?+m[3]:(m[2]?a:P);if(a<1||b>P||a>b){bad.push(u);return}for(let p=a;p<=b;p++)set.add(d*P+p-1)});return{set,bad}}
const toMin=s=>{const m=String(s||'').match(/(\d{1,2})[:.](\d{2})/);return m?+m[1]*60+ +m[2]:null};

// ---------- แปลงชุดไฟล์การแข่งขัน (7 ไฟล์) เป็นโมเดลภายใน + Data Cleansing ----------
function buildNew(R,nd){const g=k=>R[k]||[],W=[],w=(m,fix,l='wa')=>W.push({l,m,fix});
 const uniq=(rows,key,file)=>{const m=new Map();rows.forEach((x,i)=>{const k=x[key];if(!k){w(`${file} แถว ${i+2}: ไม่มี ${key}`,'ใส่รหัส หรือลบแถวนี้ (ข้ามให้แล้ว)');return}
  if(m.has(k)){const same=JSON.stringify(m.get(k))==JSON.stringify(x);w(`${file}: ${key} ซ้ำ "${k}" ${same?'ข้อมูลเหมือนกัน — ตัดแถวซ้ำให้แล้ว':'ข้อมูลไม่ตรงกัน — ใช้แถวแรก'}`,same?'ลบแถวซ้ำในไฟล์ต้นฉบับ':'ตรวจว่าแถวไหนถูกแล้วลบอีกแถว')}else m.set(k,x)});return m};
 const SUB=uniq(g('subject'),'subject_id','subject.csv'),TEA=uniq(g('teacher'),'teacher_id','teacher.csv'),ROO=uniq(g('room'),'room_id','room.csv'),GRP=uniq(g('student_group'),'group_id','student_group.csv');
 const uname=(map,idk,nk)=>{const seen=new Map(),out=new Map();for(const [id,x] of map){let n=x[nk]||id;if(seen.has(n)){w(`ชื่อซ้ำ "${n}" (${seen.get(n)} และ ${id})`,'ระบบต่อท้ายรหัสให้เพื่อแยกกัน');n=`${n} (${id})`}seen.set(x[nk]||id,id);out.set(id,n)}return out};
 const TN=uname(TEA,'teacher_id','teacher_name'),RN=uname(ROO,'room_id','room_name'),GN=uname(GRP,'group_id','group_name');
 const te={},seenT=new Set();
 g('teach').forEach((x,i)=>{const k=x.teacher_id+'|'+x.subject_id;if(seenT.has(k)){w(`teach.csv: แถวซ้ำ ${x.teacher_id}–${x.subject_id}`,'ตัดแถวซ้ำให้แล้ว');return}seenT.add(k);
  if(!TEA.has(x.teacher_id)){w(`teach.csv แถว ${i+2}: ไม่พบ teacher_id "${x.teacher_id}" ใน teacher.csv`,'เพิ่มครูใน teacher.csv หรือแก้รหัสให้ตรง');return}
  if(!SUB.has(x.subject_id))w(`teach.csv แถว ${i+2}: ไม่พบ subject_id "${x.subject_id}" ใน subject.csv`,'แก้รหัสวิชาให้ตรงกับ subject.csv');(te[x.subject_id]=te[x.subject_id]||[]).push(TN.get(x.teacher_id))});
 const groups=[...GRP.values()].map(x=>({id:x.group_id,name:GN.get(x.group_id),size:x.student_count,advisor:x.advisor||'',unavailable:x.unavailable||''}));
 const seenR=new Set(),courses=[],badSub=new Set();
 g('register').forEach((x,i)=>{const k=x.group_id+'|'+x.subject_id;if(seenR.has(k)){w(`register.csv: ลงทะเบียนซ้ำ ${x.group_id}–${x.subject_id}`,'ตัดแถวซ้ำให้แล้ว');return}seenR.add(k);
  const s=SUB.get(x.subject_id);if(!s){w(`register.csv แถว ${i+2}: ไม่พบวิชา "${x.subject_id}" ใน subject.csv`,'เพิ่มวิชาใน subject.csv หรือลบแถวลงทะเบียนนี้','er');return}
  if(!GN.has(x.group_id)){w(`register.csv แถว ${i+2}: ไม่พบกลุ่ม "${x.group_id}" ใน student_group.csv`,'เพิ่มกลุ่มเรียนใน student_group.csv','er');return}
  const th=num(s.theory),pr=num(s.practice);if((th==null||pr==null||th<0||pr<0)&&!badSub.has(x.subject_id)){badSub.add(x.subject_id);w(`subject.csv: วิชา ${x.subject_id} theory/practice ไม่ใช่ตัวเลขที่ถูกต้อง ("${s.theory}","${s.practice}")`,'ใส่จำนวนเต็ม ≥ 0 เช่น 1 และ 4','er')}
  const ts=te[x.subject_id]||[];courses.push({code:x.subject_id,name:s.subject_name||x.subject_id,group:GN.get(x.group_id),teachers:ts,teacher:ts.join(' / '),theory:Math.max(0,th||0),practice:Math.max(0,pr||0),periods:Math.max(0,th||0)+Math.max(0,pr||0),room_type:s.room_type||''})});
 const regS=new Set([...seenR].map(k=>k.split('|')[1]));for(const [k] of SUB)if(!regS.has(k))w(`subject.csv: วิชา ${k} ไม่มีกลุ่มลงทะเบียน`,'ไม่กระทบการจัดตาราง','in');
 const teachers=[...TEA.values()].map(x=>({id:x.teacher_id,name:TN.get(x.teacher_id),max_hours:x.max_hours||'',unavailable:x.unavailable||''}));
 const rooms=[...ROO.values()].map(x=>({id:x.room_id,name:RN.get(x.room_id),capacity:x.capacity||'',type:x.type||x.room_type||''}));
 // timeslot
 const t=g('timeslot');let slots=null;
 if(t.length){const ids=new Set(),days={},map={};let mx=0;
  t.forEach((x,i)=>{if(ids.has(x.timeslot_id))w(`timeslot.csv: timeslot_id ซ้ำ "${x.timeslot_id}"`,'ใช้รหัสคาบไม่ซ้ำกัน','er');ids.add(x.timeslot_id);
   const d=dayIdx(x.day),p=+x.period;if(d<0){w(`timeslot.csv แถว ${i+2}: ไม่รู้จักวัน "${x.day}"`,'ใช้ Mon–Fri หรือ จันทร์–ศุกร์','er');return}
   if(!(p>=1&&p<=20)){w(`timeslot.csv แถว ${i+2}: period "${x.period}" ไม่ถูกต้อง`,'ใส่เลขคาบ 1, 2, 3, …','er');return}
   mx=Math.max(mx,p);(days[d]=days[d]||[]).push({p,s:toMin(x.start),e:toMin(x.end),x});map[x.timeslot_id]=d*100+p});
  const times=[],ids2={};let lunchP=null;
  Object.entries(days).forEach(([d,a])=>{a.sort((u,v)=>u.p-v.p);a.forEach((o,j)=>{if(!times[o.p-1])times[o.p-1]=`${o.x.start}–${o.x.end}`;if(o.s==720&&lunchP==null)lunchP=o.p;
   if(o.s!=null&&o.e!=null&&o.e<=o.s)w(`timeslot.csv: ${DF[d]} คาบ ${o.p} เวลาเริ่ม/จบไม่ถูกต้อง (${o.x.start}–${o.x.end})`,'เวลาจบต้องมากกว่าเวลาเริ่ม','er');
   if(j&&a[j-1].e!=null&&o.s!=null&&o.s<a[j-1].e)w(`timeslot.csv: ${DF[d]} คาบ ${a[j-1].p} กับคาบ ${o.p} เวลาซ้อนกัน`,'แก้เวลาให้ต่อเนื่องไม่ทับกัน','er');
   if(j&&o.p==a[j-1].p)w(`timeslot.csv: ${DF[d]} คาบ ${o.p} ซ้ำ`,'ลบแถวซ้ำ','er')});
   if(a.length<mx)w(`timeslot.csv: ${DF[d]} มี ${a.length} คาบ น้อยกว่าวันอื่น (${mx})`,'ระบบใช้จำนวนคาบสูงสุดเท่ากันทุกวัน','in')});
  for(let d=0;d<5;d++)if(!days[d])w(`timeslot.csv: ไม่มีข้อมูลวัน${DF[d]}`,'ระบบถือว่าทุกวันมีคาบเท่ากัน','in');
  Object.entries(map).forEach(([id,v])=>{const d=Math.floor(v/100),p=v%100;ids2[d*mx+p-1]=id});
  const lunch=(lunchP||5)-1;if(!lunchP)w('timeslot.csv: ไม่พบคาบที่เริ่ม 12:00 ใช้คาบ 5 เป็นพักเที่ยงตามโจทย์','—','in');
  slots={P:mx,lunch,times,ids:ids2}}
 else w('ไม่มี timeslot.csv — ใช้ค่าเริ่มต้น 8 คาบ/วัน คาบ 5 พักเที่ยง','นำเข้า timeslot.csv เพื่อกำหนดคาบเอง','in');
 return{courses,teachers,rooms,groups,students:(nd&&nd.students)||[],slots,warn:W,src:'new',
  ids:{teacher:Object.fromEntries(teachers.map(x=>[x.name,x.id])),room:Object.fromEntries(rooms.map(x=>[x.name,x.id])),group:Object.fromEntries(groups.map(x=>[x.name,x.id]))}}}

// ชุดไฟล์ทั่วไป (courses/teachers/rooms/groups/students) → โมเดลภายใน
function normalize(d){d.students=d.students||[];d.warn=d.warn||[];
 d.courses=(d.courses||[]).map(c=>{if(Array.isArray(c.teachers)&&c.theory!==undefined&&c.practice!==undefined)return c;
  const ts=Array.isArray(c.teachers)?c.teachers:String(c.teacher||'').split('/').map(s=>s.trim()).filter(Boolean),per=+c.periods||0,lab=/ปฏิบัติ|lab/i.test(c.room_type||'');
  const th=c.theory!==undefined&&c.theory!==''?+c.theory||0:(lab?0:per),pr=c.practice!==undefined&&c.practice!==''?+c.practice||0:(lab?per:0);return{...c,teachers:ts,teacher:ts.join(' / '),theory:th,practice:pr,periods:th+pr}});
 ['teachers','rooms','groups'].forEach(k=>d[k]=d[k]||[]);return d}

// ---------- ตรวจสอบความถูกต้องก่อนคำนวณ ----------
function validate(d){const I=[],add=(l,m,fix)=>I.push({l,m,fix});(d.warn||[]).forEach(x=>I.push(typeof x=='string'?{l:'wa',m:x}:x));
 const T=new Map(),R=new Map(),G=new Map(),avail=DN.length*(P-1);
 d.teachers.forEach((t,i)=>{if(!t.name){add('er',`ครูแถว ${i+2}: ไม่มีชื่อ`,'ใส่ชื่อครู');return}if(T.has(t.name))add('er',`ชื่อครูซ้ำ: ${t.name}`,'ใช้ชื่อไม่ซ้ำ หรือรวมเป็นแถวเดียว');T.set(t.name,t);
  if(t.max_hours!==''&&t.max_hours!=null&&!(+t.max_hours>0))add('er',`ครู ${t.name}: max_hours "${t.max_hours}" ไม่ถูกต้อง`,'ใส่ตัวเลขมากกว่า 0 หรือเว้นว่าง (ไม่จำกัด)');
  parseUnav(t.unavailable).bad.forEach(b=>add('wa',`ครู ${t.name}: เวลาไม่สะดวก "${b}" รูปแบบไม่ถูกต้อง (ข้ามไป)`,'ตัวอย่าง จ1;พ3-4;ศ (ทั้งวัน)'))});
 d.rooms.forEach((r,i)=>{if(!r.name){add('er',`ห้องแถว ${i+2}: ไม่มีชื่อ`,'ใส่ชื่อห้อง');return}if(R.has(r.name))add('er',`ห้องซ้ำ: ${r.name}`,'ลบแถวซ้ำ');R.set(r.name,r);
  if(r.capacity!==''&&r.capacity!=null&&!(+r.capacity>0))add('er',`ห้อง ${r.name}: capacity "${r.capacity}" ไม่ถูกต้อง`,'ใส่ตัวเลข หรือเว้นว่าง (ไม่จำกัด)')});
 d.groups.forEach((g,i)=>{if(!g.name){add('er',`กลุ่มแถว ${i+2}: ไม่มีชื่อ`,'ใส่ชื่อกลุ่ม');return}if(G.has(g.name))add('er',`กลุ่มซ้ำ: ${g.name}`,'ลบแถวซ้ำ');G.set(g.name,g);
  if(g.size===''||g.size==null)add('in',`กลุ่ม ${g.name}: ไม่ระบุจำนวนนักเรียน — ข้ามการตรวจความจุห้อง`,'ใส่ student_count ถ้าต้องการตรวจความจุ');else if(!(+g.size>0))add('er',`กลุ่ม ${g.name}: จำนวนนักเรียน "${g.size}" ไม่ถูกต้อง`,'ใส่ student_count เป็นตัวเลขมากกว่า 0');parseUnav(g.unavailable).bad.forEach(b=>add('wa',`กลุ่ม ${g.name}: เวลาไม่ว่าง "${b}" ไม่ถูกต้อง`,'ตัวอย่าง ศ7-8'))});
 const codes=new Set(),tl={},gl={},used=new Set(),types=new Set(d.rooms.map(r=>r.type).filter(Boolean));
 d.courses.forEach((c,i)=>{const w=`วิชา ${c.code||'แถว '+(i+2)} (${c.group})`;
  if(!c.code)add('er',`${w}: ไม่มีรหัสวิชา`,'ใส่รหัสวิชา');else if(codes.has(c.code+'|'+c.group))add('er',`${w}: ลงทะเบียนซ้ำ`,'ลบแถวซ้ำ');codes.add(c.code+'|'+c.group);
  const per=+c.periods||0;if(!(per>0))add('er',`${w}: จำนวนคาบเป็น 0`,'ตรวจ theory+practice (ต้องรวมกันมากกว่า 0)');
  const ts=c.teachers&&c.teachers.length?c.teachers:(c.teacher?[c.teacher]:[]);if(!ts.length)add('er',`${w}: ไม่มีครูที่สอนวิชานี้`,`เพิ่มแถว <teacher_id>,${c.code} ใน teach.csv`);
  ts.forEach(t=>{used.add(t);if(!T.has(t))add('er',`${w}: ไม่พบครู "${t}"`,'เพิ่มครูในไฟล์ครู หรือแก้ชื่อให้ตรง')});
  const g=G.get(c.group);if(!g)add('er',`${w}: ไม่พบกลุ่มเรียน "${c.group}"`,'เพิ่มกลุ่มในไฟล์กลุ่มเรียน');
  const fit=d.rooms.filter(r=>!(+r.capacity>0)||!g||+r.capacity>=+g.size);
  if(!fit.length)add('er',`${w}: ไม่มีห้องที่จุนักเรียน ${g?g.size:'?'} คนได้`,'เพิ่มห้องที่ใหญ่พอ หรือแบ่งกลุ่มเรียน');
  else if(c.room_type&&types.has(c.room_type)&&!fit.some(r=>r.type==c.room_type))add('wa',`${w}: ห้องประเภท "${c.room_type}" จุไม่พอ จะใช้ห้องอื่นแทน`,'เพิ่มห้องประเภทนี้ที่จุพอ');
  else if(c.room_type&&!types.has(c.room_type))add('in',`${w}: ไม่มีห้องประเภท "${c.room_type}" ใช้ห้องทั่วไปแทน`,'เพิ่มคอลัมน์ type ในไฟล์ห้อง');
  if(ts.length==1)tl[ts[0]]=(tl[ts[0]]||0)+per;gl[c.group]=(gl[c.group]||0)+per});
 for(const t in tl)if(T.has(t)){const tt=T.get(t),un=parseUnav(tt.unavailable).set.size,cap=Math.min(+tt.max_hours>0?+tt.max_hours:1e9,avail-un);
  if(tl[t]>cap)add('er',`ครู ${t}: ต้องสอน ${tl[t]} คาบ แต่มีเวลาว่าง/ชั่วโมงสูงสุดเพียง ${cap}`,'เพิ่มครูร่วมสอนใน teach.csv, ลดเวลาไม่สะดวก หรือเพิ่ม max_hours')}
 for(const g in gl)if(G.has(g)){const cap=Math.min(avail-parseUnav(G.get(g).unavailable).set.size,DN.length*MAXD);if(gl[g]>cap)add('er',`กลุ่ม ${g}: ลงทะเบียน ${gl[g]} คาบ เกินช่องเวลาเรียนได้ ${cap} คาบ/สัปดาห์`,'ลดรายวิชา หรือเพิ่มคาบใน timeslot.csv')}
 const totP=Object.values(gl).reduce((a,b)=>a+b,0);if(d.rooms.length&&totP>d.rooms.length*avail)add('er',`คาบรวม ${totP} เกินความจุห้องทั้งหมด ${d.rooms.length*avail}`,'เพิ่มห้องเรียน');
 if(!d.rooms.length)add('er','ไม่มีข้อมูลห้องเรียน','นำเข้า room.csv');
 d.teachers.forEach(t=>{if(t.name&&!used.has(t.name))add('in',`ครู ${t.name} ไม่มีวิชาสอนในรอบนี้`,'ไม่กระทบการจัดตาราง')});
 const sid=new Set();(d.students||[]).forEach((s,i)=>{if(!s.student_id)add('er',`นักเรียนแถว ${i+2}: ไม่มีรหัส`,'ใส่รหัสนักเรียน');else if(sid.has(s.student_id))add('er',`รหัสนักเรียนซ้ำ: ${s.student_id}`,'ลบแถวซ้ำ');sid.add(s.student_id);if(!G.has(s.group))add('er',`นักเรียน ${s.student_id}: ไม่พบกลุ่มเรียน "${s.group}"`,'แก้ชื่อกลุ่มให้ตรง')});
 if(!d.courses.length)add('er','ไม่มีข้อมูลรายวิชาที่ลงทะเบียน','นำเข้า register.csv + subject.csv หรือ courses.csv');
 if(!I.some(i=>i.l=='er'))add('ok','ข้อมูลถูกต้องครบถ้วน พร้อมจัดตาราง');return I}

// ---------- นำเข้า output.csv (ตรวจตารางที่มีอยู่) ----------
function outputToRows(d,rows){const inv=o=>Object.fromEntries(Object.entries(o||{}).map(([k,v])=>[v,k]));const I=d.ids||{},T=inv(I.teacher),R=inv(I.room),G=inv(I.group),TS=inv((d.slots||{}).ids);const bad=[];
 const out=rows.map((r,i)=>{const slot=TS[r.timeslot_id];const c=d.courses.find(c=>c.code==r.subject_id&&c.group==(G[r.group_id]||r.group_id));if(slot==null)bad.push(`แถว ${i+2}: timeslot_id ${r.timeslot_id} ไม่มีใน timeslot.csv`);
  return{slot:+slot,code:r.subject_id,name:c?c.name:r.subject_id,group:G[r.group_id]||r.group_id,teacher:T[r.teacher_id]||r.teacher_id,room:R[r.room_id]||r.room_id}}).filter(r=>!isNaN(r.slot));return{rows:out,bad}}

// ---------- นำเข้า timetable.csv (ไฟล์ตารางที่ส่งออกจากระบบ) ----------
function ttToRows(rows,Pn){const bad=[],times=[],out=[];if(!Pn)Pn=Math.max(8,...rows.map(r=>+r['คาบ']||0));
 rows.forEach((r,i)=>{const di=dayIdx(r['วัน']),p=+r['คาบ'];if(di<0||!(p>=1&&p<=Pn)){bad.push(`แถว ${i+2}: วัน/คาบไม่ถูกต้อง (${r['วัน']} ${r['คาบ']})`);return}
  if(!r['รหัสวิชา']||!r['กลุ่มเรียน']){bad.push(`แถว ${i+2}: ไม่มีรหัสวิชาหรือกลุ่มเรียน`);return}if(r['เวลา']&&!times[p-1])times[p-1]=r['เวลา'];const k=r['ประเภท']||'';
  const o={slot:di*Pn+p-1,code:r['รหัสวิชา'],name:r['วิชา']||r['รหัสวิชา'],group:r['กลุ่มเรียน'],teacher:r['ครู'],room:r['ห้อง']};if(/ปฏิบัติ/.test(k))o.kind='p';else if(/ทฤษฎี/.test(k))o.kind='t';out.push(o)});
 return{rows:out,bad,P:Pn,times}}
function dataFromRows(rows,Pn,times){const C=new Map(),uniq=a=>[...new Set(a.filter(Boolean))];
 rows.forEach(r=>{const k=r.code+'\u0001'+r.group;const c=C.get(k)||{code:r.code,name:r.name,group:r.group,teachers:[],theory:0,practice:0,room_type:''};if(!c.teachers.includes(r.teacher)&&r.teacher)c.teachers.push(r.teacher);if(r.kind=='p')c.practice++;else c.theory++;C.set(k,c)});
 const courses=[...C.values()].map(c=>({...c,teacher:c.teachers.join(' / '),periods:c.theory+c.practice}));
 return{courses,teachers:uniq(rows.map(r=>r.teacher)).map(n=>({name:n,max_hours:'',unavailable:''})),rooms:uniq(rows.map(r=>r.room)).map(n=>({name:n,capacity:'',type:''})),
  groups:uniq(rows.map(r=>r.group)).map(n=>({name:n,size:''})),students:[],slots:{P:Pn,lunch:4,times:times.some(Boolean)?times:null},src:'timetable',
  warn:[{l:'in',m:'สร้างชุดข้อมูลจากไฟล์ตารางที่นำเข้า (จำนวนคาบของวิชา = จำนวนคาบในไฟล์) ไม่มีจำนวนนักเรียน/ความจุห้อง จึงข้ามการตรวจความจุ',fix:'นำเข้า 7 ไฟล์ของโจทย์พร้อมกันเพื่อตรวจครบทุกเงื่อนไข'}]}}

if(S.data)S.data=normalize(S.data);
