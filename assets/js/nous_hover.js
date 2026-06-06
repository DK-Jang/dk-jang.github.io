/**
 * nous_hover.js
 * Hover interactions for the Nous Research / Hermes Agent inspired theme.
 *
 * 1. Nav "Scramble" — a faithful port of the Hermes Scramble component. On
 *    hover a pulse ripples from the centre of the label outward, swapping
 *    glyphs from a fixed dither charset for ~666ms before settling back.
 *    Bound on both mouseenter and pointerenter for cross-browser reliability.
 *
 * 2. Portrait cyberpunk glitch — on hover the about portrait flips to a
 *    neon cyan/magenta duotone with an RGB channel-split glitch, scanlines
 *    and a subtle ordered-dither grain. Rendered to a canvas overlay.
 *
 * No external dependencies. Respects prefers-reduced-motion.
 */
(function () {
  'use strict';

  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------------------- *
   * 1. SCRAMBLE  (port of the Hermes Scramble component)
   * ----------------------------------------------------------------------- */
  var CHARSET = '.,\u00b7-\u2500~+:;=*\u03c0\u201c\u201d\u2510\u250c\u2518\u2534\u252c\u2557\u2554\u255d\u255a\u256c\u2560\u2563\u2569\u2566\u2551\u2591\u2592\u2593\u2588\u2584\u2580\u258c\u2590\u25a0!?&#$@0123456789*';

  function attachScramble(trigger, textEl, opts) {
    opts = opts || {};
    var dur = opts.dur || 666;
    var spread = opts.spread || 1;
    var text = textEl.textContent;
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

    // Bind on multiple entry events for cross-browser reliability. Guard
    // against double-fire within the same tick.
    var lastFire = 0;
    function guarded() {
      var t = Date.now();
      if (t - lastFire < 80) return;
      lastFire = t;
      onEnter();
    }
    trigger.addEventListener('mouseenter', guarded);
    trigger.addEventListener('pointerenter', guarded);
    trigger.addEventListener('focus', guarded);
  }

  function initScramble() {
    if (REDUCED) return;
    var links = document.querySelectorAll('.navbar .nav-link');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (link.getAttribute('data-scramble') === 'on') continue;
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
      // Let pointer events pass through the span to the .nav-link trigger.
      span.style.pointerEvents = 'none';
      span.textContent = textNode.textContent.trim();
      link.replaceChild(span, textNode);
      link.setAttribute('data-scramble', 'on');
      attachScramble(link, span);
    }
  }

  /* ----------------------------------------------------------------------- *
   * 2. PORTRAIT CYBERPUNK GLITCH
   * ----------------------------------------------------------------------- */
  var BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  // Neon duotone endpoints (shadow -> highlight): deep indigo to cyan,
  // with a magenta mid-tint applied via channel split.
  function buildCyberpunk(img, container) {
    var w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return;
    var scale = Math.min(1, 320 / w);
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));

    var src = document.createElement('canvas');
    src.width = cw; src.height = ch;
    var sctx = src.getContext('2d');
    try { sctx.drawImage(img, 0, 0, cw, ch); }
    catch (e) { return; }
    var data;
    try { data = sctx.getImageData(0, 0, cw, ch); }
    catch (e) { return; }
    var px = data.data;

    // Neon duotone + ordered-dither grain.
    // shadow color  (cyberpunk indigo/near-black blue)
    var sR = 10, sG = 8, sB = 28;
    // highlight color (electric cyan)
    var hR = 40, hG = 250, hB = 255;
    for (var y = 0; y < ch; y++) {
      for (var x = 0; x < cw; x++) {
        var o = (y * cw + x) * 4;
        var lum = (0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2]) / 255;
        // ordered-dither perturbation
        var t = (BAYER[y & 3][x & 3] + 0.5) / 16 - 0.5;
        var L = Math.max(0, Math.min(1, lum + t * 0.18));
        // gamma punch for contrast
        L = Math.pow(L, 0.78);
        px[o]     = Math.round(sR + (hR - sR) * L);
        px[o + 1] = Math.round(sG + (hG - sG) * L);
        px[o + 2] = Math.round(sB + (hB - sB) * L);
      }
    }
    sctx.putImageData(data, 0, 0);

    var out = document.createElement('canvas');
    out.width = cw; out.height = ch;
    out.className = 'portrait-cyber';
    var octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;

    // Chromatic aberration: sample R from a left-shifted copy and B from a
    // right-shifted copy of the duotone, leaving G in place. This produces
    // the classic cyan / magenta RGB-split fringe of cyberpunk visuals.
    var base = data;            // duotone pixels
    var bp = base.data;
    var aberr = octx.createImageData(cw, ch);
    var ap = aberr.data;
    var shift = Math.max(2, Math.round(cw * 0.018));
    for (var yy = 0; yy < ch; yy++) {
      for (var xx = 0; xx < cw; xx++) {
        var oo = (yy * cw + xx) * 4;
        var xr = Math.min(cw - 1, xx + shift);   // red shifted right
        var xb = Math.max(0, xx - shift);        // blue shifted left
        ap[oo]     = bp[(yy * cw + xr) * 4];      // R
        ap[oo + 1] = bp[oo + 1];                  // G
        ap[oo + 2] = bp[(yy * cw + xb) * 4 + 2];  // B
        ap[oo + 3] = 255;
      }
    }
    octx.putImageData(aberr, 0, 0);

    // Add a faint magenta wash on the highlights for extra neon punch.
    octx.globalCompositeOperation = 'screen';
    octx.globalAlpha = 0.18;
    octx.fillStyle = 'rgb(255,0,200)';
    octx.fillRect(0, 0, cw, ch);
    octx.globalAlpha = 1;
    octx.globalCompositeOperation = 'source-over';

    container.appendChild(out);
  }

  function initPortrait() {
    if (REDUCED) return;
    var containers = document.querySelectorAll('.hermes-about-portrait');
    for (var i = 0; i < containers.length; i++) {
      (function (container) {
        var img = container.querySelector('img');
        if (!img) return;
        container.classList.add('cyber-ready');
        function go() { buildCyberpunk(img, container); }
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
