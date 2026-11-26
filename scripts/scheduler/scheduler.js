// ---------- Scheduler: CSP + Most-Constrained-First Greedy + Simulated Annealing (Agent: Plan → Act → Check → Improve) ----------
const W_DEF={s11:3,s12:4,s13:2,s14:1,s15:3,s16:3,s17:1,s18:4,s19:2,s20:1,tc:6};
const HARD=['','ครูคนเดียวกันไม่สอนเกิน 1 กลุ่มในเวลาเดียวกัน','ห้องเดียวกันไม่ถูกใช้เกิน 1 กลุ่มในเวลาเดียวกัน (รวมห้องที่แจ้งปิด)','กลุ่มเรียนไม่เรียนเกิน 1 วิชาในเวลาเดียวกัน','จัดเฉพาะวิชาที่กลุ่มลงทะเบียน','ใช้ครูที่ได้รับมอบหมายให้สอนวิชานั้น (teach.csv)','จำนวนคาบครบตามโครงสร้างวิชา (theory+practice)','จัดภายในวัน/ช่วงเวลาที่กำหนด (เว้นคาบ 5 พักเที่ยง, ≤ 10 คาบ/วัน)','ไม่จัดในเวลาที่ครูไม่สามารถสอนได้','ไม่จัดในเวลาที่กลุ่มเรียนไม่สามารถเรียนได้','ห้องมีความจุเพียงพอต่อจำนวนนักเรียน'];
const SOFT={s11:['11','กระจายชั่วโมงเรียนของกลุ่มให้เหมาะสมในแต่ละวัน','SD คาบ/วัน'],s12:['12','ลดคาบว่างของนักเรียน','คาบว่าง'],s13:['13','ลดคาบว่างระหว่างการสอนของครู','คาบว่าง'],s14:['14','กระจายภาระงานสอนของครูให้สมดุล','คาบ/วันสูงสุด'],
 s15:['15','หลีกเลี่ยงวิชาทฤษฎีต่อเนื่องนานเกิน 2 คาบ','ครั้ง'],s16:['16','วิชาปฏิบัติจัดเป็นคาบต่อเนื่อง','บล็อกที่แตกเกิน'],s17:['17','ลดการเปลี่ยนห้องของกลุ่มในวันเดียวกัน','ครั้ง'],s18:['18','วิชาที่ต้องใช้ห้องเฉพาะได้ห้องตรงประเภท','คาบที่ไม่ตรง'],
 s19:['19','เนื้อหาต่อเนื่อง: วิชาเดียวกันอยู่ติดกัน/ไม่กระจายหลายวัน','จุด'],s20:['20','ลดช่วงว่างหัว–ท้ายวัน (เริ่มเช้า ไม่เลิกดึกหลัง 16:00)','คาบเย็น'],tc:['+','ครูคนเดียวสอนวิชาเดียวกันตลอดเทอม','คนเกิน']};
const getW=()=>Object.assign({},W_DEF,S.W||{});
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const unav=t=>parseUnav(t.unavailable).set;
const adjP=(a,b)=>b==a+1||(b==a+2&&a==LUNCH-1);           // ติดกัน (นับข้ามคาบพักว่าต่อเนื่อง)
const dayOf=s=>Math.floor(s/P);
function chunks(n,max){if(n<=0)return[];const k=Math.ceil(n/max),b=Math.floor(n/k),r=n%k;return Array.from({length:k},(_,i)=>b+(i<r?1:0))}

function mkCtx(d,W){const N=DN.length*P,tMax={},tBlk={},gBlk={},rBlk={},gSize={};
 const courses=d.courses.map((c,i)=>({...c,i,tch:(c.teachers&&c.teachers.length?c.teachers:[c.teacher]).filter(Boolean)}));
 d.teachers.forEach(t=>{tBlk[t.name]=new Uint8Array(N);unav(t).forEach(s=>{if(s<N)tBlk[t.name][s]=1});tMax[t.name]=+t.max_hours>0?+t.max_hours:1e9});
 d.groups.forEach(g=>{gBlk[g.name]=new Uint8Array(N);parseUnav(g.unavailable).set.forEach(s=>{if(s<N)gBlk[g.name][s]=1});gSize[g.name]=+g.size||0});
 d.rooms.forEach(r=>rBlk[r.name]=new Uint8Array(N));
 (S.blocks||[]).filter(b=>!b.free).forEach(b=>{const A=b.kind=='teacher'?tBlk:b.kind=='group'?gBlk:rBlk,a=A[b.target];if(a)b.slots.forEach(s=>{if(s<N)a[s]=1})});
 const types=new Set(d.rooms.map(r=>r.type).filter(Boolean)),rType=Object.fromEntries(d.rooms.map(r=>[r.name,r.type]));
 const roomsFor=courses.map(c=>{const need=c.room_type&&types.has(c.room_type)?c.room_type:'';return d.rooms.filter(r=>!(+r.capacity>0)||+r.capacity>=gSize[c.group]).map(r=>({name:r.name,cap:+r.capacity||1e4,m:need&&r.type!=need?1:0})).sort((a,b)=>a.m-b.m||a.cap-b.cap)});
 return{d,N,W,courses,tMax,tBlk,gBlk,rBlk,gSize,roomsFor,rType,types}}
function mkSessions(cx){const out=[];cx.courses.forEach(c=>{chunks(+c.theory||0,2).forEach(len=>out.push({ci:c.i,kind:'t',len}));chunks(+c.practice||0,4).forEach(len=>out.push({ci:c.i,kind:'p',len}))});return out}

// ----- สถานะตาราง (occupancy) -----
function mkState(cx){const st={cx,G:{},T:{},R:{},tLoad:{},gDay:{},CP:cx.courses.map(()=>new Set()),un:[]},z=()=>new Array(cx.N).fill(null);
 cx.d.groups.forEach(g=>{st.G[g.name]=z();st.gDay[g.name]=new Array(DN.length).fill(0)});cx.d.teachers.forEach(t=>{st.T[t.name]=z();st.tLoad[t.name]=0});cx.d.rooms.forEach(r=>st.R[r.name]=z());return st}
function place(st,pl){const g=st.cx.courses[pl.ci].group;for(let k=0;k<pl.len;k++){const s=pl.start+k;st.G[g][s]=pl;st.T[pl.t][s]=pl;st.R[pl.r][s]=pl}st.tLoad[pl.t]+=pl.len;st.gDay[g][dayOf(pl.start)]+=pl.len;st.CP[pl.ci].add(pl)}
function unplace(st,pl){const g=st.cx.courses[pl.ci].group;for(let k=0;k<pl.len;k++){const s=pl.start+k;if(st.G[g][s]===pl)st.G[g][s]=null;if(st.T[pl.t][s]===pl)st.T[pl.t][s]=null;if(st.R[pl.r][s]===pl)st.R[pl.r][s]=null}st.tLoad[pl.t]-=pl.len;st.gDay[g][dayOf(pl.start)]-=pl.len;st.CP[pl.ci].delete(pl)}
function okGT(st,ci,start,len,t){const cx=st.cx,g=cx.courses[ci].group,p0=start%P;if(p0+len>P)return false;const G=st.G[g],T=st.T[t];if(!G||!T)return false;const gb=cx.gBlk[g],tb=cx.tBlk[t];
 for(let k=0;k<len;k++){const s=start+k;if(p0+k==LUNCH||G[s]||gb[s]||T[s]||tb[s])return false}return st.gDay[g][dayOf(start)]+len<=MAXD&&st.tLoad[t]+len<=cx.tMax[t]}
function roomFree(st,r,start,len){const R=st.R[r],rb=st.cx.rBlk[r];for(let k=0;k<len;k++)if(R[start+k]||rb[start+k])return false;return true}
function pickRoom(st,ci,start,len,t){if(!okGT(st,ci,start,len,t))return null;const cx=st.cx,rs=cx.roomsFor[ci],G=st.G[cx.courses[ci].group],d=dayOf(start);
 const nb=[start-1,start+len].map(s=>s>=0&&s<cx.N&&dayOf(s)==d&&G[s]?G[s].r:null).filter(Boolean);
 for(const n of nb){const x=rs.find(x=>x.name==n);if(x&&!x.m&&roomFree(st,n,start,len))return n}
 for(const x of rs)if(roomFree(st,x.name,start,len))return x.name;return null}

// ----- ฟังก์ชันวัดคุณภาพ (Soft constraints) -----
function gdParts(st,g,d){const a=st.G[g],b=d*P,LT=Math.min(P,8),se=new Map();let first=-1,last=-1,cnt=0,late=0,run=0,thp=0,rc=0,pr=null,s19=0;
 for(let p=0;p<P;p++){if(p==LUNCH){run=0;continue}const pl=a[b+p];if(!pl){run=0;continue}cnt++;if(first<0)first=p;last=p;if(p>=LT)late++;
  if(pl.kind=='t'){if(++run>2)thp++}else run=0;if(pr!==null&&pr!==pl.r)rc++;pr=pl.r;const e=se.get(pl.ci);if(e!==undefined&&!adjP(e,p))s19++;se.set(pl.ci,p)}
 return{cnt,gaps:cnt?last-first+1-cnt-(first<LUNCH&&last>LUNCH?1:0):0,late,thp,rc,s19}}
function gdCost(st,g,d){const W=st.cx.W,x=gdParts(st,g,d);return W.s11*x.cnt*x.cnt/8+W.s12*x.gaps+W.s20*x.late+W.s15*x.thp+W.s17*x.rc+W.s19*x.s19}
function tdParts(st,t,d){const a=st.T[t],b=d*P;let first=-1,last=-1,cnt=0;for(let p=0;p<P;p++)if(a[b+p]){cnt++;if(first<0)first=p;last=p}return{cnt,gaps:cnt?last-first+1-cnt-(first<LUNCH&&last>LUNCH?1:0):0}}
function tdCost(st,t,d){const W=st.cx.W,x=tdParts(st,t,d);return W.s13*x.gaps+W.s14*x.cnt*x.cnt/12}
const twCost=(st,t)=>st.cx.W.s14*st.tLoad[t]**2/60;
function ccParts(st,ci){const cx=st.cx,c=cx.courses[ci],ps=[...st.CP[ci]];if(!ps.length)return{runs:0,extraRuns:0,extraDays:0,tch:0,mm:0};const days=new Set(),ts=new Set(),sl=[];let mm=0;
 const need=c.room_type&&cx.types.has(c.room_type);ps.forEach(pl=>{days.add(dayOf(pl.start));ts.add(pl.t);if(pl.kind=='p')for(let k=0;k<pl.len;k++)sl.push(pl.start+k);if(need&&cx.rType[pl.r]!=c.room_type)mm+=pl.len});
 sl.sort((a,b)=>a-b);let runs=0;sl.forEach((s,i)=>{if(!i||!(dayOf(s)==dayOf(sl[i-1])&&adjP(sl[i-1]%P,s%P)))runs++});
 return{runs,extraRuns:Math.max(0,runs-Math.ceil((+c.practice||0)/4)),extraDays:Math.max(0,days.size-Math.max(1,Math.ceil(c.periods/6))),tch:ts.size-1,mm}}
function ccCost(st,ci){const W=st.cx.W,x=ccParts(st,ci);return W.s16*x.extraRuns+W.s19*x.extraDays+W.tc*x.tch+W.s18*x.mm}
const newK=()=>({gd:new Set(),td:new Set(),tw:new Set(),c:new Set()});
function keysOf(st,pl,K){const g=st.cx.courses[pl.ci].group,d=dayOf(pl.start);K.gd.add(g+'\u0001'+d);K.td.add(pl.t+'\u0001'+d);K.tw.add(pl.t);K.c.add(pl.ci);return K}
function localCost(st,K){let s=0;K.gd.forEach(k=>{const i=k.lastIndexOf('\u0001');s+=gdCost(st,k.slice(0,i),+k.slice(i+1))});K.td.forEach(k=>{const i=k.lastIndexOf('\u0001');s+=tdCost(st,k.slice(0,i),+k.slice(i+1))});K.tw.forEach(t=>s+=twCost(st,t));K.c.forEach(ci=>s+=ccCost(st,ci));return s}
function totalCost(st){let s=0;for(const g in st.G)for(let d=0;d<DN.length;d++)s+=gdCost(st,g,d);for(const t in st.T){for(let d=0;d<DN.length;d++)s+=tdCost(st,t,d);s+=twCost(st,t)}st.cx.courses.forEach(c=>s+=ccCost(st,c.i));return s+1000*st.un.reduce((a,u)=>a+u.len,0)}
function delta(st,pl){const K=keysOf(st,pl,newK()),b=localCost(st,K);place(st,pl);const a=localCost(st,K);unplace(st,pl);return a-b}

// ----- ACT: สร้างตารางเริ่มต้น (Most-Constrained-First + เลือกช่องที่ cost เพิ่มน้อยที่สุด) -----
function bestSpot(st,s,r,noise){const c=st.cx.courses[s.ci];let best=null;for(let start=0;start<st.cx.N;start++){if(start%P+s.len>P)continue;
 for(const t of c.tch){const room=pickRoom(st,s.ci,start,s.len,t);if(!room)continue;const pl={ci:s.ci,kind:s.kind,len:s.len,start,t,r:room},sc=delta(st,pl)+(r?r()*noise:0);if(!best||sc<best.sc)best={sc,pl}}}return best&&best.pl}
function construct(cx,seed,ses){const r=rng(seed),st=mkState(cx),q=ses.map(s=>({...s,k:r(),nt:cx.courses[s.ci].tch.length}));q.sort((a,b)=>(b.len-a.len)||(a.nt-b.nt)||(a.k-b.k));
 for(let i=0;i<q.length;i++){const s=q[i],pl=bestSpot(st,s,r,0.8);if(pl)place(st,pl);else if(s.len>1)chunks(s.len,Math.ceil(s.len/2)).forEach(len=>q.push({...s,len,k:r()}));else st.un.push({ci:s.ci,kind:s.kind,len:1})}return st}
// baseline สำหรับเปรียบเทียบ: First-Fit ทีละคาบตามลำดับไฟล์ ใช้ครู/ห้องแรกที่ว่าง ไม่คิด Soft
function baseline(cx,ses){const st=mkState(cx);ses.forEach(s=>{const c=cx.courses[s.ci];for(let k=0;k<s.len;k++){let done=false;
 for(let start=0;start<cx.N&&!done;start++)for(const t of c.tch){if(done)break;for(const x of cx.roomsFor[s.ci])if(okGT(st,s.ci,start,1,t)&&roomFree(st,x.name,start,1)){place(st,{ci:s.ci,kind:s.kind,len:1,start,t,r:x.name});done=true;break}}
 if(!done)st.un.push({ci:s.ci,kind:s.kind,len:1})}});return st}

// ----- IMPROVE: Simulated Annealing (ย้ายบล็อก / สลับบล็อก โดยไม่ละเมิด Hard) -----
function allPl(st){return st.cx.courses.flatMap(c=>[...st.CP[c.i]])}
function saChunk(st,r,arr,n,T){const cx=st.cx;let acc=0;
 for(let it=0;it<n;it++){if(!arr.length)break;
  if(r()<0.72){const pl=arr[Math.floor(r()*arr.length)],c=cx.courses[pl.ci];unplace(st,pl);let cand=null;
   for(let a=0;a<14&&!cand;a++){const start=Math.floor(r()*cx.N);if(start%P+pl.len>P)continue;const t=c.tch[Math.floor(r()*c.tch.length)],room=pickRoom(st,pl.ci,start,pl.len,t);if(room)cand={start,t,r:room}}
   place(st,pl);if(!cand)continue;const K=keysOf(st,pl,newK());keysOf(st,{...pl,...cand},K);const b=localCost(st,K),old={start:pl.start,t:pl.t,r:pl.r};
   unplace(st,pl);Object.assign(pl,cand);place(st,pl);const dl=localCost(st,K)-b;if(dl<=0||r()<Math.exp(-dl/T))acc++;else{unplace(st,pl);Object.assign(pl,old);place(st,pl)}}
  else{const a=arr[Math.floor(r()*arr.length)],ga=cx.courses[a.ci].group,b=arr[Math.floor(r()*arr.length)];if(a===b||b.len!=a.len||cx.courses[b.ci].group!=ga)continue;
   const sa=a.start,sb=b.start,K=newK();keysOf(st,a,K);keysOf(st,b,K);keysOf(st,{...a,start:sb},K);keysOf(st,{...b,start:sa},K);const before=localCost(st,K);
   unplace(st,a);unplace(st,b);let ok=okGT(st,a.ci,sb,a.len,a.t)&&roomFree(st,a.r,sb,a.len);if(ok){a.start=sb;place(st,a);ok=okGT(st,b.ci,sa,b.len,b.t)&&roomFree(st,b.r,sa,b.len);if(ok){b.start=sa;place(st,b)}else{unplace(st,a);a.start=sa}}
   if(!ok){a.start=sa;b.start=sb;place(st,a);place(st,b);continue}const dl=localCost(st,K)-before;
   if(dl<=0||r()<Math.exp(-dl/T))acc++;else{unplace(st,a);unplace(st,b);a.start=sa;b.start=sb;place(st,a);place(st,b)}}}
 return acc}
function repairUn(st,r,arr){let fixed=0;st.un=st.un.filter(u=>{const pl=bestSpot(st,u,r,0);if(pl){place(st,pl);arr.push(pl);fixed++;return false}return true});return fixed}
const snapOf=(st,arr)=>({list:arr.map(pl=>({pl,start:pl.start,t:pl.t,r:pl.r})),un:st.un.slice()});
function restore(st,arr,sn){arr.forEach(pl=>unplace(st,pl));arr.length=0;sn.list.forEach(x=>{Object.assign(x.pl,{start:x.start,t:x.t,r:x.r});place(st,x.pl);arr.push(x.pl)});st.un=sn.un.slice()}
function stRows(st){const out=[];st.cx.courses.forEach(c=>st.CP[c.i].forEach(pl=>{for(let k=0;k<pl.len;k++)out.push({slot:pl.start+k,code:c.code,name:c.name,group:c.group,teacher:pl.t,room:pl.r,kind:pl.kind})}));return out.sort((a,b)=>a.slot-b.slot||a.group.localeCompare(b.group))}

// ----- CHECK: ตรวจ Hard 10 ข้อ + เงื่อนไขชุดข้อมูล 8 ข้อ -----
const ckey=(code,group)=>code+'\u0001'+group;
function hardCheck(d,rows,cx){cx=cx||mkCtx(d,getW());const H=Array(11).fill(0),det=[],add=(i,m)=>{H[i]++;if(det.length<3000)det.push({h:i,m})};
 const seen={},cnt={},gdl={},cm=new Map(cx.courses.map(c=>[ckey(c.code,c.group),c]));let lunchHit=0,overDay=0,clashT=0,clashR=0;
 rows.forEach(r=>{const at=slotName(r.slot),c=cm.get(ckey(r.code,r.group));
  const kt='t\u0001'+r.teacher+'\u0001'+r.slot,kr='r\u0001'+r.room+'\u0001'+r.slot,kg='g\u0001'+r.group+'\u0001'+r.slot;
  if(seen[kt]){add(1,`${r.teacher} สอนซ้อน 2 กลุ่ม ${at}`);clashT++}if(seen[kr]){add(2,`ห้อง ${r.room} ถูกใช้ซ้อน ${at}`);clashR++}if(seen[kg])add(3,`${r.group} มี 2 วิชาซ้อน ${at}`);seen[kt]=seen[kr]=seen[kg]=1;
  if(cx.rBlk[r.room]&&cx.rBlk[r.room][r.slot])add(2,`ห้อง ${r.room} แจ้งไม่ว่าง แต่มีเรียน ${at}`);
  if(!c){add(4,`${r.group} ไม่ได้ลงทะเบียน ${r.code}`);return}if(!c.tch.includes(r.teacher))add(5,`${r.teacher} ไม่ได้รับมอบหมายวิชา ${r.code}`);
  cnt[ckey(r.code,r.group)]=(cnt[ckey(r.code,r.group)]||0)+1;
  if(r.slot<0||r.slot>=cx.N||r.slot%P==LUNCH){add(7,`${r.code} (${r.group}) อยู่ในคาบพัก/นอกเวลา ${at}`);if(r.slot%P==LUNCH)lunchHit++}
  const dk=r.group+'\u0001'+dayOf(r.slot);gdl[dk]=(gdl[dk]||0)+1;
  if(cx.tBlk[r.teacher]&&cx.tBlk[r.teacher][r.slot])add(8,`${r.teacher} ไม่สะดวก/ไม่ว่าง แต่ถูกจัดสอน ${at}`);if(cx.gBlk[r.group]&&cx.gBlk[r.group][r.slot])add(9,`${r.group} ไม่ว่าง แต่ถูกจัดเรียน ${at}`);
  if(+(d.rooms.find(x=>x.name==r.room)||{}).capacity>0&&+(d.rooms.find(x=>x.name==r.room)).capacity<cx.gSize[r.group])add(10,`ห้อง ${r.room} จุไม่พอสำหรับ ${r.group} (${cx.gSize[r.group]} คน)`)});
 for(const k in gdl)if(gdl[k]>MAXD){const [g,dd]=k.split('\u0001');add(7,`${g} เรียน ${gdl[k]} คาบในวัน${DF[dd]} (เกิน ${MAXD})`);overDay++}
 cx.courses.forEach(c=>{const n=cnt[ckey(c.code,c.group)]||0;if(n!=c.periods)add(6,`${c.code} ${c.name} (${c.group}): จัด ${n}/${c.periods} คาบ`)});
 const tot=d.courses.reduce((a,c)=>a+(+c.periods||0),0);
 const ds=[[`จำนวนคาบแต่ละวิชา = theory+practice`,!H[6]],[`คาบที่ 5 (พักเที่ยง) ไม่มีวิชา`,!lunchHit],[`จำนวนวิชาในตาราง = วิชาที่ลงทะเบียน (${Object.keys(cnt).length}/${d.courses.length})`,Object.keys(cnt).length==d.courses.length],
  [`จำนวนคาบรวม = ${tot} (ได้ ${rows.length})`,rows.length==tot],[`คาบเรียนแต่ละวันไม่เกิน ${MAXD} คาบ`,!overDay],['ครูสอนไม่ชนกัน',!clashT],['ห้องเรียนไม่ทับกัน',!clashR],['ครูสอนเฉพาะวิชาที่กำหนดใน teach.csv',!H[5]]];
 return{H,total:H.reduce((a,b)=>a+b,0),det,ds}}

// ----- ตัวชี้วัดรวม (ใช้ทั้งผลของระบบ, baseline และ output.csv ที่นำเข้า) -----
function metrics(d,rows,W){W=W||getW();const cx=mkCtx(d,W),st=mkState(cx),cm=new Map(cx.courses.map(c=>[ckey(c.code,c.group),c])),th={};
 rows.slice().sort((a,b)=>a.slot-b.slot).forEach(r=>{const c=cm.get(ckey(r.code,r.group));if(!c||!st.G[r.group]||!st.T[r.teacher]||!st.R[r.room]||r.slot<0||r.slot>=cx.N)return;
  const k=ckey(c.code,c.group);th[k]=(th[k]||0)+1;const kind=r.kind||(th[k]<=c.theory?'t':'p');place(st,{ci:c.i,kind,len:1,start:r.slot,t:r.teacher,r:r.room})});
 const h=hardCheck(d,rows,cx),sum={s11:0,s12:0,s13:0,s14:0,s15:0,s16:0,s17:0,s18:0,s19:0,s20:0,tc:0};const gsd=[];
 for(const g in st.G){const ld=[];for(let dd=0;dd<DN.length;dd++){const x=gdParts(st,g,dd);ld.push(x.cnt);sum.s12+=x.gaps;sum.s20+=x.late;sum.s15+=x.thp;sum.s17+=x.rc;sum.s19+=x.s19}const m=ld.reduce((a,b)=>a+b,0)/ld.length;if(m>0)gsd.push(Math.sqrt(ld.reduce((a,b)=>a+(b-m)**2,0)/ld.length))}
 let tmaxDay=0;const tw=[];for(const t in st.T){for(let dd=0;dd<DN.length;dd++){const x=tdParts(st,t,dd);sum.s13+=x.gaps;tmaxDay=Math.max(tmaxDay,x.cnt)}if(st.tLoad[t])tw.push(st.tLoad[t])}
 cx.courses.forEach(c=>{const x=ccParts(st,c.i);sum.s16+=x.extraRuns;sum.s19+=x.extraDays;sum.tc+=x.tch;sum.s18+=x.mm});
 sum.s11=gsd.length?+(gsd.reduce((a,b)=>a+b,0)/gsd.length).toFixed(2):0;sum.s14=tmaxDay;
 const avail=DN.length*(P-1),tot=d.courses.reduce((a,c)=>a+(+c.periods||0),0),usedRooms=new Set(rows.map(r=>r.room)).size;
 const twm=tw.length?tw.reduce((a,b)=>a+b,0)/tw.length:0;
 return{hard:{H:h.H,total:h.total,det:h.det.slice(0,300),ds:h.ds},soft:sum,cost:+totalCost(st).toFixed(1),placed:rows.length,total:tot,
  kpi:{roomUtil:d.rooms.length?rows.length/(d.rooms.length*avail):0,usedRooms,usedRoomUtil:usedRooms?rows.length/(usedRooms*avail):0,freeGroup:d.groups.length?(d.groups.length*avail-rows.length)/d.groups.length:0,teacherAvg:twm,teacherSd:tw.length?Math.sqrt(tw.reduce((a,b)=>a+(b-twm)**2,0)/tw.length):0}}}

// ----- AGENT: Plan → Act → Check → Improve → Check (+ เทียบ baseline) -----
async function agentRun(d,opt,ui){const t0=performance.now(),tick=()=>new Promise(r=>setTimeout(r,0)),W=opt.W,cx=mkCtx(d,W),ses=mkSessions(cx),log=[],L=(s,m)=>{log.push({s,m});ui.log(s,m)};
 const tot=ses.reduce((a,s)=>a+s.len,0),avail=DN.length*(P-1);
 L('plan',`วิเคราะห์ข้อมูล: ${cx.courses.length} วิชา-กลุ่ม แตกเป็น ${ses.length} บล็อกคาบ (ทฤษฎี ≤2 คาบติด, ปฏิบัติ ≤4 คาบติด) รวม ${tot} คาบ · ${d.groups.length} กลุ่ม · ${d.teachers.length} ครู · ${d.rooms.length} ห้อง · ช่องเรียนได้ ${avail} ช่อง/สัปดาห์/กลุ่ม (เว้นคาบ ${LUNCH+1} พักเที่ยง)`);
 const tl={};cx.courses.forEach(c=>{const share=c.periods/(c.tch.length||1);c.tch.forEach(t=>tl[t]=(tl[t]||0)+share)});
 const tight=Object.entries(tl).map(([t,v])=>[t,v/Math.max(1,avail-(cx.tBlk[t]?cx.tBlk[t].reduce((a,b)=>a+b,0):0))]).sort((a,b)=>b[1]-a[1]).slice(0,3);
 if(tight.length)L('plan',`ทรัพยากรที่ตึงที่สุด: ${tight.map(([t,v])=>`${t} ${(v*100).toFixed(0)}%`).join(', ')} → จัดบล็อกยาว/วิชาที่มีครูให้เลือกน้อยก่อน (Most-Constrained-First)`);
 let best=null;
 for(let i=0;i<opt.tries;i++){if(ui.cancelled())break;const seed=opt.seed+i*7919,st=construct(cx,seed,ses);st.seed=seed;st.cost=totalCost(st);
  if(!best||st.un.length<best.un.length||(st.un.length==best.un.length&&st.cost<best.cost))best=st;ui.prog(.04+.40*(i+1)/opt.tries,`ACT · สร้างตารางรอบ ${i+1}/${opt.tries} · ดีที่สุด: จัดไม่ลง ${best.un.length} · cost ${best.cost.toFixed(1)}`);await tick()}
 if(!best){return null}
 L('act',`สร้างตารางเริ่มต้นแบบ Greedy CSP ${opt.tries} รอบ (สุ่มตาม seed) เลือกรอบ seed ${best.seed}: จัดไม่ลง ${best.un.length} คาบ, Soft cost ${best.cost.toFixed(1)}`);
 const h0=hardCheck(d,stRows(best),cx);L('check',`ตรวจ Hard 10 ข้อ: ${h0.total?`พบ ${h0.total} จุด`:'ผ่านครบ'}${best.un.length?` · ยังจัดไม่ลง ${best.un.length} คาบ → ซ่อมระหว่างปรับปรุง`:''}`);
 const r=rng(best.seed^0x5bd1e995),arr=allPl(best),c0=best.cost,N=Math.max(0,opt.iters),CH=400,T0=1,T1=0.02;let sn=snapOf(best,arr),bc=c0,fixed=0;
 for(let i=0;i<N;i+=CH){if(ui.cancelled())break;const T=T0*Math.pow(T1/T0,i/Math.max(1,N));saChunk(best,r,arr,Math.min(CH,N-i),T);if(best.un.length)fixed+=repairUn(best,r,arr);
  const c=totalCost(best);if(c<bc-1e-9){bc=c;sn=snapOf(best,arr)}ui.prog(.45+.45*Math.min(1,(i+CH)/N),`IMPROVE · Simulated Annealing ${Math.min(N,i+CH)}/${N} · T=${T.toFixed(2)} · cost ${bc.toFixed(1)}`);await tick()}
 restore(best,arr,sn);const rows=stRows(best);
 L('improve',`ปรับปรุงด้วย Simulated Annealing ${N} รอบ (ย้าย/สลับบล็อกโดยคง Hard): Soft cost ${c0.toFixed(1)} → ${bc.toFixed(1)}${c0>0?` (ลดลง ${((1-bc/c0)*100).toFixed(1)}%)`:''}${fixed?` · ซ่อมคาบที่จัดไม่ลงได้ ${fixed} คาบ`:''}`);
 ui.prog(.93,'CHECK · ตรวจผลและเทียบกับ baseline');await tick();
 const m=metrics(d,rows,W),base=metrics(d,stRows(baseline(cx,ses)),W);
 L('check',`ผลสุดท้าย: Hard ${m.hard.total?`ผิด ${m.hard.total} จุด`:'ผ่านครบ (0 จุด)'} · จัดได้ ${rows.length}/${tot} คาบ · Soft cost ${m.cost} (baseline First-Fit: จัดได้ ${base.placed}, Hard ${base.hard.total}, cost ${base.cost})`);
 const un={};best.un.forEach(u=>{const c=cx.courses[u.ci],k=ckey(c.code,c.group);un[k]=un[k]||{code:c.code,name:c.name,group:c.group,len:0};un[k].len+=u.len});
 return{rows,un:Object.values(un),seed:opt.seed,bestSeed:best.seed,opt:{tries:opt.tries,iters:opt.iters,W},m,base,cost0:c0,log,ms:Math.round(performance.now()-t0),cancelled:ui.cancelled(),at:Date.now()}}
