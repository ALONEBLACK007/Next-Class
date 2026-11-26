// ---------- Core: ค่าคงที่ สถานะ และการบันทึก ----------
const DN=['จ','อ','พ','พฤ','ศ'],DF=['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์'];
let P=8,LUNCH=4,TIMES=null;            // จำนวนคาบ/วัน, index คาบพัก (คาบ 5 = index 4), ป้ายเวลาแต่ละคาบ
const MAXD=10;                          // เรียนไม่เกิน 10 คาบ/วัน
const DM={'จ':0,'อ':1,'พ':2,'พฤ':3,'ศ':4,mon:0,tue:1,wed:2,thu:3,fri:4};
function dayIdx(v){const s=String(v??'').trim().toLowerCase();if(!s)return -1;if(s in DM)return DM[s];if(s.slice(0,3) in DM)return DM[s.slice(0,3)];
 for(const [k,i] of [['พฤ',3],['จ',0],['อ',1],['พ',2],['ศ',4]])if(s.startsWith(k))return i;return -1}
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// ชุดไอคอนเส้น 24px stroke 1.75 (ใช้แทนอีโมจิทั้งระบบ)
const IC={check:'<path d="M20 6 9 17l-5-5"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',alert:'<path d="M10.3 3.9 2.1 18.1A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',bulb:'<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z"/>',plus:'<path d="M12 5v14M5 12h14"/>',
 trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',pencil:'<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
 note:'<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5z"/><path d="M15 3v6h6"/>',ban:'<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
 printer:'<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
 save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
 upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',sheet:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M12 13v8"/>',
 file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 14h6M9 18h4"/>',send:'<path d="m22 2-11 11M22 2l-7 20-4-9-9-4z"/>',play:'<path d="M7 4.5v15l12-7.5z"/>',
 stop:'<rect x="6" y="6" width="12" height="12" rx="1.5"/>',compass:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',cog:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
 shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',trend:'<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',chat:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
 key:'<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M15 8l2 2"/>',logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
 cup:'<path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v2M10 2v2M14 2v2"/>',calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
 chart:'<path d="M3 3v18h18M8 17v-6M13 17V7M18 17v-4"/>',sliders:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
 book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5V21h16"/>',refresh:'<path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5"/>'};
const ic=(n,c)=>`<svg class="i${c?' '+c:''}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${IC[n]||''}</svg>`;
function setSlots(d){const s=d&&d.slots;P=s&&s.P||8;LUNCH=s&&s.lunch!=null?s.lunch:4;TIMES=s&&s.times||null}
const tlabel=p=>TIMES&&TIMES[p]?TIMES[p]:`${8+p}.00–${9+p}.00`;
const slotName=s=>`${DF[Math.floor(s/P)]} คาบ ${s%P+1}`;
let S={user:null,data:null,tt:null,tab:'dash',issues:[],view:'group',sel:'',day:0,q:'',blocks:[],raw:{},stage:null,W:null,run:null};
const sv=()=>{if(typeof API!='undefined'&&API.on){syncServer();return true}try{localStorage.setItem('tt2',JSON.stringify({data:S.data,tt:S.tt,blocks:S.blocks,raw:S.raw,W:S.W,ts:Date.now()}));return true}catch(e){toast('บันทึกลงเบราว์เซอร์ไม่สำเร็จ (พื้นที่เต็มหรือถูกบล็อก)');return false}};
function toast(m){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');document.body.appendChild(t)}t.textContent=m;t.classList.add('on');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),4200)}
(function load(){let lx=null,sd=null;try{lx=JSON.parse(localStorage.getItem('tt2')||localStorage.getItem('tt1')||'null')}catch(e){}
 try{sd=JSON.parse(document.getElementById('seed').textContent||'null')}catch(e){}
 const x=sd&&(!lx||(lx.ts||0)<sd.ts)?sd:lx;
 if(x&&x.data){S.data=x.data;if(!S.data.students)S.data.students=[];S.tt=x.tt||null;S.blocks=x.blocks||[];S.raw=x.raw||{};S.W=x.W||null;setSlots(S.data)}})();
