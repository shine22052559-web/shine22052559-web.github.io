# สถานะงานที่ทำได้จริงตอนนี้

## ไฟล์ที่ทำเพิ่มจริงในแพ็กนี้
- Starter Deliverables Pack: 50 ไฟล์ที่แก้ไขได้จริง ครบ 10 หมวด หมวดละ 5 ไฟล์
- Asset index CSV และคู่มือภาษาไทย
- ร้านค้า 500 รายการยังเป็นแคตตาล็อกตัวอย่างเพื่อออกแบบร้าน ไม่ใช่ 500 สินค้าที่ผ่าน QA แล้ว
- EA trial 14 วัน: โค้ด Netlify Function กำหนดอายุ 14 วัน และหน้าเว็บเรียก API; ต้อง deploy และทดสอบ end-to-end บน Netlify ก่อนใช้งานจริง

## ยังไม่ทำ/ไม่อ้างว่าพร้อม
- รับเงินจริง: ต้องตั้งค่า provider, secrets, webhook และทดสอบการยืนยันจาก server
- ดาวน์โหลดหลังชำระเงิน: ต้องเชื่อม order status กับ entitlement และไฟล์จริง
- 500 สินค้าพร้อมขาย: ต้องสร้าง/ตรวจ asset ราย SKU, preview, license, version และ QA
- EA compile/backtest: ต้องรันบน Windows ที่มี MT5/MetaEditor และเก็บ log จริง
- DRM กันหมดอายุ: เวลาในเครื่อง MT5 แก้ได้; ต้องมี license service ที่ตรวจสอบได้เพื่อให้แข็งแรงขึ้น

## เกณฑ์ที่ห้ามข้ามก่อนเปิดขาย
1. อย่าเปิด checkout จริงก่อน webhook ยืนยัน payment ฝั่ง server
2. อย่าให้ไฟล์ดิจิทัลเข้าถึงได้จาก public path หากควรปลดล็อกหลังจ่ายเงิน
3. ทุกสินค้าต้องระบุสถานะ: Draft / QA / Ready / Published
4. EA ต้องผ่าน compile, tester, risk review และ manual review ก่อนติดป้าย Ready
