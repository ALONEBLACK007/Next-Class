# ทำงานร่วมกันใน Next Class

## 1. เข้าร่วม repo (ทำครั้งเดียว)
1. เจ้าของ repo (ALONEBLACK007) ไปที่ **Settings → Collaborators → Add people** แล้วใส่ชื่อบัญชี GitHub ของเพื่อน
2. เพื่อนเปิดอีเมลหรือ https://github.com/notifications แล้วกด **Accept invitation**
3. เพื่อนติดตั้ง [Git](https://git-scm.com/downloads) และ [Node.js 22.5+](https://nodejs.org/)
4. ดึงโค้ดลงเครื่อง:
   ```
   git clone https://github.com/ALONEBLACK007/Next-Class.git
   cd Next-Class
   node backEnd/server.js        # เปิด http://localhost:3000
   ```

## 2. วิธีทำงานแต่ละครั้ง (อย่าแก้บน main ตรงๆ)
```
git checkout main
git pull                                  # ดึงงานล่าสุดของเพื่อนก่อนเริ่ม
git checkout -b feature/ชื่องาน           # เช่น feature/export-pdf
# ... แก้โค้ด แล้วทดสอบด้วย node backEnd/server.js ...
git add .
git commit -m "อธิบายสั้นๆ ว่าแก้อะไร"
git push -u origin feature/ชื่องาน
```
จากนั้นเปิด **Pull Request** บน GitHub ให้เพื่อนอีกคนรีวิวก่อน แล้วค่อยกด Merge เข้า main

## 3. แบ่งงานตามไฟล์ (ลดการแก้ชนกัน)
| ส่วน | ไฟล์ |
|---|---|
| หน้าจอ / UI | `scripts/views/views.js`, `styles/app.css` |
| อัลกอริทึมจัดตาราง | `scripts/scheduler/scheduler.js` |
| นำเข้าและตรวจข้อมูล | `scripts/data/data.js`, `scripts/data/samples.js` |
| เข้าสู่ระบบ / แชตบอท | `scripts/auth/auth.js` |
| Backend / ฐานข้อมูล | `backEnd/server.js`, `scripts/core/api.js` |

## 4. กติกา
- **ห้าม commit ไฟล์ฐานข้อมูล** (`backEnd/data/`): มีแฮชรหัสผ่านและข้อมูลนักเรียน `.gitignore` กันไว้ให้แล้ว แต่ละคนจะมีฐานข้อมูลของตัวเองบนเครื่อง
- **ห้าม commit รหัสผ่าน โทเคน หรือไฟล์ `.env`**
- **ก่อนเปิด Pull Request:** ทดสอบอย่างน้อยหนึ่งรอบ คือ นำเข้าชุดข้อมูลเล็ก → จัดตาราง → ตรวจว่า Hard = 0 → ส่งออก output.csv
- **ถ้าเจอ conflict ตอน `git pull`:** แก้ในไฟล์ที่ git ชี้ ลบบรรทัด `<<<<<<<` `=======` `>>>>>>>` ออก แล้ว `git add` และ `git commit`
