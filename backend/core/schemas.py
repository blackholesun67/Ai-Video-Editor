"""Pydantic schemas — รับ/ส่งข้อมูล auth และ job"""
from datetime import datetime
from pydantic import BaseModel, EmailStr


class RegisterIn(BaseModel):
    email: EmailStr
    username: str
    password: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


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
