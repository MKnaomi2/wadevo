/* Wadevo: orbital hero v3 : Apple-style live scroll.
   The hero is a sticky stage (260vh). Scroll progress scrubs the whole
   orbital system: scroll down and it rotates, scroll back and it reverses.
   Ambient drift, trails, pointer gravity, and drag-to-spin layer on top. */

(function () {
  "use strict";

  /* ---------- mobile menu ---------- */
  var menuBtn = document.querySelector(".menu-btn");
  var menuList = document.getElementById("menu-list");
  if (menuBtn && menuList) {
    menuBtn.addEventListener("click", function () {
      var open = menuList.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menuList.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        menuList.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- footer year ---------- */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- scroll reveals ---------- */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- magnetic contact link ---------- */
  var fine = window.matchMedia("(pointer: fine)").matches;
  var bigLink = document.querySelector(".big-link");
  if (bigLink && fine) {
    var bx = 0, by = 0, btx = 0, bty = 0, magRAF = 0;
    function magTick() {
      bx += (btx - bx) * 0.18;
      by += (bty - by) * 0.18;
      bigLink.style.transform = "translate(" + bx.toFixed(2) + "px," + by.toFixed(2) + "px)";
      if (Math.abs(btx - bx) > 0.1 || Math.abs(bty - by) > 0.1) {
        magRAF = requestAnimationFrame(magTick);
      } else { magRAF = 0; }
    }
    bigLink.addEventListener("mousemove", function (e) {
      var r = bigLink.getBoundingClientRect();
      btx = (e.clientX - (r.left + r.width / 2)) * 0.28;
      bty = (e.clientY - (r.top + r.height / 2)) * 0.28;
      if (!magRAF) magRAF = requestAnimationFrame(magTick);
    });
    bigLink.addEventListener("mouseleave", function () {
      btx = 0; bty = 0;
      if (!magRAF) magRAF = requestAnimationFrame(magTick);
    });
  }

  /* ---------- orbits: cinematic system ---------- */
  var canvas = document.getElementById("orbits");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hero = document.querySelector(".hero");
  var heroInner = document.querySelector(".hero-inner");
  var heroFade = document.querySelector(".hero-fade");
  var scrollHint = document.querySelector(".scroll-hint");
  var labelGyre = document.getElementById("label-gyre");
  var labelFinance = document.getElementById("label-finance");
  var labelPlant = document.getElementById("label-plant");

  var W = 0, H = 0;
  var running = true;
  var t0 = performance.now();

  // scrub state: prog is raw scroll progress 0..1, progS is the lerped version
  var prog = 0, progS = 0;

  // pointer parallax + drag state
  var px = 0, py = 0, ptx = 0, pty = 0;
  var spin = 0, spinVel = 0;
  var dragging = false, lastX = 0;

  // Product planets: the Wadevo system. Each has a procedural surface.
  var planets = [
    { orbit: 0, size: 15, color: "#f0784a", dark: "#8a2f12", light: "#ffb287",
      glow: "rgba(232,100,47,0.32)", ring: true, style: "bands", seed: 11,
      phase: 0.9, speed: 0.050, label: labelGyre },
    { orbit: 1, size: 11, color: "#e8c37a", dark: "#7a5a1e", light: "#f7e2ae",
      glow: "rgba(212,162,78,0.28)", style: "mottle", seed: 47,
      phase: 2.8, speed: -0.036, label: labelFinance },
    { orbit: 2, size: 9, color: "#a9c795", dark: "#4a6b3a", light: "#d6e8c4",
      land: "#8a6f4d", glow: "rgba(143,181,115,0.28)", moon: true,
      style: "continents", seed: 83,
      phase: 4.7, speed: 0.028, label: labelPlant }
  ];

  /* ----- procedural planet surfaces ----- */
  function makeNoise2D(seed) {
    var perm = new Array(256);
    for (var i = 0; i < 256; i++) perm[i] = i;
    var s = seed * 16807 % 2147483647;
    function rnd() { s = (s * 16807) % 2147483647; return s / 2147483647; }
    for (var k = 255; k > 0; k--) {
      var j = Math.floor(rnd() * (k + 1));
      var tmp = perm[k]; perm[k] = perm[j]; perm[j] = tmp;
    }
    var p = perm.concat(perm);
    function fade(t) { return t * t * (3 - 2 * t); }
    function grad2(h, x, y) {
      switch (h & 3) {
        case 0: return x + y; case 1: return -x + y;
        case 2: return x - y; default: return -x - y;
      }
    }
    return function (x, y) {
      var xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
      var xf = x - Math.floor(x), yf = y - Math.floor(y);
      var u = fade(xf), v = fade(yf);
      var aa = grad2(p[p[xi] + yi], xf, yf);
      var ab = grad2(p[p[xi] + yi + 1], xf, yf - 1);
      var ba = grad2(p[p[xi + 1] + yi], xf - 1, yf);
      var bb = grad2(p[p[xi + 1] + yi + 1], xf - 1, yf - 1);
      return (aa * (1 - u) + ba * u) * (1 - v) + (ab * (1 - u) + bb * u) * v;
    };
  }

  function hexRGB(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function lerpC(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function makePlanetTexture(p) {
    var S = 220;
    var c = document.createElement("canvas");
    c.width = c.height = S;
    var cx2d = c.getContext("2d");
    var noise = makeNoise2D(p.seed);
    var cBase = hexRGB(p.color), cDark = hexRGB(p.dark), cLight = hexRGB(p.light);
    var cLand = p.land ? hexRGB(p.land) : cDark;
    var img = cx2d.createImageData(S, S);
    var d = img.data;
    for (var j = 0; j < S; j++) {
      for (var i = 0; i < S; i++) {
        var nx = i / S, ny = j / S;
        var dx = (nx - 0.5) * 2, dy = (ny - 0.5) * 2;
        var r = Math.sqrt(dx * dx + dy * dy);
        if (r > 1) continue;
        // fractal noise: 4 octaves
        var n = 0, amp = 1, freq = 5, tot = 0;
        for (var o = 0; o < 4; o++) {
          n += noise(nx * freq + p.seed, ny * freq) * amp;
          tot += amp; amp *= 0.5; freq *= 2.15;
        }
        n /= tot; // ~ -1..1
        var tn = n * 0.5 + 0.5; // 0..1
        var col;
        if (p.style === "bands") {
          // gas giant: swirling horizontal bands
          var band = Math.sin(ny * 16 + n * 5.2 + Math.sin(nx * 6 + n * 3) * 1.4) * 0.5 + 0.5;
          var t = band * 0.62 + tn * 0.38;
          col = lerpC(cDark, cLight, Math.pow(t, 1.25));
          // storm spot
          var sx = nx - 0.68, sy = ny - 0.38;
          if (Math.sqrt(sx * sx * 4 + sy * sy * 9) < 0.16) col = lerpC(col, cLight, 0.55);
        } else if (p.style === "mottle") {
          // metallic rock: fine mottling
          var t2 = Math.pow(tn, 1.4);
          col = lerpC(cDark, cLight, t2);
        } else { // continents
          if (tn > 0.54) col = lerpC(cLand, cLight, Math.min(1, (tn - 0.54) * 3.2));
          else col = lerpC(cDark, cBase, tn * 1.55);
        }
        // spherical limb darkening baked in
        var shade = Math.sqrt(Math.max(0, 1 - r * r));
        var sh = 0.52 + 0.48 * shade;
        var idx = (j * S + i) * 4;
        d[idx] = Math.min(255, col[0] * sh);
        d[idx + 1] = Math.min(255, col[1] * sh);
        d[idx + 2] = Math.min(255, col[2] * sh);
        d[idx + 3] = 255;
      }
    }
    cx2d.putImageData(img, 0, 0);
    return c;
  }

  // pre-render surfaces once (not per frame)
  planets.forEach(function (p) { p.tex = makePlanetTexture(p); });

  /* ----- flowing currents: river-like particle streams ----- */
  var currents = [];
  var N_CURRENTS = 0;
  var scrollVel = 0, lastProg = 0;

  function initCurrents() {
    N_CURRENTS = W < 700 ? 70 : 140;
    currents = [];
    for (var i = 0; i < N_CURRENTS; i++) currents.push(newCurrent(true));
  }
  function newCurrent(scatter) {
    // spawn near the sun, in one of 8 river channels for coherent streams
    var channel = Math.floor(Math.random() * 8);
    var a = (channel / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    var r0 = 14 + Math.random() * 30;
    var life = 1;
    if (scatter) life = Math.random();
    return {
      a: a,
      r: r0 + (1 - life) * 0, // radius grows as it flows
      life: life,
      maxR: 0, // set per-frame from geometry
      speed: 0.30 + Math.random() * 0.55,
      size: 1.1 + Math.random() * 2.6,
      hue: Math.random(),
      wob: Math.random() * Math.PI * 2,
      wobSpeed: 0.6 + Math.random() * 1.4
    };
  }
  function currentColor(h) {
    // coral -> gold -> amber river palette
    if (h < 0.45) return "232,100,47";
    if (h < 0.75) return "212,162,78";
    return "240,200,130";
  }

  function drawCurrents(t, g, systemRot, zoom) {
    // track scroll velocity for flow energy
    scrollVel += ((prog - lastProg) * 60 - scrollVel) * 0.12;
    lastProg = prog;
    var energy = Math.min(3, 1 + Math.abs(scrollVel) * 22);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < currents.length; i++) {
      var c = currents[i];
      if (c.maxR === 0) c.maxR = g.base * 0.62 * zoom;
      // advance life; flow speed scales with scroll energy
      c.life += 0.0035 * c.speed * energy * (reduceMotion ? 0 : 1);
      if (c.life >= 1) {
        currents[i] = newCurrent(false);
        continue;
      }
      // radius: ease-out from sun to maxR
      var rr = 18 + (c.maxR - 18) * (1 - Math.pow(1 - c.life, 2.2));
      // angle: slow swirl + wobble, energized by scroll
      var aa = c.a + systemRot * 0.35 + t * 0.05 * c.speed
        + Math.sin(t * c.wobSpeed + c.wob) * 0.14 * energy;
      var x = Math.cos(aa) * rr * 1.32;
      var y = Math.sin(aa) * rr * 0.60;
      // fade in/out along life
      var fade = Math.sin(c.life * Math.PI);
      var alpha = 0.52 * fade * Math.min(1.4, energy);
      var sz = c.size * (0.6 + c.life * 0.9);
      ctx.fillStyle = "rgba(" + currentColor(c.hue) + "," + alpha.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(x, y, sz, 0, Math.PI * 2);
      ctx.fill();
      // trailing streak: short line back along the flow direction
      if (!reduceMotion && energy > 1.05) {
        var tx = x - Math.cos(aa) * sz * 4 * energy;
        var ty = y - Math.sin(aa) * sz * 4 * energy * 0.45;
        ctx.strokeStyle = "rgba(" + currentColor(c.hue) + "," + (alpha * 0.5).toFixed(3) + ")";
        ctx.lineWidth = sz * 0.7;
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Starfield: generated per resize, 3 parallax layers.
  var stars = [];
  function makeStars() {
    stars = [];
    var n = W < 700 ? 90 : 190;
    for (var i = 0; i < n; i++) {
      stars.push({
        x: Math.random(), y: Math.random(),
        r: Math.random() * 1.4 + 0.3,
        layer: Math.floor(Math.random() * 3),
        tw: Math.random() * Math.PI * 2,
        ts: 0.6 + Math.random() * 1.8
      });
    }
  }

  function resize() {
    var r = canvas.parentElement.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeStars();
    initCurrents();
  }

  function geom() {
    var wide = W > 900;
    return {
      cx: wide ? W * 0.72 : W * 0.5,
      cy: H * 0.48,
      base: Math.min(W, H)
    };
  }

  function orbitRadii(i, base) {
    var s = [0.20, 0.32, 0.45][i % 3] * base;
    return { rx: s * 1.38, ry: s * 0.60, rot: -0.30 };
  }

  function onScroll() {
    if (!hero) return;
    var r = hero.getBoundingClientRect();
    var runway = Math.max(1, r.height - window.innerHeight);
    prog = Math.min(1, Math.max(0, -r.top / runway));
  }

  function setLabel(el, on) {
    if (!el) return;
    if (on) el.classList.add("on");
    else el.classList.remove("on");
  }

  function drawPlanet(p, x, y, t) {
    var R = p.size;

    // halo
    var glowR = R * 3.4;
    var gg = ctx.createRadialGradient(x, y, R * 0.4, x, y, glowR);
    gg.addColorStop(0, p.glow);
    gg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(x, y, glowR, 0, Math.PI * 2); ctx.fill();

    // ring behind the sphere (GYRE): layered bands with varying opacity
    if (p.ring) {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(-0.42);
      var bands = [
        { rx: 2.35, op: 0.10, w: 7 }, { rx: 2.05, op: 0.30, w: 2.5 },
        { rx: 1.78, op: 0.14, w: 5 }, { rx: 1.55, op: 0.36, w: 2 }
      ];
      for (var bi = 0; bi < bands.length; bi++) {
        var b = bands[bi];
        ctx.beginPath();
        ctx.ellipse(0, 0, R * b.rx, R * b.rx * 0.32, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(251,246,238," + b.op + ")";
        ctx.lineWidth = b.w;
        ctx.stroke();
      }
      ctx.restore();
    }

    // direction to the sun (system center) for lighting
    var toSun = Math.atan2(-y, -x);
    var sx = Math.cos(toSun), sy = Math.sin(toSun);

    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.clip();

    // textured surface with slow drift
    var drift = reduceMotion ? 0 : Math.sin(t * 0.12 + p.phase) * R * 0.10;
    ctx.drawImage(p.tex, x - R + drift, y - R, R * 2, R * 2);

    // day/night terminator: night falls away from the sun
    var tg = ctx.createLinearGradient(
      x + sx * R, y + sy * R, x - sx * R, y - sy * R);
    tg.addColorStop(0, "rgba(0,0,0,0)");
    tg.addColorStop(0.52, "rgba(0,0,0,0)");
    tg.addColorStop(0.82, "rgba(4,2,2,0.42)");
    tg.addColorStop(1, "rgba(4,2,2,0.72)");
    ctx.fillStyle = tg;
    ctx.fillRect(x - R, y - R, R * 2, R * 2);

    // sun glint: specular highlight on the lit limb
    var gx = x + sx * R * 0.42, gy = y + sy * R * 0.42;
    var spec = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * 0.55);
    spec.addColorStop(0, "rgba(255,242,224,0.38)");
    spec.addColorStop(1, "rgba(255,242,224,0)");
    ctx.fillStyle = spec;
    ctx.fillRect(x - R, y - R, R * 2, R * 2);
    ctx.restore();

    // atmospheric rim: fresnel-style limb glow, biased to the lit side
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.clip();
    var rim = ctx.createRadialGradient(x, y, R * 0.72, x, y, R * 1.02);
    rim.addColorStop(0, "rgba(0,0,0,0)");
    rim.addColorStop(0.82, "rgba(0,0,0,0)");
    rim.addColorStop(1, p.glow.replace(/[\d.]+\)$/, "0.55)"));
    ctx.fillStyle = rim;
    ctx.fillRect(x - R, y - R, R * 2, R * 2);
    ctx.restore();

    // crisp limb
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(251,246,238,0.10)"; ctx.lineWidth = 1; ctx.stroke();

    // moon (Plant ID)
    if (p.moon && !reduceMotion) {
      var ma = t * 0.9 + 1.2;
      var mx = x + Math.cos(ma) * R * 2.5;
      var my = y + Math.sin(ma) * R * 2.5 * 0.55;
      var mg = ctx.createRadialGradient(mx - 1, my - 1, 0.5, mx, my, Math.max(2.5, R * 0.26));
      mg.addColorStop(0, "#e8dcc2");
      mg.addColorStop(1, "#8a7c62");
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(mx, my, Math.max(2, R * 0.26), 0, Math.PI * 2); ctx.fill();
    }
  }

  function draw(now) {
    var t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    var g = geom();

    // buttery scrub
    progS += (prog - progS) * 0.085;
    if (Math.abs(prog - progS) < 0.0004) progS = prog;

    px += (ptx - px) * 0.045;
    py += (pty - py) * 0.045;
    spin += spinVel;
    if (!dragging) spinVel *= 0.96;

    var systemRot = progS * Math.PI * 2 * 1.15 + spin;
    // camera pushes in as you scroll: the journey into the system
    var zoom = 1 + progS * 0.42;

    /* ----- phased UI ----- */
    if (!reduceMotion) {
      if (heroInner) {
        var fade = Math.min(1, progS * 2.6);
        heroInner.style.opacity = String(1 - fade);
        heroInner.style.transform = "translateY(" + (-progS * 110).toFixed(1) + "px)";
      }
      if (scrollHint) scrollHint.style.opacity = String(Math.max(0, 1 - progS * 9));
      // planet callouts: each owns a scroll chapter
      setLabel(labelGyre, progS > 0.30 && progS < 0.55);
      setLabel(labelFinance, progS > 0.55 && progS < 0.78);
      setLabel(labelPlant, progS > 0.78 && progS < 0.94);
      if (heroFade) {
        // long, eased dissolve: starts at 68%, fully paper by 100%
        var f = Math.max(0, (progS - 0.68) / 0.32);
        f = f * f * (3 - 2 * f); // smoothstep: no abrupt start or end
        heroFade.style.opacity = f.toFixed(3);
      }
      // the starfield itself dissolves as the dawn washes in
      var cf = Math.max(0, (progS - 0.74) / 0.26);
      cf = cf * cf * (3 - 2 * cf);
      canvas.style.opacity = String((1 - cf * 0.94).toFixed(3));
    }

    /* ----- space ----- */
    // nebulae: huge, faint, slow-drifting color fields
    var nebulae = [
      { x: 0.22, y: 0.30, r: 0.55, c: "rgba(194,67,31,0.10)" },
      { x: 0.80, y: 0.72, r: 0.60, c: "rgba(84,102,180,0.10)" },
      { x: 0.62, y: 0.16, r: 0.42, c: "rgba(60,140,150,0.07)" }
    ];
    for (var ni = 0; ni < nebulae.length; ni++) {
      var nb = nebulae[ni];
      var nx = (nb.x + Math.sin(t * 0.05 + ni * 2.1) * 0.02) * W;
      var ny = (nb.y + Math.cos(t * 0.04 + ni * 1.7) * 0.02) * H;
      var nr = nb.r * Math.max(W, H);
      var ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      ng.addColorStop(0, nb.c);
      ng.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ng;
      ctx.fillRect(0, 0, W, H);
    }

    // starfield with parallax against pointer + scroll drift
    for (var si = 0; si < stars.length; si++) {
      var s = stars[si];
      var depth = [0.25, 0.55, 1][s.layer];
      var sx = s.x * W + px * 22 * depth + progS * 30 * depth;
      var sy = s.y * H + py * 16 * depth;
      // wrap
      sx = ((sx % W) + W) % W;
      sy = ((sy % H) + H) % H;
      var tw = reduceMotion ? 0.8 : 0.55 + 0.45 * Math.sin(t * s.ts + s.tw);
      ctx.globalAlpha = (0.25 + 0.55 * depth) * tw;
      ctx.fillStyle = "#f5efe2";
      ctx.beginPath(); ctx.arc(sx, sy, s.r * (0.7 + 0.5 * depth), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* ----- the system ----- */
    ctx.save();
    ctx.translate(g.cx + px * 14, g.cy + py * 10);
    ctx.scale(zoom, zoom);

    // orbit paths
    for (var i = 0; i < 3; i++) {
      var rr = orbitRadii(i, g.base);
      ctx.save();
      ctx.rotate(rr.rot + systemRot * 0.10);
      ctx.beginPath();
      ctx.ellipse(0, 0, rr.rx, rr.ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(251,246,238,0.10)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // central sun: the Wadevo core
    var sunR = Math.max(10, g.base * 0.028);
    var sunGlow = ctx.createRadialGradient(0, 0, sunR * 0.3, 0, 0, sunR * 6);
    sunGlow.addColorStop(0, "rgba(232,100,47,0.55)");
    sunGlow.addColorStop(0.4, "rgba(232,100,47,0.18)");
    sunGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sunGlow;
    ctx.beginPath(); ctx.arc(0, 0, sunR * 6, 0, Math.PI * 2); ctx.fill();
    var coreG = ctx.createRadialGradient(-sunR * 0.3, -sunR * 0.3, sunR * 0.1, 0, 0, sunR);
    coreG.addColorStop(0, "#ffd9a8");
    coreG.addColorStop(0.6, "#e8642f");
    coreG.addColorStop(1, "#8a2f12");
    ctx.fillStyle = coreG;
    ctx.beginPath(); ctx.arc(0, 0, sunR, 0, Math.PI * 2); ctx.fill();
    // orbit glyph ring around the sun (the wordmark mark, writ large)
    ctx.beginPath(); ctx.arc(0, 0, sunR * 2.1, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(251,246,238,0.22)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "#e8642f";
    ctx.beginPath(); ctx.arc(sunR * 2.1 * Math.cos(-0.7), sunR * 2.1 * Math.sin(-0.7), sunR * 0.32, 0, Math.PI * 2); ctx.fill();

    // planets
    for (var k = 0; k < planets.length; k++) {
      var p = planets[k];
      var pr = orbitRadii(p.orbit, g.base);
      var a = p.phase + (reduceMotion ? 0 : t * p.speed) + systemRot;
      var ex = Math.cos(a) * pr.rx, ey = Math.sin(a) * pr.ry;
      var rot = pr.rot + systemRot * 0.10;
      var lx = ex * Math.cos(rot) - ey * Math.sin(rot);
      var ly = ex * Math.sin(rot) + ey * Math.cos(rot);
      drawPlanet(p, lx, ly, t);
    }

    // flowing currents: river-like streams from the sun
    if (!reduceMotion) drawCurrents(t, g, systemRot, zoom);

    ctx.restore();

    if (running && !reduceMotion) requestAnimationFrame(draw);
  }

  window.addEventListener("resize", function () { resize(); if (reduceMotion) draw(performance.now()); });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("mousemove", function (e) {
    ptx = (e.clientX / window.innerWidth - 0.5) * 2;
    pty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  canvas.parentElement.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse") return;
    dragging = true; lastX = e.clientX;
  });
  window.addEventListener("pointermove", function (e) {
    if (!dragging || e.pointerType !== "mouse") return;
    var dx = e.clientX - lastX;
    lastX = e.clientX;
    spinVel = dx * 0.0016;
  });
  window.addEventListener("pointerup", function () { dragging = false; });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      var vis = entries[0].isIntersecting;
      if (vis && !running && !reduceMotion) { running = true; t0 = performance.now() - 1000; requestAnimationFrame(draw); }
      running = vis;
    }).observe(canvas.parentElement);
  }

  resize();
  onScroll();
  if (reduceMotion) { progS = prog; draw(t0 + 6000); }
  else requestAnimationFrame(draw);
})();
