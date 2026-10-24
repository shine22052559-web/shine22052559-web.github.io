import { json, db, getOrder, saveOrder, getPayment, now, str } from '../lib/shared.js';
import { randomToken, safeEqual, sha256, signAdminCookie, verifyAdminCookie, CODE_FULL } from '../lib/crypto.js';

const MAX_FILE = 4 * 1024 * 1024;     // ไฟล์ส่งมอบสูงสุด 4 MB ต่อไฟล์ (ข้อจำกัดคำขอของ Netlify Functions)
const MAX_QR_CHARS = 2 * 1024 * 1024; // QR ที่ส่งเป็น data URL

function isAdmin(req) {
  const m = (req.headers.get('cookie') || '').match(/(?:^|;\s*)bf_admin=([^;]+)/);
  return !!m && verifyAdminCookie(decodeURIComponent(m[1]), process.env.SESSION_SECRET || '');
}

const addEvent = (o, text) => { o.events = [...(o.events || []), { at: now(), text }].slice(-100); };

function detail(o) {
  return { ...o, tokenHash: undefined };
}
function summary(o) {
  return {
    code: o.code, label: o.label, name: o.name, contact: o.contact, price: o.price,
    createdAt: o.createdAt, lineVerified: !!o.lineVerified, paymentReported: !!o.paymentReported,
    paid: !!o.paid, cancelled: !!o.cancelled, fileCount: (o.files || []).length
  };
}

async function listOrders() {
  const { blobs = [] } = await db().list({ prefix: 'order:' });
  const out = [];
  for (const b of blobs) {
    const o = await getOrder(b.key.replace(/^order:/, ''));
    if (o) out.push(summary(o));
  }
  return out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export default async (req) => {
  const url = new URL(req.url);
  const sub = url.pathname.replace(/^\/api\/admin\/?/, '').replace(/\/$/, '');
  const method = req.method;

  if (sub === 'login' && method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const pw = process.env.ADMIN_PASSWORD, secret = process.env.SESSION_SECRET;
    if (!pw || !secret) return json({ error: 'server_not_configured' }, 500);
    if (!safeEqual(sha256(String(b.password || '')), sha256(pw))) {
      await new Promise(r => setTimeout(r, 800));
      return json({ error: 'invalid_password' }, 401);
    }
    const val = signAdminCookie(secret, Date.now() + 12 * 3600 * 1000);
    return json({ ok: true }, 200, {
      'set-cookie': `bf_admin=${encodeURIComponent(val)}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`
    });
  }
  if (sub === 'logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': 'bf_admin=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });
  }

  if (!isAdmin(req)) return json({ error: 'unauthorized' }, 401);

  if (sub === 'orders' && method === 'GET') return json({ orders: await listOrders() });

  if (sub === 'order' && method === 'GET') {
    const code = url.searchParams.get('code') || '';
    const o = CODE_FULL.test(code) ? await getOrder(code) : null;
    if (!o) return json({ error: 'not_found' }, 404);
    return json({ order: detail(o) });
  }

  if (sub === 'order-action' && method === 'POST') {
    const b = await req.json().catch(() => ({}));
    if (!CODE_FULL.test(String(b.code || ''))) return json({ error: 'invalid_code' }, 400);
    const o = await getOrder(b.code);
    if (!o) return json({ error: 'not_found' }, 404);

    switch (b.action) {
      case 'verify_line':
        o.lineVerified = true; o.lineVerifiedAt = now(); addEvent(o, 'เจ้าของยืนยัน LINE ด้วยมือ'); break;
      case 'unverify_line':
        if (o.paid) return json({ error: 'already_paid' }, 409);
        o.lineVerified = false; addEvent(o, 'เจ้าของยกเลิกการยืนยัน LINE'); break;
      case 'set_price': {
        if (o.paid) return json({ error: 'already_paid' }, 409);
        const p = Math.round(Number(b.value));
        if (!Number.isFinite(p) || p < 0 || p > 10000000) return json({ error: 'invalid_price' }, 400);
        o.price = p; addEvent(o, 'กำหนดยอดชำระ ' + p + ' บาท'); break;
      }
      case 'confirm_payment':
        if (!o.lineVerified) return json({ error: 'line_not_verified' }, 409);
        if (!(o.price > 0)) return json({ error: 'price_not_set' }, 409);
        if (o.cancelled) return json({ error: 'cancelled' }, 409);
        o.paid = true; o.paidAt = now(); addEvent(o, 'เจ้าของยืนยันการชำระเงินแล้ว');
        break;
      case 'unconfirm_payment':
        o.paid = false; delete o.paidAt; addEvent(o, 'เจ้าของยกเลิกการยืนยันการชำระ'); break;
      case 'cancel':
        if (o.paid) return json({ error: 'already_paid' }, 409);
        o.cancelled = true; addEvent(o, 'ยกเลิกคำสั่งซื้อ'); break;
      case 'restore':
        o.cancelled = false; addEvent(o, 'เปิดคำสั่งซื้อกลับมา'); break;
      case 'note': {
        const t = str(b.value, 1, 300);
        if (!t) return json({ error: 'invalid_note' }, 400);
        addEvent(o, 'บันทึก: ' + t); break;
      }
      default:
        return json({ error: 'unknown_action' }, 400);
    }
    await saveOrder(o);
    return json({ order: detail(o) });
  }

  if (sub === 'upload' && method === 'POST') {
    const b = await req.json().catch(() => ({}));
    if (!CODE_FULL.test(String(b.code || ''))) return json({ error: 'invalid_code' }, 400);
    const o = await getOrder(b.code);
    if (!o) return json({ error: 'not_found' }, 404);
    if (!b.contentBase64) return json({ error: 'empty_file' }, 400);
    const buf = Buffer.from(String(b.contentBase64), 'base64');
    if (buf.length === 0) return json({ error: 'empty_file' }, 400);
    if (buf.length > MAX_FILE) return json({ error: 'file_too_large' }, 413);

    const id = randomToken().replace(/[^A-Za-z0-9_-]/g, 'x').slice(0, 16);
    const name = String(b.filename || 'deliverable').replace(/[\\/\r\n"<>]/g, '_').slice(0, 150);
    const type = String(b.contentType || 'application/octet-stream').slice(0, 100);
    await db().set(`file:${o.code}:${id}`, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    o.files = [...(o.files || []), { id, name, type, size: buf.length, uploadedAt: now() }];
    addEvent(o, 'อัปโหลดไฟล์ส่งมอบ: ' + name);
    await saveOrder(o);
    return json({ order: detail(o) });
  }

  if (sub === 'file-delete' && method === 'POST') {
    const b = await req.json().catch(() => ({}));
    if (!CODE_FULL.test(String(b.code || ''))) return json({ error: 'invalid_code' }, 400);
    const o = await getOrder(b.code);
    if (!o) return json({ error: 'not_found' }, 404);
    const f = (o.files || []).find(x => x.id === b.id);
    if (!f) return json({ error: 'not_found' }, 404);
    await db().delete(`file:${o.code}:${f.id}`);
    o.files = o.files.filter(x => x.id !== f.id);
    addEvent(o, 'ลบไฟล์ส่งมอบ: ' + f.name);
    await saveOrder(o);
    return json({ order: detail(o) });
  }

  if (sub === 'payment' && method === 'GET') {
    return json({ payment: (await getPayment()) || { holder: '', account: '', qr: '' } });
  }
  if (sub === 'payment' && method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const cur = (await getPayment()) || { holder: '', account: '', qr: '' };
    let qr = cur.qr;
    if (b.clearQr === true) qr = '';
    else if (b.qrDataUrl) {
      const s = String(b.qrDataUrl);
      if (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(s) || s.length > MAX_QR_CHARS) {
        return json({ error: 'invalid_qr' }, 400);
      }
      qr = s;
    }
    const next = {
      holder: str(b.holder, 0, 200),
      account: str(b.account, 0, 200),
      qr,
      updatedAt: now()
    };
    await db().setJSON('settings:payment', next);
    return json({ payment: next });
  }

  return json({ error: 'not_found' }, 404);
};

export const config = { path: '/api/admin/*' };
