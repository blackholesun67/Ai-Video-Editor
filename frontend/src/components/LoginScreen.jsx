import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Sparkles, Loader2, X, Scissors, ShieldCheck, Zap } from 'lucide-react';
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
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          auto_select: false,          // ไม่ auto login เงียบ ๆ — ให้ผู้ใช้กดยืนยันก่อน
          cancel_on_tap_outside: true, // แตะนอก One Tap = ปิด (ไม่บังคับ)
        });
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 300,
        });
        // One Tap — ผู้ใช้เก่าที่มี Google session ค้างในเบราว์เซอร์
        // จะเห็นการ์ด "ดำเนินการต่อในชื่อ ..." (มีรูป+อีเมล) เด้งขึ้นเอง แบบ Canva
        window.google.accounts.id.prompt();
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
        className="relative w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/5 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {isModal && (
          <button type="button" onClick={onClose} aria-label="ปิด"
            className="absolute top-3 right-3 z-10 text-white/80 hover:text-white rounded-lg p-1 hover:bg-white/15">
            <X className="h-5 w-5" />
          </button>
        )}

        {/* หัวการ์ด — แถบ gradient indigo + โลโก้ */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 px-6 pt-7 pb-6 text-center">
          <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mx-auto ring-1 ring-white/25">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-white mt-3">ยินดีต้อนรับ</h2>
          <p className="text-sm text-indigo-100 mt-0.5">เข้าสู่ระบบเพื่อเริ่มตัดวิดีโอด้วย AI</p>
        </div>

        {/* เนื้อการ์ด */}
        <div className="px-6 sm:px-8 py-6">
          {/* จุดขาย 3 ข้อ */}
          <ul className="space-y-2.5 mb-6">
            {[
              { icon: Scissors, text: 'ตัดวิดีโออัตโนมัติด้วย AI' },
              { icon: ShieldCheck, text: 'ปลอดภัยด้วยบัญชี Google' },
              { icon: Zap, text: 'ไม่ต้องจำรหัสผ่าน เข้าใช้ได้ทันที' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-600">
                <span className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <div className="flex flex-col items-center gap-3 min-h-[46px]">
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
    </div>
  );
}
