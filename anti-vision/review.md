
7. LP側のフォーム送信JS

LPのフォームに、hiddenのスパム対策フィールドを1つ追加してください。

<input
  type="text"
  name="company"
  id="company"
  autocomplete="off"
  tabindex="-1"
  style="position:absolute; left:-9999px; opacity:0;"
>

次に、送信処理をこれに差し替えてください。
<script>
(function () {
  const GAS_ENDPOINT = 'ここにGASのウェブアプリURLを入れる';

  const form = document.querySelector('#waitlist form');
  const note = document.getElementById('form-note');

  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = document.getElementById('email');
    if (!email.value || !email.checkValidity()) {
      email.reportValidity();
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.classList.add('opacity-60', 'cursor-not-allowed');

    const params = new URLSearchParams(window.location.search);

    const rebuildValues = Array.from(
      form.querySelectorAll('input[name="rebuild"]:checked')
    ).map(function (el) {
      return el.value;
    });

    const payload = {
      email: form.email.value,
      age: form.age ? form.age.value : '',
      rebuild: rebuildValues,
      worry: form.worry ? form.worry.value : '',
      price: form.price ? form.price.value : '',
      company: form.company ? form.company.value : '',

      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_content: params.get('utm_content') || '',

      page_url: window.location.href,
      user_agent: navigator.userAgent,
      referrer: document.referrer || ''
    };

    try {
      await fetch(GAS_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(payload)
      });

      note.classList.remove('hidden');
      note.textContent = 'ご登録ありがとうございます。リリースに向けてご案内をお送りします。';
      form.reset();

    } catch (error) {
      console.error(error);
      note.classList.remove('hidden');
      note.textContent = '送信に失敗しました。時間をおいて再度お試しください。';
      btn.disabled = false;
      btn.classList.remove('opacity-60', 'cursor-not-allowed');
    }
  });
})();
</script>

-----

今のGAS

const SPREADSHEET_ID = '1EfK6O6Ni6vel0hUOv7ik-qhf58fiwLFmw-GCUNk1kJw';
const SHEET_NAME = 'responses';

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const body = e && e.postData && e.postData.contents
      ? e.postData.contents
      : '{}';

    const data = JSON.parse(body);

    // 簡易スパム対策：LP側で hidden の company フィールドを作り、入力があれば無視する
    if (data.company) {
      return createJsonResponse({
        ok: true,
        ignored: true
      });
    }

    const email = sanitize(data.email);
    if (!email || !isValidEmail(email)) {
      return createJsonResponse({
        ok: false,
        error: 'invalid_email'
      });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);

    sheet.appendRow([
      new Date(),
      email,
      sanitize(data.age),
      Array.isArray(data.rebuild) ? data.rebuild.join(', ') : sanitize(data.rebuild),
      sanitize(data.worry),
      sanitize(data.price),
      sanitize(data.utm_source),
      sanitize(data.utm_medium),
      sanitize(data.utm_campaign),
      sanitize(data.utm_content),
      sanitize(data.page_url),
      sanitize(data.user_agent),
      sanitize(data.referrer),
      body
    ]);

    return createJsonResponse({
      ok: true
    });

  } catch (error) {
    console.error(error);

    return createJsonResponse({
      ok: false,
      error: 'server_error'
    });

  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function doGet() {
  return createJsonResponse({
    ok: true,
    message: 'life-reset-waitlist-api is running'
  });
}

function createJsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitize(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/\r?\n|\r/g, ' ')
    .trim()
    .slice(0, 5000);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}