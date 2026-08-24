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
    segments:       15,     // pieces the microphone parts into while moving
    stretch:        1,      // separation multiplier
    bond:           1,      // brightness of the links between pieces
    maxScale:       1.16,
    idleAnimation:  true,
    micLength:      118,    // px from head to nozzle
    zIndex:         60,     // above content, below nav and dialogs
    mode:           'pointer' // 'pointer' on mice, 'scroll' on touch
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

    /* Geometry follows the reference: the microphone is not in line with the
       stand, it breaks away from it at about 30 degrees, so head and boom
       together read as a Γ. The head sits on the pointer at the origin, the
       joint sits back and below it, and the stand runs on from there. */
    var TILT = Math.PI / 6;              // 30 degrees
    var BODY = 50;                       // head centre to joint
    var jx = -Math.cos(TILT) * BODY;     // ≈ -43.3
    var jy = Math.sin(TILT) * BODY;      // ≈ +25
    this.standY = jy;
    this.nozzle = { x: -L + 5, y: jy };

    /* --- the stand: thin shaft running back to the nozzle --- */
    g.save();
    g.translate(0, jy);
    roundedBar(-L + 4, 0, L - 4 + jx - 4, 5.4, 2.6);
    g.fillStyle = metal(0, -3, 0, 3, 1);
    g.fill();

    /* nozzle disc, seen almost edge-on */
    g.beginPath();
    g.ellipse(-L + 5, 0, 4.2, 12.5, 0, 0, Math.PI * 2);
    g.fillStyle = metal(-L, -12, -L, 12, 0.95);
    g.fill();
    g.restore();

    /* --- clamp at the break, bridging stand and body --- */
    g.save();
    g.translate(jx, jy);
    g.rotate(-TILT / 2);
    roundedBar(-8, 0, 19, 14, 3.4);
    g.fillStyle = metal(0, -7, 0, 7, 0.92);
    g.fill();
    g.restore();

    /* --- microphone body, angled up off the stand toward the head --- */
    g.save();
    g.translate(jx, jy);
    g.rotate(-TILT);                     // +X now points at the head
    g.beginPath();
    g.moveTo(2, -5.4);
    g.lineTo(BODY - 14, -7.6);
    g.quadraticCurveTo(BODY - 9, -7.6, BODY - 9, -4.4);
    g.lineTo(BODY - 9, 4.4);
    g.quadraticCurveTo(BODY - 9, 7.6, BODY - 14, 7.6);
    g.lineTo(2, 5.4);
    g.quadraticCurveTo(-1, 4.2, -1, 0);
    g.quadraticCurveTo(-1, -4.2, 2, -5.4);
    g.closePath();
    g.fillStyle = metal(0, -7.6, 0, 7.6, 1);
    g.fill();
    /* collar rings near the grille */
    g.fillStyle = 'rgba(' + AMBER + ',0.5)';
    g.fillRect(BODY - 20, -7, 1.7, 14);
    g.fillRect(BODY - 26, -6.6, 1.7, 13.2);
    g.restore();

    /* --- ball grille, sitting on the pointer --- */
    var hx = 0, hy = 0, hr = 13.4;
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
    this.buildSlices();
  };

  /* ---- the microphone, cut into pieces --------------------------------
     The rig is one sprite at rest and a column of strips once it moves.
     Each strip carries its own position and angle and chases the rig with
     its own delay, so travel pulls the form apart along the path it took
     and stillness lets it close back up.

     The added gap is the same at every joint rather than proportional to
     how far back the strip sits. That matters because the sprite is wiped
     out toward the tail — a proportional stretch would spend almost all of
     its movement on the part that has already faded to nothing, and the
     visible half would barely open at all.

     Strips run rear to front, so k counts joints forward from the head:
     the head holds station and everything behind it trails by k. */
  MicCursor.prototype.buildSlices = function () {
    var n = Math.max(4, this.cfg.segments | 0);
    var ox = this.spriteOrigin.x;
    var L = this.cfg.micLength;
    var x0 = ox - L - 8;
    var x1 = ox + 19;
    var sw = (x1 - x0) / n;

    this.slices = [];
    for (var i = 0; i < n; i++) {
      var sx = x0 + i * sw;
      this.slices.push({
        sx: sx,
        sw: sw,
        cx: sx + sw / 2 - ox,          // resting offset from the head
        k: (n - 1 - i),                // joints behind the head
        kn: (n - 1 - i) / (n - 1),     // the same, normalised
        phase: Math.random() * Math.PI * 2,
        x: 0, y: 0, ang: 0
      });
    }
    this._placed = false;
  };

  /* Separation is driven by energy, so it opens on movement and closes the
     moment the pointer rests. Nothing here is a timer: the same value that
     lengthens the plume pulls the body apart, which is what keeps the two
     reading as one object rather than two effects. */
  MicCursor.prototype.updateSlices = function () {
    var sl = this.slices;
    if (!sl || !sl.length) return;

    var cos = Math.cos(this.angle), sin = Math.sin(this.angle);
    var s = this.scale;
    var pull = this.energy * 4.4 * this.cfg.stretch;
    var i, o, off, perp, tx, ty, f, da;

    for (i = 0; i < sl.length; i++) {
      o = sl[i];
      off = (o.cx - pull * o.k) * s;
      /* a little sideways drift so it breathes apart instead of telescoping */
      perp = Math.sin(this.time * 0.055 + o.phase) * this.energy * 2.6 * o.kn * s;

      tx = this.pos.x + off * cos - perp * sin;
      ty = this.pos.y + off * sin + perp * cos;

      if (!this._placed) { o.x = tx; o.y = ty; o.ang = this.angle; continue; }

      /* the head answers at once, the tail drags — that spread of delay is
         what bends the column along the path instead of sliding it */
      f = 0.44 - 0.31 * o.kn;
      o.x += (tx - o.x) * f;
      o.y += (ty - o.y) * f;

      da = this.angle - o.ang;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      o.ang += da * f;
    }
    if (!this._placed && this.pointer.seen) this._placed = true;
  };

  /* The links. A bond only exists where a joint has actually opened, and it
     thins and dims as it is drawn out, so the effect announces itself on
     movement and disappears completely once the pieces close up. */
  MicCursor.prototype.drawBonds = function (ctx) {
    var sl = this.slices;
    if (!sl || sl.length < 2 || this.energy < 0.05) return;

    var lim = 30 * this.scale;
    var base = this.presence * this.cfg.glowIntensity * this.cfg.bond * this.energy;
    if (base < 0.01) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (var i = 1; i < sl.length; i++) {
      var a = sl[i - 1], b = sl[i];
      var dx = b.x - a.x, dy = b.y - a.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var gap = d - Math.abs(b.cx - a.cx) * this.scale;
      if (gap <= 0.7) continue;

      var t = clamp(gap / lim, 0, 1);
      var alpha = base * (1 - t) * 0.62;
      if (alpha < 0.004) continue;

      ctx.strokeStyle = 'rgba(' + CHAMPAGNE + ',' + alpha.toFixed(4) + ')';
      ctx.lineWidth = Math.max(0.45, (1.8 - t * 1.25) * this.scale);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  };

  /* Assembled, the rig is blitted whole: strips laid edge to edge can leave
     hairline seams, and there is no reason to pay for them while nothing is
     moving. The swap happens where separation is still under a pixel, so it
     is not visible. */
  MicCursor.prototype.drawMic = function (ctx, bobY, bobA) {
    var alpha = this.presence * this.cfg.opacity * (0.82 + this.energy * 0.18);
    var sl = this.slices;

    if (!sl || !sl.length || !this._placed || this.energy < 0.02) {
      ctx.save();
      ctx.translate(this.pos.x, this.pos.y + bobY);
      ctx.rotate(this.angle + bobA);
      ctx.scale(this.scale, this.scale);
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.sprite,
        -this.spriteOrigin.x, -this.spriteOrigin.y,
        this.spriteSize.w, this.spriteSize.h);
      ctx.restore();
      return;
    }

    var dpr = this.dpr, h = this.spriteSize.h, oy = this.spriteOrigin.y;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (var i = 0; i < sl.length; i++) {
      var o = sl[i];
      ctx.save();
      ctx.translate(o.x, o.y + bobY);
      ctx.rotate(o.ang + bobA);
      ctx.scale(this.scale, this.scale);
      ctx.drawImage(this.sprite,
        o.sx * dpr, 0, o.sw * dpr, h * dpr,
        -o.sw / 2, -oy, o.sw, h);
      ctx.restore();
    }
    ctx.restore();
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
  /* The nozzle no longer sits on the axis through the head — the stand is
     offset below it — so its world position needs the full rotation. */
  MicCursor.prototype.nozzleAt = function () {
    var n = this.nozzle || { x: -this.cfg.micLength, y: 0 };
    var s = this.scale;

    /* Once the rig is in pieces the nozzle travels with the hindmost one,
       so the plume stays attached to the end of the column instead of
       hanging in the gap the stretch just opened. */
    var sl = this.slices;
    if (sl && sl.length && this._placed) {
      var tail = sl[0];
      var tc = Math.cos(tail.ang), ts = Math.sin(tail.ang);
      return {
        x: tail.x - n.y * ts * s,
        y: tail.y + n.y * tc * s
      };
    }

    var cos = Math.cos(this.angle), sin = Math.sin(this.angle);
    return {
      x: this.pos.x + (n.x * cos - n.y * sin) * s,
      y: this.pos.y + (n.x * sin + n.y * cos) * s
    };
  };

  MicCursor.prototype.emit = function (count) {
    var cfg = this.cfg;
    var n = this.nozzleAt();
    var nx = n.x, ny = n.y;

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
    var n = this.nozzleAt();

    ctx.save();
    ctx.translate(n.x, n.y);
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

    this.updateSlices();

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

      /* the links first, so the pieces sit over them */
      this.drawBonds(ctx);
      this.drawMic(ctx, bobY, bobA);
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

    if (this.cfg.mode === 'scroll') {
      /* On a phone the finger is the pointer. A scroll gesture is itself a
         touchmove, so following the finger hands touch the same rig the
         mouse gets — the swing, the plume, the way the body comes apart
         while travelling — rather than a thinner effect wired to scroll
         events alone. Scroll still drives it, but only through the momentum
         phase, once the finger has lifted and there is nothing to follow.

         Reacting to scroll only was why the rig barely registered here: it
         moved between two fixed points on the right of the screen, well
         away from where anyone was looking. */
      this._lastY = global.scrollY;
      this._idleTimer = null;
      this._touching = false;

      var hold = function (ms) {
        clearTimeout(this._idleTimer);
        this._idleTimer = setTimeout(function () {
          this.pointer.seen = false;
        }.bind(this), ms);
      }.bind(this);

      var toFinger = function (e) {
        var t = (e.touches && e.touches[0]) ||
                (e.changedTouches && e.changedTouches[0]);
        if (!t) return;
        this.pointer.x = t.clientX;
        this.pointer.y = t.clientY;
        if (!this.pointer.seen) {
          this.pointer.seen = true;
          this.pos.x = t.clientX;
          this.pos.y = t.clientY;
        }
      }.bind(this);

      this._onTouchStart = function (e) {
        this._touching = true;
        clearTimeout(this._idleTimer);
        toFinger(e);
        this.energy = Math.max(this.energy, 0.45);
        this.emit(10);
      }.bind(this);

      this._onTouchMove = toFinger;

      this._onTouchEnd = function () {
        this._touching = false;
        hold(1100);
      }.bind(this);

      /* Momentum. The page keeps travelling after the finger goes, so the
         rig is thrown against the direction of travel and chases back —
         the same lag that gives the pointer version its weight. */
      this._onPageScroll = function () {
        var y = global.scrollY;
        var d = y - this._lastY;
        this._lastY = y;
        if (this._touching) return;

        var restX = this.w * 0.74;
        var restY = this.h * 0.5;
        var throwY = clamp(-d * 5.5, -this.h * 0.3, this.h * 0.3);

        this.pointer.x = restX;
        this.pointer.y = restY + throwY;
        if (!this.pointer.seen) {
          this.pointer.seen = true;
          this.pos.x = restX;
          this.pos.y = restY;
        }
        hold(900);
      }.bind(this);

      global.addEventListener('scroll', this._onPageScroll, { passive: true });
      global.addEventListener('touchstart', this._onTouchStart, { passive: true });
      global.addEventListener('touchmove', this._onTouchMove, { passive: true });
      global.addEventListener('touchend', this._onTouchEnd, { passive: true });
      global.addEventListener('touchcancel', this._onTouchEnd, { passive: true });
    } else {
      global.addEventListener('pointermove', this._onMove, { passive: true });
      document.documentElement.addEventListener('mouseleave', this._onLeave);
      global.addEventListener('blur', this._onLeave);
    }
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
    if (this._onPageScroll) global.removeEventListener('scroll', this._onPageScroll);
    if (this._onTouchStart) {
      global.removeEventListener('touchstart', this._onTouchStart);
      global.removeEventListener('touchmove', this._onTouchMove);
      global.removeEventListener('touchend', this._onTouchEnd);
      global.removeEventListener('touchcancel', this._onTouchEnd);
    }
    clearTimeout(this._idleTimer);
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

    /* motion-sensitive visitors opted out */
    if (still) return null;

    /* Touch has no pointer to follow, so the rig rides the scroll instead —
       same object, same physics, driven by the gesture that device actually
       has. It shows while the page is moving and withdraws once it stops, so
       it never sits on top of something being read. */
    var opts = {};
    var k;
    if (options) for (k in options) opts[k] = options[k];
    if (!fine) {
      opts.mode = 'scroll';
      if (opts.micLength === undefined) opts.micLength = 98;
      if (opts.opacity === undefined) opts.opacity = 0.38;
      if (opts.particleAmount === undefined) opts.particleAmount = 0.85;
    }

    var inst = new MicCursor(opts);
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
