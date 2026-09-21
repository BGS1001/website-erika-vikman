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
    lastY = y;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(scrollPass);
  }
  document.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  /* ================= no entrance animations ============================
     There used to be a float-in for every block on the page, in two tiers —
     GSAP when it loaded, an IntersectionObserver copy when it did not. Both
     are gone: content is simply there. Motion on this site is spent on things
     that do work (the opening, the archive rail, the microphone) and on one
     authored moment, and a page where every paragraph drifts up to meet you
     has spent it on nothing. */

  /* ================= background video slot ==============================
     A section marked data-video="path/without/extension" upgrades its still
     to a muted looping video. Placement note: this deliberately is not the
     hero. The hero still is the LCP image, and a video that swaps in "once
     scrolling starts" would begin downloading at the exact moment the
     visitor first interacts — the worst moment on a phone, and phones are
     the primary surface here. The full-bleed banner sits below the fold,
     has no copy competing with it, and can buffer with runway to spare.

     Nothing is requested until the section is near the viewport, and the
     still remains underneath: if the file is missing or the browser refuses
     to play it, the page keeps the photograph and no one sees a gap. */
  document.querySelectorAll('[data-video]').forEach(function (host) {
    var base = host.getAttribute('data-video');
    var still = host.querySelector('img');
    if (!base || reduceMotion) return;
    var c = navigator.connection || {};
    if (c.saveData === true || /2g/.test(c.effectiveType || '')) return;

    var vid = document.createElement('video');
    vid.className = 'bg-video';
    vid.muted = true;
    vid.loop = true;
    vid.playsInline = true;
    vid.setAttribute('muted', '');
    vid.setAttribute('playsinline', '');
    vid.preload = 'none';
    vid.setAttribute('aria-hidden', 'true');
    vid.tabIndex = -1;
    if (still) vid.poster = still.currentSrc || still.src;

    vid.addEventListener('error', function () { vid.remove(); }, { once: true });
    // only reveal it once there are real frames to show, never on the poster
    vid.addEventListener('playing', function () { host.classList.add('video-on'); });

    ['webm', 'mp4'].forEach(function (ext) {
      var s = document.createElement('source');
      s.src = base + '.' + ext;
      s.type = ext === 'webm' ? 'video/webm' : 'video/mp4';
      vid.appendChild(s);
    });
    host.appendChild(vid);

    // a paused offscreen video still costs decode and battery
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          if (vid.preload === 'none') { vid.preload = 'auto'; vid.load(); }
          var p = vid.play();
          if (p && p.catch) p.catch(function () { /* autoplay refused; keep the still */ });
        } else {
          vid.pause();
        }
      });
    }, { rootMargin: '200px 0px' });
    seen.observe(host);
  });
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

  /* The Spotify panel lived here. It is replaced by js/media.js: the site's
     own jukebox and video player, so nothing sends a visitor elsewhere to
     listen or watch. */

  /* ================= GSAP choreography ==================================
     Everything below lays out pins and forces a full-document ScrollTrigger
     refresh. Measured on a phone, that work held the first paint at 1.5s —
     and none of it is visible in the first screen: the rail is thousands of
     pixels down and the marquee sits under the fold. So it is scheduled after
     the browser has painted, with a timeout so a busy main thread cannot
     postpone it indefinitely. */
  if (!useGsap) return;

  var choreograph = function () {

  document.documentElement.classList.add('gsap');
  gsap.registerPlugin(ScrollTrigger);
  /* A phone address bar that slides away mid-scroll resizes the viewport,
     and ScrollTrigger's default response is to refresh — which yanks any
     pinned section out from under the finger. Ignoring that one resize is
     the documented remedy and the reason the rail can hold on touch. */
  ScrollTrigger.config({ ignoreMobileResize: true });
  /* Tango is attack and arrest: a phrase crosses fast, stops hard, and then
     holds. power3 over a full second drifts to its mark, which is the house
     style of every scroll-reveal on the web. Crossing quicker and stopping
     harder is the character, and the pauses between phrases carry the rest —
     the hold is in the timeline, not in the curve. Matches --ease-tango. */
  gsap.defaults({ ease: 'expo.out', duration: 0.72 });

  /* A narrow column swallows subtlety: the same 44px rise that reads as
     choreography on a wide screen reads as "the content just appeared" on a
     phone. Touch gets more travel and a little scale so blocks arrive
     instead of fading up. */
  var touch = window.matchMedia('(pointer: coarse)').matches;

  /* The homepage opening lives in js/portal.js: the dive through the O of
     KOMME. It is the site's one authored moment, so nothing here competes. */

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

  /* The Ich Komme stage used to pin and cut from pavilion to club. That was
     an authored moment of its own, and the site now has one at the door —
     the portal — so the stage rests in its arrived, club state. */

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
        /* Touch pins by transform instead of position:fixed. Fixed pinning
           drifts or drops out entirely when the viewport resizes under it,
           which is what kept the archive from travelling on a phone. */
        pinType: touch ? 'transform' : 'fixed',
        anticipatePin: 1,
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

  };

  if ('requestIdleCallback' in window) {
    requestAnimationFrame(function () { requestIdleCallback(choreograph, { timeout: 900 }); });
  } else {
    requestAnimationFrame(function () { setTimeout(choreograph, 60); });
  }

})();
