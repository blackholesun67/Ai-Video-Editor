import React, { useEffect, useState } from 'react';
import { Scissors, MoveHorizontal } from 'lucide-react';
import { formatClock, formatStep } from './time';
import { describeSplit, SPLIT_REASON, snap } from './useTimelineRows';

export const STEP_OPTIONS = [1, 5, 15, 60];

/**
 * แถบควบคุมใต้วิดีโอ — ตำแหน่งที่เล่นอยู่ + ปุ่มแยกช่วง + ตัวเลือกขนาดก้าว
 *
 * แยกเป็นคอมโพเนนต์ต่างหากโดยตั้งใจ: timeupdate ยิง ~4 ครั้ง/วินาที
 * ถ้าเก็บ currentTime ไว้ใน PreviewScreen จะ re-render ทั้งลิสต์ (50-200 แถว) ตลอดเวลาที่เล่น
 * ตัวนี้เป็น "พี่น้อง" ของลิสต์ ไม่ใช่พ่อ → แถวไม่ถูกแตะโดยโครงสร้าง ไม่ต้องพึ่ง memo
 * (React.memo ช่วยไม่ได้อยู่แล้ว เพราะ handler ที่ส่งลงแถวเป็น arrow inline สร้างใหม่ทุกครั้ง)
 */
export default function PlayheadBar({ videoSrc, videoRef, rows, step, onStepChange, onSplit }) {
  const [now, setNow] = useState(0);

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

  const chk = describeSplit(rows, now);
  const canSplit = chk.ok;
  const why = canSplit ? '' : (SPLIT_REASON[chk.reason] || '');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">
          ตำแหน่ง <span className="font-mono font-semibold text-slate-700">{formatClock(now)}</span>
        </span>
        {canSplit && (
          <span className="text-[11px] text-slate-400">
            · จะแยกช่วง {formatClock(chk.row.start)} – {formatClock(chk.row.end)} ตรงนี้
          </span>
        )}
        <button
          type="button"
          onClick={() => onSplit(now)}
          disabled={!canSplit || !videoSrc}
          title={why || 'แยกช่วงนี้ออกเป็นสองช่วงตรงตำแหน่งที่เล่นอยู่'}
          className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            canSplit && videoSrc
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Scissors className="h-3.5 w-3.5" /> แยกตรงนี้
        </button>
      </div>

      {!canSplit && why && <p className="text-[11px] text-slate-400">{why}</p>}

      <div className="flex items-center gap-1.5 flex-wrap border-t border-slate-100 pt-2.5">
        <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
          <MoveHorizontal className="h-3 w-3" /> ขยับขอบก้าวละ
        </span>
        {STEP_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onStepChange(s)}
            className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition-colors ${
              step === s
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {formatStep(s)}
          </button>
        ))}
      </div>
    </div>
  );
}
