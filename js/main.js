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
    el.style.filter = 'none';
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
      el.style.transform = 'translateY(20px)';
      el.style.filter = 'blur(6px)';
      /* same curve and tail as the GSAP tier, so the two paths feel alike */
      el.style.transition = 'opacity 0.9s var(--ease-out), transform 0.9s var(--ease-out), filter 0.9s var(--ease-out)';
      io.observe(el);
    });
  }


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

  /* ================= GSAP choreography ================================== */
  if (!useGsap) return;

  document.documentElement.classList.add('gsap');
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out', duration: 1 });

  /* A narrow column swallows subtlety: the same 44px rise that reads as
     choreography on a wide screen reads as "the content just appeared" on a
     phone. Touch gets more travel and a little scale so blocks arrive
     instead of fading up. */
  var touch = window.matchMedia('(pointer: coarse)').matches;

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
    /* ---- hero: the photograph turns into the arena as you scroll ----
       The first frame is the LCP image and is left alone. A second frame is
       dissolved over it on scrub, so the studio portrait becomes the Basel
       arena in the same red — a cross-dissolve only reads as deliberate when
       the two frames share a palette, otherwise it reads as a slideshow.
       The frame carries no src in the markup. It is armed when the browser
       goes idle, or on the first scroll, whichever lands first, and the
       dissolve is only wired up once the file has actually decoded: fading in
       an undecoded image would punch a dark hole through the hero. */
    var frame = hero.querySelector('.hero-frame');
    var conn = navigator.connection || {};
    var thrifty = conn.saveData === true || /2g/.test(conn.effectiveType || '');
    if (frame && !thrifty) {
      var armed = false;
      var arm = function () {
        if (armed) return;
        armed = true;
        frame.addEventListener('load', function () {
          gsap.to(frame, {
            opacity: 1,
            ease: 'none',
            scrollTrigger: { trigger: hero, start: 'top top', end: '68% top', scrub: true }
          });
          ScrollTrigger.refresh();
        }, { once: true });
        frame.src = frame.getAttribute('data-frame');
      };
      window.addEventListener('scroll', arm, { once: true, passive: true });
      if (window.requestIdleCallback) requestIdleCallback(arm, { timeout: 2500 });
      else setTimeout(arm, 1800);
    }


    /* hero parallax on the way out. Both frames drift together — parallaxing
       only the lower one would let the two slide apart mid-dissolve. */
    if (heroBg) {
      gsap.to(hero.querySelectorAll(".hero-bg img"), {
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

  /* ---- section reveals: a soft float, row by row ----
     A whole section arriving as one slab reads as a slide advancing. Blocks
     are decomposed into their content rows so each floats on its own beat:
     short travel, a long ease-out tail, and a little blur burning off. The
     blur is what makes it read as soft rather than as a slide — the row
     resolves into focus instead of sliding into place.
     A classless wrapper, or one holding a section title, is scaffolding: it
     should not move as a unit, so we float what it holds instead. */
  var DRIFT_SEL = '.split-media, .tl-media, .release-hero .cover, .store-card .shot';
  var SELF_STAGGERED = '.release-grid, .next-row, .awards-row, .merch-grid,' +
                       '.platform-row, .social-list, .tour-list';

  if (revealEls.length) {
    var items = [];
    revealEls.forEach(function (block) {
      var kids = [];
      Array.prototype.slice.call(block.children).forEach(function (child) {
        var scaffold = child.children.length > 1 &&
          (!child.className || !!child.querySelector('.section-title'));
        if (scaffold) {
          kids.push.apply(kids, Array.prototype.slice.call(child.children));
        } else {
          kids.push(child);
        }
      });
      items.push.apply(items, kids.length ? kids : [block]);
    });

    var vh = window.innerHeight || 800;
    items = items.filter(function (el) { return !el.matches(SELF_STAGGERED); });
    items.forEach(function (el) {
      /* Anything that already owns a scroll-driven transform gets opacity
         only — a second y tween would fight the drift, and clearing the
         transform afterwards would wipe it. */
      /* Section titles already rise word by word behind their masks; adding a
         float on top of that smears two movements into one mush. */
      var titled = el.matches('.section-title');
      var owned = titled || el.matches(DRIFT_SEL) || !!el.closest('.banner-par');
      /* Blur is a full repaint of the element each frame, so it is worth it
         on a paragraph and not on a photo or a half-screen headline. */
      var big = el.getBoundingClientRect().height > vh * 0.45;
      var media = el.tagName === 'IMG' || !!el.querySelector('img, iframe, video, canvas');
      el.__rv = { y: owned ? 0 : (touch ? 26 : 20), blur: (media || big || titled) ? 0 : (touch ? 4 : 6) };
    });

    gsap.set(items, { autoAlpha: 0 });
    var moved = items.filter(function (el) { return el.__rv.y; });
    var blurred = items.filter(function (el) { return el.__rv.blur; });
    if (moved.length) gsap.set(moved, { y: function (i, el) { return el.__rv.y; } });
    if (blurred.length) {
      gsap.set(blurred, { filter: function (i, el) { return 'blur(' + el.__rv.blur + 'px)'; } });
    }

    ScrollTrigger.batch(items, {
      start: touch ? 'top 94%' : 'top 90%',
      once: true,
      onEnter: function (batch) {
        batch.forEach(function (el, i) {
          var clear = ['willChange'];
          var vars = {
            autoAlpha: 1,
            duration: 0.9,
            /* power4.out is the GSAP twin of cubic-bezier(0.23, 1, 0.32, 1):
               most of the distance is covered at once, then a long quiet
               settle. That tail is the "soft" in soft float. */
            ease: 'power4.out',
            delay: i * 0.075,
            overwrite: 'auto'
          };
          if (el.__rv.y) { vars.y = 0; clear.push('transform'); }
          if (el.__rv.blur) { vars.filter = 'blur(0px)'; clear.push('filter'); }
          vars.clearProps = clear.join(',');
          gsap.to(el, vars);
        });
      }
    });
    // rows above the fold on load (or after scroll restoration) must not wait
    // for a scroll event
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

  /* ---- imagery: settle-in scale + frame drift ---- */
  gsap.utils.toArray('.split-media img').filter(function (img) {
    return !img.closest('.banner-par'); // the banner has its own parallax
  }).forEach(function (img) {
    gsap.fromTo(img, { scale: 1.12 }, {
      scale: 1, duration: 1.4, ease: 'power2.out',
      scrollTrigger: { trigger: img, start: 'top 88%', once: true }
    });
  });

  /* Frames drift against the scroll, which on a phone is most of what stops a
     stack of images reading as a static list. The whole frame moves, not the
     photo inside it: the hairline border belongs to the image and .split-media
     hangs its stat badge past the corner on negative offsets, so clipping the
     frame would eat the badge and scaling the photo would push the border out
     of view. Moving the unit keeps both attached. */
  var DRIFT = touch ? 10 : 14;
  gsap.utils.toArray(DRIFT_SEL)
    .filter(function (f) { return !f.closest('.banner-par') && f.querySelector('img'); })
    .forEach(function (frame) {
      gsap.fromTo(frame, { y: -DRIFT }, {
        y: DRIFT,
        ease: 'none',
        scrollTrigger: {
          trigger: frame,
          start: 'top bottom',
          end: 'bottom top',
          scrub: touch ? 0.6 : true
        }
      });
    });

  /* Grid cards climb in one after another rather than all at once. */
  [['.release-grid', '.release-card'], ['.next-row', '.next-card'],
   ['.awards-row', '.award-cell'], ['.merch-grid', '.merch-cell'],
   ['.platform-row', '.platform-link'], ['.social-list', '.social-row'],
   ['.tour-list', '.tour-row']].forEach(function (pair) {
    gsap.utils.toArray(pair[0]).forEach(function (group) {
      var items = group.querySelectorAll(pair[1]);
      if (!items.length) return;
      gsap.from(items, {
        y: touch ? 34 : 24,
        autoAlpha: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: touch ? 0.08 : 0.06,
        scrollTrigger: { trigger: group, start: 'top 90%', once: true }
      });
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

})();
