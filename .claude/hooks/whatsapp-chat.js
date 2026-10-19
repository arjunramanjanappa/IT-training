// Site hook: floating chat widget in the bottom-right corner that hands off to WhatsApp.
// Clicking the chat icon opens a small panel and fires a "wa-chat:open" event on document
// (other hooks, e.g. voice-greeting.js, listen for it). Loaded by index.html, v2/index.html and v3/index.html;
// the Pages workflow publishes it at /hooks/ because Pages skips hidden folders.
(function () {
  'use strict';

  var WHATSAPP_NUMBER = '6512345678'; // international format, no "+" (65 = Singapore)
  var GREETING = 'How can I help you?';
  var WHATSAPP_URL = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent('Hi, I need some help.');

  var CHAT_ICON =
    '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="currentColor">' +
    '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3Z"/>' +
    '</svg>';
  var CLOSE_ICON =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
    '<path d="M6 6l12 12M18 6L6 18"/></svg>';

  function build() {
    if (document.getElementById('wa-chat-widget')) return;

    var style = document.createElement('style');
    style.textContent =
      '#wa-chat-widget{position:fixed;right:20px;bottom:20px;z-index:35;font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}' +
      '#wa-chat-widget .wa-fab{width:58px;height:58px;border-radius:50%;border:0;cursor:pointer;display:grid;place-items:center;' +
      'background:#25d366;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.22);transition:transform .15s ease,box-shadow .15s ease}' +
      '#wa-chat-widget .wa-fab:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(0,0,0,.26)}' +
      '#wa-chat-widget .wa-fab:focus-visible{outline:3px solid #9de8b8;outline-offset:3px}' +
      '#wa-chat-widget .wa-panel{position:absolute;right:0;bottom:72px;width:min(300px,calc(100vw - 40px));border-radius:14px;overflow:hidden;' +
      'background:#fff;color:#1a1d24;box-shadow:0 18px 48px rgba(0,0,0,.24);transform-origin:bottom right;animation:wa-pop .16s ease-out}' +
      '#wa-chat-widget .wa-panel[hidden]{display:none}' +
      '#wa-chat-widget .wa-head{background:#075e54;color:#fff;padding:12px 16px;font-weight:600}' +
      '#wa-chat-widget .wa-head small{display:block;font-weight:400;opacity:.85;font-size:12px}' +
      '#wa-chat-widget .wa-body{padding:14px 16px;background:#efeae2}' +
      '#wa-chat-widget .wa-bubble{display:inline-block;background:#fff;border-radius:0 10px 10px 10px;padding:8px 12px;box-shadow:0 1px 1px rgba(0,0,0,.08)}' +
      '#wa-chat-widget .wa-cta{display:block;margin:12px 16px 14px;text-align:center;text-decoration:none;font-weight:600;' +
      'background:#25d366;color:#fff;border-radius:999px;padding:9px 14px}' +
      '#wa-chat-widget .wa-cta:focus-visible{outline:3px solid #075e54;outline-offset:2px}' +
      '@keyframes wa-pop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}' +
      '@media (prefers-reduced-motion:reduce){#wa-chat-widget .wa-panel{animation:none}#wa-chat-widget .wa-fab{transition:none}}' +
      '@media (prefers-color-scheme:dark){#wa-chat-widget .wa-panel{background:#1c1f27;color:#e8eaf0}' +
      '#wa-chat-widget .wa-body{background:#0b141a}#wa-chat-widget .wa-bubble{background:#202c33;color:#e9edef}}';
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.id = 'wa-chat-widget';
    root.innerHTML =
      '<div class="wa-panel" id="wa-chat-panel" role="dialog" aria-label="Chat with us on WhatsApp" hidden>' +
        '<div class="wa-head">IT PMO Help Desk<small>Typically replies within an hour</small></div>' +
        '<div class="wa-body"><span class="wa-bubble">' + GREETING + '</span></div>' +
        '<a class="wa-cta" href="' + WHATSAPP_URL + '" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>' +
      '</div>' +
      '<button type="button" class="wa-fab" aria-label="Open chat" aria-expanded="false" aria-controls="wa-chat-panel">' + CHAT_ICON + '</button>';
    document.body.appendChild(root);

    var fab = root.querySelector('.wa-fab');
    var panel = root.querySelector('.wa-panel');

    function setOpen(open) {
      panel.hidden = !open;
      fab.setAttribute('aria-expanded', String(open));
      fab.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
      fab.innerHTML = open ? CLOSE_ICON : CHAT_ICON;
      document.dispatchEvent(new CustomEvent(open ? 'wa-chat:open' : 'wa-chat:close', { detail: { greeting: GREETING } }));
    }

    fab.addEventListener('click', function () {
      setOpen(panel.hidden);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { setOpen(false); fab.focus(); }
    });
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
