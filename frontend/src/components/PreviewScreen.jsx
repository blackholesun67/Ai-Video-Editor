import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import {
  X, Eye, Play, Loader2, AlertTriangle, RotateCcw, HelpCircle,
} from 'lucide-react';
import { API_URL, PREVIEW_ROWS_KEY, fetchMediaToken } from '../config';
import useTimelineRows, { toRenderSegments, describeMerge } from './useTimelineRows';
import SegmentRow from './SegmentRow';
import TimelineStrip from './TimelineStrip';
import { formatLength } from './time';

// ปุ่มในแถบเครื่องมือเหนือรายการ — สูง 44px บนมือถือ
const TOOL_BTN = 'min-h-11 sm:min-h-9 px-3 rounded-lg border text-sm font-medium transition-colors';

const FILTERS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'ai', label: '✓ AI ให้เก็บ' },
  { id: 'cut', label: '✕ AI เสนอตัด' },
];

// จำว่าผู้ใช้เปิด/ซ่อนกล่องวิธีใช้ไว้ (ค่าเริ่มต้น = เปิด) — เป็นแค่ความสะดวก อ่าน/เขียนไม่ได้ก็ไม่เป็นไร
const HELP_KEY = 'aive_preview_help';
const readHelpOpen = () => {
  try { return localStorage.getItem(HELP_KEY) !== '0'; } catch { return true; }
};

/** ข้อหนึ่งในกล่องวิธีใช้ — วงกลมเลข + หัวข้อ + 2 บรรทัด */
function HelpItem({ n, title, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="h-7 w-7 flex-shrink-0 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-base font-semibold text-ink">{title}</p>
        <div className="text-sm text-muted leading-relaxed mt-0.5 space-y-0.5">{children}</div>
      </div>
    </div>
  );
}

const PreviewScreen = ({ jobId, onRendering, onCancel, onEditSubtitle }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [activeId, setActiveId] = useState(null);      // แถวที่กำลังเล่นพรีวิว
  const [filter, setFilter] = useState('all');
  const [step, setStep] = useState(1);              // ขนาดก้าวของปุ่มขยับขอบ
  const [flashIds, setFlashIds] = useState([]);     // แถวที่เพิ่งถูกแยก (ไฮไลต์ชั่วคราว)
  const [confirmReset, setConfirmReset] = useState(false);
  const [helpOpen, setHelpOpen] = useState(readHelpOpen);

  const toggleHelp = () => {
    const next = !helpOpen;
    setHelpOpen(next);
    try { localStorage.setItem(HELP_KEY, next ? '1' : '0'); } catch { /* ignore */ }
  };

  // ยกเลิก = ล้างงานทั้งหมดกลับหน้าอัปโหลด (onCancel) — ถามยืนยันแบบเดียวกับปุ่มใน header กันกดพลาด
  const handleCancelConfirm = () => {
    if (window.confirm('ยกเลิกงานนี้? งานปัจจุบันและวิดีโอที่ตัดไว้จะถูกล้างทั้งหมด')) {
      onCancel();
    }
  };

  const videoRef = useRef(null);
  const playEndRef = useRef(null);
  const auditionRef = useRef(null);       // debounce ฟังรอยตัดหลังขยับขอบ
  const rowsRef = useRef([]);             // rows ล่าสุด สำหรับ callback ที่ debounce
  const flashRef = useRef(null);

  const {
    rows, duration, stats, dirty, toggle, setAll, resetToAI, nudge, splitAt, mergeWithNext,
    applyVideoDuration,
  } = useTimelineRows(preview, jobId, PREVIEW_ROWS_KEY);

  // media token สำหรับเล่นวิดีโอต้นฉบับ (แนบใน query ของ <video src>)
  const [mediaToken, setMediaToken] = useState(null);

  // Load preview data + media token
  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_URL}/preview/${jobId}`)
      .then((res) => {
        if (cancelled) return;
        setPreview(res.data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.detail || 'โหลดตัวอย่างไม่สำเร็จ');
        setLoading(false);
      });
    fetchMediaToken(jobId).then((t) => { if (!cancelled) setMediaToken(t); });
    return () => { cancelled = true; };
  }, [jobId]);

  // URL วิดีโอต้นฉบับ (preview.video_path = "storage/{job_id}/{file}") ผ่าน /media + media token
  // FileResponse ฝั่ง backend รองรับ HTTP Range → เพลเยอร์ seek ได้
  const videoSrc = useMemo(() => {
    const p = preview?.video_path;
    if (!p || !mediaToken) return null;
    const rel = p.replace(/\\/g, '/').replace(/^storage\//, '');
    return `${API_URL}/media/${rel}?token=${mediaToken}`;
  }, [preview, mediaToken]);

  const visibleRows = useMemo(() => {
    if (filter === 'ai') return rows.filter((r) => r.kind === 'ai');
    if (filter === 'cut') return rows.filter((r) => r.kind === 'cut');
    return rows;
  }, [rows, filter]);

  const counts = useMemo(() => ({
    all: rows.length,
    ai: rows.filter((r) => r.kind === 'ai').length,
    cut: rows.filter((r) => r.kind === 'cut').length,
  }), [rows]);

  // คำแนะนำตามสถานการณ์ — ดีกว่าอธิบาย 4 ขั้นตอนค้างไว้ตลอดเวลา
  const hint = useMemo(() => {
    if (rows.length === 0) return '';
    if (stats.count === 0) return 'ติ๊กช่วงที่อยากเก็บไว้ในวิดีโอ';
    if (rows.length === 1) return 'อยากตัดเป็นช่วงย่อย? เลื่อนวิดีโอไปจุดที่ต้องการแล้วกด "แยกตรงนี้"';
    if (!dirty) return 'ทำไฮไลต์: กด "ล้าง" แล้วติ๊กเฉพาะช่วงที่ชอบ · ตัดไม่พอดีใช้ปุ่มปรับในแถวได้';
    return '';
  }, [rows.length, stats.count, dirty]);

  // เล่นพรีวิวเฉพาะช่วงนั้น — seek ไป start แล้วหยุดที่ end
  const previewRow = (row) => {
    const v = videoRef.current;
    if (!v) return;
    playEndRef.current = row.end;
    setActiveId(row.id);
    try {
      v.currentTime = row.start;
      v.play().catch(() => {});
      v.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch { /* ignore */ }
  };

  // ขอบของแถวที่กำลังเล่นเปลี่ยน (จากการขยับขอบ) → อัปเดตจุดหยุดให้ตรง
  useEffect(() => {
    rowsRef.current = rows;                     // ให้ callback ที่ debounce อ่านค่าล่าสุดได้
    if (activeId == null || playEndRef.current == null) return;
    const active = rows.find((r) => r.id === activeId);
    if (active) playEndRef.current = active.end;
  }, [rows, activeId]);

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (v && playEndRef.current != null && v.currentTime >= playEndRef.current) {
      v.pause();
      playEndRef.current = null;
    }
  };

  // เลิกนับเวลาฟังรอยตัดเมื่อออกจากหน้า
  useEffect(() => () => { clearTimeout(auditionRef.current); clearTimeout(flashRef.current); }, []);

  /**
   * ขยับขอบแล้วเล่นให้ฟังรอบ ๆ รอยตัดอัตโนมัติ
   * จำเป็นเพราะไม่มี timeline scrubber — ไม่งั้นผู้ใช้กดปุ่มโดยไม่รู้ว่าได้ผลยังไง
   */
  const handleNudge = (row, edge, delta) => {
    const { moved } = nudge(row.id, edge, delta);
    if (!moved) return;                      // ชน clamp แล้ว — อย่าให้วิดีโอกระโดดเล่นซ้ำโดยไม่มีอะไรเปลี่ยน
    clearTimeout(auditionRef.current);
    auditionRef.current = setTimeout(() => {
      const v = videoRef.current;
      if (!v) return;
      const fresh = rowsRef.current.find((r) => r.id === row.id);
      if (!fresh) return;
      const at = edge === 'start' ? fresh.start : fresh.end;
      playEndRef.current = Math.min(at + 1.0, fresh.end + 1.0);
      setActiveId(row.id);
      try {
        v.currentTime = Math.max(0, at - 1.5);
        v.play().catch(() => {});
      } catch { /* ignore */ }
    }, 400);
  };

  /**
   * รวมแถวกับแถวถัดไป — ตัวกลับของการแยก
   * ถ้ากำลังเล่นแถวขวาที่ถูกกลืนหายไป ให้ย้าย activeId มาที่แถวผลลัพธ์
   * ไม่งั้นไฮไลต์ค้างบนแถวที่ไม่มีอยู่แล้ว และ playEndRef จะไม่ถูกอัปเดตตาม
   */
  const handleMerge = (row) => {
    const res = mergeWithNext(row.id);
    if (!res.ok) return;
    if (activeId === res.next.id) setActiveId(row.id);
    setFlashIds([row.id]);
    clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setFlashIds([]), 1500);
  };

  /** แยกช่วงตรงตำแหน่งที่เล่นอยู่ แล้วเลื่อนไปหาครึ่งขวาให้เห็น */
  const handleSplit = (at) => {
    const res = splitAt(at);
    if (!res.ok) return;
    setFlashIds(res.ids);
    clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setFlashIds([]), 1500);
    requestAnimationFrame(() => {
      document.querySelector(`[data-row-id="${res.ids[1]}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const handleReset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }   // ลบ split ทิ้งด้วย → ยืนยัน 2 คลิก
    resetToAI();
    setActiveId(null);
    setConfirmReset(false);
  };

  const handleConfirm = async () => {
    if (stats.count === 0) {
      setSubmitError('กรุณาเลือกอย่างน้อย 1 ช่วง');
      return;
    }
    setSubmitError('');
    const chosen = toRenderSegments(rows);

    if (preview?.burn_subtitle && onEditSubtitle) {
      onEditSubtitle(chosen);
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/render/${jobId}`, { segments: chosen });
      onRendering(res.data.task_id);
    } catch (err) {
      setSubmitError(err.response?.data?.detail || 'ส่งไปตัดต่อไม่สำเร็จ — กรุณาลองใหม่');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-line p-12 text-center">
        <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-3" />
        <p className="text-base text-muted">กำลังโหลดตัวอย่าง...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <p className="text-sm text-red-700 mb-4">{error}</p>
        <button
          onClick={onCancel}
          className="min-h-11 px-5 py-2.5 bg-white border border-line-strong text-ink rounded-xl font-semibold hover:bg-page"
        >
          กลับ
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero — ป้าย + หัวข้อ + บรรทัดรอง + ปุ่มวิธีใช้ อยู่กึ่งกลางทั้งหมด */}
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-soft text-primary-dark rounded-full text-sm font-medium mb-2">
          <Eye className="h-4 w-4" />
          ดูตัวอย่าง
        </div>
        <h2 className="text-2xl sm:text-[26px] font-semibold text-ink leading-snug">
          เลือกช่วงที่จะ<span className="text-primary">เก็บไว้</span>
        </h2>
        <p className="text-base text-muted mt-1">
          AI เลือกให้แล้ว ตรวจดู แล้วแก้เฉพาะจุดที่ไม่ตรงใจ
        </p>
        <button
          type="button"
          onClick={toggleHelp}
          aria-expanded={helpOpen}
          aria-controls="preview-help"
          className="mt-3 min-h-11 sm:min-h-9 inline-flex items-center gap-1.5 px-3.5 rounded-full bg-accent-soft border border-accent-border text-accent-strong text-sm font-medium hover:bg-orange-100 transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
          {helpOpen ? 'ซ่อนวิธีใช้' : 'วิธีใช้หน้านี้'}
        </button>
      </div>

      {/* วิธีใช้หน้านี้ — 2×2 บนคอม คอลัมน์เดียวบนมือถือ */}
      {helpOpen && (
        <section id="preview-help" className="bg-white border border-accent-border rounded-2xl p-4 sm:p-5">
          <h3 className="text-base font-semibold text-ink mb-3">วิธีใช้หน้านี้</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <HelpItem n={1} title="อ่านแถบเวลา">
              <p className="flex items-center gap-2">
                <span className="inline-block h-3.5 w-5 rounded-sm bg-primary flex-shrink-0" /> สีเข้ม = เก็บไว้
              </p>
              <p className="flex items-center gap-2">
                <span className="inline-block h-3.5 w-5 rounded-sm cut-stripes border border-line-strong flex-shrink-0" /> ขีดเฉียงสีเทา = AI เสนอให้ตัดออก
              </p>
            </HelpItem>
            <HelpItem n={2} title="เลือกเก็บหรือตัด">
              <p>กดช่องหน้าแต่ละช่วง ✓ = เก็บ ✕ = ตัดออก</p>
              <p>ปุ่มกรองเหนือรายการช่วยดูทีละแบบ</p>
            </HelpItem>
            <HelpItem n={3} title="ฟังและปรับเวลา">
              <p>กด "ฟัง" เพื่อฟังช่วงนั้นก่อน</p>
              <p>กด "ปรับ" เพื่อเลื่อนเวลาเริ่มหรือจบ</p>
            </HelpItem>
            <HelpItem n={4} title="ตัดบางส่วนในช่วงยาว">
              <p>หยุดวิดีโอตรงจุดที่จะตัด แล้วกด "แยกตรงนี้"</p>
              <p>จากนั้นกด ✕ ที่ส่วนที่ไม่เอา</p>
            </HelpItem>
          </div>
          <p className="text-sm text-muted mt-4 pt-3 border-t border-line">
            ไม่แน่ใจ กด "คืนค่า AI" เพื่อกลับไปใช้ช่วงที่ AI เลือกไว้
          </p>
        </section>
      )}

      {/* Video player (ต้นฉบับ) — seek ดูแต่ละช่วงได้ */}
      {videoSrc && (
        <div className="rounded-2xl overflow-hidden bg-slate-900 border border-line">
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={(e) => applyVideoDuration(e.currentTarget.duration)}
            className="w-full max-h-[45vh] object-contain bg-black"
          />
        </div>
      )}

      <TimelineStrip
        videoSrc={videoSrc}
        videoRef={videoRef}
        rows={rows}
        duration={duration}
        onSplit={handleSplit}
        visual={preview?.visual}
      />

      {/* แถบเครื่องมือ 2 แถว: (1) สรุป ซ้าย + ปุ่มจัดการ ขวา  (2) ปุ่มกรอง */}
      <div className="space-y-2 border-y border-line py-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-base font-semibold text-ink">
            {stats.count} ช่วง · {formatLength(stats.dur)}
          </span>
          <span className="inline-flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setAll(true)}
              className={`${TOOL_BTN} bg-white border-line-strong text-slate-700 hover:bg-page`}
            >
              เลือกทั้งหมด
            </button>
            <button
              onClick={() => setAll(false)}
              className={`${TOOL_BTN} bg-white border-line-strong text-slate-700 hover:bg-page`}
            >
              ล้าง
            </button>
            <button
              onClick={handleReset}
              onBlur={() => setConfirmReset(false)}
              disabled={!dirty}
              title="กลับไปใช้ช่วงที่ AI เลือกให้ — การติ๊ก ขยับขอบ และแยกช่วงจะหายทั้งหมด"
              className={`${TOOL_BTN} inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                confirmReset
                  ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-line-strong bg-white text-slate-700 hover:bg-page'
              }`}
            >
              <RotateCcw className="h-4 w-4" /> {confirmReset ? 'ยืนยัน?' : 'คืนค่า AI'}
            </button>
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.filter((f) => counts[f.id] > 0 || f.id === filter).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`${TOOL_BTN} ${
                filter === f.id
                  ? 'border-primary bg-primary text-white'
                  : 'border-line-strong bg-white text-slate-700 hover:bg-page'
              }`}
            >
              {f.label} ({counts[f.id]})
            </button>
          ))}
        </div>
      </div>

      {/* คำแนะนำตามสถานการณ์ — แทนคำอธิบาย 4 ขั้นตอนที่ยัดอยู่มุมขวา */}
      {hint && <p className="text-sm text-muted -mt-1">💡 {hint}</p>}

      {/* Segments list */}
      <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
        {visibleRows.map((row) => (
          <SegmentRow
            key={row.id}
            row={row}
            isActive={activeId === row.id}
            isNew={flashIds.includes(row.id)}
            canPreview={!!videoSrc}
            step={step}
            onStepChange={setStep}
            onToggle={() => toggle(row.id)}
            onPreview={() => previewRow(row)}
            onNudge={(edge, d) => handleNudge(row, edge, d)}
            canMerge={describeMerge(rows, row.id).ok}
            onMerge={() => handleMerge(row)}
          />
        ))}
        {visibleRows.length === 0 && (
          <p className="text-center text-sm text-muted py-8">ไม่มีช่วงในหมวดนี้</p>
        )}
      </div>

      {/* inline error (แทน alert) */}
      {submitError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <span>⚠️</span>
          <span className="flex-1">{submitError}</span>
          <button onClick={() => setSubmitError('')} className="text-red-600 hover:text-red-800" aria-label="ปิด">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Submit */}
      <div className="space-y-2 pt-2">
        <button
          onClick={handleConfirm}
          disabled={submitting || stats.count === 0}
          className={`w-full min-h-11 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl text-base font-semibold text-white shadow-sm transition-all ${
            submitting || stats.count === 0
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-primary hover:bg-primary-dark active:scale-[0.98]'
          }`}
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> กำลังส่งไปตัดต่อ...
            </>
          ) : preview?.burn_subtitle ? (
            <>
              <Play className="h-5 w-5 flex-shrink-0" />
              ถัดไป: ตรวจคำบรรยาย ({stats.count} ช่วง · {formatLength(stats.dur)})
            </>
          ) : (
            <>
              <Play className="h-5 w-5 flex-shrink-0" />
              ตัดต่อตามที่เลือก ({stats.count} ช่วง · {formatLength(stats.dur)})
            </>
          )}
        </button>
        <button
          onClick={handleCancelConfirm}
          disabled={submitting}
          className="w-full min-h-11 py-3 rounded-xl text-base font-semibold text-ink bg-white border border-line-strong hover:bg-page"
        >
          ← ยกเลิก
        </button>
      </div>
    </div>
  );
};

export default PreviewScreen;
