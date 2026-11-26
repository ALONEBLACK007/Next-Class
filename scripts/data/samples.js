// ---------- ชุดข้อมูลตัวอย่าง เล็ก · กลาง · ใหญ่ ----------
// ชุดเล็ก = ชุดข้อมูลตัวอย่างของการแข่งขัน (ระดับภาคตะวันออกเฉียงเหนือ) 7 ไฟล์
const SMALL_CSV={
register:`group_id,subject_id
G1,31901-2002
G1,30000-1501
G1,31901-2006
G1,31901-2010
G1,31901-2009
G1,30000-1202
G1,30000-2004
G1,31901-2013
G1,30001-1001
G1,31901-2017`,
room:`room_id,room_name
R5306,5306
R6204,6204
R6405,6405
R6201,6201
R6301,6301
R5201,5201
R6203,6203
R10401,10401
R6402,6402
R6204,6204
R6403,6403`,
student_group:`group_id,group_name,student_count,advisor
G1,ปวส2/1-IT-M6,14,"นางบังอร เลขตะระโก / นายประจิตร์ เลขตะระโก"`,
subject:`subject_id,subject_name,theory,practice,credit
30000-1202,การเขียนและการนำเสนอโครงงานภาษาอังกฤษ,0,2,1
30000-1501,สังคมไทยในยุคดิจิทัล,1,2,2
30001-1001,การเป็นผู้ประกอบการ,2,2,3
31901-2002,ระบบปฏิบัติการเครื่องแม่ข่าย,1,4,3
31901-2006,การพัฒนาซอฟต์แวร์เชิงวัตถุ,1,4,3
31901-2009,การพัฒนาไฮบริดแอปพลิเคชัน,1,4,3
31901-2010,การพัฒนาอุปกรณ์เคลื่อนที่,1,4,3
31901-2013,การประยุกต์ใช้ระบบไอโอทีในชีวิตประจำวัน,1,4,3
31901-2017,โครงงานด้านเทคโนโลยีสารสนเทศ 2,0,6,2
30000-2004,กิจกรรมองค์การวิชาชีพ,0,2,0`,
teach:`teacher_id,subject_id
T01,31901-2002
T02,30000-1501
T03,31901-2006
T04,31901-2010
T04,31901-2009
T05,31901-2009
T06,30000-1202
T07,30000-2004
T07,31901-2017
T08,31901-2013
T08,30000-2004
T09,30001-1001`,
teacher:`teacher_id,teacher_name
T01,ครูประจิตร์
T02,ครูศิริพร
T03,ครูพิชญะ
T04,ครูสุวนันท์
T05,ครูนิราชัน
T06,ครูเบญญาภา
T07,ครูบังอร
T08,ครูกรรัก
T09,ครูปรารถนา`,
timeslot:'timeslot_id,day,period,start,end\n'+['Mon','Tue','Wed','Thu','Fri'].flatMap((d,i)=>Array.from({length:12},(_,p)=>`${i*12+p+1},${d},${p+1},${7+p+1}:00,${8+p+1}:00`)).join('\n')};
function sampleSmall(){return Object.fromEntries(Object.entries(SMALL_CSV).map(([k,v])=>[k,parseCSV(v)]))}

// ชุดกลาง = รูปแบบไฟล์ทั่วไป 6 กลุ่ม มีเวลาไม่สะดวกของครู ประเภทห้อง และนักเรียน
function sampleMedium(){const g=['ปวช.1/1','ปวช.1/2','ปวช.2/1','ปวช.2/2','ปวส.1/1','ปวส.2/1'],names=['ครูสมชาย','ครูสมหญิง','ครูวิชัย','ครูมาลี','ครูประเสริฐ','ครูนภา','ครูธนา','ครูอรุณ','ครูพิมพ์','ครูกิตติ'];
 const sub=[['คณิตศาสตร์',3,'ห้องเรียน'],['ภาษาอังกฤษ',2,'ห้องเรียน'],['การเขียนโปรแกรม',4,'ห้องปฏิบัติการ'],['ฐานข้อมูล',3,'ห้องปฏิบัติการ'],['AI เบื้องต้น',3,'ห้องปฏิบัติการ'],['เครือข่าย',2,'ห้องเรียน'],['วิทยาศาสตร์',2,'ห้องเรียน']];
 const courses=[];g.forEach((x,gi)=>sub.forEach((s,si)=>courses.push({code:`C${si+1}`,name:s[0],group:x,teacher:names[(gi*2+si)%names.length],periods:s[1],room_type:s[2]})));
 const tc={};courses.forEach(c=>tc[c.teacher]=(tc[c.teacher]||0)+c.periods);
 const students=g.flatMap((x,i)=>[1,2,3].map(j=>({student_id:`6${i+1}00${j}`,name:`นักเรียน ${x} #${j}`,group:x})));
 return normalize({courses,students,teachers:names.map((n,i)=>({name:n,max_hours:Math.max(tc[n]||0,20)+2,unavailable:i%3==0?'จ1;จ2':i%3==1?'ศ7-8':''})),
  rooms:[...[1,2,3,4].map(i=>({name:'ห้อง 10'+i,capacity:40,type:'ห้องเรียน'})),...[1,2].map(i=>({name:'Lab '+i,capacity:30,type:'ห้องปฏิบัติการ'}))],groups:g.map((n,i)=>({name:n,size:20+i*2}))})}

// ชุดใหญ่ = รูปแบบไฟล์การแข่งขัน 24 กลุ่ม 4 แผนก 40 ครู 30 ห้อง (ทดสอบเสถียรภาพ)
function sampleLarge(){const R={timeslot:[],teacher:[],subject:[],teach:[],room:[],student_group:[],register:[]},days=['Mon','Tue','Wed','Thu','Fri'],dw=['mon','tue','wed','thu','fri'];
 days.forEach((d,i)=>{for(let p=1;p<=12;p++)R.timeslot.push({timeslot_id:String(i*12+p),day:d,period:String(p),start:`${7+p}:00`,end:`${8+p}:00`})});
 const shape=[[1,4],[1,4],[2,2],[1,2],[0,2],[2,0],[1,4],[1,2],[0,6],[2,1],[1,3],[0,2]];
 ['IT','ACC','MK','EL'].forEach((dp,di)=>{
  for(let t=1;t<=10;t++)R.teacher.push({teacher_id:`${dp}T${String(t).padStart(2,'0')}`,teacher_name:`ครู${dp}-${t}`,max_hours:'',unavailable:t%5==0?dw[(t+di)%5]+'1-2':''});
  shape.forEach((s,si)=>{const sid=`${dp}-${String(si+1).padStart(3,'0')}`;R.subject.push({subject_id:sid,subject_name:`${dp} วิชาที่ ${si+1}`,theory:String(s[0]),practice:String(s[1]),credit:'2',room_type:s[1]>=3?'lab':''});
   R.teach.push({teacher_id:`${dp}T${String(si%10+1).padStart(2,'0')}`,subject_id:sid},{teacher_id:`${dp}T${String((si+5)%10+1).padStart(2,'0')}`,subject_id:sid})});
  for(let g=1;g<=6;g++){const gid=`${dp}G${g}`;R.student_group.push({group_id:gid,group_name:`ปวส.${g<=3?1:2}/${(g-1)%3+1}-${dp}`,student_count:String(25+((g*7+di*3)%16)),advisor:`ครู${dp}-${g}`,unavailable:''});
   shape.forEach((s,si)=>{if((si+g)%6!=0)R.register.push({group_id:gid,subject_id:`${dp}-${String(si+1).padStart(3,'0')}`})})}});
 for(let i=1;i<=30;i++){const lab=i<=14;R.room.push({room_id:`R${100+i}`,room_name:lab?`Lab ${i}`:`ห้อง ${300+i}`,capacity:String(lab?(i%3?40:35):45),type:lab?'lab':''})}
 return R}
