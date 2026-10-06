"""ตัวช่วยตรวจผล 4A รอบ thesis-test-v1 (อ่านไฟล์ JSON ที่ curl บันทึกไว้ ไม่เรียก API/Gemini เอง)

ใช้:
  python check.py preview   api/preview_response.json
  python check.py payload   api/preview_response.json  > api/subtitle_post_payload.json
  python check.py subtitle  api/subtitle_post_payload.json api/subtitle_response.json
  python check.py render    api/subtitle_post_payload.json api/subtitle_response.json > api/render_payload.json
  python check.py duration  api/render_payload.json api/output_video_info.txt
"""
import json
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
EDIT_TAG = " [แก้ไขโดยเทสต์ 4A-v1]"


def load(p):
    with open(p, encoding="utf-8") as f:
        txt = f.read()
    # curl -w ต่อท้ายด้วย "\nHTTP:200" — ตัดทิ้งก่อน parse
    return json.loads(re.sub(r"\s*HTTP:\d+\s*$", "", txt))


def segs_total(segs):
    return round(sum(s["end"] - s["start"] for s in segs), 2)


def cmd_preview(p):
    d = load(p)
    segs = d["segments"]
    print(f"edit_mode={d.get('edit_mode')} burn_subtitle={d.get('burn_subtitle')}")
    print(f"AI เสนอเก็บ {len(segs)} ช่วง รวม {segs_total(segs)} วิ:")
    for s in segs:
        print(f"  {s['start']:.2f} – {s['end']:.2f}")
    bad = [(a, b) for a, b in zip(segs, segs[1:]) if b["start"] < a["end"]]
    print("ช่วงทับกัน:", "ไม่มี" if not bad else bad)
    print("transcript ท่อน:", len(d.get("transcript") or []))


def cmd_payload(p):
    """ใช้ช่วงที่ AI เสนอตามจริง ; ถ้า AI เก็บทั้งคลิป (1 ช่วง) จะไม่มีรอยตัด
    → ผู้ทดสอบต้องแก้ไฟล์ payload เองให้มีรอยตัดอย่างน้อย 1 จุด แล้วจดไว้ใน api_result.md"""
    segs = [{"start": s["start"], "end": s["end"]} for s in load(p)["segments"]]
    if len(segs) < 2:
        print("⚠️ AI เสนอแค่ 1 ช่วง — แก้ payload ให้มีรอยตัดเองก่อนไปต่อ", file=sys.stderr)
    print(json.dumps({"segments": segs}, ensure_ascii=False))


def cmd_subtitle(payload_p, resp_p):
    segs = load(payload_p)["segments"]
    ph = load(resp_p)["phrases"]
    inside = lambda x: any(s["start"] - 0.05 <= x["orig_start"] and x["orig_end"] <= s["end"] + 0.05 for s in segs)
    missing = [x for x in ph if "orig_start" not in x or "orig_end" not in x]
    outside = [x for x in ph if "orig_start" in x and not inside(x)]
    print(f"ซับ {len(ph)} บรรทัด | ไม่มี orig_* = {len(missing)} | นอก selection = {len(outside)}")
    for x in outside[:5]:
        print("  นอก:", x["orig_start"], x["orig_end"], x["text"][:40])


def cmd_render(payload_p, resp_p):
    segs = load(payload_p)["segments"]
    ph = load(resp_p)["phrases"]
    # แก้บรรทัดแรก + บรรทัดแรกหลังรอยตัดแรก (ไว้ตรวจซับหลังรอยตัดในวิดีโอ)
    idx = {0}
    if len(segs) >= 2:
        after = [i for i, x in enumerate(ph) if x.get("orig_start", -1) >= segs[1]["start"] - 0.05]
        if after:
            idx.add(after[0])
    for i in sorted(idx):
        ph[i]["text"] += EDIT_TAG
        print(f"แก้บรรทัด #{i}: orig {ph[i]['orig_start']}–{ph[i]['orig_end']} → output {ph[i]['start']}–{ph[i]['end']}", file=sys.stderr)
    print(json.dumps({"segments": segs, "edited_phrases": ph}, ensure_ascii=False))


def cmd_duration(payload_p, info_p):
    segs = load(payload_p)["segments"]
    with open(info_p, encoding="utf-8", errors="replace") as f:
        m = re.search(r"duration=([\d.]+)", f.read())
    out = float(m.group(1)) if m else None
    exp = segs_total(segs)
    print(f"ผลรวมช่วงที่เลือก {exp} วิ | ไฟล์ output {out} วิ | ต่าง {None if out is None else round(out - exp, 3)}")
    off = 0.0
    for s in segs[:-1]:
        off += s["end"] - s["start"]
        print(f"  รอยตัดใน output ที่ {off:.2f} วิ")


if __name__ == "__main__":
    {"preview": cmd_preview, "payload": cmd_payload, "subtitle": cmd_subtitle,
     "render": cmd_render, "duration": cmd_duration}[sys.argv[1]](*sys.argv[2:])
