import os
import re
import json
import uuid
import shutil
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from celery.result import AsyncResult

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from pydantic import BaseModel
from core.srt_utils import generate_phrases_from_transcript, apply_saved_edits
from tasks import (
    process_video_task, render_only_task, cleanup_old_jobs,
    celery_app, set_cancel_flag,
)
from observability import init_sentry

# ── Auth + Database ──
from core.database import Base, engine
from core import models  # noqa: F401  (ต้อง import เพื่อลงทะเบียนตาราง User/Job)
from core.auth import get_current_user
from routes.auth import router as auth_router

init_sentry("backend")   # เปิดเฉพาะเมื่อมี SENTRY_DSN

# ── Constants / Limits ───────────────────────────────────────────────────────
MAX_FILE_SIZE_MB = 2048               # 2GB upload limit
MAX_PROMPT_LENGTH = 2000               # 2000 chars prompt
ALLOWED_VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"}
ALLOWED_OUTPUT_MODES = {"standard", "tiktok"}   # รูปแบบ render (aspect): 16:9 / 9:16
# วิธีจัดเฟรมตอนแปลงเป็น 9:16 — blur = ย่อให้เห็นครบแล้วเติมขอบเบลอ / crop = เต็มจอ ตัดส่วนล้น
# ตั้งต้นเป็น blur เพราะคลิปไวด์ (2.35:1) ถ้า crop จะเหลือความกว้างแค่ 24% ข้อความเต็มบรรทัด
# กับภาพเทียบซ้าย-ขวาหายหมด ; ต้นฉบับที่เป็น 9:16 อยู่แล้วสองโหมดให้ผลเท่ากัน
ALLOWED_TIKTOK_FIT = {"blur", "crop"}
# วิธีตัด: full=เก็บเนื้อหาครบ / summary=สรุปให้เข้าใจครบ
# hook (ไฮไลต์) ปิดไว้ — ผลลัพธ์ยังไม่นิ่งพอ (ดู README) ; โค้ดใน ai_logic ยังอยู่ครบ
ALLOWED_EDIT_MODES = {"full", "summary"}
_EDIT_MODE_ALIASES = {                          # back-compat กับ client เก่า
    "short": "summary",
    "hook": "summary",                          # ไฮไลต์ทำผ่านหน้า preview แทน
}
MIN_TARGET_LENGTH = 10
MAX_TARGET_LENGTH = 600
# NOTE: cleanup logic (JOB_RETENTION_DAYS, marker guard) ย้ายไป tasks.py แล้ว
#       เพื่อให้ทั้ง API startup และ celery beat ใช้ตัวเดียวกัน (DRY)
UUID_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
# Render task_id format = "{uuid}-render" — รับด้วยใน /status (ของ /preview /render /download ใช้ UUID_PATTERN)
UUID_OR_TASK_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(-render)?$", re.I)
SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._\-]")

STORAGE_DIR = "storage"


def safe_filename(filename: str) -> str:
    """กรอง filename ให้ปลอดภัย — กัน path traversal และตัวอักษรพิเศษ"""
    name = os.path.basename(filename or "")    # strip directory
    name = name.lstrip(".")                     # strip leading dots
    name = SAFE_FILENAME_RE.sub("_", name)
    name = name[:200]                           # limit length
    return name or "upload.mp4"


# ── Security config (auth / rate limit / CORS) — เปิด/ปิดผ่าน env ─────────────
# API key: API_KEYS ว่าง = ปิด auth (dev). ตั้งค่า = /upload,/render ต้องมี X-API-Key ที่ถูกต้อง
API_KEYS = {k.strip() for k in os.getenv("API_KEYS", "").split(",") if k.strip()}
# CORS: ตั้ง ALLOWED_ORIGINS (คั่นด้วย ,) สำหรับ deploy โดเมนจริง — ไม่ตั้ง = localhost
_DEFAULT_ORIGINS = ("http://localhost,http://127.0.0.1,http://localhost:80,"
                    "http://127.0.0.1:80,http://localhost:5173")
# .env ที่มีบรรทัด ALLOWED_ORIGINS= (ค่าว่าง) ต้อง fallback เป็น default ไม่ใช่ list ว่าง
ALLOWED_ORIGINS = [o.strip() for o in (os.getenv("ALLOWED_ORIGINS") or _DEFAULT_ORIGINS).split(",") if o.strip()]
# Rate limit ต่อ IP (ปรับผ่าน env) — กันยิงถล่ม /upload,/render (ที่กิน GPU+โควต้า AI)
UPLOAD_RATE_LIMIT = os.getenv("UPLOAD_RATE_LIMIT", "20/hour")
RENDER_RATE_LIMIT = os.getenv("RENDER_RATE_LIMIT", "60/hour")


def _client_ip(request: Request) -> str:
    """ดึง IP จริง — รองรับหลัง reverse proxy (Caddy ใส่ X-Forwarded-For)"""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(
    key_func=_client_ip,
    storage_uri=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
)


async def require_api_key(x_api_key: str = Header(None, alias="X-API-Key")):
    """บังคับ API key เฉพาะเมื่อ API_KEYS ถูกตั้งค่า (ไม่งั้น no-op สำหรับ dev)"""
    if not API_KEYS:
        return
    if not x_api_key or x_api_key not in API_KEYS:
        raise HTTPException(status_code=401, detail="ต้องมี X-API-Key ที่ถูกต้อง")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    os.makedirs(STORAGE_DIR, exist_ok=True)
    Base.metadata.create_all(bind=engine)   # สร้างตาราง users/jobs ถ้ายังไม่มี
    cleanup_old_jobs()
    yield
    # shutdown — no-op


app = FastAPI(lifespan=lifespan)

# ── Rate limiter (slowapi + Redis) ───────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Auth routes (/auth/register, /auth/login, /auth/me) ──
app.include_router(auth_router)

# ── CORS: ตั้งจาก env (ALLOWED_ORIGINS) — deploy โดเมนจริงได้ ไม่ hardcode ──────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.mount("/storage", StaticFiles(directory=STORAGE_DIR), name="storage")


@app.post("/upload", dependencies=[Depends(require_api_key)])
@limiter.limit(UPLOAD_RATE_LIMIT)
async def upload_video(
    request: Request,
    video: UploadFile = File(...),
    prompt: str = Form(...),
    output_mode: str = Form("standard"),
    edit_mode: str = Form("full"),
    target_length: int = Form(60),
    burn_subtitle: bool = Form(False),
    preview_mode: bool = Form(False),
    preset_id: str = Form(""),
    denoise: bool = Form(False),
    tiktok_fit: str = Form("blur"),
):
    # ── Input validation ────────────────────────────────────────────────────
    prompt = (prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt ต้องไม่ว่าง")
    if len(prompt) > MAX_PROMPT_LENGTH:
        raise HTTPException(status_code=400, detail=f"prompt ยาวเกิน {MAX_PROMPT_LENGTH} ตัวอักษร")

    if output_mode not in ALLOWED_OUTPUT_MODES:
        raise HTTPException(status_code=400, detail=f"output_mode ต้องเป็น {ALLOWED_OUTPUT_MODES}")
    edit_mode = _EDIT_MODE_ALIASES.get(edit_mode, edit_mode)
    if edit_mode not in ALLOWED_EDIT_MODES:
        raise HTTPException(status_code=400, detail=f"edit_mode ต้องเป็น {ALLOWED_EDIT_MODES}")
    if not (MIN_TARGET_LENGTH <= target_length <= MAX_TARGET_LENGTH):
        raise HTTPException(
            status_code=400,
            detail=f"target_length ต้องอยู่ระหว่าง {MIN_TARGET_LENGTH}-{MAX_TARGET_LENGTH} วินาที",
        )

    fname = safe_filename(video.filename)
    ext = os.path.splitext(fname)[1].lower()
    if ext not in ALLOWED_VIDEO_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"ไฟล์ {ext} ไม่รองรับ (ต้องเป็น {ALLOWED_VIDEO_EXTS})",
        )

    if tiktok_fit not in ALLOWED_TIKTOK_FIT:
        tiktok_fit = "blur"

    print(f"DEBUG: Upload received: file={fname}, edit_mode={edit_mode}, aspect={output_mode}, "
          f"target_length={target_length}s, burn_subtitle={burn_subtitle}, denoise={denoise}")

    try:
        job_id = str(uuid.uuid4())
        job_dir = os.path.join(STORAGE_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)

        video_path = os.path.join(job_dir, fname)

        # ── Streamed write + size check (กัน DoS upload ใหญ่เกิน) ───────────
        max_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
        written = 0
        with open(video_path, "wb") as buffer:
            while True:
                chunk = await video.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                written += len(chunk)
                if written > max_bytes:
                    buffer.close()
                    shutil.rmtree(job_dir, ignore_errors=True)
                    raise HTTPException(
                        status_code=413,
                        detail=f"ไฟล์ใหญ่เกิน {MAX_FILE_SIZE_MB} MB",
                    )
                buffer.write(chunk)

        print(f"✅ File saved: {video_path} ({written / 1024 / 1024:.1f} MB)")

        process_video_task.apply_async(
            args=[job_id, video_path, prompt, output_mode, target_length, burn_subtitle,
                  preview_mode, preset_id, edit_mode, denoise, tiktok_fit],
            task_id=job_id,
        )

        return {"job_id": job_id, "preview_mode": preview_mode}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Upload error: {e}")
        raise HTTPException(status_code=500, detail="อัปโหลดล้มเหลว กรุณาลองใหม่")


@app.get("/status/{job_id}")
async def get_status(job_id: str):
    # ── Validate jobId format กัน frontend ติด PENDING บน id ไม่ถูกต้อง ─────
    # รองรับทั้ง UUID เดิม + "{uuid}-render" สำหรับ render task
    if not UUID_OR_TASK_PATTERN.match(job_id):
        raise HTTPException(status_code=400, detail="job_id ผิดรูปแบบ")

    try:
        result = AsyncResult(job_id)
        try:
            status = result.status
        except Exception:
            status = "UNKNOWN"

        response = {"status": status, "progress": 0, "result": None}

        if status == "SUCCESS":
            response["progress"] = 100
            response["result"] = result.result

        elif status == "FAILURE":
            response["progress"] = 0
            try:
                error_info = result.info
                if isinstance(error_info, Exception):
                    msg = str(error_info)
                elif isinstance(error_info, dict):
                    msg = error_info.get("status", "เกิดข้อผิดพลาด")
                else:
                    msg = "เกิดข้อผิดพลาด กรุณาลองใหม่"
            except Exception:
                msg = "เกิดข้อผิดพลาด กรุณาลองใหม่"
            # ตัด stack/Gemini detail ที่อาจมี API key หลุดได้
            if len(msg) > 300:
                msg = msg[:300] + "..."
            response["result"] = msg

        else:
            try:
                if isinstance(result.info, dict):
                    response["progress"] = result.info.get("progress", 0)
                    response["status"] = result.info.get("status", status)
            except Exception:
                pass

        return response

    except HTTPException:
        raise
    except Exception as e:
        return {"status": "FAILURE", "progress": 0, "result": f"เกิดข้อผิดพลาด: {str(e)[:200]}"}


@app.get("/download/{job_id}")
async def download_output(job_id: str):
    if not UUID_PATTERN.match(job_id):
        raise HTTPException(status_code=400, detail="job_id ผิดรูปแบบ")
    target_file = "final_summary.mp4"
    file_path = os.path.join(STORAGE_DIR, job_id, target_file)
    if os.path.exists(file_path):
        # no-store — ไฟล์ถูกเขียนทับได้เมื่อ user ย้อนกลับไปแก้ซับแล้ว render ใหม่
        return FileResponse(
            path=file_path, filename=target_file, media_type="video/mp4",
            headers={"Cache-Control": "no-store"},
        )
    raise HTTPException(status_code=404, detail="ไม่พบไฟล์วิดีโอผลลัพธ์")


MAX_SUBTITLE_PHRASES = 2000
MAX_PHRASE_TEXT_LEN = 200


class RenderRequest(BaseModel):
    segments: list[dict]   # [{"start": float, "end": float, ...}]
    edited_phrases: list[dict] | None = None  # [{"start": float, "end": float, "text": str}] (optional)


class SubtitleRequest(BaseModel):
    segments: list[dict]   # ช่วงที่ผู้ใช้เลือกไว้ตอนนี้ (ยังไม่ถูกบันทึกฝั่ง server)


def _clean_segments(segments: list[dict]) -> list[dict]:
    """Validate + ปัดเศษ segments จาก client — ครอบ float() กัน 500 ถ้า start/end ไม่ใช่ตัวเลข"""
    cleaned = []
    for s in segments:
        try:
            start = float(s.get("start", 0))
            end = float(s.get("end", 0))
        except (TypeError, ValueError):
            continue
        if end <= start:
            continue
        cleaned.append({"start": round(start, 2), "end": round(end, 2)})
    return cleaned


def _phrases_for_segments(data: dict, segments: list[dict]) -> tuple[list[dict], int]:
    """สร้างวรรคซับให้ตรงกับ segments ชุดนี้ แล้วเอาข้อความที่ผู้ใช้เคยแก้ไว้มาทับ"""
    transcript = data.get("transcript") or []
    if not transcript or not segments:
        return [], 0
    phrases = generate_phrases_from_transcript(transcript, segments)
    return apply_saved_edits(phrases, data.get("edited_subtitle_phrases") or [])


def _validate_phrases(phrases: list[dict]) -> list[dict]:
    """Validate + sanitize phrases ที่ user ส่งมาจาก /subtitle หรือ /render"""
    if len(phrases) > MAX_SUBTITLE_PHRASES:
        raise HTTPException(status_code=400, detail=f"subtitle phrases เกิน {MAX_SUBTITLE_PHRASES}")
    out = []
    for p in phrases:
        try:
            start = float(p.get("start", 0))
            end = float(p.get("end", 0))
        except (TypeError, ValueError):
            continue
        text = str(p.get("text") or "").strip()
        if not text or end <= start:
            continue
        if len(text) > MAX_PHRASE_TEXT_LEN:
            text = text[:MAX_PHRASE_TEXT_LEN]
        entry = {
            "start": round(start, 3),
            "end": round(end, 3),
            "text": text,
        }
        # เก็บเวลาในคลิปต้นฉบับต่อ (ถ้ามี) → render ใช้ remap ให้ตรง segment ที่เลือก
        for key in ("orig_start", "orig_end"):
            try:
                if p.get(key) is not None:
                    entry[key] = round(float(p[key]), 3)
            except (TypeError, ValueError):
                pass
        out.append(entry)
    return out


@app.post("/render/{job_id}", dependencies=[Depends(require_api_key)])
@limiter.limit(RENDER_RATE_LIMIT)
async def render_preview(request: Request, job_id: str, body: RenderRequest):
    """Render วิดีโอจาก preview ที่ user เลือก segments แล้ว"""
    if not UUID_PATTERN.match(job_id):
        raise HTTPException(status_code=400, detail="job_id ผิดรูปแบบ")

    preview_file = os.path.join(STORAGE_DIR, job_id, "preview.json")
    if not os.path.exists(preview_file):
        raise HTTPException(status_code=404, detail="ไม่พบ preview — ต้องเรียก /upload?preview_mode=true ก่อน")

    if not body.segments:
        raise HTTPException(status_code=400, detail="ต้องเลือก segments อย่างน้อย 1 ช่วง")

    cleaned = _clean_segments(body.segments)
    if not cleaned:
        raise HTTPException(status_code=400, detail="ไม่มี segment ที่ valid")

    # Validate edited_phrases (optional)
    edited_phrases = None
    if body.edited_phrases is not None:
        edited_phrases = _validate_phrases(body.edited_phrases)

    # ใช้ job_id เดิมเป็น task_id → frontend poll endpoint เดิมได้
    # ล้างผลลัพธ์ render รอบก่อน (กันหน้าเว็บอ่านเจอ SUCCESS เก่าตอนกด "แก้คำบรรยาย" ซ้ำ)
    new_task_id = f"{job_id}-render"
    try:
        AsyncResult(new_task_id).forget()
    except Exception as e:
        print(f"⚠️ could not forget previous render result: {e}")
    render_only_task.apply_async(
        args=[job_id, cleaned, edited_phrases],
        task_id=new_task_id,
    )
    return {"task_id": new_task_id, "job_id": job_id}


def _load_preview(job_id: str) -> dict:
    """อ่าน preview.json ของงานนี้ — 400 ถ้า job_id ผิดรูป, 404 ถ้ายังไม่มี preview"""
    if not UUID_PATTERN.match(job_id):
        raise HTTPException(status_code=400, detail="job_id ผิดรูปแบบ")
    preview_file = os.path.join(STORAGE_DIR, job_id, "preview.json")
    if not os.path.exists(preview_file):
        raise HTTPException(status_code=404, detail="ไม่พบ preview")
    with open(preview_file, "r", encoding="utf-8") as f:
        return json.load(f)


@app.post("/subtitle/{job_id}", dependencies=[Depends(require_api_key)])
def build_subtitle(job_id: str, body: SubtitleRequest):
    """
    สร้างวรรคซับให้ตรงกับ "ช่วงที่ผู้ใช้เลือกอยู่ตอนนี้" แล้วเอาข้อความที่เคยแก้ไว้มาทับ

    ทำไมต้อง POST: รายการวรรคขึ้นกับ selection ที่ยังอยู่ในหน้าเว็บ ซึ่ง server ยังไม่รู้
    (จะถูกบันทึกตอน /render เท่านั้น) — ถ้าอ่านจาก preview.json จะได้วรรคที่ผูกกับ
    ข้อเสนอของ AI ตอนวิเคราะห์ ซึ่งไม่ตรงกับสิ่งที่จะถูก render ทันทีที่ผู้ใช้แก้ selection

    เป็น def ไม่ใช่ async def → FastAPI รันใน threadpool ; การตัดคำ PyThaiNLP กิน CPU
    เป็นวินาทีสำหรับคลิปยาว ถ้ารันบน event loop จะบล็อกทุก request ที่เหลือ
    """
    data = _load_preview(job_id)
    cleaned = _clean_segments(body.segments)
    if not cleaned:
        raise HTTPException(status_code=400, detail="ไม่มี segment ที่ valid")
    phrases, applied = _phrases_for_segments(data, cleaned)
    total = sum(s["end"] - s["start"] for s in cleaned)
    print(f"📝 [SUBTITLE] {len(phrases)} วรรค สำหรับ {len(cleaned)} ช่วง ({total:.1f}s)"
          f"{f' · คงข้อความที่ผู้ใช้แก้ไว้ {applied} วรรค' if applied else ''}")
    return {"phrases": phrases}


@app.get("/subtitle/{job_id}")
def get_subtitle(job_id: str):
    """
    เวอร์ชันไม่มี selection — ใช้ช่วงที่บันทึกไว้ล่าสุด (selected_segments) เป็นตัวตั้ง

    เก็บไว้เป็น fallback เท่านั้น หน้าแก้ซับใช้ POST /subtitle เพราะรู้ selection ปัจจุบัน
    """
    data = _load_preview(job_id)
    segments = data.get("selected_segments") or data.get("segments") or []
    phrases, _ = _phrases_for_segments(data, segments)
    # transcript หาย (preview เก่า) → ตกมาใช้วรรคที่ pre-generate ไว้ตอนวิเคราะห์
    if not phrases:
        phrases = data.get("edited_subtitle_phrases") or data.get("subtitle_phrases", [])
    return {"phrases": phrases}


@app.get("/preview/{job_id}")
async def get_preview(job_id: str):
    """ดึงข้อมูล preview ที่ AI วิเคราะห์แล้ว"""
    return _load_preview(job_id)


@app.post("/cancel/{task_id}")
async def cancel_job(task_id: str):
    """
    ยกเลิกงานจริง — กัน task ที่ยังไม่เริ่ม (revoke) + ตั้ง flag ให้ task ที่รันอยู่
    abort ที่ checkpoint ถัดไป (ไม่ปล่อยให้กิน GPU ต่อ)
    """
    if not UUID_OR_TASK_PATTERN.match(task_id):
        raise HTTPException(status_code=400, detail="task_id ผิดรูปแบบ")
    # task_id ของ render = "{job_id}-render" แต่ flag/dir key ด้วย job_id
    job_id = task_id[:-7] if task_id.endswith("-render") else task_id
    try:
        celery_app.control.revoke(task_id, terminate=True, signal="SIGTERM")
    except Exception as e:
        print(f"⚠️ revoke failed: {e}")
    set_cancel_flag(job_id)
    print(f"🛑 Cancel requested: {task_id}")
    return {"cancelled": True, "task_id": task_id}


@app.get("/health")
async def health():
    """Simple health check"""
    return {"status": "ok"}
