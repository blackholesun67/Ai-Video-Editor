import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import {
  Sparkles, X, Eye, Clock, Sigma, Play, Loader2, AlertTriangle, RotateCcw,
} from 'lucide-react';
import { API_URL, PREVIEW_ROWS_KEY } from '../config';
import useTimelineRows, { toRenderSegments } from './useTimelineRows';
import SegmentRow from './SegmentRow';

const formatTime = (sec) => {
  const s = Math.floor(sec || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

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

  const videoRef = useRef(null);
  const playEndRef = useRef(null);
  const auditionRef = useRef(null);       // debounce ฟังรอยตัดหลังขยับขอบ
  const rowsRef = useRef([]);             // rows ล่าสุด สำหรับ callback ที่ debounce

  const {
    rows, stats, dirty, toggle, setAll, resetToAI, nudge, applyVideoDuration,
  } = useTimelineRows(preview, jobId, PREVIEW_ROWS_KEY);

  // Load preview data
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
    return () => { cancelled = true; };
  }, [jobId]);

  // URL วิดีโอต้นฉบับ (preview.video_path = "storage/{job_id}/{file}") — /storage เสิร์ฟแบบ seek ได้
  const videoSrc = useMemo(() => {
    const p = preview?.video_path;
    if (!p) return null;
    const rel = p.replace(/\\/g, '/').replace(/^storage\//, '');
    return `${API_URL}/storage/${rel}`;
  }, [preview]);

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
  useEffect(() => () => clearTimeout(auditionRef.current), []);

  /**
   * ขยับขอบแล้วเล่นให้ฟังรอบ ๆ รอยตัดอัตโนมัติ
   * จำเป็นเพราะไม่มี timeline scrubber — ไม่งั้นผู้ใช้กดปุ่มโดยไม่รู้ว่าได้ผลยังไง
   */
  const handleNudge = (row, edge, delta) => {
    nudge(row.id, edge, delta);
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
          กด ▶ ฟังก่อนได้ · ช่วงเส้นประคือช่วงที่ AI ตัดออก — กดเพื่อเอากลับมา
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          ตัดไม่พอดี? ใช้ปุ่ม − / + ขยับหัวท้ายทีละวินาที (ระบบจะเล่นให้ฟังรอยตัดให้)
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

      {/* Stats card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Sigma className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-medium">ที่เลือก</p>
            <p className="text-lg font-bold text-slate-800">{stats.count} ช่วง</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Clock className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-medium">ความยาวรวม</p>
            <p className="text-lg font-bold text-slate-800">{formatTime(stats.dur)}</p>
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1 flex items-center gap-2 justify-end flex-wrap">
          <button
            onClick={() => setAll(true)}
            className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 font-medium"
          >
            เลือกทั้งหมด
          </button>
          <button
            onClick={() => setAll(false)}
            className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 font-medium"
          >
            ล้าง
          </button>
          <button
            onClick={resetToAI}
            disabled={!dirty}
            title="กลับไปใช้ช่วงที่ AI เลือกให้"
            className="text-xs px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-md hover:bg-slate-50 font-medium inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="h-3 w-3" /> คืนค่า AI
          </button>
        </div>
      </div>

      {/* ตัวกรอง */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              filter === f.id
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.label} <span className="opacity-60">({counts[f.id]})</span>
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-400">
          💡 อยากทำคลิปไฮไลต์? กด "ล้าง" แล้วติ๊กเฉพาะช่วงที่ชอบ
        </span>
      </div>

      {/* Segments list */}
      <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
        {visibleRows.map((row) => (
          <SegmentRow
            key={row.id}
            row={row}
            isActive={activeId === row.id}
            canPreview={!!videoSrc}
            showNudge
            onToggle={() => toggle(row.id)}
            onPreview={() => previewRow(row)}
            onNudge={(edge, d) => handleNudge(row, edge, d)}
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
              ถัดไป — แก้ subtitle ({stats.count} ช่วง · {formatTime(stats.dur)})
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              ตัดต่อตามที่เลือก ({stats.count} ช่วง · {formatTime(stats.dur)})
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
