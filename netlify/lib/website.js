// เทมเพลตเว็บไซต์หน้าเดียว — สร้างจากข้อมูลที่ลูกค้ากรอก ไม่มีค่าใช้จ่าย
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function landingPage({ brand, goal, contact, reference, code }) {
  const name = esc(brand || 'Your Brand');
  const body = esc(goal || '').replace(/\n/g, '<br>');
  const isMail = /@/.test(contact || '') && !/\s/.test(contact || '');
  const contactHtml = isMail
    ? `<a href="mailto:${esc(contact)}">${esc(contact)}</a>`
    : esc(contact || '');
  const refHtml = /^https?:\/\//i.test(reference || '')
    ? `<p class="ref">อ้างอิงแรงบันดาลใจ: <a href="${esc(reference)}" rel="noopener noreferrer">${esc(reference)}</a></p>`
    : '';
  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name}</title>
<style>
  :root{--bg:#0b0c10;--fg:#f4f1e8;--accent:#ffc64b;--muted:#a9a293}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai",sans-serif;background:var(--bg);color:var(--fg);line-height:1.8}
  main{max-width:760px;margin:0 auto;padding:72px 24px}
  h1{font-size:clamp(32px,6vw,52px);margin:0 0 12px;color:var(--accent)}
  .lead{color:var(--muted);margin:0 0 28px}
  .body{font-size:17px}
  .cta{display:inline-block;margin-top:28px;padding:12px 22px;border-radius:8px;background:var(--accent);color:#1b1307;text-decoration:none;font-weight:600}
  footer{margin-top:64px;padding-top:20px;border-top:1px solid #2b2a26;color:var(--muted);font-size:14px}
  footer a,.ref a{color:var(--accent)}
  .ref{font-size:14px;color:var(--muted);margin-top:20px;word-break:break-all}
</style>
</head>
<body>
<main>
  <h1>${name}</h1>
  <p class="lead">${esc(brand ? 'ยินดีต้อนรับสู่ ' + brand : 'ยินดีต้อนรับ')}</p>
  <div class="body">${body}</div>
  <a class="cta" href="${isMail ? 'mailto:' + esc(contact) : '#'}">ติดต่อเรา</a>
  ${refHtml}
  <footer>ติดต่อ: ${contactHtml}<br>สร้างโดย BRAINFORZE · ${esc(code)}</footer>
</main>
</body>
</html>
`;
}
