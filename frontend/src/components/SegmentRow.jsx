import React, { useState } from 'react';
import {
  Check, X, Play, Scissors, Minus, Plus, SplitSquareHorizontal, SlidersHorizontal, RotateCcw,
} from 'lucide-react';
import { formatClock, formatLength, formatStep } from './time';

export const STEP_OPTIONS = [1, 5, 15, 60];

const ROLE_LABEL = {
  hook: '🔥 Hook', insight: '💡 Insight', tension: '⚡ ปม', tease: '👀 ชวนดูต่อ',
};

const CHIP = 'px-1.5 py-0.5 rounded text-[10px] font-medium';
const LONG_ROW = 60;      // แถวยาวกว่านี้ → เตือนว่าแยกเป็นช่วงย่อยได้

/** ปุ่มขยับขอบ — เขียนขนาดก้าวบนตัวปุ่มเอง ("+5 วิ") ไม่งั้นแถวโกหกว่ากดแล้วเกิดอะไร */
function NudgeGroup({ label, step, onNudge }) {
  const btn = 'h-6 px-1.5 inline-flex items-center gap-0.5 justify-center rounded border '
    + 'text-[10px] text-slate-600 border-slate-200 bg-white hover:bg-slate-50 '
    + 'hover:text-slate-800 transition-colors';
  const unit = formatStep(step);
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[10px] text-slate-400 w-6">{label}</span>
      <button type="button" className={btn} title={`${label} เร็วขึ้น ${unit}`}
              onClick={(e) => { e.stopPropagation(); onNudge(-step); }}>
        <Minus className="h-2.5 w-2.5" />{unit}
      </button>
      <button type="button" className={btn} title={`${label} ช้าลง ${unit}`}
              onClick={(e) => { e.stopPropagation(); onNudge(step); }}>
        <Plus className="h-2.5 w-2.5" />{unit}
      </button>
    </span>
  );
}

/**
 * แถวเดียวในหน้า preview — รองรับทั้งช่วงที่ AI เลือก (kind='ai')
 * และช่วงที่ AI ตัดทิ้ง (kind='cut') ซึ่งผู้ใช้กดเอากลับมาได้
 *
 * สีบอก "ติ๊กอยู่ไหม" · เส้นขอบบอก "มาจากไหน" (ทึบ=AI, ประ=ช่วงที่ถูกตัด)
 *
 * ปุ่มขยับขอบซ่อนอยู่หลังปุ่มปรับโดยตั้งใจ — การใช้งานส่วนใหญ่คือดูแล้วติ๊กออก
 * ถ้าโชว์ 4 ปุ่มทุกแถวจะไปแย่งความสนใจกับข้อความ transcript ซึ่งเป็นสิ่งที่ต้องอ่านเพื่อตัดสินใจ
 * ตัวเลือกขนาดก้าวอยู่ในนี้ด้วย เพราะมันมีความหมายเฉพาะตอนขยับขอบ
 */
export default function SegmentRow({
  row, isActive, isNew, canPreview, step, onStepChange, onToggle, onPreview, onNudge,
  canMerge, onMerge,
}) {
  const [open, setOpen] = useState(false);
  const { kind, start, end, on, text, role, reason, origStart, origEnd, split } = row;
  const isCut = kind === 'cut';
  const len = end - start;
  const edited = start !== origStart || end !== origEnd;

  const border = isActive
    ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-200'
    : on
      ? 'border-indigo-400 bg-indigo-50/40 shadow-sm'
      : 'border-slate-200 bg-slate-50/50 opacity-60 hover:opacity-80';

  const iconBtn = (active) => `h-7 w-7 inline-flex items-center justify-center rounded-md border transition-colors ${
    active ? 'bg-indigo-600 text-white border-indigo-600'
           : 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`;

  return (
    <div
      data-row-id={row.id}
      onClick={onToggle}
      className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
        isCut ? 'border-dashed' : ''
      } ${border} ${isNew ? 'ring-2 ring-indigo-300' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className={`h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
          on ? 'bg-indigo-500 text-white' : 'bg-slate-300 text-slate-500'
        }`}>
          {on ? <Check className="h-4 w-4" /> : <X className="h-3.5 w-3.5" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs mb-1 flex-wrap">
            <span className="font-mono text-slate-400">
              {formatClock(start)} – {formatClock(end)}
            </span>
            <span className="font-semibold text-slate-700">ยาว {formatLength(len)}</span>

            {isCut && (
              <span className={`${CHIP} inline-flex items-center gap-1 ${
                on ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
              }`}>
                <Scissors className="h-2.5 w-2.5" />
                {on ? 'เพิ่มเอง' : 'AI ตัดออก'}
              </span>
            )}
            {!isCut && role && (
              <span className={`${CHIP} bg-indigo-50 text-indigo-600`}>{ROLE_LABEL[role] || role}</span>
            )}
            {/* ครอบทั้งการแยกและการรวม — ทั้งคู่คือการแก้โครงของช่วงด้วยมือ
                ถ้าเขียนว่า "แยกเอง" อย่างเดียว ชิปจะค้างผิดหลังผู้ใช้รวมกลับ */}
            {split && (
              <span className={`${CHIP} inline-flex items-center gap-1 bg-slate-100 text-slate-600`}>
                <SplitSquareHorizontal className="h-2.5 w-2.5" /> แก้ช่วงเอง
              </span>
            )}
            {edited && <span className={`${CHIP} bg-amber-100 text-amber-700`}>ปรับเวลาแล้ว</span>}

            <span className="ml-auto inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {canPreview && (
                <button type="button" title="เล่นเฉพาะช่วงนี้" className={iconBtn(isActive)}
                        onClick={(e) => { e.stopPropagation(); onPreview(); }}>
                  <Play className="h-3.5 w-3.5" />
                </button>
              )}
              {/* ใช้ RotateCcw ไม่ใช่ไอคอนชื่อ Merge เพราะ lucide เวอร์ชันที่ pin ไว้ยังไม่ยืนยันว่ามี
                  และความหมาย "ย้อนการแยก" ก็ตรงกับสิ่งที่ปุ่มนี้ทำจริงมากกว่า */}
              {canMerge && (
                <button type="button" title="รวมกับช่วงถัดไป (ยกเลิกการแยก)"
                        className={iconBtn(false)}
                        onClick={(e) => { e.stopPropagation(); onMerge(); }}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button type="button" title="ปรับเวลาหัว-ท้ายช่วงนี้" className={iconBtn(open)}
                      onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>

          {text ? (
            <p className={`text-sm leading-relaxed ${on ? 'text-slate-800' : 'text-slate-500'}`}>
              "{text}"
            </p>
          ) : isCut ? (
            <p className="text-sm italic text-slate-400">(ไม่มีเสียงพูด)</p>
          ) : null}

          {reason && <p className="text-xs text-slate-500 mt-1 italic">💡 {reason}</p>}

          {len > LONG_ROW && !open && (
            <p className="text-[11px] text-slate-400 mt-1">
              ช่วงนี้ยาว — เลื่อนวิดีโอไปจุดที่ต้องการแล้วกด ✂ แยกเป็นช่วงย่อยได้
            </p>
          )}

          {open && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-200/70 space-y-2"
                 onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400">ก้าวละ</span>
                {STEP_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onStepChange(s); }}
                    className={`text-[10px] px-2 py-0.5 rounded border font-medium transition-colors ${
                      step === s
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {formatStep(s)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <NudgeGroup label="เริ่ม" step={step} onNudge={(d) => onNudge('start', d)} />
                <NudgeGroup label="จบ" step={step} onNudge={(d) => onNudge('end', d)} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
