"""การเชื่อมต่อฐานข้อมูล (SQLAlchemy) — ใช้ PostgreSQL ผ่าน DATABASE_URL
รองรับ sqlite fallback สำหรับ dev/test ที่ยังไม่มี postgres"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# ตัวอย่าง: postgresql+psycopg2://aive:pass@postgres:5432/aivideo
# ไม่ตั้ง = ใช้ sqlite ไฟล์ในเครื่อง (dev) เพื่อให้รันได้โดยไม่ต้องมี postgres
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./storage/app.db")

# sqlite ต้องปิด check_same_thread (FastAPI ใช้หลาย thread)
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    """FastAPI dependency — เปิด session ต่อ request แล้วปิดเสมอ"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
