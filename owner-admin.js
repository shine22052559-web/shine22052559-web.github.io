(() => {
  const $ = id => document.getElementById(id);
  const fmt = n => '฿' + Number(n || 0).toLocaleString('th-TH');
  let orders = [], current = null, pendingQr = null, clearQr = false;

  async function api(url, opts = {}) {
    const r = await fetch(url, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...opts });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(d.error || ('HTTP ' + r.status)); e.status = r.status; e.code = d.error; throw e; }
    return d;
  }
  const post = (url, body) => api(url, { method: 'POST', body: JSON.stringify(body) });
  const el = (tag, text, cls) => { const x = document.createElement(tag); if (text != null) x.textContent = text; if (cls) x.className = cls; return x; };
  const ERR = { unauthorized: 'กรุณาเข้าสู่ระบบใหม่', invalid_password: 'รหัสผ่านไม่ถูกต้อง', line_not_verified: 'ต้องยืนยัน LINE ก่อน', price_not_set: 'ต้องกำหนดยอดก่อน', already_paid: 'คำสั่งซื้อนี้ชำระแล้ว', cancelled: 'คำสั่งซื้อนี้ถูกยกเลิก', file_too_large: 'ไฟล์ใหญ่เกิน 4 MB', invalid_price: 'ยอดชำระไม่ถูกต้อง', invalid_qr: 'รูป QR ไม่ถูกต้องหรือใหญ่เกินไป', server_not_configured: 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่ารหัสผ่านแอดมิน' };
  const errText = e => ERR[e.code] || 'เกิดข้อผิดพลาด: ' + (e.code || e.message);

  function statusOf(o) {
    if (o.cancelled) return ['ยกเลิก', 'off'];
    if (o.paid) return ['ชำระแล้ว', 'on'];
    if (!o.lineVerified) return ['รอ LINE', 'warn'];
    if (o.paymentReported) return ['แจ้งโอนแล้ว', 'warn'];
    if (!(o.price > 0)) return ['รอกำหนดยอด', 'warn'];
    return ['รอชำระ', 'warn'];
  }

  function matchFilter(o, f) {
    if (f === 'all') return true;
    if (f === 'await_line') return !o.lineVerified && !o.cancelled && !o.paid;
    if (f === 'await_pay') return o.lineVerified && !o.paid && !o.cancelled && !o.paymentReported;
    if (f === 'reported') return o.paymentReported && !o.paid && !o.cancelled;
    if (f === 'paid') return o.paid;
    if (f === 'cancelled') return o.cancelled;
    return true;
  }

  function renderList() {
    const f = $('filter').value;
    const rows = $('rows'); rows.textContent = '';
    const list = orders.filter(o => matchFilter(o, f));
    list.forEach(o => {
      const tr = el('tr', null, 'click');
      tr.append(el('td', o.code), el('td', o.name + ' · ' + o.contact), el('td', o.price > 0 ? fmt(o.price) : '—'));
      const [label, cls] = statusOf(o);
      const td = el('td'); td.append(el('span', label, 'tag ' + cls)); tr.append(td);
      tr.append(el('td', new Date(o.createdAt).toLocaleString('th-TH')));
      tr.addEventListener('click', () => openOrder(o.code));
      rows.append(tr);
    });
    $('emptyNote').textContent = list.length ? '' : 'ไม่มีคำสั่งซื้อในหมวดนี้';
  }

  async function loadOrders() {
    const d = await api('/api/admin/orders');
    orders = d.orders || [];
    renderList();
  }

  async function openOrder(code) {
    try {
      const d = await api('/api/admin/order?code=' + encodeURIComponent(code));
      current = d.order;
      renderDetail();
      $('detail').classList.remove('hide');
      $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { alert(errText(e)); }
  }

  function renderDetail() {
    const o = current;
    $('dCode').textContent = o.code;
    const tags = $('dTags'); tags.textContent = '';
    const [label, cls] = statusOf(o);
    tags.append(el('span', label, 'tag ' + cls));
    tags.append(el('span', o.lineVerified ? 'LINE ยืนยันแล้ว' : 'LINE ยังไม่ยืนยัน', 'tag ' + (o.lineVerified ? 'on' : 'off')));
    tags.append(el('span', o.price > 0 ? 'ยอด ' + fmt(o.price) : 'ยังไม่กำหนดยอด', 'tag'));

    const info = $('dInfo');
    info.textContent = '';
    [
      ['สินค้า', o.label], ['ชื่อ/ร้าน', o.name], ['ติดต่อ', o.contact],
      ['LINE userId', o.lineUserId || 'ยืนยันด้วยมือ/ยังไม่มี'],
      ['รายละเอียด', o.goal], ['ตัวอย่างอ้างอิง', o.reference || '—'], ['กำหนดส่ง', o.deadline || '—']
    ].forEach(([k, v]) => {
      const p = el('p', null); p.style.margin = '4px 0';
      const b = el('b', k + ': '); p.append(b, document.createTextNode(v)); info.append(p);
    });

    const act = $('actions'); act.textContent = '';
    const btn = (text, cls, action, extra = {}) => {
      const b = el('button', text, cls);
      b.type = 'button';
      b.addEventListener('click', () => doAction(action, extra.value));
      return b;
    };
    if (!o.lineVerified && !o.cancelled) act.append(btn('ยืนยัน LINE ด้วยมือ', 'ok', 'verify_line'));
    if (o.lineVerified && !o.paid) act.append(btn('ยกเลิกการยืนยัน LINE', '', 'unverify_line'));
    if (o.lineVerified && !o.paid && !o.cancelled && o.price > 0) act.append(btn('ยืนยันรับชำระแล้ว', 'ok', 'confirm_payment'));
    if (o.paid) act.append(btn('ยกเลิกการยืนยันชำระ', 'danger', 'unconfirm_payment'));
    if (!o.paid && !o.cancelled) act.append(btn('ยกเลิกคำสั่งซื้อ', 'danger', 'cancel'));
    if (o.cancelled) act.append(btn('เปิดคำสั่งซื้อกลับ', '', 'restore'));

    $('priceInput').value = o.price || '';
    $('priceInput').disabled = o.paid;
    $('setPriceBtn').disabled = o.paid;

    const files = $('files'); files.textContent = '';
    (o.files || []).forEach(f => {
      const row = el('div', null, 'row'); row.style.margin = '4px 0';
      row.append(el('span', f.name + ' · ' + Math.max(1, Math.round(f.size / 1024)) + ' KB'));
      const d = el('button', 'ลบ', 'danger'); d.type = 'button';
      d.addEventListener('click', async () => {
        if (!confirm('ลบไฟล์ ' + f.name + ' ?')) return;
        try { const r = await post('/api/admin/file-delete', { code: o.code, id: f.id }); current = r.order; renderDetail(); }
        catch (e) { $('dErr').textContent = errText(e); }
      });
      row.append(d); files.append(row);
    });
    if (!(o.files || []).length) files.append(el('p', 'ยังไม่มีไฟล์ส่งมอบ', 'muted'));

    const ev = $('events'); ev.textContent = '';
    (o.events || []).slice().reverse().forEach(x => ev.append(el('li', new Date(x.at).toLocaleString('th-TH') + ' · ' + x.text)));
    $('dErr').textContent = '';
  }

  async function doAction(action, value) {
    try {
      const r = await post('/api/admin/order-action', { code: current.code, action, value });
      current = r.order; renderDetail(); await loadOrders();
    } catch (e) { $('dErr').textContent = errText(e); }
  }

  $('setPriceBtn').addEventListener('click', () => doAction('set_price', $('priceInput').value));
  $('noteBtn').addEventListener('click', async () => {
    const t = $('noteInput').value.trim(); if (!t) return;
    await doAction('note', t); $('noteInput').value = '';
  });

  $('uploadBtn').addEventListener('click', () => {
    const f = $('fileInput').files[0];
    if (!f) { $('dErr').textContent = 'เลือกไฟล์ก่อน'; return; }
    if (f.size > 4 * 1024 * 1024) { $('dErr').textContent = 'ไฟล์ใหญ่เกิน 4 MB'; return; }
    const r = new FileReader();
    r.onload = async () => {
      const b64 = String(r.result).split(',')[1];
      $('uploadBtn').disabled = true;
      try {
        const res = await post('/api/admin/upload', { code: current.code, filename: f.name, contentType: f.type, contentBase64: b64 });
        current = res.order; $('fileInput').value = ''; renderDetail(); await loadOrders();
      } catch (e) { $('dErr').textContent = errText(e); }
      finally { $('uploadBtn').disabled = false; }
    };
    r.readAsDataURL(f);
  });

  // ---------- ช่องทางชำระเงิน ----------
  async function loadPayment() {
    const d = await api('/api/admin/payment');
    $('pHolder').value = d.payment.holder || '';
    $('pAccount').value = d.payment.account || '';
    showQr(d.payment.qr || '');
  }
  function showQr(src) {
    const box = $('qrPreview'); box.textContent = '';
    if (src) { const img = el('img'); img.className = 'qr'; img.src = src; img.alt = 'QR'; box.append(img); }
    else box.append(el('p', 'ยังไม่มี QR', 'muted'));
  }
  $('pQr').addEventListener('change', () => {
    const f = $('pQr').files[0]; if (!f) return;
    if (f.size > 1.5 * 1024 * 1024) { $('pErr').textContent = 'ไฟล์ใหญ่เกิน 1.5 MB'; return; }
    const r = new FileReader();
    r.onload = () => { pendingQr = String(r.result); clearQr = false; showQr(pendingQr); };
    r.readAsDataURL(f);
  });
  $('clearQr').addEventListener('click', () => { clearQr = true; pendingQr = null; $('pQr').value = ''; showQr(''); });
  $('savePay').addEventListener('click', async () => {
    $('pErr').textContent = '';
    try {
      const body = { holder: $('pHolder').value, account: $('pAccount').value };
      if (clearQr) body.clearQr = true;
      else if (pendingQr) body.qrDataUrl = pendingQr;
      const d = await post('/api/admin/payment', body);
      pendingQr = null; clearQr = false;
      $('pErr').textContent = 'บันทึกแล้ว';
      showQr(d.payment.qr || '');
    } catch (e) { $('pErr').textContent = errText(e); }
  });

  // ---------- เข้าสู่ระบบ ----------
  function showDash(on) { $('loginBox').classList.toggle('hide', on); $('dash').classList.toggle('hide', !on); }
  async function start() {
    try { await loadOrders(); await loadPayment(); showDash(true); }
    catch (e) { showDash(false); if (e.status && e.status !== 401) $('loginErr').textContent = errText(e); }
  }
  $('loginBtn').addEventListener('click', async () => {
    $('loginErr').textContent = '';
    try { await post('/api/admin/login', { password: $('pw').value }); $('pw').value = ''; await start(); }
    catch (e) { $('loginErr').textContent = errText(e); }
  });
  $('pw').addEventListener('keydown', e => { if (e.key === 'Enter') $('loginBtn').click(); });
  $('logoutBtn').addEventListener('click', async () => { await post('/api/admin/logout', {}).catch(() => {}); showDash(false); });
  $('filter').addEventListener('change', renderList);
  $('refreshList').addEventListener('click', () => loadOrders().catch(e => alert(errText(e))));
  $('closeDetail').addEventListener('click', () => { $('detail').classList.add('hide'); current = null; });

  start();
})();
