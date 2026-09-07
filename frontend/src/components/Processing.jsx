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
};

const STEPS = [
  { id: 1, label: 'แยกเสียง',       icon: FileAudio,  progressMin: 0,  progressMax: 24 },
  { id: 2, label: 'ฟังเสียงพูด',     icon: Loader2,    progressMin: 25, progressMax: 44 },
  { id: 3, label: 'AI คิดวิเคราะห์', icon: Brain,      progressMin: 45, progressMax: 79 },
  { id: 4, label: 'ตัดและรวมคลิป',   icon: Film,       progressMin: 80, progressMax: 100 },
];

// งานที่ยังไม่เริ่มประมวลผลเลย (ค้างในคิว) นานเกินนี้ → ถือว่าค้างจริง เลิก poll
const STUCK_IN_QUEUE_MS = 15 * 60 * 1000;   // 15 นาที
// เพดานสูงสุด — ต่อให้กำลังทำงานอยู่ ถ้าเกินนี้ก็เลิก poll (worker อาจค้างเงียบ ๆ)
const MAX_POLL_MS = 90 * 60 * 1000;         // 90 นาที
// วิดีโอยาว + CPU ช้า ใช้เวลานานได้ — เกินนี้แค่ "เตือน" ยัง poll ต่อ
const SLOW_WARN_MS = 12 * 60 * 1000;        // 12 นาที
// ยอมแพ้ถ้าเชื่อมต่อ backend ไม่ได้ติดต่อกันเกินจำนวนนี้ (≈ 20 × 3s = 60s)
const MAX_CONSECUTIVE_ERRORS = 20;

const Processing = ({ jobId, onComplete, onCancel }) => {
  const [status, setStatus] = useState('PENDING');
  const [message, setMessage] = useState('🕐 รอคิวประมวลผล');
  const [progress, setProgress] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [canceling, setCanceling] = useState(false);
  const [slowWarn, setSlowWarn] = useState(false);
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
      // ยังไม่เริ่มประมวลผลเลย (ค้างในคิว) นานเกินไป → worker น่าจะไม่ทำงาน
      if (!sawProgressRef.current && elapsed > STUCK_IN_QUEUE_MS) {
        stopPolling();
        setStatus('FAILURE');
        setMessage('งานค้างในคิว — worker อาจไม่ทำงาน ลองรีสตาร์ท backend/worker แล้วลองใหม่');
        return;
      }
      // เพดานสูงสุดจริง ๆ — ต่อให้กำลังทำงานอยู่ ก็เลิก poll (แต่งานอาจเสร็จเบื้องหลัง)
      if (elapsed > MAX_POLL_MS) {
        stopPolling();
        setStatus('FAILURE');
        setMessage('ใช้เวลานานผิดปกติ — งานอาจค้าง ลองกลับมาเปิดหน้านี้ใหม่ หรือเริ่มใหม่');
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
            setMessage('✨ วิเคราะห์เสร็จ — เปิด preview');
            onCompleteRef.current('__PREVIEW__');
          } else {
            // Final render เสร็จ
            setMessage('✨ ตัดต่อเสร็จเรียบร้อยแล้ว!');
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
          setMessage(STATUS_TRANSLATIONS[raw] || raw);
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
  const safeStepIdx = currentStepIdx === -1 ? 0 : currentStepIdx;
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
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 sm:p-8 text-center">
          {/* Icon */}
          <div className="inline-flex mb-4">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${
              isSuccess ? 'bg-emerald-50 text-emerald-600' :
              isFailure ? 'bg-red-50 text-red-600' :
              isPending ? 'bg-amber-50 text-amber-600' :
              'bg-indigo-50 text-indigo-600'
            }`}>
              {isSuccess ? <CheckCircle className="h-7 w-7" /> :
                isFailure ? <AlertTriangle className="h-7 w-7" /> :
                isPending ? <Clock className="h-7 w-7 animate-pulse" /> :
                <Loader2 className="h-7 w-7 animate-spin" />}
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">
            {isSuccess ? 'เสร็จแล้ว' :
              isFailure ? 'มีบางอย่างผิดพลาด' :
              isPending ? 'กำลังรอคิว' : 'กำลังตัดต่อให้อยู่'}
          </h2>
          <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">{message}</p>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-700 ease-out ${
                  isSuccess ? 'bg-emerald-500' :
                  isFailure ? 'bg-red-500' :
                  isPending ? 'bg-amber-400' :
                  'bg-indigo-600'
                }`}
                style={{ width: `${Math.max(progress, isPending ? 5 : 0)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2.5 text-sm">
              <span className="font-semibold text-slate-700">{progress}% · ผ่านไป {formatTime(elapsedSec)}</span>
              {eta != null && (
                <span className="text-slate-400">เหลืออีกประมาณ {formatTime(eta)}</span>
              )}
            </div>
          </div>

          {/* เตือนเมื่อใช้เวลานานกว่าปกติ แต่ยังทำงานอยู่ */}
          {slowWarn && !isFailure && !isSuccess && (
            <p className="text-xs text-amber-600 mt-4 max-w-sm mx-auto leading-relaxed">
              ⏳ ใช้เวลานานกว่าปกติ (วิดีโอยาว/เครื่องช้า) — ยังทำงานอยู่ ไม่ต้องปิดหรือเริ่มใหม่
            </p>
          )}

          {/* บอก user ว่าปิดหน้าได้ ระบบทำงานต่อ */}
          {!isFailure && !isSuccess && (
            <p className="text-xs text-slate-400 mt-4 max-w-sm mx-auto leading-relaxed">
              💡 ปิดหน้านี้หรือปิดเครื่องได้ — ระบบประมวลผลต่อเบื้องหลัง กลับมาที่หน้านี้ (บนเบราว์เซอร์เดิม) เพื่อดูผลได้
            </p>
          )}
        </div>

        {/* Step indicator */}
        {!isFailure && !isSuccess && (
          <div className="border-t border-slate-100 px-6 py-6 bg-slate-50/50">
            <div className="grid grid-cols-4 gap-3">
              {STEPS.map((s, idx) => {
                const Icon = s.icon;
                const isDone = idx < safeStepIdx;
                const isCurrent = idx === safeStepIdx;
                return (
                  <div key={s.id} className="flex flex-col items-center text-center">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center text-base font-bold transition-all ${
                      isDone ? 'bg-emerald-500 text-white' :
                      isCurrent ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' :
                      'bg-slate-200 text-slate-400'
                    }`}>
                      {isDone ? '✓' : <Icon className={`h-5 w-5 ${isCurrent && Icon === Loader2 ? 'animate-spin' : ''}`} />}
                    </div>
                    <p className={`text-xs mt-2 leading-tight ${
                      isCurrent ? 'font-semibold text-indigo-700' :
                      isDone ? 'text-emerald-600' : 'text-slate-400'
                    }`}>
                      {s.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Cancel/Reset button */}
      {(status === 'PROGRESS' || status === 'PENDING' || isFailure) && onCancel && (
        <button
          onClick={handleCancel}
          disabled={canceling}
          className="w-full py-3 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isFailure ? '← กลับไปหน้าแรก' : canceling ? 'กำลังยกเลิก...' : '✕ ยกเลิกงาน'}
        </button>
      )}
    </div>
  );
};

export default Processing;
