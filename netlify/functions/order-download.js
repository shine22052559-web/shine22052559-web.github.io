import { json, db, getOrder, tokenOk } from '../lib/shared.js';
import { isReleased } from '../lib/views.js';
import { CODE_FULL } from '../lib/crypto.js';

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const u = new URL(req.url);
  const code = u.searchParams.get('code') || '';
  const token = u.searchParams.get('token') || '';
  const id = u.searchParams.get('id') || '';
  if (!CODE_FULL.test(code) || !/^[A-Za-z0-9_-]{6,40}$/.test(id)) return json({ error: 'not_found' }, 404);

  const o = await getOrder(code);
  if (!tokenOk(o, token)) return json({ error: 'not_found' }, 404);
  // ด่านสุดท้ายฝั่งเซิร์ฟเวอร์: ต้องเพิ่มไลน์แล้ว และเจ้าของยืนยันการชำระแล้ว
  if (!isReleased(o)) return json({ error: o.lineVerified ? 'not_paid' : 'line_not_verified' }, 403);

  const file = (o.files || []).find(f => f.id === id);
  if (!file) return json({ error: 'not_found' }, 404);
  const buf = await db().get(`file:${code}:${id}`, { type: 'arrayBuffer' });
  if (!buf) return json({ error: 'not_found' }, 404);

  return new Response(buf, {
    status: 200,
    headers: {
      'content-type': file.type || 'application/octet-stream',
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff'
    }
  });
};

export const config = { path: '/api/order/download' };
