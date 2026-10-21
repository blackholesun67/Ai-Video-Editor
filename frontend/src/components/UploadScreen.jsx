import React, { useState, useEffect } from 'react';
import {
  Upload, X, FileVideo, Scissors, ListChecks, Monitor, Smartphone, Loader2,
  GraduationCap, Mic, Star, Video, Captions, Eye, AudioLines, Film,
} from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

// โหมดการตัด — base prompt + ตัวตัดสิน edit_mode ที่ backend
// (โหมด 'hook' ไฮไลต์ ถูกปิดไว้ — ทำไฮไลต์ผ่านหน้า preview แทน ดู README)
const CUT_MODES = {
  full: {
    label: 'เก็บเนื้อหาครบ',
    desc: 'ตัดเฉพาะช่วงเงียบ และช่วงพูดผิดแล้วพูดใหม่',
    icon: Scissors,
    text: 'ตัดเฉพาะช่วงเงียบ ช่วงหยุดคิดนาน คำติดปาก (อืม เอ่อ อ่อ) เสียงรบกวน ปัญหาเทคนิค และช่วงพูดซ้ำโดยไม่มีข้อมูลใหม่ — เก็บเนื้อหาที่พูดไว้ให้ครบ ไม่ตัดใจความ ดูแล้วต้องเข้าใจว่าพูดเรื่องอะไร',
  },
  summary: {
    label: 'สรุปให้เข้าใจครบ',
    desc: 'ตัดช่วงนอกประเด็นออกด้วย คลิปสั้นลงแต่ยังครบประเด็น',
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

// ลดเสียงรบกวนอยู่นอกขอบเขต 4 objective ของงานวิจัย — ซ่อนช่วงทดสอบ
// (backend ยังรองรับครบ ; state denoise คงเป็น false จึงส่ง denoise=false เหมือนเดิม — เปิดคืนได้ที่ค่านี้)
const SHOW_DENOISE_OPTION = false;

const UploadScreen = ({ onUploadSuccess, isAuthed = true, requestLogin }) => {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cutMode, setCutMode] = useState('full');
  // aspect: 'landscape' (16:9) | 'portrait' (9:16) — จำกัดตาม orientation ของไฟล์ที่อัพ
  const [aspect, setAspect] = useState('landscape');
  const [sourceOrientation, setSourceOrientation] = useState(null); // null | 'landscape' | 'portrait'
  const [topicId, setTopicId] = useState(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  // ค่าเริ่มต้นเปิด — หน้าแก้ซับเป็นส่วนหนึ่งของการทดสอบ (ผู้ใช้ติ๊กออกเองได้)
  const [burnSubtitle, setBurnSubtitle] = useState(true);
  const [denoise, setDenoise] = useState(false);
  // วิธีจัดเฟรมตอนแปลงเป็น 9:16 — ตั้งต้น blur เพราะ crop กินความกว้างไปมากในคลิปไวด์
  const [tiktokFit, setTiktokFit] = useState('blur');
  // J/L-cut ปิดเป็นค่าเริ่มต้น — ปิด = render เหมือนเดิมทุกประการ (backend ไม่ขยับขอบภาพ)
  const [jlCut, setJlCut] = useState(false);
  // ค่าเริ่มต้นเปิด — หน้ารีวิวช่วงตัดเป็นหัวใจของ Objective 4 (ผู้ใช้ติ๊กออกเองได้)
  const [previewMode, setPreviewMode] = useState(true);
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

    // Gate: ต้อง login ก่อนถึงจะอัปโหลดได้ — ยังไม่ login → เปิด modal แล้วรอผล
    // (ไฟล์+ตั้งค่าที่เลือกไว้ยังอยู่ครบ เพราะ component นี้ไม่ถูก unmount ระหว่างนี้)
    if (!isAuthed && requestLogin) {
      const ok = await requestLogin();
      if (!ok) return;   // ผู้ใช้ปิด modal ไม่ได้ login → ไม่อัปโหลด
    }

    setError('');
    setUploadProgress(0);
    setLoading(true);
    const formData = new FormData();
    formData.append('video', file);
    formData.append('prompt', buildPrompt());
    formData.append('edit_mode', cutMode);                                  // full | summary
    formData.append('output_mode', isPortrait ? 'tiktok' : 'standard');     // aspect: 9:16 | 16:9
    if (isPortrait) formData.append('tiktok_fit', tiktokFit);                // blur = เห็นครบ | crop = เต็มจอ
    formData.append('burn_subtitle', String(burnSubtitle));
    formData.append('denoise', String(denoise));
    formData.append('jl_cut', String(jlCut));
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

  // การ์ดเลือกโหมด — ไอคอน+ชื่อบรรทัดบน คำอธิบายเต็มความกว้างด้านล่าง
  const Choice = ({ active, onClick, icon: Icon, title, desc }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col gap-2 p-4 rounded-2xl border text-left transition-colors ${
        active
          ? 'border-primary bg-primary-soft ring-1 ring-primary'
          : 'border-line-strong bg-white hover:border-primary/40 hover:bg-page'
      }`}
    >
      <span className="flex items-center gap-2.5">
        <span className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          active ? 'bg-primary text-white' : 'bg-slate-100 text-muted'
        }`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-base font-semibold text-ink">{title}</span>
      </span>
      {desc && <span className="text-sm text-muted leading-relaxed">{desc}</span>}
    </button>
  );

  // ปุ่มสองตัวเลือก (ขนาดวิดีโอ / วิธีจัดเฟรม 9:16)
  const optionCls = (active) => `min-h-11 px-4 py-2.5 rounded-xl border transition-colors ${
    active
      ? 'border-primary bg-primary-soft ring-1 ring-primary text-primary-dark'
      : 'border-line-strong bg-white text-slate-700 hover:border-primary/40 hover:bg-page'
  }`;

  // กล่องติ๊กตัวเลือกเพิ่มเติม
  const toggleCardCls = (on) => `flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-colors ${
    on ? 'border-primary bg-primary-soft' : 'border-line-strong bg-white hover:bg-page'
  }`;

  return (
    <div className="space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero */}
      <div className="text-center">
        <h2 className="text-2xl sm:text-[26px] font-semibold text-ink tracking-tight">ตัดวิดีโออัตโนมัติด้วย AI</h2>
        <p className="text-base text-muted mt-2">AI ตัดช่วงเงียบและช่วงพูดผิดให้ คุณตรวจแล้วแก้ได้ก่อนสร้างวิดีโอ</p>
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
            className={`flex flex-col items-center justify-center text-center px-4 border-2 border-dashed rounded-2xl py-12 cursor-pointer transition-colors ${
              isDragOver ? 'border-primary bg-primary-soft' : 'border-line-strong bg-white hover:border-primary/50 hover:bg-page'
            }`}
          >
            <input id="video-input" type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
            <div className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${
              isDragOver ? 'bg-primary text-white' : 'bg-primary-soft text-primary-dark'
            }`}>
              <Upload className="h-5 w-5" />
            </div>
            <p className="text-base font-medium text-ink mt-3">
              {isDragOver ? 'ปล่อยไฟล์ที่นี่' : (
                <>
                  <span className="hidden sm:inline">คลิกหรือลากไฟล์วิดีโอมาวาง</span>
                  <span className="sm:hidden">แตะเพื่อเลือกไฟล์วิดีโอ</span>
                </>
              )}
            </p>
            <p className="text-sm text-muted mt-1">MP4, MOV, MKV, AVI, WebM · สูงสุด 2GB</p>
            {/* ลิงก์เว็บสาธารณะผ่าน Cloudflare Tunnel (ดู frontend/nginx.conf) — Cloudflare จำกัดขนาด
                request ที่ ~100MB ก่อนถึงเซิร์ฟเวอร์ของเรา (แก้ในโค้ดไม่ได้) จึงบอกผู้ใช้ไว้ล่วงหน้า */}
            <p className="text-sm text-amber-800 mt-1">เมื่อใช้ผ่านลิงก์เว็บ ไฟล์ต้องไม่เกิน 100MB</p>
          </label>
        ) : (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video">
              <button
                onClick={clearFile}
                className="absolute top-2 right-2 z-10 h-11 w-11 flex items-center justify-center bg-black/60 backdrop-blur-sm text-white rounded-full hover:bg-black/75 transition-colors"
                title="ลบไฟล์"
                aria-label="ลบไฟล์"
              >
                <X className="h-5 w-5" />
              </button>
              <video src={previewUrl} controls onLoadedMetadata={handleVideoMeta} className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center gap-2.5 text-sm text-slate-700">
              <FileVideo className="h-4 w-4 text-muted flex-shrink-0" />
              <span className="font-medium truncate flex-1">{file.name}</span>
              <span className="text-muted flex-shrink-0">{sizeMB} MB</span>
            </div>
            {file.size > 100 * 1024 * 1024 && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ไฟล์นี้เกิน 100MB — ถ้าใช้ผ่านลิงก์เว็บจะอัปโหลดไม่สำเร็จ กรุณาตัดคลิปให้สั้นลงหรือลดขนาดไฟล์ก่อน
              </p>
            )}
          </div>
        )}
      </div>

      {/* โหมดการตัด — เลือก 1 ใน 2 */}
      <section>
        <h3 className="text-base font-semibold text-ink mb-3">อยากได้คลิปแบบไหน</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(CUT_MODES).map(([id, m]) => (
            <Choice key={id} active={cutMode === id} onClick={() => setCutMode(id)} icon={m.icon} title={m.label} desc={m.desc} />
          ))}
        </div>
        <p className="text-sm text-muted mt-2.5">ทุกโหมดตัดช่วงเงียบให้อัตโนมัติ</p>
      </section>

      {/* ขนาดวิดีโอ — 2 ตัวเลือกสมดุล · คลิปแนวตั้งเลือกได้แค่ 9:16 */}
      <section>
        <h3 className="text-base font-semibold text-ink mb-3">ขนาดวิดีโอ</h3>
        {sourceOrientation === 'portrait' ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-4 py-3 text-sm text-slate-700">
            <Smartphone className="h-4 w-4 text-muted flex-shrink-0" />
            คลิปแนวตั้ง — ผลลัพธ์จะเป็น 9:16 (แปลงเป็นแนวนอนจะเสียเนื้อหาด้านซ้าย-ขวา)
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { id: 'landscape', icon: Monitor, title: 'แนวนอน 16:9', hint: 'YouTube, คอม', active: !isPortrait },
              { id: 'portrait', icon: Smartphone, title: 'แนวตั้ง 9:16', hint: 'TikTok, Reels', active: isPortrait },
            ].map((o) => {
              const Icon = o.icon;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setAspect(o.id)}
                  aria-pressed={o.active}
                  className={`${optionCls(o.active)} flex flex-col items-center justify-center`}
                >
                  <span className="flex items-center gap-2 text-base font-medium">
                    <Icon className="h-4 w-4" /> {o.title}
                  </span>
                  <span className="text-sm text-muted">{o.hint}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* วิธีจัดเฟรม 9:16 — มีผลเฉพาะเมื่อต้นฉบับกว้างกว่า 9:16
            ต้นฉบับที่เป็นแนวตั้งอยู่แล้วสองแบบให้ผลเหมือนกัน จึงไม่ต้องอธิบายให้งง */}
        {isPortrait && (
          <div className="mt-3">
            <p className="text-sm text-muted mb-2">ถ้าต้นฉบับกว้างกว่า 9:16 จะจัดเฟรมยังไง</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'blur', title: 'เห็นครบ', desc: 'ย่อทั้งเฟรม เติมขอบเบลอ' },
                { id: 'crop', title: 'เต็มจอ', desc: 'ตัดซ้าย-ขวาทิ้ง' },
              ].map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setTiktokFit(o.id)}
                  aria-pressed={tiktokFit === o.id}
                  className={`${optionCls(tiktokFit === o.id)} text-left`}
                >
                  <span className="block text-base font-medium">{o.title}</span>
                  <span className="block text-sm text-muted mt-0.5">{o.desc}</span>
                </button>
              ))}
            </div>
            {tiktokFit === 'crop' && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                คลิปไวด์ (2.35:1) จะเหลือความกว้างแค่ ~24% — ข้อความเต็มบรรทัดและภาพเทียบซ้าย-ขวาจะหาย
              </p>
            )}
          </div>
        )}
      </section>

      {/* บอก AI เกี่ยวกับคลิปนี้ */}
      <section>
        <h3 className="text-base font-semibold text-ink mb-2.5">
          บอก AI เพิ่มเติม <span className="text-muted font-normal">(ไม่บังคับ)</span>
        </h3>
        <textarea
          className="w-full p-3.5 text-base bg-white border border-line-strong rounded-2xl text-slate-800 placeholder:text-muted focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
          rows="3"
          placeholder="เช่น ชื่อคน ชื่อแบรนด์ ศัพท์เฉพาะ หรือช่วงที่อยากเน้น"
          value={description}
          onChange={handleDescChange}
        />

        <p className="text-sm text-muted mt-3 mb-2">หรือเลือกประเภทคลิป</p>
        <div className="flex flex-wrap gap-2.5">
          {TOPICS.map((t) => {
            const Icon = t.icon;
            const active = topicId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTopicClick(t)}
                aria-pressed={active}
                className={`min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-base border transition-colors ${
                  active
                    ? 'border-primary bg-primary text-white'
                    : 'border-line-strong bg-white text-slate-700 hover:border-primary/40 hover:bg-page'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-muted'}`} />
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ตัวเลือกเพิ่มเติม — โชว์ตรง ๆ ไม่ซ่อน */}
      <section>
        <h3 className="text-base font-semibold text-ink mb-2.5">ตัวเลือกเพิ่มเติม</h3>
        <div className="space-y-3">
          <label className={toggleCardCls(burnSubtitle)}>
            <input type="checkbox" checked={burnSubtitle} onChange={(e) => setBurnSubtitle(e.target.checked)} className="mt-1 h-4 w-4 rounded accent-primary" />
            <div className="flex-1">
              <p className="text-base font-medium text-ink flex items-center gap-1.5">
                <Captions className="h-4 w-4 text-primary" /> ใส่ซับไตเติลอัตโนมัติ
              </p>
              <p className="text-sm text-muted mt-0.5">แปลงเสียงพูดเป็นข้อความบนวิดีโอ</p>
            </div>
          </label>

          {SHOW_DENOISE_OPTION && (
          <label className={toggleCardCls(denoise)}>
            <input type="checkbox" checked={denoise} onChange={(e) => setDenoise(e.target.checked)} className="mt-1 h-4 w-4 rounded accent-primary" />
            <div className="flex-1">
              <p className="text-base font-medium text-ink flex items-center gap-1.5">
                <AudioLines className="h-4 w-4 text-primary" /> ลดเสียงรบกวน (Noise Reduction)
              </p>
              <p className="text-sm text-muted mt-0.5">สำหรับวิดีโอที่มีเสียง noise เช่น พัดลม แอร์ ถ่ายนอกสถานที่ — เสียงพูดอาจเปลี่ยนเล็กน้อย</p>
            </div>
          </label>
          )}

          <label className={toggleCardCls(previewMode)}>
            <input type="checkbox" checked={previewMode} onChange={(e) => setPreviewMode(e.target.checked)} className="mt-1 h-4 w-4 rounded accent-primary" />
            <div className="flex-1">
              <p className="text-base font-medium text-ink flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-primary" /> ขอตรวจช่วงตัดก่อน
              </p>
              <p className="text-sm text-muted mt-0.5">ดูว่า AI จะเก็บหรือตัดช่วงไหน แล้วแก้เองได้ก่อนสร้างวิดีโอ</p>
            </div>
          </label>

          <label className={toggleCardCls(jlCut)}>
            <input type="checkbox" checked={jlCut} onChange={(e) => setJlCut(e.target.checked)} className="mt-1 h-4 w-4 rounded accent-primary" />
            <div className="flex-1">
              <p className="text-base font-medium text-ink flex items-center gap-1.5">
                <Film className="h-4 w-4 text-primary" /> รอยต่อแบบ J-Cut / L-Cut
              </p>
              <p className="text-sm text-muted mt-0.5">ให้ภาพเปลี่ยนก่อนหรือหลังเสียงเล็กน้อย (≤ 0.4 วิ) ที่รอยตัด — เหมาะกับคลิปที่ภาพเปลี่ยนชัดตรงรอยตัด; คลิปพูดหน้ากล้องที่เห็นปากชัด ปากอาจไม่ตรงเสียงชั่วครู่</p>
            </div>
          </label>
        </div>
      </section>

      {/* Inline error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <span>⚠️</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-600 hover:text-red-800" aria-label="ปิด">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Upload progress */}
      {loading && (
        <div>
          <div className="flex justify-between text-sm text-muted mb-1">
            <span>{uploadProgress < 100 ? 'กำลังอัปโหลดวิดีโอ...' : 'อัปโหลดเสร็จ — กำลังเริ่มประมวลผล'}</span>
            <span className="font-semibold text-ink">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-line rounded-full h-2 overflow-hidden">
            <div className="h-2 rounded-full bg-primary transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* เริ่มตัดต่อ */}
      <button
        onClick={handleUpload}
        disabled={loading}
        className={`w-full min-h-11 flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-semibold text-white transition-colors ${
          loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-dark active:scale-[0.99]'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {uploadProgress < 100 ? `กำลังส่งวิดีโอ... ${uploadProgress}%` : 'กำลังเริ่มประมวลผล...'}
          </>
        ) : (
          <>
            <Scissors className="h-5 w-5" />
            เริ่มตัดต่อ
          </>
        )}
      </button>
    </div>
  );
};

export default UploadScreen;

