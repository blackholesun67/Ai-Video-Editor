"""Rate limiter ที่แชร์ระหว่าง main.py และ routes/*.py (slowapi + Redis)

แยกออกมาเป็นไฟล์เดียวเพื่อไม่ให้ routes/auth.py ต้อง import main.py (จะเกิด import วงกลม
เพราะ main.py import auth_router จาก routes.auth) — limiter ตัวเดียวใช้ร่วมกันทั้งแอป
"""
import os
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def client_ip(request: Request) -> str:
    """ดึง IP จริง — รองรับหลัง reverse proxy (Caddy ใส่ X-Forwarded-For)"""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(
    key_func=client_ip,
    storage_uri=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
)

# กัน brute-force รหัสผ่านที่ /auth/login (ต่อ IP) — ปรับผ่าน env ได้
LOGIN_RATE_LIMIT = os.getenv("LOGIN_RATE_LIMIT", "10/minute")
