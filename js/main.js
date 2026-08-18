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

  /* ================= gallery lightbox =================================== */
  var lightbox = document.querySelector('.lightbox');
  if (lightbox) {
    var lightboxImg = lightbox.querySelector('img');
    var closeBtn = lightbox.querySelector('.lightbox-close');
    var lastFocused = null;

    document.querySelectorAll('.gallery-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var img = item.querySelector('img');
        if (!img) return;
        lastFocused = item;
        lightboxImg.src = img.currentSrc || img.src;
        lightboxImg.alt = img.alt;
        lightbox.classList.add('open');
        lightbox.setAttribute('aria-hidden', 'false');
        if (closeBtn) closeBtn.focus();
      });
    });

    var closeLb = function () {
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      lightboxImg.src = '';
      if (lastFocused) lastFocused.focus();
    };
    if (closeBtn) closeBtn.addEventListener('click', closeLb);
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLb();
    });
    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') closeLb();
      if (e.key === 'Tab') { e.preventDefault(); if (closeBtn) closeBtn.focus(); }
    });
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
    heroTitle.setAttribute('aria-label', heroTitle.textContent.trim());
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
    intro.fromTo('.hero-chips', { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8 }, 0.7);
    intro.fromTo('.hero-sub', { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8 }, 0.85);
    intro.fromTo('.hero-actions', { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8 }, 1.0);
    intro.fromTo('.hero-scroll', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, 1.3);

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

  /* ---- section reveals ---- */
  if (revealEls.length) {
    gsap.set(revealEls, { y: 44, autoAlpha: 0 });
    ScrollTrigger.batch(revealEls, {
      start: 'top 86%',
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, {
          y: 0, autoAlpha: 1, duration: 1, stagger: 0.12,
          overwrite: true, clearProps: 'transform'
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

  /* ---- custom cursor ---- */
  if (window.matchMedia('(pointer: fine)').matches) {
    var ring = document.createElement('div');
    ring.className = 'cursor-ring is-hidden';
    var dot = document.createElement('div');
    dot.className = 'cursor-dot is-hidden';
    document.body.appendChild(ring);
    document.body.appendChild(dot);
    document.documentElement.classList.add('cursor-on');

    var ringX = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' });
    var ringY = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' });
    var dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power2.out' });
    var dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power2.out' });

    window.addEventListener('pointermove', function (e) {
      ring.classList.remove('is-hidden');
      dot.classList.remove('is-hidden');
      ringX(e.clientX); ringY(e.clientY);
      dotX(e.clientX); dotY(e.clientY);
    }, { passive: true });

    document.addEventListener('pointerover', function (e) {
      if (e.target.closest('a, button, [data-embed], .gallery-item')) {
        ring.classList.add('is-active');
      }
    });
    document.addEventListener('pointerout', function (e) {
      if (e.target.closest('a, button, [data-embed], .gallery-item')) {
        ring.classList.remove('is-active');
      }
    });
    document.documentElement.addEventListener('mouseleave', function () {
      ring.classList.add('is-hidden');
      dot.classList.add('is-hidden');
    });
  }
})();
