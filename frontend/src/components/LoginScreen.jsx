import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Sparkles, Loader2, X } from 'lucide-react';
import { API_URL, setAuthToken } from '../config';

/**
 * หน้า Login — ล็อกอินด้วย Google อย่างเดียว (Google Identity Services)
 *   1) ดึง Google Client ID จาก backend (GET /auth/config)
 *   2) โหลดสคริปต์ GIS + render ปุ่ม "Sign in with Google"
 *   3) ผู้ใช้ login Google → ได้ credential (ID token) → POST /auth/google → ได้ JWT ของเรา
 * ส่ง prop `onClose` = แสดงเป็น modal ซ้อน · ไม่ส่ง = เต็มหน้า
 */
function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    let s = document.getElementById('gis-script');
    if (s) { s.addEventListener('load', () => resolve()); s.addEventListener('error', reject); return; }
    s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.id = 'gis-script'; s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('โหลด Google ไม่สำเร็จ'));
    document.head.appendChild(s);
  });
}

export default function LoginScreen({ onLogin, onClose }) {
  const isModal = typeof onClose === 'function';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const btnRef = useRef(null);
  const onLoginRef = useRef(onLogin);
  onLoginRef.current = onLogin;   // ให้ callback ของ GIS อ่านค่าล่าสุดเสมอ

  useEffect(() => {
    let cancelled = false;

    const handleCredential = async (resp) => {
      setError(''); setLoading(true);
      try {
        const res = await axios.post(`${API_URL}/auth/google`, { credential: resp.credential });
        setAuthToken(res.data.access_token);
        onLoginRef.current?.(res.data.access_token);
      } catch (err) {
        setError(err?.response?.data?.detail || 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
      } finally {
        setLoading(false);
      }
    };

    (async () => {
      try {
        const cfg = await axios.get(`${API_URL}/auth/config`);
        const clientId = cfg.data?.google_client_id || '';
        if (cancelled) return;
        if (!clientId) { setError('ระบบยังไม่ได้ตั้งค่า Google Client ID'); return; }
        await loadGis();
        if (cancelled || !btnRef.current) return;
        window.google.accounts.id.initialize({ client_id: clientId, callback: handleCredential });
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', width: 300,
        });
        setReady(true);
      } catch {
        if (!cancelled) setError('เชื่อมต่อ Google ไม่สำเร็จ กรุณาลองใหม่');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <div
      className={
        isModal
          ? 'fixed inset-0 z-50 flex items-center justify-center px-4 py-8 overflow-y-auto bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200'
          : 'min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-8'
      }
      onClick={isModal ? onClose : undefined}
    >
      {!isModal && (
        <div className="flex items-center gap-2.5 mb-8">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">AI Video Smart Editor</h1>
        </div>
      )}

      <div
        className="relative w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {isModal && (
          <button type="button" onClick={onClose} aria-label="ปิด"
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 rounded-lg p-1 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        )}

        {isModal && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
          </div>
        )}

        <h2 className="text-xl font-semibold text-slate-900 text-center">เข้าสู่ระบบ</h2>
        <p className="text-sm text-slate-500 text-center mt-1">เข้าสู่ระบบด้วยบัญชี Google เพื่อเริ่มใช้งาน</p>

        <div className="mt-6 flex flex-col items-center gap-3 min-h-[46px]">
          {/* GIS จะ render ปุ่ม Sign in with Google ในกล่องนี้ */}
          <div ref={btnRef} />
          {!ready && !error && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
          {loading && (
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> กำลังเข้าสู่ระบบ...
            </p>
          )}
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
            {error}
          </div>
        )}

        <p className="text-xs text-slate-400 text-center mt-6">
          การเข้าสู่ระบบถือว่ายอมรับเงื่อนไขการใช้งาน
        </p>
      </div>
    </div>
  );
}
