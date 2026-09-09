import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Scissors, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatClock, formatLength } from './time';
import { describeSplit, SPLIT_REASON, snap } from './useTimelineRows';

// ลายทแยงสำหรับช่วงที่ไม่ได้เก็บ — บอกว่า "ตัดออก" โดยไม่ต้องใช้สีที่สอง
const CUT_FILL = 'repeating-linear-gradient(45deg, #e2e8f0 0 4px, #f1f5f9 4px 8px)';

// ขีดที่ชิดหัว/ท้ายคลิปไม่มีประโยชน์ (ffmpeg มักรายงานเฟรมสุดท้ายเป็นฉากเปลี่ยน)
const EDGE_IGNORE = 0.5;
// ถือว่า "อยู่ตรงขีดแล้ว" ถ้าห่างไม่เกินนี้ — ใช้กันปุ่มข้ามฉากติดอยู่กับขีดเดิม
const AT_CUT = 0.05;

// หมายเหตุการออกแบบ: เคยลองให้ "คลิกบนแถบแล้วดูดเข้าขีดที่ใกล้ที่สุด" แต่วัดแล้วพบว่า
// คลิปที่ตัดต่อถี่ (78 ขีดใน 420 วิ = ทุก 5.4 วิ) ระยะดูด 2 วิ กินพื้นที่ 60.5% ของแถบ
// ผู้ใช้จะเลื่อนไปจุดที่ตัวเองต้องการไม่ได้เลย — เป็นรูปแบบ "ยิงกว้างเกิน" แบบเดียวกับ
// THOUGHT_GRACE จึงเปลี่ยนเป็นปุ่มข้ามฉากที่ผู้ใช้สั่งเอง: แม่นยำ คาดเดาได้ และไม่แย่งการควบคุม

/**
 * แถบไทม์ไลน์ใต้วิดีโอ — เห็นโครงสร้างทั้งคลิปในแวบเดียว แทนการอ่านตัวเลขแล้วประกอบภาพเอง
 * ทึบ = เก็บไว้ · ลายทแยง = ตัดออก · เส้นดำ = ตำแหน่งที่เล่นอยู่ · คลิกเพื่อ seek
 *
 * ถือ state ตำแหน่งเล่นไว้เอง (ไม่ยกขึ้นไป PreviewScreen) เพราะ timeupdate ยิง ~4 ครั้ง/วินาที
 * ถ้าอยู่ข้างบนจะ re-render ลิสต์ 50-200 แถวตลอดเวลาที่เล่น ; ตัวนี้เป็นพี่น้องของลิสต์
 * ปุ่มแยกช่วงอยู่ที่นี่ด้วยเพราะมันต้องรู้ตำแหน่ง และควรอยู่ติดกับเส้นที่บอกว่าจะแยกตรงไหน
 */
export default function TimelineStrip({
  videoSrc, videoRef, rows, duration, onSplit, visual,
}) {
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

  // ขีดฉากเปลี่ยน + ช่วงเฟรมดำจากการวิเคราะห์ภาพ (งานเก่าไม่มี → ว่าง)
  const cuts = useMemo(() => {
    const raw = visual?.scene_cuts;
    if (!Array.isArray(raw) || total <= 0) return [];
    return raw
      .map(Number)
      .filter((t) => Number.isFinite(t) && t > EDGE_IGNORE && t < total - EDGE_IGNORE)
      .sort((a, b) => a - b);   // stepScene ใช้ .find จึงต้องเรียงจากน้อยไปมาก
  }, [visual, total]);

  const blacks = useMemo(() => {
    const raw = visual?.black;
    if (!Array.isArray(raw) || total <= 0) return [];
    return raw.filter((b) => Number.isFinite(b?.start) && b.end > b.start);
  }, [visual, total]);

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

  /** เลื่อนไปยังจุดฉากเปลี่ยนก่อนหน้า/ถัดไปให้ตรงเป๊ะ (dir = -1 | 1) */
  const stepScene = (dir) => {
    const v = videoRef.current;
    if (!v || !cuts.length) return;
    const next = dir > 0
      ? cuts.find((c) => c > now + AT_CUT)
      : [...cuts].reverse().find((c) => c < now - AT_CUT);
    if (next === undefined) return;
    try {
      v.currentTime = next;
    } catch { /* ignore */ }
  };

  const hasPrev = cuts.some((c) => c < now - AT_CUT);
  const hasNext = cuts.some((c) => c > now + AT_CUT);

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
        {/* ขีดฉากเปลี่ยน — บาง จาง ไม่แย่งความสนใจจากสีเก็บ/ตัด ; กระโดดไปด้วยปุ่ม ‹ ฉาก › */}
        {cuts.map((t) => (
          <div
            key={`sc-${t}`}
            className="absolute inset-y-0 w-px bg-slate-500/45 pointer-events-none"
            style={{ left: pct(t) }}
          />
        ))}
        {/* เฟรมดำ — พบน้อยและมักเป็นช่วงว่างจริง จึงคุ้มที่จะเห็น */}
        {blacks.map((b) => (
          <div
            key={`bk-${b.start}`}
            className="absolute bottom-0 h-1 bg-slate-900/70 pointer-events-none"
            style={{ left: pct(b.start), width: pct(b.end - b.start) }}
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
        {cuts.length > 0 && (
          <span className="inline-flex items-center gap-1 ml-1">
            <button
              type="button" onClick={() => stepScene(-1)} disabled={!hasPrev}
              title="ไปจุดฉากเปลี่ยนก่อนหน้า"
              className={`h-6 w-6 inline-flex items-center justify-center rounded border text-[11px] ${
                hasPrev ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'}`}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] text-slate-400">ฉาก</span>
            <button
              type="button" onClick={() => stepScene(1)} disabled={!hasNext}
              title="ไปจุดฉากเปลี่ยนถัดไป"
              className={`h-6 w-6 inline-flex items-center justify-center rounded border text-[11px] ${
                hasNext ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'}`}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
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
      {cuts.length > 0 && (
        <p className="text-[11px] text-slate-400">
          เส้นจาง {cuts.length} เส้นคือจุดที่ภาพเปลี่ยนฉาก — กดปุ่ม ‹ ฉาก › เพื่อกระโดดไปให้ตรงจุด
          {blacks.length > 0 && ` · แถบดำล่าง ${blacks.length} ช่วงคือจอดำ`}
        </p>
      )}
    </div>
  );
}
