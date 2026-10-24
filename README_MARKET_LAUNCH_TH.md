# BRAINFORZE EA Studio — เตรียมทดสอบตลาด

## สิ่งที่เพิ่มในชุดนี้
- `ea-dashboard-shop.html` หน้าตัวเลือก Dashboard 3 ระดับ: Essential 99 บาท, Pro Analytics 399 บาท, Quant Command 999 บาท พร้อมแบบฟอร์มคำขอ
- `docs/EA_Presentation_TH.pdf` เอกสารนำเสนอ EA
- `docs/EA_Quick_Start_TH.pdf` คู่มือเริ่มต้นใช้งาน MT5
- `docs/EA_Scalping_Guide_TH.pdf`, `docs/EA_Trend_Guide_TH.pdf`, `docs/EA_FastTick_Guide_TH.pdf` คู่มือรายแนวทาง
- `manifest.webmanifest` และ `sw.js` เพื่อให้เพิ่มหน้าเว็บลงหน้าจอหลักมือถือได้เมื่อใช้งานผ่าน HTTPS
- อีเมลส่งมอบเพิ่มลิงก์ไปยัง PDF ประกอบ

## ข้อกำหนดก่อนเปิดจริง
1. Deploy บน Netlify พร้อม Functions และ Netlify Blobs; เปิดผ่าน HTTPS
2. ลิงก์ PDF ในอีเมลจะสร้างจากโดเมนคำขอปัจจุบันโดยอัตโนมัติ
3. ตั้งค่า `GMAIL_USER` และ `GMAIL_APP_PASSWORD` ใน Netlify Environment Variables เพื่อส่งอีเมล
4. ทดสอบเส้นทางคำสั่งซื้อ: ยังไม่อนุมัติชำระเงินต้องส่งมอบไม่ได้; อนุมัติได้ต่อเมื่อผู้ดูแลตรวจยอดเงินจริงแล้ว
5. หน้าร้าน Dashboard Studio ในรุ่นนี้เป็น UI demo: การส่งฟอร์มยังไม่บันทึกลง backend, ไม่มี checkout/payment integration และไม่มีข้อมูล MT5 live; อย่ารับเงินโดยอ้างว่าฟอร์มนี้สร้างออเดอร์จริงแล้ว
6. ก่อนเปิดให้ลูกค้าใช้เงินจริง ต้องตรวจนโยบายราคาและสิทธิ์ส่งมอบตาม Master Plan (Pricing Policy ยังมีสถานะ CONFLICT — REVIEW REQUIRED)
7. EA เป็นตัวอย่างเท่านั้น; ต้อง Compile ด้วย MetaEditor และทดสอบ Strategy Tester ก่อนนำเสนอว่าใช้งานได้กับสภาพแวดล้อมที่กำหนด

## เพิ่มลงหน้าจอมือถือ
เปิดเว็บที่ Deploy ผ่าน Chrome บน Android > เมนู ⋮ > Add to Home screen / Install app (ข้อความอาจต่างกันตามรุ่น)

## สำคัญ
ไฟล์นี้เป็นชุดสำหรับทดสอบ/เตรียมติดตั้ง ไม่ได้หมายความว่าเว็บไซต์ถูก Deploy แล้ว ไม่รับประกันกำไร EA และไม่ควรส่งไฟล์/ปลดล็อกงานก่อนตรวจการชำระเงินจริง
