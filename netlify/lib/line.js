// ช่องทางติดต่อ LINE ของร้าน
// - ถ้าตั้ง LINE_OA_BASIC_ID (OA แบบ Messaging API) ลูกค้าจะได้ข้อความที่กรอกไว้ให้ และระบบยืนยันอัตโนมัติผ่าน webhook
// - ถ้าไม่ตั้ง ใช้ LINE ส่วนตัว: ลูกค้าคัดลอกรหัสแล้ววางในแชต และเจ้าของยืนยันด้วยมือในหน้าแอดมิน
const PERSONAL_LINE_URL = process.env.LINE_CONTACT_URL || 'https://line.me/ti/p/UyMcBDRXWw';

export function lineUrl(code) {
  const id = process.env.LINE_OA_BASIC_ID;
  if (id) return 'https://line.me/R/oaMessage/' + id + '/?' + encodeURIComponent(code);
  return PERSONAL_LINE_URL;
}

export const lineAutoVerify = () => !!process.env.LINE_OA_BASIC_ID;

export async function replyText(replyToken, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !replyToken) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: text.slice(0, 1000) }] })
    });
  } catch (e) {
    console.error('LINE reply failed', e && e.message);
  }
}
