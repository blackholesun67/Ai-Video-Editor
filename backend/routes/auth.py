"""Endpoint auth — ล็อกอินด้วย Google OAuth

flow: frontend ให้ผู้ใช้ login Google → ได้ ID token (credential) → ส่งมาที่ /auth/google
      backend ตรวจ token กับ Google → เอาอีเมล+ชื่อ → หา/สร้าง user → คืน JWT ของเรา
ที่เหลือ (JWT, ownership, media token) ใช้เหมือนเดิมทุกอย่าง
"""
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from core.database import get_db
from core.models import User
from core.schemas import GoogleAuthIn, TokenOut, UserOut, AuthConfigOut, MessageOut
from core.auth import create_token, get_current_user
from core.ratelimit import limiter

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
# user ที่มาจาก Google ไม่มีรหัสผ่าน — เก็บ placeholder ในคอลัมน์ password_hash (NOT NULL)
# ค่านี้ไม่ใช่ bcrypt hash จริง จึงไม่มีทาง login ด้วยรหัสผ่านได้ (ปลอดภัย)
GOOGLE_PLACEHOLDER_HASH = "google-oauth"
LOGIN_RATE = "20/minute"


@router.get("/config", response_model=AuthConfigOut)
def auth_config():
    """ส่ง Google Client ID ให้ frontend (public) — frontend ใช้ init ปุ่ม Sign in with Google"""
    return AuthConfigOut(google_client_id=GOOGLE_CLIENT_ID)


@router.post("/google", response_model=TokenOut)
@limiter.limit(LOGIN_RATE)
def google_login(request: Request, body: GoogleAuthIn, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID ฝั่งเซิร์ฟเวอร์")

    # ── ตรวจ ID token กับ Google (เช็กลายเซ็น + หมดอายุ + audience == client id ของเรา) ──
    try:
        info = id_token.verify_oauth2_token(
            body.credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="ยืนยันตัวตนกับ Google ไม่สำเร็จ")

    email = str(info.get("email", "")).strip().lower()
    if not email or not info.get("email_verified"):
        raise HTTPException(status_code=401, detail="อีเมล Google ยังไม่ได้ยืนยัน")

    # หา user จากอีเมล (Google การันตีว่าจริง+เป็นเจ้าของ) — ไม่มี = สร้างใหม่
    user = db.query(User).filter(User.email == email).first()
    if not user:
        username = (info.get("name") or email.split("@")[0]).strip()[:100]
        user = User(email=email, username=username, password_hash=GOOGLE_PLACEHOLDER_HASH)
        db.add(user)
        db.commit()
        db.refresh(user)

    return TokenOut(access_token=create_token(user.id, user.token_version))


@router.post("/logout", response_model=MessageOut)
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """เพิกถอน token ทั้งหมดของ user นี้ — บวก token_version → JWT เก่าทุกใบใช้ไม่ได้ทันที
    (logout ฝั่ง server จริง — ครอบทุกอุปกรณ์ ไม่ใช่แค่ลบใน browser)
    """
    user.token_version = (user.token_version or 0) + 1
    db.commit()
    return MessageOut(message="ออกจากระบบแล้ว")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
