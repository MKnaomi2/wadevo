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

  // Product planets: the Wadevo system.
  var planets = [
    { orbit: 0, size: 15, color: "#f0784a", dark: "#8a2f12",
      glow: "rgba(232,100,47,0.32)", ring: true,
      phase: 0.9, speed: 0.050, label: labelGyre },
    { orbit: 1, size: 11, color: "#e8c37a", dark: "#7a5a1e",
      glow: "rgba(212,162,78,0.28)",
      phase: 2.8, speed: -0.036, label: labelFinance },
    { orbit: 2, size: 9, color: "#a9c795", dark: "#4a6b3a",
      glow: "rgba(143,181,115,0.28)", moon: true,
      phase: 4.7, speed: 0.028, label: labelPlant }
  ];

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
    // halo
    var glowR = p.size * 3.4;
    var gg = ctx.createRadialGradient(x, y, p.size * 0.4, x, y, glowR);
    gg.addColorStop(0, p.glow);
    gg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(x, y, glowR, 0, Math.PI * 2); ctx.fill();

    // ring behind the sphere (GYRE)
    if (p.ring) {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(-0.42);
      ctx.beginPath(); ctx.ellipse(0, 0, p.size * 2.2, p.size * 0.72, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(251,246,238,0.32)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, p.size * 2.2, p.size * 0.72, 0, 0.3, Math.PI - 0.3);
      ctx.strokeStyle = "rgba(251,246,238,0.12)"; ctx.lineWidth = 5; ctx.stroke();
      ctx.restore();
    }

    // sphere with lit limb
    var sg = ctx.createRadialGradient(
      x - p.size * 0.38, y - p.size * 0.38, p.size * 0.08, x, y, p.size * 1.05);
    sg.addColorStop(0, p.color);
    sg.addColorStop(0.55, p.color);
    sg.addColorStop(1, p.dark);
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2); ctx.fill();

    // moon (Plant ID)
    if (p.moon && !reduceMotion) {
      var ma = t * 0.9 + 1.2;
      var mx = x + Math.cos(ma) * p.size * 2.5;
      var my = y + Math.sin(ma) * p.size * 2.5 * 0.55;
      ctx.fillStyle = "#cfc2ab";
      ctx.beginPath(); ctx.arc(mx, my, Math.max(2, p.size * 0.26), 0, Math.PI * 2); ctx.fill();
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
