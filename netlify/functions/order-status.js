import { json, getOrder, getPayment, lineUrl, tokenOk } from '../lib/shared.js';
import { lineAutoVerify } from '../lib/line.js';
import { customerView, publicPayment } from '../lib/views.js';
import { CODE_FULL } from '../lib/crypto.js';

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const u = new URL(req.url);
  const code = u.searchParams.get('code') || '';
  const token = u.searchParams.get('token') || '';
  if (!CODE_FULL.test(code)) return json({ error: 'not_found' }, 404);
  const o = await getOrder(code);
  // ตอบ 404 เหมือนกันทั้งกรณีไม่มีคำสั่งและ token ผิด เพื่อกันการไล่เดาเลขคำสั่ง
  if (!tokenOk(o, token)) return json({ error: 'not_found' }, 404);
  const payment = publicPayment(await getPayment());
  return json(customerView(o, payment, lineUrl(code), lineAutoVerify()));
};

export const config = { path: '/api/order/status' };
