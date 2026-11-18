/* Start-up Audit — 3D motion layer: mouse-reactive tilt + scroll depth.
   Additive only: no colours, text, layout or markup are changed.
   Off automatically on touch devices and for visitors who ask for reduced motion
   (they can still opt in through the existing "Turn on animations" note). */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var mm = function (q) { return window.matchMedia && window.matchMedia(q).matches; };

  var reduce = mm('(prefers-reduced-motion: reduce)') && !root.classList.contains('sa-motion-on');
  var finePointer = mm('(hover: hover) and (pointer: fine)');
  var wide = mm('(min-width: 900px)');
  if (reduce || !finePointer || !wide) return;

  var MAX_TILT = 7;       // degrees of mouse tilt on cards
  var SCROLL_TILT = 4.5;  // degrees of lean as a card travels up the screen
  var HERO_SHIFT = 18;    // px of hero photo drift with the mouse
  var HERO_TEXT = 7;      // px the hero text drifts the other way (depth)
  var EASE = 0.12;

  function ready(fn) {
    if (doc.readyState !== 'loading') fn(); else doc.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var vh = window.innerHeight;
    var mouse = { x: 0, y: 0, nx: 0, ny: 0 };   // nx/ny: -1..1 across the viewport
    var items = [];
    var hero = null;
    var running = false;

    /* ---------- pick the elements that get the 3D treatment ---------- */
    var picks = [].slice.call(doc.querySelectorAll(
      'main [class*="bg-platinum-card"], main [class*="bg-charcoal-card"], main .sa-team-card, main [data-img-reveal]'
    ));
    var chosen = [];
    picks.forEach(function (el) {
      if (el.querySelector('input, textarea, select, form, details')) return;
      if (el.closest('form, details, [data-enquiry]')) return;
      var r = el.getBoundingClientRect();
      if (r.width < 120 || r.height < 60 || r.width > 700 || r.height > 640) return;
      var pos = window.getComputedStyle(el).position;
      if (pos === 'sticky' || pos === 'fixed') return;
      chosen.push(el);
    });
    // never tilt something that sits inside another tilted element
    chosen.forEach(function (el) {
      for (var p = el.parentElement; p; p = p.parentElement) {
        if (chosen.indexOf(p) !== -1) return;
      }
      items.push({
        el: el, rx: 0, ry: 0, trx: 0, try_: 0, sx: 0, tsx: 0,
        hover: false, scale: 1, tscale: 1, visible: false, dirty: true
      });
    });

    /* ---------- hero depth layers ---------- */
    var heroSection = doc.querySelector('main section:has([data-hero])') ||
      (doc.querySelector('[data-hero]') && doc.querySelector('[data-hero]').closest('section'));
    if (heroSection) {
      var img = heroSection.querySelector('img');
      var bg = img && img.parentElement;
      var text = heroSection.querySelector('[data-hero]');
      text = text && text.closest('.relative.z-20, .z-20');
      if (bg || text) hero = { section: heroSection, bg: bg, text: text, x: 0, y: 0, tx: 0, ty: 0, inView: true };
    }

    if (!items.length && !hero) return;

    items.forEach(function (it) {
      it.el.classList.add('sa3d');
      it.el.addEventListener('pointerenter', function () { it.hover = true; it.tscale = 1.012; start(); });
      it.el.addEventListener('pointermove', function (e) {
        var r = it.el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;   // -.5 .. .5
        var py = (e.clientY - r.top) / r.height - 0.5;
        it.try_ = px * 2 * MAX_TILT;
        it.trx = -py * 2 * MAX_TILT;
        start();
      });
      it.el.addEventListener('pointerleave', function () {
        it.hover = false; it.trx = 0; it.try_ = 0; it.tscale = 1; start();
      });
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          for (var i = 0; i < items.length; i++) {
            if (items[i].el === en.target) { items[i].visible = en.isIntersecting; break; }
          }
          if (hero && en.target === hero.section) hero.inView = en.isIntersecting;
        });
        start();
      }, { rootMargin: '10% 0px 10% 0px' });
      items.forEach(function (it) { io.observe(it.el); });
      if (hero) io.observe(hero.section);
    } else {
      items.forEach(function (it) { it.visible = true; });
    }

    window.addEventListener('mousemove', function (e) {
      mouse.nx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ny = (e.clientY / window.innerHeight) * 2 - 1;
      if (hero) { hero.tx = mouse.nx; hero.ty = mouse.ny; }
      if (hero && hero.inView) start();
    }, { passive: true });
    window.addEventListener('scroll', function () { start(); }, { passive: true });
    window.addEventListener('resize', function () { vh = window.innerHeight; start(); });
    doc.addEventListener('mouseleave', function () { if (hero) { hero.tx = 0; hero.ty = 0; } start(); });

    function start() { if (!running) { running = true; window.requestAnimationFrame(frame); } }

    function lerp(a, b, t) { return a + (b - a) * t; }

    function frame() {
      var busy = false;

      /* cards */
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!it.visible && !it.dirty) continue;

        // scroll lean: items lower on screen lean back, flatten near the centre, lean forward leaving
        var r = it.el.getBoundingClientRect();
        var p = ((r.top + r.height / 2) - vh / 2) / (vh / 2 + r.height / 2);
        p = Math.max(-1, Math.min(1, p));
        it.tsx = p * SCROLL_TILT;

        it.rx = lerp(it.rx, it.trx, EASE);
        it.ry = lerp(it.ry, it.try_, EASE);
        it.sx = lerp(it.sx, it.tsx, 0.18);
        it.scale = lerp(it.scale, it.tscale, EASE);

        var settled = Math.abs(it.rx - it.trx) < 0.02 && Math.abs(it.ry - it.try_) < 0.02 &&
          Math.abs(it.sx - it.tsx) < 0.02 && Math.abs(it.scale - it.tscale) < 0.0005;

        var rxTotal = (it.rx + it.sx).toFixed(2);
        it.el.style.transform = 'perspective(1100px) rotateX(' + rxTotal + 'deg) rotateY(' + it.ry.toFixed(2) +
          'deg) scale3d(' + it.scale.toFixed(4) + ',' + it.scale.toFixed(4) + ',1)';
        it.dirty = false;
        if (!settled) busy = true;
      }

      /* hero layers */
      if (hero && hero.inView) {
        hero.x = lerp(hero.x, hero.tx, 0.07);
        hero.y = lerp(hero.y, hero.ty, 0.07);
        var sy = Math.min(window.scrollY, vh * 1.2);
        if (hero.bg) {
          hero.bg.style.transform = 'translate3d(' + (-hero.x * HERO_SHIFT).toFixed(2) + 'px,' +
            (-hero.y * HERO_SHIFT * 0.6 + sy * 0.12).toFixed(2) + 'px,0) scale(1.08)';
        }
        if (hero.text) {
          hero.text.style.transform = 'translate3d(' + (hero.x * HERO_TEXT).toFixed(2) + 'px,' +
            (hero.y * HERO_TEXT * 0.6 - sy * 0.06).toFixed(2) + 'px,0)';
        }
        if (Math.abs(hero.x - hero.tx) > 0.002 || Math.abs(hero.y - hero.ty) > 0.002) busy = true;
      }

      if (busy) window.requestAnimationFrame(frame); else running = false;
    }

    start();
  });
})();
