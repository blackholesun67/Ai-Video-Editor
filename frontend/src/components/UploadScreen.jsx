import React, { useState, useEffect } from 'react';
import {
  Upload, X, FileVideo, Scissors, ListChecks, Monitor, Smartphone, Loader2,
  GraduationCap, Mic, Star, Video, Sparkles, Captions, Eye, AudioLines,
} from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

// โหมดการตัด — base prompt + ตัวตัดสิน edit_mode ที่ backend
// (โหมด 'hook' ไฮไลต์ ถูกปิดไว้ — ทำไฮไลต์ผ่านหน้า preview แทน ดู README)
const CUT_MODES = {
  full: {
    label: 'เก็บเนื้อหาครบ',
    desc: 'ตัดแค่ช่วงเงียบ / นอกเรื่อง — เนื้อหาครบ ดูแทนคลิปเต็มได้',
    icon: Scissors,
    text: 'ตัดเฉพาะช่วงเงียบ ช่วงหยุดคิดนาน คำติดปาก (อืม เอ่อ อ่อ) เสียงรบกวน ปัญหาเทคนิค และช่วงพูดซ้ำโดยไม่มีข้อมูลใหม่ — เก็บเนื้อหาที่พูดไว้ให้ครบ ไม่ตัดใจความ ดูแล้วต้องเข้าใจว่าพูดเรื่องอะไร',
  },
  summary: {
    label: 'สรุปให้เข้าใจครบ',
    desc: 'ดูแทนคลิปเต็มได้ เข้าใจครบทุกประเด็น สั้นลงตามเนื้อหา',
    icon: ListChecks,
    text: 'สรุปคลิปยาวให้คนที่ไม่มีเวลาดูเต็ม — เก็บทุกประเด็นหลัก เหตุผลที่จำเป็น ตัวอย่างสำคัญ และข้อสรุปให้ครบ ตัดเนื้อหาซ้ำ การพูดวกวน รายละเอียดปลีกย่อย และช่วงนอกเรื่องออก ให้สั้นที่สุดเท่าที่ยังเข้าใจครบ',
  },
};

// chips หัวข้อ — ไพรม์คำศัพท์ให้ Whisper (preset_id) + เติมบริบทลงช่องพิมพ์ (แก้ต่อได้)
const TOPICS = [
  { id: 'tutorial', label: 'วิดีโอสอน', icon: GraduationCap, text: 'คลิปนี้เป็นวิดีโอสอน เน้นเก็บขั้นตอนการทำและคำอธิบาย ตัดช่วงเตรียมของหรือรอ' },
  { id: 'podcast',  label: 'พอดแคสต์', icon: Mic, text: 'คลิปนี้เป็นพอดแคสต์/สัมภาษณ์ เน้นเนื้อหาการพูดคุยที่สำคัญ ตัดช่วงทักทายและคุยนอกเรื่อง' },
  { id: 'review',   label: 'รีวิวสินค้า', icon: Star, text: 'คลิปนี้เป็นรีวิวสินค้า เน้นข้อดี ข้อเสีย และบทสรุป ตัดช่วงเกริ่นนำที่ยืดยาว' },
  { id: 'vlog',     label: 'Vlog', icon: Video, text: 'คลิปนี้เป็น Vlog เน้นช่วงไฮไลต์และเล่าเรื่องน่าสนใจ ตัดช่วงเดินทางหรือเตรียมตัว' },
];

// จำกัดขนาดไฟล์ฝั่ง client — ตรงกับ MAX_FILE_SIZE_MB ของ backend
const MAX_FILE_MB = 2048;

const UploadScreen = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cutMode, setCutMode] = useState('full');
  // aspect: 'landscape' (16:9) | 'portrait' (9:16) — จำกัดตาม orientation ของไฟล์ที่อัพ
  const [aspect, setAspect] = useState('landscape');
  const [sourceOrientation, setSourceOrientation] = useState(null); // null | 'landscape' | 'portrait'
  const [topicId, setTopicId] = useState(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [burnSubtitle, setBurnSubtitle] = useState(false);
  const [denoise, setDenoise] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const isPortrait = aspect === 'portrait';

  // ตรวจ orientation จาก <video> ที่ preview อยู่แล้ว — คลิปแนวตั้งแปลงเป็น 16:9 ไม่ได้ (เสียเนื้อหา)
  const handleVideoMeta = (e) => {
    const v = e.target;
    if (!v.videoWidth || !v.videoHeight) return;
    const orient = v.videoWidth >= v.videoHeight ? 'landscape' : 'portrait';
    setSourceOrientation(orient);
    if (orient === 'portrait') setAspect('portrait');
  };

  const buildPrompt = () => {
    const base = CUT_MODES[cutMode]?.text || CUT_MODES.full.text;
    const parts = [base];
    if (description.trim()) parts.push(description.trim());
    if (isPortrait) parts.push('ผลลัพธ์เป็นคลิปแนวตั้ง 9:16 — เนื้อหาสำคัญควรอยู่กลางเฟรม เริ่มด้วยช่วงที่ดึงความสนใจ');
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
    // รีเซ็ต orientation — จะถูก set ใหม่จาก <video onLoadedMetadata>
    setSourceOrientation(null);
    setAspect('landscape');
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
    setSourceOrientation(null);
    setAspect('landscape');
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
    formData.append('edit_mode', cutMode);                                  // full | summary
    formData.append('output_mode', isPortrait ? 'tiktok' : 'standard');     // aspect: 9:16 | 16:9
    formData.append('burn_subtitle', String(burnSubtitle));
    formData.append('denoise', String(denoise));
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

  // การ์ดเลือกโหมด (ธีมสว่าง) — วางแนวตั้ง ไอคอน+ชื่อบรรทัดบน คำอธิบายเต็มความกว้างด้านล่าง
  const Choice = ({ active, onClick, icon: Icon, title, desc }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-2 p-4 rounded-2xl border text-left transition-colors ${
        active
          ? 'border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-200'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <span className="flex items-center gap-2.5">
        <span className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          active ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
        }`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className={`text-sm font-semibold ${active ? 'text-indigo-900' : 'text-slate-800'}`}>{title}</span>
      </span>
      {desc && <span className="text-xs text-slate-500 leading-relaxed">{desc}</span>}
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
              <video src={previewUrl} controls onLoadedMetadata={handleVideoMeta} className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-600">
              <FileVideo className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span className="font-medium truncate flex-1">{file.name}</span>
              <span className="text-slate-400 flex-shrink-0">{sizeMB} MB</span>
            </div>
          </div>
        )}
      </div>

      {/* โหมดการตัด — เลือก 1 ใน 3 */}
      <section>
        <h3 className="text-sm font-medium text-slate-700 mb-3">โหมดการตัด</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(CUT_MODES).map(([id, m]) => (
            <Choice key={id} active={cutMode === id} onClick={() => setCutMode(id)} icon={m.icon} title={m.label} desc={m.desc} />
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2.5">ทุกโหมดตัดช่วงเงียบและลดเสียงรบกวนให้อัตโนมัติ</p>
      </section>

      {/* รูปแบบวิดีโอ — 2 ตัวเลือกสมดุล · คลิปแนวตั้งเลือกได้แค่ 9:16 */}
      <section>
        <h3 className="text-sm font-medium text-slate-700 mb-3">รูปแบบวิดีโอ</h3>
        {sourceOrientation === 'portrait' ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <Smartphone className="h-4 w-4 text-slate-400 flex-shrink-0" />
            คลิปแนวตั้ง — ผลลัพธ์จะเป็น 9:16 (แปลงเป็นแนวนอนจะเสียเนื้อหาด้านซ้าย-ขวา)
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAspect('landscape')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors ${
                !isPortrait
                  ? 'border-indigo-500 bg-indigo-50/70 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Monitor className="h-4 w-4" /> แนวนอน 16:9
            </button>
            <button
              type="button"
              onClick={() => setAspect('portrait')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors ${
                isPortrait
                  ? 'border-indigo-500 bg-indigo-50/70 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Smartphone className="h-4 w-4" /> แนวตั้ง 9:16
            </button>
          </div>
        )}
      </section>

      {/* บอก AI เกี่ยวกับคลิปนี้ */}
      <section>
        <h3 className="text-sm font-medium text-slate-700 mb-2.5">
          อยากได้คลิปแบบไหน บอก AI ได้เลย <span className="text-slate-400 font-normal">(ไม่บังคับ — ช่วยให้ตัดแม่นขึ้น)</span>
        </h3>
        <textarea
          className="w-full p-3.5 text-sm bg-white border border-slate-200 rounded-2xl text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all resize-none"
          rows="3"
          placeholder="ชื่อคน / แบรนด์ / ศัพท์เฉพาะที่พูดบ่อย (ช่วยให้ซับแม่นขึ้น) · อยากเน้นหรือตัดช่วงไหนเป็นพิเศษ · หรือกดหัวข้อด้านล่าง"
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
          <label className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-colors ${
            burnSubtitle ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}>
            <input type="checkbox" checked={burnSubtitle} onChange={(e) => setBurnSubtitle(e.target.checked)} className="mt-0.5 rounded accent-indigo-600" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-slate-800 flex items-center gap-1.5">
                <Captions className="h-4 w-4 text-indigo-600" /> ใส่คำบรรยาย (ซับ) ให้อัตโนมัติ
              </p>
              <p className="text-xs text-slate-500 mt-0.5">สร้างคำบรรยายจากเสียงพูด ในวิดีโอ</p>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-colors ${
            denoise ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}>
            <input type="checkbox" checked={denoise} onChange={(e) => setDenoise(e.target.checked)} className="mt-0.5 rounded accent-indigo-600" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-slate-800 flex items-center gap-1.5">
                <AudioLines className="h-4 w-4 text-indigo-600" /> ลดเสียงรบกวน (Noise Reduction)
              </p>
              <p className="text-xs text-slate-500 mt-0.5">สำหรับวิดีโอที่มีเสียง noise เช่น พัดลม แอร์ ถ่ายนอกสถานที่ — เสียงพูดอาจเปลี่ยนเล็กน้อย</p>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-colors ${
            previewMode ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}>
            <input type="checkbox" checked={previewMode} onChange={(e) => setPreviewMode(e.target.checked)} className="mt-0.5 rounded accent-indigo-600" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-slate-800 flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-indigo-600" /> ดูตัวอย่างก่อนตัดจริง
              </p>
              <p className="text-xs text-slate-500 mt-0.5">ดูช่วงที่ AI เลือกเก็บหรือตัดเองได้ก่อนตัดจริง</p>
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
