/* ==========================================================================
   Portal hero — through the O of KOMME
   ==========================================================================
   We enter through the O in KOMME because "Ich komme" — "I'm coming" — is the
   song that carried her from the tango pavilion to the Eurovision final. The
   title is an arrival; the letter is the door.

   The first screen is the pavilion: her merch lockup, ICH over KOMME, painted
   in pine on cream. Behind the counter of the O the club is already lit, and
   the only sign of life is that light flickering through the letter. Then the
   camera goes through it and lands on the Basel stage.

   Motion is tango, not a glide: slow, slow, quick-quick, slow. Two beats of
   approach, an accelerating attack through the letter that stops dead with no
   easing tail, then a held landing. That is the same character as the rest of
   the site (DESIGN.md), not a borrowed "cinematic zoom".

   Architecture follows what survives iOS Safari: the mark is plain vector
   paths moved by an attribute transform, the window onto the stage is a div
   cut with a CSS polygon() that tracks the counter every frame, and nothing
   uses SVG clipPath or mask. Touch devices play a timed sting and hold the page
   still only while the dive runs; mice and trackpads scrub with the wheel.
   Reduced motion keeps the dive and drops only the flicker.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.min(b, Math.max(a, v)); };
  var smooth = function (a, b, v) { var t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var inOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var tryPlay = function (v) { var p = v.play && v.play(); if (p && p.catch) p.catch(function () {}); };

  /* ---- geometry, in the mark's own units (see the SVG in index.html) ---- */
  var LOGO = { cx: 291, cy: 137, w: 582, h: 274 };
  /* the counter of the O: a rounded rectangle, centre and half-extents */
  var PORTAL = { x: 163, y: 224, hw: 21, hh: 24, r: 16 };
  var HOLD = 1200;           // under the 1.5 s ceiling
  var DIVE = 2200;
  var AUTO_END = 0.82;
  var LOGO_FIT = { vw: 0.86, vh: 0.42, max: 620 };
  var LOGO_Y = 0.5;

  var hero = $('[data-hero]');
  if (!hero) return;
  var stage = $('[data-hero-stage]', hero);
  var svgs = $$('[data-hero-logo]', hero);
  var zooms = svgs.map(function (s) { return $('[data-zoom]', s); });
  var win = $('[data-hero-window]', hero);
  var media = $('[data-hero-media]', hero);
  var shade = $('[data-hero-shade]', hero);
  var intro = $('[data-hero-intro]', hero);
  var copy = $('[data-hero-copy]', hero);

  var touchMode = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (touchMode) hero.classList.add('portal--auto');

  /* ---- tango: slow, slow, quick-quick, slow ----
     Half the dive creeps a sixth of the way in; the next third attacks the
     rest on an accelerating curve and stops at full speed — the arrest — and
     the last sixth holds, open, while the stage settles. */
  function tango(zp) {
    if (zp < 0.5) return 0.16 * inOut(zp / 0.5);
    if (zp < 0.84) { var q = (zp - 0.5) / 0.34; return 0.16 + 0.84 * q * q * q; }
    return 1;
  }

  /* A rounded rectangle as a polygon, in screen pixels. polygon() is the one
     clip shape that behaves the same on old iOS and accepts points far outside
     the element, which the window needs as it grows past the screen. */
  function roundedRect(cx, cy, hw, hh, r) {
    r = Math.min(r, hw, hh);
    var corners = [
      [cx + hw - r, cy - hh + r, -90], [cx + hw - r, cy + hh - r, 0],
      [cx - hw + r, cy + hh - r, 90], [cx - hw + r, cy - hh + r, 180]
    ];
    var pts = [], N = 6;
    for (var c = 0; c < 4; c++) {
      for (var k = 0; k <= N; k++) {
        var a = (corners[c][2] + 90 * k / N) * Math.PI / 180;
        pts.push((corners[c][0] + r * Math.cos(a)).toFixed(1) + 'px ' +
                 (corners[c][1] + r * Math.sin(a)).toFixed(1) + 'px');
      }
    }
    return 'polygon(' + pts.join(',') + ')';
  }

  function inside(px, py, cx, cy, hw, hh, r) {
    var dx = Math.abs(px - cx), dy = Math.abs(py - cy);
    if (dx > hw || dy > hh) return false;
    if (dx <= hw - r || dy <= hh - r) return true;
    var ex = dx - (hw - r), ey = dy - (hh - r);
    return ex * ex + ey * ey <= r * r;
  }

  var g = null;
  function layout() {
    var vw = stage.clientWidth || window.innerWidth;
    var vh = stage.clientHeight || window.innerHeight;
    svgs.forEach(function (s) { s.setAttribute('viewBox', '0 0 ' + vw + ' ' + vh); });
    var base = Math.min(vw * LOGO_FIT.vw, vh * LOGO_FIT.vh * (LOGO.w / LOGO.h), LOGO_FIT.max) / LOGO.w;
    var cx = vw / 2, cy = vh * LOGO_Y;
    var p0 = { x: cx + (PORTAL.x - LOGO.cx) * base, y: cy + (PORTAL.y - LOGO.cy) * base };
    var slack = PORTAL.r * 0.3;
    var sNeed = Math.max((vw / 2) / (PORTAL.hw - slack), (vh / 2) / (PORTAL.hh - slack)) * 1.1;
    g = {
      vw: vw, vh: vh, base: base, p0: p0, zEnd: sNeed / base, open: null,
      top: hero.getBoundingClientRect().top + window.scrollY,
      range: Math.max(1, hero.offsetHeight - vh)
    };
  }

  /* ---- time, and the hold on scrolling ---- */
  var autoStart = null, raf = 0, locked = false, lockTimer = 0;
  function autoP() { return autoStart === null ? 0 : AUTO_END * clamp((performance.now() - autoStart) / DIVE); }
  function block(e) { if (e.cancelable) e.preventDefault(); }
  function setLock(on) {
    if (!touchMode || on === locked) return;
    locked = on;
    document.documentElement.classList.toggle('portal-locked', on);
    if (on) {
      window.addEventListener('touchmove', block, { passive: false });
      clearTimeout(lockTimer);
      /* never outlive the dive, whatever else goes wrong */
      lockTimer = setTimeout(function () { setLock(false); }, DIVE + 900);
    } else {
      window.removeEventListener('touchmove', block, { passive: false });
      clearTimeout(lockTimer);
    }
  }
  function arrivedMidPage() { return window.scrollY > g.vh * 0.6; }

  /* The still mark hands over to the vector the instant anything moves. Both
     are the same artwork on the same geometry, so the swap is invisible. */
  var still = $('.portal__still', hero);
  function dropStill() { if (still) { still.remove(); still = null; } }

  function render() {
    var scrollP = touchMode ? 0 : clamp((window.scrollY - g.top) / g.range);
    var p = Math.max(autoP(), scrollP);
    var zp = clamp((p - 0.03) / 0.61);
    var zf = tango(zp);
    var s = g.base * Math.pow(g.zEnd, zf);
    var t = inOut(Math.min(1, zf * 1.15));
    var x = lerp(g.p0.x, g.vw / 2, t), y = lerp(g.p0.y, g.vh / 2, t);
    var hw = PORTAL.hw * s, hh = PORTAL.hh * s, R = PORTAL.r * s;

    var open = inside(0, 0, x, y, hw, hh, R) && inside(g.vw, 0, x, y, hw, hh, R) &&
               inside(0, g.vh, x, y, hw, hh, R) && inside(g.vw, g.vh, x, y, hw, hh, R);
    if (open !== g.open) {
      g.open = open;
      svgs.forEach(function (el) { el.style.visibility = open ? 'hidden' : ''; });
      win.classList.toggle('is-open', open);
      if (open) { win.style.webkitClipPath = ''; win.style.clipPath = ''; }
    }
    if (!open) {
      var tr = 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ') scale(' + s.toFixed(4) +
               ') translate(' + (-PORTAL.x) + ' ' + (-PORTAL.y) + ')';
      zooms.forEach(function (z) { z.setAttribute('transform', tr); });
      var clip = roundedRect(x, y, hw, hh, R);
      win.style.webkitClipPath = clip;
      win.style.clipPath = clip;
    }

    if (p > 0.001) dropStill();
    intro.style.opacity = String(1 - smooth(0, 0.1, p));
    /* stepping inside: the stage pulls back as the door opens */
    media.style.transform = 'scale(' + (1.4 - 0.4 * zf).toFixed(4) + ')';
    shade.style.opacity = String(smooth(0.5, 0.78, p));
    var c = smooth(0.6, 0.8, p);
    copy.style.opacity = String(c);
    copy.classList.toggle('is-live', c > 0.6);
    hero.classList.toggle('is-landed', c > 0.6);
  }

  function tick() {
    var el = autoStart === null ? -1 : performance.now() - autoStart;
    if (el < DIVE && arrivedMidPage()) { autoStart = performance.now() - DIVE; el = DIVE; }
    stage.classList.toggle('is-holding', el < 0);
    setLock(el >= 0 && el < DIVE);
    render();
    raf = el < DIVE ? requestAnimationFrame(tick) : 0;
  }
  function start(delay) {
    var at = performance.now() + (delay || 0);
    if (autoStart === null || (performance.now() < autoStart && at < autoStart)) autoStart = at;
    if (!raf) raf = requestAnimationFrame(tick);
  }

  layout();
  stage.classList.add('is-holding');
  render();
  start(HOLD);

  /* The first touch, wheel, key or scroll starts the dive at once. On touch it
     also takes the hold immediately, in the same event, so the fling that
     follows this touchstart cannot slip a few hundred pixels before the next
     animation frame gets round to it. */
  function eager(e) {
    if (touchMode && e.type === 'touchstart' && !arrivedMidPage() &&
        (autoStart === null || performance.now() - autoStart < DIVE)) {
      setLock(true);
    }
    start(0);
  }
  ['touchstart', 'wheel', 'keydown', 'scroll'].forEach(function (ev) {
    window.addEventListener(ev, eager, { passive: true, once: true });
  });

  /* iOS Low Power Mode refuses muted autoplay until there has been a gesture */
  function wake() { $$('video', stage).forEach(function (v) { if (v.currentSrc || v.src) tryPlay(v); }); }
  window.addEventListener('touchstart', wake, { passive: true, once: true });
  window.addEventListener('scroll', wake, { passive: true, once: true });

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; render(); });
  }, { passive: true });
  window.addEventListener('resize', function () { layout(); render(); });
  window.addEventListener('load', function () { layout(); render(); });

  var replay = $('[data-replay]', hero);
  if (replay) {
    replay.addEventListener('click', function () {
      window.scrollTo(0, g.top);
      autoStart = performance.now() + 700;
      stage.classList.add('is-holding');
      if (!raf) raf = requestAnimationFrame(tick);
    });
  }

  /* the triptych only on screens wide enough to show it */
  if (window.matchMedia('(min-width: 900px)').matches) {
    $$('[data-side]', hero).forEach(function (img) {
      if (img.getAttribute('data-src')) img.src = img.getAttribute('data-src');
    });
  }
})();
