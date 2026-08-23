import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Type, Check, Play, Loader2, AlertTriangle, RotateCcw, Sparkles, X,
} from 'lucide-react';
import { API_URL } from '../config';

const formatTime = (sec) => {
  const total = Math.max(0, sec || 0);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const ms = Math.floor((total - Math.floor(total)) * 100);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

const SubtitleEditScreen = ({ jobId, selectedSegments, onRendering, onBack }) => {
  const [phrases, setPhrases] = useState([]);
  const [originalPhrases, setOriginalPhrases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [dirtyCount, setDirtyCount] = useState(0);
  const [videoSrc, setVideoSrc] = useState(null);
  const [activeIdx, setActiveIdx] = useState(null);
  const listRef = useRef(null);
  const videoRef = useRef(null);
  const playEndRef = useRef(null);

  // Load subtitle phrases + วิดีโอต้นฉบับ (จาก preview.json)
  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_URL}/subtitle/${jobId}`)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.phrases || [];
        setPhrases(data.map((p) => ({ ...p })));
        setOriginalPhrases(data.map((p) => ({ ...p })));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.detail || 'โหลดคำบรรยายไม่สำเร็จ');
        setLoading(false);
      });
    // ดึง URL วิดีโอต้นฉบับ (best-effort — ไม่มีก็แค่ไม่โชว์ player)
    axios.get(`${API_URL}/preview/${jobId}`)
      .then((res) => {
        if (cancelled) return;
        const p = res.data?.video_path;
        if (p) {
          const rel = p.replace(/\\/g, '/').replace(/^storage\//, '');
          setVideoSrc(`${API_URL}/storage/${rel}`);
        }
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [jobId]);

  // เล่นพรีวิวเฉพาะช่วง phrase นั้น
  const playPhrase = (idx, ph) => {
    const v = videoRef.current;
    if (!v) return;
    playEndRef.current = ph.end;
    setActiveIdx(idx);
    try {
      v.currentTime = ph.start;
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

  // Track dirty count
  useEffect(() => {
    let count = 0;
    for (let i = 0; i < phrases.length; i++) {
      if ((phrases[i]?.text || '') !== (originalPhrases[i]?.text || '')) count++;
    }
    setDirtyCount(count);
  }, [phrases, originalPhrases]);

  const updateText = (idx, text) => {
    setPhrases((prev) => prev.map((p, i) => (i === idx ? { ...p, text } : p)));
  };

  const resetAll = () => {
    if (!window.confirm('คืนคำบรรยายกลับเป็นต้นฉบับ?')) return;
    setPhrases(originalPhrases.map((p) => ({ ...p })));
  };

  const handleRender = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      // ส่ง edited phrases + selected segments → render
      const res = await axios.post(`${API_URL}/render/${jobId}`, {
        segments: selectedSegments,
        edited_phrases: phrases,
      });
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
        <p className="text-sm text-slate-500">กำลังโหลดคำบรรยาย...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <p className="text-sm text-red-700 mb-4">{error}</p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200"
        >
          ← กลับ
        </button>
      </div>
    );
  }

  if (phrases.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
          <AlertTriangle className="h-3.5 w-3.5" />
          ไม่มีคำบรรยาย
        </div>
        <p className="text-sm text-slate-600">
          สร้างคำบรรยายไม่ได้ — ข้ามไปตัดต่อเลยไหม?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200"
          >
            ← กลับ
          </button>
          <button
            onClick={handleRender}
            className="flex-1 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            ข้ามไปตัดต่อ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero */}
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium mb-2">
          <Type className="h-3.5 w-3.5" />
          แก้คำบรรยาย
        </div>
        <h2 className="text-2xl font-semibold text-slate-900">
          ตรวจและแก้ <span className="text-indigo-600">คำบรรยาย</span> ก่อนตัดต่อ
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          แก้คำที่ฟังผิดได้ เช่น ชื่อเฉพาะ หรือศัพท์เฉพาะทาง
        </p>
      </div>

      {/* Video player (ต้นฉบับ) — กด "ดู" ที่บรรทัดเพื่อฟังช่วงนั้น */}
      {videoSrc && (
        <div className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-200">
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            onTimeUpdate={onTimeUpdate}
            className="w-full max-h-[40vh] object-contain bg-black"
          />
        </div>
      )}

      {/* Stats */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-medium">จำนวนบรรทัด</p>
              <p className="text-lg font-bold text-slate-800">{phrases.length}</p>
            </div>
          </div>
          {dirtyCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
                <Check className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-medium">แก้ไปแล้ว</p>
                <p className="text-lg font-bold text-amber-700">{dirtyCount}</p>
              </div>
            </div>
          )}
        </div>
        {dirtyCount > 0 && (
          <button
            onClick={resetAll}
            className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 font-medium flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" /> คืนค่าทั้งหมด
          </button>
        )}
      </div>

      {/* Tips */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600 leading-relaxed">
        💡 <strong>เคล็ดลับ:</strong> ตรวจชื่อเฉพาะ (Andrew Huberman, FastAPI, React) และศัพท์เทคนิค —
        ไม่ต้องแก้ทุกบรรทัด แค่บรรทัดที่ผิด
      </div>

      {/* Phrases list */}
      <div ref={listRef} className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
        {phrases.map((ph, idx) => {
          const isEdited = (ph.text || '') !== (originalPhrases[idx]?.text || '');
          const isActive = activeIdx === idx;
          return (
            <div
              key={idx}
              className={`p-3 rounded-xl border-2 transition-colors ${
                isActive
                  ? 'border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-200'
                  : isEdited
                  ? 'border-amber-300 bg-amber-50/40'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[11px] text-slate-500">
                  {formatTime(ph.start)} → {formatTime(ph.end)}
                </span>
                <div className="flex items-center gap-2">
                  {isEdited && (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      แก้แล้ว
                    </span>
                  )}
                  {videoSrc && (
                    <button
                      type="button"
                      onClick={() => playPhrase(idx, ph)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                      }`}
                    >
                      <Play className="h-2.5 w-2.5" /> ดู
                    </button>
                  )}
                </div>
              </div>
              <input
                type="text"
                value={ph.text}
                onChange={(e) => updateText(idx, e.target.value)}
                maxLength={200}
                className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors outline-none ${
                  isEdited
                    ? 'border-amber-300 bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
                    : 'border-slate-200 bg-slate-50/60 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200'
                }`}
                placeholder="พิมพ์คำบรรยาย..."
              />
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

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <button
          onClick={handleRender}
          disabled={submitting}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-white shadow-lg transition-all ${
            submitting
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]'
          }`}
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> กำลังส่งไปตัดต่อ...
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              บันทึก + ตัดต่อ ({dirtyCount > 0 ? `แก้ ${dirtyCount} บรรทัด` : 'ใช้ subtitle เดิม'})
            </>
          )}
        </button>
        <button
          onClick={onBack}
          disabled={submitting}
          className="w-full py-3 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
        >
          ← กลับไปเลือกช่วง
        </button>
      </div>
    </div>
  );
};

export default SubtitleEditScreen;
