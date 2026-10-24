import nodemailer from 'nodemailer';

// ใช้ Gmail ของเจ้าของ (ฟรี) ต้องตั้ง GMAIL_USER และ GMAIL_APP_PASSWORD (App Password จากการยืนยันสองขั้นตอน)
let transport = null;
function getTransport() {
  if (transport) return transport;
  transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
  });
  return transport;
}

export const mailReady = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function sendDeliveryEmail({ to, code, links, origin }) {
  const from = `"BRAINFORZE" <${process.env.GMAIL_USER}>`;
  const list = links.map(l => `• ${l.name}\n  ${l.url}`).join('\n\n');
  const htmlList = links.map(l => `<li><b>${esc(l.name)}</b><br><a href="${esc(l.url)}">ดาวน์โหลดไฟล์</a></li>`).join('');
  const docs = [
    { name: 'เอกสารนำเสนอ EA (PDF)', url: `${origin}/docs/EA_Presentation_TH.pdf` },
    { name: 'คู่มือเริ่มต้นใช้งาน EA (PDF)', url: `${origin}/docs/EA_Quick_Start_TH.pdf` },
    { name: 'คู่มือ Scalping (PDF)', url: `${origin}/docs/EA_Scalping_Guide_TH.pdf` },
    { name: 'คู่มือ Trend (PDF)', url: `${origin}/docs/EA_Trend_Guide_TH.pdf` },
    { name: 'คู่มือ Fast-Tick (PDF)', url: `${origin}/docs/EA_FastTick_Guide_TH.pdf` }
  ];
  const docText = docs.map(d => `• ${d.name}\n  ${d.url}`).join('\n\n');
  const docHtml = docs.map(d => `<li><a href="${esc(d.url)}">${esc(d.name)}</a></li>`).join('');
  await getTransport().sendMail({
    from,
    to,
    subject: `[BRAINFORZE] ไฟล์งานของคำสั่งซื้อ ${code}`,
    text:
      `ขอบคุณที่ใช้บริการ BRAINFORZE\n\nคำสั่งซื้อ: ${code}\n\nดาวน์โหลดไฟล์ได้จากลิงก์ด้านล่าง ลิงก์นี้ใช้ได้เฉพาะคำสั่งซื้อนี้\n\n${list}\n\nคู่มือและเอกสารประกอบ (PDF):\n${docText}\n\nหากมีปัญหา ติดต่อร้านทางไลน์ได้เลย`,
    html:
      `<p>ขอบคุณที่ใช้บริการ BRAINFORZE</p><p>คำสั่งซื้อ: <b>${esc(code)}</b></p><p>ดาวน์โหลดไฟล์ได้จากลิงก์ด้านล่าง ลิงก์นี้ใช้ได้เฉพาะคำสั่งซื้อนี้</p><ul>${htmlList}</ul><p><b>คู่มือและเอกสารประกอบ (PDF)</b></p><ul>${docHtml}</ul><p>หากมีปัญหา ติดต่อร้านทางไลน์ได้เลย</p>`
  });
}
