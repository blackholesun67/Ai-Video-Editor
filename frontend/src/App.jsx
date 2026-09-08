import React, { useState, useEffect } from 'react';
import { Sparkles, Download, RotateCcw, Type } from 'lucide-react';
import UploadScreen from './components/UploadScreen';
import Processing from './components/Processing';
import PreviewScreen from './components/PreviewScreen';
import SubtitleEditScreen from './components/SubtitleEditScreen';
import { API_URL, PREVIEW_ROWS_KEY } from './config';

const STORAGE_KEYS = {
  JOB: 'aive_job_id',
  VIDEO: 'aive_video_url',
  SUMMARY: 'aive_summary',
  PHASE: 'aive_phase',     // "processing" | "preview" | "editing" | "rendering" | "done"
  RENDER_TASK: 'aive_render_task',
  SELECTED_SEGS: 'aive_selected_segments',
  PREVIEW_ROWS: PREVIEW_ROWS_KEY,   // แถวไทม์ไลน์หน้า preview (PreviewScreen เขียนเอง)
};

function App() {
  const [jobId, setJobId] = useState(() => localStorage.getItem(STORAGE_KEYS.JOB));
  const [videoUrl, setVideoUrl] = useState(() => localStorage.getItem(STORAGE_KEYS.VIDEO));
  const [phase, setPhase] = useState(() => localStorage.getItem(STORAGE_KEYS.PHASE) || null);
  const [renderTaskId, setRenderTaskId] = useState(() => localStorage.getItem(STORAGE_KEYS.RENDER_TASK));
  const [selectedSegs, setSelectedSegs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.SELECTED_SEGS) || 'null'); }
    catch { return null; }
  });
  const [editSummary, setEditSummary] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.SUMMARY) || 'null'); }
    catch { return null; }
  });
  // true = ย้อนกลับมาแก้ซับหลัง render เสร็จแล้ว (กลับหน้า "เสร็จแล้ว" เมื่อกด "กลับ")
  const [reediting, setReediting] = useState(false);

  useEffect(() => {
    if (jobId) localStorage.setItem(STORAGE_KEYS.JOB, jobId);
    else localStorage.removeItem(STORAGE_KEYS.JOB);
  }, [jobId]);

  useEffect(() => {
    if (videoUrl) localStorage.setItem(STORAGE_KEYS.VIDEO, videoUrl);
    else localStorage.removeItem(STORAGE_KEYS.VIDEO);
  }, [videoUrl]);

  useEffect(() => {
    if (editSummary) localStorage.setItem(STORAGE_KEYS.SUMMARY, JSON.stringify(editSummary));
    else localStorage.removeItem(STORAGE_KEYS.SUMMARY);
  }, [editSummary]);

  useEffect(() => {
    if (phase) localStorage.setItem(STORAGE_KEYS.PHASE, phase);
    else localStorage.removeItem(STORAGE_KEYS.PHASE);
  }, [phase]);

  useEffect(() => {
    if (renderTaskId) localStorage.setItem(STORAGE_KEYS.RENDER_TASK, renderTaskId);
    else localStorage.removeItem(STORAGE_KEYS.RENDER_TASK);
  }, [renderTaskId]);

  useEffect(() => {
    if (selectedSegs) localStorage.setItem(STORAGE_KEYS.SELECTED_SEGS, JSON.stringify(selectedSegs));
    else localStorage.removeItem(STORAGE_KEYS.SELECTED_SEGS);
  }, [selectedSegs]);

  // output_url ของ backend คงที่ ("{job}/final_summary.mp4") — เติม ?v= กัน browser
  // เล่นไฟล์เก่าจาก cache หลัง render ใหม่ (โดยเฉพาะตอนย้อนกลับไปแก้ซับ)
  const bustCache = (u) => `${u.split('?')[0]}?v=${Date.now()}`;

  // Callback จาก Processing — ทำงาน 2 กรณี
  const handleComplete = (urlOrPreview, summary) => {
    // ถ้า data.mode = "preview" → ไปหน้า preview
    if (urlOrPreview === '__PREVIEW__') {
      setPhase('preview');
      return;
    }
    setVideoUrl(bustCache(urlOrPreview));
    setPhase('done');
    setReediting(false);
    if (summary) setEditSummary(summary);
  };

  // จาก PreviewScreen — กดยืนยัน render
  const handleRendering = (newTaskId) => {
    setRenderTaskId(newTaskId);
    setPhase('rendering');
  };

  // จาก PreviewScreen — กดถัดไปแก้ subtitle (เมื่อ burn_subtitle=true)
  const handleEditSubtitle = (segments) => {
    setSelectedSegs(segments);
    setPhase('editing');
  };

  const handleBackToPreview = () => {
    if (reediting) {
      // ยกเลิกการแก้ซับ → กลับหน้า "เสร็จแล้ว" (วิดีโอเดิม)
      setReediting(false);
      setVideoUrl(bustCache(`${jobId}/final_summary.mp4`));
      setPhase('done');
      return;
    }
    setSelectedSegs(null);
    setPhase('preview');
  };

  // จากหน้า "เสร็จแล้ว" — กด "แก้คำบรรยาย" ย้อนกลับไปแก้ซับแล้ว render ใหม่ (ไม่ตัดใหม่)
  const handleReedit = () => {
    setReediting(true);
    setVideoUrl(null);
    setPhase('editing');
  };

  const handleReset = () => {
    setJobId(null);
    setVideoUrl(null);
    setEditSummary(null);
    setPhase(null);
    setRenderTaskId(null);
    setSelectedSegs(null);
    setReediting(false);
    // PreviewScreen เขียนคีย์นี้เอง (ไม่มี state ใน App) → ต้องล้างตรงนี้
    try { localStorage.removeItem(STORAGE_KEYS.PREVIEW_ROWS); } catch { /* ignore */ }
  };

  // ปุ่มมุมขวาบน — ล้างงานทั้งหมด กลับหน้าอัปโหลด (ถามยืนยันกันกดพลาด)
  const handleResetConfirm = () => {
    if (window.confirm('เริ่มทำวิดีโอใหม่? งานปัจจุบันและวิดีโอที่ตัดไว้จะถูกล้างทั้งหมด')) {
      handleReset();
    }
  };

  // Determine active jobId for Processing component
  const activeTaskId = phase === 'rendering' ? renderTaskId : jobId;

  const jobIdShort = videoUrl ? videoUrl.split('/')[0] : '';
  // query string จาก videoUrl (?v=...) — ใช้ bust cache ของลิงก์ดาวน์โหลดด้วย
  const cacheQuery = videoUrl && videoUrl.includes('?') ? videoUrl.slice(videoUrl.indexOf('?')) : '';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight">AI Video Smart Editor</h1>
            </div>
          </div>
          {(jobId || videoUrl) && (
            <button
              onClick={handleResetConfirm}
              title="เริ่มทำวิดีโอใหม่ — ล้างงานทั้งหมด กลับหน้าอัปโหลด"
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-red-600 bg-white border border-red-200 px-3.5 py-1.5 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              เริ่มทำวิดีโอใหม่
            </button>
          )}
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {!jobId && !videoUrl && (
          <UploadScreen onUploadSuccess={(id, mode) => {
            setJobId(id);
            setPhase(mode === 'preview' ? 'processing' : 'processing');
          }} />
        )}

        {jobId && !videoUrl && (phase === 'processing' || phase === 'rendering') && (
          <Processing jobId={activeTaskId} onComplete={handleComplete} onCancel={handleReset} />
        )}

        {jobId && !videoUrl && phase === 'preview' && (
          <PreviewScreen
            jobId={jobId}
            onRendering={handleRendering}
            onCancel={handleReset}
            onEditSubtitle={handleEditSubtitle}
          />
        )}

        {jobId && !videoUrl && phase === 'editing' && (
          <SubtitleEditScreen
            jobId={jobId}
            selectedSegments={selectedSegs}
            onRendering={handleRendering}
            onBack={handleBackToPreview}
            backLabel={reediting ? 'กลับไปหน้าผลลัพธ์' : 'กลับไปเลือกช่วง'}
          />
        )}

        {videoUrl && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Success badge */}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                ตัดต่อเสร็จแล้ว
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 mt-3">วิดีโอของคุณพร้อมแล้ว</h2>
            </div>

            {/* Video Player */}
            <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-200">
              <div className="flex justify-center max-h-[70vh]">
                <video
                  src={`${API_URL}/storage/${videoUrl}`}
                  controls
                  autoPlay
                  className="max-h-[70vh] max-w-full object-contain"
                />
              </div>
            </div>

            {/* Actions — ปุ่มเริ่มใหม่อยู่มุมขวาบน (header) ที่เดียว */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {editSummary?.burn_subtitle && (
                <button
                  onClick={handleReedit}
                  className="flex items-center justify-center gap-2 bg-white text-indigo-700 px-6 py-3.5 rounded-xl font-semibold border border-indigo-200 hover:bg-indigo-50 transition-colors active:scale-[0.98]"
                >
                  <Type className="h-5 w-5" />
                  แก้คำบรรยาย
                </button>
              )}
              <a
                href={`${API_URL}/download/${jobIdShort}${cacheQuery}`}
                download="ai_edited_video.mp4"
                className={`flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-emerald-700 transition-colors active:scale-[0.98] ${
                  editSummary?.burn_subtitle ? '' : 'sm:col-span-2'
                }`}
              >
                <Download className="h-5 w-5" />
                ดาวน์โหลดวิดีโอ
              </a>
            </div>
            {editSummary?.burn_subtitle && (
              <p className="text-center text-xs text-slate-400">
                แก้คำบรรยายแล้วสร้างใหม่ได้เลย — ไม่ต้องตัดต่อใหม่ทั้งหมด
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
