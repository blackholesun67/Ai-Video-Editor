r"""
Objective 1 — แยก Recall รายวินาทีตามประเภท/ความยาวช่วงในเฉลย + นับรายช่วง + ที่มาของวินาทีที่ตัดไม่ครบ
อ่านจาก preview.json เดิมของ objective1/rep*/ เท่านั้น (ไม่เรียก Gemini ไม่แก้เฉลย)

นิยาม (ใช้ parse_gt/ALLOWED จาก eval/tools/score.py ไม่ก็อบปี้):
  ช่วงที่ระบบตัด = ช่องว่างระหว่าง selected_segments ใน [0, จุดจบ transcript] (เหมือน score.py)
  instance       = 1 ช่วงในเฉลย × 1 รอบ ; hit = วินาทีที่ระบบตัดทับช่วงนั้น
  Recall         = Σhit / Σความยาวเฉลย (pooled ทุกรอบ)
  ตัดได้ ≥ ครึ่ง = hit ≥ 0.5 × ความยาวช่วง
  ตัดไม่ครบ      = ไม่ตัดเลย (hit = 0) + ขอบแคบกว่าเฉลย (0 < hit < ความยาว)
  ALLOWED        = เฉพาะประเภทที่โหมดอนุญาต (ตรงกับ recall เดิม) ; ALL = นับทุกประเภท
รัน (ที่ root ของ repo): python eval/final-evaluation/objective1/accuracy/obj1_breakdown.py
ผลลัพธ์ที่บันทึกไว้: obj1_breakdown_output.txt
"""
import os
os.chdir(os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..")))
import sys, json, glob, collections
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, "eval/tools"); import score as S
GT = {"V02_full":"V02","V03_full":"V03","V03_summary":"V03","V04_full":"V04","V05_full":"V05","V06_full":"V06","V06_summary":"V06","V07_full":"V07"}
def ov(a,b): return max(0.0, min(a[1],b[1])-max(a[0],b[0]))
rows=[]
for pj in sorted(glob.glob("eval/final-evaluation/objective1/rep*/*/*/preview.json")):
    p=pj.replace("\\","/").split("/"); case,tag,rep=p[-2],p[-3],p[-4]
    if case not in GT: continue
    d=json.load(open(pj,encoding="utf-8")); end=d["transcript"][-1]["end"]; mode=d.get("edit_mode","full")
    sel=sorted((s["start"],s["end"]) for s in d["selected_segments"]); cuts=[]; prev=0.0
    for s,e in sel:
        if s>prev+0.01: cuts.append((prev,min(s,end)))
        prev=max(prev,e)
    cuts=[c for c in cuts if c[1]>c[0]]
    gcut,_=S.parse_gt(f"eval/{GT[case]}/ground_truth.txt")
    for a,b,t in gcut:
        L=b-a; hit=sum(ov(c,(a,b)) for c in cuts)
        rows.append(dict(case=case,run=f"{rep}/{tag}",type=t,allowed=t in S.ALLOWED[mode],a=a,b=b,L=L,hit=hit))
print("GT intervals per case:"); 
seen=set()
for r in rows:
    k=(r["case"],r["a"])
    if k not in seen: seen.add(k); print(f"  {r['case']:12} {r['a']:6.1f}-{r['b']:6.1f} {r['type']:8} len {r['L']:5.2f} allowed={r['allowed']}")
def agg(sel,label):
    L=sum(r["L"] for r in sel); H=sum(r["hit"] for r in sel)
    n=len(sel); half=sum(1 for r in sel if r["hit"]>=0.5*r["L"]); zero=[r for r in sel if r["hit"]<=1e-9]
    miss_zero=sum(r["L"] for r in zero); miss_part=sum(r["L"]-r["hit"] for r in sel if r["hit"]>1e-9)
    miss_short=sum(r["L"]-r["hit"] for r in sel if r["L"]<5)
    print(f"{label:34} | instances {n:3} | GT s {L:7.2f} | hit {H:7.2f} | recall {100*H/L if L else float('nan'):6.2f}% | >=half {half:3}/{n:<3} | miss total {L-H:7.2f} = notcut {miss_zero:7.2f} + partial {miss_part:6.2f} | of which GT<5s {miss_short:5.2f}")
cases=["V02_full","V03_full","V03_summary","V04_full","V06_full","V06_summary","V07_full"]
for basis,f in (("ALLOWED (นิยาม recall เดิม)",lambda r:r["allowed"]),("ALL (นับทุกประเภท)",lambda r:True)):
    print(f"\n===== {basis} =====")
    print("-- by case"); [agg([r for r in rows if r["case"]==c and f(r)],c) for c in cases]
    print("-- by type (6 main cases + V03_full)")
    for t in ("SILENCE","RETAKE","FILLER","TECH","TANGENT"): agg([r for r in rows if r["type"]==t and f(r)],t)
    print("-- by length"); agg([r for r in rows if r["L"]<5 and f(r)],"<5s"); agg([r for r in rows if r["L"]>=5 and f(r)],">=5s")
    print("-- total"); agg([r for r in rows if f(r)],"ALL rows")
print("\n-- per-interval detail (hit seconds per run)")
for c in cases:
    for a in sorted({r["a"] for r in rows if r["case"]==c}):
        rr=[r for r in rows if r["case"]==c and r["a"]==a]
        print(f"  {c:12} {a:6.1f}-{rr[0]['b']:6.1f} {rr[0]['type']:8} L={rr[0]['L']:5.2f} hits=", [round(r['hit'],2) for r in rr])
