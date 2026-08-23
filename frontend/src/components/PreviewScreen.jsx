import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import {
  Sparkles, Check, X, Eye, Clock, Sigma, Play, Loader2, AlertTriangle,
} from 'lucide-react';
import { API_URL } from '../config';

const formatTime = (sec) => {
  const s = Math.floor(sec || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

const PreviewScreen = ({ jobId, onRendering, onCancel, onEditSubtitle }) => {
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState({});  // {idx: true/false}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');   // inline (แทน alert)
  const [activeIdx, setActiveIdx] = useState(null);      // segment ที่กำลังเล่นพรีวิว

  const videoRef = useRef(null);
  const playEndRef = useRef(null);   // เวลา end ที่จะให้หยุดเล่น

  // Load preview data
  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_URL}/preview/${jobId}`)
      .then((res) => {
        if (cancelled) return;
        setPreview(res.data);
        const init = {};
        res.data.segments.forEach((_, i) => { init[i] = true; });
        setSelected(init);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.detail || 'โหลดตัวอย่างไม่สำเร็จ');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [jobId]);

  const segments = preview?.segments || [];
  const isTiktok = preview?.output_mode === 'tiktok';

  // URL วิดีโอต้นฉบับ (preview.video_path = "storage/{job_id}/{file}") — /storage เสิร์ฟแบบ seek ได้
  const videoSrc = useMemo(() => {
    const p = preview?.video_path;
    if (!p) return null;
    const rel = p.replace(/\\/g, '/').replace(/^storage\//, '');
    return `${API_URL}/storage/${rel}`;
  }, [preview]);

  const toggle = (idx) => setSelected((s) => ({ ...s, [idx]: !s[idx] }));
  const selectAll = () => {
    const all = {};
    segments.forEach((_, i) => { all[i] = true; });
    setSelected(all);
  };
  const deselectAll = () => {
    const none = {};
    segments.forEach((_, i) => { none[i] = false; });
    setSelected(none);
  };

  // เล่นพรีวิวเฉพาะช่วงนั้น — seek ไป start แล้วหยุดที่ end
  const previewSegment = (idx, seg) => {
    const v = videoRef.current;
    if (!v) return;
    playEndRef.current = seg.end;
    setActiveIdx(idx);
    try {
      v.currentTime = seg.start;
      v.play().catch(() => {});
      v.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch { /* ignore */ }
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (v && playEndRef.current != null && v.currentTime >= playEndRef.current) {
      v.pause();
      playEndRef.current = null;
    }
  };

  const stats = useMemo(() => {
    let count = 0, dur = 0;
    segments.forEach((s, i) => {
      if (selected[i]) { count++; dur += (s.end - s.start); }
    });
    return { count, dur };
  }, [segments, selected]);

  const handleConfirm = async () => {
    if (stats.count === 0) {
      setSubmitError('กรุณาเลือกอย่างน้อย 1 ช่วง');
      return;
    }
    setSubmitError('');
    const chosen = segments.filter((_, i) => selected[i]);

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
          ดูช่วงที่ AI <span className="text-indigo-600">เลือกให้</span>
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          กด ▶ เพื่อดูแต่ละช่วงก่อน — ติ๊กเก็บหรือตัดออกได้ แล้วกด "ตัดต่อ"
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
            <p className="text-lg font-bold text-slate-800">{stats.count} / {segments.length}</p>
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
        <div className="col-span-2 sm:col-span-1 flex items-center gap-2 justify-end">
          <button
            onClick={selectAll}
            className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 font-medium"
          >
            เลือกทั้งหมด
          </button>
          <button
            onClick={deselectAll}
            className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 font-medium"
          >
            ล้าง
          </button>
        </div>
      </div>

      {/* Segments list */}
      <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
        {segments.map((seg, idx) => {
          const isOn = !!selected[idx];
          const isActive = activeIdx === idx;
          const duration = seg.end - seg.start;
          return (
            <div
              key={idx}
              onClick={() => toggle(idx)}
              className={`w-full text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-200'
                  : isOn
                  ? 'border-indigo-400 bg-indigo-50/40 shadow-sm'
                  : 'border-slate-200 bg-slate-50/50 opacity-60 hover:opacity-80'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                  isOn ? 'bg-indigo-500 text-white' : 'bg-slate-300 text-slate-500'
                }`}>
                  {isOn ? <Check className="h-4 w-4" /> : <X className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5 flex-wrap">
                    <span className="font-mono">
                      {formatTime(seg.start)} – {formatTime(seg.end)}
                    </span>
                    <span className="font-semibold text-slate-700">({duration.toFixed(1)}s)</span>
                    {isTiktok && seg.priority && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        seg.priority === 1 ? 'bg-indigo-100 text-indigo-700' :
                        seg.priority === 2 ? 'bg-indigo-50 text-indigo-600' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {seg.priority === 1 ? '🔥 Hook' : `P${seg.priority}`}
                      </span>
                    )}
                    {/* ปุ่มดูช่วงนี้ */}
                    {videoSrc && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); previewSegment(idx, seg); }}
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
                  {seg.text && (
                    <p className={`text-sm leading-relaxed ${isOn ? 'text-slate-800' : 'text-slate-500'}`}>
                      "{seg.text}"
                    </p>
                  )}
                  {seg.reason && (
                    <p className="text-xs text-slate-500 mt-1 italic">💡 {seg.reason}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
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
