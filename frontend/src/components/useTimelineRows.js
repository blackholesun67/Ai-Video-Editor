import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * จัดการ "แถวไทม์ไลน์" ของหน้า preview
 *
 * แนวคิด: แทนที่จะเก็บแค่ช่วงที่ AI เลือก เราปูทั้งไทม์ไลน์ให้เต็มด้วยแถว 2 ชนิด
 *   - kind='ai'  ช่วงที่ AI เลือกเก็บ (ติ๊กไว้แล้ว)
 *   - kind='cut' ช่วงที่ AI ตัดทิ้ง (ไม่ติ๊ก — กดเอากลับมาได้)
 * แถวเรียงตามเวลาและ *ต่อกันสนิท* ทุกขอบภายในจึงถูกแชร์โดยแถวสองแถวเสมอ
 * — คุณสมบัตินี้ทำให้การขยับขอบ (Phase 3) ไม่มีทางกินทับเพื่อนบ้าน
 *
 * ข้อความของแถว cut หาเองที่ฝั่ง client จาก preview.transcript ด้วยกฎ midpoint
 * เดียวกับ _enrich_segments_with_text ฝั่ง backend → ไม่ต้องเพิ่ม API
 */

export const MIN_ROW_LEN = 0.5;    // ความยาวขั้นต่ำของแถว (ทั้งตอนสร้าง ขยับขอบ และแยก)
// ช่องว่างสั้นกว่านี้ กลืนเข้าแถว ai แทนการสร้างแถวจิ๋ว
// ตั้งเท่า MIN_ROW_LEN โดยตั้งใจ ไม่งั้น buildRows สร้างแถวที่สั้นกว่าที่ nudge ยอมให้มีได้
export const MIN_CUT_GAP = MIN_ROW_LEN;
const MAX_TEXT_CHARS = 200;        // เท่ากับ _enrich_segments_with_text
const MERGE_EPS = 0.05;            // ช่วงที่ห่างน้อยกว่านี้ = ติดกัน ให้ merge ตอนส่ง

// กริดเวลา 0.1 วินาที — เท่ากับความละเอียดที่ UI แสดง
// ตัวเลขที่แสดง = ที่เก็บ = ที่ส่ง render ไม่มีเลขซ่อนให้ผู้ใช้งงว่าอันไหนจริง
export const snap = (n) => Math.round(n * 10) / 10;

/**
 * ลายเซ็นของ "ข้อเสนอจาก AI" — ใช้ตรวจว่าค่าที่กู้จาก localStorage ยังเข้ากับงานนี้ไหม
 *
 * เดิมเทียบ origEnd ของแต่ละแถวกับ preview.segments ทีละตัว ซึ่งพังสองทาง:
 *   1. พอปัดลงกริด 0.1 ค่าเพี้ยนได้ถึง 0.05 เกิน tolerance 0.02 -> ผู้ใช้เสียงานที่แก้ไว้เงียบ ๆ
 *   2. พอแยกแถว จำนวนแถว ai ไม่ตรงกับ segments อีกต่อไป
 * ลายเซ็นดูที่ข้อเสนอล้วน ๆ ไม่สนใจว่าแถวถูกแยก/ขยับไปแค่ไหน และ snap ทั้งสองฝั่งด้วยฟังก์ชันเดียวกัน
 */
export function segSignature(preview) {
  return [...(preview?.segments || [])]
    .sort((a, b) => a.start - b.start)
    .map((s) => `${snap(Number(s.start) || 0)}-${snap(Number(s.end) || 0)}`)
    .join('|');
}

/** แถวที่กู้มาต้องยังปูเต็มไทม์ไลน์ต่อกันสนิท ไม่งั้น nudge/split จะทำงานผิด */
function rowsAreSane(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((r, i, a) => (
    r && typeof r.id === 'string'
    && Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start
    && (i === 0 || Math.abs(a[i - 1].end - r.start) < 0.001)
  ));
}

/** id ถัดไปของ kind นั้น — สแกนจากอาเรย์ที่กำลังแก้ ไม่ใช้ counter ระดับโมดูล
 *  (counter รีเซ็ตตอน reload แต่ id ที่ persist ไว้ยังอยู่ -> ชนกัน)
 *  crypto.randomUUID ก็ใช้ไม่ได้ เพราะแอปเสิร์ฟผ่าน http://<lan-ip> ซึ่งไม่ใช่ secure context */
export function nextIds(rows, kind, count = 1) {
  const prefix = `${kind}-`;
  let max = -1;
  rows.forEach((r) => {
    const id = r.id || '';
    if (!id.startsWith(prefix)) return;
    const tail = id.slice(prefix.length);
    // regex literal ไม่ใช่ template literal — กัน \d ถูกกลืนเป็น d ตอน build สตริง
    if (/^\d+$/.test(tail)) max = Math.max(max, Number(tail));
  });
  return Array.from({ length: count }, (_, i) => `${kind}-${max + 1 + i}`);
}

/** ข้อความในช่วง [start, end) จาก transcript — กฎ midpoint เหมือน backend */
function sweepText(sorted, start, end, cursorRef) {
  const parts = [];
  let i = cursorRef.i;
  while (i < sorted.length) {
    const t = sorted[i];
    const mid = ((t.start || 0) + (t.end || 0)) / 2;
    if (mid > end) break;
    if (mid >= start) parts.push((t.text || '').trim());
    i += 1;
  }
  cursorRef.i = i;                                  // sweep ไปข้างหน้าอย่างเดียว O(n+m)
  const joined = parts.filter(Boolean).join(' ');
  return joined.length > MAX_TEXT_CHARS ? `${joined.slice(0, MAX_TEXT_CHARS)}...` : joined;
}

/** สร้างแถวทั้งหมดจาก preview + ความยาววิดีโอ */
export function buildRows(preview, duration) {
  const keeps = [...(preview?.segments || [])]
    .map((s) => ({ ...s, start: Number(s.start) || 0, end: Number(s.end) || 0 }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const transcript = [...(preview?.transcript || [])]
    .filter((t) => t && t.start != null && t.end != null)
    .sort((a, b) => a.start - b.start);

  const rows = [];
  const cursorRef = { i: 0 };
  let cursor = 0;
  let aiN = 0;
  let cutN = 0;

  const pushCut = (start, end) => {
    // sweep ต้องเดินหน้าเสมอ — reset cursor ถ้าช่วงนี้อยู่ก่อนตำแหน่งปัจจุบัน
    const text = sweepText(transcript, start, end, cursorRef);
    rows.push({
      id: `cut-${cutN++}`,
      kind: 'cut',
      start: snap(start),
      end: snap(end),
      origStart: snap(start),
      origEnd: snap(end),
      text,
      on: false,
    });
  };

  keeps.forEach((k) => {
    const gap = k.start - cursor;
    let start = k.start;
    if (gap >= MIN_CUT_GAP) {
      pushCut(cursor, k.start);
    } else if (gap > 0) {
      start = cursor;                               // กลืนช่องว่างจิ๋ว รักษาการปูเต็ม
    }
    // ข้ามข้อความของช่วง ai ไปด้วย เพื่อให้ cursor ของ sweep ตรงกับเวลาจริง
    sweepText(transcript, start, k.end, cursorRef);
    rows.push({
      id: `ai-${aiN++}`,
      kind: 'ai',
      start: snap(start),
      end: snap(k.end),
      origStart: snap(start),
      origEnd: snap(k.end),
      text: k.text || '',
      role: k.role,
      score: k.score,
      reason: k.reason,
      on: true,
    });
    cursor = Math.max(cursor, k.end);
  });

  if (duration - cursor >= MIN_CUT_GAP) pushCut(cursor, duration);
  return rows;
}

/** ความยาววิดีโอที่ใช้ได้ทันที (ก่อน <video> โหลด metadata) */
export function seedDuration(preview) {
  const lastKeep = (preview?.segments || []).reduce((m, s) => Math.max(m, Number(s.end) || 0), 0);
  const lastWord = (preview?.transcript || []).reduce((m, t) => Math.max(m, Number(t.end) || 0), 0);
  return Math.max(lastKeep, lastWord);
}

/** แถวที่ติ๊กไว้ → payload สำหรับ POST /render (merge ช่วงที่ติดกัน) */
export function toRenderSegments(rows) {
  const on = rows.filter((r) => r.on).sort((a, b) => a.start - b.start);
  const out = [];
  on.forEach((r) => {
    const last = out[out.length - 1];
    if (last && r.start - last.end < MERGE_EPS) {
      last.end = Math.max(last.end, r.end);         // ติดกัน → รวมเป็นช่วงเดียว
    } else {
      out.push({ start: r.start, end: r.end });
    }
  });
  return out.map((s) => ({ start: snap(s.start), end: snap(s.end) }));
}

/**
 * คำนวณผลของการขยับขอบ โดยยังไม่แก้อะไร — pure ทดสอบได้ และ UI ใช้รู้ล่วงหน้าว่าขยับได้จริงไหม
 *
 * แถวปูเต็มไทม์ไลน์ ขอบหนึ่งจึงถูกแชร์กับเพื่อนบ้านเสมอ ต้องขยับทั้งคู่ ไม่งั้นเกิดช่องโหว่/ทับซ้อน
 * snap ก่อน clamp (ไม่ใช่ clamp แล้วค่อย snap) ไม่งั้นค่าที่ปัดแล้วหลุดเข้าไปในเขต MIN_ROW_LEN ได้
 */
export function planNudge(rows, id, edge, delta, duration) {
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return { moved: false, at: 0, d: 0 };
  const cur = rows[i];
  const nb = edge === 'start' ? rows[i - 1] : rows[i + 1];

  let target;
  if (edge === 'start') {
    const lo = nb ? snap(nb.start + MIN_ROW_LEN) : 0;
    const hi = snap(cur.end - MIN_ROW_LEN);
    target = Math.min(Math.max(snap(cur.start + delta), lo), hi);
    return { moved: Math.abs(target - cur.start) >= 0.05, at: target, d: snap(target - cur.start) };
  }
  const hi = nb ? snap(nb.end - MIN_ROW_LEN) : snap(duration);
  const lo = snap(cur.start + MIN_ROW_LEN);
  target = Math.min(Math.max(snap(cur.end + delta), lo), hi);
  return { moved: Math.abs(target - cur.end) >= 0.05, at: target, d: snap(target - cur.end) };
}

/** ใช้ผลจาก planNudge กับอาเรย์แถว (คำนวณซ้ำใน updater กัน snapshot เก่า) */
export function applyNudge(rows, id, edge, delta, duration) {
  const { moved, d } = planNudge(rows, id, edge, delta, duration);
  if (!moved) return rows;
  const i = rows.findIndex((r) => r.id === id);
  const cur = rows[i];
  const next = [...rows];
  if (edge === 'start') {
    const nb = rows[i - 1];
    next[i] = { ...cur, start: snap(cur.start + d) };
    if (nb) next[i - 1] = { ...nb, end: snap(nb.end + d) };
  } else {
    const nb = rows[i + 1];
    next[i] = { ...cur, end: snap(cur.end + d) };
    if (nb) next[i + 1] = { ...nb, start: snap(nb.start + d) };
  }
  return next;
}

/** ข้อความในช่วง [start, end] จาก transcript — กฎ midpoint เดียวกับ sweepText
 *  half-open ที่จุดแยก (ครึ่งซ้ายไม่รวม t, ครึ่งขวารวม) กันคำที่ midpoint ตกตรงจุดแยกพอดีถูกนับซ้ำ */
export function textBetween(sorted, start, end, { includeStart = true, includeEnd = true } = {}) {
  const parts = [];
  for (const t of sorted) {
    const mid = ((t.start || 0) + (t.end || 0)) / 2;
    if (mid > end || (mid === end && !includeEnd)) break;
    const afterStart = includeStart ? mid >= start : mid > start;
    if (afterStart) parts.push((t.text || '').trim());
  }
  const joined = parts.filter(Boolean).join(' ');
  return joined.length > MAX_TEXT_CHARS ? `${joined.slice(0, MAX_TEXT_CHARS)}...` : joined;
}

/** ตรวจว่าแยกช่วงตรงเวลานี้ได้ไหม — pure, ใช้ทั้งตอน disable ปุ่มและตอนแยกจริง
 *  ใช้ MIN_ROW_LEN เป็นเกณฑ์ → split ไม่มีทางสร้างแถวที่ nudge จะปฏิเสธ */
export function describeSplit(rows, time) {
  const at = snap(time);
  if (!Number.isFinite(at)) return { ok: false, reason: 'no-row' };
  if (rows.some((r) => r.start === at || r.end === at)) {
    return { ok: false, reason: 'on-edge', at };
  }
  const index = rows.findIndex((r) => r.start < at && at < r.end);
  if (index === -1) return { ok: false, reason: 'no-row', at };
  const row = rows[index];
  if (at - row.start < MIN_ROW_LEN || row.end - at < MIN_ROW_LEN) {
    return { ok: false, reason: 'too-short', at, index, row };
  }
  return { ok: true, at, index, row };
}

export const SPLIT_REASON = {
  'on-edge': 'ตรงนี้เป็นรอยต่ออยู่แล้ว',
  'no-row': 'เลื่อนวิดีโอไปยังช่วงที่ต้องการก่อน',
  'too-short': `ต้องห่างจากรอยต่อเดิมอย่างน้อย ${MIN_ROW_LEN} วิ`,
};

/** แยกแถวที่ครอบเวลานี้ออกเป็นสอง — คืนอาเรย์เดิมถ้าแยกไม่ได้
 *  ครึ่งซ้ายเก็บ id เดิมของพ่อ (activeId ไม่หลุด, DOM node ไม่ churn) */
export function applySplit(rows, time, sortedTranscript) {
  const chk = describeSplit(rows, time);
  if (!chk.ok) return rows;
  const { at, index, row } = chk;
  const [rightId] = nextIds(rows, row.kind, 1);
  const common = {
    kind: row.kind, on: row.on, split: true,
    role: row.role, score: row.score, reason: row.reason,
  };
  const left = {
    ...common, id: row.id,
    start: row.start, end: at, origStart: row.start, origEnd: at,
    text: textBetween(sortedTranscript, row.start, at, { includeEnd: false }),
  };
  const right = {
    ...common, id: rightId,
    start: at, end: row.end, origStart: at, origEnd: row.end,
    text: textBetween(sortedTranscript, at, row.end),
  };
  const next = [...rows];
  next.splice(index, 1, left, right);
  return next;
}

export default function useTimelineRows(preview, jobId, storageKey) {
  const [rows, setRows] = useState([]);
  const [duration, setDuration] = useState(0);
  const builtFor = useRef(null);                    // กัน effect รันซ้ำแล้วล้างงานที่ผู้ใช้แก้
  const rowsRef = useRef([]);                       // ให้ callback อ่านแถวล่าสุดได้โดยไม่ผูก dependency
  rowsRef.current = rows;

  // sort ครั้งเดียว ใช้ซ้ำทุกครั้งที่แยกแถว (buildRows sort เองเพื่อให้ standalone/ทดสอบง่าย)
  const sortedTranscript = useMemo(() => [...(preview?.transcript || [])]
    .filter((t) => t && t.start != null && t.end != null)
    .sort((a, b) => a.start - b.start), [preview]);

  // ── สร้างแถวครั้งเดียวต่อ jobId (หรือกู้จาก localStorage) ──
  useEffect(() => {
    if (!preview || !jobId || builtFor.current === jobId) return;
    const seed = seedDuration(preview);

    let restored = null;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      // กู้เฉพาะเมื่อเป็นงานเดียวกันและ AI ยังเสนอช่วงชุดเดิม
      // (payload รุ่นเก่าไม่มี sig → ไม่ผ่าน → สร้างใหม่ ซึ่งตั้งใจให้เป็นแบบนั้น)
      if (saved && saved.jobId === jobId && saved.sig === segSignature(preview)
          && rowsAreSane(saved.rows)) {
        restored = saved.rows;
      }
    } catch { /* localStorage อ่านไม่ได้ → สร้างใหม่ */ }

    setRows(restored || buildRows(preview, seed));
    setDuration(seed);
    builtFor.current = jobId;
  }, [preview, jobId, storageKey]);

  // ── เก็บสถานะไว้ กันหายตอนเข้าหน้าแก้ซับแล้วกดกลับ (App remount PreviewScreen) ──
  useEffect(() => {
    if (!jobId || rows.length === 0) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ jobId, sig: segSignature(preview), rows }));
    } catch { /* เต็ม/ปิดอยู่ → ข้าม */ }
  }, [rows, jobId, storageKey, preview]);

  /** วิดีโอโหลด metadata แล้ว — ต่อท้ายส่วนที่ยาวกว่าที่เดาไว้ (เพิ่มอย่างเดียว) */
  const applyVideoDuration = useCallback((videoDuration) => {
    if (!Number.isFinite(videoDuration) || videoDuration <= 0) return;
    setDuration((d) => Math.max(d, videoDuration));
    setRows((rs) => {
      if (rs.length === 0) return rs;
      const last = rs[rs.length - 1];
      if (videoDuration <= last.end + MIN_CUT_GAP) return rs;
      if (last.kind === 'cut' && last.end === last.origEnd) {
        // แถวท้ายเป็น cut ที่ยังไม่ถูกแก้ → ยืดออกไป
        const next = [...rs];
        next[rs.length - 1] = { ...last, end: snap(videoDuration), origEnd: snap(videoDuration) };
        return next;
      }
      return [...rs, {
        id: nextIds(rs, 'cut', 1)[0], kind: 'cut',
        start: last.end, end: snap(videoDuration),
        origStart: last.end, origEnd: snap(videoDuration),
        text: '', on: false,
      }];
    });
  }, []);

  const patchRow = useCallback((id, patch) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const toggle = useCallback((id) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, on: !r.on } : r)));
  }, []);

  const setAll = useCallback((on) => {
    setRows((rs) => rs.map((r) => ({ ...r, on })));
  }, []);

  // สร้างใหม่จาก preview ไม่ใช่ map ทับของเดิม — ไม่งั้น undo การแยกแถวไม่ได้
  // และนี่คือความหมายตรงตัวของ "คืนค่า AI" อยู่แล้ว
  const resetToAI = useCallback(() => {
    setRows(buildRows(preview, duration));
  }, [preview, duration]);

  /** แยกแถวที่ครอบเวลานี้ — คืนผลทันทีให้ UI ใช้ feedback */
  const splitAt = useCallback((time) => {
    const chk = describeSplit(rowsRef.current, time);
    if (!chk.ok) return chk;
    const rightId = nextIds(rowsRef.current, chk.row.kind, 1)[0];
    // ตรวจซ้ำใน updater กัน snapshot เก่า
    setRows((rs) => applySplit(rs, time, sortedTranscript));
    return { ...chk, ids: [chk.row.id, rightId] };
  }, [sortedTranscript]);

  /**
   * ขยับขอบ — เพราะแถวปูเต็มไทม์ไลน์ ขอบหนึ่งถูกแชร์กับเพื่อนบ้านเสมอ
   * จึงต้องขยับทั้งคู่ ไม่งั้นจะเกิดช่องโหว่/ทับซ้อน
   * clamp ให้ทั้งสองแถวเหลืออย่างน้อย MIN_ROW_LEN
   */
  const nudge = useCallback((id, edge, delta) => {
    // คำนวณจาก snapshot ปัจจุบันเพื่อคืนผลให้ UI ทันที (ใช้ตัดสินว่าจะเล่นให้ฟังไหม)
    const plan = planNudge(rowsRef.current, id, edge, delta, duration);
    if (plan.moved) setRows((rs) => applyNudge(rs, id, edge, delta, duration));
    return plan;
  }, [duration]);

  const stats = useMemo(() => {
    let count = 0;
    let dur = 0;
    rows.forEach((r) => { if (r.on) { count += 1; dur += r.end - r.start; } });
    return { count, dur, total: rows.length };
  }, [rows]);

  // r.split จำเป็น — dirty ที่ดูทีละแถวอย่างเดียวมองไม่เห็นว่าจำนวนแถวเปลี่ยนไป
  const dirty = useMemo(
    () => rows.some((r) => r.split || r.on !== (r.kind === 'ai')
                        || r.start !== r.origStart || r.end !== r.origEnd),
    [rows],
  );

  return { rows, duration, stats, dirty, toggle, setAll, resetToAI, nudge, splitAt,
           patchRow, applyVideoDuration };
}
