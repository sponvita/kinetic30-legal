/**
 * 人生立て直しアプリ LP - GASバックエンド（控え／バージョン管理用）
 *
 * 実体は Apps Script 側にあります。このファイルはコピペ元の単一ソースです。
 * 反映するには Apps Script に貼り付け → 「デプロイを管理」→ 既存を編集
 * → バージョン「新しいバージョン」→ デプロイ。初回は権限承認が必要。
 *
 * LP（index.html）は stage だけを送り、書き込み先シートは GAS が stage で振り分ける:
 *   quiz_start / quiz_complete / buy_intent → diagnostics シート（診断ファネル）
 *   lead                                    → leads シート（メール登録）
 *   honeypot / invalid_email / server_error → rejected シート（弾いた登録）
 */

const SPREADSHEET_ID = '1EfK6O6Ni6vel0hUOv7ik-qhf58fiwLFmw-GCUNk1kJw';
const LEADS_SHEET  = 'leads';        // メール登録（新規シート）
const DIAG_SHEET   = 'diagnostics';  // 診断ファネル（新規シート）
const REJECT_SHEET = 'rejected';     // 弾いた登録

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const body = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(body);

    // ハニーポット（bot がスパム対策の隠しフィールドを埋めたら破棄）
    if (data.company) {
      logRejected_('honeypot', body);
      return createJsonResponse({ ok: true, ignored: true });
    }

    const stage = sanitize(data.stage);

    // 診断ファネル（メール不要）→ diagnostics シート
    if (stage === 'quiz_start' || stage === 'quiz_complete' || stage === 'buy_intent') {
      appendDiag_(data, body);
      return createJsonResponse({ ok: true });
    }

    // それ以外（lead）はメール必須 → leads シート
    const email = sanitize(data.email);
    if (!email || !isValidEmail(email)) {
      logRejected_('invalid_email', body);
      return createJsonResponse({ ok: false, error: 'invalid_email' });
    }
    appendLead_(data, email, body);
    return createJsonResponse({ ok: true });

  } catch (error) {
    console.error(error);
    logRejected_('server_error', (e && e.postData && e.postData.contents) || '');
    return createJsonResponse({ ok: false, error: 'server_error' });

  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// --- 診断ファネルを diagnostics シートへ ---
function appendDiag_(data, body) {
  const sheet = getSheet_(DIAG_SHEET, [
    'received_at', 'client_id', 'stage', 'result_type', 'price', 'answers',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
    'page_url', 'user_agent', 'referrer', 'raw_json'
  ]);
  sheet.appendRow([
    new Date(),
    sanitize(data.client_id),
    sanitize(data.stage),
    sanitize(data.result_type),
    sanitize(data.price),
    sanitize(data.answers),
    sanitize(data.utm_source),
    sanitize(data.utm_medium),
    sanitize(data.utm_campaign),
    sanitize(data.utm_content),
    sanitize(data.page_url),
    sanitize(data.user_agent),
    sanitize(data.referrer),
    body
  ]);
}

// --- メール登録を leads シートへ ---
function appendLead_(data, email, body) {
  const sheet = getSheet_(LEADS_SHEET, [
    'received_at', 'client_id', 'email', 'result_type', 'buy_intent', 'answers',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
    'page_url', 'user_agent', 'referrer', 'raw_json'
  ]);
  sheet.appendRow([
    new Date(),
    sanitize(data.client_id),
    email,
    sanitize(data.result_type),
    data.buy_intent ? 'yes' : '',
    sanitize(data.answers),
    sanitize(data.utm_source),
    sanitize(data.utm_medium),
    sanitize(data.utm_campaign),
    sanitize(data.utm_content),
    sanitize(data.page_url),
    sanitize(data.user_agent),
    sanitize(data.referrer),
    body
  ]);
}

// --- 弾いた登録を rejected シートへ ---
function logRejected_(reason, body) {
  try {
    const sheet = getSheet_(REJECT_SHEET, ['received_at', 'reason', 'raw_json']);
    sheet.appendRow([new Date(), reason, sanitize(body)]);
  } catch (err) {
    console.error(err);
  }
}

// --- シート取得（無ければ作成＋ヘッダー付与） ---
function getSheet_(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) { sheet = ss.insertSheet(name); }
  if (sheet.getLastRow() === 0) { sheet.appendRow(headers); }
  return sheet;
}

function doGet() {
  return createJsonResponse({ ok: true, message: 'life-reset-waitlist-api is running' });
}

function createJsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitize(value) {
  if (value === null || value === undefined) { return ''; }
  return String(value)
    .replace(/\r?\n|\r/g, ' ')
    .trim()
    .slice(0, 5000);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
