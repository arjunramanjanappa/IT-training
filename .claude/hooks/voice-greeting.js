// Site hook: when the WhatsApp chat icon is clicked open (the "wa-chat:open" event from
// whatsapp-chat.js), speak "How can I help you?" with the browser's Web Speech API.
// Speech stops if the chat is closed. Loaded by index.html, v2/index.html and v3/index.html;
// the Pages workflow publishes it at /hooks/ because Pages skips hidden folders.
(function () {
  'use strict';

  var DEFAULT_GREETING = 'How can I help you?';

  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
  var synth = window.speechSynthesis;

  // Voices load asynchronously in some browsers; prefer an English one when available.
  function pickVoice() {
    var voices = synth.getVoices();
    for (var i = 0; i < voices.length; i++) {
      if (/^en(-|_|$)/i.test(voices[i].lang) && voices[i].localService) return voices[i];
    }
    for (var j = 0; j < voices.length; j++) {
      if (/^en/i.test(voices[j].lang)) return voices[j];
    }
    return null;
  }

  function speak(text) {
    try {
      synth.cancel();
      var utterance = new SpeechSynthesisUtterance(text);
      var voice = pickVoice();
      if (voice) utterance.voice = voice;
      utterance.lang = voice ? voice.lang : 'en-US';
      utterance.rate = 1;
      utterance.pitch = 1;
      synth.speak(utterance);
    } catch (e) { /* speech unavailable: the chat panel still shows the greeting */ }
  }

  document.addEventListener('wa-chat:open', function (e) {
    speak((e.detail && e.detail.greeting) || DEFAULT_GREETING);
  });
  document.addEventListener('wa-chat:close', function () {
    synth.cancel();
  });
})();
