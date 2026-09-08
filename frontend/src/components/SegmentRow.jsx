import React from 'react';
import { Check, X, Play, Scissors, Minus, Plus } from 'lucide-react';

const formatTime = (sec) => {
  const s = Math.floor(sec || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

const ROLE_LABEL = {
  hook: '🔥 Hook', insight: '💡 Insight', tension: '⚡ ปม', tease: '👀 ชวนดูต่อ',
};

/** ปุ่มขยับขอบ ±1 วินาที — หยุด propagation ไม่ให้ไป toggle แถว */
function NudgeGroup({ label, onNudge, disabled }) {
  const btn = 'h-6 w-6 inline-flex items-center justify-center rounded border text-slate-500 ' +
    'border-slate-200 bg-white hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 ' +
    'disabled:cursor-not-allowed transition-colors';
  return (
    <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <span className="text-[10px] text-slate-400">{label}</span>
      <button type="button" className={btn} disabled={disabled}
              title={`${label} เร็วขึ้น 1 วินาที`}
              onClick={(e) => { e.stopPropagation(); onNudge(-1); }}>
        <Minus className="h-3 w-3" />
      </button>
      <button type="button" className={btn} disabled={disabled}
              title={`${label} ช้าลง 1 วินาที`}
              onClick={(e) => { e.stopPropagation(); onNudge(1); }}>
        <Plus className="h-3 w-3" />
      </button>
    </span>
  );
}

/**
 * แถวเดียวในหน้า preview — รองรับทั้งช่วงที่ AI เลือก (kind='ai')
 * และช่วงที่ AI ตัดทิ้ง (kind='cut') ซึ่งผู้ใช้กดเอากลับมาได้
 *
 * สีบอก "ติ๊กอยู่ไหม" · เส้นขอบบอก "มาจากไหน" (ทึบ=AI, ประ=ช่วงที่ถูกตัด)
 */
export default function SegmentRow({
  row, isActive, canPreview, onToggle, onPreview, onNudge, showNudge,
}) {
  const { kind, start, end, on, text, role, reason, origStart, origEnd } = row;
  const isCut = kind === 'cut';
  const duration = end - start;
  const edited = start !== origStart || end !== origEnd;

  const border = isActive
    ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-200'
    : on
      ? 'border-indigo-400 bg-indigo-50/40 shadow-sm'
      : 'border-slate-200 bg-slate-50/50 opacity-60 hover:opacity-80';

  return (
    <div
      onClick={onToggle}
      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
        isCut ? 'border-dashed' : ''
      } ${border}`}
    >
      <div className="flex items-start gap-3">
        <div className={`h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
          on ? 'bg-indigo-500 text-white' : 'bg-slate-300 text-slate-500'
        }`}>
          {on ? <Check className="h-4 w-4" /> : <X className="h-3.5 w-3.5" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5 flex-wrap">
            <span className="font-mono">{formatTime(start)} – {formatTime(end)}</span>
            <span className="font-semibold text-slate-700">({duration.toFixed(1)}s)</span>

            {isCut && (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                on ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
              }`}>
                <Scissors className="h-2.5 w-2.5" />
                {on ? 'เพิ่มเอง' : 'AI ตัดออก'}
              </span>
            )}
            {!isCut && role && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600">
                {ROLE_LABEL[role] || role}
              </span>
            )}
            {edited && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                ปรับเวลาแล้ว
              </span>
            )}

            {canPreview && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onPreview(); }}
                className={`ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <Play className="h-3 w-3" /> ดูช่วงนี้
              </button>
            )}
          </div>

          {text ? (
            <p className={`text-sm leading-relaxed ${on ? 'text-slate-800' : 'text-slate-500'}`}>
              "{text}"
            </p>
          ) : isCut ? (
            <p className="text-sm italic text-slate-400">(ไม่มีเสียงพูด)</p>
          ) : null}

          {reason && <p className="text-xs text-slate-500 mt-1 italic">💡 {reason}</p>}

          {showNudge && (
            <div className="flex items-center gap-4 mt-2.5 pt-2 border-t border-slate-200/70">
              <NudgeGroup label="เริ่ม" onNudge={(d) => onNudge('start', d)} />
              <NudgeGroup label="จบ" onNudge={(d) => onNudge('end', d)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
