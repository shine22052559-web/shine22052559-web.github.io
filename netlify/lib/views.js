// ฟังก์ชันล้วน (ไม่พึ่ง Blobs/เครือข่าย) — กำหนดสถานะและการปลดล็อกไฟล์
// ด่านการปลดล็อก: ต้องผ่าน "ลูกค้าเพิ่มไลน์และส่งรหัส" และ "เจ้าของยืนยันการชำระ" พร้อมกันเท่านั้น
export function isReleased(o) {
  return !!(o && o.lineVerified && o.paid && !o.cancelled);
}

export function statusLabel(o) {
  if (o.cancelled) return 'ยกเลิกแล้ว';
  if (isReleased(o)) return (o.files && o.files.length) ? 'พร้อมดาวน์โหลด' : 'ชำระแล้ว · กำลังเตรียมไฟล์ส่งมอบ';
  if (o.paid && !o.lineVerified) return 'ชำระแล้ว · รอเพิ่มไลน์และส่งรหัสเพื่อยืนยันการรับงาน';
  if (!o.lineVerified) return 'รอเพิ่มไลน์และส่งรหัสคำสั่งซื้อ';
  if (o.price <= 0) return 'รอทีมงานกำหนดยอดชำระ';
  if (o.paymentReported) return 'แจ้งโอนแล้ว · รอตรวจสอบยอด';
  return 'รอชำระเงิน';
}

export function publicPayment(p) {
  if (!p) return null;
  return { holder: p.holder || '', account: p.account || '', qr: p.qr || '' };
}

export function customerView(o, payment, lineUrl) {
  const released = isReleased(o);
  const showPay = !!o.lineVerified && !o.paid && !o.cancelled && o.price > 0;
  return {
    code: o.code,
    label: o.label,
    price: o.price,
    status: statusLabel(o),
    createdAt: o.createdAt,
    lineVerified: !!o.lineVerified,
    lineUrl: o.lineVerified ? null : lineUrl,
    paymentReported: !!o.paymentReported,
    paid: !!o.paid,
    released,
    cancelled: !!o.cancelled,
    emailed: !!o.deliveryEmail,
    payment: showPay ? publicPayment(payment) : null,
    files: released ? (o.files || []).map(f => ({ id: f.id, name: f.name, size: f.size })) : []
  };
}
