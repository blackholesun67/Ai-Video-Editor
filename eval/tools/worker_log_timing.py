#!/usr/bin/env python3
"""สรุปเวลาแต่ละขั้นตอนต่อ job จาก `docker compose logs worker` → CSV

ทำไมต้องคำนวณจากช่องว่างระหว่างบรรทัด: โค้ดไม่ได้จับเวลาต่อขั้นตอนไว้ (มีแค่ Celery
"Task ... succeeded in Xs" ต่อ task) แต่ทุกบรรทัดใน log มี timestamp ระดับมิลลิวินาที
สคริปต์นี้จึงอ่าน marker ที่โค้ดพิมพ์ไว้แล้วหาผลต่างของเวลา **ไม่ได้แก้โค้ดระบบ และไม่เรียก Gemini**

วิธีใช้ (รันที่ root ของ repo):
    python eval/tools/worker_log_timing.py -o timing.csv          # ดึง log สดจาก docker compose
    python eval/tools/worker_log_timing.py worker.log -o timing.csv
    docker compose logs --no-color worker > worker.log            # เก็บ log ไว้ก่อน container ถูกสร้างใหม่

ผลลัพธ์: 1 แถวต่อ 1 task (analysis / render) ใช้รหัสงาน (job_id) เท่านั้น
ไม่มีอีเมลหรือข้อมูลผู้ใช้ — log ของ worker ไม่มีข้อมูลนั้นอยู่แล้ว และสคริปต์ไม่ดึงข้อความอื่นออกมา

ข้อจำกัด (อ่านก่อนใช้ตัวเลข):
  * ไม่มีบรรทัด "started" → เวลาเริ่ม task = บรรทัด log แรกหลัง "received" (และหลังงานก่อนหน้าจบ)
    wall_s = จบ − เริ่ม ; celery_runtime_s = ตัวเลข "succeeded in" ของ Celery (เคยต่างจาก wall_s ได้ ~4 วิ ใน log เก่า — ใช้ wall_s)
    queue_wait_s = เริ่ม − "received" ; worker ตัวเดียวแบบ solo (docker-compose.yml) งานที่ถูก prefetch
    ระหว่างงานอื่นกำลังรันจึงเห็นเป็น queue_wait > 0 ; ถ้า worker ว่างค่านี้ ≈ 0
  * transcript_cache_hit=1 แปลว่าอัปไฟล์เสียงเดิมซ้ำ ข้าม Whisper → whisper_s ว่าง ห้ามเอาไปเฉลี่ยกับงานปกติ
  * gemini_s = ตั้งแต่ "Sending filtered transcript to Gemini" ถึง HTTP 200 ตัวสุดท้ายของ generateContent
    (รวม retry/สลับ key/สลับ model และคำขอที่รันขนานกัน ไม่ใช่เวลาคำขอเดียว)
  * unattributed_s = wall_s − ผลรวมขั้นที่จับได้ ควรเล็ก ; ถ้าใหญ่ = มีช่วงที่ marker ไม่ครอบ (เช่นงานที่ไม่ผ่านหน้า
    preview แล้ว render ต่อใน task เดียวกัน, งานล้ม, หรือ log ถูกตัดหาย)
  * ถ้า log เป็น UTF-16 (redirect ด้วย PowerShell 5.1) สคริปต์รองรับ ; ข้อความภาษาไทย/อีโมจิอาจเพี้ยนแต่ marker ที่ใช้เป็น ASCII
"""
import argparse
import csv
import re
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

LINE_RE = re.compile(
    r"^(?:\S+\s+\|\s)?\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),(\d{3}): [A-Z]+/\w+\] (.*)$"
)
TASK_RE = re.compile(
    r"^Task tasks\.(process_video_task|render_only_task)\[([0-9a-f-]{36})(-render)?\] "
    r"(received|succeeded in ([\d.]+)s|raised unexpected|ignored|retry|failed)"
)
MODEL_RE = re.compile(r"/models/([\w.\-]+):generateContent")

COLUMNS = [
    "job_id", "task", "status", "received_at", "started_at", "finished_at",
    "queue_wait_s", "wall_s", "celery_runtime_s",
    "extract_audio_s", "vad_s", "visual_s",
    "whisper_s", "whisper_model_load_s", "whisper_pass1_s", "whisper_pass2_gapfill_s", "whisper_pass3_repair_s",
    "transcript_cache_hit",
    "prep_before_gemini_s", "gemini_s", "gemini_attempts", "gemini_ok_calls", "gemini_non200_calls", "gemini_models",
    "post_gemini_s", "unattributed_s",
]


def read_text(path):
    raw = Path(path).read_bytes() if path else sys.stdin.buffer.read()
    if raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
        return raw.decode("utf-16", errors="replace")
    return raw.decode("utf-8-sig", errors="replace")


def fetch_live_log():
    root = Path(__file__).resolve().parents[2]
    proc = subprocess.run(
        ["docker", "compose", "logs", "--no-color", "worker"],
        cwd=root, capture_output=True,
    )
    if proc.returncode != 0:
        sys.exit("docker compose logs ล้มเหลว: " + proc.stderr.decode("utf-8", errors="replace")[-300:])
    return proc.stdout.decode("utf-8-sig", errors="replace")


def parse(text):
    """→ [(datetime, message)] เรียงตามเวลาใน log (เฉพาะบรรทัดที่มี timestamp ของ Celery)"""
    out = []
    for ln in text.splitlines():
        m = LINE_RE.match(ln.rstrip("\r"))
        if not m:
            continue
        ts = datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S").replace(microsecond=int(m.group(2)) * 1000)
        out.append((ts, m.group(3)))
    return out


def secs(a, b):
    return None if a is None or b is None else round((b - a).total_seconds(), 2)


def find(lines, pred, after=None):
    for ts, msg in lines:
        if after is not None and ts < after:
            continue
        if pred(msg):
            return ts
    return None


def find_last(lines, pred):
    hit = None
    for ts, msg in lines:
        if pred(msg):
            hit = ts
    return hit


def analysis_steps(lines, start, end, wall_s):
    row = {}
    t_vad0 = find(lines, lambda m: m.startswith("[VAD] Audio loaded"))
    t_vad1 = find(lines, lambda m: m.startswith("[VAD] Speech:"))
    t_vis = find(lines, lambda m: "[Visual]" in m and "ข้ามไป" not in m, after=t_vad1)
    t_tr0 = find(lines, lambda m: m.startswith("Transcribing:"))
    t_tr1 = find(lines, lambda m: m.startswith("Transcribed "))
    t_hit = find(lines, lambda m: "[Cache HIT]" in m)
    t_send = find(lines, lambda m: m.startswith("Sending filtered transcript to Gemini"))
    t_phr = find(lines, lambda m: "Pre-generated" in m and "subtitle phrases" in m)

    row["transcript_cache_hit"] = 1 if t_hit else 0
    row["extract_audio_s"] = secs(start, t_vad0)
    row["vad_s"] = secs(t_vad0, t_vad1)
    row["visual_s"] = secs(t_vad1, t_vis)
    row["whisper_s"] = secs(t_tr0, t_tr1)
    t_ml0 = find(lines, lambda m: m.startswith("Loading Whisper on"))
    t_ml1 = find(lines, lambda m: m.startswith("Whisper model loaded"))
    row["whisper_model_load_s"] = secs(t_ml0, t_ml1)
    t_p1 = find(lines, lambda m: m.startswith("Pass 1 ("))
    row["whisper_pass1_s"] = secs(t_tr0, t_p1)
    t_p2a = find(lines, lambda m: m.startswith("Pass 2: re-transcribing"))
    t_p2b = find(lines, lambda m: m.startswith("Pass 2: total"))
    row["whisper_pass2_gapfill_s"] = secs(t_p2a, t_p2b)
    t_p3a = find(lines, lambda m: "Pass 3:" in m)
    t_p3b = find_last(lines, lambda m: "Pass 3:" in m)
    row["whisper_pass3_repair_s"] = secs(t_p3a, t_p3b) if t_p3a != t_p3b else None

    t_tr_end = t_tr1 or t_hit
    row["prep_before_gemini_s"] = secs(t_tr_end, t_send)

    gem_lines = [(ts, m) for ts, m in lines if "generateContent" in m and "HTTP Request: POST" in m]
    ok = [(ts, m) for ts, m in gem_lines if "200 OK" in m]
    row["gemini_attempts"] = sum(1 for _, m in lines if "Trying " in m and "(Attempt" in m)
    row["gemini_ok_calls"] = len(ok)
    row["gemini_non200_calls"] = len(gem_lines) - len(ok)
    models = sorted({MODEL_RE.search(m).group(1) for _, m in ok if MODEL_RE.search(m)})
    row["gemini_models"] = "|".join(models)
    t_gem_end = ok[-1][0] if ok else None
    row["gemini_s"] = secs(t_send, t_gem_end)
    row["post_gemini_s"] = secs(t_gem_end, t_phr or end)

    known = [row[k] for k in ("extract_audio_s", "vad_s", "visual_s", "whisper_s",
                              "prep_before_gemini_s", "gemini_s", "post_gemini_s") if row[k] is not None]
    row["unattributed_s"] = round(wall_s - sum(known), 2) if wall_s is not None else None
    return row


def build_rows(entries):
    # รวบรวมเหตุการณ์ของ task: received / จบ (succeeded/อื่น ๆ)
    tasks = {}
    for ts, msg in entries:
        m = TASK_RE.match(msg)
        if not m:
            continue
        kind, tid, render_sfx, what, runtime = m.groups()
        key = (kind, tid + (render_sfx or ""))
        t = tasks.setdefault(key, {"kind": kind, "job_id": tid, "received": None, "end": None,
                                   "status": None, "runtime": None})
        if what == "received":
            t["received"] = ts
        else:
            t["end"] = ts
            t["status"] = "SUCCESS" if what.startswith("succeeded") else what.split()[0].upper()
            t["runtime"] = float(runtime) if runtime else None

    done = sorted((t for t in tasks.values() if t["end"]), key=lambda t: t["end"])
    rows = []
    prev_end = None
    for t in done:
        # เวลาเริ่มจริง = บรรทัด log แรกของ task (ไม่ใช่ succeeded − runtime: runtime ของ Celery
        # เคยสั้นกว่า wall-clock ใน log จริง 4.5 วิ จึงใช้เป็นแค่ค่าสำรอง)
        lower = max([x for x in (t["received"], prev_end) if x is not None], default=None)
        first = next((ts for ts, msg in entries
                      if (lower is None or ts >= lower) and ts <= t["end"] and not msg.startswith("Task tasks.")), None)
        if first is not None:
            start = first
        elif t["runtime"] is not None:
            start = t["end"] - timedelta(seconds=t["runtime"])
        else:
            start = lower or t["end"]
        prev_end = t["end"]
        window = [(ts, msg) for ts, msg in entries if start <= ts <= t["end"]]
        wall_s = secs(start, t["end"])
        total_s = t["runtime"] if t["runtime"] is not None else wall_s
        row = {c: None for c in COLUMNS}
        row.update({
            "job_id": t["job_id"],
            "task": "analysis" if t["kind"] == "process_video_task" else "render",
            "status": t["status"],
            "received_at": t["received"].strftime("%Y-%m-%d %H:%M:%S") if t["received"] else None,
            "started_at": start.strftime("%Y-%m-%d %H:%M:%S"),
            "finished_at": t["end"].strftime("%Y-%m-%d %H:%M:%S"),
            "queue_wait_s": max(0.0, secs(t["received"], start)) if t["received"] else None,
            "wall_s": wall_s,
            "celery_runtime_s": t["runtime"],
        })
        if t["kind"] == "process_video_task":
            row.update(analysis_steps(window, start, t["end"], wall_s))
        rows.append(row)
    rows.sort(key=lambda r: r["started_at"])
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("logfile", nargs="?", help="ไฟล์ log (ไม่ใส่ = ดึงสดจาก docker compose logs worker)")
    ap.add_argument("-o", "--output", help="ไฟล์ CSV ที่จะเขียน (ไม่ใส่ = stdout)")
    args = ap.parse_args()

    text = read_text(args.logfile) if args.logfile else fetch_live_log()
    entries = parse(text)
    rows = build_rows(entries)
    out = open(args.output, "w", newline="", encoding="utf-8-sig") if args.output else sys.stdout
    w = csv.DictWriter(out, fieldnames=COLUMNS)
    w.writeheader()
    for r in rows:
        w.writerow({k: ("" if v is None else v) for k, v in r.items()})
    if args.output:
        out.close()
    n_an = sum(1 for r in rows if r["task"] == "analysis")
    print(f"อ่าน {len(entries)} บรรทัดที่มี timestamp → {len(rows)} task ({n_an} analysis, {len(rows) - n_an} render)",
          file=sys.stderr)
    if not rows:
        print("ไม่พบบรรทัด 'Task tasks.… succeeded' — log นี้ไม่มี task ที่จบ หรือ container ถูกสร้างใหม่แล้ว", file=sys.stderr)


if __name__ == "__main__":
    main()
