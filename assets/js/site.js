/* Start-up Audit — site behaviour (no dependencies) */
(function () {
  'use strict';

  var doc = document;
  var osReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Visitors whose device asks for reduced motion can opt in to the animations (stored locally; also shared with the single-file viewer).
  var forced = false;
  try { forced = window.localStorage.getItem('sa-motion') === 'on'; } catch (e) {}
  try { if (window.parent && window.parent.__saMotion === 'on') forced = true; } catch (e) {}
  if (forced) doc.documentElement.classList.add('sa-motion-on');
  var reduceMotion = osReduce && !forced;

  function ready(fn) {
    if (doc.readyState !== 'loading') fn(); else doc.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    initYear();
    initHeader();
    initMobileMenu();
    initEnquiryForm();
    initMotion();
    initMotionNote();
  });

  /* ---------- footer year ---------- */
  function initYear() {
    var y = String(new Date().getFullYear());
    [].forEach.call(doc.querySelectorAll('[data-year]'), function (n) { n.textContent = y; });
  }

  /* ---------- header shadow on scroll ---------- */
  function initHeader() {
    var header = doc.querySelector('[data-header]');
    if (!header) return;
    function update() { header.classList.toggle('is-scrolled', window.scrollY > 8); }
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* ---------- mobile navigation ---------- */
  function initMobileMenu() {
    var btn = doc.querySelector('.sa-burger');
    var panel = doc.getElementById('sa-mobile');
    if (!btn || !panel) return;

    function set(open) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (open) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
    }
    btn.addEventListener('click', function () { set(btn.getAttribute('aria-expanded') !== 'true'); });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); }
    });
    var mq = window.matchMedia('(min-width: 900px)');
    var onChange = function () { if (mq.matches) set(false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  }

  /* ---------- enquiry form (mailto — the site has no backend) ---------- */
  function initEnquiryForm() {
    var form = doc.querySelector('[data-enquiry]');
    if (!form) return;
    var status = doc.getElementById('form-status');
    var select = form.querySelector('#f-area');

    var wanted = new URLSearchParams(window.location.search).get('area');
    if (wanted && select && select.querySelector('option[value="' + wanted + '"]')) select.value = wanted;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var v = function (id) { return (form.querySelector(id).value || '').trim(); };
      var area = select && select.value ? select.options[select.selectedIndex].text : 'Not sure yet';
      var body = [
        'Name: ' + v('#f-name'),
        'Business: ' + (v('#f-business') || '-'),
        'Email: ' + v('#f-email'),
        'Phone: ' + (v('#f-phone') || '-'),
        'Audit area of interest: ' + area,
        '',
        v('#f-message')
      ].join('\n');
      var subject = 'Audit enquiry' + (v('#f-business') ? ' — ' + v('#f-business') : '');
      var href = 'mailto:startupaudit.in@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      if (status) {
        var cls = 'text-primary underline underline-offset-4';
        var gmail = 'https://mail.google.com/mail/?view=cm&fs=1&to=startupaudit.in%40gmail.com&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        var wa = 'https://wa.me/917205377366?text=' + encodeURIComponent(subject + '\n\n' + body);
        status.innerHTML = 'Your email app should open with the enquiry ready to send. If nothing opens, send it via ' +
          '<a class="' + cls + '" href="' + gmail + '" target="_blank" rel="noopener">Gmail</a>, ' +
          '<a class="' + cls + '" href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>, ' +
          'or write to <a class="' + cls + '" href="' + href + '">startupaudit.in@gmail.com</a> / call +91 7205377366.';
      }
      window.location.href = href;
    });
  }

  /* ---------- reduced-motion opt-in notice ---------- */
  function initMotionNote() {
    if (!osReduce || forced) return;
    var note = doc.createElement('div');
    note.className = 'sa-motion-note'; note.setAttribute('role', 'region'); note.setAttribute('aria-label', 'Animations');
    note.innerHTML = 'Animations are off because your device is set to reduce motion.<br>';
    var on = doc.createElement('button'); on.type = 'button'; on.className = 'sa-motion-on'; on.textContent = 'Turn on animations';
    var x = doc.createElement('button'); x.type = 'button'; x.className = 'sa-motion-x'; x.setAttribute('aria-label', 'Dismiss'); x.textContent = '\u00d7';
    on.addEventListener('click', function () {
      try { window.localStorage.setItem('sa-motion', 'on'); } catch (e) {}
      try { window.parent.__saMotion = 'on'; } catch (e) {}
      window.location.reload();
    });
    x.addEventListener('click', function () { note.remove(); });
    note.appendChild(on); note.appendChild(x); doc.body.appendChild(note);
  }

  /* ---------- scroll motion ---------- */
  function initMotion() {
    var root = doc.documentElement;
    var canObserve = 'IntersectionObserver' in window;

    var textEls = [].slice.call(doc.querySelectorAll('[data-text-reveal]'));
    var imgEls = [].slice.call(doc.querySelectorAll('[data-img-reveal]'));
    var staggerEls = [].slice.call(doc.querySelectorAll('[data-stagger]'));
    var drawEls = [].slice.call(doc.querySelectorAll('.sa-draw'));
    var revealEls = [].slice.call(doc.querySelectorAll('[data-reveal]'));
    var sectionEls = [].slice.call(doc.querySelectorAll('main section')).filter(function (s, i) {
      return i > 0 && !s.querySelector('[data-hero]');
    });
    sectionEls.forEach(function (s) { s.setAttribute('data-section', ''); });

    // No IO support or reduced motion: show everything, no splitting, no parallax.
    if (!canObserve || reduceMotion) {
      var all = textEls.concat(imgEls, staggerEls, drawEls, revealEls, sectionEls);
      all.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    // hero background photo eases in (never runs under reduced motion: handled above)
    var heroSection = doc.querySelector('main section:has([data-hero])');
    if (heroSection) [].forEach.call(heroSection.querySelectorAll('img'), function (img) { if (!img.closest('[data-img-reveal]')) img.classList.add('sa-hero-img'); });

    textEls.forEach(splitWords);
    staggerEls.forEach(function (parent) {
      [].forEach.call(parent.children, function (child, i) { child.style.setProperty('--i', i); });
    });

    // Image frames start fully clipped (clip-path), and a clipped element reports zero
    // visible area to IntersectionObserver, so it would never reveal. Watch each frame's
    // parent instead and reveal the clipped frame(s) inside it.
    var imgHosts = [];
    imgEls.forEach(function (el) {
      var host = el.parentElement || el;
      if (!host.__saReveal) { host.__saReveal = []; imgHosts.push(host); }
      host.__saReveal.push(el);
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        (entry.target.__saReveal || [entry.target]).forEach(function (el) { el.classList.add('is-in'); });
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    // Sections can be taller than the viewport, so observe with a lower threshold.
    var ioTall = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        ioTall.unobserve(entry.target);
      });
    }, { threshold: 0.01, rootMargin: '0px 0px -10% 0px' });

    textEls.concat(imgHosts, staggerEls, drawEls, revealEls).forEach(function (el) { io.observe(el); });
    sectionEls.forEach(function (el) { ioTall.observe(el); });

    initParallax();
  }

  function splitWords(el) {
    var label = el.textContent.replace(/\s+/g, ' ').trim();
    var i = 0;
    function walk(node) {
      [].slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var parts = child.nodeValue.split(/(\s+)/);
          var frag = doc.createDocumentFragment();
          parts.forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(' ')); return; }
            var outer = doc.createElement('span');
            outer.className = 'sa-w';
            outer.setAttribute('aria-hidden', 'true');
            var inner = doc.createElement('span');
            inner.className = 'sa-wi';
            inner.style.setProperty('--d', Math.min(i * 55, 650) + 'ms');
            inner.textContent = part.replace(/ /g, ' ');
            outer.appendChild(inner);
            frag.appendChild(outer);
            i += 1;
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    }
    walk(el);
    el.setAttribute('aria-label', label);
  }

  /* ---------- gentle parallax ---------- */
  function initParallax() {
    var items = [].slice.call(doc.querySelectorAll('[data-parallax]'));
    if (!items.length) return;
    var ticking = false;

    function update() {
      ticking = false;
      var vh = window.innerHeight;
      items.forEach(function (img) {
        var frame = img.parentElement.getBoundingClientRect();
        if (frame.bottom < -100 || frame.top > vh + 100) return;
        var progress = ((frame.top + frame.height / 2) - vh / 2) / (vh / 2 + frame.height / 2); // -1 .. 1
        progress = Math.max(-1, Math.min(1, progress));
        var range = frame.height * 0.06; // scale(1.14) leaves ~7% headroom each side
        img.style.setProperty('--py', (progress * -range).toFixed(1) + 'px');
      });
    }
    function request() { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    update();
  }
})();
