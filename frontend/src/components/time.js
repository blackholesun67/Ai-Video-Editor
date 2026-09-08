/**
 * ตัวจัดรูปแบบเวลาที่ใช้ร่วมกันในหน้า preview
 *
 * แยก 2 ฟังก์ชันโดยตั้งใจ เพราะ "ตำแหน่งเวลา" กับ "ความยาว" เป็นคนละความหมาย
 * เดิมแถวแสดงช่วงเวลาแบบปัดลง (0:00 – 0:46) ข้าง ๆ ความยาวทศนิยม (46.7s)
 * ตัวเลขจึงลบกันไม่ลงตัว ผู้ใช้อ่านแล้วไม่รู้ว่าคลิปที่ได้จะยาวเท่าไหร่กันแน่
 * ตอนนี้ทั้งคู่ใช้ทศนิยม 1 ตำแหน่งเท่ากัน และความยาวมีหน่วยกำกับเสมอ
 *
 * หมายเหตุ: ยังมี formatTime อีก 2 ตัวในโปรเจคที่ "ไม่ควร" ยุบมารวมที่นี่
 *   - Processing.jsx      เวลาที่ผ่านไป/เหลือ คนละหน้า คนละความหมาย
 *   - SubtitleEditScreen  M:SS.cc ตั้งใจให้ละเอียดระดับเสี้ยววินาทีสำหรับ timing ซับ
 *                         แปลงมาใช้ตัวนี้แล้วจะ "เสีย" ความละเอียด
 */

const safe = (sec) => {
  const n = Number(sec);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** ตำแหน่งเวลาในคลิป → "1:32.4" */
export function formatClock(sec) {
  const t = safe(sec);
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const d = Math.round((t - Math.floor(t)) * 10) % 10;
  return `${m}:${s.toString().padStart(2, '0')}.${d}`;
}

/** ความยาว → "46.7 วิ" | "2:13.5 นาที" (มีหน่วยเสมอ กันอ่านสับสนกับตำแหน่งเวลา) */
export function formatLength(sec) {
  const t = safe(sec);
  if (t < 60) return `${t.toFixed(1)} วิ`;
  return `${formatClock(t)} นาที`;
}

/** ขนาดก้าวของปุ่มขยับขอบ → "5 วิ" | "1 นาที" */
export function formatStep(sec) {
  const t = safe(sec);
  return t >= 60 ? `${Math.round(t / 60)} นาที` : `${t} วิ`;
}
