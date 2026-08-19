/* ==========================================================================
   Erika Vikman — site behaviour
   Two tiers. When GSAP + ScrollTrigger load (CDN, deferred just before this
   file), they choreograph the page: hero intro, scroll parallax, word
   reveals, velocity-reactive marquee, custom cursor. When they don't —
   blocked CDN, save-data, reduced motion — the site falls back to the
   lightweight IntersectionObserver reveal and stays fully usable.
   ========================================================================== */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var useGsap = !!(window.gsap && window.ScrollTrigger) && !reduceMotion;

  /* ---- elements ---- */
  var progressBar = document.querySelector('.scroll-progress');
  var nav = document.querySelector('.nav');
  var navLinks = document.querySelector('.nav-links');
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));

  /* ================= shared scroll pass (progress bar + nav) ============= */
  var lastY = 0;
  var ticking = false;

  function scrollPass() {
    ticking = false;
    var doc = document.documentElement;
    var y = doc.scrollTop;
    var max = doc.scrollHeight - doc.clientHeight;

    if (progressBar) {
      progressBar.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    }
    if (nav) {
      nav.classList.toggle('is-scrolled', y > 40);
      var menuOpen = navLinks && navLinks.classList.contains('open');
      if (!menuOpen) {
        if (y > lastY + 6 && y > 320) nav.classList.add('nav-hidden');
        else if (y < lastY - 6 || y <= 320) nav.classList.remove('nav-hidden');
      }
    }
    if (!useGsap) sweepSkipped();
    lastY = y;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(scrollPass);
  }
  document.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  /* ================= fallback reveal (no GSAP) =========================== */
  var pending = new Set();
  var io = null;

  function ioShow(el) {
    el.style.opacity = '1';
    el.style.transform = 'none';
    pending.delete(el);
    if (io) io.unobserve(el);
  }

  // A fast jump (scroll restoration, anchor, End key) can carry a section
  // from below the viewport to above it with the intersection ratio never
  // leaving 0 — no callback fires, the section stays hidden. Sweep them.
  function sweepSkipped() {
    if (!pending.size) return;
    pending.forEach(function (el) {
      if (el.getBoundingClientRect().bottom < 0) ioShow(el);
    });
  }

  if (!useGsap && !reduceMotion && revealEls.length && 'IntersectionObserver' in window) {
    revealEls.forEach(function (el) { pending.add(el); });
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) ioShow(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
      io.observe(el);
    });
  }

  /* ================= mobile nav ========================================= */
  var navToggle = document.querySelector('.nav-toggle');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ================= active nav link ==================================== */
  var current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href === current || (current === '' && href === 'index.html')) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });

  /* ================= streaming embed facades ============================ */
  document.querySelectorAll('[data-embed]').forEach(function (facade) {
    facade.addEventListener('click', function () {
      var frame = document.createElement('iframe');
      frame.src = facade.getAttribute('data-embed');
      frame.title = facade.getAttribute('data-embed-title') || 'Embedded player';
      frame.loading = 'lazy';
      frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      frame.setAttribute('allowfullscreen', '');
      frame.style.cssText = 'width:100%;height:100%;border:0;display:block;';
      facade.replaceWith(frame);
    });
  });

  /* ================= gallery lightbox ===================================
     Moves through the whole archive: arrows, keyboard, caption and count.
     Opening a photo used to be a dead end — you had to close and reopen to
     reach the next one. */
  var lightbox = document.querySelector('.lightbox');
  if (lightbox) {
    var tiles = Array.prototype.slice.call(document.querySelectorAll('.gallery-item'));
    var lightboxImg = lightbox.querySelector('img');
    var closeBtn = lightbox.querySelector('.lightbox-close');
    var prevBtn = lightbox.querySelector('.lightbox-prev');
    var nextBtn = lightbox.querySelector('.lightbox-next');
    var capEl = lightbox.querySelector('.lightbox-cap');
    var countEl = lightbox.querySelector('.lightbox-count');
    var lastFocused = null;
    var index = 0;

    function render(i) {
      index = (i + tiles.length) % tiles.length;
      var tile = tiles[index];
      var img = tile.querySelector('img');
      if (!img) return;
      lightboxImg.src = img.currentSrc || img.src;
      lightboxImg.alt = img.alt;
      var cap = tile.querySelector('.gallery-caption');
      if (capEl) capEl.textContent = cap ? cap.textContent : '';
      if (countEl) countEl.textContent = (index + 1) + ' / ' + tiles.length;
    }

    function openAt(i, origin) {
      lastFocused = origin || null;
      render(i);
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
      if (closeBtn) closeBtn.focus();
    }

    function closeLb() {
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      lightboxImg.src = '';
      if (lastFocused) lastFocused.focus();
    }

    tiles.forEach(function (tile, i) {
      tile.addEventListener('click', function () { openAt(i, tile); });
    });

    if (closeBtn) closeBtn.addEventListener('click', closeLb);
    if (prevBtn) prevBtn.addEventListener('click', function () { render(index - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { render(index + 1); });

    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLb();
    });

    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') { closeLb(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); render(index - 1); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); render(index + 1); return; }
      if (e.key === 'Tab') {
        // keep focus inside the dialog
        var focusables = [prevBtn, nextBtn, closeBtn].filter(Boolean);
        if (!focusables.length) return;
        var at = focusables.indexOf(document.activeElement);
        e.preventDefault();
        var step = e.shiftKey ? -1 : 1;
        focusables[(at + step + focusables.length) % focusables.length].focus();
      }
    });

    // swipe on touch
    var touchX = null;
    lightbox.addEventListener('touchstart', function (e) {
      touchX = e.changedTouches[0].clientX;
    }, { passive: true });
    lightbox.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 45) render(index + (dx < 0 ? 1 : -1));
      touchX = null;
    }, { passive: true });
  }

  /* ================= GSAP choreography ================================== */
  if (!useGsap) return;

  document.documentElement.classList.add('gsap');
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out', duration: 1 });

  /* ---- hero: split the title into lines/chars and run the opening ---- */
  var heroTitle = document.querySelector('.hero-title');
  var hero = document.querySelector('.hero');
  if (hero && heroTitle) {
    var lines = [];
    var currentLine = document.createElement('span');
    currentLine.className = 'ht-line';
    Array.prototype.slice.call(heroTitle.childNodes).forEach(function (node) {
      if (node.nodeName === 'BR') {
        lines.push(currentLine);
        currentLine = document.createElement('span');
        currentLine.className = 'ht-line';
      } else if (node.nodeType === 3) {
        node.textContent.split('').forEach(function (ch) {
          if (ch.trim() === '') {
            currentLine.appendChild(document.createTextNode(' '));
          } else {
            var s = document.createElement('span');
            s.className = 'ht-char';
            s.textContent = ch;
            currentLine.appendChild(s);
          }
        });
      }
    });
    lines.push(currentLine);
    // textContent drops the <br>, which ran the two lines together into
    // "ERIKAVIKMAN" for screen readers. Rebuild the label from the lines.
    heroTitle.setAttribute('aria-label',
      lines.map(function (l) { return l.textContent.trim(); }).filter(Boolean).join(' '));
    heroTitle.innerHTML = '';
    lines.forEach(function (l) { heroTitle.appendChild(l); });
    heroTitle.querySelectorAll('.ht-line').forEach(function (l) {
      l.setAttribute('aria-hidden', 'true');
    });

    var heroBg = hero.querySelector('.hero-bg img');
    var intro = gsap.timeline();
    if (heroBg) {
      intro.fromTo(heroBg, { scale: 1.16 }, { scale: 1, duration: 2.2, ease: 'power2.out' }, 0);
    }
    intro.fromTo('.hero-title .ht-char',
      { yPercent: 118, rotate: 5 },
      { yPercent: 0, rotate: 0, duration: 1.1, ease: 'power4.out', stagger: 0.04 }, 0.25);
    intro.fromTo('.hero-meta', { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8 }, 0.7);
    intro.fromTo('.hero-sub', { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8 }, 0.85);
    intro.fromTo('.hero-actions', { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8 }, 1.0);
    intro.fromTo('.hero-scroll', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, 1.3);

    // The intro hides this copy before revealing it, so any failure to finish
    // would leave the hero blank. If the page has been visible long enough
    // for the timeline to have run and it hasn't, show the copy outright.
    // (A backgrounded tab pauses rAF, which is why visibility is checked
    // rather than time alone.)
    var heroSafety = setTimeout(function () {
      if (document.visibilityState === 'visible' && intro.progress() < 0.9) {
        gsap.set(['.hero-meta', '.hero-sub', '.hero-actions', '.hero-scroll'],
          { clearProps: 'opacity,visibility' });
        gsap.set('.hero-title .ht-char', { clearProps: 'transform' });
      }
    }, 6000);
    intro.eventCallback('onComplete', function () { clearTimeout(heroSafety); });

    /* hero parallax on the way out */
    if (heroBg) {
      gsap.to(heroBg, {
        yPercent: 14,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
      });
    }
    gsap.to('.hero-content', {
      yPercent: -10,
      autoAlpha: 0.15,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: '75% top', scrub: true }
    });
  }

  /* ---- marquee reacts to scroll velocity ---- */
  var marqueeTrack = document.querySelector('.marquee-track');
  if (marqueeTrack) {
    var skewTo = gsap.quickTo(marqueeTrack, 'skewX', { duration: 0.4, ease: 'power2.out' });
    ScrollTrigger.create({
      onUpdate: function (self) {
        var v = gsap.utils.clamp(-8, 8, self.getVelocity() / -280);
        skewTo(v);
      }
    });
    gsap.ticker.add(function () { skewTo(0); });
  }

  /* ---- section reveals ----
     One curve applied everywhere reads as "animation was added" rather than
     choreographed, so a section's weight picks its entrance: loud panels
     arrive with a push, quiet ones simply settle. */
  if (revealEls.length) {
    gsap.set(revealEls, { y: 44, autoAlpha: 0 });
    ScrollTrigger.batch(revealEls, {
      start: 'top 86%',
      once: true,
      onEnter: function (batch) {
        batch.forEach(function (el, i) {
          var loud = el.closest('.sec-loud, .komme, .big-feature');
          gsap.to(el, {
            y: 0,
            autoAlpha: 1,
            duration: loud ? 1.15 : 0.85,
            ease: loud ? 'expo.out' : 'power2.out',
            delay: i * (loud ? 0.06 : 0.1),
            overwrite: true,
            clearProps: 'transform'
          });
        });
      }
    });
    // sections above the fold on load (or after scroll restoration) must not
    // wait for a scroll event
    ScrollTrigger.refresh();
  }

  /* ---- section titles: per-word rise ---- */
  document.querySelectorAll('.section-title').forEach(function (title) {
    var frag = document.createDocumentFragment();
    function wrapWords(node, target) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              target.appendChild(document.createTextNode(' '));
            } else {
              var m = document.createElement('span');
              m.className = 'wm';
              var i = document.createElement('span');
              i.className = 'wi';
              i.textContent = part;
              m.appendChild(i);
              target.appendChild(m);
            }
          });
        } else if (child.nodeName === 'BR') {
          target.appendChild(document.createElement('br'));
        } else {
          var clone = child.cloneNode(false);
          clone.innerHTML = '';
          wrapWords(child, clone);
          target.appendChild(clone);
        }
      });
    }
    wrapWords(title, frag);
    title.innerHTML = '';
    title.appendChild(frag);

    var words = title.querySelectorAll('.wi');
    gsap.set(words, { yPercent: 115 });
    gsap.to(words, {
      yPercent: 0,
      duration: 0.9,
      ease: 'power4.out',
      stagger: 0.07,
      scrollTrigger: { trigger: title, start: 'top 88%', once: true }
    });
  });

  /* ---- imagery: settle-in scale + banner parallax ---- */
  gsap.utils.toArray('.split-media img').filter(function (img) {
    return !img.closest('.banner-par'); // the banner has its own parallax
  }).forEach(function (img) {
    gsap.fromTo(img, { scale: 1.12 }, {
      scale: 1, duration: 1.4, ease: 'power2.out',
      scrollTrigger: { trigger: img, start: 'top 88%', once: true }
    });
  });
  var banner = document.querySelector('.banner-par');
  if (banner) {
    var bImg = banner.querySelector('img');
    gsap.fromTo(bImg, { yPercent: -10 }, {
      yPercent: 10, ease: 'none',
      scrollTrigger: { trigger: banner, start: 'top bottom', end: 'bottom top', scrub: true }
    });
    gsap.set(bImg, { scale: 1.22 });
  }

  /* ---- the big 25 drifts against scroll ---- */
  var bigNum = document.querySelector('.big-num');
  if (bigNum) {
    gsap.fromTo(bigNum, { yPercent: 16 }, {
      yPercent: -16, ease: 'none',
      scrollTrigger: { trigger: '.big-feature', start: 'top bottom', end: 'bottom top', scrub: 1 }
    });
  }

  /* ---- gallery tiles cascade in ---- */
  var tiles = gsap.utils.toArray('.gallery-grid .gallery-item');
  if (tiles.length) {
    gsap.set(tiles, { y: 32, autoAlpha: 0 });
    ScrollTrigger.batch(tiles, {
      start: 'top 92%',
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.07, overwrite: true });
      }
    });
  }

  /* ---- pinned horizontal rail ----
     The page's one sustained, scroll-controlled moment: the section holds
     while the archive travels sideways. ease "none" is required so scroll
     distance maps 1:1 to horizontal position. */
  var rail = document.querySelector('.rail');
  var railTrack = rail && rail.querySelector('.rail-track');
  if (rail && railTrack) {
    var progFill = rail.querySelector('.rail-prog span');

    var railTween = gsap.to(railTrack, {
      x: function () {
        return Math.min(0, rail.offsetWidth - railTrack.scrollWidth);
      },
      ease: 'none',
      scrollTrigger: {
        trigger: rail,
        pin: true,
        scrub: 0.8,
        start: 'top top',
        end: function () {
          return '+=' + Math.max(1, railTrack.scrollWidth - rail.offsetWidth);
        },
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          if (progFill) progFill.style.transform = 'scaleX(' + self.progress + ')';
        }
      }
    });

    // Cards lift in as they cross the middle of the pinned viewport.
    gsap.utils.toArray('.rail-item').forEach(function (card) {
      gsap.from(card, {
        y: 46,
        autoAlpha: 0,
        duration: 0.6,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: card,
          containerAnimation: railTween,
          start: 'left 92%',
          once: true
        }
      });
    });
  }

  /* ---- cursor: the microphone ----
     Her prop, abstracted. The brass head tracks the pointer with a little
     weight; the shaft lags further behind and turns to face where the
     pointer came from, so moving the mouse drags the stand round after it
     and it settles when you stop. */
  if (window.matchMedia('(pointer: fine)').matches) {
    var mic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mic.setAttribute('class', 'cursor-mic');
    mic.setAttribute('viewBox', '0 0 196 58');
    mic.setAttribute('aria-hidden', 'true');
    // The real rig is a T: the mic head stands perpendicular at one end of a
    // long boom, and the far end is a bell that throws sparks. Drawn as
    // outline and haze rather than an illustration — it should read as a
    // trace the pointer leaves, not a picture stuck to it.
    mic.innerHTML = [
      '<defs>',
      '  <linearGradient id="micGlass" x1="0" y1="0" x2="0" y2="1">',
      '    <stop offset="0" stop-color="#ffdf94" stop-opacity="0.55"/>',
      '    <stop offset="0.5" stop-color="#e2b95f" stop-opacity="0.22"/>',
      '    <stop offset="1" stop-color="#ffdf94" stop-opacity="0.40"/>',
      '  </linearGradient>',
      '  <linearGradient id="micFade" x1="1" y1="0" x2="0" y2="0">',
      '    <stop offset="0" stop-color="#ffdf94" stop-opacity="0.6"/>',
      '    <stop offset="0.55" stop-color="#ffdf94" stop-opacity="0.3"/>',
      '    <stop offset="1" stop-color="#ffdf94" stop-opacity="0.05"/>',
      '  </linearGradient>',
      '  <radialGradient id="micFlame" cx="0.85" cy="0.5" r="0.7">',
      '    <stop offset="0" stop-color="#fff0c4" stop-opacity="0.65"/>',
      '    <stop offset="0.4" stop-color="#ff9a3c" stop-opacity="0.30"/>',
      '    <stop offset="1" stop-color="#ff2d55" stop-opacity="0"/>',
      '  </radialGradient>',
      '</defs>',

      // spark plume off the bell — density rides on pointer speed
      '<g class="sparks">',
      '  <ellipse cx="20" cy="34" rx="26" ry="9" fill="url(#micFlame)"/>',
      '  <circle class="sp" cx="26" cy="31" r="0.9"/>',
      '  <circle class="sp" cx="18" cy="37" r="0.7"/>',
      '  <circle class="sp" cx="11" cy="32" r="1.0"/>',
      '  <circle class="sp" cx="30" cy="38" r="0.6"/>',
      '  <circle class="sp" cx="5"  cy="36" r="0.8"/>',
      '  <circle class="sp" cx="23" cy="27" r="0.6"/>',
      '  <circle class="sp" cx="13" cy="41" r="0.7"/>',
      '</g>',

      // the boom, fading out toward the bell
      '<g class="shaft">',
      '  <path d="M40 30.6 L40 39.4 L30 44 L30 26 Z" fill="url(#micGlass)"',
      '        stroke="#ffdf94" stroke-opacity="0.35" stroke-width="0.7"/>',
      '  <rect x="40" y="31.4" width="118" height="4.2" rx="2.1" fill="url(#micFade)"/>',
      '  <rect x="40" y="31.4" width="118" height="4.2" rx="2.1" fill="none"',
      '        stroke="#ffdf94" stroke-opacity="0.30" stroke-width="0.6"/>',
      '  <rect x="152" y="28.4" width="9" height="10.2" rx="2.4" fill="url(#micGlass)"',
      '        stroke="#ffdf94" stroke-opacity="0.35" stroke-width="0.7"/>',
      '</g>',

      // the head, standing off the boom at a right angle
      '<g class="head">',
      '  <rect x="161.5" y="17" width="6.4" height="13" rx="2.6"',
      '        transform="rotate(14 164.7 23.5)" fill="url(#micGlass)"',
      '        stroke="#ffdf94" stroke-opacity="0.4" stroke-width="0.7"/>',
      '  <circle cx="168" cy="14" r="8.6" fill="url(#micGlass)"',
      '          stroke="#ffdf94" stroke-opacity="0.55" stroke-width="0.9"/>',
      '  <circle cx="168" cy="14" r="5.2" fill="none"',
      '          stroke="#ffdf94" stroke-opacity="0.28" stroke-width="0.6"/>',
      '  <circle cx="165.2" cy="11.4" r="1.9" fill="#fff6de" fill-opacity="0.45"/>',
      '</g>',
      '<circle class="halo" cx="168" cy="14" r="16" fill="none"',
      '        stroke="#ff2d55" stroke-opacity="0.7" stroke-width="1" opacity="0"/>'
    ].join('');
    document.body.appendChild(mic);
    document.documentElement.classList.add('cursor-on');

    // head keeps up; the shaft angle trails, which is what reads as weight
    var micX = gsap.quickTo(mic, 'x', { duration: 0.17, ease: 'power3.out' });
    var micY = gsap.quickTo(mic, 'y', { duration: 0.17, ease: 'power3.out' });
    var micRot = gsap.quickTo(mic, 'rotation', { duration: 0.5, ease: 'power2.out' });
    var micStretch = gsap.quickTo(mic, 'scaleX', { duration: 0.35, ease: 'power2.out' });

    var sparks = mic.querySelector('.sparks');
    var sparkTo = gsap.quickTo(sparks, 'opacity', { duration: 0.45, ease: 'power2.out' });
    gsap.set(sparks, { opacity: 0 });

    var prevX = null, prevY = null;
    var angle = -18;          // resting tilt, the way the rig hangs
    var idleTimer = null;

    window.addEventListener('pointermove', function (e) {
      var x = e.clientX, y = e.clientY;
      mic.classList.add('is-live');
      micX(x); micY(y);

      if (prevX !== null) {
        var dx = x - prevX, dy = y - prevY;
        var speed = Math.hypot(dx, dy);
        if (speed > 2.2) {
          // face where the pointer came from, so the boom drags behind
          var target = Math.atan2(dy, dx) * 180 / Math.PI;
          // unwrap so it swings the short way round instead of spinning
          while (target - angle > 180) target -= 360;
          while (target - angle < -180) target += 360;
          angle = target;
          micRot(angle);
          micStretch(1 + Math.min(speed / 220, 0.13));
        }
        // the bell only fires when the rig is actually being moved
        sparkTo(Math.min(speed / 34, 1));
      }
      prevX = x; prevY = y;

      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () {
        micStretch(1);
        sparkTo(0);
        var rest = angle - ((angle + 180) % 360 - 180) - 18;
        micRot(rest);
        angle = rest;
      }, 420);
    }, { passive: true });

    document.addEventListener('pointerover', function (e) {
      if (e.target.closest('a, button, [data-embed], .gallery-item, .rail-item')) {
        mic.classList.add('is-active');
      }
    });
    document.addEventListener('pointerout', function (e) {
      if (e.target.closest('a, button, [data-embed], .gallery-item, .rail-item')) {
        mic.classList.remove('is-active');
      }
    });
    document.documentElement.addEventListener('mouseleave', function () {
      mic.classList.remove('is-live');
    });
  }
})();
