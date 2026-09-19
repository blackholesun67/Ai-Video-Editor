import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Download, Loader2, FileVideo, RefreshCw, Play } from 'lucide-react';
import { API_URL, fetchMediaToken } from '../config';

// ป้ายสถานะ (ตรงกับค่าที่ worker เขียนลง DB) → ข้อความไทย + สี
const STATUS_META = {
  processing: { label: 'กำลังประมวลผล', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ready:      { label: 'พร้อมเลือกช่วง', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  done:       { label: 'เสร็จแล้ว',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed:     { label: 'ล้มเหลว',        cls: 'bg-red-50 text-red-700 border-red-200' },
  cancelled:  { label: 'ยกเลิก',         cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  // งานที่หมดอายุ (ครบ 7 วัน) ถูกลบทั้ง row ออกจาก DB แล้ว → ไม่มี status นี้อีก
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
 * หน้า "งานของฉัน" — gallery การ์ดวิดีโอ (GET /jobs)
 * งาน done → มีภาพปก (thumbnail.jpg ผ่าน media token) + ดาวน์โหลดได้
 * งานอื่น/หมดอายุ → placeholder + ปิดปุ่มดาวน์โหลด
 */
export default function MyJobsScreen({ onClose }) {
  const [jobs, setJobs] = useState(null);   // null = ยังไม่โหลด
  const [error, setError] = useState('');
  const [tokens, setTokens] = useState({}); // jobId → media token (สำหรับ thumbnail/download)
  const [downloading, setDownloading] = useState('');

  const load = () => {
    setError('');
    setJobs(null);
    setTokens({});
    axios.get(`${API_URL}/jobs`)
      .then(async (res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setJobs(list);
        // ขอ media token ให้เฉพาะงาน done (ไว้โหลดภาพปก + ดาวน์โหลด)
        const done = list.filter((j) => j.status === 'done');
        const pairs = await Promise.all(
          done.map(async (j) => [j.id, await fetchMediaToken(j.id)])
        );
        setTokens(Object.fromEntries(pairs.filter(([, t]) => t)));
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'โหลดรายการงานไม่สำเร็จ');
        setJobs([]);
      });
  };

  useEffect(load, []);

  const download = async (jobId) => {
    setDownloading(jobId);
    try {
      const token = tokens[jobId] || await fetchMediaToken(jobId);
      if (token) window.location.href = `${API_URL}/download/${jobId}?token=${token}`;
    } finally {
      setDownloading('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> กลับ
        </button>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <RefreshCw className="h-4 w-4" /> รีเฟรช
        </button>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-slate-900">งานของฉัน</h2>
        <p className="text-sm text-slate-400 mt-0.5">ไฟล์ผลลัพธ์เก็บไว้ 7 วัน กรุณาดาวน์โหลดเก็บไว้</p>
      </div>

      {jobs === null && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {jobs !== null && jobs.length === 0 && !error && (
        <div className="text-center py-16 text-slate-400">
          <FileVideo className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>ยังไม่มีงาน — อัปโหลดวิดีโอเพื่อเริ่มต้น</p>
        </div>
      )}

      {jobs !== null && jobs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => {
            const meta = STATUS_META[job.status] || { label: job.status, cls: 'bg-slate-100 text-slate-500 border-slate-200' };
            const isDone = job.status === 'done';
            const thumbUrl = isDone && tokens[job.id]
              ? `${API_URL}/media/${job.id}/thumbnail.jpg?token=${tokens[job.id]}`
              : null;
            return (
              <div key={job.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md hover:border-slate-300 transition">
                {/* ภาพปก / placeholder */}
                <div className="relative aspect-video bg-gradient-to-br from-slate-100 to-slate-200">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={job.original_filename}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      {isDone
                        ? <Play className="h-8 w-8 text-slate-300" />
                        : <FileVideo className="h-8 w-8 text-slate-300" />}
                    </div>
                  )}
                  <span className={`absolute top-2 right-2 text-xs font-medium px-2 py-0.5 rounded-full border ${meta.cls} whitespace-nowrap`}>
                    {meta.label}
                  </span>
                </div>

                {/* ข้อมูล */}
                <div className="p-3">
                  <p className="text-sm font-medium text-slate-900 truncate" title={job.original_filename}>
                    {job.original_filename || 'ไม่มีชื่อไฟล์'}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-slate-400">{fmtDate(job.created_at)}</span>
                    {isDone && (
                      <button
                        onClick={() => download(job.id)}
                        disabled={downloading === job.id}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg disabled:opacity-50"
                      >
                        {downloading === job.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Download className="h-3.5 w-3.5" />}
                        ดาวน์โหลด
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
