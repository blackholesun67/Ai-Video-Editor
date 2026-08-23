# 📐 แผนพัฒนา: ระบบ Login / Register + Database

> **การตัดสินใจที่ล็อกแล้ว:** PostgreSQL (แยก container) • JWT • บังคับล็อกอินก่อนเสมอ (ไม่มี guest)

---

## 1. สถาปัตยกรรมใหม่ (ภาพรวม)

```
┌──────────────┐   1. register/login        ┌──────────────────┐
│   Frontend   │ ─────────────────────────▶ │  FastAPI Backend │
│   (React)    │   ◀── JWT token ────────── │                  │
│              │                             │  /auth/*         │
│  เก็บ token   │   2. ทุก request แนบ         │  /upload /render │──┐
│  ใน localStg │ ─── Authorization: Bearer ─▶│  /jobs /status   │  │
└──────────────┘                             └──────────────────┘  │
                                                   │   ▲           │
                              อ่าน/เขียน user+job  ▼   │ อัปเดตสถานะงาน
                                             ┌──────────────┐      │
                                             │  PostgreSQL  │◀─────┘
                                             │ users, jobs  │   ┌────────┐
                                             └──────────────┘   │ Celery │
                                                    ▲───────────│ Worker │
                                                                └────────┘
```

**หลักการ:** JWT พิสูจน์ว่า "คุณคือใคร" → ทุก endpoint รู้ `user_id` → กรอง/ผูกงานตามเจ้าของ

---

## 2. โครงสร้างฐานข้อมูล (PostgreSQL)

### ตาราง `users`
| คอลัมน์ | ชนิด | เงื่อนไข |
|---------|------|---------|
| id | UUID | PK, default gen_random_uuid() |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| username | VARCHAR(100) | NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL (bcrypt) |
| created_at | TIMESTAMP | default now() |

### ตาราง `jobs`
| คอลัมน์ | ชนิด | เงื่อนไข |
|---------|------|---------|
| id | UUID | PK (= job_id เดิม) |
| user_id | UUID | FK → users.id, NOT NULL, INDEX |
| status | VARCHAR(20) | processing / done / failed / cancelled |
| prompt | TEXT | คำสั่งผู้ใช้ |
| original_filename | VARCHAR(255) | |
| result_path | VARCHAR(500) | ที่อยู่ไฟล์ผลลัพธ์ |
| created_at | TIMESTAMP | default now() |
| updated_at | TIMESTAMP | อัปเดตเมื่อ worker เปลี่ยนสถานะ |

**ความสัมพันธ์:** 1 user → หลาย jobs (One-to-Many)

---

## 3. ขั้นตอน JWT (Auth Flow)

**สมัคร:**
```
POST /auth/register  { email, username, password }
  → ตรวจ email ซ้ำ → hash password (bcrypt) → บันทึก user → 201 Created
```

**ล็อกอิน:**
```
POST /auth/login  { email, password }
  → หา user → เทียบ hash → ถ้าผ่าน สร้าง JWT (payload: {sub: user_id, exp})
  → คืน { access_token, token_type: "bearer" }
```

**เรียก endpoint ที่ป้องกัน:**
```
GET /jobs   Header: Authorization: Bearer <token>
  → decode JWT ด้วย JWT_SECRET → ได้ user_id → โหลด user จาก DB
  → ถ้า token หมดอายุ/ผิด → 401 Unauthorized
```

---

## 4. Backend — สิ่งที่ต้องเพิ่ม/แก้

### ไลบรารีใหม่ (`requirements.txt`)
```
sqlalchemy>=2.0
psycopg2-binary        # driver PostgreSQL
passlib[bcrypt]        # hash password
pyjwt                  # สร้าง/ตรวจ JWT
pydantic[email]        # ตรวจรูปแบบ email
```

### ไฟล์ใหม่
| ไฟล์ | หน้าที่ |
|------|---------|
| `core/database.py` | engine + SessionLocal + `get_db()` dependency |
| `core/models.py` | class User, Job (SQLAlchemy ORM) |
| `core/schemas.py` | Pydantic: RegisterIn, LoginIn, UserOut, JobOut |
| `core/auth.py` | hash_password, verify_password, create_token, `get_current_user()` |
| `routes/auth.py` | `/auth/register`, `/auth/login`, `/auth/me` |

### Endpoint ใหม่
| Method | Path | หน้าที่ |
|--------|------|---------|
| POST | `/auth/register` | สมัครสมาชิก |
| POST | `/auth/login` | ล็อกอิน → คืน JWT |
| GET | `/auth/me` | ดูข้อมูลตัวเอง |
| GET | `/jobs` | **ประวัติงานของ user (กรองด้วย user_id)** |

### Endpoint เดิมที่ต้องแก้ (เพิ่ม `Depends(get_current_user)`)
| Path | เพิ่มอะไร |
|------|-----------|
| `POST /upload` | ผูก job กับ user → เขียนแถว `jobs` (user_id, status=processing) |
| `POST /render/{job_id}` | เช็ค job เป็นของ user คนนี้จริง |
| `GET /status/{job_id}` | เช็คเจ้าของ + อ่านสถานะจาก DB/Redis |
| `GET /download/{job_id}` | เช็คเจ้าของก่อนให้โหลด (กันคนอื่นแอบโหลด) |
| `GET /preview /subtitle /cancel` | เช็คเจ้าของ |

> 🔁 **สำคัญ:** `tasks.py` (worker) ต้องต่อ DB ด้วย → เมื่อทำงานเสร็จ/ล้มเหลว อัปเดต `jobs.status` + `result_path`

---

## 5. Frontend — สิ่งที่ต้องเพิ่ม (React)

| ส่วน | รายละเอียด |
|------|-----------|
| หน้า **Login** | email + password → เก็บ token |
| หน้า **Register** | email + username + password + ยืนยันรหัส |
| **AuthContext** | เก็บ token/user, ฟังก์ชัน login/logout |
| **axios interceptor** | แนบ `Authorization: Bearer` อัตโนมัติ + ถ้าเจอ 401 เด้งไป Login |
| **Protected Route** | ยังไม่ล็อกอิน → redirect `/login` |
| หน้า **งานของฉัน** | ตาราง/การ์ดจาก `GET /jobs` |
| ปุ่ม **Logout** | ลบ token → กลับหน้า Login |

---

## 6. Docker — สิ่งที่ต้องเพิ่ม

```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_USER: aive
    POSTGRES_PASSWORD: ${DB_PASSWORD}
    POSTGRES_DB: aivideo
  volumes:
    - pgdata:/var/lib/postgresql/data      # ข้อมูลถาวร ไม่หายเมื่อ down
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U aive"]

volumes:
  pgdata:
```
- `backend` และ `worker` → `depends_on: postgres (healthy)` + เพิ่ม env `DATABASE_URL`
- `.env` เพิ่ม: `DATABASE_URL=postgresql+psycopg2://aive:${DB_PASSWORD}@postgres:5432/aivideo`, `JWT_SECRET=<สุ่มยาว ๆ>`, `DB_PASSWORD=<...>`

---

## 7. ✅ Checklist ความปลอดภัย
- [ ] Hash password ด้วย **bcrypt** — ห้ามเก็บ plain text
- [ ] `JWT_SECRET` สุ่มยาว เก็บใน `.env` (gitignore แล้ว)
- [ ] Token มีวันหมดอายุ (เช่น 24 ชม.)
- [ ] Rate limit `/auth/login` (กัน brute-force) — ใช้ slowapi ที่มีอยู่
- [ ] ตรวจ email รูปแบบถูกต้อง + ไม่ซ้ำ
- [ ] เช็ค `job.user_id == current_user.id` ทุก endpoint ที่แตะงาน
- [ ] ⚠️ PDPA: มีข้อมูลส่วนบุคคลแล้ว — พิจารณานโยบายเก็บ/ลบข้อมูล

---

## 8. แผนทำเป็นเฟส (ทำทีละขั้น ทดสอบได้)

| เฟส | ทำอะไร | ทดสอบว่า |
|-----|--------|----------|
| **0** | เพิ่ม postgres container + libs + `database.py` เชื่อมต่อ | backend ต่อ DB ได้ |
| **1** | `models.py` (User, Job) + สร้างตารางตอน startup | ตารางถูกสร้างใน DB |
| **2** | `auth.py` + `routes/auth.py` (register/login/me) | สมัคร+ล็อกอินได้ ได้ token |
| **3** | ป้องกัน endpoint เดิม + ผูก job กับ user + worker อัปเดต DB | อัปโหลดแล้วมีแถวใน jobs |
| **4** | Frontend: Login/Register + token + protected route | ต้องล็อกอินก่อนใช้ |
| **5** | หน้า "งานของฉัน" (`GET /jobs`) | เห็นประวัติงานตัวเอง |
| **6** | ทดสอบครบ + security hardening | ครบ end-to-end |

---

## 9. ผลกระทบต่อของเดิม (ต้องรู้)
- flow เดิมที่ใช้ **UUID ใน localStorage ล้วน ๆ จะเลิกใช้** → เปลี่ยนเป็นผูกกับบัญชี
- ผู้ใช้เดิมที่มีงานค้าง (localStorage) จะไม่ผูกกับบัญชีใหม่ — ยอมรับได้เพราะยังเป็นช่วงพัฒนา
- ต้องรัน migration/สร้างตารางก่อนใช้งานรอบแรก
