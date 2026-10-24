import { getOrder, saveOrder, now } from '../lib/shared.js';
import { CODE_IN_TEXT, lineSignatureValid } from '../lib/crypto.js';
import { replyText } from '../lib/line.js';

// LINE ส่งข้อความของลูกค้ามาที่นี่ ถ้ามีรหัสคำสั่งซื้อ ระบบจะผูก LINE userId กับคำสั่งนั้น
export default async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return new Response('not configured', { status: 500 });

  const raw = await req.text();
  if (!lineSignatureValid(raw, req.headers.get('x-line-signature'), secret)) {
    return new Response('invalid signature', { status: 401 });
  }

  let body;
  try { body = JSON.parse(raw); } catch { return new Response('ok'); }

  for (const ev of body.events || []) {
    if (ev.type !== 'message' || !ev.message || ev.message.type !== 'text') continue;
    const m = String(ev.message.text || '').toUpperCase().match(CODE_IN_TEXT);
    if (!m) continue;
    const o = await getOrder(m[0]);
    if (!o) {
      await replyText(ev.replyToken, 'ไม่พบรหัสคำสั่งซื้อ ' + m[0] + ' กรุณาตรวจสอบรหัสอีกครั้ง');
      continue;
    }
    if (o.cancelled) {
      await replyText(ev.replyToken, 'คำสั่งซื้อ ' + o.code + ' ถูกยกเลิกแล้ว');
      continue;
    }
    const userId = ev.source && ev.source.userId;
    if (!o.lineVerified) {
      o.lineVerified = true;
      o.lineVerifiedAt = now();
      o.lineUserId = userId || null;
      o.events = [...(o.events || []), { at: now(), text: 'ยืนยัน LINE อัตโนมัติจากการส่งรหัส' }].slice(-100);
      await saveOrder(o);
    }
    await replyText(ev.replyToken, 'ยืนยันคำสั่งซื้อ ' + o.code + ' แล้ว กลับไปที่หน้าเว็บเพื่อดูช่องทางชำระเงินและสถานะงานได้เลย');
  }
  return new Response('ok');
};

export const config = { path: '/api/line/webhook' };
