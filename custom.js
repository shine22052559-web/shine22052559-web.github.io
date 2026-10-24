(() => {
  const $ = id => document.getElementById(id);
  const KEY = 'bf_active_order';
  const fmt = n => '฿' + Number(n || 0).toLocaleString('th-TH');
  let active = null, timer = null, currentView = null, products = {};

  const ERR = {
    missing_fields: 'กรุณากรอกชื่อ ช่องทางติดต่อ และรายละเอียดงานให้ครบ',
    invalid_type: 'ประเภทงานไม่ถูกต้อง',
    invalid_reference: 'ลิงก์ตัวอย่างต้องขึ้นต้นด้วย https://',
    invalid_deadline: 'รูปแบบวันที่ไม่ถูกต้อง',
    consent_required: 'กรุณายอมรับเงื่อนไขก่อนสร้างคำสั่งซื้อ',
    not_found: 'ไม่พบคำสั่งซื้อนี้ ตรวจสอบรหัสและรหัสติดตามอีกครั้ง',
    line_not_verified: 'ต้องเพิ่มไลน์และส่งรหัสคำสั่งซื้อก่อน จึงจะดำเนินการได้',
    price_not_set: 'ยังไม่มียอดชำระ กรุณารอทีมงานกำหนดยอด',
    not_open: 'คำสั่งซื้อนี้ปิดแล้ว',
    not_paid: 'ยังไม่ได้รับการยืนยันการชำระ จึงยังดาวน์โหลดไม่ได้',
    no_files: 'ยังไม่มีไฟล์ในคำสั่งซื้อนี้',
    invalid_email: 'รูปแบบอีเมลไม่ถูกต้อง'
  };
  const msg = (code, fallback) => ERR[code] || fallback || 'เกิดข้อผิดพลาด กรุณาลองใหม่ หรือติดต่อร้านทางไลน์';

  async function api(url, opts = {}) {
    const r = await fetch(url, { headers: { 'content-type': 'application/json' }, ...opts });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(d.error || ('HTTP ' + r.status)); e.code = d.error; e.status = r.status; throw e; }
    return d;
  }
  const radio = n => (document.querySelector('input[name="' + n + '"]:checked') || {}).value;

  async function copy(text) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (e) {}
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove(); return ok;
  }
  function flash(el, text) { const o = el.textContent; el.textContent = text; setTimeout(() => { el.textContent = o; }, 1600); }

  function saveActive() {
    try { active ? localStorage.setItem(KEY, JSON.stringify(active)) : localStorage.removeItem(KEY); } catch (e) {}
  }
  function loadActive() {
    try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d && d.code && d.token ? d : null; } catch (e) { return null; }
  }

  async function loadProducts() {
    try {
      const d = await api('/api/order');
      products = d.products || {};
      document.querySelectorAll('[data-price]').forEach(el => {
        const p = products[el.dataset.price];
        el.textContent = !p ? '' : (p.price > 0 ? fmt(p.price) : 'ประเมินก่อน');
      });
    } catch (e) {
      document.querySelectorAll('[data-price]').forEach(el => { el.textContent = 'โหลดราคาไม่สำเร็จ'; });
    }
  }

  // ---------- สร้างคำสั่งซื้อ ----------
  $('orderForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    $('orderErr').classList.remove('show');
    const body = {
      type: radio('type'),
      name: f.name.value, contact: f.contact.value, goal: f.goal.value, brand: f.brand.value,
      reference: f.reference.value, deadline: f.deadline.value,
      website: f.website.value, consent: $('fConsent').checked
    };
    if (!body.name.trim() || !body.contact.trim() || !body.goal.trim()) {
      return showOrderErr(msg('missing_fields'));
    }
    const btn = $('submitBtn'); btn.disabled = true; btn.textContent = 'กำลังสร้างคำสั่งซื้อ...';
    try {
      const r = await api('/api/order', { method: 'POST', body: JSON.stringify(body) });
      if (!r.code) return showOrderErr('ส่งคำขอไม่สำเร็จ กรุณาติดต่อร้านทางไลน์');
      active = { code: r.code, token: r.token };
      saveActive();
      f.reset(); $('fConsent').checked = false;
      document.querySelector('input[name="type"][value="' + body.type + '"]').checked = true;
      showStatus(); refresh();
      $('statusCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      showOrderErr(msg(err.code));
    } finally {
      btn.disabled = false; btn.textContent = 'สร้างคำสั่งซื้อ';
    }
  });
  function showOrderErr(t) { const el = $('orderErr'); el.textContent = t; el.classList.add('show'); }

  // ---------- แสดงสถานะ ----------
  function showStatus() { $('statusCard').hidden = false; }

  function render(v) {
    currentView = v;
    $('stCode').textContent = v.code;
    $('stLabel').textContent = v.status;
    $('stMeta').textContent = v.label + (v.price > 0 ? ' · ยอด ' + fmt(v.price) : ' · ยอดรอทีมงานกำหนด');
    $('stErr').classList.remove('show');

    $('cancelBlock').hidden = !v.cancelled;
    $('lineBlock').hidden = v.cancelled || v.lineVerified;
    $('lineCode').textContent = v.code;
    if (v.lineUrl) $('lineBtn').href = v.lineUrl;

    const showPay = !!v.payment && !v.paid && !v.cancelled;
    $('payBlock').hidden = !showPay;
    if (showPay) {
      $('payAmount').textContent = fmt(v.price);
      $('payRef').textContent = v.code;
      $('payHolder').textContent = v.payment.holder || 'ยังไม่ได้ตั้งค่า';
      $('payAccount').textContent = v.payment.account || 'ยังไม่ได้ตั้งค่า';
      $('copyAcc').disabled = !v.payment.account;
      if (v.payment.qr) {
        $('payQr').src = v.payment.qr; $('payQr').hidden = false;
        $('dlQr').hidden = false; $('qrEmpty').hidden = true;
      } else {
        $('payQr').hidden = true; $('dlQr').hidden = true; $('qrEmpty').hidden = false;
      }
      $('reportBtn').hidden = v.paymentReported;
      $('reportBtn').disabled = v.paymentReported;
      $('reportedNote').hidden = !v.paymentReported;
      $('reportNote').parentElement.hidden = v.paymentReported;
    }

    const dl = v.released;
    $('dlBlock').hidden = !dl;
    if (dl) {
      const list = $('fileList'); list.textContent = '';
      if (v.files.length) {
        v.files.forEach(file => {
          const a = document.createElement('a');
          a.className = 'cx-btn';
          a.href = '/api/order/download?code=' + encodeURIComponent(v.code) +
            '&token=' + encodeURIComponent(active.token) + '&id=' + encodeURIComponent(file.id);
          a.setAttribute('download', file.name);
          a.textContent = 'ดาวน์โหลด ' + file.name + ' (' + Math.max(1, Math.round(file.size / 1024)) + ' KB)';
          list.appendChild(a);
        });
      }
      $('noFiles').hidden = v.files.length > 0;
      $('mailBtn').disabled = !v.files.length;
    }
  }

  async function refresh() {
    if (!active) return;
    try {
      const v = await api('/api/order/status?code=' + encodeURIComponent(active.code) + '&token=' + encodeURIComponent(active.token));
      showStatus(); render(v);
    } catch (e) {
      if (e.status === 404) {
        active = null; saveActive();
        $('statusCard').hidden = true;
        showRestoreErr(msg('not_found'));
      } else {
        $('stErr').textContent = 'โหลดสถานะไม่สำเร็จ กรุณาลองรีเฟรช';
        $('stErr').classList.add('show');
      }
    }
  }
  function showRestoreErr(t) { const el = $('rErr'); el.textContent = t; el.classList.add('show'); }

  $('refreshBtn').addEventListener('click', refresh);
  $('forgetBtn').addEventListener('click', () => {
    if (!confirm('ล้างคำสั่งซื้อนี้ออกจากเครื่องนี้ ต้องใช้รหัสและรหัสติดตามเพื่อกลับมาดูอีกครั้ง')) return;
    active = null; saveActive(); $('statusCard').hidden = true;
  });

  $('lineBtn').addEventListener('click', async () => {
    if (active) await copy(active.code);
    flash($('lineBtn'), 'คัดลอกรหัสแล้ว');
  });
  $('copyCodeBtn').addEventListener('click', async () => {
    if (!active) return;
    flash($('copyCodeBtn'), (await copy(active.code)) ? 'คัดลอกแล้ว' : 'คัดลอกไม่สำเร็จ');
  });
  $('copyAcc').addEventListener('click', async () => {
    const acc = currentView && currentView.payment && currentView.payment.account;
    if (!acc) return;
    flash($('copyAcc'), (await copy(acc)) ? 'คัดลอกแล้ว' : 'คัดลอกไม่สำเร็จ');
  });
  $('dlQr').addEventListener('click', () => {
    const qr = currentView && currentView.payment && currentView.payment.qr;
    if (!qr) return;
    const a = document.createElement('a'); a.href = qr; a.download = 'BRAINFORZE-' + active.code + '-QR.png';
    document.body.appendChild(a); a.click(); a.remove();
  });
  $('reportBtn').addEventListener('click', async () => {
    if (!active) return;
    const btn = $('reportBtn'); btn.disabled = true; btn.textContent = 'กำลังส่ง...';
    try {
      const v = await api('/api/order/report', { method: 'POST', body: JSON.stringify({ code: active.code, token: active.token, note: $('reportNote').value }) });
      render(v);
    } catch (e) {
      $('stErr').textContent = msg(e.code); $('stErr').classList.add('show');
      btn.disabled = false;
    } finally { btn.textContent = 'แจ้งโอนแล้ว'; }
  });

  $('mailBtn').addEventListener('click', async () => {
    if (!active) return;
    const email = $('mailTo').value.trim();
    const out = $('mailMsg');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { out.textContent = 'กรุณากรอกอีเมลให้ถูกต้อง'; return; }
    const btn = $('mailBtn'); btn.disabled = true; btn.textContent = 'กำลังส่ง...';
    try {
      await api('/api/order/email', { method: 'POST', body: JSON.stringify({ code: active.code, token: active.token, email }) });
      out.textContent = 'ส่งลิงก์ไปที่ ' + email + ' แล้ว (ถ้าไม่เห็นในกล่องจดหมาย ลองดูในโฟลเดอร์สแปม)';
    } catch (e) {
      out.textContent = e.code === 'mail_not_configured' ? 'ระบบอีเมลยังไม่พร้อม ดาวน์โหลดจากปุ่มด้านบนได้เลย' : (e.code === 'mail_failed' ? 'ส่งอีเมลไม่สำเร็จ ลองใหม่ หรือดาวน์โหลดจากปุ่มด้านบน' : msg(e.code));
    } finally { btn.disabled = false; btn.textContent = 'ส่งลิงก์ไปที่อีเมล'; }
  });

  // ---------- ติดตามคำสั่งซื้อเดิม ----------
  $('restoreForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('rErr').classList.remove('show');
    const code = $('rCode').value.trim().toUpperCase(), token = $('rToken').value.trim();
    if (!code || !token) return showRestoreErr('กรุณากรอกรหัสและรหัสติดตาม');
    active = { code, token };
    try { await api('/api/order/status?code=' + encodeURIComponent(code) + '&token=' + encodeURIComponent(token)); }
    catch (err) { active = null; return showRestoreErr(msg(err.code)); }
    saveActive(); showStatus(); refresh();
    $('statusCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---------- เริ่มต้น ----------
  loadProducts();
  active = loadActive();
  if (active) { showStatus(); refresh(); }
  timer = setInterval(() => { if (active && !document.hidden) refresh(); }, 30000);
})();
