"""Endpoint สมัคร/ล็อกอิน/ดูข้อมูลตัวเอง"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import User
from core.schemas import RegisterIn, LoginIn, TokenOut, UserOut
from core.auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร")
    if not body.username.strip():
        raise HTTPException(status_code=400, detail="กรุณากรอกชื่อผู้ใช้")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="อีเมลนี้ถูกใช้แล้ว")
    user = User(
        email=str(body.email),
        username=body.username.strip(),
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_token(user.id))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == str(body.email)).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="อีเมลหรือรหัสผ่านไม่ถูกต้อง")
    return TokenOut(access_token=create_token(user.id))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
