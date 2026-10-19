// Site hook: after a visitor has spent 10 seconds on the page (visible time only),
// show a modal notice about the mandatory IT security briefing.
// Shown once per page per browser session. Loaded by index.html, v2/index.html and v3/index.html;
// the Pages workflow publishes it at /hooks/ because Pages skips hidden folders.
(function () {
  'use strict';

  var DELAY_MS = 10000;
  var STORAGE_KEY = 'it-briefing-notice-seen:' + location.pathname;

  function alreadySeen() {
    try { return sessionStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }
  function markSeen() {
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) { /* storage blocked */ }
  }

  function showNotice() {
    if (alreadySeen() || document.getElementById('it-briefing-dialog')) return;
    markSeen();

    var style = document.createElement('style');
    style.textContent =
      '#it-briefing-dialog{border:0;border-radius:14px;padding:0;max-width:min(420px,calc(100vw - 32px));' +
      'background:#fff;color:#1a1d24;box-shadow:0 24px 64px rgba(0,0,0,.28);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}' +
      '#it-briefing-dialog::backdrop{background:rgba(10,12,18,.55)}' +
      '#it-briefing-dialog .itb-body{padding:24px 24px 20px}' +
      '#it-briefing-dialog .itb-tag{display:inline-block;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;' +
      'color:#b42318;background:#fde8e6;border-radius:999px;padding:2px 10px;margin-bottom:12px}' +
      '#it-briefing-dialog h2{margin:0 0 8px;font-size:19px;line-height:1.3}' +
      '#it-briefing-dialog p{margin:0 0 6px}' +
      '#it-briefing-dialog .itb-when{font-weight:600}' +
      '#it-briefing-dialog .itb-actions{display:flex;justify-content:flex-end;padding:0 24px 20px}' +
      '#it-briefing-dialog button{font:inherit;font-weight:600;border:0;border-radius:8px;padding:9px 18px;cursor:pointer;background:#1f4fd8;color:#fff}' +
      '#it-briefing-dialog button:focus-visible{outline:3px solid #9db6ff;outline-offset:2px}' +
      '@media (prefers-color-scheme:dark){#it-briefing-dialog{background:#1c1f27;color:#e8eaf0}' +
      '#it-briefing-dialog .itb-tag{color:#ffb4ab;background:#4a1d1a}#it-briefing-dialog button{background:#5b82ff}}';
    document.head.appendChild(style);

    var dialog = document.createElement('dialog');
    dialog.id = 'it-briefing-dialog';
    dialog.setAttribute('aria-labelledby', 'it-briefing-title');
    dialog.setAttribute('aria-describedby', 'it-briefing-desc');
    dialog.innerHTML =
      '<div class="itb-body">' +
        '<span class="itb-tag">Mandatory</span>' +
        '<h2 id="it-briefing-title">IT Security Briefing</h2>' +
        '<div id="it-briefing-desc">' +
          '<p>There is an IT security briefing at the <strong>Town Hall</strong>.</p>' +
          '<p class="itb-when">Wednesday, 10:00 AM</p>' +
          '<p>Attendance is mandatory.</p>' +
        '</div>' +
      '</div>' +
      '<div class="itb-actions"><button type="button" autofocus>Got it</button></div>';

    dialog.querySelector('button').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () { dialog.remove(); style.remove(); });
    document.body.appendChild(dialog);

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.remove();
      style.remove();
      window.alert('IT Security Briefing\n\nTown Hall, Wednesday 10:00 AM.\nAttendance is mandatory.');
    }
  }

  // Count only time the page is actually visible, so a background tab doesn't trigger it.
  if (alreadySeen()) return;
  var remaining = DELAY_MS;
  var startedAt = 0;
  var timer = null;

  function start() {
    if (timer || document.visibilityState !== 'visible') return;
    startedAt = Date.now();
    timer = setTimeout(function () {
      timer = null;
      document.removeEventListener('visibilitychange', onVisibility);
      showNotice();
    }, remaining);
  }
  function pause() {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    remaining = Math.max(0, remaining - (Date.now() - startedAt));
  }
  function onVisibility() {
    if (document.visibilityState === 'visible') start(); else pause();
  }

  document.addEventListener('visibilitychange', onVisibility);
  start();
})();
