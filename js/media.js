/* ==========================================================================
   On-site media — the jukebox and the video player
   ==========================================================================
   Nothing on this site sends a visitor elsewhere to hear or watch her.

   Audio: 30-second previews from Apple, played by the site's own <audio>.
   Full songs: her official YouTube videos, played here inside YouTube's own
   embedded player — which is the one way a fan site can play a full song for
   everyone, since the streaming services only play full tracks to signed-in
   subscribers.

   The jukebox is the pavilion's machine: a paper panel of title strips, a
   painted now-playing board, and a dock at the foot of the screen once
   something is playing. The catalogue is baked into js/media-catalog.js so a
   tap can start audio synchronously; iOS refuses to play anything started
   after an await.
   ========================================================================== */
(function () {
  'use strict';

  var M = window.EV_MEDIA;
  if (!M) return;
  var tracks = M.tracks;
  var videos = M.videos;

  var norm = function (s) { return String(s).toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim(); };
  var videoById = {};
  videos.forEach(function (v) { videoById[v.id] = v; });

  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  var ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2.5v14H6zM20 5v14L9 12z"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5H18v14h-2.5zM4 5l11 7-11 7z"/></svg>'
  };

  /* ---------------------------------------------------------------- audio */
  var audio = new Audio();
  audio.preload = 'none';
  var current = -1;

  function playable(i) { return i >= 0 && i < tracks.length && !!tracks[i].u; }
  function stepFrom(i, dir) {
    for (var k = 1; k <= tracks.length; k++) {
      var j = (i + dir * k + tracks.length * 2) % tracks.length;
      if (playable(j)) return j;
    }
    return -1;
  }

  function playTrack(i) {
    if (!playable(i)) {
      if (tracks[i] && tracks[i].v) openVideo(tracks[i].v);
      return;
    }
    closeVideo();
    if (current !== i) {
      current = i;
      audio.src = tracks[i].u;
    }
    // called inside the tap, so iOS lets it start
    var p = audio.play();
    if (p && p.catch) p.catch(function () { sync(); });
    showDock();
    sync();
    mediaSession();
  }
  function toggle() {
    if (current < 0) { playTrack(stepFrom(-1, 1)); return; }
    if (audio.paused) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); }
    else audio.pause();
  }

  audio.addEventListener('play', sync);
  audio.addEventListener('pause', sync);
  audio.addEventListener('timeupdate', progress);
  audio.addEventListener('ended', function () {
    var n = stepFrom(current, 1);
    if (n > -1) playTrack(n);
  });
  audio.addEventListener('error', function () {
    // a preview Apple has withdrawn: mark it and move on rather than stall
    if (current < 0) return;
    document.querySelectorAll('.jb-row[data-i="' + current + '"]').forEach(function (r) { r.classList.add('is-gone'); });
    tracks[current].u = null;
    var n = stepFrom(current, 1);
    if (n > -1 && n !== current) playTrack(n);
  });

  function mediaSession() {
    if (!('mediaSession' in navigator) || current < 0) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: tracks[current].t,
        artist: 'Erika Vikman',
        album: tracks[current].a || '',
        artwork: [{ src: 'assets/img/artwork-ich-komme.jpg', sizes: '1118x1280', type: 'image/jpeg' }]
      });
      navigator.mediaSession.setActionHandler('play', toggle);
      navigator.mediaSession.setActionHandler('pause', toggle);
      navigator.mediaSession.setActionHandler('previoustrack', function () { playTrack(stepFrom(current, -1)); });
      navigator.mediaSession.setActionHandler('nexttrack', function () { playTrack(stepFrom(current, 1)); });
    } catch (e) { /* older browsers without the full API */ }
  }

  /* ----------------------------------------------------- shared rendering */
  function renderList(list) {
    list.innerHTML = '';
    tracks.forEach(function (t, i) {
      var name = h('span', { class: 'jb-name' }, [
        h('span', { class: 'jb-song', text: t.t }),
        h('small', { text: t.a && norm(t.a) !== norm(t.t) ? t.a : (t.u ? 'Single' : '') })
      ]);
      var btns = h('span', { class: 'jb-btns' });
      if (t.u) btns.appendChild(h('button', { type: 'button', class: 'jb-btn', 'data-i': i, 'aria-label': 'Play a 30-second preview of ' + t.t, text: 'Preview' }));
      if (t.v) btns.appendChild(h('button', { type: 'button', class: 'jb-btn is-full', 'data-play-video': t.v, 'aria-label': 'Play the full song ' + t.t + ' as her official video', text: 'Full song' }));
      list.appendChild(h('li', { class: 'jb-row', 'data-i': i }, [
        h('span', { class: 'jb-yr', text: String(t.y || '') }), name, btns
      ]));
    });
  }

  function progress() {
    var pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    document.querySelectorAll('[data-jb-bar]').forEach(function (b) { b.style.transform = 'scaleX(' + (pct / 100).toFixed(4) + ')'; });
  }

  function sync() {
    var t = tracks[current];
    var playing = !audio.paused && current > -1;
    document.querySelectorAll('.jb-row').forEach(function (r) {
      var on = +r.getAttribute('data-i') === current;
      r.classList.toggle('is-current', on);
      r.classList.toggle('is-playing', on && playing);
    });
    document.querySelectorAll('[data-jb-song]').forEach(function (s) { s.textContent = t ? t.t : 'Pick a song'; });
    document.querySelectorAll('[data-jb-sub]').forEach(function (s) { s.textContent = t ? (t.y + ' · 30-second preview') : 'Previews, and full songs as her official videos'; });
    document.querySelectorAll('[data-jb-toggle]').forEach(function (b) {
      b.innerHTML = playing ? ICON.pause : ICON.play;
      b.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    });
    if ('mediaSession' in navigator) {
      try { navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'; } catch (e) {}
    }
  }

  /* -------------------------------------------------------------- dialogs */
  var open = [];
  var lastFocus = [];
  var savedOverflow = '';

  function focusables(root) {
    return Array.prototype.filter.call(
      root.querySelectorAll('button, a[href], iframe, [tabindex]:not([tabindex="-1"])'),
      function (n) { return !n.disabled && n.offsetParent !== null; }
    );
  }
  function show(dlg, from) {
    if (open.indexOf(dlg) > -1) return;
    lastFocus.push(from || document.activeElement);
    if (!open.length) { savedOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    open.push(dlg);
    dlg.hidden = false;
    // next frame, so the transition has a start state
    requestAnimationFrame(function () { dlg.classList.add('is-open'); });
    var f = focusables(dlg);
    if (f.length) f[0].focus();
  }
  function hide(dlg) {
    var at = open.indexOf(dlg);
    if (at < 0) return;
    open.splice(at, 1);
    dlg.classList.remove('is-open');
    dlg.hidden = true;
    if (!open.length) document.body.style.overflow = savedOverflow;
    var back = lastFocus.splice(at, 1)[0];
    if (back && back.focus) back.focus();
  }

  document.addEventListener('keydown', function (e) {
    var top = open[open.length - 1];
    if (!top) return;
    if (e.key === 'Escape') { if (top === videoDlg) closeVideo(); else hide(top); return; }
    if (e.key === 'Tab') {
      var f = focusables(top);
      if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });

  /* ------------------------------------------------------------- jukebox */
  var jbDlg = null;
  function buildJukebox() {
    var list = h('ol', { class: 'jb-list' });
    renderList(list);
    var panel = h('div', { class: 'jb-panel' }, [
      h('header', { class: 'jb-head' }, [
        h('div', null, [
          h('p', { class: 'jb-kicker', text: 'The jukebox' }),
          h('h2', { class: 'jb-title', id: 'jb-title', text: 'Erika Vikman' })
        ]),
        h('button', { type: 'button', class: 'jb-close', 'data-jb-close': '', 'aria-label': 'Close the jukebox', html: '&times;' })
      ]),
      nowBoard(),
      list,
      credit()
    ]);
    jbDlg = h('div', { class: 'jb', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'jb-title', hidden: '' }, [panel]);
    jbDlg.addEventListener('click', function (e) { if (e.target === jbDlg) hide(jbDlg); });
    document.body.appendChild(jbDlg);
    sync();
  }
  function nowBoard() {
    return h('div', { class: 'jb-now' }, [
      h('div', { class: 'jb-ctrls' }, [
        h('button', { type: 'button', class: 'jb-ctrl', 'data-jb-prev': '', 'aria-label': 'Previous song', html: ICON.prev }),
        h('button', { type: 'button', class: 'jb-ctrl is-main', 'data-jb-toggle': '', 'aria-label': 'Play', html: ICON.play }),
        h('button', { type: 'button', class: 'jb-ctrl', 'data-jb-next': '', 'aria-label': 'Next song', html: ICON.next })
      ]),
      h('div', { class: 'jb-meta', 'aria-live': 'polite' }, [
        h('span', { class: 'jb-now-song', 'data-jb-song': '', text: 'Pick a song' }),
        h('span', { class: 'jb-now-sub', 'data-jb-sub': '' })
      ]),
      h('span', { class: 'jb-bar', 'aria-hidden': 'true' }, [h('span', { 'data-jb-bar': '' })])
    ]);
  }
  function credit() {
    // Previews credit their source in words. No link: nothing on this site sends a visitor elsewhere.
    return h('p', { class: 'jb-credit', html:
      'Previews courtesy of Apple Music. ' +
      'Full songs are her official videos, played here in YouTube’s player.' });
  }
  function openJukebox(from) {
    if (!jbDlg) buildJukebox();
    show(jbDlg, from);
  }

  /* ----------------------------------------------------------------- dock */
  var dock = null;
  function showDock() {
    if (dock) { dock.hidden = false; return; }
    dock = h('div', { class: 'jb-dock', role: 'region', 'aria-label': 'Now playing' }, [
      h('button', { type: 'button', class: 'jb-ctrl is-main', 'data-jb-toggle': '', 'aria-label': 'Play', html: ICON.play }),
      h('button', { type: 'button', class: 'jb-dock-meta', 'data-open-jukebox': '', 'aria-label': 'Open the jukebox' }, [
        h('span', { class: 'jb-now-song', 'data-jb-song': '' }),
        h('span', { class: 'jb-now-sub', 'data-jb-sub': '' })
      ]),
      h('button', { type: 'button', class: 'jb-ctrl', 'data-jb-next': '', 'aria-label': 'Next song', html: ICON.next }),
      h('span', { class: 'jb-bar', 'aria-hidden': 'true' }, [h('span', { 'data-jb-bar': '' })])
    ]);
    document.body.appendChild(dock);
    document.documentElement.classList.add('has-dock');
    sync();
  }

  /* --------------------------------------------------------------- video */
  var videoDlg = null;
  function openVideo(id, from) {
    audio.pause();
    if (!videoDlg) {
      videoDlg = h('div', { class: 'vd', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'vd-title', hidden: '' }, [
        h('div', { class: 'vd-panel' }, [
          h('header', { class: 'vd-head' }, [
            h('h2', { class: 'vd-title', id: 'vd-title' }),
            h('button', { type: 'button', class: 'jb-close', 'data-vd-close': '', 'aria-label': 'Close the video', html: '&times;' })
          ]),
          h('div', { class: 'vd-frame' }),
          h('p', { class: 'vd-sub' })
        ])
      ]);
      videoDlg.addEventListener('click', function (e) { if (e.target === videoDlg) closeVideo(); });
      document.body.appendChild(videoDlg);
    }
    var v = videoById[id] || { song: 'Erika Vikman', kind: 'Video', y: '' };
    videoDlg.querySelector('.vd-title').textContent = v.song;
    videoDlg.querySelector('.vd-sub').textContent = [v.kind, v.y, v.ch].filter(Boolean).join(' · ');
    var frame = videoDlg.querySelector('.vd-frame');
    frame.innerHTML = '';
    var f = document.createElement('iframe');
    // permissions before src: a frame takes its policy when it starts to navigate
    f.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
    f.setAttribute('allowfullscreen', '');
    f.title = v.song + ' — ' + v.kind;
    f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0&playsinline=1';
    frame.appendChild(f);
    show(videoDlg, from);
  }
  function closeVideo() {
    if (!videoDlg || videoDlg.hidden) return;
    // removing the frame is what actually stops the video
    videoDlg.querySelector('.vd-frame').innerHTML = '';
    hide(videoDlg);
  }

  /* --------------------------------------------------- inline renderings */
  document.querySelectorAll('[data-jukebox-inline]').forEach(function (host) {
    var list = h('ol', { class: 'jb-list is-inline' });
    renderList(list);
    host.appendChild(nowBoard());
    host.appendChild(list);
    host.appendChild(credit());
  });
  document.querySelectorAll('[data-video-list]').forEach(function (host) {
    videos.forEach(function (v) {
      host.appendChild(h('li', { class: 'vl-row' }, [
        h('span', { class: 'jb-yr', text: String(v.y) }),
        h('span', { class: 'jb-name' }, [h('span', { class: 'jb-song', text: v.song }), h('small', { text: v.kind })]),
        h('span', { class: 'jb-btns' }, [
          h('button', { type: 'button', class: 'jb-btn is-full', 'data-play-video': v.id, 'aria-label': 'Play ' + v.song + ', ' + v.kind, text: 'Play' })
        ])
      ]));
    });
  });
  sync();

  /* ----------------------------------------------------------- delegation */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest(
      '[data-jb-close], [data-vd-close], [data-jb-toggle], [data-jb-prev], [data-jb-next], ' +
      '.jb-btn[data-i], [data-play-video], [data-play-track], [data-open-jukebox], .disc-cta, [data-embed]');
    if (!t) return;

    if (t.hasAttribute('data-embed')) { audio.pause(); return; } // an inline video facade takes over
    e.preventDefault();

    if (t.hasAttribute('data-jb-close')) hide(jbDlg);
    else if (t.hasAttribute('data-vd-close')) closeVideo();
    else if (t.hasAttribute('data-jb-toggle')) toggle();
    else if (t.hasAttribute('data-jb-prev')) playTrack(stepFrom(current, -1));
    else if (t.hasAttribute('data-jb-next')) playTrack(stepFrom(current, 1));
    else if (t.hasAttribute('data-play-video')) openVideo(t.getAttribute('data-play-video'), t);
    else if (t.hasAttribute('data-i')) playTrack(+t.getAttribute('data-i'));
    else if (t.hasAttribute('data-play-track')) {
      var want = norm(t.getAttribute('data-play-track'));
      for (var i = 0; i < tracks.length; i++) if (norm(tracks[i].t) === want) { playTrack(i); break; }
    } else {
      openJukebox(t);
    }
  });

  // a #listen link opened from another page lands with the jukebox on screen
  if (location.hash === '#listen' && !document.querySelector('[data-jukebox-inline]')) openJukebox();
})();
