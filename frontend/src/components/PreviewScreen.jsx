import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import {
  X, Eye, Play, Loader2, AlertTriangle, RotateCcw,
} from 'lucide-react';
import { API_URL, PREVIEW_ROWS_KEY, fetchMediaToken } from '../config';
import useTimelineRows, { toRenderSegments, describeMerge } from './useTimelineRows';
import SegmentRow from './SegmentRow';
import TimelineStrip from './TimelineStrip';
import { formatLength } from './time';

const FILTERS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'ai', label: 'AI เลือก' },
  { id: 'cut', label: 'AI ตัดออก' },
];

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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
        <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">กำลังโหลดตัวอย่าง...</p>
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
          className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200"
        >
          กลับ
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero */}
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium mb-2">
          <Eye className="h-3.5 w-3.5" />
          ดูตัวอย่าง
        </div>
        <h2 className="text-2xl font-semibold text-slate-900">
          เลือกช่วงที่จะ<span className="text-indigo-600">เก็บไว้</span>
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          แถบสีคือช่วงที่จะเก็บ · ลายทแยงคือช่วงที่ AI ตัดออก — กดที่แถวเพื่อสลับ
        </p>
      </div>

      {/* Video player (ต้นฉบับ) — seek ดูแต่ละช่วงได้ */}
      {videoSrc && (
        <div className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-200">
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

      {/* แถบเดียว: สรุป + ตัวกรอง + ปุ่มจัดการ (เดิมเป็น 3 กล่องซ้อนกัน) */}
      <div className="flex items-center gap-2 flex-wrap border-y border-slate-200 py-2.5">
        <span className="text-sm font-semibold text-slate-800">
          {stats.count} ช่วง · {formatLength(stats.dur)}
        </span>

        <span className="inline-flex items-center gap-1 ml-1">
          {FILTERS.filter((f) => counts[f.id] > 0 || f.id === filter).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`text-[11px] px-2 py-1 rounded-md border font-medium transition-colors ${
                filter === f.id
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label} <span className="opacity-60">({counts[f.id]})</span>
            </button>
          ))}
        </span>

        <span className="ml-auto inline-flex items-center gap-1.5">
          <button
            onClick={() => setAll(true)}
            className="text-[11px] px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-md hover:bg-slate-50 font-medium"
          >
            เลือกทั้งหมด
          </button>
          <button
            onClick={() => setAll(false)}
            className="text-[11px] px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-md hover:bg-slate-50 font-medium"
          >
            ล้าง
          </button>
          <button
            onClick={handleReset}
            onBlur={() => setConfirmReset(false)}
            disabled={!dirty}
            title="กลับไปใช้ช่วงที่ AI เลือกให้ — การติ๊ก ขยับขอบ และแยกช่วงจะหายทั้งหมด"
            className={`text-[11px] px-2.5 py-1 rounded-md font-medium inline-flex items-center gap-1 border disabled:opacity-40 disabled:cursor-not-allowed ${
              confirmReset
                ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <RotateCcw className="h-3 w-3" /> {confirmReset ? 'ยืนยัน?' : 'คืนค่า AI'}
          </button>
        </span>
      </div>

      {/* คำแนะนำตามสถานการณ์ — แทนคำอธิบาย 4 ขั้นตอนที่ยัดอยู่มุมขวา */}
      {hint && <p className="text-[11px] text-slate-400 -mt-1">💡 {hint}</p>}

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
          <p className="text-center text-sm text-slate-400 py-8">ไม่มีช่วงในหมวดนี้</p>
        )}
      </div>

      {/* inline error (แทน alert) */}
      {submitError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <span>⚠️</span>
          <span className="flex-1">{submitError}</span>
          <button onClick={() => setSubmitError('')} className="text-red-400 hover:text-red-600" aria-label="ปิด">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Submit */}
      <div className="space-y-2 pt-2">
        <button
          onClick={handleConfirm}
          disabled={submitting || stats.count === 0}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-white shadow-lg transition-all ${
            submitting || stats.count === 0
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]'
          }`}
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> กำลังส่งไปตัดต่อ...
            </>
          ) : preview?.burn_subtitle ? (
            <>
              <Play className="h-5 w-5" />
              ถัดไป — แก้ subtitle ({stats.count} ช่วง · {formatLength(stats.dur)})
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              ตัดต่อตามที่เลือก ({stats.count} ช่วง · {formatLength(stats.dur)})
            </>
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={submitting}
          className="w-full py-3 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
        >
          ← ยกเลิก
        </button>
      </div>
    </div>
  );
};

export default PreviewScreen;
