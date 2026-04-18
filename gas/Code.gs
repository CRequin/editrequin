// ============================================================
// CONFIGURATION — 배포 전 이 값들을 수정하세요
// ============================================================
const CONFIG = {
  BOOK_PRICE: 25000,                        // 권당 가격 (원)
  BOOK_TITLE: "책 제목",                    // 이메일 본문에 사용
  OWNER_EMAIL: "your@gmail.com",            // 주문 알림 받을 이메일
  REPLY_TO_EMAIL: "your@gmail.com",         // 고객이 답장할 이메일
  SHEET_NAME: "Form Responses 1",           // Google Sheets 탭 이름

  // 컬럼 번호 (1부터 시작)
  // A~G: Form 자동 생성, H~M: 수동 추가
  COL_TIMESTAMP: 1,             // A: 타임스탬프
  COL_EMAIL: 2,                 // B: 이메일 주소
  COL_COPIES: 3,                // C: 구매 권 수
  COL_NAME: 4,                  // D: 배송인 이름
  COL_ADDRESS: 5,               // E: 배송 주소
  COL_REQUESTS: 6,              // F: 요청 사항 (기록만, 처리 불필요)
  COL_CONSENT: 7,               // G: 동의 여부 (기록만, 처리 불필요)
  COL_ORDER_ID: 8,              // H: Order ID (Apps Script 자동)
  COL_PAYMENT_CONFIRMED: 9,     // I: 입금확인 (소유자 체크박스)
  COL_CONFIRMATION_SENT: 10,    // J: 확인메일발송 (Apps Script 자동)
  COL_CONFIRMATION_SENT_AT: 11, // K: 메일발송시각 (Apps Script 자동)
  COL_DELIVERY_DONE: 12,        // L: 배송 완료 (소유자 수동 체크박스)
  COL_OWNER_NOTES: 13,          // M: 메모 (수동, 선택사항)

  MAX_ORDERS_PER_EMAIL_PER_DAY: 3,          // 동일 이메일 일일 주문 한도 (스팸 방지)
};

// ============================================================
// 트리거 1: 주문 양식 제출 시 자동 실행
// ============================================================
function onFormSubmit(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.SHEET_NAME);
  const lastRow = sheet.getLastRow();

  const customerEmail = getValue(e, "이메일 주소");
  const copies        = getValue(e, "구매 권 수");
  const customerName  = getValue(e, "배송인 이름");
  const address       = getValue(e, "배송 주소");

  // Order ID 생성 후 Sheets에 기록
  const orderId = generateOrderId(lastRow);
  sheet.getRange(lastRow, CONFIG.COL_ORDER_ID).setValue(orderId);

  // 스팸/어뷰징 감지
  if (isRateLimited(sheet, customerEmail)) {
    sheet.getRange(lastRow, CONFIG.COL_OWNER_NOTES)
         .setValue("FLAGGED: 동일 이메일 일일 한도 초과");
    return;
  }

  // 소유자에게 알림 메일 발송
  MailApp.sendEmail({
    to: CONFIG.OWNER_EMAIL,
    subject: `[새 주문] ${orderId} — ${customerName}`,
    body: buildOwnerEmail(orderId, customerName, customerEmail, copies, address),
  });
}

// ============================================================
// 트리거 2: 소유자가 '입금확인' 체크박스 체크 시 자동 실행
// ============================================================
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== CONFIG.SHEET_NAME) return;
  if (e.range.getColumn() !== CONFIG.COL_PAYMENT_CONFIRMED) return;
  if (e.value !== "TRUE") return;

  const row = e.range.getRow();

  // 이미 발송한 경우 중복 방지
  if (sheet.getRange(row, CONFIG.COL_CONFIRMATION_SENT).getValue() === true) return;

  const rowData       = sheet.getRange(row, 1, 1, 13).getValues()[0];
  const customerEmail = rowData[CONFIG.COL_EMAIL - 1];
  const copies        = rowData[CONFIG.COL_COPIES - 1];
  const customerName  = rowData[CONFIG.COL_NAME - 1];
  const orderId       = rowData[CONFIG.COL_ORDER_ID - 1];

  if (!customerEmail) return;

  MailApp.sendEmail({
    to: customerEmail,
    replyTo: CONFIG.REPLY_TO_EMAIL,
    subject: `주문 확인되었습니다! [${orderId}]`,
    body: buildCustomerEmail(customerName, orderId, copies),
  });

  // 발송 완료 표시
  sheet.getRange(row, CONFIG.COL_CONFIRMATION_SENT).setValue(true);
  sheet.getRange(row, CONFIG.COL_CONFIRMATION_SENT_AT).setValue(new Date());
}

// ============================================================
// Web App 엔드포인트: 집계 통계만 반환 (개인정보 없음)
// 배포 설정: Execute as = Me, Who has access = Anyone
// ============================================================
function doGet() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("stats");
  if (cached) {
    return buildJsonResponse(JSON.parse(cached));
  }

  const sheet     = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const lastRow   = sheet.getLastRow();
  const totalOrders = Math.max(0, lastRow - 1); // 헤더 행 제외

  let confirmedOrders = 0;
  if (totalOrders > 0) {
    const confirmed = sheet
      .getRange(2, CONFIG.COL_PAYMENT_CONFIRMED, totalOrders, 1)
      .getValues();
    confirmedOrders = confirmed.filter(r => r[0] === true).length;
  }

  const stats = {
    totalOrders:       totalOrders,
    confirmedOrders:   confirmedOrders,
    fundraisingAmount: confirmedOrders * CONFIG.BOOK_PRICE,
    updatedAt:         new Date().toISOString(),
  };

  cache.put("stats", JSON.stringify(stats), 300); // 5분 캐시
  return buildJsonResponse(stats);
}

// ============================================================
// 최초 1회 실행: 트리거 설치
// Apps Script 편집기에서 이 함수를 선택하고 실행하세요
// ============================================================
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ScriptApp.newTrigger("onFormSubmit")
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  ScriptApp.newTrigger("onEdit")
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log("트리거 설치 완료");
}

// ============================================================
// 내부 헬퍼 함수
// ============================================================
function getValue(e, fieldName) {
  return (e.namedValues[fieldName] && e.namedValues[fieldName][0]) || "";
}

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
function buildOwnerEmail(orderId, name, email, copies, address) {
  return `새 주문이 접수되었습니다.

주문번호:   ${orderId}
배송인:     ${name}
이메일:     ${email}
수량:       ${copies}
배송주소:   ${address}

[처리 방법]
1. 고객에게 입금 안내 (계좌번호 등)
2. 입금 확인 후 Google Sheets 열기
3. ${orderId} 행의 '입금확인' 체크박스(I열) 체크
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
