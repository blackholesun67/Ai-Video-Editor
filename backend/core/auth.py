"""ระบบยืนยันตัวตน — JWT (session token ของเรา) + media token + dependency get_current_user
   การล็อกอินใช้ Google OAuth (ดู routes/auth.py) — ไม่มีรหัสผ่านให้ hash เองแล้ว"""
import os
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
import jwt

from core.database import get_db
from core.models import User

# ค่า default อ่อน ๆ ที่ห้ามใช้จริงบน production (เดาง่าย → ปลอม token ได้)
_WEAK_SECRETS = {"dev-secret-change-me-in-production", "change-me-dev-secret", ""}

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me-in-production")
JWT_ALG = "HS256"
JWT_TTL_HOURS = int(os.getenv("JWT_TTL_HOURS", "24"))
# media token: อายุสั้น ผูกกับ job เดียว — สำหรับเสิร์ฟไฟล์วิดีโอ/ดาวน์โหลด
# (<video src> กับ <a download> แนบ header Authorization ไม่ได้ ต้องส่ง token ใน query แทน)
MEDIA_TTL_HOURS = int(os.getenv("MEDIA_TTL_HOURS", "2"))

# ป้องกันเผลอ deploy ด้วย secret ตั้งต้น: ถ้า APP_ENV=production แล้วยังใช้ค่าอ่อน → หยุดทันที
# (dev ปล่อยผ่านได้ แต่เตือนดัง ๆ ให้เห็น)
if JWT_SECRET in _WEAK_SECRETS:
    if os.getenv("APP_ENV", "").lower() == "production":
        raise RuntimeError(
            "JWT_SECRET ยังเป็นค่า default ที่ไม่ปลอดภัย — ตั้ง env JWT_SECRET ให้เป็นค่าสุ่มยาว ๆ ก่อน deploy production"
        )
    print("⚠️  [auth] JWT_SECRET ยังเป็นค่า default (dev) — อย่าใช้ค่านี้บน production")


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.utcnow() + timedelta(hours=JWT_TTL_HOURS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def get_current_user(
    authorization: str = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """ตรวจ JWT จาก header Authorization: Bearer <token> → คืน User"""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="ต้องล็อกอินก่อน (ไม่มี token)")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="token หมดอายุ กรุณาล็อกอินใหม่")
    except Exception:
        raise HTTPException(status_code=401, detail="token ไม่ถูกต้อง")
    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="ไม่พบผู้ใช้")
    return user


# ── Media token — อายุสั้น ผูกกับ job เดียว (เสิร์ฟไฟล์วิดีโอ/ดาวน์โหลด) ──────────
def create_media_token(job_id: str) -> str:
    """สร้าง token อายุสั้นผูกกับ job เดียว เซ็นด้วย JWT_SECRET เดิม
    ใช้แนบใน query string ของ <video src>/<a download> ที่แนบ Bearer header ไม่ได้
    """
    payload = {
        "job_id": job_id,
        "purpose": "media",
        "exp": datetime.utcnow() + timedelta(hours=MEDIA_TTL_HOURS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def verify_media_token(token: str, job_id: str) -> bool:
    """ตรวจ media token ว่าถูกต้อง + ผูกกับ job_id นี้จริง + ยังไม่หมดอายุ + purpose ตรง
    คืน True/False (ไม่ raise) — ให้ผู้เรียกตัดสินใจ status code เอง
    """
    if not token:
        return False
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        return False
    return payload.get("purpose") == "media" and payload.get("job_id") == job_id
