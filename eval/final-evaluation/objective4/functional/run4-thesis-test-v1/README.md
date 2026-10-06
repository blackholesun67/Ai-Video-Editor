# 4A รอบ thesis-test-v1 (ชุดใหม่ — ไม่ทับรอบ 822656f/e136e8a)

- โค้ดที่ทดสอบ: `4774fde` = tag `thesis-test-v1` (ตรวจ 2026-10-06 18:29 +0700 ด้วย `git describe --tags --exact-match`)
- ผู้ใช้ต้องจด: เวลาที่ rebuild container ล่าสุด (`docker compose ps` / `docker image ls`) ให้แน่ใจว่า image สร้างจาก 4774fde
- ผลรอบเดิมอยู่ที่ `../run2-post-rebuild/` (API, 2026-09-24) และ `../teammate-ui-test-2026-09-26/` (UI) — **ห้ามแก้ไฟล์ในสองโฟลเดอร์นั้น**

| ไฟล์ | เนื้อหา |
|---|---|
| `api_no_jwt_result.md` | ผลที่รันแล้ว (ไม่ต้องใช้ JWT) |
| `API-COMMANDS.md` | คำสั่งที่ผู้ทดสอบรันเองทีละขั้น (ต้องใช้ JWT ; ไม่ต้องใช้ X-API-Key) |
| `api/` | ไฟล์ดิบจาก curl/ffprobe/log ของรอบนี้ |
| `api_result.md` | ตาราง 18 ข้อ ผู้ทดสอบกรอก |
| `UI-CHECKLIST.md` | 33 ข้อเดิม + ข้อใหม่ N1–N8 ติ๊กในไฟล์นี้ได้เลย |
| `ui_screens/` | ภาพหน้าจอประกอบ (ถ้ามี) |
| `check.py` | ตัวช่วยตรวจไฟล์ JSON (ไม่เรียก API/Gemini) |

## แก้ไข 2026-10-06 (หลังรันชุด API)

- **X-API-Key ไม่ต้องใช้:** `API_KEYS=` ใน `backend/.env` (บรรทัด 35) เป็นค่าว่าง และ `docker compose exec backend printenv API_KEYS` ไม่แสดงอะไร
  → `require_api_key` (`backend/main.py:85`) ไม่ตรวจ header นี้ ; ระบบที่ทดสอบจึงป้องกันด้วย JWT อย่างเดียว
- **สาเหตุที่รายงานผิดครั้งแรก:** Claude ซ่อนค่าใน `.env` ด้วย `sed 's/=.*/=<set>/'` ซึ่งแทนทุกบรรทัดเป็น `<set>`
  **แม้ค่าว่าง** แล้วอ่านผลเป็น "ตั้งค่าไว้" โดยไม่ได้ตรวจว่ามีค่าจริง ควรใช้ `s/=..*/=<non-empty>/` (บรรทัดว่างจะคงเป็น `API_KEYS=`)
  หรือตรวจจาก container ด้วย `printenv` — แก้ใน `API-COMMANDS.md` แล้ว
- **Git Bash:** คำสั่ง `docker compose exec` ที่มี `/app/...` ต้องมี `MSYS_NO_PATHCONV=1` นำหน้า — แก้ใน `API-COMMANDS.md` แล้ว
- ผล 18 ข้อ: `api_result.md`
