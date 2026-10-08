/* Wadevo Studios: orbital hero v2 — interactive system.
   - Slow elliptical orbits with fading trails (coral body leads)
   - Pointer gravity: bodies lean gently toward the cursor (fine pointers only)
   - Drag horizontally to spin the whole system, with inertia
   - Scroll parallax: the system drifts and settles as you leave the hero
   - Pauses offscreen; single still frame under prefers-reduced-motion */

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

  /* ---------- orbits ---------- */
  var canvas = document.getElementById("orbits");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 0, H = 0;
  var running = true;
  var t0 = performance.now();

  // parallax + drag state
  var px = 0, py = 0, ptx = 0, pty = 0;   // pointer parallax (lerped)
  var spin = 0, spinVel = 0;              // system rotation from drag
  var dragging = false, lastX = 0;
  var scrollK = 0;                        // 0 at hero top → 1 when scrolled past

  var bodies = [
    { orbit: 0, size: 5.5, speed: 0.10, phase: 0.4, color: "#1b1512", alpha: 0.8, trail: 26 },
    { orbit: 1, size: 4, speed: -0.065, phase: 2.2, color: "#1b1512", alpha: 0.5, trail: 20 },
    { orbit: 2, size: 7, speed: 0.045, phase: 4.0, color: "#d9481f", alpha: 1, trail: 46 },
    { orbit: 3, size: 3.5, speed: -0.032, phase: 1.1, color: "#1b1512", alpha: 0.38, trail: 16 },
    { orbit: 1, size: 3, speed: 0.085, phase: 5.1, color: "#c2431f", alpha: 0.85, trail: 24 }
  ];
  bodies.forEach(function (b) { b.hist = []; });

  function resize() {
    var r = canvas.parentElement.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function geom() {
    var wide = W > 900;
    return {
      cx: wide ? W * 0.74 : W * 0.5,
      cy: H * 0.46,
      dim: wide ? 1 : 0.5,
      base: Math.min(W, H)
    };
  }

  function orbitRadii(i, base) {
    var s = [0.16, 0.26, 0.37, 0.48][i % 4] * base;
    return { rx: s * 1.35, ry: s * 0.62, rot: -0.32 };
  }

  function bodyPos(bd, t, g) {
    var rr = orbitRadii(bd.orbit, g.base);
    var a = bd.phase + t * bd.speed + spin;
    var ex = Math.cos(a) * rr.rx, ey = Math.sin(a) * rr.ry;
    return {
      x: ex * Math.cos(rr.rot) - ey * Math.sin(rr.rot),
      y: ex * Math.sin(rr.rot) + ey * Math.cos(rr.rot)
    };
  }

  function draw(now) {
    var t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    var g = geom();

    px += (ptx - px) * 0.045;
    py += (pty - py) * 0.045;
    if (!dragging) spinVel *= 0.96;
    spin += spinVel;

    // scroll: drift up and settle as the hero leaves
    var sy = scrollK * H * 0.22;
    var ss = 1 - scrollK * 0.12;

    ctx.save();
    ctx.translate(g.cx + px * 16, g.cy + py * 12 - sy);
    ctx.scale(ss, ss);

    // orbit paths
    for (var i = 0; i < 4; i++) {
      var r = orbitRadii(i, g.base);
      ctx.save();
      ctx.rotate(r.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, r.rx, r.ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(27,21,18," + (0.11 * g.dim) + ")";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // pointer gravity in system space
    var gx = 0, gy = 0;
    if (fine && !reduceMotion) {
      gx = px * 60; gy = py * 44;
    }

    // bodies + trails
    for (var k = 0; k < bodies.length; k++) {
      var bd = bodies[k];
      var p = bodyPos(bd, t, g);

      // gentle pull toward pointer
      if (gx || gy) {
        var dx = gx - p.x, dy = gy - p.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        var pull = Math.max(0, 1 - d / (g.base * 0.55)) * 26;
        p.x += (dx / d) * pull;
        p.y += (dy / d) * pull;
      }

      bd.hist.push({ x: p.x, y: p.y });
      if (bd.hist.length > bd.trail) bd.hist.shift();

      // trail
      if (bd.hist.length > 2 && !reduceMotion) {
        ctx.beginPath();
        ctx.moveTo(bd.hist[0].x, bd.hist[0].y);
        for (var h = 1; h < bd.hist.length; h++) ctx.lineTo(bd.hist[h].x, bd.hist[h].y);
        ctx.strokeStyle = bd.color;
        ctx.globalAlpha = bd.alpha * 0.28 * g.dim;
        ctx.lineWidth = bd.size * 0.7;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, bd.size, 0, Math.PI * 2);
      ctx.fillStyle = bd.color;
      ctx.globalAlpha = bd.alpha * g.dim;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (running && !reduceMotion) requestAnimationFrame(draw);
  }

  function onScroll() {
    var hero = canvas.parentElement;
    var r = hero.getBoundingClientRect();
    scrollK = Math.min(1, Math.max(0, -r.top / (r.height * 0.9)));
  }

  window.addEventListener("resize", function () { resize(); if (reduceMotion) draw(performance.now()); });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("mousemove", function (e) {
    ptx = (e.clientX / window.innerWidth - 0.5) * 2;
    pty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // drag to spin (mouse only, so touch scroll keeps working)
  canvas.parentElement.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse") return;
    dragging = true; lastX = e.clientX;
  });
  window.addEventListener("pointermove", function (e) {
    if (!dragging || e.pointerType !== "mouse") return;
    var dx = e.clientX - lastX;
    lastX = e.clientX;
    spinVel = dx * 0.0016;
    spin += spinVel;
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
  if (reduceMotion) draw(t0 + 6000);
  else requestAnimationFrame(draw);
})();
