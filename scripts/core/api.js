// ---------- เชื่อมต่อ Backend (ทำงานเมื่อเปิดผ่านเซิร์ฟเวอร์ http://… เท่านั้น) ----------
// เปิดไฟล์ HTML ตรงๆ (file://) → ใช้ localStorage แบบเดิม
const API={on:false,user:null,last:null,dirty:false,timer:null,chain:Promise.resolve()};
API.call=async(method,url,body)=>{
 const r=await fetch('api/'+url,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-NC':'1'},body:body===undefined?undefined:JSON.stringify(body)});
 let j=null;try{j=await r.json()}catch(e){}
 if(!r.ok){const e=new Error(j&&j.error||('เซิร์ฟเวอร์ตอบกลับ '+r.status));e.status=r.status;throw e}return j};
API.init=async()=>{if(!/^https?:$/.test(location.protocol))return false;try{const j=await API.call('GET','health');API.on=!!(j&&j.ok)}catch(e){API.on=false}return API.on};
API.snap=()=>({ds:JSON.stringify({data:S.data,raw:S.raw}),tt:S.tt?JSON.stringify(S.tt.rows):'null',ttAt:S.tt?String(S.tt.at||S.tt.serverId||''):'',bl:JSON.stringify(S.blocks||[]),w:JSON.stringify(S.W||null)});
API.load=async()=>{const s=await API.call('GET','state');S.data=s.data?normalize(s.data):null;S.raw=s.raw||{};S.tt=s.tt||null;S.blocks=s.blocks||[];S.W=s.W||null;S.stage=null;setSlots(S.data);API.last=API.snap();API.status('ok')};
API.status=(st,msg)=>{const el=document.getElementById('sync');if(!el)return;el.className='sync '+st;el.title=msg||'';
 el.innerHTML=st=='busy'?ic('refresh')+'<span>กำลังบันทึก…</span>':st=='err'?ic('alert')+'<span>บันทึกไม่สำเร็จ</span>':ic('database')+'<span>บันทึกบนเซิร์ฟเวอร์แล้ว</span>'};
// ส่งเฉพาะส่วนที่เปลี่ยนไปยังเซิร์ฟเวอร์ (เรียกจาก sv() ทุกครั้งที่มีการบันทึก)
function syncServer(){if(!API.on||!API.user||!API.last)return;API.dirty=true;API.status('busy');clearTimeout(API.timer);API.timer=setTimeout(()=>{API.timer=null;API.chain=API.chain.then(API.push)},350)}
API.push=async()=>{const now=API.snap(),L=API.last,role=API.user&&API.user.role;if(!role)return;
 try{
  if(now.ds!==L.ds&&role=='admin'){if(S.data){const r=await API.call('PUT','dataset',{data:S.data,raw:S.raw});if(r.accounts&&r.accounts.created)toast(`สร้างบัญชีผู้ใช้ใหม่ ${r.accounts.created} บัญชี (รหัสเริ่มต้น 1234 ต้องเปลี่ยนเมื่อเข้าครั้งแรก)`)}else await API.call('DELETE','state')}
  const sm=S.tt&&S.tt.m?{hard:S.tt.m.hard.total,placed:S.tt.m.placed,total:S.tt.m.total,cost:S.tt.m.cost}:null;
  if(now.ttAt!==L.ttAt&&role=='admin'){if(S.tt){const r=await API.call('POST','timetable',{tt:S.tt});S.tt.serverId=r.id}else if(S.data)await API.call('DELETE','timetable/active')}
  else if(now.tt!==L.tt&&S.tt)await API.call('PUT','timetable/active',{rows:S.tt.rows,m:sm,id:S.tt.serverId});
  if(now.bl!==L.bl)await API.call('PUT','notes',{blocks:S.blocks});
  if(now.w!==L.w&&role=='admin')await API.call('PUT','settings/weights',{W:S.W});
  API.last=API.snap();API.dirty=!!API.timer;if(!API.dirty)API.status('ok')}
 catch(e){if(e.status==409){try{await API.load();if(typeof render=='function'&&S.user)render()}catch(x){}toast(e.message);return}API.status('err',e.message);toast('บันทึกลงเซิร์ฟเวอร์ไม่สำเร็จ: '+e.message+(e.status==401?' — กรุณาเข้าสู่ระบบใหม่':''))}};
// กลับมาที่แท็บ → ดึงข้อมูลล่าสุด (เมื่อไม่มีงานค้าง)
document.addEventListener('visibilitychange',async()=>{if(document.visibilityState!='visible'||!API.on||!API.user||API.dirty||S.run||S.stage)return;
 try{const before=API.snap();await API.load();if(JSON.stringify(API.last)!==JSON.stringify(before))render()}catch(e){}});
