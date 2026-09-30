import sys, json, re
sys.stdout.reconfigure(encoding="utf-8")
d = json.load(open(sys.argv[1], encoding="utf-8"))
runs, GT = d["runs"], d["gt"]
VIS = re.compile(r"ภาพ|ฉาก|สไลด์|จอ|หน้าจอ|กล้อง|outro|card|visual|screen|frame|slate|image|scene|camera|เห็น|แสดง", re.I)
HINT = re.compile(r"VAD|ตรวจพบ|identified|detected", re.I)
print("== reasons containing visual-ish words ==")
n_reason = {"A": 0, "B": 0}
for r in runs:
    c = r["cond"][0]
    for k in r["cuts"]:
        n_reason[c] += 1
        if VIS.search(k["reason"]): print(f"  [{c}] {r['case']} {r['rep']}/{r['tag']} {k['s']}-{k['e']}: {k['reason'][:140]}")
print("total reasons:", n_reason)
print("== reasons citing detector hints (VAD/detected) ==")
for c in "AB":
    hits = [(r['case'], k['reason'][:70]) for r in runs if r['cond'][0]==c for k in r['cuts'] if HINT.search(k['reason'])]
    print(f"  {c}: {len(hits)}", hits)
lang = {c: sum(1 for r in runs if r['cond'][0]==c for k in r['cuts'] if re.search(r'[\u0E00-\u0E7F]', k['reason'])) for c in "AB"}
print("Thai-language reasons:", lang, "of", n_reason)

def ov(a, b, c, e): return max(0.0, min(b, e) - max(a, c))
print("\n== per GT region: runs whose RAW Gemini proposal overlaps >=1s | runs whose FINAL keep leaves >=1s of it cut ==")
for case in sorted({r["case"] for r in runs}):
    rs = {c: [r for r in runs if r["case"]==case and r["cond"][0]==c] for c in "AB"}
    zero = {c: sum(1 for r in rs[c] if not r["cuts"]) for c in "AB"}
    print(f"{case}: n A={len(rs['A'])} B={len(rs['B'])} | zero-cut runs A={zero['A']} B={zero['B']}")
    for a, b, t in GT[case]["cut"]:
        out = []
        for c in "AB":
            raw = sum(1 for r in rs[c] if any(ov(a,b,k['s'],k['e'])>=1 for k in r['cuts']))
            fin = 0
            for r in rs[c]:
                kept = sum(ov(a,b,x,y) for x,y in r['keep'])
                if (b-a)-kept >= 1: fin += 1
            out.append(f"{c}: raw {raw}/{len(rs[c])} final {fin}/{len(rs[c])}")
        print(f"   GT {a:.0f}-{b:.0f} {t:<8} " + " | ".join(out))
