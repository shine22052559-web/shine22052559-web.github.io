import { json, PRODUCTS, getOrder, saveOrder, lineUrl, now, str, db } from '../lib/shared.js';
import { catalogById } from '../lib/catalog.js';
import { genCode, randomToken, sha256 } from '../lib/crypto.js';
import { lineAutoVerify } from '../lib/line.js';
import { landingPage } from '../lib/website.js';

export default async (req) => {
  if (req.method === 'GET') {
    return json({ products: PRODUCTS, lineAuto: lineAutoVerify() });
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const b = await req.json().catch(() => null);
  if (!b) return json({ error: 'invalid_json' }, 400);
  if (b.website) return json({ ok: true }); // honeypot

  // ออเดอร์ตาม SKU จากแคตตาล็อก (ราคาอยู่ฝั่งเซิร์ฟเวอร์ และต้องพร้อมขายเท่านั้น)
  let type, p;
  if (b.sku) {
    const item = catalogById[String(b.sku)];
    if (!item) return json({ error: 'unknown_sku' }, 400);
    if (item.status !== 'ready') return json({ error: 'coming_soon', message: 'สินค้านี้ยังไม่พร้อมขาย (Coming soon)' }, 409);
    type = 'sku:' + item.id;
    p = { label: item.name, price: item.price };
  } else {
    type = String(b.type || '');
    p = PRODUCTS[type];
    if (!p) return json({ error: 'invalid_type' }, 400);
  }

  const name = str(b.name, 2, 120);
  const contact = str(b.contact, 3, 120);
  const goal = str(b.goal, 5, 2000);
  if (!name || !contact || !goal) return json({ error: 'missing_fields' }, 400);

  const brand = str(b.brand, 0, 120);
  const reference = str(b.reference, 0, 300);
  if (reference && !/^https?:\/\/\S+$/i.test(reference)) return json({ error: 'invalid_reference' }, 400);
  const deadline = str(b.deadline, 0, 10);
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return json({ error: 'invalid_deadline' }, 400);
  if (b.consent !== true) return json({ error: 'consent_required' }, 400);

  let code = null;
  for (let i = 0; i < 5; i++) {
    const c = genCode();
    if (!(await getOrder(c))) { code = c; break; }
  }
  if (!code) return json({ error: 'try_again' }, 500);

  const token = randomToken();
  const order = {
    code, tokenHash: sha256(token), type, label: p.label, price: p.price,
    name, contact, goal, brand, reference, deadline, createdAt: now(),
    lineVerified: false, paymentReported: false, paid: false, cancelled: false,
    files: [],
    events: [{ at: now(), text: 'สร้างคำสั่งซื้อ' }]
  };

  // งานที่สร้างอัตโนมัติได้ทันที (เว็บหน้าเดียว) — ยังไม่เปิดให้โหลดจนกว่าจะผ่านด่านไลน์และการชำระ
  if (type === 'website') {
    const html = landingPage({ brand: brand || name, goal, contact, reference, code });
    const buf = Buffer.from(html, 'utf8');
    const id = randomToken().replace(/[^A-Za-z0-9_-]/g, 'x').slice(0, 16);
    await db().set(`file:${code}:${id}`, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    order.files.push({ id, name: `landing-${code}.html`, type: 'text/html; charset=utf-8', size: buf.length, uploadedAt: now(), auto: true });
    order.events.push({ at: now(), text: 'สร้างไฟล์เว็บหน้าเดียวอัตโนมัติ' });
  }

  await saveOrder(order);
  return json({ code, token, lineUrl: lineUrl(code), lineAuto: lineAutoVerify() }, 201);
};

export const config = { path: '/api/order' };
