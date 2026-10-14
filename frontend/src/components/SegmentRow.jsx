import React, { useState } from 'react';
import {
  Check, X, Play, Scissors, Minus, Plus, SplitSquareHorizontal, SlidersHorizontal, RotateCcw,
} from 'lucide-react';
import { formatClock, formatLength, formatStep } from './time';

export const STEP_OPTIONS = [1, 5, 15, 60];

const ROLE_LABEL = {
  hook: '🔥 Hook', insight: '💡 Insight', tension: '⚡ ปม', tease: '👀 ชวนดูต่อ',
};

const CHIP = 'px-2 py-0.5 rounded-md text-sm font-medium';
const LONG_ROW = 60;      // แถวยาวกว่านี้ → เตือนว่าแยกเป็นช่วงย่อยได้
// ปุ่มเล็กในแถว — สูง 44px บนมือถือ (เป้านิ้ว) ย่อลงบนจอกว้าง
const SMALL_BTN = 'min-h-11 sm:min-h-8 inline-flex items-center justify-center gap-1 rounded-lg border text-sm font-medium transition-colors';

/** ปุ่มขยับขอบ — เขียนขนาดก้าวบนตัวปุ่มเอง ("+5 วิ") ไม่งั้นแถวโกหกว่ากดแล้วเกิดอะไร */
function NudgeGroup({ label, step, onNudge }) {
  const btn = `${SMALL_BTN} px-2.5 text-slate-700 border-line-strong bg-white hover:bg-page`;
  const unit = formatStep(step);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-sm text-muted w-8">{label}</span>
      <button type="button" className={btn} title={`${label} เร็วขึ้น ${unit}`}
              onClick={(e) => { e.stopPropagation(); onNudge(-step); }}>
        <Minus className="h-3.5 w-3.5" />{unit}
      </button>
      <button type="button" className={btn} title={`${label} ช้าลง ${unit}`}
              onClick={(e) => { e.stopPropagation(); onNudge(step); }}>
        <Plus className="h-3.5 w-3.5" />{unit}
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

  // ไม่ใช้ opacity กับแถวที่ไม่ได้เก็บ — จะทำให้ตัวหนังสือจางกว่าเกณฑ์ข้อความรอง
  const border = isActive
    ? 'border-primary bg-white ring-2 ring-primary/20'
    : on
      ? 'border-primary/50 bg-white shadow-sm'
      : 'border-line-strong bg-page hover:border-primary/30';

  const actionBtn = (active) => `${SMALL_BTN} px-3 ${
    active ? 'bg-primary text-white border-primary'
           : 'bg-white border-line-strong text-primary-dark hover:bg-page'}`;

  return (
    <div
      data-row-id={row.id}
      onClick={onToggle}
      className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
        isCut ? 'border-dashed' : ''
      } ${border} ${isNew ? 'ring-2 ring-primary/40' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div
          role="checkbox"
          aria-checked={on}
          aria-label={on ? 'เก็บช่วงนี้ไว้' : 'ตัดช่วงนี้ออก'}
          className={`h-7 w-7 mt-0.5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            on ? 'bg-primary border-primary text-white' : 'bg-white border-line-strong text-slate-500'
          }`}
        >
          {on ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-4 w-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-x-2 gap-y-1.5 mb-1 flex-wrap">
            <span className="font-mono text-sm text-muted">
              {formatClock(start)} – {formatClock(end)}
            </span>
            <span className="text-sm font-semibold text-ink">ยาว {formatLength(len)}</span>

            {isCut && (
              <span className={`${CHIP} inline-flex items-center gap-1 border ${
                on ? 'bg-primary-soft border-primary/20 text-primary-dark' : 'bg-accent-soft border-accent-border text-accent-strong'
              }`}>
                <Scissors className="h-3.5 w-3.5" />
                {on ? 'เพิ่มเอง' : 'AI เสนอตัด'}
              </span>
            )}
            {!isCut && role && (
              <span className={`${CHIP} bg-primary-soft text-primary-dark`}>{ROLE_LABEL[role] || role}</span>
            )}
            {/* ครอบทั้งการแยกและการรวม — ทั้งคู่คือการแก้โครงของช่วงด้วยมือ
                ถ้าเขียนว่า "แยกเอง" อย่างเดียว ชิปจะค้างผิดหลังผู้ใช้รวมกลับ */}
            {split && (
              <span className={`${CHIP} inline-flex items-center gap-1 bg-slate-100 text-slate-700`}>
                <SplitSquareHorizontal className="h-3.5 w-3.5" /> แก้ช่วงเอง
              </span>
            )}
            {edited && <span className={`${CHIP} bg-amber-100 text-amber-800`}>ปรับเวลาแล้ว</span>}

            <span className="ml-auto inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {canPreview && (
                <button type="button" title="เล่นเฉพาะช่วงนี้" className={actionBtn(isActive)}
                        onClick={(e) => { e.stopPropagation(); onPreview(); }}>
                  <Play className="h-3.5 w-3.5" /> ฟัง
                </button>
              )}
              {/* ใช้ RotateCcw ไม่ใช่ไอคอนชื่อ Merge เพราะ lucide เวอร์ชันที่ pin ไว้ยังไม่ยืนยันว่ามี
                  และความหมาย "ย้อนการแยก" ก็ตรงกับสิ่งที่ปุ่มนี้ทำจริงมากกว่า */}
              {canMerge && (
                <button type="button" title="รวมกับช่วงถัดไป (ยกเลิกการแยก)"
                        aria-label="รวมกับช่วงถัดไป"
                        className={`${actionBtn(false)} min-w-11 sm:min-w-8`}
                        onClick={(e) => { e.stopPropagation(); onMerge(); }}>
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button type="button" title="ปรับเวลาหัว-ท้ายช่วงนี้" className={actionBtn(open)}
                      aria-expanded={open}
                      onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
                <SlidersHorizontal className="h-3.5 w-3.5" /> ปรับ
              </button>
            </span>
          </div>

          {text ? (
            <p className={`text-base leading-relaxed ${on ? 'text-slate-900' : 'text-muted'}`}>
              "{text}"
            </p>
          ) : isCut ? (
            <p className="text-sm italic text-muted">(ยังไม่มีข้อความซับ — อาจต้องแก้เอง)</p>
          ) : null}

          {reason && <p className="text-sm text-muted mt-1 italic">💡 {reason}</p>}

          {len > LONG_ROW && !open && (
            <p className="text-sm text-muted mt-1">
              ช่วงนี้ยาว ถ้าอยากตัดบางส่วน ใช้ปุ่ม "แยกตรงนี้" (ดูข้อ 4)
            </p>
          )}

          {open && (
            <div className="mt-2.5 pt-2.5 border-t border-line space-y-2"
                 onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm text-muted">ก้าวละ</span>
                {STEP_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onStepChange(s); }}
                    aria-pressed={step === s}
                    className={`${SMALL_BTN} px-2.5 ${
                      step === s
                        ? 'border-primary bg-primary text-white'
                        : 'border-line-strong bg-white text-slate-700 hover:bg-page'
                    }`}
                  >
                    {formatStep(s)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
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
