import { json, getOrder, saveOrder, getPayment, lineUrl, tokenOk, now, str } from '../lib/shared.js';
import { lineAutoVerify } from '../lib/line.js';
import { customerView, publicPayment } from '../lib/views.js';
import { CODE_FULL } from '../lib/crypto.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const b = await req.json().catch(() => null);
  if (!b || !CODE_FULL.test(String(b.code || ''))) return json({ error: 'not_found' }, 404);
  const o = await getOrder(b.code);
  if (!tokenOk(o, b.token)) return json({ error: 'not_found' }, 404);
  if (!o.lineVerified) return json({ error: 'line_not_verified' }, 403);
  if (o.paid || o.cancelled) return json({ error: 'not_open' }, 409);
  if (!(o.price > 0)) return json({ error: 'price_not_set' }, 409);

  o.paymentReported = true;
  o.reportedAt = now();
  const note = str(b.note, 0, 300);
  o.events = [...(o.events || []), { at: now(), text: 'ลูกค้าแจ้งโอนแล้ว' + (note ? ': ' + note : '') }].slice(-100);
  await saveOrder(o);
  return json(customerView(o, publicPayment(await getPayment()), lineUrl(o.code), lineAutoVerify()));
};

export const config = { path: '/api/order/report' };
