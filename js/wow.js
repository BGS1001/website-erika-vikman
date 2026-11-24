/* ==========================================================================
   Responses — the site answering back
   ==========================================================================
   The door (js/portal.js) is still the one authored scene. Nothing here is a
   scene and nothing here animates content in: each piece is the site reacting
   to something the visitor did or reached, in her own vocabulary.

     arrival  -> fireworks, because what Basel got was a golden microphone
                 throwing fireworks over the arena
     scroll   -> KOMME fills, outline to solid, as the stage is crossed
     music    -> the club comes on: light from both sides, in her two colours
     pointer  -> latex catches the light, and photographs tilt under it

   All of it is decoration over finished pages. Without this file, or with
   reduced motion, every page reads exactly as it did.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* ---------------------------------------------------------- fireworks */
  var cv = null, ctx = null, dpr = 1, parts = [], raf = 0, last = 0;
  /* gold first: it is her microphone. The two lights are the minority. */
  var INK = ['#EBC86A', '#EBC86A', '#FFF3C4', '#FFF3C4', '#EBC86A', '#FF5AA8', '#5FD5DE'];

  function canvas() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.className = 'wow-fire';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    ctx = cv.getContext('2d');
    size();
    window.addEventListener('resize', size);
  }
  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(window.innerWidth * dpr);
    cv.height = Math.round(window.innerHeight * dpr);
  }
  function shell(x, y, count, power) {
    if (reduce) return;
    canvas();
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var v = power * (0.35 + Math.random() * 0.65);
      parts.push({
        x: x, y: y, px: x, py: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - power * 0.18,
        life: 1, fade: 0.38 + Math.random() * 0.34,
        c: INK[(Math.random() * INK.length) | 0],
        w: 1.4 + Math.random() * 2
      });
    }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.px = p.x; p.py = p.y;
      p.vx *= 1 - 1.6 * dt;
      p.vy = p.vy * (1 - 1.6 * dt) + 520 * dt;      /* sparks fall */
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= p.fade * dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.strokeStyle = p.c;
      ctx.lineWidth = p.w * dpr;
      ctx.beginPath();
      ctx.moveTo(p.px * dpr, p.py * dpr);
      ctx.lineTo(p.x * dpr, p.y * dpr);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (parts.length) raf = requestAnimationFrame(frame);
    else { raf = 0; ctx.clearRect(0, 0, cv.width, cv.height); }
  }
  var small = window.innerWidth < 700;

  /* arrival: three shells over the stage as the door lands on Basel */
  var hero = document.querySelector('[data-hero]');
  if (hero && !reduce && 'MutationObserver' in window) {
    var wasLanded = hero.classList.contains('is-landed');
    new MutationObserver(function () {
      var landed = hero.classList.contains('is-landed');
      if (landed && !wasLanded && window.scrollY < window.innerHeight * 0.6) {
        var w = window.innerWidth, h = window.innerHeight, n = small ? 64 : 130;
        [[0.24, 0.26, 0], [0.72, 0.2, 240], [0.5, 0.34, 520]].forEach(function (s) {
          setTimeout(function () { shell(w * s[0], h * s[1], n, small ? 430 : 680); }, s[2]);
        });
      }
      wasLanded = landed;
    }).observe(hero, { attributes: true, attributeFilter: ['class'] });
  }

  /* music: a burst from wherever the song was started */
  var tapX = -1, tapY = -1, tapAt = 0;
  document.addEventListener('pointerdown', function (e) {
    tapX = e.clientX; tapY = e.clientY; tapAt = performance.now();
  }, { passive: true });
  document.addEventListener('ev:play', function () {
    var recent = performance.now() - tapAt < 1500 && tapX >= 0;
    shell(recent ? tapX : window.innerWidth * 0.5, recent ? tapY : window.innerHeight * 0.8, small ? 44 : 80, small ? 320 : 440);
  });

  /* ------------------------------------------------- KOMME fills on scroll */
  var fill = document.querySelector('.komme-type .fill');
  var stage = document.querySelector('.komme-stage');
  if (fill && stage) {
    if (reduce) fill.style.setProperty('--k-fill', '100%');
    else {
      var ticking = false;
      var paint = function () {
        ticking = false;
        var r = stage.getBoundingClientRect(), vh = window.innerHeight;
        /* empty as the word comes in at the foot of the screen, full by the
           time it has risen to the upper third */
        var mid = r.top + r.height * 0.5;
        var p = clamp((vh * 0.95 - mid) / (vh * 0.6), 0, 1);
        fill.style.setProperty('--k-fill', (p * 100).toFixed(1) + '%');
      };
      window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; requestAnimationFrame(paint); }
      }, { passive: true });
      paint();
    }
  }

  /* -------------------------------------------------------- the club light */
  var club = document.createElement('div');
  club.className = 'club-light';
  club.setAttribute('aria-hidden', 'true');
  document.body.appendChild(club);

  /* --------------------------------------------- pointer: light, and tilt */
  if (fine && !reduce) {
    var light = document.createElement('div');
    light.className = 'latex-light';
    light.setAttribute('aria-hidden', 'true');
    document.body.appendChild(light);
    var lx = 0, ly = 0, lraf = 0;
    window.addEventListener('pointermove', function (e) {
      lx = e.clientX; ly = e.clientY;
      if (lraf) return;
      lraf = requestAnimationFrame(function () {
        lraf = 0;
        light.style.setProperty('--lx', lx + 'px');
        light.style.setProperty('--ly', ly + 'px');
        light.classList.add('is-on');
      });
    }, { passive: true });

    Array.prototype.forEach.call(document.querySelectorAll('.gallery-item'), function (tile) {
      tile.addEventListener('pointermove', function (e) {
        var r = tile.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
        tile.classList.add('is-tilting');
        tile.style.transform = 'perspective(900px) rotateX(' + (-ny * 7).toFixed(2) + 'deg) rotateY(' + (nx * 7).toFixed(2) + 'deg)';
        tile.style.setProperty('--gx', ((nx + 0.5) * 100).toFixed(1) + '%');
        tile.style.setProperty('--gy', ((ny + 0.5) * 100).toFixed(1) + '%');
      });
      tile.addEventListener('pointerleave', function () {
        tile.classList.remove('is-tilting');
        tile.style.transform = '';
      });
    });
  }
})();
