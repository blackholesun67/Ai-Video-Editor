import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { CheckCircle, Loader2, Clock, AlertTriangle, FileAudio, Brain, Film } from 'lucide-react';
import { API_URL } from '../config';

const STATUS_TRANSLATIONS = {
  PENDING: '🕐 รอคิวประมวลผล',
  RECEIVED: '📥 ได้รับงาน',
  STARTED: '🚀 กำลังเริ่ม',
  RETRY: '🔄 กำลังลองใหม่',
  REVOKED: '🛑 ยกเลิก',
  PROGRESS: 'กำลังประมวลผล...',
  'กำลังเตรียม render...': 'กำลังเตรียมสร้างวิดีโอ...',
  'กำลัง render วิดีโอ...': 'กำลังสร้างวิดีโอ...',
};

// ข้อความ "Step n/4: ..." จาก backend (tasks.py) — แปลงที่หน้าเว็บ ไม่แก้ backend
// ชื่อขั้นตรงกับสิ่งที่ backend ทำจริง: Step 2 = VAD (หาช่วงเสียงพูด), Step 3 = Whisper + Gemini
const STEP_STATUS = [
  [/^Step 1\/4/, 'ขั้นที่ 1 จาก 4 · กำลังแยกเสียง'],
  [/^Step 2\/4/, 'ขั้นที่ 2 จาก 4 · กำลังหาช่วงเสียงพูด'],
  [/^Step 3\/4/, 'ขั้นที่ 3 จาก 4 · กำลังถอดเสียงและวิเคราะห์'],
  [/^Step 4\/4/, 'ขั้นที่ 4 จาก 4 · กำลังตัดและรวมคลิป'],
];

/** แปลงสถานะจาก backend เป็นไทย — ข้อความที่ไม่รู้จัก (เช่นข้อความไทยระหว่างถอดเสียง) แสดงตามเดิม */
const translateStatus = (raw) => {
  if (STATUS_TRANSLATIONS[raw]) return STATUS_TRANSLATIONS[raw];
  const hit = STEP_STATUS.find(([re]) => re.test(raw));
  return hit ? hit[1] : raw;
};

// label = ชื่อบนจอกว้าง (วงกลมแนวนอน) · longLabel = ชื่อบนมือถือ (เรียงแนวตั้ง)
const STEPS = [
  { id: 1, label: 'แยกเสียง',      longLabel: 'แยกเสียงออกจากวิดีโอ',      icon: FileAudio, progressMin: 0,  progressMax: 24 },
  { id: 2, label: 'ฟังเสียงพูด',    longLabel: 'หาช่วงที่มีเสียงพูด',         icon: Loader2,   progressMin: 25, progressMax: 44 },
  { id: 3, label: 'AI วิเคราะห์',   longLabel: 'ถอดเสียงและให้ AI วิเคราะห์', icon: Brain,     progressMin: 45, progressMax: 79 },
  { id: 4, label: 'ตัดและรวมคลิป',  longLabel: 'ตัดและรวมเป็นวิดีโอใหม่',     icon: Film,      progressMin: 80, progressMax: 100 },
];

// งานที่ยังไม่เริ่มประมวลผลเลย (รอคิว) นานเกินนี้ → เตือนว่ายังรอคิว แต่ poll ต่อ
// (worker ทำทีละงาน --concurrency=1 ผู้ใช้หลายคนพร้อมกันจึงรอคิวนานได้จริง ไม่ใช่งานค้าง)
const STUCK_IN_QUEUE_MS = 15 * 60 * 1000;   // 15 นาที
// เพดานสูงสุด — ต่อให้กำลังทำงานอยู่ ถ้าเกินนี้ก็เลิก poll (worker อาจค้างเงียบ ๆ)
const MAX_POLL_MS = 90 * 60 * 1000;         // 90 นาที
// วิดีโอยาว + CPU ช้า ใช้เวลานานได้ — เกินนี้แค่ "เตือน" ยัง poll ต่อ
const SLOW_WARN_MS = 12 * 60 * 1000;        // 12 นาที
// ยอมแพ้ถ้าเชื่อมต่อ backend ไม่ได้ติดต่อกันเกินจำนวนนี้ (≈ 20 × 3s = 60s)
const MAX_CONSECUTIVE_ERRORS = 20;

// isRender = เรนเดอร์หลังเลือกช่วง (render_only_task) — progress ของงานนี้ไม่ได้ไล่ตาม 4 ขั้นของการวิเคราะห์
// จึงแสดงขั้น 1–3 เป็นเสร็จแล้ว ขั้น 4 กำลังทำ (แสดงผลอย่างเดียว ไม่กระทบการ poll)
const Processing = ({ jobId, onComplete, onCancel, isRender = false }) => {
  const [status, setStatus] = useState('PENDING');
  const [message, setMessage] = useState('🕐 รอคิวประมวลผล');
  const [progress, setProgress] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [canceling, setCanceling] = useState(false);
  const [slowWarn, setSlowWarn] = useState(false);
  const [queueWarn, setQueueWarn] = useState(false);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const sawProgressRef = useRef(false);   // เคยเห็น task เริ่มประมวลผลจริงไหม
  const onCompleteRef = useRef(onComplete);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const stopPolling = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  // เก็บเวลาเริ่มไว้ใน localStorage → refresh แล้ว timer ไม่รีเซ็ตเป็น 0
  useEffect(() => {
    const key = `aive_start_${jobId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      startTimeRef.current = parseInt(saved, 10);
    } else {
      startTimeRef.current = Date.now();
      localStorage.setItem(key, String(startTimeRef.current));
    }
    setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
  }, [jobId]);

  // งานจบ (สำเร็จ/ล้มเหลว) → ล้างเวลาเริ่มที่เก็บไว้
  useEffect(() => {
    if (status === 'SUCCESS' || status === 'FAILURE') {
      localStorage.removeItem(`aive_start_${jobId}`);
    }
  }, [status, jobId]);

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let errorCount = 0;
    const checkStatus = async () => {
      if (cancelled) return;

      const elapsed = Date.now() - startTimeRef.current;
      // ยังไม่เริ่มประมวลผลเลยนานเกินไป → แค่เตือนว่ายังรอคิว ยัง poll ต่อ
      // (เดิมประกาศว่าล้มเหลว ทั้งที่งานยังอยู่ในคิวและจะถูกทำต่อ)
      setQueueWarn(!sawProgressRef.current && elapsed > STUCK_IN_QUEUE_MS);
      // เพดานสูงสุดจริง ๆ — ต่อให้กำลังทำงานอยู่ ก็เลิก poll (แต่งานอาจเสร็จเบื้องหลัง)
      if (elapsed > MAX_POLL_MS) {
        stopPolling();
        setStatus('FAILURE');
        setMessage('ยังไม่เสร็จภายใน 90 นาที — งานอาจยังประมวลผลต่อเบื้องหลัง ดูสถานะได้ที่ "งานของฉัน"');
        return;
      }
      // นานกว่าปกติแต่ยังทำงานอยู่ → แค่เตือน ยัง poll ต่อ
      if (elapsed > SLOW_WARN_MS && sawProgressRef.current) setSlowWarn(true);

      try {
        const { data } = await axios.get(`${API_URL}/status/${jobId}`);
        if (cancelled) return;
        errorCount = 0;   // ติดต่อสำเร็จ → reset ตัวนับ error

        if (data.status === 'SUCCESS') {
          stopPolling();
          setStatus('SUCCESS');
          setProgress(100);
          const mode = data.result?.mode;
          if (mode === 'preview') {
            // Preview mode: ไม่ render — แจ้ง parent ไปหน้า preview
            setMessage('วิเคราะห์เสร็จ — กำลังเปิดหน้าเลือกช่วง');
            onCompleteRef.current('__PREVIEW__');
          } else {
            // Final render เสร็จ
            setMessage('ตัดต่อเสร็จเรียบร้อยแล้ว');
            const finalUrl = data.result?.output_url;
            if (finalUrl) {
              onCompleteRef.current(finalUrl, data.result?.edit_summary);
            }
          }
        } else if (data.status === 'FAILURE') {
          stopPolling();
          setStatus('FAILURE');
          setMessage('เกิดข้อผิดพลาด: ' + (data.result || 'AI ไม่สามารถประมวลผลได้'));
        } else {
          setStatus('PROGRESS');
          const raw = data.status || 'กำลังประมวลผล...';
          setMessage(translateStatus(raw));
          setProgress(data.progress || 0);
          // task เริ่มทำงานจริงแล้ว (ไม่ค้างในคิว)
          if (raw === 'PROGRESS' || raw === 'STARTED' || (data.progress || 0) > 0) {
            sawProgressRef.current = true;
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Polling error', err);
        errorCount += 1;
        // เชื่อมต่อ backend ไม่ได้ติดต่อกันหลายครั้ง → เลิก poll แล้วแจ้ง error
        if (errorCount >= MAX_CONSECUTIVE_ERRORS) {
          stopPolling();
          setStatus('FAILURE');
          setMessage('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
        }
      }
    };
    checkStatus();
    intervalRef.current = setInterval(checkStatus, 3000);
    return () => { cancelled = true; stopPolling(); };
  }, [jobId]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ยกเลิกจริง — เรียก backend ให้หยุด task (ไม่ปล่อยกิน GPU ต่อ) แล้วค่อยรีเซ็ต
  const handleCancel = async () => {
    if (status === 'FAILURE') return onCancel();   // งาน fail แล้ว ไม่ต้องเรียก cancel
    stopPolling();
    setCanceling(true);
    try {
      await axios.post(`${API_URL}/cancel/${jobId}`);
    } catch (e) {
      console.error('cancel failed', e);   // best-effort — รีเซ็ตต่อไป
    }
    onCancel();
  };

  const currentStepIdx = STEPS.findIndex(s => progress >= s.progressMin && progress <= s.progressMax);
  const safeStepIdx = isRender ? STEPS.length - 1 : (currentStepIdx === -1 ? 0 : currentStepIdx);
  const isFailure = status === 'FAILURE';
  const isSuccess = status === 'SUCCESS';
  const isPending = message.startsWith('🕐') || status === 'PENDING';
  // ETA โดยประมาณจาก progress ปัจจุบัน (ประเมินคร่าว ๆ — บอกให้ user อุ่นใจว่ายังไม่ค้าง)
  const eta = (status === 'PROGRESS' && progress > 8 && progress < 100)
    ? Math.round((elapsedSec / progress) * (100 - progress))
    : null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Status hero */}
      <div className="bg-white rounded-2xl border border-line overflow-hidden">
        <div className="p-6 sm:p-8 text-center">
          {/* Icon */}
          <div className="inline-flex mb-4">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${
              isSuccess ? 'bg-primary-soft text-primary-dark' :
              isFailure ? 'bg-red-50 text-red-600' :
              isPending ? 'bg-amber-50 text-amber-700' :
              'bg-primary-soft text-primary-dark'
            }`}>
              {isSuccess ? <CheckCircle className="h-7 w-7" /> :
                isFailure ? <AlertTriangle className="h-7 w-7" /> :
                isPending ? <Clock className="h-7 w-7 animate-pulse" /> :
                <Loader2 className="h-7 w-7 animate-spin" />}
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl sm:text-[26px] font-semibold text-ink">
            {isSuccess ? 'เสร็จแล้ว' :
              isFailure ? 'มีบางอย่างผิดพลาด' :
              isPending ? 'กำลังรอคิว' : 'กำลังตัดต่อวิดีโอ'}
          </h2>
          <p className="text-base text-muted mt-1.5 max-w-md mx-auto">{message}</p>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="w-full bg-line rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-700 ease-out ${
                  isSuccess ? 'bg-primary' :
                  isFailure ? 'bg-red-500' :
                  isPending ? 'bg-amber-400' :
                  'bg-primary'
                }`}
                style={{ width: `${Math.max(progress, isPending ? 5 : 0)}%` }}
              />
            </div>
            <div className="flex items-center justify-between flex-wrap gap-x-3 mt-2.5 text-sm">
              <span className="font-semibold text-ink">{progress}% · ผ่านไป {formatTime(elapsedSec)}</span>
              {eta != null && (
                <span className="text-muted">เหลืออีกประมาณ {formatTime(eta)}</span>
              )}
            </div>
          </div>

          {/* เตือนเมื่อใช้เวลานานกว่าปกติ แต่ยังทำงานอยู่ */}
          {slowWarn && !isFailure && !isSuccess && (
            <p className="text-sm text-amber-800 mt-4 max-w-sm mx-auto leading-relaxed">
              ⏳ ใช้เวลานานกว่าปกติ (วิดีโอยาว/เครื่องช้า) — ยังทำงานอยู่ ไม่ต้องปิดหรือเริ่มใหม่
            </p>
          )}

          {/* รอคิวนาน (มีงานของผู้ใช้อื่นอยู่ก่อน) — ไม่ใช่ error */}
          {queueWarn && !isFailure && !isSuccess && (
            <p className="text-sm text-amber-800 mt-4 max-w-sm mx-auto leading-relaxed">
              ⏳ ยังรอคิวอยู่ — มีงานของผู้ใช้คนอื่นกำลังประมวลผล ไม่ต้องปิดหรือเริ่มใหม่
            </p>
          )}

          {/* บอก user ว่าปิดหน้าได้ ระบบทำงานต่อ */}
          {!isFailure && !isSuccess && (
            <div className="text-[15px] text-muted mt-4 max-w-sm mx-auto leading-relaxed">
              <p>ปิดหน้านี้หรือปิดเครื่องได้ ระบบทำงานต่อเอง</p>
              <p>ดูผลได้ที่ "งานของฉัน" เมื่อเข้าสู่ระบบด้วยบัญชีเดิม</p>
            </div>
          )}
        </div>

        {/* Step indicator */}
        {!isFailure && !isSuccess && (
          <div className="border-t border-line px-5 sm:px-6 py-6 bg-page">
            {/* จอกว้าง — วงกลม 4 ขั้นแนวนอน */}
            <div className="hidden sm:grid grid-cols-4 gap-3">
              {STEPS.map((s, idx) => {
                const Icon = s.icon;
                const isDone = idx < safeStepIdx;
                const isCurrent = idx === safeStepIdx;
                return (
                  <div key={s.id} className="flex flex-col items-center text-center">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center text-base font-bold transition-all ${
                      isDone ? 'bg-ok text-white' :
                      isCurrent ? 'bg-accent text-white ring-4 ring-accent/20' :
                      'bg-slate-200 text-slate-500'
                    }`}>
                      {isDone ? '✓' : <Icon className={`h-5 w-5 ${isCurrent && Icon === Loader2 ? 'animate-spin' : ''}`} />}
                    </div>
                    <p className={`text-sm mt-2 leading-tight ${
                      isCurrent ? 'font-semibold text-primary-dark' :
                      isDone ? 'font-medium text-ink' : 'text-muted'
                    }`}>
                      {s.label}
                    </p>
                  </div>
                );
              })}
            </div>
            {/* มือถือ — เรียงแนวตั้ง วงกลม 32px + ข้อความ 16px */}
            <ol className="sm:hidden space-y-3">
              {STEPS.map((s, idx) => {
                const isDone = idx < safeStepIdx;
                const isCurrent = idx === safeStepIdx;
                return (
                  <li key={s.id} className="flex items-center gap-3" aria-current={isCurrent ? 'step' : undefined}>
                    <span className={`h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                      isDone ? 'bg-ok text-white' :
                      isCurrent ? 'bg-accent text-white ring-4 ring-accent/20' :
                      'bg-slate-200 text-slate-600'
                    }`}>
                      {isDone ? '✓' : s.id}
                    </span>
                    <span className={`text-base ${
                      isCurrent ? 'font-semibold text-primary-dark' :
                      isDone ? 'text-ink' : 'text-muted'
                    }`}>
                      {s.longLabel}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>

      {/* Cancel/Reset button */}
      {(status === 'PROGRESS' || status === 'PENDING' || isFailure) && onCancel && (
        <button
          onClick={handleCancel}
          disabled={canceling}
          className="w-full min-h-11 py-3 rounded-xl text-base font-semibold text-ink bg-white border border-line-strong hover:bg-page hover:border-primary/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isFailure ? '← กลับไปหน้าแรก' : canceling ? 'กำลังยกเลิก...' : '✕ ยกเลิกงาน'}
        </button>
      )}
    </div>
  );
};

export default Processing;
