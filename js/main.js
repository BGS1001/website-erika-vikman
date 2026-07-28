// Scroll progress bar
const progressBar = document.querySelector('.scroll-progress');
if (progressBar) {
  const updateProgress = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    progressBar.style.width = (max > 0 ? (doc.scrollTop / max) * 100 : 0) + '%';
  };
  document.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();
}

// Nav scroll state
const nav = document.querySelector('.nav');
const onScroll = () => {
  if (!nav) return;
  nav.classList.toggle('is-scrolled', window.scrollY > 40);
};
document.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Mobile nav toggle
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
  navLinks.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => navLinks.classList.remove('open'))
  );
}

// Active nav link by current page
const current = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a').forEach((a) => {
  const href = a.getAttribute('href');
  if (href === current || (current === '' && href === 'index.html')) {
    a.classList.add('active');
  }
});

// Gallery lightbox
const lightbox = document.querySelector('.lightbox');
if (lightbox) {
  const lightboxImg = lightbox.querySelector('img');
  const closeBtn = lightbox.querySelector('.lightbox-close');

  document.querySelectorAll('.gallery-item img').forEach((img) => {
    img.addEventListener('click', () => {
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightbox.classList.add('open');
    });
  });

  const close = () => lightbox.classList.remove('open');
  closeBtn?.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

// Reveal-on-scroll
const revealEls = document.querySelectorAll('[data-reveal]');
if (revealEls.length && 'IntersectionObserver' in window) {
  const pending = new Set(revealEls);

  const show = (el) => {
    el.style.opacity = '1';
    el.style.transform = 'none';
    pending.delete(el);
    io.unobserve(el);
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) show(entry.target);
      });
    },
    // threshold 0 + rootMargin: sections taller than the viewport can never
    // reach a 15% visibility ratio on small screens, which left them hidden.
    { threshold: 0, rootMargin: '0px 0px -8% 0px' }
  );

  // Safety net. A fast jump — scroll restoration on reload, an anchor link,
  // the End key, momentum scrolling — can carry a section from below the
  // viewport to above it without the intersection ratio ever leaving 0, so no
  // callback fires and that section would stay invisible for good. Anything
  // that ended up fully above the viewport but is still pending was skipped.
  const sweepSkipped = () => {
    pending.forEach((el) => {
      if (el.getBoundingClientRect().bottom < 0) show(el);
    });
  };
  document.addEventListener('scroll', sweepSkipped, { passive: true });
  window.addEventListener('resize', sweepSkipped);

  revealEls.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
    io.observe(el);
  });
  sweepSkipped();
}
