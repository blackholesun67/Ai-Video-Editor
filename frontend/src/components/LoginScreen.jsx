import React, { useState } from 'react';
import axios from 'axios';
import { Sparkles, Loader2, LogIn, UserPlus } from 'lucide-react';
import { API_URL, setAuthToken } from '../config';

/**
 * หน้า Login/Register — component เดียว สลับโหมดด้วย state `mode`
 * เปิดมาเจอ Login ก่อน · กด "สมัครสมาชิก" สลับเป็นฟอร์ม register
 * สมัคร/ล็อกอินสำเร็จ → backend คืน access_token → เก็บ token → เรียก onLogin เข้าแอป
 */
export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login');       // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isRegister = mode === 'register';

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const path = isRegister ? '/auth/register' : '/auth/login';
      const body = isRegister ? { email, username, password } : { email, password };
      const res = await axios.post(`${API_URL}${path}`, body);
      const token = res.data?.access_token;
      if (!token) throw new Error('no token');
      setAuthToken(token);              // เก็บ + แนบ Bearer ให้ทุก request ต่อไป
      onLogin?.(token);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      // backend ส่งข้อความไทยมาให้แล้ว (string) · 422/validation = array → ใช้ข้อความรวม
      setError(typeof detail === 'string' ? detail : 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(isRegister ? 'login' : 'register');
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-8">
      {/* โลโก้ */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">AI Video Smart Editor</h1>
      </div>

      {/* การ์ดฟอร์ม */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-slate-900 text-center">
          {isRegister ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
        </h2>
        <p className="text-sm text-slate-500 text-center mt-1">
          {isRegister ? 'สร้างบัญชีเพื่อเริ่มใช้งาน' : 'เข้าสู่ระบบเพื่อจัดการงานของคุณ'}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">อีเมล</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อผู้ใช้</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="ชื่อที่แสดง"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isRegister ? 6 : undefined}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            />
            {isRegister && (
              <p className="text-xs text-slate-400 mt-1">อย่างน้อย 6 ตัวอักษร</p>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isRegister ? (
              <><UserPlus className="h-5 w-5" /> สมัครสมาชิก</>
            ) : (
              <><LogIn className="h-5 w-5" /> เข้าสู่ระบบ</>
            )}
          </button>
        </form>

        {/* สลับโหมด */}
        <p className="text-sm text-slate-500 text-center mt-5">
          {isRegister ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?'}{' '}
          <button
            type="button"
            onClick={switchMode}
            className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            {isRegister ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </button>
        </p>
      </div>
    </div>
  );
}
