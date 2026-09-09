import subprocess
import os
import shutil
from core.srt_utils import generate_srt_from_transcript, write_srt_from_phrases

def extract_clean_audio(video_path, audio_output_path):
    """
    สกัดเสียง + ปรับคุณภาพให้ Whisper ฟังได้แม่นขึ้น:
    - afftdn:    ลด background noise (FFT denoise)
    - loudnorm:  Normalize ระดับเสียง (EBU R128 standard)
    - highpass:  ตัดเสียงต่ำ 80Hz (เสียง rumble)
    - lowpass:   ตัดเสียงสูง 12kHz (เสียง hiss)
    """
    print(f"🎬 Extracting audio (with loudness norm): {video_path} -> {audio_output_path}")
    cmd = [
        'ffmpeg', '-y',
        '-i', video_path,
        '-vn',
        '-af', 'afftdn,loudnorm=I=-16:TP=-1.5:LRA=11,highpass=f=80,lowpass=f=12000',
        '-ar', '16000',
        '-ac', '1',
        audio_output_path
    ]
    subprocess.run(cmd, check=True)

def split_video(input_path, output_dir, segment_time=900):
    """
    แบ่งวิดีโอเป็นท่อนละ 15 นาที (900s) 
    รองรับวิดีโอ 3-5 ชั่วโมง เพื่อไม่ให้ RAM ของระบบระเบิด
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    print(f"🎬 Splitting large video into segments: {input_path}")
    cmd = [
        'ffmpeg', '-y',
        '-i', input_path,
        '-f', 'segment',
        '-segment_time', str(segment_time),
        '-reset_timestamps', '1',
        '-c', 'copy',                  # ใช้ copy เพื่อความเร็วสูงสุด (ไม่ต้องเข้ารหัสใหม่)
        os.path.join(output_dir, 'chunk_%03d.mp4')
    ]
    subprocess.run(cmd, check=True)

# ─────────────────────────────────────────────────────────────────────────────
# Cut + concat helpers
#
# วิธีเดิม: ตัดทีละ part (re-encode) → concat -c copy → burn subtitle อีก pass
#   ปัญหา: เสียง AAC ของแต่ละ part มี encoder priming ~20ms ต่อรอยต่อ → เลื่อน
#          สะสมทีละ segment ทำให้ subtitle (คำนวณจาก keep_segments) หลุด sync
#          ยิ่งดูไปยิ่งเพี้ยน
#
# วิธีใหม่: trim + concat + (scale/crop) + burn subtitle ใน filter_complex pass เดียว
#   → frame-accurate, เสียง sample-accurate (ไม่มี priming สะสม),
#     subtitle อยู่บน timeline เดียวกับวิดีโอ output เป๊ะ
#   เกิน FILTERGRAPH_MAX_SEGMENTS ช่วง → fallback ไปวิธีเดิม (กัน filtergraph ใหญ่เกิน)
# ─────────────────────────────────────────────────────────────────────────────

FILTERGRAPH_MAX_SEGMENTS = int(os.getenv("FILTERGRAPH_MAX_SEGMENTS", "80"))

# ── Audio filter สำหรับเสียง output ──
# denoise=False → normalize loudness เท่านั้น (ไม่แตะ noise — เสียงพูดคงเดิม)
# denoise=True  → ลด noise ล้วน ๆ ไม่มี normalize ต่อท้าย (กันทุกความเสี่ยงที่ gain
#                  จะถูกดึงกลับขึ้นมาขยาย noise ที่เหลือ — แลกกับ output อาจเบากว่าเดิม)
#
# ใช้ loudnorm (LUFS-based) ไม่ใช่ dynaudnorm — dynaudnorm boost gain แบบ per-frame
# ทำให้ noise ในช่วงเงียบสั้น ๆ ระหว่างประโยค (ที่ VAD ไม่ตัด) ถูกขยายดังกลับขึ้นมา
# loudnorm ปรับ loudness โดยรวม ไม่มี per-frame boost → ช่วงเงียบยังเงียบ
# loudnorm แบบ single-pass เปลี่ยน sample rate/channel layout ภายใน
# → aformat บังคับ stereo + 48kHz กลับ (แก้ bug channel layout ใน FFmpeg 4.4)
_AUDIO_LOUDNORM = "loudnorm=I=-16:TP=-1.5:LRA=11,aformat=sample_fmts=fltp:channel_layouts=stereo:sample_rates=48000"
_AUDIO_NORMALIZE = _AUDIO_LOUDNORM
_AUDIO_DENOISE = "highpass=f=90,afftdn=nr=40,anlmdn=s=3,lowpass=f=10000"


def _output_audio_chain(denoise: bool = False) -> list[str]:
    """คืน list ของ audio filter สำหรับเสียง output"""
    chain = _AUDIO_DENOISE if denoise else _AUDIO_NORMALIZE
    return [chain]

_STD_SUB_STYLE = (
    "FontName=Garuda,FontSize=20,"
    "PrimaryColour=&Hffffff,OutlineColour=&H000000,"
    "Outline=1,Shadow=0,Alignment=2,MarginV=25"
)
_TIKTOK_SUB_STYLE = (
    "FontName=Garuda,FontSize=18,"
    "PrimaryColour=&Hffffff,OutlineColour=&H000000,"
    "Outline=1,Shadow=0,Alignment=2,MarginV=30"
)


def _ffprobe_value(path: str, entries: str, stream: str | None = "v:0") -> str:
    cmd = ["ffprobe", "-v", "error"]
    if stream:
        cmd += ["-select_streams", stream]
    cmd += ["-show_entries", entries, "-of", "csv=p=0", path]
    return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout.strip()


def _probe_duration(path: str) -> float:
    try:
        return float(_ffprobe_value(path, "format=duration", stream=None).split(",")[0])
    except Exception:
        return 0.0


def _probe_fps_expr(path: str, default: str = "30") -> str:
    """คืน frame rate เป็น expression สำหรับ fps filter (คง fraction ไว้ เช่น 30000/1001)"""
    try:
        raw = _ffprobe_value(path, "stream=r_frame_rate").split(",")[0].strip()
        num, den = raw.split("/")
        fps = float(num) / float(den)
        return raw if 1.0 < fps < 240.0 and float(den) != 0 else default
    except Exception:
        return default


def _has_audio(path: str) -> bool:
    try:
        return bool(_ffprobe_value(path, "stream=index", stream="a"))
    except Exception:
        return True   # เดาว่ามี — ปลอดภัยกว่า (ให้ ffmpeg จัดการเอง)


def _seg_bounds(segments, max_duration: float = 0.0,
                tail_pad: float = 0.2) -> list[tuple[float, float]]:
    """clean + clamp segment list → [(start, end)] ที่ใช้ได้จริง เรียงตามเวลา

    tail_pad: Whisper end timestamp มักจบก่อนเสียงจริง → เผื่อปลายไว้เล็กน้อย

    ⚠️ ต้องส่ง tail_pad=0 เมื่อขอบมาจากผู้ใช้ (ผ่านหน้า preview) เพราะเป็นตำแหน่ง
    ที่ตั้งใจเลือก ไม่ใช่ค่าประมาณจาก Whisper — ถ้ายังบวกอยู่ ไฟล์ที่ได้จะยาวกว่า
    ตัวเลขที่หน้าจอบอก 0.2 วิ ต่อหนึ่งช่วง (วัดจริง: 2 ช่วง → +0.38s, 1 ช่วง → +0.23s)
    """
    out = []
    for s in segments:
        st = round(max(0.0, float(s.get("start", 0) or 0)), 3)
        en = round(float(s.get("end", 0) or 0) + tail_pad, 3)
        if max_duration > 0:
            en = min(en, round(max_duration, 3))
        if en - st > 0.05:
            out.append((st, en))
    out.sort(key=lambda b: b[0])
    for i in range(len(out) - 1):
        if out[i][1] > out[i + 1][0]:
            out[i] = (out[i][0], out[i + 1][0])
    return out


def _build_trim_concat_graph(bounds, has_audio, video_chain=None,
                             subs_file=None, subs_style="", audio_chain=None):
    """
    สร้างสตริง filter_complex:
      trim ทุกช่วง → concat เป็นสตรีมเดียว → (option) video_chain + burn subtitle
      + (option) audio_chain (เช่น ลด noise) กับเสียงที่ concat แล้ว
    คืน (graph, video_map_label, audio_map_label|None)
    """
    parts = []
    for i, (st, en) in enumerate(bounds):
        parts.append(f"[0:v]trim=start={st}:end={en},setpts=PTS-STARTPTS[v{i}]")
        if has_audio:
            parts.append(f"[0:a]atrim=start={st}:end={en},asetpts=PTS-STARTPTS[a{i}]")
    n = len(bounds)
    if has_audio:
        cat_in = "".join(f"[v{i}][a{i}]" for i in range(n))
        parts.append(f"{cat_in}concat=n={n}:v=1:a=1[vcat][acat]")
    else:
        cat_in = "".join(f"[v{i}]" for i in range(n))
        parts.append(f"{cat_in}concat=n={n}:v=1:a=0[vcat]")

    # video_chain เป็น list = ฟิลเตอร์ต่อกันเป็นสายเดียว (เคสปกติ)
    # เป็น str = กราฟย่อยที่ประกาศ {IN}/{OUT} เอง — ต้องใช้เมื่อกราฟต้องแตกสาย
    # (split/overlay) ซึ่งเขียนเป็นสายเดียวไม่ได้เพราะต้องมี ";" คั่นหลายท่อน
    graph_tpl = video_chain if isinstance(video_chain, str) else None
    chain = [] if graph_tpl else list(video_chain or [])

    vlabel = "[vcat]"
    if graph_tpl:
        parts.append(graph_tpl.replace("{IN}", vlabel).replace("{OUT}", "[vfit]"))
        vlabel = "[vfit]"
    if subs_file:
        # ซับต้องเบิร์นหลังจัดเฟรมเสร็จ ไม่งั้นตัวหนังสือโดน scale/crop ตามไปด้วย
        chain.append(f"subtitles={subs_file}:force_style='{subs_style}'")
    if chain:
        parts.append(f"{vlabel}{','.join(chain)}[vout]")
        vlabel = "[vout]"

    alabel = "[acat]" if has_audio else None
    achain = [f for f in (audio_chain or []) if f]
    if has_audio and achain:
        parts.append(f"[acat]{','.join(achain)}[aout]")
        alabel = "[aout]"

    return ";".join(parts), vlabel, alabel


def _run_filtergraph_render(video_path, bounds, output_path, temp_dir,
                            video_chain=None, subs_file=None, subs_style="",
                            input_opts=None, out_opts=None, fps=None, audio_chain=None):
    """ตัด + รวม + (option) subtitle/denoise ใน ffmpeg pass เดียว — frame/sample-accurate"""
    has_audio = _has_audio(video_path)
    graph, vmap, amap = _build_trim_concat_graph(
        bounds, has_audio, video_chain=video_chain,
        subs_file=subs_file, subs_style=subs_style, audio_chain=audio_chain,
    )
    cmd = ["ffmpeg", "-y", *(input_opts or []), "-i", os.path.abspath(video_path),
           "-filter_complex", graph, "-map", vmap]
    if amap:
        cmd += ["-map", amap]
    cmd += ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23"]
    if fps:
        cmd += ["-r", str(fps)]
    if has_audio:
        cmd += ["-c:a", "aac", "-b:a", "160k"]
    cmd += ["-movflags", "+faststart", *(out_opts or []), os.path.abspath(output_path)]
    print(f"🎬 [filter_complex] {len(bounds)} segment(s), audio={has_audio} → {os.path.basename(output_path)}")
    subprocess.run(cmd, check=True, cwd=temp_dir)


def _write_subs(temp_dir, highlights, transcript, edited_phrases):
    """เขียน subs.srt → คืนชื่อไฟล์ (relative) ถ้ามี entry, ไม่งั้น None"""
    srt_path = os.path.join(temp_dir, "subs.srt")
    if edited_phrases is not None:
        count = write_srt_from_phrases(edited_phrases, srt_path)
    else:
        count = generate_srt_from_transcript(transcript, highlights, srt_path)
    if count > 0:
        print(f"📝 {count} subtitle entries → subs.srt")
        return "subs.srt"
    print("⚠️ No subtitle entries generated — skipping burn-in")
    return None


def edit_and_merge_video(video_path, highlights_json, output_path, job_dir,
                          transcript=None, burn_subtitle=False, edited_phrases=None,
                          denoise=False, tail_pad: float = 0.2):
    """
    หัวใจหลัก: ตัดวิดีโอตามช่วงที่เลือก + รวมเป็นไฟล์เดียว (มาตรฐาน 16:9)
    burn_subtitle=True → เผา subtitle ลงไปด้วย
    edited_phrases → ถ้าให้มา ใช้แทน transcript (user แก้แล้ว)
    """
    print("\n" + "=" * 50)
    print(f"🎬 STANDARD EDIT (burn_subtitle={burn_subtitle})")
    print("=" * 50 + "\n")

    if not highlights_json:
        print("⚠️ No segments. Process terminated.")
        return None

    temp_dir = os.path.abspath(os.path.join(job_dir, "temp_segments"))
    os.makedirs(temp_dir, exist_ok=True)

    bounds = _seg_bounds(highlights_json, max_duration=_probe_duration(video_path),
                         tail_pad=tail_pad)
    if not bounds:
        print("❌ No valid segments after cleanup.")
        return None
    clean_segs = [{"start": st, "end": en} for st, en in bounds]

    subs_file = None
    if burn_subtitle and (transcript or edited_phrases):
        subs_file = _write_subs(temp_dir, clean_segs, transcript, edited_phrases)

    if len(bounds) <= FILTERGRAPH_MAX_SEGMENTS:
        try:
            _run_filtergraph_render(
                video_path, bounds, output_path, temp_dir,
                video_chain=[f"fps={_probe_fps_expr(video_path)}"],
                subs_file=subs_file, subs_style=_STD_SUB_STYLE,
                audio_chain=_output_audio_chain(denoise),
            )
            print(f"🎉 STANDARD EDIT SUCCESS → {output_path}")
            _cleanup_dir(temp_dir)
            return output_path
        except subprocess.CalledProcessError as e:
            print(f"⚠️ filter_complex failed ({e}) — falling back to legacy per-part render")

    result = _legacy_edit_and_merge(video_path, bounds, output_path, temp_dir,
                                    subs_file, _STD_SUB_STYLE, denoise=denoise)
    _cleanup_dir(temp_dir)
    return result


def _legacy_edit_and_merge(video_path, bounds, output_path, temp_dir,
                           subs_file, subs_style, denoise=False):
    """วิธีเดิม (fallback): ตัดทีละ part → concat copy → burn subtitle แยก pass"""
    af = _output_audio_chain(denoise)
    af_opts = ["-af", af[0]] if af else []
    segment_list = []
    for i, (start, end) in enumerate(bounds):
        duration = end - start
        part_filename = f"part_{i}.mp4"
        print(f"✂️ [legacy] Part {i}: {start}s → {end}s ({duration:.2f}s)")
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start), "-t", str(duration), "-i", video_path,
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            *af_opts,
            "-c:a", "aac", "-b:a", "128k",
            os.path.abspath(os.path.join(temp_dir, part_filename)),
        ]
        subprocess.run(cmd, check=True)
        segment_list.append(f"file '{part_filename}'")

    if not segment_list:
        print("❌ No valid segments were created.")
        return None

    merged_path = os.path.abspath(os.path.join(temp_dir, "_merged.mp4"))
    if len(segment_list) == 1:
        shutil.move(os.path.join(temp_dir, "part_0.mp4"), merged_path)
    else:
        list_file_path = os.path.join(temp_dir, "list.txt")
        with open(list_file_path, "w", encoding="utf-8") as f:
            f.write("\n".join(segment_list))
        subprocess.run([
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "list.txt",
            "-c", "copy", merged_path,
        ], check=True, cwd=temp_dir)

    if subs_file:
        print(f"📝 [legacy] Burning subtitle...")
        subprocess.run([
            "ffmpeg", "-y", "-i", "_merged.mp4",
            "-vf", f"subtitles={subs_file}:force_style='{subs_style}'",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-c:a", "copy", os.path.abspath(output_path),
        ], check=True, cwd=temp_dir)
    else:
        shutil.move(merged_path, output_path)

    print(f"🎉 STANDARD EDIT SUCCESS (legacy) → {output_path}")
    return output_path


def _cleanup_dir(path: str) -> None:
    """ลบ temp directory แบบ best-effort (ไม่ raise ถ้า fail)"""
    try:
        if path and os.path.exists(path):
            shutil.rmtree(path, ignore_errors=True)
            print(f"🧹 Cleaned temp: {path}")
    except Exception as e:
        print(f"⚠️ Cleanup failed for {path}: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# TIKTOK MODE: 9:16 vertical + ≤ target_length + optional burn-in subtitle
# ─────────────────────────────────────────────────────────────────────────────

# Output resolution (TikTok/Reels standard)
TIKTOK_W = 1080
TIKTOK_H = 1920

# Center crop ให้เต็มจอ 1080x1920 (TikTok-style cover — ไม่มีขอบดำ)
# force_original_aspect_ratio=increase: scale UP จนเต็ม canvas (อาจล้น)
# crop: ตัดส่วนล้นทิ้ง — เนื้อหากลางอยู่ครบ
# setsar=1: บังคับ display = storage (กัน anamorphic SAR)
_TIKTOK_SCALE_PAD = (
    f"scale=w={TIKTOK_W}:h={TIKTOK_H}:force_original_aspect_ratio=increase:flags=lanczos,"
    f"crop={TIKTOK_W}:{TIKTOK_H},"
    f"setsar=1"
)


# ความแรงของการเบลอพื้นหลัง — แค่ต้องไม่ดึงสายตาไปจากภาพจริงตรงกลาง
BLUR_RADIUS = int(os.getenv("TIKTOK_BLUR_RADIUS", "40"))
BLUR_PASSES = int(os.getenv("TIKTOK_BLUR_PASSES", "4"))

# โหมดจัดเฟรม 9:16
#   crop = ขยายจนเต็มจอแล้วตัดส่วนล้น (เต็มจอ ไม่มีขอบ แต่เนื้อหานอกกรอบหายหมด)
#   blur = ย่อทั้งเฟรมให้เห็นครบ แล้วเติมขอบด้วยภาพเดิมที่เบลอ
#
# ทำไม blur เป็นค่าตั้งต้น: วัดจากคลิปจริง 2.35:1 (1280x544) พบว่า crop เก็บความกว้าง
# ต้นฉบับไว้แค่ 24% — ตัวอักษรเต็มบรรทัด ภาพเทียบซ้าย-ขวา และกริดคลิปย่อย พังหมด
# (สุ่มดู 12 เฟรม เสียหาย 10) ส่วนต้นฉบับที่เป็น 9:16 อยู่แล้ว สองโหมดให้ผลเท่ากัน
# เพราะไม่มีส่วนล้นให้ตัดและไม่มีขอบให้เติม
TIKTOK_FIT_MODES = ("blur", "crop")


def _tiktok_video_chain(fit_mode: str):
    """คืน video_chain ให้ _build_trim_concat_graph — list (crop) หรือ str (blur)"""
    if fit_mode != "blur":
        return [
            f"scale=w={TIKTOK_W}:h={TIKTOK_H}:force_original_aspect_ratio=increase:flags=lanczos",
            f"crop={TIKTOK_W}:{TIKTOK_H}",
            "setsar=1",
        ]
    # แตกสองสาย: พื้นหลังทำแบบ crop แล้วเบลอ / สายหน้าย่อให้พอดีทั้งเฟรมแล้ววางทับกลาง
    return (
        "{IN}split=2[bgsrc][fgsrc];"
        f"[bgsrc]scale=w={TIKTOK_W}:h={TIKTOK_H}:force_original_aspect_ratio=increase,"
        f"crop={TIKTOK_W}:{TIKTOK_H},boxblur={BLUR_RADIUS}:{BLUR_PASSES}[bg];"
        f"[fgsrc]scale=w={TIKTOK_W}:h={TIKTOK_H}:force_original_aspect_ratio=decrease:flags=lanczos[fg];"
        "[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1{OUT}"
    )


def verify_output_dimensions(video_path: str) -> tuple[int, int, str]:
    """ตรวจ dimensions + SAR ของ output ด้วย ffprobe → log + return"""
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height,sample_aspect_ratio",
            "-of", "csv=p=0", video_path,
        ],
        capture_output=True, text=True, check=True,
    )
    parts = result.stdout.strip().split(",")
    w = int(parts[0])
    h = int(parts[1])
    sar = parts[2] if len(parts) > 2 and parts[2] else "1:1"
    aspect = "9:16 ✅" if h > w else ("16:9 ❌" if w > h else "1:1")
    print(f"📐 [VERIFY] {os.path.basename(video_path)}: {w}x{h}, SAR={sar} → {aspect}")
    return w, h, sar


def render_tiktok_video(video_path, keep_segments, transcript, output_path, job_dir,
                        target_length=60, burn_subtitle=True, edited_phrases=None,
                        denoise=False, tail_pad: float = 0.2, fit_mode: str = "blur"):
    """
    fit_mode = "blur" (ตั้งต้น) เห็นครบทั้งเฟรม เติมขอบด้วยภาพเดิมที่เบลอ
             = "crop" เต็มจอแบบเดิม ตัดส่วนที่ล้นทิ้ง

    TikTok render: ตัดช่วงที่เลือก → center-crop 9:16 (1080x1920) → burn subtitle
    ทำใน filter_complex pass เดียว (frame/sample-accurate, subtitle ตรง timeline output)
    """
    print("\n" + "=" * 50)
    print(f"🎬 TIKTOK RENDER (fit={fit_mode}, target ≤ {target_length}s, subtitle={burn_subtitle})")
    print("=" * 50 + "\n")

    if not keep_segments:
        print("⚠️ No segments to render. Aborted.")
        return None

    if fit_mode not in TIKTOK_FIT_MODES:
        fit_mode = "blur"

    temp_dir = os.path.abspath(os.path.join(job_dir, "tiktok_temp"))
    os.makedirs(temp_dir, exist_ok=True)

    bounds = _seg_bounds(keep_segments, max_duration=_probe_duration(video_path),
                         tail_pad=tail_pad)
    if not bounds:
        print("❌ No valid segments after cleanup.")
        return None
    clean_segs = [{"start": st, "end": en} for st, en in bounds]

    subs_file = None
    if burn_subtitle and (transcript or edited_phrases):
        subs_file = _write_subs(temp_dir, clean_segs, transcript, edited_phrases)

    tiktok_chain = _tiktok_video_chain(fit_mode)

    if len(bounds) <= FILTERGRAPH_MAX_SEGMENTS:
        try:
            _run_filtergraph_render(
                video_path, bounds, output_path, temp_dir,
                video_chain=tiktok_chain,
                subs_file=subs_file, subs_style=_TIKTOK_SUB_STYLE,
                input_opts=["-noautorotate"],
                out_opts=["-metadata:s:v:0", "rotate=0"],
                fps=30,
                audio_chain=_output_audio_chain(denoise),
            )
            _verify_tiktok(output_path)
            print(f"🎉 TIKTOK RENDER SUCCESS → {output_path}")
            _cleanup_dir(temp_dir)
            return output_path
        except subprocess.CalledProcessError as e:
            print(f"⚠️ filter_complex failed ({e}) — falling back to legacy per-part render")

    result = _legacy_render_tiktok(video_path, bounds, output_path, temp_dir, subs_file,
                                   denoise=denoise)
    _verify_tiktok(output_path)
    _cleanup_dir(temp_dir)
    return result


def _verify_tiktok(output_path):
    try:
        verify_output_dimensions(output_path)
    except Exception as e:
        print(f"⚠️ Verify dimensions failed: {e}")


def _legacy_render_tiktok(video_path, bounds, output_path, temp_dir, subs_file,
                          denoise=False):
    """วิธีเดิม (fallback): ตัด+scale ทีละ part → concat copy → burn subtitle แยก pass"""
    af = _output_audio_chain(denoise)
    af_opts = ["-af", af[0]] if af else []
    part_files = []
    for i, (start, end) in enumerate(bounds):
        duration = end - start
        print(f"✂️ [TIKTOK legacy] Part {i}: {start}s → {end}s ({duration:.2f}s)")
        subprocess.run([
            "ffmpeg", "-y", "-noautorotate",
            "-ss", str(start), "-t", str(duration), "-i", video_path,
            "-vf", _TIKTOK_SCALE_PAD,
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            *af_opts,
            "-c:a", "aac", "-b:a", "128k", "-r", "30",
            "-metadata:s:v:0", "rotate=0", "-movflags", "+faststart",
            os.path.abspath(os.path.join(temp_dir, f"part_{i}.mp4")),
        ], check=True)
        part_files.append(f"part_{i}.mp4")

    if not part_files:
        print("❌ No valid parts created.")
        return None

    with open(os.path.join(temp_dir, "list.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(f"file '{p}'" for p in part_files))
    concat_output = os.path.abspath(os.path.join(temp_dir, "_concat.mp4"))
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "list.txt",
        "-c", "copy", concat_output,
    ], check=True, cwd=temp_dir)

    if subs_file:
        print(f"📝 [TIKTOK legacy] Burning subtitle...")
        subprocess.run([
            "ffmpeg", "-y", "-i", "_concat.mp4",
            "-vf", (f"scale={TIKTOK_W}:{TIKTOK_H}:flags=lanczos,setsar=1,"
                    f"subtitles={subs_file}:force_style='{_TIKTOK_SUB_STYLE}'"),
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-c:a", "copy", "-metadata:s:v:0", "rotate=0",
            os.path.abspath(output_path),
        ], check=True, cwd=temp_dir)
    else:
        shutil.move(concat_output, output_path)

    print(f"🎉 TIKTOK RENDER SUCCESS (legacy) → {output_path}")
    return output_path