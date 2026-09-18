import axios from "axios";

// API URL configuration
// Priority:
//   1. VITE_API_URL build-time env (สำหรับ deploy production; ใส่ /api ได้ถ้าอยู่หลัง reverse proxy)
//   2. window.location.origin + :8000 (ทำงานทั้ง localhost และ remote)
//   3. fallback localhost
const ENV_URL = import.meta.env?.VITE_API_URL;
const ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

let inferredBackend = "http://127.0.0.1:8000";
if (ENV_URL) {
  inferredBackend = ENV_URL.replace(/\/$/, "");
} else if (ORIGIN) {
  try {
    const u = new URL(ORIGIN);
    // ถ้า frontend ถูก serve ที่ port 80 หรือ origin → ลอง :8000 ของ host เดียวกัน
    inferredBackend = `${u.protocol}//${u.hostname}:8000`;
  } catch {
    /* keep fallback */
  }
}

export const API_URL = inferredBackend;

// สถานะแถวไทม์ไลน์ของหน้า preview (ติ๊กไว้ / ขอบที่ขยับ)
// เก็บไว้เพราะ App remount PreviewScreen ตอนกดกลับจากหน้าแก้ซับ — ไม่งั้นงานที่แก้หายหมด
export const PREVIEW_ROWS_KEY = "aive_preview_rows";

// ── API key (optional) ───────────────────────────────────────────────────────
// ถ้า build ด้วย VITE_API_KEY → แนบ header X-API-Key ให้ทุก request อัตโนมัติ
// (ต้องตรงกับค่าใน API_KEYS ฝั่ง backend) ปล่อยว่าง = ไม่แนบ (dev)
const API_KEY = import.meta.env?.VITE_API_KEY;
if (API_KEY) {
  axios.defaults.headers.common["X-API-Key"] = API_KEY;
}

// ── Auth token (JWT) ─────────────────────────────────────────────────────────
// เก็บ token ใน localStorage + แนบ header Authorization: Bearer ให้ทุก request
// อัตโนมัติ (axios default header) — endpoint ที่ต้อง login จึงผ่าน guard ฝั่ง backend
export const AUTH_TOKEN_KEY = "aive_token";
// event ที่ยิงเมื่อ token หมดอายุ/ถูกปฏิเสธ (401) → App ฟังเพื่อเด้งกลับหน้า login
export const AUTH_LOGOUT_EVENT = "aive:auth-logout";

export function getAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;   // private mode / storage ปิด
  }
}

// ── Media token ──────────────────────────────────────────────────────────────
// ขอ token อายุสั้นผูกกับ job (Bearer แนบให้อัตโนมัติ) สำหรับใช้กับ <video src> และ
// <a download> ที่เป็น request ตรงของเบราว์เซอร์ — แนบ header Authorization ไม่ได้
// จึงต้องส่ง token ใน query string แทน (?token=...)
export async function fetchMediaToken(jobId) {
  try {
    const res = await axios.get(`${API_URL}/jobs/${jobId}/media-token`);
    return res.data?.token || null;
  } catch {
    return null;
  }
}

export function setAuthToken(token) {
  if (token) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } catch {
      /* เขียน storage ไม่ได้ (private mode) — header ยังทำงานในเซสชันนี้ */
    }
  } else {
    delete axios.defaults.headers.common["Authorization"];
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }
}

// คืนค่า token ที่เก็บไว้ตอนโหลดหน้าใหม่ (refresh แล้วยัง login อยู่ ไม่ต้องกรอกซ้ำ)
const _savedToken = getAuthToken();
if (_savedToken) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${_savedToken}`;
}

// เมื่อ token หมดอายุ/ไม่ถูกต้อง → backend ตอบ 401 → เคลียร์ token + แจ้ง App
// (ยกเว้น request ของ /auth/login|register เอง — 401 ที่นั่น = รหัสผิด ให้ฟอร์มโชว์ error เอง
//  ไม่ใช่ session หมดอายุ จึงไม่ต้องยิง logout)
axios.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error?.config?.url || "";
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/register");
    if (error?.response?.status === 401 && !isAuthEndpoint) {
      setAuthToken(null);
      try {
        window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
      } catch {
        /* ignore */
      }
    }
    return Promise.reject(error);
  }
);
