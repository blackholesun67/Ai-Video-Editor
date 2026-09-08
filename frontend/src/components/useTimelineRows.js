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

export const MIN_CUT_GAP = 0.4;    // ช่องว่างสั้นกว่านี้ กลืนเข้าแถว ai (ไม่สร้างแถวจิ๋ว)
export const MIN_ROW_LEN = 0.5;    // ความยาวขั้นต่ำของแถวหลังขยับขอบ
const MAX_TEXT_CHARS = 200;        // เท่ากับ _enrich_segments_with_text
const MERGE_EPS = 0.05;            // ช่วงที่ห่างน้อยกว่านี้ = ติดกัน ให้ merge ตอนส่ง

const round2 = (n) => Math.round(n * 100) / 100;

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
      start: round2(start),
      end: round2(end),
      origStart: round2(start),
      origEnd: round2(end),
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
      start: round2(start),
      end: round2(k.end),
      origStart: round2(start),
      origEnd: round2(k.end),
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
  return out.map((s) => ({ start: round2(s.start), end: round2(s.end) }));
}

export default function useTimelineRows(preview, jobId, storageKey) {
  const [rows, setRows] = useState([]);
  const [duration, setDuration] = useState(0);
  const builtFor = useRef(null);                    // กัน effect รันซ้ำแล้วล้างงานที่ผู้ใช้แก้

  // ── สร้างแถวครั้งเดียวต่อ jobId (หรือกู้จาก localStorage) ──
  useEffect(() => {
    if (!preview || !jobId || builtFor.current === jobId) return;
    const seed = seedDuration(preview);

    let restored = null;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      // กู้เฉพาะเมื่อเป็นงานเดียวกันและ AI ยังเสนอช่วงชุดเดิม
      if (saved && saved.jobId === jobId && Array.isArray(saved.rows)) {
        const savedAi = saved.rows.filter((r) => r.kind === 'ai');
        const cur = [...(preview.segments || [])].sort((a, b) => a.start - b.start);
        const same = savedAi.length === cur.length
          && savedAi.every((r, i) => Math.abs(r.origEnd - cur[i].end) < 0.02);
        if (same) restored = saved.rows;
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
      localStorage.setItem(storageKey, JSON.stringify({ jobId, rows }));
    } catch { /* เต็ม/ปิดอยู่ → ข้าม */ }
  }, [rows, jobId, storageKey]);

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
        next[rs.length - 1] = { ...last, end: round2(videoDuration), origEnd: round2(videoDuration) };
        return next;
      }
      return [...rs, {
        id: `cut-tail`, kind: 'cut',
        start: last.end, end: round2(videoDuration),
        origStart: last.end, origEnd: round2(videoDuration),
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

  const resetToAI = useCallback(() => {
    setRows((rs) => rs.map((r) => ({
      ...r, on: r.kind === 'ai', start: r.origStart, end: r.origEnd,
    })));
  }, []);

  /**
   * ขยับขอบ — เพราะแถวปูเต็มไทม์ไลน์ ขอบหนึ่งถูกแชร์กับเพื่อนบ้านเสมอ
   * จึงต้องขยับทั้งคู่ ไม่งั้นจะเกิดช่องโหว่/ทับซ้อน
   * clamp ให้ทั้งสองแถวเหลืออย่างน้อย MIN_ROW_LEN
   */
  const nudge = useCallback((id, edge, delta) => {
    setRows((rs) => {
      const i = rs.findIndex((r) => r.id === id);
      if (i === -1) return rs;
      const cur = rs[i];
      const nb = edge === 'start' ? rs[i - 1] : rs[i + 1];

      let d = delta;
      if (edge === 'start') {
        const lo = nb ? nb.start + MIN_ROW_LEN : 0;
        const hi = cur.end - MIN_ROW_LEN;
        d = Math.min(Math.max(cur.start + d, lo), hi) - cur.start;
      } else {
        const hi = nb ? nb.end - MIN_ROW_LEN : duration;
        const lo = cur.start + MIN_ROW_LEN;
        d = Math.min(Math.max(cur.end + d, lo), hi) - cur.end;
      }
      if (Math.abs(d) < 0.01) return rs;

      const next = [...rs];
      if (edge === 'start') {
        next[i] = { ...cur, start: round2(cur.start + d) };
        if (nb) next[i - 1] = { ...nb, end: round2(nb.end + d) };
      } else {
        next[i] = { ...cur, end: round2(cur.end + d) };
        if (nb) next[i + 1] = { ...nb, start: round2(nb.start + d) };
      }
      return next;
    });
  }, [duration]);

  const stats = useMemo(() => {
    let count = 0;
    let dur = 0;
    rows.forEach((r) => { if (r.on) { count += 1; dur += r.end - r.start; } });
    return { count, dur, total: rows.length };
  }, [rows]);

  const dirty = useMemo(
    () => rows.some((r) => r.on !== (r.kind === 'ai') || r.start !== r.origStart || r.end !== r.origEnd),
    [rows],
  );

  return { rows, duration, stats, dirty, toggle, setAll, resetToAI, nudge, patchRow, applyVideoDuration };
}
