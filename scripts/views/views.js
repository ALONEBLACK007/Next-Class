// ---------- Views ----------
const roles={admin:[['dash','ภาพรวม'],['data','ข้อมูลและตรวจสอบ'],['gen','จัดตาราง (AI)'],['view','ตารางสอน'],['exp','ส่งออก/เผยแพร่'],['about','แนวคิดและคู่มือ'],['admin','ผู้ดูแลระบบ']],
 teacher:[['view','ตารางสอนของฉัน'],['dash','ภาพรวม'],['about','คู่มือ']],student:[['view','ตารางเรียนของฉัน'],['about','คู่มือ']]};
function nav(){$('#nav').innerHTML=roles[S.user.role].map(([k,l])=>`<button class="t ${k=='admin'?'adm ':''}${S.tab==k?'on':''}" data-t="${k}" ${S.tab==k?'aria-current="page"':''}>${k=='admin'?ic('shield'):''}${l}</button>`).join('');$('#nav').onclick=e=>{const t=e.target.closest('[data-t]');if(t){S.tab=t.dataset.t;render()}}}
// คาบพักเที่ยง 12.00–13.00 ล็อกเด็ดขาด: ตัดคาบเรียนที่ตกในคาบพักออกจากตารางเสมอ
function lockLunch(quiet){if(!S.tt||!S.data)return 0;setSlots(S.data);const n=S.tt.rows.length;S.tt.rows=S.tt.rows.filter(r=>r.slot%P!=LUNCH);const k=n-S.tt.rows.length;
 if(k){S.tt.m=null;sv();if(!quiet)toast(`นำ ${k} คาบออกจากคาบพักเที่ยง 12.00–13.00 แล้ว (ห้ามมีคาบเรียน) — กดจัดตารางใหม่ หรือเพิ่มคาบในช่องอื่น`)}return k}
function render(){if(!S.stage||S.tab!='data')setSlots(S.data);lockLunch();nav();({dash,data:dataV,gen,view:viewV,exp,about,admin:adminV})[S.tab]();window.scrollTo({top:0})}
const pct=x=>(x*100).toFixed(1)+'%';
function unList(d,rows){const n={};rows.forEach(r=>{const k=ckey(r.code,r.group);n[k]=(n[k]||0)+1});return d.courses.filter(c=>(n[ckey(c.code,c.group)]||0)<c.periods).map(c=>({code:c.code,name:c.name,group:c.group,len:c.periods-(n[ckey(c.code,c.group)]||0)}))}
const freshM=()=>{const tt=S.tt;tt.m=metrics(S.data,tt.rows,tt.opt?tt.opt.W:getW());return tt.m};

// ----- รายงานเงื่อนไข 20 ข้อ + 8 ข้อชุดข้อมูล + เทียบ baseline -----
function reportHtml(tt){const m=tt.m,b=tt.base;if(!m)return'';const H=m.hard.H;
 const hard=HARD.slice(1).map((t,i)=>`<tr><td>${i+1}</td><td class="l">${t}</td><td class="${H[i+1]?'er':'ok'}">${H[i+1]?ic('x')+' '+H[i+1]+' จุด':ic('check')+' ผ่าน'}</td></tr>`).join('');
 const soft=Object.keys(SOFT).map(k=>{const v=m.soft[k],good=k=='s11'?v<=1:k=='s14'?v<=6:v==0;return`<tr><td>${SOFT[k][0]}</td><td class="l">${SOFT[k][1]}</td><td class="${good?'ok':'wa'}">${ic(good?'check':'alert')} ${v} <span class="mu">${SOFT[k][2]}</span></td>${b?`<td class="mu">${b.soft[k]}</td>`:''}</tr>`}).join('');
 return`<div class="card"><h2>ตรวจเงื่อนไขหลัก 20 ข้อ (Core Requirements)</h2>
 <div class="ow"><table><tr><th>ข้อ</th><th class="l">กลุ่ม A: Hard Constraints — ต้องผ่าน</th><th>ผล</th></tr>${hard}</table></div>
 <div class="ow" style="margin-top:10px"><table><tr><th>ข้อ</th><th class="l">กลุ่ม B: Soft Constraints — ทำให้ได้มากที่สุด</th><th>Next Class</th>${b?'<th>Baseline</th>':''}</tr>${soft}</table></div>
 <p class="mu legend-t">${ic('check','ok')} ไม่มีจุดเสียหรืออยู่ในเกณฑ์ <span class="dot-sep"></span> ${ic('alert','wa')} ยังปรับได้ แต่ไม่ผิดกฎ <span class="dot-sep"></span> ค่ายิ่งน้อยยิ่งดี</p>
 ${m.hard.det.length?`<details><summary class="er">ดูรายละเอียด ${m.hard.total} จุดที่ผิด Hard</summary>${m.hard.det.slice(0,120).map(x=>`<div class="er">H${x.h}: ${esc(x.m)}</div>`).join('')}</details>`:''}</div>
 <div class="card"><h2>เงื่อนไขชุดข้อมูลทดสอบ 8 ข้อ</h2>${m.hard.ds.map((x,i)=>`<div class="ck-line ${x[1]?'ok':'er'}">${ic(x[1]?'check':'x')}<span>${i+1}. ${esc(x[0])}</span></div>`).join('')}</div>`}
function compareHtml(tt){const m=tt.m,b=tt.base;if(!b||!m)return'';
 const R=[['คาบที่จัดได้',m.placed,b.placed,1,'/'+m.total],['Hard ที่ผิด (จุด)',m.hard.total,b.hard.total,-1],['SD คาบ/วันของกลุ่ม (ข้อ 11)',m.soft.s11,b.soft.s11,-1],['คาบว่างนักเรียน (ข้อ 12)',m.soft.s12,b.soft.s12,-1],['คาบว่างของครู (ข้อ 13)',m.soft.s13,b.soft.s13,-1],['ครูสอนสูงสุด คาบ/วัน (ข้อ 14)',m.soft.s14,b.soft.s14,-1],['ทฤษฎีต่อเนื่องเกิน 2 คาบ (ข้อ 15)',m.soft.s15,b.soft.s15,-1],['วิชาปฏิบัติแตกบล็อก (ข้อ 16)',m.soft.s16,b.soft.s16,-1],['เปลี่ยนห้องในวันเดียวกัน (ข้อ 17)',m.soft.s17,b.soft.s17,-1],['ห้องไม่ตรงประเภท (ข้อ 18)',m.soft.s18,b.soft.s18,-1],['เนื้อหาไม่ต่อเนื่อง (ข้อ 19)',m.soft.s19,b.soft.s19,-1],['คาบเย็นหลัง 16:00 (ข้อ 20)',m.soft.s20,b.soft.s20,-1],['Soft cost รวม',m.cost,b.cost,-1]];
 return`<div class="card"><h2>หลักฐาน: เทียบกับวิธีพื้นฐาน (Baseline)</h2><p class="mu">Baseline = First-Fit วางทีละคาบตามลำดับไฟล์ลงช่องแรกที่ว่าง (ไม่ใช้ AI) บนข้อมูลและกฎ Hard ชุดเดียวกัน</p>
 <div class="ow"><table><tr><th class="l">ตัวชี้วัด</th><th>Baseline</th><th>Next Class</th><th>ผล</th></tr>${R.map(([l,a,bb,dir,suf])=>{const better=dir<0?a<bb:a>bb,worse=dir<0?a>bb:a<bb,p=dir<0&&bb>0?Math.round((1-a/bb)*100):null;
  return`<tr><td class="l">${l}</td><td>${bb}${suf||''}</td><td><b>${a}${suf||''}</b></td><td class="${better?'ok':worse?'er':'mu'}">${better?(p!=null?`ดีขึ้น ${p}%`:'ดีกว่า'):worse?'แย่กว่า':'เท่ากัน'}</td></tr>`}).join('')}</table></div></div>`}
function bars(o,mx,suf){return Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="bar"><em title="${esc(k)}">${esc(k)}</em><i style="width:${Math.max(2,v/mx*100)}%"></i><span>${v}${suf}</span></div>`).join('')}

// ----- ภาพรวม -----
function dash(){const d=S.data,tt=S.tt,m=$('#mn');if(!d||!tt){m.innerHTML='<div class="card empty"><h2>ยังไม่มีตารางสอน</h2><p class="mu">เริ่มที่เมนู “ข้อมูลและตรวจสอบ” → นำเข้าไฟล์หรือเลือกชุดข้อมูลตัวอย่าง → ไปที่ “จัดตาราง (AI)”</p></div>';return}
 const M=freshM(),K=M.kpi,un=unList(d,tt.rows),tl={},rl={},avail=DN.length*(P-1);tt.rows.forEach(r=>{tl[r.teacher]=(tl[r.teacher]||0)+1;rl[r.room]=(rl[r.room]||0)+1});
 const dl=DN.map((_,i)=>tt.rows.filter(r=>dayOf(r.slot)==i).length),mxd=Math.max(...dl,1),many=Object.keys(tl).length>15;
 m.innerHTML=`<div class="card"><h2>ภาพรวมระบบ</h2><div class="grid">
 <div class="k"><b>${M.placed}/${M.total}</b><span>คาบที่จัดได้</span></div><div class="k"><b class="${M.hard.total?'er':'ok'}">${M.hard.total}</b><span>ความขัดแย้ง Hard</span></div>
 <div class="k"><b class="${un.length?'wa':''}">${M.total-M.placed}</b><span>คาบที่ยังจัดไม่ได้</span></div><div class="k"><b>${M.cost}</b><span>Soft cost (น้อย = ดี)</span></div>
 <div class="k"><b>${pct(K.roomUtil)}</b><span>อัตราใช้ห้องรวม (${d.rooms.length} ห้อง)</span></div><div class="k"><b>${pct(K.usedRoomUtil)}</b><span>อัตราใช้ห้องที่ถูกใช้ (${K.usedRooms} ห้อง)</span></div>
 <div class="k"><b>${K.freeGroup.toFixed(1)}</b><span>คาบว่างของกลุ่ม/สัปดาห์ (เฉลี่ย)</span></div><div class="k"><b>${K.teacherAvg.toFixed(1)} ± ${K.teacherSd.toFixed(1)}</b><span>ภาระครู คาบ/สัปดาห์</span></div>
 <div class="k"><b>${M.soft.s12}</b><span>คาบว่างระหว่างวันของนักเรียน</span></div><div class="k"><b>${M.soft.s13}</b><span>คาบว่างระหว่างสอนของครู</span></div>
 <div class="k"><b>${d.courses.length}</b><span>วิชา-กลุ่ม · ${d.teachers.length} ครู · ${d.groups.length} กลุ่ม</span></div><div class="k"><b>${esc(tt.seed)}</b><span>Seed ${tt.ms?'· '+tt.ms+' ms':''}</span></div></div></div>
 ${un.length?`<div class="card"><h2 class="wa">รายวิชาที่ยังจัดไม่ครบ</h2>${un.map(c=>`<div>${esc(c.code+' '+c.name+' ('+c.group+')')} — ขาด ${c.len} คาบ</div>`).join('')}<p class="fix">${ic('bulb')} ลองเพิ่ม “รอบสร้างตาราง” เปลี่ยน seed, ลดเวลาไม่ว่าง/แจ้งปิดห้อง หรือเพิ่มครูร่วมสอนใน teach.csv แล้วจัดใหม่ — หรือเพิ่มคาบเองในหน้าตารางสอน</p></div>`:''}
 <div class="cols"><div class="card"><h2>ภาระสอนของครู (คาบ/สัปดาห์)</h2><div class="${many?'scr':''}">${bars(tl,Math.max(...Object.values(tl),1),' คาบ')}</div></div>
 <div class="card"><h2>การใช้ห้อง (คาบ/สัปดาห์ จาก ${avail})</h2><div class="${d.rooms.length>15?'scr':''}">${bars(rl,avail,' คาบ')}</div></div></div>
 <div class="card"><h2>จำนวนคาบแต่ละวัน (ทุกกลุ่ม)</h2>${DN.map((x,i)=>`<div class="bar"><em>${DF[i]}</em><i style="width:${Math.max(2,dl[i]/mxd*100)}%"></i><span>${dl[i]}</span></div>`).join('')}</div>
 ${compareHtml(tt)}${reportHtml(tt)}`}

// ----- ข้อมูลและตรวจสอบ (นำเข้า → พรีวิว → ยืนยัน) -----
const issueHtml=I=>{const c={er:0,wa:0,in:0,ok:0};I.forEach(i=>c[i.l]++);const one=i=>`<div class="is ${i.l}">${ic({er:'x',wa:'alert',ok:'check',in:'info'}[i.l])}<span>${esc(i.m)}${i.fix&&i.fix!='—'?`<span class="fix">${ic('bulb')} ${esc(i.fix)}</span>`:''}</span></div>`;
 const info=I.filter(i=>i.l=='in');return`<div class="row"><b class="${c.er?'er':'ok'}">ข้อผิดพลาด ${c.er}</b><b class="wa">คำเตือน ${c.wa}</b><span class="mu">หมายเหตุ ${c.in}</span></div>`+I.filter(i=>i.l=='er').map(one).join('')+I.filter(i=>i.l=='wa').map(one).join('')+I.filter(i=>i.l=='ok').map(one).join('')+(info.length?`<details><summary class="mu">หมายเหตุ ${info.length} รายการ</summary>${info.map(one).join('')}</details>`:'')};
function previewHtml(d,n=6){return Object.keys(PV).filter(k=>(d[k]||[]).length).map(k=>`<h3>${PVN[k]} (${d[k].length})</h3><div class="ow"><table><tr>${PV[k].map(h=>`<th>${h}</th>`).join('')}</tr>${d[k].slice(0,n).map(r=>`<tr>${PV[k].map(h=>`<td>${esc(h=='teacher'?(r.teachers||[r.teacher]).join(' / ')||'—':r[h])}</td>`).join('')}</tr>`).join('')}</table></div>`).join('')}
function summaryHtml(d){const tot=d.courses.reduce((a,c)=>a+(+c.periods||0),0);return`<div class="grid"><div class="k"><b>${d.courses.length}</b><span>วิชา-กลุ่มที่ลงทะเบียน</span></div><div class="k"><b>${tot}</b><span>คาบที่ต้องจัด</span></div><div class="k"><b>${d.teachers.length}</b><span>ครู</span></div><div class="k"><b>${d.rooms.length}</b><span>ห้อง</span></div><div class="k"><b>${d.groups.length}</b><span>กลุ่มเรียน</span></div><div class="k"><b>${(d.students||[]).length}</b><span>นักเรียน</span></div><div class="k"><b>${d.slots?d.slots.P:8}</b><span>คาบ/วัน × 5 วัน</span></div><div class="k"><b>คาบ ${(d.slots?d.slots.lunch:4)+1}</b><span>พักเที่ยง 12.00–13.00</span></div></div>`}
const TPL_NEW=k=>{const rows=sampleSmall()[k].slice(0,3);return toCSV(NEWH[k],rows.map(r=>NEWH[k].map(h=>r[h])))};
const TPL_OLD={courses:['C1','คณิตศาสตร์','ปวช.1/1','ครูสมชาย',3,'ห้องเรียน'],teachers:['ครูสมชาย',24,'จ1;พ3-4'],rooms:['ห้อง 101',40,'ห้องเรียน'],groups:['ปวช.1/1',25],students:['66001','สมศรี ใจดี','ปวช.1/1']};
const msgLine=x=>{const p={'⚠':['alert','wa'],'✖':['x','er'],'ℹ':['info','mu']}[x[0]];return`<div class="ml">${p?ic(p[0],p[1]):ic('file','mu')}<span>${esc(p?x.slice(1).trim():x)}</span></div>`};
function dataV(){const d=S.data,st=S.stage,m=$('#mn');
 m.innerHTML=`<div class="card"><h2><span class="step">1</span>นำเข้าข้อมูล</h2><p class="mu">รองรับ <b>CSV · Excel (.xlsx หลายชีต) · JSON</b> เลือกหลายไฟล์พร้อมกันได้ ระบบแยกชนิดไฟล์จากหัวคอลัมน์ ทำ Data Cleansing (ตัดช่องว่าง/แถวว่าง/แถวซ้ำ) แล้วแสดง<b>พรีวิวให้ตรวจก่อนบันทึก</b></p>
 <label class="drop" id="dz" for="fi">${ic('upload')}<b>เลือกไฟล์ หรือลากไฟล์มาวางที่นี่</b><span class="mu">register, subject, teach, teacher, room, student_group, timeslot · เลือกพร้อมกันได้หลายไฟล์</span></label><input type="file" id="fi" class="vh" accept=".csv,.xlsx,.xls,.json" multiple>
 <div class="row"><span class="mu">ชุดข้อมูลตัวอย่าง:</span><button class="g" data-sm="small">เล็ก · ชุดการแข่งขัน (1 กลุ่ม 42 คาบ)</button><button class="g" data-sm="medium">กลาง · 6 กลุ่ม มีเวลาไม่สะดวก</button><button class="g" data-sm="large">ใหญ่ · 24 กลุ่ม 880 คาบ</button></div>
 <details><summary>${ic('download')} ดาวน์โหลดแม่แบบไฟล์</summary><div class="row" style="margin-top:8px"><span class="mu">ชุดการแข่งขัน:</span>${Object.keys(NEWH).filter(k=>k!='output').map(k=>`<button class="g sm" data-tn="${k}">${k}.csv</button>`).join('')}</div>
 <div class="row"><span class="mu">ชุดทั่วไป:</span>${Object.keys(HEAD).map(k=>`<button class="g sm" data-tp="${k}">${k}.csv</button>`).join('')}</div>
 <p class="mu" style="font-size:12px">คอลัมน์เสริม (ไม่บังคับ): teacher → <code>max_hours</code>, <code>unavailable</code> (เช่น <code>จ1;พ3-4;ศ</code>) · room → <code>capacity</code>, <code>type</code> · subject → <code>room_type</code> · student_group → <code>unavailable</code> · นำเข้า <code>output.csv</code> พร้อมชุดข้อมูลเพื่อตรวจตารางที่จัดไว้แล้วได้</p></details></div>
 ${st?`<div class="card hl"><h2><span class="step">2</span>ตรวจพรีวิวก่อนบันทึก</h2>${st.msg&&st.msg.length?`<div class="msg">${st.msg.map(msgLine).join('')}</div>`:''}${summaryHtml(st.data)}
  ${st.tt?`<p class="ok">มีตารางจาก ${esc(st.tt.seed)} ${st.tt.rows.length} คาบ — ตรวจเงื่อนไขได้ที่ “ภาพรวม” หลังบันทึก</p>`:''}<h3>ผลตรวจสอบ / Data Cleansing</h3>${issueHtml(st.issues)}
  <div class="row" style="margin-top:12px"><button id="ok">${ic('check')} ยืนยันและบันทึกข้อมูล${st.issues.some(i=>i.l=='er')?' (ยังมีข้อผิดพลาด)':''}</button><button class="g" id="cn">ยกเลิก</button></div>
  <h3>ตัวอย่างข้อมูล</h3>${previewHtml(st.data)}</div>`
 :d?`<div class="card"><h2><span class="step">2</span>ข้อมูลปัจจุบันและผลตรวจสอบ</h2>${summaryHtml(d)}<div class="row" style="margin-top:10px"><button class="g" id="vb">${ic('refresh')} ตรวจสอบอีกครั้ง</button><button class="g dg" id="clr">${ic('trash')} ล้างข้อมูลทั้งหมด</button></div><div id="vr"></div></div><div class="card"><h2><span class="step">3</span>ตัวอย่างข้อมูล</h2>${previewHtml(d)}</div>`:'<div class="card empty"><p class="mu">ยังไม่มีข้อมูล — เลือกไฟล์ หรือกดชุดข้อมูลตัวอย่างด้านบน</p></div>'}`;
 m.querySelectorAll('[data-sm]').forEach(b=>b.onclick=()=>{const k=b.dataset.sm;if(k=='medium')openStage({data:sampleMedium(),raw:{},msg:['ชุดข้อมูลกลาง (รูปแบบไฟล์ทั่วไป) 6 กลุ่ม 10 ครู 6 ห้อง']});else{const raw=k=='small'?sampleSmall():sampleLarge();openStage({data:buildNew(raw,null),raw,msg:[k=='small'?'ชุดข้อมูลเล็ก = ชุดข้อมูลตัวอย่างการแข่งขัน 7 ไฟล์':'ชุดข้อมูลใหญ่ 24 กลุ่ม 40 ครู 30 ห้อง (สร้างอัตโนมัติ สำหรับทดสอบเสถียรภาพ)']})}});
 m.querySelectorAll('[data-tn]').forEach(b=>b.onclick=()=>save(b.dataset.tn+'.csv',TPL_NEW(b.dataset.tn)));
 m.querySelectorAll('[data-tp]').forEach(b=>b.onclick=()=>save(b.dataset.tp+'.csv',toCSV(HEAD[b.dataset.tp],[TPL_OLD[b.dataset.tp]])));
 $('#fi').onchange=e=>{const fs=[...e.target.files];if(fs.length)stageFiles(fs)};
 const dz=$('#dz');dz.ondragover=e=>{e.preventDefault();dz.classList.add('over')};dz.ondragleave=()=>dz.classList.remove('over');dz.ondrop=e=>{e.preventDefault();dz.classList.remove('over');const fs=[...e.dataTransfer.files];if(fs.length)stageFiles(fs)};
 if(st){$('#ok').onclick=commitStage;$('#cn').onclick=()=>{S.stage=null;setSlots(S.data);dataV()}}
 else if(d){const show=()=>{S.issues=validate(d);$('#vr').innerHTML=issueHtml(S.issues)};$('#vb').onclick=show;show();$('#clr').onclick=()=>{if(confirm('ล้างข้อมูล ตาราง และการแจ้งไม่ว่างทั้งหมดในเบราว์เซอร์นี้?')){S.data=null;S.tt=null;S.raw={};S.blocks=[];setSlots(null);sv();dataV()}}}}
function openStage(st){S.stage=st;setSlots(st.data);st.issues=validate(st.data);
 if(st.tt){const L=P,LU=LUNCH,k=st.tt.rows.filter(r=>r.slot%L==LU).length;if(k){st.tt.rows=st.tt.rows.filter(r=>r.slot%L!=LU);(st.msg=st.msg||[]).push(`⚠ ตัดออก ${k} คาบที่อยู่ในคาบพักเที่ยง 12.00–13.00 (ห้ามมีคาบเรียน)`)}}
 setSlots(S.data);dataV();const h=document.querySelector('.card.hl');if(h)h.scrollIntoView({behavior:'smooth'})}
async function stageFiles(files){const msg=[],prev=S.stage||{data:S.data,raw:S.raw},raw={...(prev.raw||{})},nd={};let proj=null,out=null,nNew=0,ttIn=null;
 for(const f of files){try{const x=await readAny(f);if(x.project){proj=x.project;msg.push(`${f.name} → ไฟล์โปรเจกต์ (ข้อมูล + ตาราง + การแจ้งไม่ว่าง)`);continue}
  if(!x.tables.length)msg.push(`⚠ ${f.name} → ไม่มีข้อมูล`);
  for(const t of x.tables){const k=t.rows.length?detect(t.rows):null;if(!k){msg.push(`⚠ ${t.name} → ไม่รู้จักหัวคอลัมน์ (${Object.keys(t.rows[0]||{}).join(', ')||'ว่าง'}) — ดูแม่แบบไฟล์`);continue}
   if(k=='timetable'){ttIn=t.rows;msg.push(`${t.name} → ตารางสอนที่ส่งออกจากระบบ (${t.rows.length} คาบ)`);continue}
   if(k=='output'){out=t.rows;msg.push(`${t.name} → output.csv (${t.rows.length} แถว)`);continue}if(NEWH[k]){raw[k]=t.rows;nNew++}else nd[k]=t.rows;msg.push(`${t.name} → ${k} (${t.rows.length} แถว)`)}}
  catch(e){msg.push(`✖ ${f.name}: อ่านไฟล์ไม่ได้ — ${e.message||e}`)}}
 if(proj){openStage({data:normalize(proj.data),raw:proj.raw||{},blocks:proj.blocks||[],tt:proj.tt||null,msg});return}
 let data=prev.data;
 if(nNew){data=buildNew(raw,{students:nd.students||(prev.data&&prev.data.students)||[]});const miss=['register','subject','teach','teacher','room','student_group','timeslot'].filter(k=>!raw[k]);if(miss.length)msg.push('ℹ ยังไม่มีไฟล์: '+miss.join(', ')+' (เลือกเพิ่มได้ ระบบจะรวมให้)');const keep=Object.keys(prev.raw||{}).filter(k=>raw[k]===prev.raw[k]);if(keep.length)msg.push('ℹ ใช้ไฟล์เดิมต่อ: '+keep.join(', '))}
 else if(Object.keys(nd).length){if(nd.students&&Object.keys(nd).length==1&&prev.data){data={...prev.data,students:nd.students}}else{const base=prev.data&&prev.data.src!='new'?prev.data:{};data=normalize({courses:[],teachers:[],rooms:[],groups:[],students:[],...base,...nd,warn:[]})}}
 let tt=null;
 if(ttIn){const x=ttToRows(ttIn,data?(data.slots?data.slots.P:8):0);x.bad.slice(0,5).forEach(b=>msg.push('⚠ timetable '+b));
  if(!data){data=dataFromRows(x.rows,x.P,x.times);msg.push('ℹ ยังไม่มีชุดข้อมูลหลัก — สร้างรายวิชา/ครู/ห้อง/กลุ่มจากตารางที่นำเข้าให้อัตโนมัติ')}tt={rows:x.rows,un:[],seed:'timetable.csv',imported:true,at:Date.now()}}
 if(!data){S.stage=null;toast(out?'output.csv ต้องนำเข้าพร้อม 7 ไฟล์ของโจทย์ (ใช้แปลงรหัสเป็นชื่อและคาบ)':'ยังไม่มีชุดข้อมูลหลัก — เลือก 7 ไฟล์ของโจทย์ หรือกดชุดข้อมูลตัวอย่าง');dataV();return}
 if(out){setSlots(data);const o=outputToRows(data,out);o.bad.slice(0,5).forEach(b=>msg.push('⚠ output.csv '+b));tt={rows:o.rows,un:[],seed:'output.csv',imported:true,at:Date.now()}}
 openStage({data,raw:nNew||!Object.keys(nd).length?raw:{},msg,tt})}
function commitStage(){const st=S.stage;S.data=st.data;S.raw=st.raw||{};if(st.blocks)S.blocks=st.blocks;S.tt=st.tt||null;S.stage=null;S.sel='';S.q='';setSlots(S.data);lockLunch(true);if(S.tt)freshM();sv();toast('บันทึกข้อมูลแล้ว'+(S.tt?'':' — ไปที่ “จัดตาราง (AI)” เพื่อสร้างตาราง'));dataV()}

// ----- จัดตาราง (AI Agent) -----
const LOGI={plan:['compass','Plan'],act:['cog','Act'],check:['shield','Check'],improve:['trend','Improve']};
const logLi=x=>{const l=LOGI[x.s]||['info',x.s];return`<li class="lg-${x.s}"><span class="ph">${ic(l[0])}${l[1]}</span><span>${esc(x.m)}</span></li>`};
function factorHtml(){return`<div class="card"><h2>ปัจจัยและลำดับความสำคัญ</h2><div class="ow"><table><tr><th>ลำดับ</th><th class="l">ปัจจัย</th><th class="l">เหตุผล / วิธีใช้ในอัลกอริทึม</th></tr>
 <tr><td>1</td><td class="l"><b>ครู</b></td><td class="l">ทรัพยากรที่หายากที่สุด (1 คนสอนหลายกลุ่ม มีเวลาไม่สะดวก) → จัดวิชาที่มีครูให้เลือกน้อย/ครูภาระสูงก่อน (Most-Constrained-First)</td></tr>
 <tr><td>2</td><td class="l"><b>กลุ่มเรียน</b></td><td class="l">ห้ามเรียนซ้อน ≤ 10 คาบ/วัน และต้องได้ครบทุกวิชาที่ลงทะเบียน → ตรวจทุกครั้งที่วางคาบ</td></tr>
 <tr><td>3</td><td class="l"><b>ห้อง</b></td><td class="l">ความจุต้องพอ (Hard) · ประเภทห้องตรงวิชา (Soft) → เลือกห้องเล็กสุดที่พอดี และห้องเดิมของกลุ่มในวันนั้นก่อน</td></tr>
 <tr><td>4</td><td class="l"><b>เวลา</b></td><td class="l">คาบ ${LUNCH+1} พักเที่ยง 12.00–13.00 ห้ามจัด · บล็อกปฏิบัติต้องไม่คร่อมคาบพัก · เลี่ยงคาบเย็น</td></tr>
 <tr><td>5</td><td class="l"><b>เงื่อนไขพิเศษ</b></td><td class="l">ครู/กลุ่ม/ห้องแจ้งไม่ว่าง (เช่น ห้องปิดปรับปรุง) → ถือเป็น Hard ทันทีในการจัดรอบถัดไป</td></tr></table></div></div>`}
function resultHtml(){const tt=S.tt;if(!tt)return'';const M=freshM();
 return`<div class="res"><p class="${M.hard.total||M.placed<M.total?'wa':'ok'}"><b>${tt.imported?'ตารางที่นำเข้า ('+esc(tt.seed)+')':'ผลการจัด'}:</b> จัดได้ ${M.placed}/${M.total} คาบ · Hard ผิด ${M.hard.total} จุด · Soft cost ${M.cost}${tt.ms?` · ใช้เวลา ${tt.ms} ms`:''}${tt.cancelled?' · (ยกเลิกกลางคัน)':''}</p>
 <div class="row"><button id="gv">${ic('calendar')} ดูตารางสอน</button><button class="g" id="gd">${ic('chart')} ดูภาพรวม</button></div></div>${compareHtml(tt)}${reportHtml(tt)}`}
function gen(){const d=S.data,W=getW(),m=$('#mn'),big=d&&d.courses.length>100,o=S.tt&&S.tt.opt;
 m.innerHTML=`<div class="card"><h2>จัดตารางสอนอัตโนมัติด้วย AI Agent</h2>
 <p class="mu">วงจร <b>Plan → Act → Check → Improve</b>: วิเคราะห์ข้อมูล → สร้างตารางด้วย Constraint Satisfaction + Heuristic Search หลาย seed → ตรวจ Hard 10 ข้อ → ปรับปรุง Soft 10 ข้อด้วย Simulated Annealing → ตรวจซ้ำและเทียบกับ baseline · ใช้ seed/ค่าเดิมได้ผลเดิมทุกครั้ง</p>
 <div class="row"><label>Seed <input id="sd" type="number" value="${S.tt&&isFinite(+S.tt.seed)?+S.tt.seed:42}" style="width:96px"></label><label>รอบสร้างตาราง <input id="tr" type="number" min="1" max="500" value="${o?o.tries:(big?10:20)}" style="width:80px"></label><label>รอบปรับปรุง (SA) <input id="it" type="number" min="0" step="500" value="${o?o.iters:(big?8000:4000)}" style="width:100px"></label></div>
 <details><summary>${ic('sliders')} น้ำหนักเงื่อนไข Soft (ปรับได้ — ยิ่งมากยิ่งให้ความสำคัญ)</summary><div class="wg">${Object.keys(SOFT).map(k=>`<label><span>${SOFT[k][0]}. ${SOFT[k][1]}</span><input type="number" min="0" step="0.5" data-w="${k}" value="${W[k]}"></label>`).join('')}</div><button class="g sm" id="wr">คืนค่าเริ่มต้น</button></details>
 <div class="row" style="margin-top:12px"><button id="go">${ic('play')} เริ่มจัดตาราง</button><button class="g" id="cc" disabled>${ic('stop')} ยกเลิก</button></div>
 <div id="pg" class="pgw hide" aria-live="polite"><div class="pb"><i id="pbi"></i></div><div id="pgt" class="mu"></div></div><ol id="lg" class="lg"></ol><div id="gr"></div></div>${factorHtml()}`;
 if(S.run){$('#pg').classList.remove('hide');$('#pbi').style.width=S.run.p*100+'%';$('#pgt').textContent=S.run.msg;$('#lg').innerHTML=S.run.log.map(logLi).join('');$('#go').disabled=true;$('#cc').disabled=false}
 else if(S.tt){$('#lg').innerHTML=(S.tt.log||[]).map(logLi).join('');$('#gr').innerHTML=resultHtml();$('#gv').onclick=()=>{S.tab='view';render()};$('#gd').onclick=()=>{S.tab='dash';render()}}
 $('#wr').onclick=()=>{S.W=null;sv();gen()};
 $('#cc').onclick=()=>{if(S.run){S.run.cancel=true;$('#pgt').textContent='กำลังยกเลิก… (เก็บผลดีที่สุดที่ได้)'}};
 $('#go').onclick=async()=>{if(!d){$('#gr').innerHTML='<p class="er">ยังไม่มีข้อมูล — ไปที่ “ข้อมูลและตรวจสอบ”</p>';return}const I=validate(d),e=I.filter(i=>i.l=='er');
  if(e.length){$('#gr').innerHTML=`<div class="card er-box"><p class="er"><b>ข้อมูลยังมีข้อผิดพลาด ${e.length} จุด — แก้ก่อนจัดตาราง</b></p>${issueHtml(e)}</div>`;return}
  const W2={};m.querySelectorAll('[data-w]').forEach(i=>W2[i.dataset.w]=Math.max(0,+i.value||0));S.W=W2;
  const opt={seed:Math.round(+$('#sd').value)||1,tries:Math.max(1,Math.min(500,+$('#tr').value||1)),iters:Math.max(0,Math.min(200000,+$('#it').value||0)),W:getW()};
  S.run={p:0,msg:'เริ่ม…',log:[],cancel:false};gen();
  const ui={log:(s,msg)=>{S.run.log.push({s,m:msg});if(S.tab=='gen'&&$('#lg'))$('#lg').insertAdjacentHTML('beforeend',logLi({s,m:msg}))},prog:(p,msg)=>{S.run.p=p;S.run.msg=msg;if(S.tab=='gen'&&$('#pbi')){$('#pbi').style.width=p*100+'%';$('#pgt').textContent=msg}},cancelled:()=>S.run.cancel};
  let res=null;try{res=await agentRun(d,opt,ui);if(res){S.tt=res;sv()}toast(!res?'ยกเลิกก่อนได้ผลลัพธ์':res.cancelled?'ยกเลิกแล้ว — ใช้ผลดีที่สุดที่ได้ก่อนยกเลิก':'จัดตารางเสร็จแล้ว')}
  catch(err){console.error(err);alert('จัดตารางไม่สำเร็จ: '+(err.message||err)+'\nลองตรวจข้อมูลอีกครั้ง หรือลดจำนวนรอบ')}
  S.run=null;if(S.tab=='gen')gen()}}

// ----- ตารางสอน -----
const KINDS={group:'กลุ่มเรียน/นักเรียน',teacher:'ครู',room:'ห้อง',subject:'รายวิชา',day:'รายวัน (ทุกกลุ่ม)'};
const kindsFor=u=>u.role=='admin'?['group','teacher','room','subject','day']:u.role=='teacher'?['teacher','group','room','day']:['group'];
function optsFor(kind){const d=S.data,u=S.user;let o=kind=='group'?d.groups.map(g=>({v:g.name,l:g.name})):kind=='teacher'?d.teachers.map(t=>({v:t.name,l:t.name})):kind=='room'?d.rooms.map(r=>({v:r.name,l:r.name+(r.type?` (${r.type})`:'')})):kind=='subject'?d.courses.map(c=>({v:ckey(c.code,c.group),l:`${c.code} ${c.name} · ${c.group}`})):DF.map((x,i)=>({v:String(i),l:'วัน'+x}));
 if(u.role=='student'&&u.group)o=o.filter(x=>x.v==u.group);return o}
const rowsFor=(kind,sel)=>S.tt.rows.map((r,i)=>({...r,i})).filter(r=>kind=='subject'?ckey(r.code,r.group)==sel:r[kind]==sel);
function conflictFn(){const d=S.data,c={},bl={};S.tt.rows.forEach(r=>['teacher','room','group'].forEach(k=>{const x=k+'\u0001'+r[k]+'\u0001'+r.slot;c[x]=(c[x]||0)+1}));
 (S.blocks||[]).filter(b=>!b.free).forEach(b=>b.slots.forEach(s=>bl[b.kind+'\u0001'+b.target+'\u0001'+s]=1));const un={};d.teachers.forEach(t=>unav(t).forEach(s=>un[t.name+'\u0001'+s]=1));
 return r=>['teacher','room','group'].some(k=>c[k+'\u0001'+r[k]+'\u0001'+r.slot]>1||bl[k+'\u0001'+r[k]+'\u0001'+r.slot])||un[r.teacher+'\u0001'+r.slot]||r.slot%P==LUNCH}
const KN={room:'ห้อง',teacher:'ครู',group:'กลุ่มเรียน'};
// ข้อความ/แจ้งไม่ว่างที่เกี่ยวกับช่องนี้: ของรายการที่กำลังดู + ของครู/ห้อง/กลุ่มที่มีเรียนในช่องนี้
const cellNotes=(sl,kind,sel,rs)=>(S.blocks||[]).filter(b=>b.slots.includes(sl)&&((b.kind==kind&&b.target==sel)||rs.some(r=>r[b.kind]==b.target)));
const noteHtml=(b,kind,sel)=>`<div class="cell ${b.free?'nt':'bl'}">${ic(b.free?'note':'ban')}<span>${esc(b.note)}${b.kind==kind&&b.target==sel?'':`<span class="mu">${KN[b.kind]} ${esc(b.target)}</span>`}</span></div>`;
const cellAttr=(ed,sl,k,s,lab)=>ed?` class="ce" data-cell="${sl}" data-k="${k}" data-s="${esc(s)}" tabindex="0" role="button" aria-label="แก้ไข ${esc(lab)}"`:'';
function gridHtml(kind,sel,ed){const rows=rowsFor(kind,sel),by={},cf=conflictFn();rows.forEach(r=>(by[r.slot]=by[r.slot]||[]).push(r));
 const ek=kind=='subject'?'group':kind,es=kind=='subject'?(S.data.courses.find(c=>ckey(c.code,c.group)==sel)||{}).group||'':sel;
 const L=r=>kind=='group'?[r.teacher,r.room]:kind=='teacher'?[r.group,r.room]:kind=='room'?[r.group,r.teacher]:[r.teacher,r.room];
 return`<div class="ow"><table class="tt"><tr><th></th>${[...Array(P)].map((_,i)=>`<th>คาบ ${i+1}<br><span class="mu tm">${esc(tlabel(i))}</span></th>`).join('')}</tr>${DN.map((x,di)=>`<tr><th>${DF[di]}</th>${[...Array(P)].map((_,p)=>{const sl=di*P+p,rs=by[sl]||[],ns=cellNotes(sl,ek,es,rs),lab=`${DF[di]} คาบ ${p+1}`;
  if(p==LUNCH)return`<td${cellAttr(ed,sl,ek,es,lab).replace('class="ce"','class="ce lunch"')||' class="lunch"'}>${ic('cup')} พักเที่ยง<br><span class="tm">${esc(tlabel(p))}</span>${ns.map(b=>noteHtml(b,ek,es)).join('')}</td>`;
  return`<td${cellAttr(ed,sl,ek,es,lab)}>${ns.map(b=>noteHtml(b,ek,es)).join('')}${rs.map(r=>`<div class="cell${cf(r)?' cf':''}${r.kind=='p'?' pr':''}"${cf(r)?' title="คาบนี้ชนเงื่อนไข"':''}><span class="cd">${esc(r.code)}</span> <span class="tg">${r.kind=='p'?'ป':r.kind=='t'?'ท':''}</span><br><b>${esc(r.name)}</b><br>${esc(L(r)[0])}<br><span class="mu">${esc(L(r)[1])}</span></div>`).join('')}${ed&&!rs.length&&!ns.length?'<span class="ad" aria-hidden="true">'+ic('plus')+'</span>':''}</td>`}).join('')}</tr>`).join('')}</table></div>`}
function dayHtml(di,q,ed){const gs=S.data.groups.filter(g=>!q||g.name.toLowerCase().includes(q)),cf=conflictFn(),by={};S.tt.rows.forEach(r=>{if(dayOf(r.slot)==di)(by[r.group+'\u0001'+r.slot%P]=by[r.group+'\u0001'+r.slot%P]||[]).push(r)});
 return`<div class="ow"><table class="tt day"><tr><th>กลุ่ม \\ คาบ</th>${[...Array(P)].map((_,i)=>`<th>${i+1}<br><span class="mu tm">${esc(tlabel(i))}</span></th>`).join('')}</tr>${gs.map(g=>`<tr><th>${esc(g.name)}</th>${[...Array(P)].map((_,p)=>{const sl=di*P+p,rs=by[g.name+'\u0001'+p]||[],ns=cellNotes(sl,'group',g.name,rs),at=cellAttr(ed,sl,'group',g.name,`${g.name} คาบ ${p+1}`);
  return p==LUNCH?`<td${at?at.replace('class="ce"','class="ce lunch"'):' class="lunch"'}>พัก${ns.map(b=>noteHtml(b,'group',g.name)).join('')}</td>`:`<td${at}>${ns.map(b=>noteHtml(b,'group',g.name)).join('')}${rs.map(r=>`<div class="cell${cf(r)?' cf':''}${r.kind=='p'?' pr':''}" title="${esc(r.name)}"><b>${esc(r.code)}</b><br>${esc(r.teacher)}<br><span class="mu">${esc(r.room)}</span></div>`).join('')}${ed&&!rs.length&&!ns.length?'<span class="ad" aria-hidden="true">'+ic('plus')+'</span>':''}</td>`}).join('')}</tr>`).join('')}</table></div>`}
function kindLabel(kind,sel){if(kind=='day')return'วัน'+DF[+sel];if(kind=='subject'){const c=S.data.courses.find(c=>ckey(c.code,c.group)==sel);return c?`${c.code} ${c.name} (${c.group})`:sel}return KINDS[kind]+' '+sel}
function viewV(){const d=S.data,tt=S.tt,m=$('#mn'),u=S.user;if(!d||!tt){m.innerHTML='<div class="card empty"><h2>ยังไม่มีตารางสอน</h2><p class="mu">แอดมินต้องนำเข้าข้อมูลและจัดตารางก่อน</p></div>';return}
 const ks=kindsFor(u);if(!ks.includes(S.view))S.view=u.role=='teacher'&&u.name?'teacher':ks[0];const kind=S.view,q=S.q.trim().toLowerCase(),all=optsFor(kind),opts=q&&kind!='day'?all.filter(o=>o.l.toLowerCase().includes(q)):all;
 if(!opts.some(o=>o.v==S.sel))S.sel=kind=='teacher'&&u.name&&opts.some(o=>o.v==u.name)?u.name:kind=='group'&&u.group&&opts.some(o=>o.v==u.group)?u.group:opts[0]?opts[0].v:'';
 const ed=u.role!='student',cnt=kind=='day'?tt.rows.filter(r=>dayOf(r.slot)==+S.sel).length:rowsFor(kind,S.sel).length;
 m.innerHTML=`<div class="card"><div class="row">${ks.length>1?`<select id="vk" aria-label="มุมมอง">${ks.map(k=>`<option value="${k}" ${k==kind?'selected':''}>ตาม${KINDS[k]}</option>`).join('')}</select>`:''}
 ${all.length>1||q?`<span class="si">${ic('search')}<input id="vq" type="search" placeholder="ค้นหา${kind=='day'?'กลุ่มเรียน':''}…" value="${esc(S.q)}" aria-label="ค้นหา"></span>`:''}
 <select id="vs" aria-label="เลือกรายการ">${opts.map(o=>`<option value="${esc(o.v)}" ${o.v==S.sel?'selected':''}>${esc(o.l)}</option>`).join('')}</select>
 <span class="mu">${cnt} คาบ${q&&kind!='day'?` · พบ ${opts.length}/${all.length}`:''}</span><span class="sp"></span><button class="g" id="vp">${ic('printer')} พิมพ์ / PDF</button></div>
 <div class="lgd mu"><span class="cell sw"></span>ทฤษฎี (ท) <span class="cell pr sw"></span>ปฏิบัติ (ป) <span class="cell bl sw"></span>ไม่ว่าง (ห้ามจัด) <span class="cell nt sw"></span>หมายเหตุ <span class="cell cf sw"></span>ชนเงื่อนไข</div>
 ${!opts.length?'<p class="mu">ไม่พบรายการที่ค้นหา</p>':kind=='day'?dayHtml(+S.sel,q,ed):gridHtml(kind,S.sel,ed)}
 ${ed?`<p class="mu hint">${ic('pencil')} คลิกช่องไหนก็ได้ รวมคาบพัก เพื่อเพิ่ม แก้ ย้าย หรือลบคาบ และเขียนข้อความ เช่น “ปิดปรับปรุงห้อง” ระบบตรวจเงื่อนไข Hard ให้ก่อนบันทึกทุกครั้ง</p>`:''}</div>`;
 if($('#vk'))$('#vk').onchange=e=>{S.view=e.target.value;S.sel='';S.q='';viewV()};
 if($('#vq'))$('#vq').oninput=e=>{S.q=e.target.value;viewV();const el=$('#vq');el.focus();el.setSelectionRange(el.value.length,el.value.length)};
 $('#vs').onchange=e=>{S.sel=e.target.value;viewV()};$('#vp').onclick=()=>printTables(kind,[S.sel],'ตาราง');
 const go=td=>openCell(+td.dataset.cell,td.dataset.k,td.dataset.s);
 m.onclick=e=>{const td=e.target.closest('td[data-cell]');if(td)go(td)};m.onkeydown=e=>{const td=e.target.closest&&e.target.closest('td[data-cell]');if(td&&(e.key=='Enter'||e.key==' ')){e.preventDefault();go(td)}}}

// ----- หน้าต่างแก้ไขช่องตาราง: คาบเรียน (เพิ่ม/แก้/ย้าย/ลบ) + ข้อความอิสระ (ห้ามจัด หรือหมายเหตุ) -----
function tryRows(next){const d=S.data,b=hardCheck(d,S.tt.rows),a=hardCheck(d,next);if(a.total<=b.total)return'';const old=new Set(b.det.map(x=>x.h+x.m));return a.det.filter(x=>!old.has(x.h+x.m)).slice(0,2).map(x=>x.m).join(' · ')||'ขัดกับเงื่อนไข Hard'}
let _escK=null;
function openCell(sl,kind,sel){const d=S.data,tt=S.tt,u=S.user,ed=$('#ed'),dy=dayOf(sl),pp=sl%P,isL=pp==LUNCH;
 const tch=c=>c?(c.teachers&&c.teachers.length?c.teachers:[c.teacher]).filter(Boolean):[],op=(a,s)=>a.map(x=>`<option ${x==s?'selected':''}>${esc(x)}</option>`).join('');
 const here=tt.rows.map((r,i)=>({r,i})).filter(x=>x.r.slot==sl&&x.r[kind]==sel),notes=cellNotes(sl,kind,sel,here.map(x=>x.r));
 const cnt={};tt.rows.forEach(r=>{const k=ckey(r.code,r.group);cnt[k]=(cnt[k]||0)+1});
 const cs=d.courses.map((c,i)=>({c,i,have:cnt[ckey(c.code,c.group)]||0})).filter(x=>kind=='group'?x.c.group==sel:kind=='teacher'?tch(x.c).includes(sel):true).sort((a,b)=>(a.have>=a.c.periods)-(b.have>=b.c.periods));
 const cOpt=ci=>cs.map(x=>`<option value="${x.i}" ${x.i==ci?'selected':''}>${esc(`${x.c.code} ${x.c.name} · ${x.c.group} (${x.have}/${x.c.periods})`)}</option>`).join('');
 const rooms=d.rooms.map(x=>x.name),slots=[...Array(DN.length*P).keys()].filter(x=>x%P!=LUNCH),lst={room:rooms,teacher:d.teachers.map(x=>x.name),group:d.groups.map(x=>x.name)};
 const rowForm=x=>{const ci=d.courses.findIndex(c=>c.code==x.r.code&&c.group==x.r.group),c=d.courses[ci];return`<fieldset class="ef" data-i="${x.i}"><legend>${ic('book')} ${esc(x.r.code)} ${esc(x.r.name)} · ${esc(x.r.group)}</legend>
  <label class="fl">วิชา<select data-f="c">${cOpt(ci)}${ci>=0&&!cs.some(y=>y.i==ci)?`<option value="${ci}" selected>${esc(c.code+' '+c.name+' · '+c.group)}</option>`:''}</select></label>
  <div class="g2"><label class="fl">ครู<select data-f="t">${op(tch(c).length?tch(c):[x.r.teacher],x.r.teacher)}</select></label><label class="fl">ห้อง<select data-f="r">${op(rooms,x.r.room)}</select></label></div>
  <label class="fl">ช่องเวลา (เลือกเพื่อย้ายคาบ)<select data-f="s">${slots.map(s=>`<option value="${s}" ${s==sl?'selected':''}>${esc(slotName(s)+' · '+tlabel(s%P))}</option>`).join('')}</select></label>
  <div class="row"><button class="sm" data-act="save">${ic('save')} บันทึกการแก้ไข</button><button class="g sm" data-act="del">${ic('trash')} ลบคาบ</button></div></fieldset>`};
 const defRoom=kind=='room'?sel:(tt.rows.find(r=>r[kind]==sel&&dayOf(r.slot)==dy)||{}).room;
 const newForm=!isL&&!here.length&&cs.length?`<fieldset class="ef" data-i="new"><legend>${ic('plus')} เพิ่มคาบเรียน</legend><label class="fl">วิชา<select data-f="c">${cOpt(cs[0].i)}</select></label><div class="g2"><label class="fl">ครู<select data-f="t"></select></label><label class="fl">ห้อง<select data-f="r">${op(rooms,defRoom)}</select></label></div><button class="sm" data-act="add">${ic('plus')} เพิ่มคาบ</button></fieldset>`:'';
 const noteRow=b=>`<fieldset class="ef" data-b="${esc(b.id)}"><legend>${b.free?ic('note')+' หมายเหตุ':ic('ban')+' ไม่ว่าง'} · ${KN[b.kind]} ${esc(b.target)}</legend><span class="mu" style="font-size:12px">${b.slots.length>1?`ครอบคลุม ${b.slots.length} คาบ`:'เฉพาะคาบนี้'}${b.by?' · โดย '+esc(b.by):''}</span>
  <label class="fl">ข้อความ<input data-f="n" value="${esc(b.note)}"></label><label class="ck"><input type="checkbox" data-f="blk" ${b.free?'':'checked'}> ห้ามจัดคาบเรียนในช่วงนี้</label>
  <div class="row"><button class="sm" data-act="nsave">${ic('save')} บันทึกข้อความ</button>${b.slots.length>1?'<button class="g sm" data-act="nthis">ลบเฉพาะช่องนี้</button>':''}<button class="g sm" data-act="ndel">${ic('trash')} ลบข้อความ</button></div></fieldset>`;
 const dk=kind=='room'||here.length?'room':kind,dt=dk=='room'?(kind=='room'?sel:(here[0]?here[0].r.room:rooms[0])):sel;
 const addNote=`<fieldset class="ef" data-i="note"><legend>${ic('pencil')} เขียนข้อความ / แจ้งไม่ว่าง</legend><div class="g2"><label class="fl">เรื่องของ<select data-f="k">${['room','teacher','group'].map(k=>`<option value="${k}" ${k==dk?'selected':''}>${KN[k]}</option>`).join('')}</select></label><label class="fl">รายการ<select data-f="tg">${op(lst[dk],dt)}</select></label></div>
  <label class="fl">ข้อความ<input data-f="n" placeholder="เช่น ปิดปรับปรุงห้อง / ครูไปราชการ / สอบกลางภาค"></label><div class="g2"><label class="fl">ช่วงเวลา<select data-f="sc"><option value="s">เฉพาะคาบนี้</option><option value="d">ทั้งวัน${DF[dy]}</option><option value="w">ทั้งสัปดาห์</option></select></label><label class="ck"><input type="checkbox" data-f="blk" ${isL?'':'checked'}> ห้ามจัดคาบเรียน</label></div>
  <button class="sm" data-act="nadd">${ic('plus')} บันทึกข้อความ</button></fieldset>`;
 ed.innerHTML=`<div class="card dlg wide" role="dialog" aria-modal="true" aria-labelledby="edh"><div class="row" style="margin:0"><h2 id="edh" class="dh">${DF[dy]} คาบ ${pp+1} · ${esc(tlabel(pp))}</h2><button class="g sm" data-act="close" aria-label="ปิด">${ic('x')}</button></div>
  <p class="mu" style="margin:0 0 6px">${KN[kind]}: <b>${esc(sel)}</b>${isL?' · คาบพักเที่ยง (ห้ามจัดวิชา แต่เขียนข้อความได้)':''}</p><p id="em" class="er" role="alert"></p>
  ${isL?'':`<h3>คาบเรียน</h3>${here.map(rowForm).join('')}${newForm}${!here.length&&!cs.length?'<p class="mu">ไม่มีวิชาที่เพิ่มได้ในมุมมองนี้</p>':''}`}
  <h3>ข้อความในช่องนี้</h3>${notes.map(noteRow).join('')||'<p class="mu">ยังไม่มีข้อความ</p>'}${addNote}</div>`;
 const em=$('#em'),err=m=>{em.textContent=m;em.scrollIntoView({block:'nearest'})};
 const fillT=fs=>{const c=d.courses[+fs.querySelector('[data-f=c]').value],s=fs.querySelector('[data-f=t]'),ts=tch(c),cur=s.value;
  s.innerHTML=op(ts,kind=='teacher'&&ts.includes(sel)?sel:ts.includes(cur)?cur:(ts.find(t=>!tt.rows.some(r=>r.slot==sl&&r.teacher==t)&&!unav(d.teachers.find(x=>x.name==t)||{}).has(sl))||ts[0]))};
 ed.querySelectorAll('fieldset[data-i] [data-f=c]').forEach(s=>{s.onchange=()=>fillT(s.closest('fieldset'))});const nf=ed.querySelector('fieldset[data-i=new]');if(nf)fillT(nf);
 const nk=ed.querySelector('fieldset[data-i=note] [data-f=k]');nk.onchange=()=>{ed.querySelector('fieldset[data-i=note] [data-f=tg]').innerHTML=op(lst[nk.value],nk.value==kind?sel:'')};
 const close=()=>{ed.classList.add('hide');document.removeEventListener('keydown',_escK)};if(_escK)document.removeEventListener('keydown',_escK);_escK=e=>{if(e.key=='Escape')close()};document.addEventListener('keydown',_escK);
 const done=msg=>{sv();viewV();toast(msg);openCell(sl,kind,sel)};
 const mkRow=(fs,slot,base)=>{const c=d.courses[+fs.querySelector('[data-f=c]').value];if(!c)return null;const others=tt.rows.filter(r=>r!==base),same=base&&base.code==c.code&&base.group==c.group;
  const th=others.filter(r=>r.code==c.code&&r.group==c.group&&r.kind=='t').length;return{slot,code:c.code,name:c.name,group:c.group,teacher:fs.querySelector('[data-f=t]').value,room:fs.querySelector('[data-f=r]').value,kind:same&&base.kind?base.kind:th<(+c.theory||0)?'t':'p'}};
 ed.onclick=e=>{if(e.target===ed){close();return}const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act,fs=b.closest('fieldset');em.textContent='';
  if(a=='close')return close();
  if(a=='add'){const row=mkRow(fs,sl,null);if(!row)return err('เลือกวิชา');const x=tryRows([...tt.rows,row]);if(x)return err('ผิดเงื่อนไข: '+x);tt.rows.push(row);return done(`เพิ่ม ${row.code} ${slotName(sl)} แล้ว`)}
  if(a=='save'){const i=+fs.dataset.i,old=tt.rows[i],row=mkRow(fs,+fs.querySelector('[data-f=s]').value,old);if(!row)return err('เลือกวิชา');const next=tt.rows.map((r,j)=>j==i?row:r),x=tryRows(next);if(x)return err('ผิดเงื่อนไข: '+x);
   tt.rows[i]=row;return done(row.slot!=sl?`ย้าย ${row.code} ไป ${slotName(row.slot)} แล้ว`:'บันทึกการแก้ไขแล้ว')}
  if(a=='del'){const i=+fs.dataset.i,r=tt.rows[i];if(!confirm(`ลบคาบ ${r.code} ${r.name} (${r.group}) ${slotName(sl)}?`))return;tt.rows.splice(i,1);return done('ลบคาบแล้ว')}
  const blk=fs&&S.blocks.find(x=>x.id==fs.dataset.b),hits=bb=>bb.free?0:tt.rows.filter(r=>bb.slots.includes(r.slot)&&r[bb.kind]==bb.target).length,warn=n=>n?` — มี ${n} คาบชนกับช่วงนี้ (กรอบแดง) แก้/ย้ายคาบ หรือจัดตารางใหม่`:'';
  if(a=='nsave'&&blk){const n=fs.querySelector('[data-f=n]').value.trim();if(!n)return err('พิมพ์ข้อความก่อน');blk.note=n;blk.free=!fs.querySelector('[data-f=blk]').checked;return done('บันทึกข้อความแล้ว'+warn(hits(blk)))}
  if(a=='nthis'&&blk){blk.slots=blk.slots.filter(s=>s!=sl);if(!blk.slots.length)S.blocks=S.blocks.filter(x=>x!==blk);return done('ลบข้อความเฉพาะช่องนี้แล้ว')}
  if(a=='ndel'&&blk){S.blocks=S.blocks.filter(x=>x!==blk);return done('ลบข้อความแล้ว')}
  if(a=='nadd'){const n=fs.querySelector('[data-f=n]').value.trim();if(!n)return err('พิมพ์ข้อความก่อน เช่น ปิดปรับปรุงห้อง');const k=fs.querySelector('[data-f=k]').value,tg=fs.querySelector('[data-f=tg]').value,sc=fs.querySelector('[data-f=sc]').value;
   const sls=sc=='s'?[sl]:[...Array(DN.length*P).keys()].filter(x=>x%P!=LUNCH&&(sc=='w'||dayOf(x)==dy));const nb={id:Date.now()+''+Math.floor(Math.random()*1e4),kind:k,target:tg,slots:sls,note:n,free:!fs.querySelector('[data-f=blk]').checked,by:u.role+(u.name?':'+u.name:'')};
   S.blocks.push(nb);return done('บันทึกข้อความแล้ว'+warn(hits(nb)))}};
 ed.classList.remove('hide');setTimeout(()=>{const f=ed.querySelector('[data-f=n]:not([value])')||ed.querySelector('select');if(f&&!here.length)f.focus()},30)}

// ----- พิมพ์ / PDF -----
function printTables(kind,list,title){let box=$('#printArea');if(!box){box=document.createElement('div');box.id='printArea';document.body.appendChild(box)}
 box.innerHTML=list.map(sel=>`<section class="pp"><h2>${esc(title)} — ${esc(kindLabel(kind,sel))}</h2>${kind=='day'?dayHtml(+sel,''):gridHtml(kind,sel,false)}<p class="mu">Next Class · พิมพ์เมื่อ ${new Date().toLocaleString('th-TH')}</p></section>`).join('');
 const done=()=>{box.innerHTML='';window.removeEventListener('afterprint',done)};window.addEventListener('afterprint',done);
 setTimeout(()=>{try{window.print()}catch(e){alert('เบราว์เซอร์ไม่อนุญาตให้พิมพ์จากหน้านี้ — ใช้ส่งออก Excel แล้ว Save as PDF แทน')}},60)}

// ----- ส่งออก / เผยแพร่ -----
async function bundleAssets(html){const load=async p=>{const r=await fetch(p);if(!r.ok)throw new Error('โหลดไฟล์ไม่สำเร็จ: '+p);return r.text()};
 const link='<link rel="stylesheet" href="styles/app.css">';   // หน้าที่เผยแพร่แล้วจะเป็น inline อยู่แล้ว → ข้าม
 if(html.includes(link)){const css=await load('styles/app.css');html=html.replace(link,()=>`<style id="app-css">${css}</style>`)}
 for(const p of ['scripts/core/app.js','scripts/core/api.js','scripts/data/data.js','scripts/data/samples.js','scripts/scheduler/scheduler.js','scripts/views/views.js','scripts/auth/auth.js']){const tag=`<script src="${p}"></script>`;if(!html.includes(tag))continue;const src=(await load(p)).replace(/<\/script/gi,'<\\/script');html=html.replace(tag,()=>`<script>${src}</script>`)}
 // รูปโลโก้/ไอคอนแท็บ → ฝังเป็น data URL เพื่อให้หน้าที่เผยแพร่แสดงรูปได้
 for(const p of [...new Set([...html.matchAll(/(?:src|href)="(imges\/[^"]+)"/g)].map(m=>m[1]))]){try{const r=await fetch(p);if(!r.ok)continue;const b=await r.blob(),u=await new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.readAsDataURL(b)});html=html.split(`"${p}"`).join(`"${u}"`)}catch(e){}}
 return html}
async function pub(){try{const a=typeof claude!='undefined'&&claude.use?await claude.use('artifact'):null;if(!a){alert('เผยแพร่ได้เมื่อเปิดหน้านี้เป็น Artifact บน claude.ai และเป็นเจ้าของ/ผู้แก้ไข\nทางเลือก: อัปโหลดโฟลเดอร์นี้ขึ้น GitHub Pages / Netlify แล้วส่งไฟล์โปรเจกต์ (.json) ให้แอดมินนำเข้า');return}
 const st=JSON.stringify({ts:Date.now(),data:S.data,tt:S.tt,blocks:S.blocks,raw:S.raw,W:S.W}).replace(/</g,'\\u003c');const html=await bundleAssets(SRC.replace(/(<script type="application\/json" id="seed">)[\s\S]*?(<\/script>)/,(m,x,y)=>x+st+y));await a.publish(html);toast('เผยแพร่แล้ว')}catch(e){alert('เผยแพร่ไม่สำเร็จ: '+((e&&(e.message||e.code))||e))}}
function outRows(d,tt){const I=d.ids||{},ids=d.slots&&d.slots.ids||{};return tt.rows.slice().sort((a,b)=>a.slot-b.slot||String((I.group||{})[a.group]||a.group).localeCompare(String((I.group||{})[b.group]||b.group))).map(r=>[(I.group||{})[r.group]||r.group,ids[r.slot]||r.slot+1,r.code,(I.teacher||{})[r.teacher]||r.teacher,(I.room||{})[r.room]||r.room])}
const TTH=['วัน','คาบ','เวลา','รหัสวิชา','วิชา','ประเภท','กลุ่มเรียน','ครู','ห้อง'];
const ttRow=r=>[DF[dayOf(r.slot)],r.slot%P+1,tlabel(r.slot%P),r.code,r.name,r.kind=='p'?'ปฏิบัติ':r.kind=='t'?'ทฤษฎี':'',r.group,r.teacher,r.room];
function gridAoa(kind,sel){const rows=rowsFor(kind,sel),L=r=>kind=='group'?[r.teacher,r.room]:kind=='teacher'?[r.group,r.room]:[r.group,r.teacher];
 return[['วัน \\ คาบ',...[...Array(P)].map((_,i)=>`คาบ ${i+1} (${tlabel(i)})`)],...DN.map((x,di)=>[DF[di],...[...Array(P)].map((_,p)=>p==LUNCH?'พักเที่ยง':rows.filter(r=>r.slot==di*P+p).map(r=>`${r.code} ${r.name}\n${L(r).join('\n')}`).join('\n---\n'))])]}
function exp(){const d=S.data,tt=S.tt,dis=x=>x?'':'disabled';
 $('#mn').innerHTML=`<div class="card"><h2>ส่งออกไฟล์</h2><div class="ex">
 <button id="e5" ${dis(tt)}><b>${ic('file')} output.csv</b><small>รูปแบบตามโจทย์ group_id,timeslot_id,subject_id,teacher_id,room_id</small></button>
 <button id="e4" ${dis(tt)}><b>${ic('sheet')} Excel ครบชุด (.xlsx)</b><small>ตารางรวม · ตารางรายกลุ่ม/ครู/ห้อง · สรุปเงื่อนไข · dataset</small></button>
 <button class="g" id="e1" ${dis(tt)}><b>${ic('download')} ตารางสอนรวม (CSV)</b><small>วัน คาบ เวลา วิชา กลุ่ม ครู ห้อง</small></button>
 <button class="g" id="e3" ${dis(tt)}><b>${ic('download')} ตารางแยกตามกลุ่ม (CSV)</b><small>เรียงตามกลุ่มเรียน</small></button>
 <button class="g" id="e2" ${dis(d)}><b>${ic('database')} Dataset ที่ใช้จัดตาราง (CSV)</b><small>ไฟล์ต้นฉบับหลัง cleansing</small></button>
 <button class="g" id="e7" ${dis(d)}><b>${ic('save')} ไฟล์โปรเจกต์ (.json)</b><small>ข้อมูล + ตาราง + แจ้งไม่ว่าง ใช้สำรอง/ย้ายเครื่อง</small></button></div></div>
 <div class="card"><h2>PDF (พิมพ์ / Save as PDF)</h2><p class="mu">เลือก “Save as PDF / บันทึกเป็น PDF” ในหน้าต่างพิมพ์ — 1 หน้าต่อ 1 ตาราง</p><div class="row"><button class="g" id="p1" ${dis(tt)}>${ic('printer')} ทุกกลุ่มเรียน</button><button class="g" id="p2" ${dis(tt)}>${ic('printer')} ทุกครู</button><button class="g" id="p3" ${dis(tt)}>${ic('printer')} ทุกห้อง</button><button class="g" id="p4" ${dis(tt)}>${ic('printer')} รายวัน</button></div></div>
 ${API.on?`<div class="card"><h2>${ic('database')} ใช้งานร่วมกันผ่านเซิร์ฟเวอร์</h2><p class="mu">ข้อมูล ตาราง และข้อความทั้งหมดบันทึกในฐานข้อมูลแล้ว ครูและนักเรียนเข้าที่ <code>${esc(location.origin)}</code> ด้วยบัญชีของตนเองได้ทันที (จัดการบัญชีที่เมนู “ผู้ดูแลระบบ”)</p></div>`
 :`<div class="card"><h2>เผยแพร่ให้ครู/นักเรียน (Cloud)</h2><p class="mu">ข้อมูลเก็บในเบราว์เซอร์ของแต่ละเครื่อง ครูและนักเรียนจะเห็นตารางเมื่อแอดมินกดเผยแพร่ แล้วแชร์ลิงก์หน้านี้ หรือรันเซิร์ฟเวอร์ <code>node backEnd/server.js</code> เพื่อใช้ฐานข้อมูลกลาง</p><button id="e6" ${dis(tt)}>${ic('send')} เผยแพร่ตารางล่าสุด</button></div>`}`;
 if(tt){$('#e1').onclick=()=>save('timetable.csv',toCSV(TTH,tt.rows.slice().sort((a,b)=>a.slot-b.slot).map(ttRow)));
  $('#e3').onclick=()=>save('timetable_by_group.csv',toCSV(['กลุ่มเรียน',...TTH.filter(h=>h!='กลุ่มเรียน')],tt.rows.slice().sort((a,b)=>a.group.localeCompare(b.group)||a.slot-b.slot).map(r=>{const x=ttRow(r);return[r.group,...x.slice(0,6),...x.slice(7)]})));
  $('#e5').onclick=()=>save('output.csv',toCSV(['group_id','timeslot_id','subject_id','teacher_id','room_id'],outRows(d,tt)).replace('﻿',''));
  $('#e4').onclick=async()=>{if(typeof XLSX=='undefined'){alert('โหลดไลบรารี Excel ไม่ได้ (ต้องต่ออินเทอร์เน็ต) — ใช้ CSV แทน');return}try{const wb=XLSX.utils.book_new(),used=new Set(),nm=n=>{let s=String(n).replace(/[\\\/\?\*\[\]:]/g,'-').slice(0,28),x=s,i=2;while(used.has(x))x=s.slice(0,25)+'~'+i++;used.add(x);return x};
   const mk=(n,aoa,w)=>{const ws=XLSX.utils.aoa_to_sheet(aoa);if(w)ws['!cols']=aoa[0].map((_,i)=>({wch:i?w:12}));XLSX.utils.book_append_sheet(wb,ws,nm(n))};const M=freshM();
   mk('ตารางรวม',[TTH,...tt.rows.slice().sort((a,b)=>a.slot-b.slot).map(ttRow)]);mk('output',[['group_id','timeslot_id','subject_id','teacher_id','room_id'],...outRows(d,tt)]);
   mk('สรุปเงื่อนไข',[['ประเภท','ข้อ','เงื่อนไข','ผล'],...HARD.slice(1).map((t,i)=>['Hard',i+1,t,M.hard.H[i+1]?`ผิด ${M.hard.H[i+1]} จุด`:'ผ่าน']),...Object.keys(SOFT).map(k=>['Soft',SOFT[k][0],SOFT[k][1],`${M.soft[k]} ${SOFT[k][2]}`]),...M.hard.ds.map((x,i)=>['ชุดข้อมูล',i+1,x[0],x[1]?'ผ่าน':'ไม่ผ่าน'])]);
   d.groups.forEach(g=>mk('กลุ่ม '+g.name,gridAoa('group',g.name),22));d.teachers.filter(t=>tt.rows.some(r=>r.teacher==t.name)).forEach(t=>mk('ครู '+t.name,gridAoa('teacher',t.name),22));
   if(d.rooms.length<=40)d.rooms.filter(r=>tt.rows.some(x=>x.room==r.name)).forEach(r=>mk('ห้อง '+r.name,gridAoa('room',r.name),22));
   for(const k in PV)if((d[k]||[]).length)mk('data-'+k,[PV[k],...d[k].map(r=>PV[k].map(h=>h=='teacher'?(r.teachers||[r.teacher]).join(' / '):r[h]))]);
   await save('timetable.xlsx',new Blob([XLSX.write(wb,{type:'array',bookType:'xlsx'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))}catch(e){console.error(e);alert('ส่งออก Excel ไม่สำเร็จ: '+(e.message||e))}};
  $('#p1').onclick=()=>printTables('group',d.groups.map(g=>g.name),'ตารางเรียน');$('#p2').onclick=()=>printTables('teacher',d.teachers.filter(t=>tt.rows.some(r=>r.teacher==t.name)).map(t=>t.name),'ตารางสอน');
  $('#p3').onclick=()=>printTables('room',d.rooms.filter(r=>tt.rows.some(x=>x.room==r.name)).map(r=>r.name),'ตารางการใช้ห้อง');$('#p4').onclick=()=>printTables('day',DN.map((_,i)=>String(i)),'ตารางรายวัน');if($('#e6'))$('#e6').onclick=pub}
 if(d){$('#e7').onclick=()=>save('nongtime-project.json',JSON.stringify({app:'Next Class',ts:Date.now(),data:S.data,tt:S.tt,blocks:S.blocks,raw:S.raw,W:S.W}));
  $('#e2').onclick=async()=>{if(Object.keys(S.raw||{}).length){for(const k in S.raw){const h=Object.keys(S.raw[k][0]||{});await save(k+'.csv',toCSV(h,S.raw[k].map(r=>h.map(x=>r[x]))))}return}for(const k in HEAD)if((d[k]||[]).length)await save(k+'.csv',toCSV(HEAD[k],d[k].map(r=>HEAD[k].map(h=>h=='teacher'?(r.teachers||[r.teacher]).join(' / '):r[h]))))}}}

// ----- บัญชีผู้ใช้ + ประวัติตาราง + บันทึกการใช้งาน (โหมดเซิร์ฟเวอร์) -----
const RN={admin:'แอดมิน',teacher:'ครู',student:'นักเรียน'},SRCN={ai:'AI จัดตาราง',import:'นำเข้าไฟล์'};
const ACTN={login:'เข้าสู่ระบบ',logout:'ออกจากระบบ',login_failed:'เข้าสู่ระบบไม่สำเร็จ',password_changed:'เปลี่ยนรหัสผ่าน',dataset_saved:'บันทึกชุดข้อมูล',data_cleared:'ล้างข้อมูล',timetable_generated:'จัดตารางด้วย AI',timetable_imported:'นำเข้าตาราง',timetable_edited:'แก้ไขตาราง',timetable_cleared:'ล้างตาราง',timetable_restored:'ย้อนกลับตารางฉบับเก่า',notes_saved:'บันทึกข้อความ/แจ้งไม่ว่าง',user_created:'เพิ่มบัญชี',user_updated:'แก้ไขบัญชี',signup:'สมัครสมาชิก',user_approved:'อนุมัติบัญชี',signup_settings:'ตั้งค่าการสมัครสมาชิก',user_password_reset:'แอดมินแก้รหัสผ่าน',user_password_bulk:'แอดมินแก้รหัสผ่านหลายบัญชี',user_bulk_enabled:'เปิดใช้หลายบัญชี',user_bulk_disabled:'ปิดใช้หลายบัญชี',user_deleted:'ลบบัญชี',backup_downloaded:'ดาวน์โหลดสำรองข้อมูล'};
const fmtT=s=>{if(!s)return'—';const d=new Date(String(s).replace(' ','T')+'Z');return isNaN(d)?s:d.toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})};
function formDlg(title,body,onOk,okLabel){const ed=$('#ed');ed.innerHTML=`<div class="card dlg" role="dialog" aria-modal="true" aria-labelledby="fdh"><div class="row" style="margin:0"><h2 id="fdh" class="dh">${title}</h2><button class="g sm" data-x aria-label="ปิด">${ic('x')}</button></div><form id="fdf">${body}<p id="em" class="er" role="alert"></p><div class="row end"><button type="button" class="g" data-x>ยกเลิก</button><button type="submit">${okLabel||'บันทึก'}</button></div></form></div>`;
 const close=()=>ed.classList.add('hide');ed.onclick=e=>{if(e.target===ed||e.target.closest('[data-x]'))close()};
 $('#fdf').onsubmit=async e=>{e.preventDefault();const b=e.submitter||$('#fdf button[type=submit]');b.disabled=true;try{await onOk(new FormData($('#fdf')));close()}catch(err){$('#em').textContent=err.message}finally{b.disabled=false}};
 ed.classList.remove('hide');setTimeout(()=>{const f=ed.querySelector('input,select');if(f)f.focus()},30)}
// ----- เมนูพิเศษ: ผู้ดูแลระบบ (เฉพาะแอดมิน, โหมดเซิร์ฟเวอร์) -----
const ASUB=[['users','key','บัญชีและรหัสผ่าน'],['history','calendar','ประวัติตาราง'],['audit','file','บันทึกการใช้งาน'],['backup','database','สำรองข้อมูล']];
const ASEL=new Set();
const pwFields=(min,self,bulk)=>`<label class="fl">รหัสผ่านใหม่ (อย่างน้อย ${min} ตัวอักษร)<span class="pwf"><input name="password" type="password" required minlength="${min}" maxlength="128" autocomplete="new-password"><button type="button" class="g sm" data-show>แสดง</button></span></label>
 <label class="fl">ยืนยันรหัสผ่านใหม่<input name="password2" type="password" required minlength="${min}" maxlength="128" autocomplete="new-password"></label>
 <label class="ck"><input type="checkbox" name="must_change" ${self?'':'checked'}> ให้ผู้ใช้ตั้งรหัสใหม่เองเมื่อเข้าสู่ระบบครั้งถัดไป</label>
 <p class="mu" style="font-size:12.5px;margin:4px 0 0">${bulk?'ทุกบัญชีที่เลือก':'บัญชีนี้'}จะถูกออกจากระบบทุกเครื่อง${self?' (ยกเว้นเครื่องนี้)':''} · ถ้าตั้งเป็น 1234 ระบบจะบังคับให้เปลี่ยนเสมอ</p>`;
const bindShow=()=>{const sb=$('#ed [data-show]');if(sb)sb.onclick=()=>{const f=$('#ed').querySelectorAll('input[name^=password]'),h=f[0].type=='password';f.forEach(i=>i.type=h?'text':'password');sb.textContent=h?'ซ่อน':'แสดง'}};
const pwCheck=fd=>{if(fd.get('password')!==fd.get('password2'))throw new Error('ยืนยันรหัสผ่านไม่ตรงกัน');return{password:fd.get('password'),must_change:fd.get('must_change')==='on'}};
async function adminV(){const m=$('#mn');
 if(!API.on){m.innerHTML=`<div class="adm-hd"><div><h2 class="adm-t">${ic('shield')} ผู้ดูแลระบบ</h2><p class="mu">ตอนนี้เปิดแบบไฟล์เดียว (ไม่มีเซิร์ฟเวอร์) ข้อมูลอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น</p></div></div>
  <div class="card hl"><h2>${ic('database')} เปิดโหมดเซิร์ฟเวอร์เพื่อใช้เมนูผู้ดูแลระบบเต็มรูปแบบ</h2>
  <p class="mu">ต้องเปิดผ่านเซิร์ฟเวอร์ก่อน จึงจะใช้จัดการบัญชีครูและนักเรียน แก้รหัสผ่านของทุกคน ดูประวัติตาราง ดูบันทึกการใช้งาน และสำรองฐานข้อมูลได้</p>
  <ol class="steps"><li>ดับเบิลคลิกไฟล์ <code>backEnd\\start.cmd</code> ในโฟลเดอร์โปรเจกต์ (หรือรัน <code>node backEnd/server.js</code>)</li><li>เบราว์เซอร์จะเปิด <b>http://localhost:3000</b> ให้เอง (ถ้าไม่เปิด ให้พิมพ์ลิงก์นี้เอง)</li><li>เข้าสู่ระบบด้วย <code>admin / admin</code> ระบบจะบังคับตั้งรหัสใหม่ จากนั้นเมนูนี้จะแสดงครบทุกหมวด</li></ol></div>
  <div class="card"><h2>${ic('key')} ใช้ได้ในโหมดไฟล์เดียว</h2><div class="row"><button class="g" id="lpw">${ic('key')} เปลี่ยนรหัสแอดมิน (เครื่องนี้)</button><button class="g" id="lbk">${ic('save')} สำรองไฟล์โปรเจกต์ (.json)</button></div>
  <p class="mu hint">${ic('info')} ไฟล์โปรเจกต์ .json นำไปเปิดในโหมดเซิร์ฟเวอร์ได้ ที่เมนู “ข้อมูลและตรวจสอบ” → เลือกไฟล์</p></div>`;
  $('#lpw').onclick=()=>openPw(false);$('#lbk').onclick=()=>save('nongtime-project.json',JSON.stringify({app:'Next Class',ts:Date.now(),data:S.data,tt:S.tt,blocks:S.blocks,raw:S.raw,W:S.W}));return}
 const sub=S.asub||'users';
 m.innerHTML=`<div class="adm-hd"><div><h2 class="adm-t">${ic('shield')} ผู้ดูแลระบบ</h2><p class="mu">เฉพาะแอดมิน · จัดการบัญชีและรหัสผ่าน ดูประวัติ ตรวจการใช้งาน และสำรองข้อมูล</p></div>
 <div class="seg" role="tablist" aria-label="หมวดผู้ดูแลระบบ">${ASUB.map(([k,i,l])=>`<button role="tab" aria-selected="${k==sub}" class="${k==sub?'on':''}" data-as="${k}">${ic(i)}<span>${l}</span></button>`).join('')}</div></div><div id="admc"><div class="card"><p class="mu">กำลังโหลด…</p></div></div>`;
 m.querySelectorAll('[data-as]').forEach(b=>b.onclick=()=>{S.asub=b.dataset.as;adminV()});
 const box=$('#admc');try{await({users:admUsers,history:admHistory,audit:admAudit,backup:admBackup})[sub](box)}catch(e){box.innerHTML=`<div class="card er-box">${esc(e.message)}</div>`}}
async function admUsers(box){const[U,Sm]=await Promise.all([API.call('GET','users'),API.call('GET','admin/summary')]);if(S.tab!='admin'||S.asub&&S.asub!='users')return;
 const q=(S.uq||'').toLowerCase(),rf=S.ur||'',ids=new Set(U.users.map(u=>u.id));[...ASEL].forEach(i=>{if(!ids.has(i))ASEL.delete(i)});
 const list=U.users.filter(u=>(!rf||(rf=='pending'?u.pending:u.role==rf))&&(!q||(u.username+' '+u.display_name+' '+(u.teacher_name||'')+' '+(u.group_name||'')).toLowerCase().includes(q))),shown=list.slice(0,300);
 const allOn=shown.length&&shown.every(u=>ASEL.has(u.id));
 box.innerHTML=`<div class="grid adm-k"><div class="k"><b>${U.users.length}</b><span>บัญชีทั้งหมด · แอดมิน ${Sm.users.admin} ครู ${Sm.users.teacher} นักเรียน ${Sm.users.student}</span></div>
  <div class="k"><b class="${Sm.pending?'wa':''}">${Sm.pending}</b><span>สมัครใหม่ รออนุมัติ</span></div><div class="k"><b>${Sm.must_change}</b><span>รอตั้งรหัสใหม่ · ปิดใช้งาน ${Sm.inactive}</span></div>
  <div class="k"><b class="${Sm.failed24?'er':''}">${Sm.failed24}</b><span>เข้าสู่ระบบไม่สำเร็จ (24 ชม.)</span></div></div>
 ${Sm.pending&&rf!='pending'?`<div class="selbar warnbar">${ic('alert')}<b>มี ${Sm.pending} บัญชีสมัครใหม่รออนุมัติ</b><span class="sp"></span><button class="sm" id="upend">ดูรายการรออนุมัติ</button></div>`:''}
 <div class="card"><h2>${ic('key')} บัญชีและรหัสผ่าน</h2>
 <div class="setrow"><b>สมัครสมาชิก</b><label class="ck"><input type="checkbox" id="sg_on" ${Sm.signup.enabled?'checked':''}> เปิดให้ครู/นักเรียนสมัครเองที่หน้าเข้าสู่ระบบ</label><label class="ck"><input type="checkbox" id="sg_auto" ${Sm.signup.auto_approve?'checked':''} ${Sm.signup.enabled?'':'disabled'}> อนุมัติอัตโนมัติ (ไม่แนะนำ: ใครก็สมัครเป็นครูได้)</label></div>
 <div class="row"><span class="si">${ic('search')}<input id="uq" type="search" placeholder="ค้นหาชื่อผู้ใช้ ชื่อ หรือกลุ่ม…" value="${esc(S.uq||'')}" aria-label="ค้นหาบัญชี"></span><select id="ur" aria-label="กรองบทบาท"><option value="">ทุกบทบาท</option>${Object.keys(RN).map(k=>`<option value="${k}" ${k==rf?'selected':''}>${RN[k]}</option>`).join('')}<option value="pending" ${rf=='pending'?'selected':''}>รออนุมัติ (${Sm.pending})</option></select><span class="sp"></span><button class="g" id="ux">${ic('download')} รายชื่อบัญชี (CSV)</button><button id="ua">${ic('plus')} เพิ่มบัญชี</button></div>
 <div class="selbar ${ASEL.size?'':'hide'}"><b>เลือกไว้ ${ASEL.size} บัญชี</b><span class="sp"></span>${U.users.some(u=>ASEL.has(u.id)&&u.pending)?`<button class="sm" data-bulk="approve">${ic('check')} อนุมัติที่เลือก</button>`:''}<button class="sm" data-bulk="pw">${ic('key')} แก้รหัสผ่านที่เลือก</button><button class="g sm" data-bulk="off">ปิดใช้</button><button class="g sm" data-bulk="on">เปิดใช้</button><button class="g sm" data-bulk="clear">ยกเลิกการเลือก</button></div>
 <div class="ow"><table><tr><th class="cb"><input type="checkbox" id="uall" aria-label="เลือกทั้งหมดที่แสดง" ${allOn?'checked':''}></th><th class="l">ชื่อผู้ใช้</th><th class="l">ชื่อที่แสดง</th><th>บทบาท</th><th class="l">เชื่อมกับ</th><th>สถานะ</th><th>เข้าใช้ล่าสุด</th><th></th></tr>${shown.map(u=>`<tr data-u="${u.id}" data-n="${esc(u.username)}" data-r="${u.role}" class="${ASEL.has(u.id)?'sel':''}"><td class="cb"><input type="checkbox" data-cb aria-label="เลือก ${esc(u.username)}" ${ASEL.has(u.id)?'checked':''}></td><td class="l"><b>${esc(u.username)}</b>${API.user&&API.user.id==u.id?' <span class="role">คุณ</span>':''}</td><td class="l">${esc(u.display_name)}</td><td>${RN[u.role]}</td><td class="l mu">${esc(u.teacher_name||u.group_name||'—')}</td>
  <td>${u.pending?`<span class="wa">รออนุมัติ</span><br><span class="mu" style="font-size:11.5px">สมัคร ${fmtT(u.created_at)}</span>`:u.active?(u.must_change?'<span class="wa">รอเปลี่ยนรหัส</span>':'<span class="ok">ใช้งาน</span>'):'<span class="mu">ปิดใช้งาน</span>'}</td><td class="mu">${fmtT(u.last_login)}</td>
  <td><div class="row" style="margin:0;justify-content:flex-end;flex-wrap:nowrap">${u.pending?`<button class="sm" data-ua="approve">${ic('check')} อนุมัติ</button><button class="g sm dg" data-ua="reject">ปฏิเสธ</button>`:`<button class="g sm" data-ua="pw">แก้รหัสผ่าน</button><button class="g sm" data-ua="act" data-on="${u.active?1:0}">${u.active?'ปิดใช้':'เปิดใช้'}</button><button class="g sm dg icon" data-ua="del" aria-label="ลบบัญชี ${esc(u.username)}">${ic('trash')}</button>`}</div></td></tr>`).join('')||'<tr><td colspan="8" class="mu">ไม่พบบัญชี</td></tr>'}</table></div>${list.length>300?`<p class="mu">แสดง 300 จาก ${list.length} บัญชี — ใช้ช่องค้นหาหรือกรองบทบาท</p>`:''}
 <p class="mu hint">${ic('info')} ติ๊กเลือกหลายบัญชี (หรือกรองบทบาทแล้วติ๊กหัวตาราง) เพื่อแก้รหัสผ่านพร้อมกัน · รหัสผ่านเก็บแบบแฮช scrypt + salt ไม่มีใครอ่านรหัสจริงได้ แม้แต่แอดมิน</p></div>`;
 const re=()=>admUsers(box);
 $('#uq').oninput=e=>{S.uq=e.target.value;clearTimeout(admUsers._t);admUsers._t=setTimeout(async()=>{await re();const el=$('#uq');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}},250)};
 $('#ur').onchange=e=>{S.ur=e.target.value;re()};
 if($('#upend'))$('#upend').onclick=()=>{S.ur='pending';re()};
 const sg=async()=>{try{await API.call('PUT','admin/signup',{enabled:$('#sg_on').checked,auto_approve:$('#sg_on').checked&&$('#sg_auto').checked});toast('บันทึกการตั้งค่าการสมัครแล้ว');re()}catch(e){toast(e.message)}};$('#sg_on').onchange=sg;
 $('#sg_auto').onchange=()=>{if($('#sg_auto').checked&&!confirm('อนุมัติอัตโนมัติ = ใครก็สมัครเป็นครูและแก้ตารางได้ทันที ยืนยันเปิด?')){$('#sg_auto').checked=false;return}sg()};
 $('#uall').onchange=e=>{shown.forEach(u=>e.target.checked?ASEL.add(u.id):ASEL.delete(u.id));re()};
 box.querySelectorAll('[data-cb]').forEach(c=>c.onchange=()=>{const id=+c.closest('tr').dataset.u;c.checked?ASEL.add(id):ASEL.delete(id);re()});
 $('#ux').onclick=()=>save('nextclass-accounts.csv',toCSV(['username','display_name','role','linked','status','last_login'],list.map(u=>[u.username,u.display_name,RN[u.role],u.teacher_name||u.group_name||'',u.active?(u.must_change?'รอเปลี่ยนรหัส':'ใช้งาน'):'ปิดใช้งาน',u.last_login?fmtT(u.last_login):''])));
 $('#ua').onclick=()=>formDlg('เพิ่มบัญชีผู้ใช้',`<label class="fl">ชื่อผู้ใช้ (ใช้เข้าสู่ระบบ)<input name="username" required maxlength="60" autocomplete="off"></label><label class="fl">ชื่อที่แสดง<input name="display_name" maxlength="120"></label>
  <div class="g2"><label class="fl">บทบาท<select name="role"><option value="teacher">ครู</option><option value="student">นักเรียน</option><option value="admin">แอดมิน</option></select></label><label class="fl">รหัสผ่านเริ่มต้น<input name="password" value="1234" minlength="4" autocomplete="new-password"></label></div>
  <label class="fl">เชื่อมกับครู (สำหรับบัญชีครู)<select name="teacher_name"><option value="">—</option>${(S.data?S.data.teachers:[]).map(t=>`<option>${esc(t.name)}</option>`).join('')}</select></label>
  <label class="fl">เชื่อมกับกลุ่มเรียน (สำหรับนักเรียน)<select name="group_name"><option value="">—</option>${(S.data?S.data.groups:[]).map(g=>`<option>${esc(g.name)}</option>`).join('')}</select></label>`,
  async fd=>{await API.call('POST','users',Object.fromEntries(fd));toast('เพิ่มบัญชีแล้ว — ผู้ใช้ต้องเปลี่ยนรหัสเมื่อเข้าครั้งแรก');re()},'เพิ่มบัญชี');
 box.querySelectorAll('[data-bulk]').forEach(b=>b.onclick=async()=>{const a=b.dataset.bulk,sel=U.users.filter(u=>ASEL.has(u.id));if(a=='clear'){ASEL.clear();return re()}
  if(a=='approve'){try{const r=await API.call('POST','users/bulk',{ids:sel.filter(u=>u.pending).map(u=>u.id),approve:true});ASEL.clear();toast(`อนุมัติแล้ว ${r.count} บัญชี`);re()}catch(e){toast(e.message)}return}
  if(a=='pw'){const hasAdm=sel.some(u=>u.role=='admin'),self=sel.some(u=>API.user&&u.id==API.user.id);
   formDlg(`แก้รหัสผ่าน ${sel.length} บัญชี`,`<p class="mu" style="margin:0 0 4px">${esc(sel.slice(0,6).map(u=>u.username).join(', '))}${sel.length>6?` และอีก ${sel.length-6} บัญชี`:''}</p>${pwFields(hasAdm?6:4,self,true)}`,
    async fd=>{const v=pwCheck(fd);const r=await API.call('POST','users/bulk',{ids:sel.map(u=>u.id),...v});ASEL.clear();toast(`เปลี่ยนรหัสผ่านแล้ว ${r.count} บัญชี`);re()},`บันทึกรหัส ${sel.length} บัญชี`);bindShow();return}
  try{const r=await API.call('POST','users/bulk',{ids:sel.map(u=>u.id),active:a=='on'});ASEL.clear();toast(`${a=='on'?'เปิด':'ปิด'}ใช้งานแล้ว ${r.count} บัญชี`);re()}catch(e){toast(e.message)}});
 box.querySelectorAll('[data-ua]').forEach(b=>b.onclick=async()=>{const tr=b.closest('tr'),id=tr.dataset.u,n=tr.dataset.n,a=b.dataset.ua;
  if(a=='pw'){const self=API.user&&String(API.user.id)==id;
   formDlg(`แก้รหัสผ่าน: ${esc(n)}`,`<p class="mu" style="margin:0 0 4px">${RN[tr.dataset.r]}${self?' (บัญชีของคุณ)':''}</p>${pwFields(tr.dataset.r=='admin'?6:4,self,false)}`,
    async fd=>{const v=pwCheck(fd);await API.call('PATCH',`users/${id}`,v);if(self&&API.user)API.user.must_change=v.must_change;toast(`เปลี่ยนรหัสผ่านของ ${n} แล้ว`);re()},'บันทึกรหัสผ่าน');bindShow();return}
  if(a=='approve'){try{await API.call('PATCH',`users/${id}`,{approve:true});toast(`อนุมัติบัญชี ${n} แล้ว`);re()}catch(e){toast(e.message)}return}
  if(a=='reject'){if(!confirm(`ปฏิเสธและลบคำขอสมัครของ ${n}?`))return;try{await API.call('DELETE',`users/${id}`);toast(`ปฏิเสธคำขอของ ${n} แล้ว`);re()}catch(e){toast(e.message)}return}
  try{if(a=='act')await API.call('PATCH',`users/${id}`,{active:b.dataset.on!='1'});else if(a=='del'){if(!confirm(`ลบบัญชี ${n}? (ลบแล้วกู้คืนไม่ได้)`))return;await API.call('DELETE',`users/${id}`)}toast('บันทึกแล้ว');re()}catch(e){toast(e.message)}})}
async function admHistory(box){const T=await API.call('GET','timetables');
 box.innerHTML=`<div class="card"><h2>${ic('calendar')} ประวัติตารางสอน</h2><p class="mu">ทุกครั้งที่จัดตารางหรือนำเข้า ระบบเก็บเป็นฉบับใหม่ ย้อนกลับไปใช้ฉบับเก่าได้ (ฉบับปัจจุบันยังอยู่ในประวัติ)</p><div class="ow"><table><tr><th>ฉบับ</th><th class="l">สร้างเมื่อ</th><th>ที่มา</th><th>Seed</th><th>จัดได้</th><th>Hard</th><th>Soft cost</th><th class="l">โดย</th><th></th></tr>${T.timetables.map(t=>`<tr><td>#${t.id}</td><td class="l">${fmtT(t.created_at)}${t.updated_at?`<br><span class="mu">แก้ไข ${fmtT(t.updated_at)}</span>`:''}</td><td>${esc(SRCN[t.source]||t.source)}</td><td>${esc(t.seed??'—')}</td><td>${t.placed??'—'}${t.total?'/'+t.total:''}</td><td class="${t.hard_violations?'er':'ok'}">${t.hard_violations??'—'}</td><td>${t.soft_cost??'—'}</td><td class="l">${esc(t.created_by_name||'—')}</td><td>${t.active?'<span class="ok">ใช้งานอยู่</span>':`<button class="g sm" data-tv="${t.id}">ใช้ฉบับนี้</button>`}</td></tr>`).join('')||'<tr><td colspan="9" class="mu">ยังไม่มีตาราง</td></tr>'}</table></div></div>`;
 box.querySelectorAll('[data-tv]').forEach(b=>b.onclick=async()=>{if(!confirm(`ใช้ตารางฉบับ #${b.dataset.tv} แทนฉบับปัจจุบัน?`))return;try{await API.call('POST',`timetables/${b.dataset.tv}/activate`);await API.load();toast(`เปลี่ยนเป็นตารางฉบับ #${b.dataset.tv} แล้ว`);admHistory(box)}catch(e){toast(e.message)}})}
async function admAudit(box){const f=S.af||'',A=await API.call('GET','audit?limit=300'),rows=A.log.filter(a=>!f||(f=='pw'?/password/.test(a.action):a.action==f));
 box.innerHTML=`<div class="card"><h2>${ic('file')} บันทึกการใช้งาน</h2><div class="row"><select id="af" aria-label="กรองการกระทำ"><option value="">ทั้งหมด (300 รายการล่าสุด)</option><option value="login_failed" ${f=='login_failed'?'selected':''}>เข้าสู่ระบบไม่สำเร็จ</option><option value="pw" ${f=='pw'?'selected':''}>การเปลี่ยน/แก้รหัสผ่าน</option><option value="login" ${f=='login'?'selected':''}>เข้าสู่ระบบ</option><option value="timetable_edited" ${f=='timetable_edited'?'selected':''}>แก้ไขตาราง</option></select><span class="mu">${rows.length} รายการ</span></div>
 <div class="ow scr" style="max-height:560px"><table><tr><th class="l">เวลา</th><th class="l">ผู้ใช้</th><th class="l">การกระทำ</th><th class="l">รายละเอียด</th><th class="l">IP</th></tr>${rows.map(a=>`<tr><td class="l mu">${fmtT(a.at)}</td><td class="l">${esc(a.username||'—')}</td><td class="l ${a.action=='login_failed'?'er':''}">${esc(ACTN[a.action]||a.action)}</td><td class="l mu">${esc(a.detail||'')}</td><td class="l mu">${esc(String(a.ip||'').replace('::ffff:',''))}</td></tr>`).join('')||'<tr><td colspan="5" class="mu">ไม่มีรายการ</td></tr>'}</table></div></div>`;
 $('#af').onchange=e=>{S.af=e.target.value;admAudit(box)}}
async function admBackup(box){const Sm=await API.call('GET','admin/summary');const kb=n=>n>1048576?(n/1048576).toFixed(1)+' MB':(n/1024).toFixed(0)+' KB';
 box.innerHTML=`<div class="card"><h2>${ic('database')} สำรองข้อมูล</h2><div class="grid adm-k" style="margin-bottom:14px"><div class="k"><b>${kb(Sm.db_size)}</b><span>ขนาดฐานข้อมูล</span></div><div class="k"><b>${Sm.datasets}</b><span>ชุดข้อมูลที่เก็บ</span></div><div class="k"><b>${Sm.timetables}</b><span>ตารางสอนทุกฉบับ</span></div><div class="k"><b>${Sm.audit}</b><span>บันทึกการใช้งาน</span></div></div>
 <div class="row"><button id="bk">${ic('download')} ดาวน์โหลดสำรองทั้งระบบ (.json)</button><button class="g" id="bp">${ic('save')} ไฟล์โปรเจกต์ (ข้อมูล + ตารางปัจจุบัน)</button></div>
 <p class="mu hint">${ic('info')} ไฟล์สำรอง .json ไม่มีรหัสผ่าน (เก็บเฉพาะในฐานข้อมูล) · สำรองแบบเต็มรวมรหัสผ่านได้โดยคัดลอกไฟล์ <code>backEnd/data/nextclass.db</code> ตอนปิดเซิร์ฟเวอร์</p></div>`;
 $('#bk').onclick=async()=>{try{const j=await API.call('GET','backup');await save('nextclass-backup.json',JSON.stringify(j,null,1));toast('ดาวน์โหลดสำรองข้อมูลแล้ว')}catch(e){toast(e.message)}};
 $('#bp').onclick=()=>save('nongtime-project.json',JSON.stringify({app:'Next Class',ts:Date.now(),data:S.data,tt:S.tt,blocks:S.blocks,raw:S.raw,W:S.W}))}

// ----- แนวคิดและคู่มือ -----
function about(){const W=getW(),adm=S.user.role=='admin';$('#mn').innerHTML=`<div class="card prose"><h2>Next Class — ระบบจัดตารางสอนอัตโนมัติ</h2>
 <p><b>ปัญหา</b> → การจัดตารางด้วยมือใช้เวลานาน และเกิดครู/ห้อง/กลุ่มชนกันได้ง่าย · <b>แนวทาง</b> → AI Agent ที่วางแผน ลงมือ ตรวจ และปรับปรุงเอง · <b>ผลลัพธ์</b> → ตารางที่ไม่ขัดแย้ง (Hard 0 จุด) พร้อมหลักฐานตรวจเงื่อนไข 20 ข้อ และเทียบกับวิธีพื้นฐาน · <b>ประโยชน์</b> → ครูและนักเรียนดูตารางของตนเองได้ทันที ส่งออก PDF/Excel/CSV</p>
 <h3>อัลกอริทึม (เลือกเพราะเหมาะกับโจทย์)</h3><ol>
 <li><b>Constraint Satisfaction (CSP)</b> — ทุกครั้งที่วางคาบ ตรวจ Hard 10 ข้อทันที (ครู/ห้อง/กลุ่มไม่ชน, ครูตาม teach.csv, คาบพัก, ≤10 คาบ/วัน, เวลาไม่ว่าง, ความจุห้อง) ช่องที่ผิดจะไม่ถูกเลือกเลย</li>
 <li><b>Heuristic Search: Most-Constrained-First</b> — แตกวิชาเป็นบล็อก (ทฤษฎี ≤2 คาบติด, ปฏิบัติ ≤4 คาบติด) จัดบล็อกยาวและวิชาที่มีครูให้เลือกน้อยก่อน เลือกช่องที่เพิ่ม Soft cost น้อยที่สุด ถ้าวางไม่ได้จะแบ่งบล็อกแล้วลองใหม่</li>
 <li><b>Multi-start</b> — สร้างหลายรอบด้วย seed ต่างกัน แล้วเลือกผลที่จัดได้ครบที่สุดและ cost ต่ำสุด</li>
 <li><b>Simulated Annealing (SA)</b> — สุ่ม “ย้ายบล็อก” หรือ “สลับบล็อก” เฉพาะการย้ายที่ไม่ผิด Hard รับผลที่แย่ลงได้บ้างตอนอุณหภูมิสูงเพื่อหนี local optimum แล้วค่อยๆ ลดอุณหภูมิ</li></ol>
 <h3>แนวทางแบบ Agent (Plan → Act → Check → Improve)</h3><div class="flow"><span>${ic('compass')}<b>Plan</b><small>วิเคราะห์ภาระครู/กลุ่ม หาทรัพยากรตึง</small></span><span>${ic('cog')}<b>Act</b><small>สร้างตาราง CSP + Heuristic หลาย seed</small></span><span>${ic('shield')}<b>Check</b><small>ตรวจ Hard 10 + ชุดข้อมูล 8 ข้อ</small></span><span>${ic('trend')}<b>Improve</b><small>SA ปรับ Soft + ซ่อมคาบที่จัดไม่ลง</small></span><span>${ic('shield')}<b>Check</b><small>ตรวจซ้ำ + เทียบ baseline</small></span></div>
 <p>แต่ละขั้นจะบันทึก log ไว้ให้ดูที่หน้า “จัดตาราง (AI)” ระบบยังมีแชตบอท <b>น้องไทม์</b> ไว้ตอบคำถามวิธีใช้งาน</p>
 <h3>ความโปร่งใสและการทำซ้ำได้</h3><p>ใช้ตัวสุ่มแบบกำหนด seed (mulberry32) เมื่อข้อมูล น้ำหนัก seed และจำนวนรอบเหมือนเดิม ผลจะเหมือนเดิมทุกครั้ง ผลแต่ละครั้งเก็บ seed, seed ของรอบที่ดีที่สุด, จำนวนรอบ, น้ำหนัก และเวลาที่ใช้ไว้ด้วย</p>
 <h3>Soft constraints และน้ำหนักปัจจุบัน</h3><div class="ow"><table><tr><th>ข้อ</th><th class="l">เงื่อนไข</th><th>น้ำหนัก</th></tr>${Object.keys(SOFT).map(k=>`<tr><td>${SOFT[k][0]}</td><td class="l">${SOFT[k][1]}</td><td>${W[k]}</td></tr>`).join('')}</table></div>
 <h3>วิธีใช้งาน</h3><ol><li><b>ข้อมูลและตรวจสอบ</b>: นำเข้า 7 ไฟล์ (register, subject, teach, teacher, room, student_group, timeslot) หรือ Excel/JSON → ตรวจพรีวิวและข้อผิดพลาดพร้อมคำแนะนำ → ยืนยัน</li><li><b>จัดตาราง (AI)</b>: ตั้ง seed/จำนวนรอบ/น้ำหนัก → เริ่ม (ยกเลิกได้ระหว่างทำงาน)</li><li><b>ตารางสอน</b>: ดูตามกลุ่ม/ครู/ห้อง/วิชา/รายวัน ค้นหาได้ เพิ่ม/ลบคาบ และแจ้งไม่ว่าง (เช่น ห้องปิดปรับปรุง) ได้ ระบบตรวจ Hard ให้ทุกครั้ง</li><li><b>ส่งออก</b>: output.csv ตามโจทย์, Excel, CSV, PDF, ไฟล์โปรเจกต์ · เผยแพร่ให้ครูและนักเรียน</li></ol>
 <h3>บัญชีผู้ใช้</h3><p>แอดมิน admin/admin (เปลี่ยนรหัสได้) · ครู: ชื่อครูหรือ teacher_id + 1234 · นักเรียน: รหัสนักเรียน ชื่อกลุ่ม หรือ group_id + 1234 · เดโม teacher/teacher, student/student</p>
 ${adm?`<h3>การติดตั้ง (Deploy)</h3><p>เป็นเว็บแบบ static ทั้งหมด ไม่ต้องมีเซิร์ฟเวอร์ เปิดไฟล์ HTML ได้ทันทีแบบออฟไลน์ (ยกเว้น Excel ที่ต้องต่ออินเทอร์เน็ตครั้งแรก) หรืออัปโหลดทั้งโฟลเดอร์ขึ้น GitHub Pages/Netlify เพื่อใช้ออนไลน์ หรือกด “เผยแพร่” เมื่อเปิดเป็น Artifact</p>`:''}</div>`}
