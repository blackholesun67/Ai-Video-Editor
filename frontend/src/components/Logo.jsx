import React from 'react';

/** โลโก้แอป — ชุดเดียวกับ public/favicon.svg (แก้ที่หนึ่ง ต้องแก้อีกที่ด้วย) */
export default function Logo({ size = 32, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"
         className={className} aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#2563EB" />
      <rect x="7" y="16" width="3" height="8" rx="1.5" fill="#FFFFFF" />
      <rect x="12" y="11" width="3" height="18" rx="1.5" fill="#FFFFFF" />
      <rect x="17" y="14" width="3" height="12" rx="1.5" fill="#FFFFFF" opacity="0.35" />
      <rect x="22" y="9" width="3" height="22" rx="1.5" fill="#FFFFFF" opacity="0.35" />
      <rect x="27" y="13" width="3" height="14" rx="1.5" fill="#FFFFFF" />
      <rect x="32" y="17" width="3" height="6" rx="1.5" fill="#FFFFFF" />
      <path d="M16 7 V33 M26 7 V33" stroke="#FB923C" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
