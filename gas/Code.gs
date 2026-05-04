// ============================================================
// CONFIGURATION — 배포 전 이 값들을 수정하세요
// ============================================================
const CONFIG = {
  BOOK_PRICE: 20000,                        // 권당 가격 (원)
  BOOK_TITLE: "나단이라고 불러줘",          // 이메일 본문에 사용
  OWNER_EMAIL: "edit.requin@gmail.com",     // 주문 알림 받을 이메일
  REPLY_TO_EMAIL: "edit.requin@gmail.com",  // 고객이 답장할 이메일
  SHEET_NAME: "Form Responses 1",           // Google Sheets 탭 이름
  BANK_ACCOUNT: "카카오뱅크 3333-05-9867460 이나래",  // 입금 계좌번호

  // 컬럼 번호 (1부터 시작)
  COL_TIMESTAMP: 1,             // A: 접수일시
  COL_NAME: 2,                  // B: 이름
  COL_POSTAL: 3,                // C: 우편번호
  COL_ADDRESS: 4,               // D: 주소
  COL_CONTACT: 5,               // E: 연락처
  COL_EMAIL: 6,                 // F: 이메일
  COL_QUANTITY: 7,              // G: 수량
  COL_DONATION: 8,              // H: 기부처
  COL_NOTE: 9,                  // I: 비고
  COL_TOTAL: 10,                // J: 결제금액
  COL_ORDER_ID: 11,             // K: Order ID (Apps Script 자동)
  COL_PAYMENT_CONFIRMED: 12,    // L: 입금확인 (소유자 체크박스)
  COL_CONFIRMATION_SENT: 13,    // M: 확인메일발송 (Apps Script 자동)
  COL_CONFIRMATION_SENT_AT: 14, // N: 메일발송시각 (Apps Script 자동)
  COL_DELIVERY_DONE: 15,        // O: 배송 완료 (소유자 수동 체크박스)
  COL_OWNER_NOTES: 16,          // P: 메모 (수동, 선택사항)

  MAX_ORDERS_PER_EMAIL_PER_DAY: 3,          // 동일 이메일 일일 주문 한도 (스팸 방지)
};

// ============================================================
// 참고: HTML 폼에서 doPost로 제출되므로 onFormSubmit은 불필요합니다
// Google Form을 사용하려면 이 함수를 다시 활성화하세요
// ============================================================

// ============================================================
// 트리거: 소유자가 '입금확인' 체크박스 체크 시 자동 실행
// ============================================================
function onEdit(e) {
  if (!e || !e.source) return;
  
  const sheet = e.source.getActiveSheet();
  if (!sheet || sheet.getName() !== CONFIG.SHEET_NAME) return;
  if (!e.range || e.range.getColumn() !== CONFIG.COL_PAYMENT_CONFIRMED) return;
  if (e.value !== "TRUE") return;

  const row = e.range.getRow();

  // 이미 발송한 경우 중복 방지
  if (sheet.getRange(row, CONFIG.COL_CONFIRMATION_SENT).getValue() === true) return;

  const rowData       = sheet.getRange(row, 1, 1, 16).getValues()[0];
  const customerEmail = rowData[CONFIG.COL_EMAIL - 1];
  const quantity      = rowData[CONFIG.COL_QUANTITY - 1];
  const customerName  = rowData[CONFIG.COL_NAME - 1];
  const orderId       = rowData[CONFIG.COL_ORDER_ID - 1];

  if (!customerEmail) return;

  MailApp.sendEmail({
    to: customerEmail,
    replyTo: CONFIG.REPLY_TO_EMAIL,
    subject: `주문 확인되었습니다! [${orderId}]`,
    body: buildCustomerEmail(customerName, orderId, quantity),
  });

  // 발송 완료 표시
  sheet.getRange(row, CONFIG.COL_CONFIRMATION_SENT).setValue(true);
  sheet.getRange(row, CONFIG.COL_CONFIRMATION_SENT_AT).setValue(new Date());
}

// ============================================================
// Web App 엔드포인트: 집계 통계만 반환 (개인정보 없음)
// 배포 설정: Execute as = Me, Who has access = Anyone
// ============================================================
function doPost(e) {
  try {
    var data = e.parameter;

    // 허니팟 체크
    if (data.website) return respond(false, 'blocked');

    // 시간 체크 (3초 미만 = 봇)
    if (!data.loadTime || (Date.now() - Number(data.loadTime)) < 3000)
      return respond(false, 'blocked');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.getActiveSheet();

    // 헤더가 없으면 첫 행에 추가
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['접수일시','이름','우편번호','주소','연락처','이메일','수량','기부처','비고','결제금액']);
    }

    const lastRow = sheet.getLastRow() + 1;
    const orderId = generateOrderId(lastRow);
    
    sheet.appendRow([
      new Date(),
      data.name,
      data.postalCode,
      data.address,
      data.contact,
      data.email,
      data.quantity,
      data.donationOrg,
      data.note,
      data.total
    ]);

    // Order ID 추가
    sheet.getRange(lastRow, CONFIG.COL_ORDER_ID).setValue(orderId);

    // 고객에게 입금 안내 메일 발송
    MailApp.sendEmail({
      to: data.email,
      replyTo: CONFIG.REPLY_TO_EMAIL,
      subject: "나단이라고 불러줘 주문 확인 메일",
      body: buildCustomerOrderEmail(data.name, data.quantity, data.total),
    });

    // 소유자에게 알림 메일 발송
    MailApp.sendEmail({
      to: CONFIG.OWNER_EMAIL,
      subject: `[새 주문] ${orderId} — ${data.name}`,
      body: buildOwnerEmail(orderId, data.name, data.email, data.quantity, data.address, data.note),
    });

    return respond(true, 'ok');
  } catch (err) {
    return respond(false, err.toString());
  }
}

function respond(success, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: success, message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// Web App 엔드포인트: 통계 반환
// ============================================================
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.getActiveSheet();
    var lastRow = sheet.getLastRow();

    // 헤더만 있거나 비어있으면 0
    var dataRows = lastRow <= 1 ? 0 : lastRow - 1;

    // 결제금액 열(J열, 10번째) 합산
    var totalAmount = 0;
    if (dataRows > 0) {
      var amounts = sheet.getRange(2, CONFIG.COL_TOTAL, dataRows, 1).getValues();
      amounts.forEach(function(row) {
        var val = Number(row[0]);
        if (!isNaN(val)) totalAmount += val;
      });
    }

    // 수량 열(G열, 7번째) 합산 — 권 수 기준
    var totalOrders = 0;
    if (dataRows > 0) {
      var quantities = sheet.getRange(2, CONFIG.COL_QUANTITY, dataRows, 1).getValues();
      quantities.forEach(function(row) {
        var val = Number(row[0]);
        if (!isNaN(val)) totalOrders += val;
      });
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        totalOrders: totalOrders,
        fundraisingAmount: totalAmount
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ totalOrders: 0, fundraisingAmount: 0 }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// 최초 1회 실행: 트리거 설치
// Apps Script 편집기에서 이 함수를 선택하고 실행하세요
// ============================================================
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // onEdit 트리거만 설치 (HTML 폼은 doPost로 처리)
  ScriptApp.newTrigger("onEdit")
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log("트리거 설치 완료 (onEdit만 활성화)");
}

// ============================================================
// 내부 헬퍼 함수
// ============================================================
// getValue 함수는 onFormSubmit이 제거되었으므로 이제 불필요합니다

function generateOrderId(lastRow) {
  const year = new Date().getFullYear();
  const seq  = String(lastRow - 1).padStart(4, "0");
  return `ORD-${year}-${seq}`;
}

function isRateLimited(sheet, email) {
  if (!email) return false;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const timestamps = sheet.getRange(2, CONFIG.COL_TIMESTAMP, lastRow - 1, 1).getValues();
  const emails     = sheet.getRange(2, CONFIG.COL_EMAIL,     lastRow - 1, 1).getValues();

  let count = 0;
  for (let i = 0; i < emails.length; i++) {
    const rowDate = new Date(timestamps[i][0]);
    rowDate.setHours(0, 0, 0, 0);
    if (emails[i][0] === email && rowDate.getTime() === today.getTime()) count++;
  }
  return count >= CONFIG.MAX_ORDERS_PER_EMAIL_PER_DAY;
}

function buildJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// 이메일 템플릿: 소유자 알림
// ============================================================
function buildOwnerEmail(orderId, name, email, quantity, address, note) {
  return `새 주문이 접수되었습니다.

주문번호:   ${orderId}
배송인:     ${name}
이메일:     ${email}
수량:       ${quantity}
배송주소:   ${address}
요청사항:   ${note || "없음"}

[처리 방법]
1. 고객에게 입금 안내 (계좌번호 등)
2. 입금 확인 후 Google Sheets 열기
3. ${orderId} 행의 '입금확인' 체크박스(L열) 체크
   → 고객에게 확인 메일이 자동 발송됩니다`;
}

// ============================================================
// 이메일 템플릿: 고객 주문 확인
// ============================================================
function buildCustomerEmail(name, orderId, copies) {
  return `안녕하세요, ${name}님.

입금이 확인되어 주문이 정상적으로 접수되었습니다.

주문 정보
  주문번호: ${orderId}
  수량:     ${copies}권
  도서명:   ${CONFIG.BOOK_TITLE}

매달 말일 배송됩니다. 배송 전 안내 메일을 별도로 드리겠습니다.
문의 사항이 있으시면 이 메일로 답장해 주세요.

감사합니다!
[저자명] 드림`;
}

// ============================================================
// 이메일 템플릿: 고객 입금 안내
// ============================================================
function buildCustomerOrderEmail(name, quantity, total) {
  return `안녕하세요, ${name}님.

나단이라고 불러줘를 구매해주셔서 정말 감사합니다. 🎉

주문 정보
━━━━━━━━━━━━━━━━━━━━━
수량: ${quantity}권
금액: ${total.toLocaleString('ko-KR')}

입금 안내
━━━━━━━━━━━━━━━━━━━━━
계좌번호: ${CONFIG.BANK_ACCOUNT}

입금 후 24시간 이내에 배송을 시작하겠습니다.
입금 확인을 위해 이 메일로 문의해주세요.

감사합니다!
상어 출판사 드림`;
}
