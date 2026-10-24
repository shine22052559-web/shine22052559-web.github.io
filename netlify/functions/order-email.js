import { json, getOrder, saveOrder, now, tokenOk } from '../lib/shared.js';
import { isReleased } from '../lib/views.js';
import { CODE_FULL } from '../lib/crypto.js';
import { mailReady, sendDeliveryEmail } from '../lib/mail.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const b = await req.json().catch(() => null);
  if (!b || !CODE_FULL.test(String(b.code || ''))) return json({ error: 'not_found' }, 404);
  const o = await getOrder(b.code);
  if (!tokenOk(o, b.token)) return json({ error: 'not_found' }, 404);
  if (!isReleased(o)) return json({ error: o.lineVerified ? 'not_paid' : 'line_not_verified' }, 403);
  if (!(o.files || []).length) return json({ error: 'no_files' }, 409);

  const email = String(b.email || '').trim().toLowerCase();
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid_email' }, 400);
  if (!mailReady()) return json({ error: 'mail_not_configured' }, 503);

  const origin = new URL(req.url).origin;
  const links = o.files.map(f => ({
    name: f.name,
    url: `${origin}/api/order/download?code=${encodeURIComponent(o.code)}&token=${encodeURIComponent(b.token)}&id=${encodeURIComponent(f.id)}`
  }));
  try {
    await sendDeliveryEmail({ to: email, code: o.code, links, origin });
  } catch (e) {
    console.error('mail failed', e && e.message);
    return json({ error: 'mail_failed' }, 502);
  }
  o.deliveryEmail = email;
  o.events = [...(o.events || []), { at: now(), text: 'ส่งลิงก์ไฟล์ไปที่อีเมลลูกค้าแล้ว' }].slice(-100);
  await saveOrder(o);
  return json({ ok: true });
};

export const config = { path: '/api/order/email' };
