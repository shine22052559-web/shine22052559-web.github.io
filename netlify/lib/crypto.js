import crypto from 'node:crypto';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_FULL = /^BF-\d{6}-[A-Z2-9]{4}$/;
export const CODE_IN_TEXT = /BF-\d{6}-[A-Z2-9]{4}/;

export function genCode(now = new Date()) {
  // ใช้เวลาไทย (UTC+7) สำหรับส่วนวันที่
  const t = new Date(now.getTime() + 7 * 3600 * 1000);
  const p = n => String(n).padStart(2, '0');
  const bytes = crypto.randomBytes(4);
  let r = '';
  for (const b of bytes) r += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `BF-${String(t.getUTCFullYear()).slice(2)}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}-${r}`;
}

export function randomToken() {
  return crypto.randomBytes(24).toString('base64url');
}

export function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

export function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

export function lineSignatureValid(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret) return false;
  const expected = crypto.createHmac('sha256', channelSecret).update(rawBody).digest('base64');
  return safeEqual(signature, expected);
}

export function signAdminCookie(secret, expMs) {
  const mac = crypto.createHmac('sha256', secret).update('admin:' + expMs).digest('hex');
  return `${expMs}.${mac}`;
}

export function verifyAdminCookie(value, secret, nowMs = Date.now()) {
  if (!value || !secret) return false;
  const [exp, mac] = String(value).split('.');
  if (!exp || !mac) return false;
  if (Number(exp) < nowMs) return false;
  return safeEqual(mac, crypto.createHmac('sha256', secret).update('admin:' + exp).digest('hex'));
}
