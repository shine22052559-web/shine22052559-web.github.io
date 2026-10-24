import { getStore } from '@netlify/blobs';
import { sha256, safeEqual } from './crypto.js';
import { lineUrl as buildLineUrl } from './line.js';

// ราคาอยู่ฝั่งเซิร์ฟเวอร์ — ลูกค้าส่งราคามาเองไม่ได้
export const PRODUCTS = {
  ea:      { label: 'EA MT5 (Custom EA)', price: 199 },
  website: { label: 'เว็บไซต์', price: 4990 },
  graphic: { label: 'งานกราฟิก / แบรนดิ้ง', price: 1490 },
  video:   { label: 'วิดีโอ / พรีเซนเทชัน', price: 2990 },
  other:   { label: 'อื่นๆ (ให้ทีมงานประเมินและกำหนดยอด)', price: 0 }
};

export const db = () => getStore({ name: 'brainforze', consistency: 'strong' });

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra }
  });
}

export const now = () => new Date().toISOString();

export async function getOrder(code) {
  return db().get('order:' + code, { type: 'json' });
}

export async function saveOrder(o) {
  await db().setJSON('order:' + o.code, o);
}

export async function getPayment() {
  return db().get('settings:payment', { type: 'json' });
}

export const lineUrl = code => buildLineUrl(code);

// ตรวจ token ของลูกค้า (เก็บแค่ hash ใน DB)
export function tokenOk(o, token) {
  return !!o && typeof token === 'string' && token.length > 10 && safeEqual(sha256(token), o.tokenHash);
}

export function str(v, min, max) {
  const s = String(v ?? '').trim();
  if (s.length < min || s.length > max) return '';
  return s;
}
