/* ==========================================================================
   Erika Vikman — site behaviour
   One rAF-throttled scroll pass drives every scroll-linked effect. Each
   listener used to read layout on its own, which forced a synchronous
   reflow per scroll event; batching them keeps scrolling on the
   compositor's schedule instead.
   ========================================================================== */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- elements ---- */
  var progressBar = document.querySelector('.scroll-progress');
  var nav = document.querySelector('.nav');
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));

  /* ---- reveal on scroll ---- */
  var pending = new Set(revealEls);
  var io = null;

  function show(el) {
    el.style.opacity = '1';
    el.style.transform = 'none';
    pending.delete(el);
    if (io) io.unobserve(el);
  }

  if (revealEls.length && !reduceMotion && 'IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) show(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });

    revealEls.forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
      io.observe(el);
    });
  }

  /* ---- single batched scroll pass ---- */
  var ticking = false;

  function readAndWrite() {
    ticking = false;

    var doc = document.documentElement;
    var scrollTop = doc.scrollTop;
    var max = doc.scrollHeight - doc.clientHeight;
    var viewportH = doc.clientHeight;

    // A fast jump — scroll restoration, an anchor link, the End key, momentum
    // scrolling — can carry a section from below the viewport to above it
    // without the intersection ratio ever leaving 0, so no observer callback
    // fires and that section would stay invisible for good. Anything fully
    // above the viewport but still pending was skipped that way.
    var skipped = null;
    if (pending.size) {
      pending.forEach(function (el) {
        if (el.getBoundingClientRect().bottom < 0) {
          (skipped || (skipped = [])).push(el);
        }
      });
    }

    // writes, after every read above
    if (progressBar) {
      progressBar.style.transform = 'scaleX(' + (max > 0 ? scrollTop / max : 0) + ')';
    }
    if (nav) {
      nav.classList.toggle('is-scrolled', scrollTop > 40);
    }
    if (skipped) skipped.forEach(show);

    return viewportH;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(readAndWrite);
  }

  document.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  readAndWrite();

  /* ---- mobile nav ---- */
  var navToggle = document.querySelector('.nav-toggle');
  var navLinks = document.querySelector('.nav-links');
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

  /* ---- active nav link for the current page ---- */
  var current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href === current || (current === '' && href === 'index.html')) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });

  /* ---- streaming embed facades ----
     Spotify and YouTube iframes cost megabytes of third-party JS before the
     visitor has asked for anything. Ship a sized poster instead and swap in
     the real player on click — the container already reserves the exact
     space, so the swap shifts nothing. */
  document.querySelectorAll('[data-embed]').forEach(function (facade) {
    facade.addEventListener('click', function () {
      var src = facade.getAttribute('data-embed');
      var title = facade.getAttribute('data-embed-title') || 'Embedded player';
      var frame = document.createElement('iframe');
      frame.src = src;
      frame.title = title;
      frame.loading = 'lazy';
      frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      frame.setAttribute('allowfullscreen', '');
      frame.style.cssText = 'width:100%;height:100%;border:0;display:block;';
      facade.replaceWith(frame);
    });
  });

  /* ---- gallery lightbox ---- */
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

    var close = function () {
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      lightboxImg.src = '';
      if (lastFocused) lastFocused.focus();
    };

    if (closeBtn) closeBtn.addEventListener('click', close);
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) close();
    });
    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      // The dialog holds a single control, so keep Tab on it rather than
      // letting focus wander into the page behind the overlay.
      if (e.key === 'Tab') {
        e.preventDefault();
        if (closeBtn) closeBtn.focus();
      }
    });
  }
})();
