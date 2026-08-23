import React, { useState, useEffect } from 'react';
import {
  Upload, X, FileVideo, Scissors, ListChecks, Monitor, Smartphone, Loader2,
  GraduationCap, Mic, Star, Video, Briefcase, Gamepad2, Sparkles,
} from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

// โหมดการตัด — base prompt ที่ส่งให้ AI
const CUT_MODES = {
  prepare: {
    label: 'เก็บเนื้อหาครบ',
    desc: 'ตัดแค่ช่วงเงียบ คำติดปาก เสียงรบกวน',
    icon: Scissors,
    text: 'ตัดเฉพาะช่วงเงียบ ช่วงหยุดคิดนาน คำติดปาก (อืม เอ่อ อ่อ) เสียงรบกวน และช่วงพูดซ้ำโดยไม่มีข้อมูลใหม่ — เก็บเนื้อหาที่พูดไว้ให้ครบ ไม่ตัดใจความ',
  },
  summary: {
    label: 'สรุปสั้น',
    desc: 'เก็บเฉพาะใจความสำคัญ ตัดที่เหลือทิ้ง',
    icon: ListChecks,
    text: 'ตัดให้สั้นกระชับที่สุด เก็บเฉพาะใจความสำคัญและข้อสรุป — ตัดช่วงเกริ่นนำ ตัวอย่างเสริม และรายละเอียดปลีกย่อยออกทั้งหมด',
  },
};

// chips หัวข้อ — กดแล้วเติมข้อความลงช่อง textarea (แก้ต่อได้) เพื่อช่วย AI แม่นขึ้น
const TOPICS = [
  { id: 'tutorial', label: 'วิดีโอสอน', icon: GraduationCap, text: 'คลิปนี้เป็นวิดีโอสอน เน้นเก็บขั้นตอนการทำและคำอธิบาย ตัดช่วงเตรียมของหรือรอ' },
  { id: 'podcast',  label: 'พอดแคสต์', icon: Mic, text: 'คลิปนี้เป็นพอดแคสต์/สัมภาษณ์ เน้นเนื้อหาการพูดคุยที่สำคัญ ตัดช่วงทักทายและคุยนอกเรื่อง' },
  { id: 'review',   label: 'รีวิวสินค้า', icon: Star, text: 'คลิปนี้เป็นรีวิวสินค้า เน้นข้อดี ข้อเสีย และบทสรุป ตัดช่วงเกริ่นนำที่ยืดยาว' },
  { id: 'vlog',     label: 'Vlog', icon: Video, text: 'คลิปนี้เป็น Vlog เน้นช่วงไฮไลต์และเล่าเรื่องน่าสนใจ ตัดช่วงเดินทางหรือเตรียมตัว' },
  { id: 'meeting',  label: 'ประชุม', icon: Briefcase, text: 'คลิปนี้เป็นการประชุม เน้นข้อสรุปและสิ่งที่ต้องทำต่อ ตัดช่วงคุยเล่นก่อนเริ่ม' },
  { id: 'gaming',   label: 'เกม', icon: Gamepad2, text: 'คลิปนี้เป็นคลิปเล่นเกม เน้นช่วงมันส์ ๆ และไฮไลต์ ตัดช่วงรอหรือไม่มีอะไรเกิดขึ้น' },
];

// จำกัดขนาดไฟล์ฝั่ง client — ตรงกับ MAX_FILE_SIZE_MB ของ backend
const MAX_FILE_MB = 2048;

const UploadScreen = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cutMode, setCutMode] = useState('prepare');
  const [videoFormat, setVideoFormat] = useState('standard');
  const [topicId, setTopicId] = useState(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [targetLength, setTargetLength] = useState(60);
  const [burnSubtitle, setBurnSubtitle] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const isTiktok = videoFormat === 'tiktok';

  const buildPrompt = () => {
    // ไม่เลือกโหมด → default เป็น 'prepare' เพื่อให้ AI มีทิศทางเสมอ
    const base = CUT_MODES[cutMode]?.text || CUT_MODES.prepare.text;
    const parts = [base];
    if (description.trim()) parts.push(description.trim());
    if (isTiktok) parts.push('ทำเป็นคลิปสั้นแนวตั้ง 9:16 — เริ่มด้วย hook ดึงความสนใจใน 3 วินาทีแรก เน้นช่วงที่ปังที่สุด กระชับและ engaging');
    return parts.join('\n');
  };

  // กด chip → เติมข้อความลงช่อง (กดซ้ำ = เอาออก)
  const handleTopicClick = (t) => {
    if (topicId === t.id) {
      setTopicId(null);
      setDescription('');
    } else {
      setTopicId(t.id);
      setDescription(t.text);
    }
  };

  // พิมพ์แก้เอง → ถ้าไม่ตรง chip ไหนแล้ว ยกเลิกไฮไลต์ chip
  const handleDescChange = (e) => {
    const v = e.target.value;
    setDescription(v);
    const matched = TOPICS.find((t) => t.text === v);
    setTopicId(matched ? matched.id : null);
  };

  const handleFileChange = (e) => pickFile(e.target.files[0]);

  const pickFile = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith('video/')) {
      setError('กรุณาเลือกไฟล์วิดีโอเท่านั้น');
      return;
    }
    if (selectedFile.size > MAX_FILE_MB * 1024 * 1024) {
      const mb = (selectedFile.size / 1024 / 1024).toFixed(0);
      setError(`ไฟล์ใหญ่เกิน ${MAX_FILE_MB} MB (ไฟล์นี้ ${mb} MB) — กรุณาเลือกไฟล์เล็กลง`);
      return;
    }
    setError('');
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    pickFile(e.dataTransfer.files[0]);
  };

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
  };

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const handleUpload = async () => {
    if (!file) return setError('กรุณาเลือกไฟล์วิดีโอก่อน');

    setError('');
    setUploadProgress(0);
    setLoading(true);
    const formData = new FormData();
    formData.append('video', file);
    formData.append('prompt', buildPrompt());
    formData.append('output_mode', isTiktok ? 'tiktok' : 'standard');
    formData.append('target_length', String(targetLength));
    formData.append('burn_subtitle', String(burnSubtitle));
    formData.append('preview_mode', String(previewMode));
    formData.append('preset_id', topicId || cutMode);

    try {
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30 * 60 * 1000,
        onUploadProgress: (e) => {
          const total = e.total || file.size;
          setUploadProgress(Math.round((e.loaded * 100) / total));
        },
      });
      onUploadSuccess(response.data.job_id, previewMode ? 'preview' : 'final');
    } catch (err) {
      let msg = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
      if (err.response) msg = err.response.data?.detail || `Server Error ${err.response.status}`;
      else if (err.code === 'ECONNABORTED') msg = 'ใช้เวลานานเกินไป (Timeout)';
      setError(msg);
      setLoading(false);
    }
  };

  const sizeMB = file ? (file.size / 1024 / 1024).toFixed(1) : 0;

  // การ์ดเลือก 2 ทาง (ธีมสว่าง)
  const Choice = ({ active, onClick, icon: Icon, title, desc }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-colors ${
        active
          ? 'border-indigo-500 bg-indigo-50/70'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
      <div className="min-w-0">
        <p className={`text-sm font-medium ${active ? 'text-indigo-900' : 'text-slate-800'}`}>{title}</p>
        {desc && <p className="text-xs text-slate-500 mt-0.5 leading-snug">{desc}</p>}
      </div>
    </button>
  );

  return (
    <div className="space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero */}
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">ตัดวิดีโออัตโนมัติด้วย AI</h2>
        <p className="text-sm text-slate-500 mt-2">อัปโหลด → เลือกสไตล์ → ได้วิดีโอที่ตัดเสร็จ</p>
      </div>

      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
      >
        {!previewUrl ? (
          <label
            htmlFor="video-input"
            className={`flex flex-col items-center justify-center border border-dashed rounded-2xl py-12 cursor-pointer transition-colors ${
              isDragOver ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-300 hover:bg-slate-50'
            }`}
          >
            <input id="video-input" type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
            <div className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${
              isDragOver ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
            }`}>
              <Upload className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-slate-700 mt-3">
              {isDragOver ? 'ปล่อยไฟล์ที่นี่' : 'คลิกหรือลากไฟล์วิดีโอมาวาง'}
            </p>
            <p className="text-xs text-slate-400 mt-1">MP4, MOV, MKV, AVI, WebM · สูงสุด 2GB</p>
          </label>
        ) : (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video">
              <button
                onClick={clearFile}
                className="absolute top-2 right-2 z-10 bg-black/50 backdrop-blur-sm text-white p-1.5 rounded-full hover:bg-black/70 transition-colors"
                title="ลบไฟล์"
              >
                <X className="h-4 w-4" />
              </button>
              <video src={previewUrl} controls className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-600">
              <FileVideo className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span className="font-medium truncate flex-1">{file.name}</span>
              <span className="text-slate-400 flex-shrink-0">{sizeMB} MB</span>
            </div>
          </div>
        )}
      </div>

      {/* โหมดการตัด */}
      <section>
        <h3 className="text-sm font-medium text-slate-700 mb-2.5">โหมดการตัด</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(CUT_MODES).map(([id, m]) => (
            <Choice key={id} active={cutMode === id} onClick={() => setCutMode(cutMode === id ? null : id)} icon={m.icon} title={m.label} desc={m.desc} />
          ))}
        </div>
      </section>

      {/* รูปแบบวิดีโอ */}
      <section>
        <h3 className="text-sm font-medium text-slate-700 mb-2.5">รูปแบบวิดีโอ</h3>
        <div className="grid grid-cols-2 gap-3">
          <Choice active={videoFormat === 'standard'} onClick={() => setVideoFormat(videoFormat === 'standard' ? null : 'standard')} icon={Monitor} title="มาตรฐาน 16:9" />
          <Choice active={isTiktok} onClick={() => setVideoFormat(isTiktok ? null : 'tiktok')} icon={Smartphone} title="TikTok/Reels 9:16" />
        </div>
      </section>

      {/* บอก AI เกี่ยวกับคลิปนี้ */}
      <section>
        <h3 className="text-sm font-medium text-slate-700 mb-2.5">
          เล่าให้ AI ฟังว่าคลิปนี้เกี่ยวกับอะไร <span className="text-slate-400 font-normal">(ไม่บังคับ — ช่วยให้ตัดแม่นขึ้น)</span>
        </h3>
        <textarea
          className="w-full p-3.5 text-sm bg-white border border-slate-200 rounded-2xl text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all resize-none"
          rows="3"
          placeholder="เช่น คลิปสอนทำอาหาร ต้มยำกุ้ง เน้นขั้นตอนการปรุงรส · หรือกดหัวข้อด้านล่างเพื่อเติมให้"
          value={description}
          onChange={handleDescChange}
        />

        {/* chips หัวข้อ — ใหญ่ขึ้น มีไอคอน แต่โทนนวล */}
        <div className="flex flex-wrap gap-2.5 mt-3">
          {TOPICS.map((t) => {
            const Icon = t.icon;
            const active = topicId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTopicClick(t)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border transition-colors ${
                  active
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ตั้งค่าเพิ่มเติม — โชว์ตรง ๆ ไม่ซ่อน */}
      <section>
        <h3 className="text-sm font-medium text-slate-700 mb-2.5">ตั้งค่าเพิ่มเติม</h3>
        <div className="space-y-3">
          {isTiktok && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <label className="text-xs text-slate-500 block mb-1.5">ความยาวสูงสุด (คลิปสั้น)</label>
              <div className="grid grid-cols-3 gap-2">
                {[30, 60, 90].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setTargetLength(sec)}
                    className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                      targetLength === sec
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-colors ${
            burnSubtitle ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}>
            <input type="checkbox" checked={burnSubtitle} onChange={(e) => setBurnSubtitle(e.target.checked)} className="mt-0.5 rounded accent-indigo-600" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-slate-800">📝 ใส่คำบรรยาย (ซับ) ให้อัตโนมัติ</p>
              <p className="text-xs text-slate-500 mt-0.5">สร้างคำบรรยายจากเสียงพูด แล้วฝังลงในวิดีโอ</p>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-colors ${
            previewMode ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}>
            <input type="checkbox" checked={previewMode} onChange={(e) => setPreviewMode(e.target.checked)} className="mt-0.5 rounded accent-indigo-600" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-slate-800">👁️ ดูตัวอย่างก่อนตัดจริง</p>
              <p className="text-xs text-slate-500 mt-0.5">ดูช่วงที่ AI เลือก แล้วเลือกเก็บหรือตัดเองได้ก่อนตัดจริง</p>
            </div>
          </label>
        </div>
      </section>

      {/* Inline error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <span>⚠️</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600" aria-label="ปิด">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Upload progress */}
      {loading && (
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{uploadProgress < 100 ? 'กำลังอัปโหลดวิดีโอ...' : 'อัปโหลดเสร็จ — กำลังเริ่มประมวลผล'}</span>
            <span className="font-semibold text-slate-700">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="h-2 rounded-full bg-indigo-600 transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* เริ่มตัดต่อ */}
      <button
        onClick={handleUpload}
        disabled={loading}
        className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-white transition-colors ${
          loading ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99]'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {uploadProgress < 100 ? `กำลังส่งวิดีโอ... ${uploadProgress}%` : 'กำลังเริ่มประมวลผล...'}
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" />
            เริ่มตัดต่อ
          </>
        )}
      </button>
    </div>
  );
};

export default UploadScreen;
