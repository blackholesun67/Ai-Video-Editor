import React, { useEffect, useRef, useState } from 'react';
import { Scissors } from 'lucide-react';
import { formatClock, formatLength } from './time';
import { describeSplit, SPLIT_REASON, snap } from './useTimelineRows';

// ลายทแยงสำหรับช่วงที่ไม่ได้เก็บ — บอกว่า "ตัดออก" โดยไม่ต้องใช้สีที่สอง
const CUT_FILL = 'repeating-linear-gradient(45deg, #e2e8f0 0 4px, #f1f5f9 4px 8px)';

/**
 * แถบไทม์ไลน์ใต้วิดีโอ — เห็นโครงสร้างทั้งคลิปในแวบเดียว แทนการอ่านตัวเลขแล้วประกอบภาพเอง
 * ทึบ = เก็บไว้ · ลายทแยง = ตัดออก · เส้นดำ = ตำแหน่งที่เล่นอยู่ · คลิกเพื่อ seek
 *
 * ถือ state ตำแหน่งเล่นไว้เอง (ไม่ยกขึ้นไป PreviewScreen) เพราะ timeupdate ยิง ~4 ครั้ง/วินาที
 * ถ้าอยู่ข้างบนจะ re-render ลิสต์ 50-200 แถวตลอดเวลาที่เล่น ; ตัวนี้เป็นพี่น้องของลิสต์
 * ปุ่มแยกช่วงอยู่ที่นี่ด้วยเพราะมันต้องรู้ตำแหน่ง และควรอยู่ติดกับเส้นที่บอกว่าจะแยกตรงไหน
 */
export default function TimelineStrip({ videoSrc, videoRef, rows, duration, onSplit }) {
  const [now, setNow] = useState(0);
  const barRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    let raf = 0;
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const t = snap(v.currentTime || 0);
        setNow((prev) => (prev === t ? prev : t));   // ค่าเดิม → ไม่ re-render
      });
    };
    v.addEventListener('timeupdate', sync);
    v.addEventListener('seeked', sync);
    v.addEventListener('loadedmetadata', sync);
    sync();
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener('timeupdate', sync);
      v.removeEventListener('seeked', sync);
      v.removeEventListener('loadedmetadata', sync);
    };
  }, [videoRef, videoSrc]);

  const total = duration > 0 ? duration : 0;
  const pct = (n) => `${Math.max(0, Math.min(100, (n / total) * 100))}%`;

  const seekTo = (e) => {
    const el = barRef.current;
    const v = videoRef.current;
    if (!el || !v || total <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    try {
      v.currentTime = Math.max(0, Math.min(total, ratio * total));
    } catch { /* ignore */ }
  };

  const chk = describeSplit(rows, now);
  const canSplit = chk.ok && !!videoSrc;
  const why = chk.ok ? '' : (SPLIT_REASON[chk.reason] || '');

  return (
    <div className="space-y-1.5">
      <div
        ref={barRef}
        onClick={seekTo}
        title="คลิกเพื่อเลื่อนวิดีโอไปตรงนั้น"
        className="relative h-9 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer"
      >
        {total > 0 && rows.map((r) => (
          <div
            key={r.id}
            className={r.on ? 'absolute inset-y-0 bg-indigo-500' : 'absolute inset-y-0'}
            style={{
              left: pct(r.start),
              width: pct(r.end - r.start),
              ...(r.on ? {} : { background: CUT_FILL }),
            }}
          />
        ))}
        {total > 0 && (
          <div
            className="absolute inset-y-0 w-0.5 bg-slate-900 pointer-events-none"
            style={{ left: pct(now) }}
          />
        )}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
        <span className="font-mono">0:00.0</span>
        <span className="font-mono font-semibold text-slate-700">▸ {formatClock(now)}</span>
        <span className="font-mono">{formatLength(total)}</span>
        <button
          type="button"
          onClick={() => onSplit(now)}
          disabled={!canSplit}
          title={why || 'แยกช่วงนี้ออกเป็นสองช่วง ตรงตำแหน่งที่เล่นอยู่'}
          className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            canSplit
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Scissors className="h-3.5 w-3.5" /> แยกตรงนี้
        </button>
      </div>
      {!chk.ok && why && <p className="text-[11px] text-slate-400 text-right">{why}</p>}
    </div>
  );
}
