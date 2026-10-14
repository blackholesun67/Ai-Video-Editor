import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Download, RotateCcw, Type, LogOut, FolderOpen, Scissors, Menu, X, Check } from 'lucide-react';
import Logo from './components/Logo';
import UploadScreen from './components/UploadScreen';
import Processing from './components/Processing';
import PreviewScreen from './components/PreviewScreen';
import SubtitleEditScreen from './components/SubtitleEditScreen';
import LoginScreen from './components/LoginScreen';
import MyJobsScreen from './components/MyJobsScreen';
import { API_URL, PREVIEW_ROWS_KEY, getAuthToken, setAuthToken, AUTH_LOGOUT_EVENT, fetchMediaToken } from './config';

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
  // ── Auth ──────────────────────────────────────────────────────
  // เห็นหน้าโปรแกรมได้เลย — บังคับ login ตอนกด "เริ่มตัดต่อ" (modal) แทน hard gate
  const [token, setToken] = useState(() => getAuthToken());
  const [loginOpen, setLoginOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  // resolve ของ requestLogin() ที่ค้างอยู่ — เรียกเมื่อ login สำเร็จ/ปิด modal
  const loginResolveRef = useRef(null);
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
  // media token สำหรับเล่น/ดาวน์โหลดวิดีโอผลลัพธ์ (หน้า "เสร็จแล้ว")
  const [mediaToken, setMediaToken] = useState(null);
  // true = กำลังดูหน้า "งานของฉัน"
  const [showJobs, setShowJobs] = useState(false);
  // เมนู ☰ บนจอแคบ (≤640px) — ปุ่มใน header ย่อเข้าไปอยู่ในนี้
  const [menuOpen, setMenuOpen] = useState(false);

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

  // ขอ media token เมื่อมีวิดีโอผลลัพธ์ (หน้า "เสร็จแล้ว") — ใช้เล่น + ดาวน์โหลด
  useEffect(() => {
    if (!videoUrl) { setMediaToken(null); return; }
    const jid = videoUrl.split('/')[0];
    let cancelled = false;
    fetchMediaToken(jid).then((t) => { if (!cancelled) setMediaToken(t); });
    return () => { cancelled = true; };
  }, [videoUrl]);

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

  // จากหน้า "เสร็จแล้ว" — กด "แก้ช่วงตัด" ย้อนกลับไปหน้าเลือกช่วง (preview) แล้วเรนเดอร์ใหม่ได้
  // backend รองรับอยู่แล้ว — POST /render/{job_id} อ่านแค่ preview.json ไม่เช็กสถานะงานเลย
  // (ต่างจาก handleReedit: อันนี้กลับไปแก้ "ช่วงที่จะเก็บ" ไม่ใช่แค่ข้อความซับ)
  const handleEditCuts = () => {
    setReediting(false);
    setVideoUrl(null);
    setPhase('preview');
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

  // ── Login modal ──────────────────────────────────────────────
  // เปิด modal แล้วคืน Promise<boolean> — true = login สำเร็จ, false = ปิด/ยกเลิก
  // ให้ที่เรียก (เช่น ปุ่มอัปโหลด) await รอผลแล้วทำงานต่อได้
  const requestLogin = () => new Promise((resolve) => {
    loginResolveRef.current = resolve;
    setLoginOpen(true);
  });

  const handleLoginSuccess = (tok) => {
    setToken(tok);
    setLoginOpen(false);
    if (loginResolveRef.current) { loginResolveRef.current(true); loginResolveRef.current = null; }
  };

  const handleLoginClose = () => {
    setLoginOpen(false);
    if (loginResolveRef.current) { loginResolveRef.current(false); loginResolveRef.current = null; }
  };

  // จากหน้า "งานของฉัน" — เปิดงานสถานะ "ready" (รอเลือกช่วง ยังไม่เคย render) ต่อ
  // ล้าง state ของงานก่อนหน้าทั้งหมดก่อนสวม jobId ใหม่ กัน state ปนกันข้ามงาน
  // (ปลอดภัยเพราะ GET /preview อ่านจาก preview.json ตรง ๆ ไม่เช็กสถานะงาน — main.py)
  const handleOpenJob = (id) => {
    setRenderTaskId(null);
    setSelectedSegs(null);
    setEditSummary(null);
    setReediting(false);
    setVideoUrl(null);
    setJobId(id);
    setPhase('preview');
    setShowJobs(false);
  };

  // กด "งานของฉัน" — ต้อง login ก่อน ไม่งั้นเปิด modal
  const openMyJobs = async () => {
    if (!token) {
      const ok = await requestLogin();
      if (!ok) return;
    }
    setShowJobs(true);
  };

  // ── Logout — ล้าง token + งานทั้งหมด (กันงานคนก่อนค้างข้ามบัญชี) ──
  const doLogout = async () => {
    // เพิกถอน token ฝั่ง server ก่อน (best-effort) — ต้องเรียกตอน header ยังแนบ token อยู่
    // เน็ตล่ม/หมดอายุ ก็ลบ local ต่อไป (ไม่บล็อกการ logout)
    try { await axios.post(`${API_URL}/auth/logout`); } catch { /* ignore */ }
    setAuthToken(null);      // ลบ token + header Authorization
    setToken(null);
    setShowJobs(false);
    setConfirmLogoutOpen(false);
    handleReset();           // ล้าง state + localStorage งานทั้งหมด
  };

  const handleLogout = () => {
    // เตือนเฉพาะตอนมีงานกำลังทำค้าง (ยังไม่ render เสร็จ) — งานที่เสร็จแล้วอยู่ใน DB ไม่หาย
    const hasUnsavedWork = !!jobId && !videoUrl;
    if (hasUnsavedWork) {
      setConfirmLogoutOpen(true);   // → เด้ง modal ยืนยัน
    } else {
      doLogout();                   // ไม่มีงานค้าง → ออกเลย ไม่กวน
    }
  };

  // token หมดอายุระหว่างใช้งาน (backend ตอบ 401) → config.js ยิง event นี้
  // → เคลียร์สถานะ กลับหน้า landing อัตโนมัติ แทนที่จะค้างหน้าพัง
  useEffect(() => {
    const onAuthLogout = () => {
      setToken(null);
      setShowJobs(false);
      handleReset();
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, onAuthLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onAuthLogout);
  }, []);

  // ปุ่มมุมขวาบน — ล้างงานทั้งหมด กลับหน้าอัปโหลด (ถามยืนยันกันกดพลาด)
  const handleResetConfirm = () => {
    if (window.confirm('เริ่มทำวิดีโอใหม่? งานปัจจุบันและวิดีโอที่ตัดไว้จะถูกล้างทั้งหมด')) {
      handleReset();
    }
  };

  // Determine active jobId for Processing component
  const activeTaskId = phase === 'rendering' ? renderTaskId : jobId;

  const jobIdShort = videoUrl ? videoUrl.split('/')[0] : '';

  // ปุ่มใน header — ชุดเดียวใช้ทั้งแถวปุ่ม (จอกว้าง) และเมนู ☰ (จอแคบ)
  const headerActions = [
    (jobId || videoUrl) && !showJobs && {
      id: 'reset', label: 'เริ่มทำวิดีโอใหม่', icon: RotateCcw, danger: true,
      title: 'เริ่มทำวิดีโอใหม่ — ล้างงานทั้งหมด กลับหน้าอัปโหลด', onClick: handleResetConfirm,
    },
    !showJobs && { id: 'jobs', label: 'งานของฉัน', icon: FolderOpen, title: 'งานของฉัน', onClick: openMyJobs },
    { id: 'logout', label: 'ออกจากระบบ', icon: LogOut, title: 'ออกจากระบบ', onClick: handleLogout },
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-line">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo size={32} className="flex-shrink-0" />
            <h1 className="text-base font-semibold text-ink leading-tight truncate">AI Video Smart Editor</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {token ? (
              <>
                {/* จอกว้าง — ปุ่มเรียงตามเดิม */}
                <div className="hidden sm:flex items-center gap-2">
                  {headerActions.map((a) => (
                    <button
                      key={a.id}
                      onClick={a.onClick}
                      title={a.title}
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium bg-white border px-3.5 py-1.5 rounded-lg transition-colors ${
                        a.danger
                          ? 'text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300'
                          : 'text-slate-700 border-line-strong hover:bg-page hover:border-primary/40'
                      }`}
                    >
                      <a.icon className="h-4 w-4" />
                      {a.label}
                    </button>
                  ))}
                </div>
                {/* จอแคบ — ย่อเป็นเมนู ☰ */}
                <div className="relative sm:hidden">
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    aria-label={menuOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
                    aria-expanded={menuOpen}
                    className="h-11 w-11 inline-flex items-center justify-center rounded-lg border border-line-strong bg-white text-ink hover:bg-page"
                  >
                    {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                      <div className="absolute right-0 mt-2 z-20 w-60 bg-white border border-line rounded-xl shadow-lg py-1.5">
                        {headerActions.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => { setMenuOpen(false); a.onClick(); }}
                            className={`w-full min-h-11 flex items-center gap-2.5 px-4 text-base text-left hover:bg-page ${
                              a.danger ? 'text-red-600' : 'text-slate-800'
                            }`}
                          >
                            <a.icon className="h-5 w-5" />
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={requestLogin}
                title="เข้าสู่ระบบ"
                className="inline-flex items-center gap-1.5 whitespace-nowrap min-h-11 sm:min-h-0 text-sm font-medium text-white bg-primary px-3.5 py-1.5 rounded-lg hover:bg-primary-dark transition-colors"
              >
                เข้าสู่ระบบ
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {showJobs && token ? (
          <MyJobsScreen onClose={() => setShowJobs(false)} onOpen={handleOpenJob} />
        ) : (
         <>
        {/* landing (upload) — เห็นได้แม้ยังไม่ login · component เดียวคงอยู่ตลอดตอน gate login
            (ไฟล์+ตั้งค่าไม่หายระหว่างเปิด modal) */}
        {(!token || (!jobId && !videoUrl)) && (
          <UploadScreen
            isAuthed={!!token}
            requestLogin={requestLogin}
            onUploadSuccess={(id, mode) => {
              setJobId(id);
              setPhase(mode === 'preview' ? 'processing' : 'processing');
            }}
          />
        )}

        {token && jobId && !videoUrl && (phase === 'processing' || phase === 'rendering') && (
          <Processing jobId={activeTaskId} onComplete={handleComplete} onCancel={handleReset} isRender={phase === 'rendering'} />
        )}

        {token && jobId && !videoUrl && phase === 'preview' && (
          <PreviewScreen
            jobId={jobId}
            onRendering={handleRendering}
            onCancel={handleReset}
            onEditSubtitle={handleEditSubtitle}
          />
        )}

        {token && jobId && !videoUrl && phase === 'editing' && (
          <SubtitleEditScreen
            jobId={jobId}
            selectedSegments={selectedSegs}
            onRendering={handleRendering}
            onBack={handleBackToPreview}
            backLabel={reediting ? 'กลับไปหน้าผลลัพธ์' : 'กลับไปเลือกช่วง'}
          />
        )}

        {token && videoUrl && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Success badge */}
            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-ink border border-ok rounded-full text-sm font-medium">
                <span className="h-4 w-4 rounded-full bg-ok text-white flex items-center justify-center" aria-hidden="true"><Check className="h-3 w-3" strokeWidth={3} /></span>
                ตัดต่อเสร็จแล้ว
              </div>
              <h2 className="text-2xl sm:text-[26px] font-semibold text-ink mt-3">วิดีโอของคุณพร้อมแล้ว</h2>
            </div>

            {/* Video Player */}
            <div className="bg-slate-900 rounded-2xl overflow-hidden border border-line">
              <div className="flex justify-center max-h-[70vh]">
                <video
                  src={mediaToken ? `${API_URL}/media/${jobIdShort}/final_summary.mp4?token=${mediaToken}` : undefined}
                  controls
                  autoPlay
                  className="max-h-[70vh] max-w-full object-contain"
                />
              </div>
            </div>

            {/* Actions — ปุ่มเริ่มใหม่อยู่มุมขวาบน (header) ที่เดียว
                มือถือ: ดาวน์โหลดเต็มความกว้างบนสุด · ปุ่มแก้สองปุ่มอยู่แถวเดียวกันด้านล่าง */}
            <div className={`grid grid-cols-2 ${editSummary?.burn_subtitle ? 'sm:grid-cols-3' : ''} gap-3 pt-2`}>
              <button
                onClick={handleEditCuts}
                className={`min-h-11 flex items-center justify-center gap-2 bg-white text-ink px-4 py-3.5 rounded-xl font-semibold border border-line-strong hover:bg-page hover:border-primary/40 transition-colors active:scale-[0.98] ${
                  editSummary?.burn_subtitle ? '' : 'col-span-2 sm:col-span-1'
                }`}
              >
                <Scissors className="h-5 w-5" />
                แก้ช่วงตัด
              </button>
              {editSummary?.burn_subtitle && (
                <button
                  onClick={handleReedit}
                  className="min-h-11 flex items-center justify-center gap-2 bg-white text-primary-dark px-4 py-3.5 rounded-xl font-semibold border border-line-strong hover:bg-page hover:border-primary/40 transition-colors active:scale-[0.98]"
                >
                  <Type className="h-5 w-5" />
                  แก้คำบรรยาย
                </button>
              )}
              <a
                href={mediaToken ? `${API_URL}/download/${jobIdShort}?token=${mediaToken}` : undefined}
                download="ai_edited_video.mp4"
                className={`col-span-2 sm:col-span-1 order-first sm:order-none min-h-11 flex items-center justify-center gap-2 bg-primary text-white px-4 py-3.5 rounded-xl font-semibold hover:bg-primary-dark transition-colors active:scale-[0.98] ${
                  mediaToken ? '' : 'pointer-events-none opacity-60'
                }`}
              >
                <Download className="h-5 w-5" />
                ดาวน์โหลดวิดีโอ
              </a>
            </div>
            {editSummary?.burn_subtitle && (
              <p className="text-center text-sm text-muted">
                แก้คำบรรยายแล้วสร้างใหม่ได้เลย — ไม่ต้องตัดต่อใหม่ทั้งหมด
              </p>
            )}
          </div>
        )}
         </>
        )}
      </main>

      {/* Login modal — เปิดตอนกดเริ่มอัปโหลด/งานของฉัน ขณะยังไม่ login */}
      {loginOpen && (
        <LoginScreen onLogin={handleLoginSuccess} onClose={handleLoginClose} />
      )}

      {/* Confirm logout modal — เด้งเฉพาะตอนมีงานกำลังทำค้าง */}
      {confirmLogoutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setConfirmLogoutOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl border border-line shadow-xl p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-11 w-11 rounded-full bg-red-50 flex items-center justify-center mx-auto">
              <LogOut className="h-5 w-5 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-ink mt-3">ออกจากระบบ?</h3>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              งานที่กำลังแก้ไขอยู่ (ยังไม่ได้เรนเดอร์) จะหาย —
              งานที่เสร็จแล้วยังอยู่ใน "งานของฉัน"
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setConfirmLogoutOpen(false)}
                className="flex-1 min-h-11 py-2.5 rounded-lg font-medium text-slate-700 bg-white border border-line-strong hover:bg-page transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={doLogout}
                className="flex-1 min-h-11 py-2.5 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
