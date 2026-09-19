"""Pydantic schemas — รับ/ส่งข้อมูล auth และ job"""
from datetime import datetime
from pydantic import BaseModel


class GoogleAuthIn(BaseModel):
    # credential = Google ID token (JWT) ที่ frontend ได้จาก Google Identity Services
    credential: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthConfigOut(BaseModel):
    # ส่ง Google Client ID ให้ frontend ตอนโหลดหน้า (เป็นค่า public ไม่ใช่ความลับ)
    google_client_id: str


class MessageOut(BaseModel):
    message: str


class UserOut(BaseModel):
    id: str
    email: str
    username: str

    class Config:
        from_attributes = True


class JobOut(BaseModel):
    id: str
    status: str
    prompt: str
    original_filename: str
    result_path: str
    created_at: datetime

    class Config:
        from_attributes = True
