/* ==========================================================================
   Mic cursor — a golden vintage microphone suspended behind the pointer

   Canvas 2D, no dependencies. The microphone is pre-rendered once to an
   offscreen sprite whose rear is wiped out with a gradient, so roughly the
   front third stays defined and the rest dissolves into the plume. Each
   frame only blits that sprite and draws the plume and particles, which
   keeps the loop cheap enough to hold 60fps.

   Configure via MicCursor.create({ ... }) — see DEFAULTS.
   ========================================================================== */
(function (global) {
  'use strict';

  var DEFAULTS = {
    enabled:        true,
    opacity:        0.34,   // peak opacity of the microphone itself
    followSpeed:    0.12,   // pointer lerp per frame, 0..1
    rotationSpeed:  0.07,   // how readily it swings to face travel
    trailLength:    1,      // plume length multiplier
    fadeSpeed:      0.05,   // how fast the plume dies back once still
    glowIntensity:  0.55,
    particleAmount: 1,      // emission multiplier
    particleSize:   1,
    maxScale:       1.16,
    idleAnimation:  true,
    micLength:      118,    // px from head to nozzle
    zIndex:         60      // above content, below nav and dialogs
  };

  /* polished metal under studio light — nothing saturated */
  var IVORY     = '255,248,231';
  var CHAMPAGNE = '240,226,195';
  var GOLD      = '206,166,74';
  var AMBER     = '198,142,58';

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function MicCursor(options) {
    var cfg = {};
    var k;
    for (k in DEFAULTS) cfg[k] = DEFAULTS[k];
    if (options) for (k in options) if (k in DEFAULTS) cfg[k] = options[k];
    this.cfg = cfg;

    this.dpr = Math.min(global.devicePixelRatio || 1, 2);
    this.canvas = null;
    this.ctx = null;
    this.sprite = null;
    this.spriteOrigin = { x: 0, y: 0 };
    this.spriteSize = { w: 0, h: 0 };

    this.pointer = { x: 0, y: 0, seen: false };
    this.pos = { x: 0, y: 0 };
    this.angle = -0.42;
    this.speed = 0;
    this.energy = 0;     // 0..1 — drives plume length, glow and emission
    this.presence = 0;   // 0..1 — overall fade in / out
    this.scale = 1;
    this.particles = [];
    this.maxParticles = 110;
    this.time = 0;
    this.raf = null;
    this.active = false;
  }

  /* ---- offscreen microphone -------------------------------------------- */
  MicCursor.prototype.buildSprite = function () {
    var L = this.cfg.micLength;
    var pad = 52;
    var w = L + pad * 2;
    var h = 116;
    var dpr = this.dpr;

    var c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr);
    c.height = Math.ceil(h * dpr);
    var g = c.getContext('2d');
    g.scale(dpr, dpr);

    var ox = L + pad;          // the head sits on the pointer
    var oy = h / 2;
    g.translate(ox, oy);

    /* aura first, so the metal sits inside its own light */
    var aura = g.createRadialGradient(-L * 0.3, 0, 2, -L * 0.3, 0, L * 0.7);
    aura.addColorStop(0, 'rgba(' + CHAMPAGNE + ',0.15)');
    aura.addColorStop(0.45, 'rgba(' + GOLD + ',0.07)');
    aura.addColorStop(1, 'rgba(' + GOLD + ',0)');
    g.fillStyle = aura;
    g.fillRect(-w, -oy, w * 2, h);

    function metal(x0, y0, x1, y1, a) {
      var lg = g.createLinearGradient(x0, y0, x1, y1);
      lg.addColorStop(0.00, 'rgba(' + IVORY + ',' + (0.8 * a) + ')');
      lg.addColorStop(0.26, 'rgba(' + CHAMPAGNE + ',' + (0.92 * a) + ')');
      lg.addColorStop(0.52, 'rgba(' + GOLD + ',' + (0.86 * a) + ')');
      lg.addColorStop(0.78, 'rgba(' + AMBER + ',' + (0.62 * a) + ')');
      lg.addColorStop(1.00, 'rgba(' + AMBER + ',' + (0.36 * a) + ')');
      return lg;
    }

    function roundedBar(x, y, len, th, r) {
      g.beginPath();
      g.moveTo(x + r, y - th / 2);
      g.lineTo(x + len - r, y - th / 2);
      g.quadraticCurveTo(x + len, y - th / 2, x + len, y - th / 2 + r);
      g.lineTo(x + len, y + th / 2 - r);
      g.quadraticCurveTo(x + len, y + th / 2, x + len - r, y + th / 2);
      g.lineTo(x + r, y + th / 2);
      g.quadraticCurveTo(x, y + th / 2, x, y + th / 2 - r);
      g.lineTo(x, y - th / 2 + r);
      g.quadraticCurveTo(x, y - th / 2, x + r, y - th / 2);
      g.closePath();
    }

    /* --- the stand: thin shaft running back to the nozzle --- */
    roundedBar(-L + 4, 0, L - 48, 5.4, 2.6);
    g.fillStyle = metal(0, -3, 0, 3, 1);
    g.fill();

    /* nozzle disc, seen almost edge-on */
    g.beginPath();
    g.ellipse(-L + 5, 0, 4.2, 12.5, 0, 0, Math.PI * 2);
    g.fillStyle = metal(-L, -12, -L, 12, 0.95);
    g.fill();

    /* --- clamp where the mic meets the stand --- */
    g.save();
    g.translate(-46, 0);
    g.rotate(-0.06);
    roundedBar(-6, 0, 15, 13.5, 3);
    g.fillStyle = metal(0, -7, 0, 7, 0.9);
    g.fill();
    g.restore();

    /* --- microphone body, set a little off the stand axis --- */
    g.save();
    g.translate(-40, -1.5);
    g.rotate(-0.16);
    g.beginPath();
    g.moveTo(0, -5.6);
    g.lineTo(-19, -7.4);
    g.quadraticCurveTo(-24, -7.4, -24, -4.2);
    g.lineTo(-24, 4.2);
    g.quadraticCurveTo(-24, 7.4, -19, 7.4);
    g.lineTo(0, 5.6);
    g.quadraticCurveTo(3, 4.4, 3, 0);
    g.quadraticCurveTo(3, -4.4, 0, -5.6);
    g.closePath();
    g.fillStyle = metal(0, -7.5, 0, 7.5, 1);
    g.fill();
    /* two collar rings */
    g.fillStyle = 'rgba(' + AMBER + ',0.5)';
    g.fillRect(-8, -6.6, 1.6, 13.2);
    g.fillRect(-13, -7, 1.6, 14);
    g.restore();

    /* --- ball grille --- */
    var hx = -13, hy = -4.6, hr = 13.4;
    var ball = g.createRadialGradient(hx - 5, hy - 5, 1.5, hx, hy, hr);
    ball.addColorStop(0, 'rgba(' + IVORY + ',0.95)');
    ball.addColorStop(0.32, 'rgba(' + CHAMPAGNE + ',0.86)');
    ball.addColorStop(0.72, 'rgba(' + GOLD + ',0.8)');
    ball.addColorStop(1, 'rgba(' + AMBER + ',0.55)');
    g.beginPath();
    g.arc(hx, hy, hr, 0, Math.PI * 2);
    g.fillStyle = ball;
    g.fill();

    /* mesh, clipped to the ball and fading out toward its edge */
    g.save();
    g.clip();
    g.strokeStyle = 'rgba(120,86,26,0.30)';
    g.lineWidth = 0.7;
    var a2, i;
    for (i = -5; i <= 5; i++) {
      a2 = i * 2.7;
      g.beginPath();
      g.moveTo(hx - hr, hy + a2);
      g.lineTo(hx + hr, hy + a2 - 2.2);
      g.stroke();
    }
    for (i = -5; i <= 5; i++) {
      a2 = i * 2.7;
      g.beginPath();
      g.moveTo(hx + a2, hy - hr);
      g.lineTo(hx + a2 + 2.2, hy + hr);
      g.stroke();
    }
    g.restore();

    /* specular */
    var spec = g.createRadialGradient(hx - 5.5, hy - 5.5, 0.5, hx - 5.5, hy - 5.5, 7.5);
    spec.addColorStop(0, 'rgba(255,255,255,0.72)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    g.beginPath();
    g.arc(hx - 5.5, hy - 5.5, 7.5, 0, Math.PI * 2);
    g.fillStyle = spec;
    g.fill();

    /* --- dissolve the rear: the form should hand over to the plume --- */
    g.globalCompositeOperation = 'destination-out';
    var wipe = g.createLinearGradient(-22, 0, -L - 2, 0);
    wipe.addColorStop(0, 'rgba(0,0,0,0)');
    wipe.addColorStop(0.38, 'rgba(0,0,0,0.30)');
    wipe.addColorStop(0.72, 'rgba(0,0,0,0.68)');
    wipe.addColorStop(1, 'rgba(0,0,0,0.94)');
    g.fillStyle = wipe;
    g.fillRect(-w, -oy, w * 2, h);
    g.globalCompositeOperation = 'source-over';

    this.sprite = c;
    this.spriteOrigin = { x: ox, y: oy };
    this.spriteSize = { w: w, h: h };
  };

  /* ---- particle sprites -------------------------------------------------
     Building a radial gradient per particle per frame costs more than the
     rest of the loop put together — around a hundred allocations every
     frame. The three tones are baked once and blitted instead. */
  MicCursor.prototype.buildDots = function () {
    var tones = [IVORY, CHAMPAGNE, GOLD];
    var size = 32;
    this.dots = tones.map(function (tone) {
      var c = document.createElement('canvas');
      c.width = c.height = size;
      var g = c.getContext('2d');
      var rg = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      rg.addColorStop(0, 'rgba(' + tone + ',1)');
      rg.addColorStop(0.42, 'rgba(' + tone + ',0.34)');
      rg.addColorStop(1, 'rgba(' + GOLD + ',0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, size, size);
      return c;
    });
  };

  /* ---- particles -------------------------------------------------------- */
  MicCursor.prototype.emit = function (count) {
    var cfg = this.cfg;
    var cos = Math.cos(this.angle), sin = Math.sin(this.angle);
    var d = -cfg.micLength * this.scale;
    var nx = this.pos.x + d * cos;
    var ny = this.pos.y + d * sin;

    for (var i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) return;
      var spread = (Math.random() - 0.5) * 0.62;
      var a = this.angle + Math.PI + spread;
      var sp = (0.35 + Math.random() * 1.6) * (0.45 + this.energy * 1.3);
      this.particles.push({
        x: nx + (Math.random() - 0.5) * 7,
        y: ny + (Math.random() - 0.5) * 7,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        decay: 0.011 + Math.random() * 0.021,
        r: (0.45 + Math.random() * 1.7) * cfg.particleSize,
        tone: (Math.random() * 3) | 0
      });
    }
  };

  /* ---- plume ------------------------------------------------------------ */
  MicCursor.prototype.drawPlume = function (ctx) {
    var cfg = this.cfg;
    var e = this.energy;
    if (e < 0.012) return;

    var len = (34 + e * 168) * cfg.trailLength * this.scale;
    var halfW = 4.2 + e * 7.5;
    var d = -cfg.micLength * this.scale;
    var cos = Math.cos(this.angle), sin = Math.sin(this.angle);

    ctx.save();
    ctx.translate(this.pos.x + d * cos, this.pos.y + d * sin);
    ctx.rotate(this.angle + Math.PI);
    ctx.globalCompositeOperation = 'lighter';

    var alpha = this.presence * cfg.glowIntensity;

    /* soft body of the plume, tapering to nothing */
    var lg = ctx.createLinearGradient(0, 0, len, 0);
    lg.addColorStop(0.00, 'rgba(' + IVORY + ',' + (0.34 * alpha) + ')');
    lg.addColorStop(0.16, 'rgba(' + CHAMPAGNE + ',' + (0.26 * alpha) + ')');
    lg.addColorStop(0.48, 'rgba(' + GOLD + ',' + (0.13 * alpha) + ')');
    lg.addColorStop(1.00, 'rgba(' + AMBER + ',0)');
    ctx.beginPath();
    ctx.moveTo(0, -halfW);
    ctx.quadraticCurveTo(len * 0.42, -halfW * 1.5, len, -halfW * 0.16);
    ctx.lineTo(len, halfW * 0.16);
    ctx.quadraticCurveTo(len * 0.42, halfW * 1.5, 0, halfW);
    ctx.closePath();
    ctx.fillStyle = lg;
    ctx.fill();

    /* hot core close to the nozzle */
    var core = ctx.createLinearGradient(0, 0, len * 0.44, 0);
    core.addColorStop(0, 'rgba(' + IVORY + ',' + (0.4 * alpha) + ')');
    core.addColorStop(1, 'rgba(' + CHAMPAGNE + ',0)');
    ctx.beginPath();
    ctx.moveTo(0, -halfW * 0.42);
    ctx.quadraticCurveTo(len * 0.24, -halfW * 0.3, len * 0.44, 0);
    ctx.quadraticCurveTo(len * 0.24, halfW * 0.3, 0, halfW * 0.42);
    ctx.closePath();
    ctx.fillStyle = core;
    ctx.fill();

    /* bloom sitting on the nozzle mouth */
    var bloom = ctx.createRadialGradient(0, 0, 0.5, 0, 0, 20 + e * 22);
    bloom.addColorStop(0, 'rgba(' + IVORY + ',' + (0.3 * alpha) + ')');
    bloom.addColorStop(0.4, 'rgba(' + CHAMPAGNE + ',' + (0.13 * alpha) + ')');
    bloom.addColorStop(1, 'rgba(' + GOLD + ',0)');
    ctx.beginPath();
    ctx.arc(0, 0, 20 + e * 22, 0, Math.PI * 2);
    ctx.fillStyle = bloom;
    ctx.fill();

    ctx.restore();
  };

  /* ---- frame ------------------------------------------------------------ */
  MicCursor.prototype.frame = function () {
    var cfg = this.cfg;
    var ctx = this.ctx;
    this.time += 1;

    var px = this.pos.x, py = this.pos.y;
    this.pos.x += (this.pointer.x - this.pos.x) * cfg.followSpeed;
    this.pos.y += (this.pointer.y - this.pos.y) * cfg.followSpeed;

    var dx = this.pos.x - px, dy = this.pos.y - py;
    var inst = Math.sqrt(dx * dx + dy * dy);
    this.speed += (inst - this.speed) * 0.25;

    /* swing toward travel, unwrapped so it takes the short way round */
    if (inst > 0.35) {
      var target = Math.atan2(dy, dx);
      var diff = target - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.angle += diff * cfg.rotationSpeed;
    }

    /* energy rides velocity and bleeds away when still */
    var want = clamp(this.speed / 17, 0, 1);
    this.energy += (want - this.energy) * (want > this.energy ? 0.3 : cfg.fadeSpeed);

    this.scale += ((1 + this.energy * (cfg.maxScale - 1)) - this.scale) * 0.12;

    var wantPresence = this.pointer.seen ? 1 : 0;
    this.presence += (wantPresence - this.presence) * 0.07;

    /* idle breathing keeps it alive without asking for attention */
    var bobY = 0, bobA = 0;
    if (cfg.idleAnimation) {
      var calm = 1 - this.energy;
      bobY = Math.sin(this.time * 0.021) * 1.9 * calm;
      bobA = Math.sin(this.time * 0.016) * 0.035 * calm;
    }

    if (this.energy > 0.05) {
      this.emit(Math.round((0.6 + this.energy * 3.4) * cfg.particleAmount));
    }

    ctx.clearRect(0, 0, this.w, this.h);

    if (this.presence > 0.004) {
      this.drawPlume(ctx);

      /* particles */
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var i = this.particles.length - 1; i >= 0; i--) {
        var p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.975;
        p.vy *= 0.975;
        p.life -= p.decay;
        if (p.life <= 0) { this.particles.splice(i, 1); continue; }

        var a = p.life * p.life * 0.62 * this.presence * cfg.glowIntensity;
        var d = p.r * 6.8;
        ctx.globalAlpha = a;
        ctx.drawImage(this.dots[p.tone], p.x - d / 2, p.y - d / 2, d, d);
      }
      ctx.restore();

      /* the microphone itself */
      ctx.save();
      ctx.translate(this.pos.x, this.pos.y + bobY);
      ctx.rotate(this.angle + bobA);
      ctx.scale(this.scale, this.scale);
      ctx.globalAlpha = this.presence * cfg.opacity * (0.82 + this.energy * 0.18);
      ctx.drawImage(
        this.sprite,
        -this.spriteOrigin.x, -this.spriteOrigin.y,
        this.spriteSize.w, this.spriteSize.h
      );
      ctx.restore();
    }

    this.raf = global.requestAnimationFrame(this.frame.bind(this));
  };

  /* ---- lifecycle -------------------------------------------------------- */
  MicCursor.prototype.resize = function () {
    var w = global.innerWidth || document.documentElement.clientWidth || 0;
    var h = global.innerHeight || document.documentElement.clientHeight || 0;
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  MicCursor.prototype.start = function () {
    if (this.active || !this.cfg.enabled) return;

    var c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText =
      'position:fixed;top:0;left:0;pointer-events:none;z-index:' +
      this.cfg.zIndex + ';';
    document.body.appendChild(c);

    this.canvas = c;
    this.ctx = c.getContext('2d');
    this.resize();
    this.buildSprite();
    this.buildDots();

    this._onMove = function (e) {
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      if (!this.pointer.seen) {
        this.pointer.seen = true;
        this.pos.x = e.clientX;
        this.pos.y = e.clientY;
      }
    }.bind(this);
    this._onLeave = function () { this.pointer.seen = false; }.bind(this);
    this._onResize = this.resize.bind(this);

    global.addEventListener('pointermove', this._onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', this._onLeave);
    global.addEventListener('blur', this._onLeave);
    global.addEventListener('resize', this._onResize, { passive: true });

    /* A hidden tab or a prerender can report a 0x0 viewport at start-up, and
       coming back into view does not always fire resize — without this the
       canvas would stay 0x0 and the cursor would never appear. */
    if (global.ResizeObserver) {
      this._ro = new global.ResizeObserver(this._onResize);
      this._ro.observe(document.documentElement);
    }

    this.active = true;
    this.raf = global.requestAnimationFrame(this.frame.bind(this));
  };

  MicCursor.prototype.stop = function () {
    if (!this.active) return;
    global.cancelAnimationFrame(this.raf);
    global.removeEventListener('pointermove', this._onMove);
    document.documentElement.removeEventListener('mouseleave', this._onLeave);
    global.removeEventListener('blur', this._onLeave);
    global.removeEventListener('resize', this._onResize);
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.particles.length = 0;
    this.active = false;
  };

  /* ---- entry ------------------------------------------------------------ */
  function create(options) {
    var fine = global.matchMedia('(pointer: fine)').matches;
    var still = global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* no pointer to follow on touch, and motion-sensitive visitors opted out */
    if (!fine || still) return null;

    var inst = new MicCursor(options);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { inst.start(); });
    } else {
      inst.start();
    }

    /* honour a change of heart mid-session */
    var mq = global.matchMedia('(prefers-reduced-motion: reduce)');
    var onChange = function (e) { if (e.matches) inst.stop(); else inst.start(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);

    return inst;
  }

  global.MicCursor = { create: create, MicCursor: MicCursor, DEFAULTS: DEFAULTS };
})(window);
