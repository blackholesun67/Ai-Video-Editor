# สถาปัตยกรรมระบบ — AI Video Smart Editor

เอกสารนี้อธิบายภาพรวมทั้งระบบ: frontend, backend, database, การยืนยันตัวตน (auth),
การไหลของข้อมูล และการ deploy — สำหรับผู้พัฒนา/ผู้อ่านปริญญานิพนธ์

> เอกสารที่เกี่ยวข้อง: `README.md` (ฟีเจอร์), `CLAUDE.md` (กฎห้ามพัง+กับดัก),
> `docs/REPORT_NOTES.md` (บันทึกปริญญานิพนธ์)

---

## 1. ภาพรวมระบบ

เว็บแอปตัดต่อวิดีโออัตโนมัติด้วย AI — ผู้ใช้อัปโหลดวิดีโอ → AI (Whisper + Gemini)
วิเคราะห์และเลือกช่วงที่ควรเก็บ/ตัด → ผู้ใช้ปรับแต่งช่วง/ซับได้ → ระบบ render เป็นวิดีโอสั้น
พร้อมดาวน์โหลด · รองรับ 16:9 และ 9:16 (TikTok)

**บังคับ login ด้วย Google ก่อนใช้งาน** — แต่ละคนเห็นและจัดการเฉพาะงานของตัวเอง

---

## 2. องค์ประกอบ (Services) — Docker Compose

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  frontend   │────▶│   backend    │────▶│   postgres   │  (users, jobs)
│ React+Nginx │     │  FastAPI     │     │              │
│  :80        │◀────│  :8000       │◀────└──────────────┘
└─────────────┘     │              │     ┌──────────────┐
                    │              │────▶│    redis     │  (คิวงาน + สถานะ Celery
                    └──────┬───────┘     │              │   + OTP/cooldown เดิม)
                           │             └──────┬───────┘
                    งาน AI/render (async)       │
                           ▼                    │
                    ┌──────────────┐            │
                    │   worker     │◀───────────┘
                    │ Celery+beat  │  Whisper, Gemini, ffmpeg
                    │  (--pool=solo)│  + cleanup ทุกวันตี 3
                    └──────┬───────┘
                           ▼
                    storage/{job_id}/  (ไฟล์วิดีโอ/thumbnail/preview.json)

  adminer :8080 — เครื่องมือดู DB (dev เท่านั้น)
```

| Service | หน้าที่ | Port |
|---|---|---|
| **frontend** | React (Vite build) เสิร์ฟด้วย Nginx | 80 |
| **backend** | FastAPI — REST API + auth + เสิร์ฟไฟล์ | 8000 |
| **worker** | Celery — งาน AI/ตัดต่อ (async) + beat (cleanup) | — |
| **postgres** | ฐานข้อมูล (users, jobs) | 5432 (ภายใน) |
| **redis** | broker คิว Celery + เก็บสถานะ/progress | 6379 (ภายใน) |
| **adminer** | หน้าเว็บจัดการ DB (dev) | 8080 |

---

## 3. Tech Stack

**Frontend**
- React 19 + Vite · Tailwind CSS · lucide-react (ไอคอน)
- axios (เรียก API + interceptor จับ 401)
- Google Identity Services (GIS) — ปุ่ม Sign in with Google + One Tap

**Backend**
- FastAPI (async) + Uvicorn
- SQLAlchemy 2.0 (ORM) + psycopg2 (PostgreSQL driver)
- PyJWT (session token) · google-auth (ตรวจ Google ID token)
- slowapi + Redis (rate limit)
- Celery (งาน async) — เชื่อม worker

**AI / ประมวลผลวิดีโอ (ใน worker)**
- faster-whisper (ถอดเสียง 3 pass) · Google Gemini (เลือกช่วงตัด/แก้คำ)
- Silero VAD (แยกเสียงพูด/ดนตรี) · PyThaiNLP (ตัดคำซับไทย)
- ffmpeg (ตัด/ต่อ/เบิร์นซับ/crop 9:16/ดึง thumbnail)

**Infra**
- Docker Compose · PostgreSQL 16 · Redis

---

## 4. Database

ใช้ SQLAlchemy `Base.metadata.create_all` สร้างตารางตอน startup (ไม่มี Alembic)
เก็บ UUID เป็น `String(36)` เพื่อพกพาข้าม PostgreSQL/SQLite

### ตาราง `users`
| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | String(36) PK | UUID |
| `email` | String(255) unique, index | จาก Google (การันตีจริง) |
| `username` | String(100) | จาก Google profile |
| `password_hash` | String(255) | placeholder `"google-oauth"` (ไม่ได้ใช้ — login ด้วย Google) |
| `token_version` | Integer default 0 | เพิ่มทีละ 1 ตอน logout → เพิกถอน JWT เก่าทุกใบ |
| `created_at` | DateTime | |

### ตาราง `jobs`
| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | String(36) PK | = job_id (ชื่อโฟลเดอร์ storage) |
| `user_id` | String(36) FK→users, index | เจ้าของงาน |
| `status` | String(20) | processing / ready / done / failed / cancelled |
| `prompt` | Text | คำสั่งผู้ใช้ |
| `original_filename` | String(255) | ชื่อไฟล์ต้นฉบับ |
| `result_path` | String(500) | `{job_id}/final_summary.mp4` |
| `created_at` / `updated_at` | DateTime | |

**หลักการ:** DB เก็บ *เมทาดาทาเบา ๆ* (ใครเป็นเจ้าของ/สถานะ) — ของหนัก (วิดีโอ,
transcript, ซับ) เก็บเป็นไฟล์ใน `storage/` ; DB มีแค่ "ตัวชี้" ไปหาไฟล์

---

## 5. Storage (ไฟล์บน disk)

```
backend/storage/{job_id}/
├── {ต้นฉบับ}.mp4        ไฟล์ที่อัปโหลด
├── full_audio.wav       เสียงที่แยกออกมา
├── preview.json         transcript / segments / subtitle_phrases / visual
├── final_summary.mp4    วิดีโอผลลัพธ์ (ดาวน์โหลด)
└── thumbnail.jpg        ภาพปก (งาน done เท่านั้น — สำหรับหน้า "งานของฉัน")
```
- mount เป็น volume: `./backend/storage ↔ /app/storage`
- **cleanup:** Celery beat ลบโฟลเดอร์ + row ใน DB ที่เก่ากว่า `JOB_RETENTION_DAYS` (7 วัน)
  ทุกวันตี 3 (ข้ามงานที่กำลังประมวลผล)

---

## 6. การยืนยันตัวตน (Authentication)

Login ด้วย **Google OAuth** อย่างเดียว (ไม่มี password/OTP) — มี token 3 ชนิด:

### 6.1 Flow การ login
```
1. Frontend โหลด Client ID จาก GET /auth/config
2. ผู้ใช้กด "ดำเนินการต่อด้วย Google" (GIS) → ได้ Google ID token (credential)
3. POST /auth/google {credential}
4. Backend ตรวจ token กับ Google (เช็กลายเซ็น + aud + email_verified)
5. หา user จาก email (ไม่มี → สร้างใหม่) → คืน JWT ของเรา
6. Frontend เก็บ JWT ใน localStorage + แนบ Authorization: Bearer ทุก request
```

### 6.2 Token 3 ชนิด
| Token | ออกโดย | อายุ | ใช้ทำอะไร |
|---|---|---|---|
| **Google ID token** | Google | สั้น | ใช้ครั้งเดียวตอน login |
| **JWT session** (ของเรา) | backend | 24 ชม. | ยืนยันตัวตนทุก request (มี `sub` + `tv`) |
| **Media token** | backend | 2 ชม. | เสิร์ฟไฟล์วิดีโอ/ดาวน์โหลด (ผูก job เดียว) |

### 6.3 การเพิกถอน (logout จริง) — `token_version`
- JWT ฝัง `tv` = ค่า `users.token_version` ตอนออก token
- `get_current_user` เช็ก `tv` ใน JWT == `token_version` ใน DB ไหม (ไม่ตรง → 401)
- `POST /auth/logout` → `token_version += 1` → **JWT เก่าทุกใบใช้ไม่ได้ทันที** (ทุกอุปกรณ์)
- ไม่เพิ่ม query (get_current_user query DB อยู่แล้ว)

### 6.4 Media token — ทำไมต้องมี
`<video src>` และ `<a download>` เป็น request ตรงของเบราว์เซอร์ **แนบ header Bearer ไม่ได้**
→ ขอ media token (อายุสั้น ผูก job) ผ่าน `GET /jobs/{id}/media-token` แล้วแนบใน query
`?token=...` ของ `/media` และ `/download`

---

## 7. API Endpoints

**Auth**
| Method | Path | Guard | หมายเหตุ |
|---|---|---|---|
| GET | `/auth/config` | — | ส่ง Google Client ID (public) |
| POST | `/auth/google` | rate limit | ตรวจ Google token → คืน JWT |
| POST | `/auth/logout` | JWT | เพิกถอน token (token_version+1) |
| GET | `/auth/me` | JWT | ข้อมูล user |

**Jobs / ตัดต่อ** (ทุก endpoint เช็ก ownership — ไม่ใช่เจ้าของ = 404)
| Method | Path | Guard |
|---|---|---|
| POST | `/upload` | JWT + เขียน job row |
| GET | `/status/{job_id}` | ownership |
| GET | `/preview/{job_id}` | ownership |
| POST | `/render/{job_id}` | ownership |
| POST·GET | `/subtitle/{job_id}` | ownership |
| POST | `/cancel/{task_id}` | ownership |
| GET | `/jobs` | JWT (งานของ user) |
| GET | `/jobs/{job_id}/media-token` | ownership → คืน media token |
| GET | `/media/{job_id}/{file}` | media token + allowlist + กัน path traversal |
| GET | `/download/{job_id}` | media token |
| GET | `/health` | public |

---

## 8. Data Flow (การไหลของข้อมูล)

```
[อัปโหลด] POST /upload → เขียน job row (processing) + บันทึกไฟล์ → enqueue Celery
   │
[worker: process_video_task]
   extract audio (ffmpeg) → VAD (Silero) → Whisper 3 pass → Gemini เลือกช่วงลบ
   → invert → guard 4 ชั้น → preview.json
   │
   ├─ preview_mode → status "ready" (รอผู้ใช้เลือก)
   └─ ไม่ใช่ → render ต่อ → final_summary.mp4 + thumbnail → status "done"
   │
[หน้า preview] ผู้ใช้ปรับช่วง → POST /subtitle → [แก้ซับ] → POST /render
   │
[worker: render_only_task] ffmpeg ตัด+ต่อ+เบิร์นซับ → final_summary.mp4 + thumbnail → "done"
   │
[หน้าเสร็จ / งานของฉัน] เล่น/ดาวน์โหลดผ่าน media token
```

Frontend routing เป็น state `phase` ใน `App.jsx` (ไม่มี react-router):
`processing → preview → editing → rendering → done`

---

## 9. ความปลอดภัย (Security)

- **Ownership guard** ทุก endpoint — ตอบ 404 (ไม่ใช่ 403) กันเดาว่างานมีจริง
- **Path traversal** — upload sanitize ชื่อไฟล์ · /media ใช้ basename + commonpath + allowlist
- **JWT** ระบุ `algorithms=[HS256]` ชัด (กัน alg confusion) · เพิกถอนได้ (token_version)
- **Rate limit** (slowapi+Redis) — /upload, /render, /auth/google
- **SQL injection** — ป้องกันด้วย SQLAlchemy ORM (parameterized)
- **XSS** — React escape + sanitize ชื่อไฟล์
- **CSRF** — ไม่ applicable (ใช้ Bearer token ไม่ใช่ cookie)
- **ก่อน production:** ตั้ง `APP_ENV=production` + `JWT_SECRET` จริง + `DB_PASSWORD` จริง
  + ปิด/ไม่เปิด adminer สู่ public (เข้าผ่าน SSH tunnel)

---

## 10. Environment Variables (สำคัญ)

| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `GEMINI_API_KEYS` | คีย์ Gemini (คั่นด้วย , รองรับหลายคีย์) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `JWT_SECRET` | คีย์เซ็น JWT — **production ต้องตั้งค่าสุ่มยาว** |
| `JWT_TTL_HOURS` | อายุ JWT (default 24) |
| `APP_ENV` | `production` → บังคับ JWT_SECRET ไม่เป็นค่า default |
| `DATABASE_URL` | postgres connection (ว่าง = sqlite dev) |
| `DB_PASSWORD` | รหัส postgres |
| `REDIS_URL` | Redis connection |
| `ALLOWED_ORIGINS` | CORS โดเมนที่อนุญาต |
| `JOB_RETENTION_DAYS` | เก็บงานกี่วัน (default 7) |

---

## 11. คำแนะนำสิ่งที่ควรเพิ่ม (Roadmap)

ดูหัวข้อ "คำแนะนำเพิ่มเติม" ท้ายเอกสาร — สรุปสั้น: face-aware crop, email แจ้งเตือนงานเสร็จ,
Alembic migration, pagination หน้างานของฉัน, security headers (CSP)
