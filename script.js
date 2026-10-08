/* Wadevo Studios: orbital hero. A slow GYRE-like system: concentric
   elliptical orbits, small bodies, one coral. Pauses offscreen and under
   prefers-reduced-motion. All controls here are real (menu, year). */

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

  /* ---------- orbits ---------- */
  var canvas = document.getElementById("orbits");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 0, H = 0, dpr = 1;
  var mx = 0, my = 0, tx = 0, ty = 0; // lerped mouse parallax
  var running = true;
  var t0 = performance.now();

  // Bodies: {orbit, size, speed (rad/s), phase, color}
  var bodies = [
    { orbit: 0, size: 5.5, speed: 0.11, phase: 0.4, color: "#1b1512", alpha: 0.8 },
    { orbit: 1, size: 4, speed: -0.07, phase: 2.2, color: "#1b1512", alpha: 0.55 },
    { orbit: 2, size: 7, speed: 0.05, phase: 4.0, color: "#d9481f", alpha: 1 },
    { orbit: 3, size: 3.5, speed: -0.035, phase: 1.1, color: "#1b1512", alpha: 0.4 },
    { orbit: 1, size: 3, speed: 0.09, phase: 5.1, color: "#c2431f", alpha: 0.85 }
  ];

  function resize() {
    var hero = canvas.parentElement;
    var r = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function center() {
    // Orbit system sits right of the headline on wide screens, centered on small.
    var cx = W > 900 ? W * 0.74 : W * 0.5;
    var cy = H * 0.46;
    return { x: cx, y: cy };
  }

  function orbitRadii(i) {
    var base = Math.min(W, H);
    var scales = [0.16, 0.26, 0.37, 0.48];
    var s = scales[i % scales.length] * base;
    return { rx: s * 1.35, ry: s * 0.62, rot: -0.32 };
  }

  function draw(now) {
    var t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);

    // ease parallax toward mouse
    mx += (tx - mx) * 0.04;
    my += (ty - my) * 0.04;

    var c = center();
    var dim = W <= 900 ? 0.45 : 1; // quieter behind text on mobile

    ctx.save();
    ctx.translate(c.x + mx * 14, c.y + my * 10);

    // orbit paths
    for (var i = 0; i < 4; i++) {
      var r = orbitRadii(i);
      ctx.save();
      ctx.rotate(r.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, r.rx, r.ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(27,21,18," + (0.12 * dim) + ")";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // bodies
    for (var b = 0; b < bodies.length; b++) {
      var bd = bodies[b];
      var rr = orbitRadii(bd.orbit);
      var a = bd.phase + t * bd.speed;
      var ex = Math.cos(a) * rr.rx;
      var ey = Math.sin(a) * rr.ry;
      // rotate ellipse
      var x = ex * Math.cos(rr.rot) - ey * Math.sin(rr.rot);
      var y = ex * Math.sin(rr.rot) + ey * Math.cos(rr.rot);
      ctx.beginPath();
      ctx.arc(x, y, bd.size, 0, Math.PI * 2);
      ctx.fillStyle = bd.color;
      ctx.globalAlpha = bd.alpha * dim;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (running && !reduceMotion) requestAnimationFrame(draw);
  }

  window.addEventListener("resize", function () { resize(); if (reduceMotion) draw(performance.now()); });
  window.addEventListener("mousemove", function (e) {
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      var vis = entries[0].isIntersecting;
      if (vis && !running && !reduceMotion) { running = true; t0 = performance.now(); requestAnimationFrame(draw); }
      running = vis;
    }).observe(canvas.parentElement);
  }

  resize();
  if (reduceMotion) {
    // one composed still frame
    draw(t0 + 4000);
  } else {
    requestAnimationFrame(draw);
  }
})();
