import os
import json
import time
import shutil
import redis as _redis
from celery import Celery
from celery.schedules import crontab
from celery.exceptions import Ignore
from core.ffmpeg_utils import extract_clean_audio, edit_and_merge_video, render_tiktok_video
from core.ai_logic import analyze_video_content
from core.vad_logic import get_voice_activity
from core.visual_logic import get_visual_signals
from core.srt_utils import generate_phrases_from_transcript, remap_edited_phrases
from observability import init_sentry
from celery.signals import worker_init
from dotenv import load_dotenv

# DB — เขียนสถานะงาน (best-effort ; ห้ามให้ DB ล้มทำงานตัดต่อพัง)
from core.database import SessionLocal
from core.models import Job

load_dotenv()


@worker_init.connect
def _sentry_worker_init(**_):
    """init Sentry เฉพาะตอน worker บูตจริง — ไม่ใช่ตอน backend import tasks (กัน double-init)"""
    init_sentry("worker")

celery_app = Celery('video_tasks', broker=os.getenv('REDIS_URL', 'redis://localhost:6379/0'))
celery_app.conf.update(
    result_backend=os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    task_track_started=True,
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    # ── Periodic cleanup (รันด้วย celery beat ที่ฝังใน worker ด้วย --beat) ──
    # ลบ job เก่าทุกวันตี 3 — ไม่ให้ดิสก์เต็ม (เดิม cleanup รันแค่ตอน API startup)
    beat_schedule={
        "cleanup-old-jobs-daily": {
            "task": "tasks.cleanup_task",
            "schedule": crontab(hour=3, minute=0),
        },
    },
)


STORAGE_DIR = "storage"
PREVIEW_FILENAME = "preview.json"
FINAL_VIDEO_NAME = "final_summary.mp4"
# marker บอกว่า job dir นี้กำลังถูกประมวลผล — cleanup จะข้าม dir ที่มี marker สด
# (กัน race ที่ cleanup ลบ dir กลางคันขณะ worker ทำงาน)
PROCESSING_MARKER = ".processing"
# ลบ job เก่ากว่ากี่วัน
JOB_RETENTION_DAYS = int(os.getenv("JOB_RETENTION_DAYS", "7"))
# marker เก่ากว่านี้ = worker น่าจะ crash ไปแล้ว → ถือว่าไม่ active (ลบ dir ได้)
STALE_MARKER_SECONDS = 6 * 3600        # 6 ชม. (นานกว่างานที่ยาวที่สุดมาก)


def _mark_processing(job_dir: str) -> None:
    """เขียน marker .processing (best-effort) ตอนเริ่ม task"""
    try:
        os.makedirs(job_dir, exist_ok=True)
        with open(os.path.join(job_dir, PROCESSING_MARKER), "w") as f:
            f.write(str(time.time()))
    except Exception as e:
        print(f"⚠️ mark_processing failed for {job_dir}: {e}")


def _clear_processing(job_dir: str) -> None:
    """ลบ marker .processing ตอน task จบ (สำเร็จหรือ fail ก็ตาม)"""
    try:
        os.remove(os.path.join(job_dir, PROCESSING_MARKER))
    except FileNotFoundError:
        pass
    except Exception as e:
        print(f"⚠️ clear_processing failed for {job_dir}: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Cooperative cancel — user กด "ยกเลิก" → ตั้ง flag ใน Redis → task abort ที่ checkpoint
# (ใช้ flag เพราะ --pool=solo revoke(terminate) ไม่ interrupt งานที่รันอยู่กลางคัน)
# ─────────────────────────────────────────────────────────────────────────────
_redis_client = _redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
CANCEL_TTL = 3600   # flag หมดอายุใน 1 ชม. (กันค้าง)


class TaskCancelled(Exception):
    """ยกที่ checkpoint เมื่อ user กด cancel — ทำให้ task หยุดอย่างสะอาด"""


def set_cancel_flag(job_id: str) -> None:
    try:
        _redis_client.setex(f"cancel:{job_id}", CANCEL_TTL, "1")
    except Exception as e:
        print(f"⚠️ set_cancel_flag failed: {e}")


def clear_cancel_flag(job_id: str) -> None:
    try:
        _redis_client.delete(f"cancel:{job_id}")
    except Exception:
        pass


def is_cancelled(job_id: str) -> bool:
    try:
        return bool(_redis_client.exists(f"cancel:{job_id}"))
    except Exception:
        return False


def _ckpt(job_id: str) -> None:
    """checkpoint — ถ้า user กด cancel ให้ abort task ที่ step boundary ถัดไป"""
    if is_cancelled(job_id):
        raise TaskCancelled("ยกเลิกโดยผู้ใช้")


# ─────────────────────────────────────────────────────────────────────────────
# DB status — อัปเดตสถานะงานในตาราง jobs (ให้หน้า "งานของฉัน" เห็นสถานะจริง)
# ─────────────────────────────────────────────────────────────────────────────
def set_job_status(job_id: str, status: str, result_path: str = None) -> None:
    """อัปเดตสถานะงานใน DB — best-effort เท่านั้น

    ครอบ try/except ทั้งก้อน: ถ้า DB ล้ม ห้ามให้งานตัดต่อ (ที่ทำเสร็จแล้ว) พังตาม
    แค่ log warning พอ · เปิด session ของตัวเอง (worker รัน --pool=solo thread เดียว ปลอดภัย)
    ถ้าไม่พบแถว (งานเก่าก่อนมีระบบ auth) → ข้ามเงียบ ๆ
    """
    db = None
    try:
        db = SessionLocal()
        job = db.query(Job).filter(Job.id == job_id).first()
        if job is None:
            return
        job.status = status
        if result_path is not None:
            job.result_path = result_path
        db.commit()
    except Exception as e:
        print(f"⚠️ set_job_status({job_id}, {status}) failed: {e}")
        if db is not None:
            try:
                db.rollback()
            except Exception:
                pass
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass


# ─────────────────────────────────────────────────────────────────────────────
# Cleanup — ลบ job dir เก่า (เรียกทั้งตอน API startup [main.py] และ periodic [beat])
# ─────────────────────────────────────────────────────────────────────────────

def _is_job_active(job_path: str) -> bool:
    """
    True ถ้า job dir มี marker .processing ที่ยัง "สด" — แปลว่า worker กำลังทำงานอยู่
    กัน cleanup ลบ dir กลางคันขณะ worker กำลังประมวลผล (race ที่เคยเจอใน log จริง)
    ถ้า marker เก่าเกิน STALE_MARKER_SECONDS ถือว่า worker crash → ลบได้
    """
    marker = os.path.join(job_path, PROCESSING_MARKER)
    try:
        if not os.path.exists(marker):
            return False
        return (time.time() - os.path.getmtime(marker)) < STALE_MARKER_SECONDS
    except OSError:
        return False


def cleanup_old_jobs() -> None:
    """ลบ folder ใน storage/ ที่เก่ากว่า JOB_RETENTION_DAYS (ข้าม job ที่กำลังประมวลผล)"""
    if not os.path.exists(STORAGE_DIR):
        return
    cutoff = time.time() - JOB_RETENTION_DAYS * 86400
    removed = 0
    skipped = 0
    for entry in os.listdir(STORAGE_DIR):
        path = os.path.join(STORAGE_DIR, entry)
        if not os.path.isdir(path):
            continue
        try:
            if os.path.getmtime(path) >= cutoff:
                continue
            # ข้าม dir ที่ worker กำลังทำงานอยู่ — อย่าลบกลางคัน
            if _is_job_active(path):
                skipped += 1
                print(f"⏭️ cleanup skipped active job: {path}")
                continue
            shutil.rmtree(path, ignore_errors=True)
            set_job_status(entry, "expired")   # ไฟล์ถูกลบแล้ว — mark row ให้ตรงความจริง
            removed += 1
        except Exception as e:
            print(f"⚠️ cleanup failed for {path}: {e}")
    if removed or skipped:
        print(f"🧹 Cleaned up {removed} old job dir(s) (>{JOB_RETENTION_DAYS} days), "
              f"skipped {skipped} active")


@celery_app.task
def cleanup_task():
    """Periodic task (beat) — เรียก cleanup_old_jobs ทุกวัน กันดิสก์เต็ม"""
    print("🧹 [beat] Running scheduled cleanup_old_jobs...")
    cleanup_old_jobs()


def _preview_path(job_dir: str) -> str:
    return os.path.join(job_dir, PREVIEW_FILENAME)


def _save_preview(job_dir: str, data: dict) -> None:
    with open(_preview_path(job_dir), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _load_preview(job_dir: str) -> dict:
    with open(_preview_path(job_dir), "r", encoding="utf-8") as f:
        return json.load(f)


# ─────────────────────────────────────────────────────────────────────────────
# TASK 1: Analyze pipeline (Whisper + Gemini)
#         - ถ้า preview_mode=True → save result + return (ไม่ render)
#         - ถ้า preview_mode=False → render ต่อทันที
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(bind=True, max_retries=3)
def process_video_task(self, job_id, video_path, user_prompt,
                       output_mode="standard", target_length=60, burn_subtitle=False,
                       preview_mode=False, preset_id="", edit_mode=None, denoise=False,
                       tiktok_fit="blur"):
    job_dir = os.path.dirname(video_path)
    audio_path = os.path.join(job_dir, "full_audio.wav")
    final_output = os.path.join(job_dir, FINAL_VIDEO_NAME)

    # full = เก็บเนื้อหาครบ | summary = สรุปให้เข้าใจครบ | hook = ไฮไลต์ดึงคนดู
    # backward compat: "short" เดิม → "summary" ; task ที่ค้างคิวก่อน deploy → เดาจาก output_mode
    if edit_mode == "short":
        edit_mode = "summary"
    if edit_mode not in ("full", "summary", "hook"):
        edit_mode = "summary" if output_mode == "tiktok" else "full"

    _mark_processing(job_dir)       # กัน cleanup ลบ dir กลางคัน
    clear_cancel_flag(job_id)       # เริ่มงานใหม่ = ล้าง flag เก่า (เผื่อ job_id ถูก reuse ตอน render)
    try:
        _ckpt(job_id)
        # ── Step 1: Extract audio ────────────────────────────────────────────
        if os.path.exists(audio_path):
            print(f"[SKIP] Audio already exists")
        else:
            self.update_state(state='PROGRESS', meta={
                'status': 'Step 1/4: Extracting audio...', 'progress': 10
            })
            extract_clean_audio(video_path, audio_path)

        # ── Step 2: VAD ───────────────────────────────────────────────────────
        _ckpt(job_id)
        self.update_state(state='PROGRESS', meta={
            'status': 'Step 2/4: Detecting voice activity...', 'progress': 25
        })
        try:
            voice_segments = get_voice_activity(audio_path, min_silence_gap=2.0)
        except Exception as vad_err:
            print(f"⚠️ VAD failed ({vad_err}), falling back")
            voice_segments = None

        # ── Step 2b: สัญญาณจากภาพ ─────────────────────────────────────────────
        # อ่านจากไฟล์วิดีโอ (ไม่ใช่ไฟล์เสียง) — เป็นข้อมูลที่หาจากเสียงไม่ได้เลย
        # คลิป 7-11 นาทีใช้ราว 14 วินาที ; get_visual_signals ไม่โยน exception อยู่แล้ว
        # แต่ครอบไว้อีกชั้นเพราะสัญญาณภาพเป็นของเสริม ห้ามทำให้ทั้งงานล้ม
        try:
            visual = get_visual_signals(video_path)
        except Exception as vis_err:
            print(f"⚠️ วิเคราะห์ภาพไม่สำเร็จ ({vis_err}) — ทำงานต่อโดยไม่มีสัญญาณภาพ")
            visual = {"scene_cuts": [], "black": [], "freeze": []}

        # ── Step 3: Whisper + Gemini ──────────────────────────────────────────
        _ckpt(job_id)
        self.update_state(state='PROGRESS', meta={
            'status': 'Step 3/4: Transcribing & AI analyzing...', 'progress': 45
        })

        def _progress(pct, msg):
            # ให้หน้าเว็บเห็นว่ายังทำงานอยู่ระหว่างถอดเสียง/AI (กันคิดว่างานค้าง)
            try:
                self.update_state(state='PROGRESS', meta={
                    'status': str(msg), 'progress': max(45, min(79, int(pct))),
                })
            except Exception:
                pass

        ai_result, transcript = analyze_video_content(
            audio_path=audio_path,
            user_prompt=user_prompt,
            voice_segments=voice_segments,
            output_mode=output_mode,
            edit_mode=edit_mode,
            target_length=target_length,
            preset_id=preset_id,
            progress_cb=_progress,
            video_path=video_path,      # ← ให้ Gemini ดูภาพจากคลิปด้วย
            visual=visual,              # ← ใช้ scene_cuts เลือกจุดดึงภาพ
        )
        if not ai_result:
            raise Exception("AI ไม่สามารถระบุช่วงที่ควรเก็บได้ — กรุณาลองใหม่")

        total_keep = sum(s["end"] - s["start"] for s in ai_result)
        print(f"\n📊 Edit Summary ({output_mode}): {len(ai_result)} segments, {total_keep:.1f}s")

        # ── บันทึก preview.json ทุกงาน — ให้ย้อนกลับมา "แก้คำบรรยาย" ได้ภายหลัง ──
        try:
            phrases = generate_phrases_from_transcript(transcript or [], ai_result)
            print(f"📝 Pre-generated {len(phrases)} subtitle phrases")
        except Exception as ph_err:
            print(f"⚠️ Phrase generation failed: {ph_err}")
            phrases = []

        _save_preview(job_dir, {
            "job_id": job_id,
            "video_path": video_path,
            "user_prompt": user_prompt,
            "output_mode": output_mode,
            "edit_mode": edit_mode,
            "target_length": target_length,
            "burn_subtitle": burn_subtitle,
            "denoise": denoise,
            "tiktok_fit": tiktok_fit,           # ← โหมดจัดเฟรม 9:16 (blur = เห็นครบ / crop = เต็มจอ)
            "segments": ai_result,
            "transcript": transcript,           # ← reuse ตอน render / re-edit (ไม่ถอดเสียงซ้ำ)
            "subtitle_phrases": phrases,        # ← phrases ที่ user แก้ได้
            "selected_segments": ai_result,     # ← selection เริ่มต้น = ช่วงที่ AI เลือก
            "visual": visual,                   # ← ขีดฉากเปลี่ยน/เฟรมดำ ให้หน้า preview วาด
            "total_keep_seconds": round(total_keep, 1),
        })

        if preview_mode:
            set_job_status(job_id, "ready")   # วิเคราะห์เสร็จ รอผู้ใช้เลือกช่วง+render
            return {
                "status": "SUCCESS",
                "progress": 100,
                "mode": "preview",
                "message": "วิเคราะห์เสร็จ — กรุณา review",
                "segments": ai_result,
                "edit_summary": {
                    "segments_kept": len(ai_result),
                    "duration_kept_seconds": round(total_keep, 1),
                }
            }

        # ── Step 4: Render ────────────────────────────────────────────────────
        _ckpt(job_id)
        self.update_state(state='PROGRESS', meta={
            'status': f'Step 4/4: Rendering ({output_mode})...', 'progress': 80
        })
        _render(video_path, ai_result, transcript, final_output, job_dir,
                output_mode, target_length, burn_subtitle, denoise=denoise,
                tiktok_fit=tiktok_fit)

        set_job_status(job_id, "done", result_path=f"{job_id}/{FINAL_VIDEO_NAME}")
        return {
            "status": "SUCCESS",
            "progress": 100,
            "mode": "final",
            "output_url": f"{job_id}/{FINAL_VIDEO_NAME}",
            "message": "ตัดต่อเสร็จเรียบร้อย!",
            "edit_summary": {
                "segments_kept": len(ai_result),
                "duration_kept_seconds": round(total_keep, 1),
                "burn_subtitle": bool(burn_subtitle),
            }
        }

    except TaskCancelled:
        print(f"🛑 [CANCELLED] job {job_id} — abort ตาม request ของผู้ใช้")
        set_job_status(job_id, "cancelled")
        self.update_state(state='REVOKED', meta={'status': 'ยกเลิกแล้ว', 'progress': 0})
        raise Ignore()

    except Exception as e:
        error_msg = str(e)
        is_503 = "503" in error_msg or "UNAVAILABLE" in error_msg
        if is_503 and self.request.retries < self.max_retries:
            wait_seconds = 30 * (2 ** self.request.retries)
            print(f"[RETRY {self.request.retries + 1}] Gemini 503 — wait {wait_seconds}s")
            raise self.retry(exc=e, countdown=wait_seconds)   # ยัง retry อยู่ ยังไม่ mark failed

        print(f"[FAILURE] {error_msg}")
        set_job_status(job_id, "failed")
        self.update_state(state='FAILURE', meta={
            'status': f'Error: {error_msg}', 'progress': 0,
            'exc_type': type(e).__name__, 'exc_message': error_msg,
        })
        raise Ignore()

    finally:
        clear_cancel_flag(job_id)
        _clear_processing(job_dir)


# ─────────────────────────────────────────────────────────────────────────────
# TASK 2: Render-only (ใช้ปริ่ม preview เพื่อ render ด้วย segments ที่ user เลือก)
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(bind=True)
def render_only_task(self, job_id, selected_segments, edited_phrases=None):
    """
    Render video จาก preview ที่ save ไว้ โดยใช้ segments ที่ user เลือก
    selected_segments: [{"start": .., "end": ..}, ...] ที่ user approve
    edited_phrases:    [{"start": .., "end": .., "text": ...}, ...] ถ้า user แก้ subtitle (optional)
    """
    job_dir = os.path.join(STORAGE_DIR, job_id)
    _mark_processing(job_dir)   # กัน cleanup ลบ dir กลางคัน
    clear_cancel_flag(job_id)
    try:
        self.update_state(state='PROGRESS', meta={'status': 'กำลังเตรียม render...', 'progress': 20})
        _ckpt(job_id)
        preview = _load_preview(job_dir)

        video_path = preview["video_path"]
        output_mode = preview["output_mode"]
        target_length = preview["target_length"]
        burn_subtitle = preview["burn_subtitle"]
        denoise = preview.get("denoise", False)
        final_output = os.path.join(job_dir, FINAL_VIDEO_NAME)

        if not selected_segments:
            raise Exception("ไม่มี segments ที่เลือก")

        _ckpt(job_id)
        self.update_state(state='PROGRESS', meta={
            'status': 'กำลัง render วิดีโอ...', 'progress': 50
        })

        # ใช้ transcript จาก preview (ไม่ต้อง re-transcribe = ประหยัดเวลา 3-5 นาที!)
        transcript = preview.get("transcript") or []

        # Clean segments (start/end only ที่ FFmpeg ต้องการ)
        clean_segs = [{"start": s["start"], "end": s["end"]} for s in selected_segments]

        # ── จำสถานะไว้ให้ย้อนกลับมาแก้ซับได้อีก ──
        preview["selected_segments"] = selected_segments
        if edited_phrases is not None:
            preview["edited_subtitle_phrases"] = edited_phrases   # raw (มี orig_start/orig_end)
        _save_preview(job_dir, preview)

        # ถ้า user แก้ subtitle → ใช้ edited phrases (remap ให้ตรง segment ที่เลือกจริง),
        # ไม่งั้น regenerate ใหม่จาก transcript + clean_segs
        final_phrases = None
        if burn_subtitle:
            if edited_phrases is not None:
                # เติมวรรคที่ user ไม่เคยเห็น ก่อน remap
                #   generate_phrases_from_transcript ทิ้งวรรคที่ไม่ทับ keep segment
                #   (srt_utils.py) → วรรคของ "ช่วงที่ AI ตัด" ไม่เคยถูกสร้าง ไม่อยู่ใน preview.json
                #   และ remap_edited_phrases filter/shift ได้อย่างเดียว สร้างใหม่ไม่ได้
                #   ⇒ ถ้า user เอาช่วงที่ถูกตัดกลับมา หรือยืดขอบออก ช่วงนั้นจะไม่มีซับแบบเงียบ ๆ
                filled = _fill_missing_phrases(edited_phrases, transcript, clean_segs)
                final_phrases = remap_edited_phrases(filled, clean_segs)
                added = len(filled) - len(edited_phrases)
                print(f"📝 Remapped {len(edited_phrases)} edited phrases"
                      f"{f' (+{added} วรรคที่เติมให้ช่วงที่เพิ่มเข้ามา)' if added else ''} → "
                      f"{len(final_phrases)} (ตรงกับ {len(clean_segs)} segment ที่เลือก)")
            else:
                # ไม่มี edit → regenerate จาก transcript + clean_segs
                final_phrases = generate_phrases_from_transcript(transcript, clean_segs)
                print(f"📝 Auto-generated {len(final_phrases)} subtitle phrases")

        # ขอบชุดนี้ผู้ใช้เห็นตัวเลขและกดยืนยันมาแล้วจากหน้า preview → ห้ามบวกเผื่อปลาย
        # ไม่งั้นไฟล์ที่ได้จะยาวกว่าที่หน้าจอบอก 0.2 วิ ต่อหนึ่งช่วง
        _render(video_path, clean_segs, transcript or [], final_output, job_dir,
                output_mode, target_length, burn_subtitle, edited_phrases=final_phrases,
                denoise=denoise, tail_pad=0.0,
                tiktok_fit=preview.get("tiktok_fit") or "blur")

        total_keep = sum(s["end"] - s["start"] for s in clean_segs)
        set_job_status(job_id, "done", result_path=f"{job_id}/{FINAL_VIDEO_NAME}")
        return {
            "status": "SUCCESS",
            "progress": 100,
            "mode": "final",
            "output_url": f"{job_id}/{FINAL_VIDEO_NAME}",
            "message": "ตัดต่อเสร็จเรียบร้อย!",
            "edit_summary": {
                "segments_kept": len(clean_segs),
                "duration_kept_seconds": round(total_keep, 1),
                "burn_subtitle": bool(burn_subtitle),
            }
        }

    except TaskCancelled:
        print(f"🛑 [RENDER CANCELLED] job {job_id}")
        set_job_status(job_id, "cancelled")
        self.update_state(state='REVOKED', meta={'status': 'ยกเลิกแล้ว', 'progress': 0})
        raise Ignore()

    except Exception as e:
        error_msg = str(e)
        print(f"[RENDER FAILURE] {error_msg}")
        set_job_status(job_id, "failed")
        self.update_state(state='FAILURE', meta={
            'status': f'Error: {error_msg}', 'progress': 0,
            'exc_type': type(e).__name__, 'exc_message': error_msg,
        })
        raise Ignore()

    finally:
        clear_cancel_flag(job_id)
        _clear_processing(job_dir)


# ─────────────────────────────────────────────────────────────────────────────
# Helper: Render branch (standard vs tiktok)
# ─────────────────────────────────────────────────────────────────────────────

def _phrase_overlaps(a: dict, b: dict, tol: float = 0.05) -> bool:
    """วรรคสองอันนี้เป็นวรรคเดียวกันไหม — เทียบบนไทม์ไลน์ต้นฉบับ (orig_start/orig_end)"""
    a0, a1 = a.get("orig_start"), a.get("orig_end")
    b0, b1 = b.get("orig_start"), b.get("orig_end")
    if a0 is None or a1 is None or b0 is None or b1 is None:
        return False
    return min(float(a1), float(b1)) - max(float(a0), float(b0)) > tol


def _fill_missing_phrases(edited_phrases: list[dict], transcript: list[dict],
                          keep_segments: list[dict]) -> list[dict]:
    """
    เติมวรรคซับที่ขาดหายให้ครบทุกช่วงที่จะ render

    ที่มา: หน้าแก้ซับได้วรรคมาจาก preview.json ซึ่งสร้างตอนที่ AI ยังเลือกช่วงชุดเดิม
    วรรคของ "ช่วงที่ AI ตัดทิ้ง" จึงไม่เคยถูกสร้าง (ถูก filter ทิ้งใน
    generate_phrases_from_transcript) พอผู้ใช้เอาช่วงนั้นกลับมา หรือยืดขอบออก
    remap_edited_phrases สร้างวรรคใหม่ให้ไม่ได้ → ช่วงนั้นจะไม่มีซับโดยไม่มี error

    วิธี: gen วรรคใหม่จาก transcript ตามช่วงที่เลือกจริง แล้วเอาเฉพาะอันที่ไม่ทับ
    วรรคที่ผู้ใช้มีอยู่แล้วมาเติม (เทียบบนไทม์ไลน์ต้นฉบับ) — ข้อความที่ผู้ใช้แก้ไว้ไม่ถูกทับ
    """
    if not transcript or not keep_segments:
        return edited_phrases
    try:
        auto = generate_phrases_from_transcript(transcript, keep_segments)
    except Exception as e:                       # ซับพังไม่ควรทำให้ render ล้ม
        print(f"⚠️ เติมวรรคซับที่ขาดไม่สำเร็จ: {e} — ใช้วรรคที่ผู้ใช้แก้อย่างเดียว")
        return edited_phrases
    missing = [a for a in auto
               if not any(_phrase_overlaps(a, e) for e in edited_phrases)]
    return edited_phrases + missing if missing else edited_phrases


def _render(video_path, segments, transcript, final_output, job_dir,
            output_mode, target_length, burn_subtitle, edited_phrases=None,
            denoise=False, tail_pad: float = 0.2, tiktok_fit: str = "blur"):
    """
    tail_pad: เผื่อปลายช่วงกันเสียงขาด (Whisper มักให้ end เร็วกว่าเสียงจริง)
    ต้องเป็น 0 เมื่อขอบมาจากผู้ใช้ผ่านหน้า preview — ดู _seg_bounds
    """
    if output_mode == "tiktok":
        render_tiktok_video(
            video_path, segments, transcript, final_output, job_dir,
            target_length=target_length, burn_subtitle=burn_subtitle,
            edited_phrases=edited_phrases, denoise=denoise, tail_pad=tail_pad,
            fit_mode=tiktok_fit,
        )
    else:
        edit_and_merge_video(
            video_path, segments, final_output, job_dir,
            transcript=transcript, burn_subtitle=burn_subtitle,
            edited_phrases=edited_phrases, denoise=denoise, tail_pad=tail_pad,
        )
