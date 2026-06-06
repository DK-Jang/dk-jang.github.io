/**
 * nous_hover.js
 * Faithful vanilla-JS port of the Nous Research / Hermes Agent site hover effects.
 *
 * 1. Nav "Scramble" — on mouseenter a pulse is emitted from the centre of the
 *    label and ripples outward, replacing glyphs with a fixed dither charset for
 *    ~666ms before settling back to the original text. This is a 1:1 port of the
 *    algorithm shipped on hermes-agent.nousresearch.com (Scramble component).
 *
 * 2. Portrait dither — the about portrait reveals a monochrome ordered-dither
 *    (Bayer 4x4) rendition of the image on hover, matching the site's dither
 *    aesthetic, then crossfades back on leave.
 *
 * No external dependencies. Respects prefers-reduced-motion.
 */
(function () {
  'use strict';

  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------------------- *
   * 1. SCRAMBLE  (exact port of the Hermes Scramble component)
   * ----------------------------------------------------------------------- */
  // Charset lifted verbatim from the Hermes bundle.
  var CHARSET = '.,\u00b7-\u2500~+:;=*\u03c0\u201c\u201d\u2510\u250c\u2518\u2534\u252c\u2557\u2554\u255d\u255a\u256c\u2560\u2563\u2569\u2566\u2551\u2591\u2592\u2593\u2588\u2584\u2580\u258c\u2590\u25a0!?&#$@0123456789*';

  function attachScramble(trigger, textEl, opts) {
    opts = opts || {};
    var dur = opts.dur || 666;
    var spread = opts.spread || 1;
    var original = textEl.textContent;
    var text = original;
    var len = text.length;
    var raf = null;
    var pulses = [];

    function frame() {
      var now = Date.now();
      pulses = pulses.filter(function (p) { return now - p.time < dur; });
      if (!pulses.length) {
        textEl.textContent = text;
        raf = null;
        return;
      }
      var out = '';
      for (var idx = 0; idx < len; idx++) {
        var ch = text.charAt(idx);
        if (ch === ' ') { out += ch; continue; }
        var rendered = ch;
        for (var k = 0; k < pulses.length; k++) {
          var p = pulses[k];
          var i = now - p.time;
          var o = Math.min(i / dur, 1) *
            (Math.max(p.pos, len - p.pos - 1) + 5) / spread;
          var c = Math.abs(idx - p.pos);
          var d = o - c;
          if (c <= o && d > 0 && d <= 3) {
            rendered = CHARSET.charAt((3 * c + ((i / 40) | 0)) % CHARSET.length);
            break;
          }
        }
        out += rendered;
      }
      textEl.textContent = out;
      raf = requestAnimationFrame(frame);
    }

    function onEnter() {
      pulses.push({ pos: len >> 1, time: Date.now() });
      if (raf == null) raf = requestAnimationFrame(frame);
    }

    trigger.addEventListener('mouseenter', onEnter);
  }

  function initScramble() {
    if (REDUCED) return;
    var links = document.querySelectorAll('.navbar .nav-link');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (link.getAttribute('data-scramble') === 'on') continue;
      // Wrap the first meaningful text node so we only scramble the label,
      // leaving sr-only spans / carets / dropdown markup untouched.
      var textNode = null;
      for (var n = 0; n < link.childNodes.length; n++) {
        var node = link.childNodes[n];
        if (node.nodeType === 3 && node.textContent.trim().length) {
          textNode = node;
          break;
        }
      }
      if (!textNode) continue;
      var span = document.createElement('span');
      span.className = 'nav-scramble';
      span.textContent = textNode.textContent.trim();
      link.replaceChild(span, textNode);
      link.setAttribute('data-scramble', 'on');
      attachScramble(link, span);
    }
  }

  /* ----------------------------------------------------------------------- *
   * 2. PORTRAIT DITHER  (Bayer 4x4 ordered dither, monochrome)
   * ----------------------------------------------------------------------- */
  // Normalised 4x4 Bayer threshold matrix.
  var BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  function buildDither(img, container) {
    var w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return;
    // Cap working resolution; chunky dither reads better than fine grain.
    var scale = Math.min(1, 220 / w);
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));

    var src = document.createElement('canvas');
    src.width = cw; src.height = ch;
    var sctx = src.getContext('2d');
    try {
      sctx.drawImage(img, 0, 0, cw, ch);
    } catch (e) {
      return; // tainted canvas / not yet decoded
    }
    var data;
    try {
      data = sctx.getImageData(0, 0, cw, ch);
    } catch (e) {
      return;
    }
    var px = data.data;
    for (var y = 0; y < ch; y++) {
      for (var x = 0; x < cw; x++) {
        var o = (y * cw + x) * 4;
        // luminance
        var lum = 0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2];
        var t = (BAYER[y & 3][x & 3] + 0.5) / 16 * 255;
        var on = lum > t;
        // monochrome dither in the site's ink/paper tones
        var v = on ? 235 : 18;
        px[o] = v; px[o + 1] = v; px[o + 2] = v;
      }
    }
    sctx.putImageData(data, 0, 0);

    var out = document.createElement('canvas');
    out.width = cw; out.height = ch;
    out.className = 'portrait-dither';
    var octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    octx.drawImage(src, 0, 0);
    container.appendChild(out);
  }

  function initPortrait() {
    if (REDUCED) return;
    var containers = document.querySelectorAll('.hermes-about-portrait');
    for (var i = 0; i < containers.length; i++) {
      (function (container) {
        var img = container.querySelector('img');
        if (!img) return;
        function go() { buildDither(img, container); }
        if (img.complete && img.naturalWidth) go();
        else img.addEventListener('load', go);
      })(containers[i]);
    }
  }

  /* ----------------------------------------------------------------------- */
  function init() {
    initScramble();
    initPortrait();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
