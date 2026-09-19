"""ตาราง ORM — User (ผู้ใช้) และ Job (งานตัดต่อ ผูกกับเจ้าของ)
ใช้ String(36) เก็บ UUID เพื่อให้พกพาข้ามได้ทั้ง PostgreSQL และ sqlite"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from core.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)   # placeholder สำหรับ user Google (ไม่ได้ใช้)
    # เพิ่มทีละ 1 เมื่อ logout/เพิกถอน → token เก่าที่ tv ไม่ตรงจะใช้ไม่ได้ทันที (ทุกอุปกรณ์)
    token_version = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    jobs = relationship("Job", back_populates="user", cascade="all, delete-orphan")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True)             # = job_id (UUID เดียวกับ storage)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(20), default="processing")     # processing/done/failed/cancelled
    prompt = Column(Text, default="")
    original_filename = Column(String(255), default="")
    result_path = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="jobs")
