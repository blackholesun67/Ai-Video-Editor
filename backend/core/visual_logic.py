"""
วิเคราะห์ "ภาพ" ด้วย ffmpeg pass เดียว → จุดฉากเปลี่ยน / เฟรมดำ / ภาพค้าง

ทำไมถึงคุ้ม: ทั้งสามอย่างเป็นข้อมูลที่หาจากเสียงไม่ได้เลย และ ffmpeg ทำให้ฟรี ๆ
ในการ decode รอบเดียว — คลิป 7 นาที 60fps ใช้ 16 วินาที (ย่อเหลือ 320px ก่อน)

⚠️ ผลลัพธ์ของไฟล์นี้ตั้งใจให้เป็น "ข้อมูลประกอบการตัดสินใจของคน" ไม่ใช่ guard อัตโนมัติ
จุดฉากเปลี่ยนถูกส่งไปวาดเป็นขีดบนไทม์ไลน์หน้า preview และให้ปุ่มแยกช่วงดูดเข้าหา
ไม่เอาไปขยับขอบตัดเองอัตโนมัติ เพราะมันจะยิงที่เกือบทุกรอยตัด ซึ่งเป็นรูปแบบเดียวกับ
THOUGHT_GRACE ที่เคยทำเนื้อหากระโดดทั้งคลิปจนต้องปิดทิ้ง (ดูกฎข้อ 2 ใน CLAUDE.md)

ค่าคงที่ทุกตัววัดจากคลิปจริง 2 คลิปใน storage (7 นาที 60fps ตัดต่อถี่ / 11 นาที 30fps ช็อตเดียว)
"""

import os
import re
import subprocess
import time


def _env_num(name: str, default, cast):
    try:
        return cast(os.getenv(name, "") or default)
    except (TypeError, ValueError):
        return default


# ความกว้างที่ย่อก่อนวิเคราะห์ — สัญญาณทั้งสามไม่ต้องการรายละเอียด แต่ความเร็วต่างกันหลายเท่า
VISUAL_WIDTH = _env_num("VISUAL_WIDTH", 320, int)

# เกณฑ์ฉากเปลี่ยนของ scdet
# วัดจริง: ที่ 10/15/20 ได้ 12.0/11.1/10.1 จุดต่อนาที (คลิปตัดต่อถี่) และ 0.1 ทุกค่า (คลิปช็อตเดียว)
# เลือก 15 เพราะอยู่กลางช่วงที่ผลนิ่ง และทนต่อ framerate (บังคับ fps=15 แล้วจุดต่อนาทีแทบไม่ขยับ
# แม้ตัว score จะเลื่อนขึ้นเยอะ — score เทียบข้ามคลิปไม่ได้ แต่จำนวนจุดที่ได้เทียบได้)
SCENE_THRESHOLD = _env_num("VISUAL_SCENE_THRESHOLD", 15.0, float)

# จุดที่ห่างกันน้อยกว่านี้ถือเป็นจุดเดียว (fade/dissolve ทำให้ scdet ยิงติด ๆ กันหลายเฟรม)
SCENE_MIN_GAP = _env_num("VISUAL_SCENE_MIN_GAP", 0.5, float)

# เฟรมดำ: 0.3 วิ กรองแฟลชสั้น ๆ ทิ้ง แต่ยังเก็บรอยต่อจริง
# (คลิปทดสอบมีดำ 0.2/0.25/3.17 วิ — ที่ d=0.3 เหลือแต่ตัว 3.17 ซึ่งเป็นช่วงว่างจริง)
BLACK_MIN_DUR = _env_num("VISUAL_BLACK_MIN_DUR", 0.3, float)
BLACK_PIX_TH = _env_num("VISUAL_BLACK_PIX_TH", 0.10, float)

# ภาพค้าง: d=0.5 (ค่าที่คนมักใช้) หลวมเกินไปมาก — คลิปพูดหน้ากล้องได้ 29 ครั้งใน 7 นาที
# เพราะคนพูดนิ่ง ๆ ก็นับเป็นค้าง ; d=2.0 เหลือ 3 ครั้ง ซึ่งเป็นภาพค้างจริง
FREEZE_MIN_DUR = _env_num("VISUAL_FREEZE_MIN_DUR", 2.0, float)
FREEZE_NOISE = os.getenv("VISUAL_FREEZE_NOISE", "-60dB")

# กันงานค้างถ้าไฟล์ใหญ่ผิดปกติ — เกินนี้ยอมไม่มีสัญญาณภาพ ดีกว่าให้ทั้งงานค้าง
VISUAL_TIMEOUT = _env_num("VISUAL_TIMEOUT", 900, int)

_SCENE_RE = re.compile(r"lavfi\.scd\.time=([\d.]+)")
_BLACK_RE = re.compile(r"black_start:([\d.]+)\s+black_end:([\d.]+)")
_FREEZE_START_RE = re.compile(r"freeze_start:\s*([\d.]+)")
_FREEZE_END_RE = re.compile(r"freeze_end:\s*([\d.]+)")

EMPTY: dict = {"scene_cuts": [], "black": [], "freeze": []}


def _merge_close(points: list[float], min_gap: float) -> list[float]:
    """ยุบจุดที่ห่างกันน้อยกว่า min_gap ให้เหลือจุดแรกของกลุ่ม"""
    out: list[float] = []
    for p in sorted(points):
        if not out or p - out[-1] > min_gap:
            out.append(round(p, 2))
    return out


def _pair_freezes(starts: list[float], ends: list[float]) -> list[dict]:
    """
    จับคู่ freeze_start กับ freeze_end ตามลำดับเวลา

    ffmpeg พิมพ์สองบรรทัดแยกกันและบางครั้ง freeze สุดท้ายไม่มี end (คลิปจบก่อน)
    จึงจับคู่แบบเดินหน้า แล้วทิ้งตัวที่ไม่มีคู่
    """
    out: list[dict] = []
    ends = sorted(ends)
    i = 0
    for s in sorted(starts):
        while i < len(ends) and ends[i] <= s:
            i += 1
        if i < len(ends):
            out.append({"start": round(s, 2), "end": round(ends[i], 2)})
            i += 1
    return out


# ── คีย์เฟรมสำหรับส่งให้ Gemini ดู ───────────────────────────────────────────
# ความกว้างของภาพที่ส่ง — Gemini คิดโทเคนเป็นไทล์ ภาพ ~512px กินราว 258 โทเคน
KEYFRAME_WIDTH = _env_num("KEYFRAME_WIDTH", 512, int)
KEYFRAME_QUALITY = _env_num("KEYFRAME_QUALITY", 7, int)     # mjpeg -q:v (2 ดีสุด 31 แย่สุด)
KEYFRAME_MAX = _env_num("KEYFRAME_MAX", 20, int)            # เพดานจำนวนภาพต่อคลิป
# ขยับออกจากรอยต่อฉากเล็กน้อย — เฟรมตรงรอยต่อพอดีมักเป็นภาพกลาง transition/เฟรมดำ
KEYFRAME_LEAD = _env_num("KEYFRAME_LEAD", 0.5, float)
# จุดที่ห่างกันน้อยกว่านี้ถือว่าเป็นภาพเดียวกัน ไม่ต้องดึงซ้ำ
KEYFRAME_MIN_GAP = _env_num("KEYFRAME_MIN_GAP", 3.0, float)


def pick_keyframe_times(scene_cuts: list[float], duration: float,
                        max_frames: int = KEYFRAME_MAX) -> list[float]:
    """
    เลือกเวลาที่จะดึงภาพ = จุดฉากเปลี่ยน + จุดกระจายทั่วคลิป

    ทำไมต้องมีจุดกระจายด้วย: คลิปพูดหน้ากล้องช็อตเดียวมีฉากเปลี่ยน 0 จุด
    ถ้าใช้แต่ scene_cuts จะไม่ได้ภาพเลย ทั้งที่เป็นคลิปที่ควรได้ประโยชน์เหมือนกัน
    """
    if duration <= 0:
        return []
    pts = [c + KEYFRAME_LEAD for c in (scene_cuts or [])
           if 0 < c + KEYFRAME_LEAD < duration]
    n_even = min(8, max_frames)
    pts += [duration * (i + 0.5) / n_even for i in range(n_even)]

    out: list[float] = []
    for t in sorted(pts):
        if not out or t - out[-1] >= KEYFRAME_MIN_GAP:
            out.append(round(t, 2))
    if len(out) > max_frames:
        # สุ่มลงอย่างสม่ำเสมอ ไม่ตัดท้ายทิ้ง — ต้องยังครอบคลุมทั้งคลิป
        step = len(out) / max_frames
        out = [out[int(i * step)] for i in range(max_frames)]
    return out


def extract_keyframes(video_path: str, times: list[float]) -> list[dict]:
    """
    ดึงภาพนิ่งที่เวลาที่ระบุ → [{"t": วินาที, "jpeg": bytes}]

    ใช้ -ss ก่อน -i (input seeking) ซึ่งเร็วมากเพราะกระโดดไป keyframe ใกล้ ๆ เลย
    ไม่ต้อง decode ตั้งแต่ต้นคลิป ; ความคลาดเคลื่อนระดับ keyframe ยอมรับได้
    เพราะเราต้องการ "ภาพช่วงนั้นหน้าตาประมาณไหน" ไม่ได้ต้องการเฟรมเป๊ะ ๆ

    ภาพไหนดึงไม่ได้ก็ข้ามไป — ไม่โยน exception
    """
    if not video_path or not os.path.exists(video_path) or not times:
        return []
    out: list[dict] = []
    src = os.path.abspath(video_path)
    for t in times:
        cmd = ["ffmpeg", "-hide_banner", "-nostats", "-loglevel", "error",
               "-ss", f"{max(0.0, t):.2f}", "-i", src,
               "-frames:v", "1", "-vf", f"scale={KEYFRAME_WIDTH}:-2",
               "-q:v", str(KEYFRAME_QUALITY), "-f", "mjpeg", "-"]
        try:
            r = subprocess.run(cmd, capture_output=True, timeout=30)
            if r.returncode == 0 and r.stdout:
                out.append({"t": round(float(t), 2), "jpeg": r.stdout})
        except Exception:
            continue
    if out:
        kb = sum(len(f["jpeg"]) for f in out) / 1024
        print(f"🖼️ [Keyframe] ดึงภาพ {len(out)}/{len(times)} ภาพ ({kb:.0f} KB)")
    return out


def get_visual_signals(video_path: str) -> dict:
    """
    คืน {"scene_cuts": [t...], "black": [{"start","end"}...], "freeze": [...]}

    ไม่โยน exception — วิเคราะห์ภาพไม่สำเร็จต้องไม่ทำให้ทั้งงานล้ม คืน EMPTY แทน
    """
    if not video_path or not os.path.exists(video_path):
        return dict(EMPTY)

    vf = (
        f"scale={VISUAL_WIDTH}:-2,"
        f"blackdetect=d={BLACK_MIN_DUR}:pix_th={BLACK_PIX_TH},"
        f"freezedetect=n={FREEZE_NOISE}:d={FREEZE_MIN_DUR},"
        f"scdet=t={SCENE_THRESHOLD},"
        # key filter สำคัญมาก: ถ้า print ทุก key จะได้ 75,000 บรรทัดต่อคลิป 7 นาที
        # (scd.score/mafd ถูกตั้งทุกเฟรม) — ระบุ key แล้วเหลือ 160 บรรทัด
        "metadata=mode=print:key=lavfi.scd.time:file=-"
    )
    cmd = ["ffmpeg", "-hide_banner", "-nostats",
           "-i", os.path.abspath(video_path),
           "-vf", vf, "-an", "-f", "null", "-"]

    t0 = time.time()
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True,
                              errors="replace", timeout=VISUAL_TIMEOUT)
    except subprocess.TimeoutExpired:
        print(f"⚠️ [Visual] วิเคราะห์ภาพเกิน {VISUAL_TIMEOUT}s — ข้ามไป")
        return dict(EMPTY)
    except Exception as e:
        print(f"⚠️ [Visual] วิเคราะห์ภาพไม่สำเร็จ: {e} — ข้ามไป")
        return dict(EMPTY)

    # scene cut อยู่ใน stdout (metadata) ; black/freeze อยู่ใน stderr (ffmpeg log)
    scene = _merge_close(
        [float(m) for m in _SCENE_RE.findall(proc.stdout or "")], SCENE_MIN_GAP
    )
    err = proc.stderr or ""
    black = [{"start": round(float(a), 2), "end": round(float(b), 2)}
             for a, b in _BLACK_RE.findall(err)]
    freeze = _pair_freezes(
        [float(x) for x in _FREEZE_START_RE.findall(err)],
        [float(x) for x in _FREEZE_END_RE.findall(err)],
    )

    took = time.time() - t0
    print(f"🎞️ [Visual] ฉากเปลี่ยน {len(scene)} จุด · เฟรมดำ {len(black)} ช่วง · "
          f"ภาพค้าง {len(freeze)} ช่วง ({took:.1f}s)")
    return {"scene_cuts": scene, "black": black, "freeze": freeze}
