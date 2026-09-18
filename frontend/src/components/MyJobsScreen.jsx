import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Download, Loader2, FileVideo, RefreshCw } from 'lucide-react';
import { API_URL, fetchMediaToken } from '../config';

// ป้ายสถานะ (ตรงกับค่าที่ worker เขียนลง DB) → ข้อความไทย + สี
const STATUS_META = {
  processing: { label: 'กำลังประมวลผล', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ready:      { label: 'พร้อมเลือกช่วง', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  done:       { label: 'เสร็จแล้ว',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed:     { label: 'ล้มเหลว',        cls: 'bg-red-50 text-red-700 border-red-200' },
  cancelled:  { label: 'ยกเลิก',         cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  expired:    { label: 'หมดอายุ',        cls: 'bg-slate-100 text-slate-400 border-slate-200' },
};

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('th-TH', {
      day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * หน้า "งานของฉัน" — ดึงรายการงานจาก GET /jobs (เฉพาะของ user ที่ login)
 * งานที่ done → ดาวน์โหลดผลลัพธ์ได้ (ผ่าน media token)
 */
export default function MyJobsScreen({ onClose }) {
  const [jobs, setJobs] = useState(null);   // null = ยังไม่โหลด
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');

  const load = () => {
    setError('');
    setJobs(null);
    axios.get(`${API_URL}/jobs`)
      .then((res) => setJobs(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        setError(err.response?.data?.detail || 'โหลดรายการงานไม่สำเร็จ');
        setJobs([]);
      });
  };

  useEffect(load, []);

  const download = async (jobId) => {
    setDownloading(jobId);
    try {
      const token = await fetchMediaToken(jobId);
      if (token) {
        // เปิดลิงก์ดาวน์โหลด (แนบ media token) — เบราว์เซอร์จัดการดาวน์โหลดเอง
        window.location.href = `${API_URL}/download/${jobId}?token=${token}`;
      }
    } finally {
      setDownloading('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> กลับ
        </button>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <RefreshCw className="h-4 w-4" /> รีเฟรช
        </button>
      </div>

      <h2 className="text-2xl font-semibold text-slate-900">งานของฉัน</h2>

      {jobs === null && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {jobs !== null && jobs.length === 0 && !error && (
        <div className="text-center py-16 text-slate-400">
          <FileVideo className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>ยังไม่มีงาน — อัปโหลดวิดีโอเพื่อเริ่มต้น</p>
        </div>
      )}

      <div className="space-y-2.5">
        {(jobs || []).map((job) => {
          const meta = STATUS_META[job.status] || { label: job.status, cls: 'bg-slate-100 text-slate-500 border-slate-200' };
          return (
            <div
              key={job.id}
              className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3"
            >
              <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <FileVideo className="h-4.5 w-4.5 text-slate-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {job.original_filename || 'ไม่มีชื่อไฟล์'}
                </p>
                <p className="text-xs text-slate-400">{fmtDate(job.created_at)}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${meta.cls} whitespace-nowrap`}>
                {meta.label}
              </span>
              {job.status === 'done' && (
                <button
                  onClick={() => download(job.id)}
                  disabled={downloading === job.id}
                  title="ดาวน์โหลดผลลัพธ์"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 shrink-0"
                >
                  {downloading === job.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Download className="h-4 w-4" />}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
