// ---------- Auth / bot ----------
const SRC='<!DOCTYPE html>\n'+document.documentElement.outerHTML;
const H=s=>{let h=5381;for(const c of s)h=(h*33^c.charCodeAt(0))>>>0;return''+h};const getAp=()=>{try{return localStorage.getItem('ttadm')}catch(e){return null}};const admOk=p=>{const a=getAp();return a?H(p)==a:p.trim().toLowerCase()=='admin'};
function authz(r,u,p){if(r=='admin')return u.toLowerCase()=='admin'&&admOk(p)?{role:'admin'}:null;if(u.toLowerCase()==r&&p.trim().toLowerCase()==r)return{role:r};if(p.trim()!='1234'||!S.data)return null;const ul=u.toLowerCase();
 if(r=='teacher'){const t=S.data.teachers.find(t=>t.name==u||String(t.id||'').toLowerCase()==ul);return t?{role:'teacher',name:t.name}:null}
 const st=(S.data.students||[]).find(x=>x.student_id==u);if(st)return{role:'student',group:st.group,name:st.name};
 const g=S.data.groups.find(x=>x.name==u||String(x.id||'').toLowerCase()==ul);return g?{role:'student',group:g.name,name:g.name}:null}
$('#rs').onclick=()=>{if(API.on){$('#le').textContent='โหมดเซิร์ฟเวอร์: ให้ผู้ดูแลรัน node backEnd/server.js --reset-admin บนเครื่องเซิร์ฟเวอร์';return}try{localStorage.removeItem('ttadm')}catch(e){}$('#lr').value='admin';$('#lu').value='admin';$('#lp').value='';$('#le').textContent='รีเซ็ตแล้ว ใช้ admin / admin (ข้อมูลที่นำเข้าไว้ไม่หาย)'};
$('#lr').onchange=e=>$('#lu').value=API.on&&e.target.value!='admin'?'':e.target.value;
function showApp(U){S.user=U;S.view=U.role=='teacher'&&U.name?'teacher':'group';S.sel=U.name&&U.role=='teacher'?U.name:U.group||'';S.q='';
 $('#pw').classList.toggle('hide',!API.on&&U.role!='admin');$('#pw .hm').textContent=API.on?'เปลี่ยนรหัสผ่าน':'รหัสแอดมิน';$('#sync').classList.toggle('hide',!API.on);
 S.tab=roles[U.role][0][0];$('#login').classList.add('hide');$('#app').classList.remove('hide');$('#bot').classList.remove('hide');
 $('#who').textContent={admin:'แอดมิน',teacher:'ครู',student:'นักเรียน'}[U.role]+(U.name?' · '+U.name:'');$('#le').textContent='';render()}
async function enterServer(u){API.user=u;await API.load();
 showApp({role:u.role,name:u.role=='teacher'?(u.teacher_name||u.display_name):u.role=='student'?u.display_name:null,group:u.group_name||undefined});
 if(u.must_change)openPw(true)}
$('#lb').onclick=async()=>{const r=$('#lr').value,un=$('#lu').value.trim(),pw=$('#lp').value;
 if(API.on){const b=$('#lb');b.disabled=true;try{const j=await API.call('POST','login',{role:r,username:un,password:pw});$('#lp').value='';await enterServer(j.user)}
  catch(e){$('#lok').classList.add('hide');$('#le').textContent=e.status==401?'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง ตรวจบทบาทที่เลือกและลองอีกครั้ง':e.status?e.message:'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง'}finally{b.disabled=false}return}
 const U=authz(r,un,pw);if(U)showApp(U);else $('#le').textContent='ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง ตรวจบทบาทที่เลือกและลองอีกครั้ง'};
$('#lp').onkeydown=e=>{if(e.key=='Enter')$('#lb').click()};
$('#lo').onclick=async()=>{if(API.on){try{if(API.dirty)await API.chain;await API.call('POST','logout')}catch(e){}API.user=null;API.last=null;S.data=null;S.tt=null;S.raw={};S.blocks=[];S.stage=null}
 S.user=null;$('#app').classList.add('hide');$('#bot').classList.add('hide');$('#login').classList.remove('hide');$('#lp').value='';$('#lok').classList.add('hide');if(API.on)loadSignup()};
let pwForced=false;
function openPw(force){pwForced=!!force;['p0','p1','p2'].forEach(i=>$('#'+i).value='');$('#pm').textContent=force?'เพื่อความปลอดภัย กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งาน':'';$('#pc').classList.toggle('hide',pwForced);$('#pd').classList.remove('hide');setTimeout(()=>$('#p0').focus(),30)}
$('#pw').onclick=()=>openPw(false);
$('#pc').onclick=()=>{if(!pwForced)$('#pd').classList.add('hide')};
$('#ps').onclick=async()=>{const m=$('#pm'),o=$('#p0').value,n=$('#p1').value;if(n.length<6){m.textContent='รหัสใหม่ต้องมีอย่างน้อย 6 ตัวอักษร';return}if(n!=$('#p2').value){m.textContent='ยืนยันรหัสไม่ตรงกัน';return}
 if(API.on){try{await API.call('POST','password',{old:o,new:n});if(API.user)API.user.must_change=false;pwForced=false;$('#pd').classList.add('hide');toast('เปลี่ยนรหัสผ่านแล้ว')}catch(e){m.textContent=e.message}return}
 if(!admOk(o)){m.textContent='รหัสปัจจุบันไม่ถูกต้อง';return}try{localStorage.setItem('ttadm',H(n));$('#pd').classList.add('hide')}catch(e){m.textContent='บันทึกไม่ได้ในเบราว์เซอร์นี้'}};
// ----- สมัครสมาชิก (โหมดเซิร์ฟเวอร์) -----
const authTab=t=>{document.querySelectorAll('#atabs [data-at]').forEach(b=>{const on=b.dataset.at==t;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});$('#fin').classList.toggle('hide',t!='in');$('#fup').classList.toggle('hide',t!='up');$('#le').textContent='';$('#sue').textContent='';if(t=='up')$('#lok').classList.add('hide')};
document.querySelectorAll('#atabs [data-at]').forEach(b=>b.onclick=()=>authTab(b.dataset.at));
const suRole=()=>{const t=$('#su_role').value=='teacher';$('#su_tc').classList.toggle('hide',!t);$('#su_st').classList.toggle('hide',t)};
$('#su_role').onchange=suRole;
$('#su_sid').oninput=e=>{const u=$('#su_user');if(!u.dataset.touched)u.value=e.target.value.trim()};
$('#su_user').oninput=e=>{e.target.dataset.touched=1};
$('#su_show').onclick=()=>{const h=$('#su_pw').type=='password';['su_pw','su_pw2'].forEach(i=>$('#'+i).type=h?'text':'password');$('#su_show').textContent=h?'ซ่อน':'แสดง'};
async function loadSignup(){try{const o=await API.call('GET','signup/options');$('#atabs').classList.toggle('hide',!o.enabled);if(!o.enabled){authTab('in');return}
 const opt=(a,ph)=>`<option value="">${ph}</option>`+a.map(x=>`<option>${esc(x)}</option>`).join('');
 $('#su_group').innerHTML=o.groups.length?opt(o.groups,'— เลือกกลุ่มเรียน —'):'<option value="">ยังไม่มีรายชื่อกลุ่ม (แอดมินยังไม่นำเข้าข้อมูล)</option>';
 $('#su_teacher').innerHTML=o.teachers.length?opt(o.teachers,'— เลือกชื่อของคุณ —'):'<option value="">ยังไม่มีรายชื่อครู (แอดมินยังไม่นำเข้าข้อมูล)</option>';
 $('#su_note').textContent=o.auto_approve?'สมัครแล้วเข้าสู่ระบบได้ทันที':'หลังสมัคร แอดมินต้องอนุมัติก่อน จึงจะเข้าสู่ระบบได้';suRole()}catch(e){}}
$('#fup').onsubmit=async e=>{e.preventDefault();const er=$('#sue'),fd=Object.fromEntries(new FormData($('#fup')));er.textContent='';
 if(!String(fd.display_name||'').trim())return void(er.textContent='กรอกชื่อ-นามสกุล');
 if(fd.role=='student'&&!fd.group_name)return void(er.textContent='เลือกกลุ่มเรียน');
 if(fd.role=='teacher'&&!fd.teacher_name)return void(er.textContent='เลือกชื่อครูของคุณจากรายการ');
 if(String(fd.username||'').trim().length<3)return void(er.textContent='ชื่อผู้ใช้ต้องยาวอย่างน้อย 3 ตัว');
 if(fd.password.length<8||!/\d/.test(fd.password)||!/[A-Za-z฀-๿]/.test(fd.password))return void(er.textContent='รหัสผ่านต้องมี 8 ตัวขึ้นไป และมีทั้งตัวอักษรและตัวเลข');
 if(fd.password!==$('#su_pw2').value)return void(er.textContent='ยืนยันรหัสผ่านไม่ตรงกัน');
 if(fd.role=='teacher'){delete fd.student_id;delete fd.group_name}else delete fd.teacher_name;
 const b=$('#sub');b.disabled=true;try{const r=await API.call('POST','signup',fd);
  $('#fup').reset();delete $('#su_user').dataset.touched;suRole();authTab('in');$('#lr').value=fd.role;$('#lu').value=fd.username;$('#lp').value='';
  const ok=$('#lok');ok.textContent=r.status=='active'?'สมัครสำเร็จ เข้าสู่ระบบด้วยรหัสผ่านที่ตั้งไว้ได้เลย':'สมัครสำเร็จ รอแอดมินอนุมัติ แล้วจึงเข้าสู่ระบบด้วยชื่อผู้ใช้นี้';ok.classList.remove('hide');$('#lp').focus()}
 catch(err){er.textContent=err.message}finally{b.disabled=false}};
// เปิดผ่านเซิร์ฟเวอร์ → ใช้ฐานข้อมูล และกลับเข้าระบบอัตโนมัติถ้ายังมี session
(async()=>{if(!(await API.init()))return;S.data=null;S.tt=null;S.raw={};S.blocks=[];
 $('.demo').innerHTML='<b>โหมดเซิร์ฟเวอร์</b> ข้อมูลเก็บในฐานข้อมูล · แอดมินเริ่มต้น admin / admin (ต้องเปลี่ยนรหัสเมื่อเข้าครั้งแรก)<br>ครูใช้ teacher_id หรือชื่อครู · นักเรียนใช้รหัสนักเรียนหรือ group_id · รหัสเริ่มต้น 1234';$('#rs').classList.add('hide');loadSignup();
 try{const j=await API.call('GET','me');if(j&&j.user)await enterServer(j.user)}catch(e){}})();
const isDark=()=>{const r=document.documentElement;return r.dataset.theme=='dark'||(!r.dataset.theme&&matchMedia('(prefers-color-scheme: dark)').matches)};
const thIcon=()=>{$('#th').innerHTML=ic(isDark()?'sun':'moon')};thIcon();
$('#th').onclick=()=>{const t=isDark()?'light':'dark';document.documentElement.dataset.theme=t;try{localStorage.setItem('nt-theme',t)}catch(e){}thIcon()};
const FAQ=[
 [/ลืมรหัส|รีเซ็ตรหัส|รีเซ็ตแอดมิน|เปลี่ยนรหัส/i,'หน้าเข้าสู่ระบบกด “ลืมรหัส?” เพื่อคืนรหัสแอดมินเป็น admin/admin ข้อมูลตารางไม่ถูกลบ ถ้ายังเข้าสู่ระบบได้ แอดมินเปลี่ยนรหัสได้จากปุ่ม “รหัสแอดมิน”'],
 [/รหัสผ่าน|ล็อกอิน|เข้าสู่ระบบ|เข้าใช้งาน|บัญชี/i,'บัญชีทดลองคือ admin/admin, teacher/teacher และ student/student หลังนำเข้าข้อมูล ครูใช้ชื่อครูหรือ teacher_id กับรหัส 1234 ส่วนนักเรียนใช้รหัสนักเรียน ชื่อกลุ่มเรียน หรือ group_id กับรหัส 1234'],
 [/อัลกอริทึม|algorithm|agent|เอเจนต์|annealing|csp|ทำงานยังไง|หลักการ/i,'น้องไทม์ใช้ AI Agent แบบ Plan → Act → Check → Improve คือวิเคราะห์ข้อมูล แล้วสร้างตารางด้วย Constraint Satisfaction ร่วมกับ heuristic Most-Constrained-First หลาย seed จากนั้นตรวจ Hard 10 ข้อ ปรับ Soft 10 ข้อด้วย Simulated Annealing และเทียบผลกับ baseline ดูรายละเอียดได้ที่เมนู “แนวคิดและคู่มือ”'],
 [/เงื่อนไข|constraint|20 ข้อ|hard|soft/i,'ระบบตรวจ Hard 10 ข้อ (เช่น ครู ห้อง และกลุ่มต้องไม่ชนกัน คาบต้องครบ ห้ามจัดคาบพัก และความจุห้องต้องพอ) และวัด Soft 10 ข้อ (เช่น คาบว่าง การกระจายภาระ วิชาปฏิบัติต่อเนื่อง) ผลอยู่ที่หน้า “ภาพรวม” และ “จัดตาราง (AI)” พร้อมตารางเทียบกับ baseline'],
 [/ส่งออก|ดาวน์โหลด|xlsx|excel|pdf|output\.csv|พิมพ์/i,'เปิดเมนู “ส่งออก/เผยแพร่” เพื่อดาวน์โหลด output.csv ตามโจทย์, Excel ครบชุด, CSV, ไฟล์โปรเจกต์ (.json) หรือพิมพ์เป็น PDF ได้ทั้งทุกกลุ่ม ทุกครู ทุกห้อง หรือรายวัน และในหน้าตารางสอนยังมีปุ่ม “พิมพ์ / PDF” สำหรับตารางที่เปิดอยู่'],
 [/เผยแพร่|แชร์ตาราง|share/i,'เปิดเมนู “ส่งออก” แล้วกด “เผยแพร่ตารางล่าสุด” จากนั้นแชร์ลิงก์ให้ครูหรือนักเรียน การเผยแพร่ต้องใช้หน้าที่รองรับระบบ artifact และบัญชีที่มีสิทธิ์'],
 [/csv|นำเข้า|แม่แบบ|template|หัวคอลัมน์|ไฟล์ข้อมูล|register|student_group|timeslot|subject_id|teacher_id|json/i,'รองรับ CSV, Excel (.xlsx) และ JSON ระบบจะแสดงพรีวิวกับผลตรวจก่อนให้กดยืนยันบันทึก นำเข้าได้ 2 รูปแบบ: ชุดทั่วไปใช้ courses(code,name,group,teacher,periods,room_type), teachers(name,max_hours,unavailable), rooms(name,capacity,type), groups(name,size), students(student_id,name,group); ชุดแยกไฟล์ใช้ register(group_id,subject_id), subject(subject_id,subject_name,theory,practice), teach(teacher_id,subject_id), teacher(teacher_id,teacher_name), room(room_id,room_name), student_group(group_id,group_name,student_count), timeslot(timeslot_id,day,period,start,end) ระบบตรวจชนิดจากหัวคอลัมน์และเลือกไฟล์ได้หลายไฟล์ แม่แบบชุดทั่วไปอยู่ในเมนู “ข้อมูลและตรวจสอบ”'],
 [/ไม่สะดวก|เวลาไม่ว่าง|ไม่ว่างวัน|ไม่ว่างคาบ|ครูไม่ว่าง|unavailable/i,'ระบุเวลาในคอลัมน์ unavailable โดยใช้วันและคาบ คั่นด้วย ; เช่น จ1;จ2;พฤ3 (วันใช้ จ, อ, พ, พฤ, ศ) หมายถึงครูไม่สะดวกวันจันทร์คาบ 1 และ 2 กับวันพฤหัสคาบ 3'],
 [/ชนกัน|ทับกัน|ขัดแย้ง|ชนเวลา|collision/i,'ระบบตรวจไม่ให้ครู กลุ่มเรียน หรือห้องถูกจัดซ้อนเวลา รวมถึงตรวจเวลาที่ครูไม่สะดวก ประเภท/ความจุห้อง และคาบพัก หากมีปัญหาให้ดูตัวเลข “ความขัดแย้ง” บนหน้า “ภาพรวม”'],
 [/จัดไม่ลง|จัดไม่ได้|คาบที่จัดไม่ได้|ไม่ลงตาราง|unscheduled/i,()=>{if(!S.data)return'ยังไม่มีข้อมูลสำหรับจัดตาราง ให้นำเข้า CSV หรือเลือก “ใช้ข้อมูลตัวอย่าง” ก่อนครับ';if(!S.tt)return'ยังไม่มีผลจัดตารางล่าสุด ไปที่ “จัดตาราง” แล้วกดจัดตารางก่อนครับ';return S.tt.un.length?`ตารางล่าสุดยังจัดไม่ได้ ${S.tt.un.length} รายการ ลองตรวจผลใน “ข้อมูลและตรวจสอบ” โดยเฉพาะจำนวนคาบ ครูที่สอน กลุ่มเรียน ประเภท/ความจุห้อง และเวลาที่ไม่สะดวก`:'ตารางล่าสุดจัดได้ครบแล้ว ลองดูจำนวนคาบและความขัดแย้งในหน้า “ภาพรวม” ได้ครับ'}],
 [/เพิ่มคาบ|ลบคาบ|แก้ตาราง|แก้คาบ|บล็อกเวลา|แจ้งไม่ว่าง/i,'ในเมนู “ตารางสอน” แอดมินและครูคลิกช่องไหนก็ได้ (รวมคาบพัก) เพื่อเพิ่ม แก้ ย้าย หรือลบคาบ และเขียนข้อความอิสระ เช่น “ปิดปรับปรุงห้อง” เลือกได้ว่าห้ามจัดคาบช่วงนั้น หรือเป็นแค่หมายเหตุ และกำหนดได้ว่าใช้เฉพาะคาบ ทั้งวัน หรือทั้งสัปดาห์ นักเรียนดูได้อย่างเดียว'],
 [/ตรวจสอบ|ข้อผิดพลาด|validation|data cleansing|ข้อมูลถูกต้อง/i,'ไปที่ “ข้อมูลและตรวจสอบ” แล้วกด “ตรวจสอบข้อมูล” ระบบจะแสดงข้อผิดพลาดและคำเตือน เช่น ไม่พบครู/กลุ่มเรียน จำนวนคาบไม่ถูกต้อง หรือไม่มีห้องที่รองรับ แก้ CSV แล้วนำเข้าใหม่ก่อนจัดตาราง'],
 [/จำนวนรอบ|รอบการจัด|เพิ่มรอบ|ลองจัดหลาย/i,'ในหน้า “จัดตาราง” ปรับช่อง “จำนวนรอบ” ได้ ระบบจะลองจัดหลาย seed แล้วเลือกผลที่จัดได้มากที่สุด หากยังจัดไม่ครบ ให้ตรวจข้อมูล ห้อง และเวลาที่ไม่สะดวกก่อนเพิ่มจำนวนรอบ'],
 [/seed|สุ่ม|ผลลัพธ์เดิม/i,'Seed เดิมร่วมกับข้อมูลและจำนวนรอบเดิมจะให้ผลจัดตารางเดิม เปลี่ยน Seed เพื่อทดลองผลลัพธ์แบบอื่น'],
 [/ตารางเรียน|ดูตาราง|ตารางสอน|ตารางของฉัน/i,'เปิดเมนู “ตารางสอน” แอดมินเลือกดูตามกลุ่มเรียน ครู หรือห้องได้ ครูจะเห็นตารางของตนเอง และนักเรียนจะเห็นตารางตามกลุ่มเรียน'],
 [/ตัวอย่าง|sample|ชุดข้อมูล/i,'ในเมนู “ข้อมูลและตรวจสอบ” มีชุดข้อมูลตัวอย่าง 3 ขนาด คือ เล็ก (ชุดของการแข่งขัน 1 กลุ่ม), กลาง (6 กลุ่ม มีเวลาไม่สะดวก) และใหญ่ (24 กลุ่ม 880 คาบ ใช้ทดสอบเสถียรภาพ) กดแล้วตรวจพรีวิว กดยืนยัน จากนั้นไปที่ “จัดตาราง (AI)”'],
 [/สถานะข้อมูล|มีข้อมูลอะไร|ข้อมูลตอนนี้|มีตารางแล้วหรือยัง/i,()=>{if(!S.data)return'ตอนนี้ยังไม่มีข้อมูลในระบบ เริ่มได้ที่เมนู “ข้อมูลและตรวจสอบ”';return`ตอนนี้มี ${S.data.courses.length} รายวิชา, ${S.data.teachers.length} ครู, ${S.data.rooms.length} ห้อง และ ${S.data.groups.length} กลุ่มเรียน${S.tt?` ตารางล่าสุดจัดได้ ${S.tt.rows.length} คาบ และยังจัดไม่ได้ ${S.tt.un.length} รายการ`:'. ยังไม่มีตารางที่จัดไว้'}`}],
 [/ธีม|มืด|สว่าง/i,'ปุ่ม “ธีม” มุมขวาบนใช้สลับระหว่างโหมดมืดกับโหมดสว่าง'],
 [/วิธีใช้|วิธีจัดตาราง|ขั้นตอนจัดตาราง|จัดตารางยังไง|เริ่มต้น|เริ่มใช้|ทำยังไง|ใช้งานอย่างไร|help/i,'เริ่มจาก “ข้อมูลและตรวจสอบ” เพื่อนำเข้า CSV หรือใช้ข้อมูลตัวอย่าง จากนั้นกดตรวจสอบ แก้ข้อผิดพลาด ไปที่ “จัดตาราง” แล้วกดจัดตาราง สุดท้ายดูผลใน “ตารางสอน” หรือดาวน์โหลดจาก “ส่งออก”']
];
const BOT_FALLBACK='ขอโทษครับ ผมยังไม่มีข้อมูลพอจะตอบเรื่องนี้ได้ตรง ๆ ถ้าหมายถึงระบบตารางสอน ช่วยบอกเพิ่มว่าเป็นเรื่องนำเข้าข้อมูล จัดตาราง ดูตาราง หรือส่งออกได้ไหมครับ';
const bm=$('#bm');const say=(t,u)=>{const p=document.createElement('p');p.textContent=t;if(u)p.className='u';bm.appendChild(p);bm.scrollTop=1e9};
function answerFAQ(q){const match=FAQ.find(([pattern])=>pattern.test(q));return match?(typeof match[1]=='function'?match[1]():match[1]):null}
function botStatus(){const d=S.data;if(!d)return'ยังไม่มีข้อมูลในระบบ';return`${d.courses.length} รายวิชา, ${d.teachers.length} ครู, ${d.rooms.length} ห้อง, ${d.groups.length} กลุ่มเรียน; ${S.tt?`${S.tt.rows.length} คาบในตาราง, จัดไม่ได้ ${S.tt.un.length} รายการ`:'ยังไม่มีตารางล่าสุด'}`}
say('สวัสดีครับ ผมน้องไทม์ ถามวิธีใช้งานระบบตารางสอนได้เลย');
$('#bb').onclick=()=>{const w=$('#bw'),o=w.style.display!='block';w.style.display=o?'block':'none';$('#bb').setAttribute('aria-expanded',o);if(o)$('#bi').focus()};
$('#bi').onkeydown=e=>{if(e.key=='Enter'&&e.target.value.trim()){const q=e.target.value.trim();e.target.value='';say(q,1);const answer=answerFAQ(q);if(answer)say(answer);else llm(q)}};
async function llm(q){if(typeof claude=='undefined'){say(BOT_FALLBACK);return}const d=S.data,role=S.user?{admin:'แอดมิน',teacher:'ครู',student:'นักเรียน'}[S.user.role]:'ยังไม่เข้าสู่ระบบ',context=`สถานะระบบแบบไม่ระบุตัวบุคคล: ${botStatus()} บทบาทผู้ใช้: ${role}`;const guide=`คุณคือ “น้องไทม์” ผู้ช่วยเฉพาะทางของระบบจัดตารางสอนอัตโนมัติ ตอบภาษาไทยและตอบประเด็นที่ถามก่อน ใช้ข้อเท็จจริงจากคู่มือเท่านั้น หากข้อมูลไม่พอให้ถามกลับสั้น ๆ ห้ามเดาเมนูหรือความสามารถที่ไม่มี ห้ามขอหรือเปิดเผยรหัสผ่านและข้อมูลส่วนบุคคล ตอบไม่เกิน 3 ประโยค\\nคู่มือระบบ: เมนูมี ภาพรวม, ข้อมูลและตรวจสอบ, จัดตาราง (AI), ตารางสอน, ส่งออก/เผยแพร่, แนวคิดและคู่มือ; อัลกอริทึม: AI Agent Plan→Act→Check→Improve ใช้ CSP + Most-Constrained-First หลาย seed + Simulated Annealing ตรวจ Hard 10 ข้อ Soft 10 ข้อ เทียบ baseline; นำเข้า CSV/Excel/JSON มีพรีวิวก่อนบันทึก ชุดทั่วไป courses(code,name,group,teacher,periods,room_type), teachers(name,max_hours,unavailable), rooms(name,capacity,type), groups(name,size), students(student_id,name,group) หรือชุดแยก register, subject, teach, teacher, room, student_group, timeslot; จัดตารางโดยคำนึงถึงครู/กลุ่ม/ห้องไม่ชน เวลาไม่สะดวก และประเภท/ความจุห้อง; คาบพักกลางวันคือคาบที่ 5 (12.00–13.00); ตารางสอนดูตามกลุ่ม/ครู/ห้อง/วิชา/รายวัน ค้นหาได้ เพิ่ม/ลบคาบ แจ้งไม่ว่างได้; ส่งออก output.csv, Excel, CSV, JSON และพิมพ์ PDF.\\n${context}\\nคำถาม: ${q}`;try{const session=await claude.use('sample');if(!session){say(BOT_FALLBACK);return}const result=await session(guide);const answer=String(result&&result.text||'').trim();say(answer||BOT_FALLBACK)}catch(e){console.error('น้องไทม์ตอบคำถามไม่สำเร็จ',e);say('ตอนนี้เชื่อมต่อผู้ช่วย AI ไม่สำเร็จครับ ลองใหม่อีกครั้ง หรือถามเรื่องข้อมูล CSV, การจัดตาราง, ตารางสอน และการส่งออกได้ครับ')}}
