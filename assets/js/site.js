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
    initTeamCarousel();
    initEnquiryForm();
    initMotion();
    initMotionNote();
  });

  /* ---------- footer year ---------- */
  function initYear() {
    var y = String(new Date().getFullYear());
    [].forEach.call(doc.querySelectorAll('[data-year]'), function (n) { n.textContent = y; });
  }

  /* ---------- gently advance the About team cards on phones ---------- */
  function initTeamCarousel() {
    var track = doc.querySelector('.sa-team-grid');
    if (!track || reduceMotion) return;
    var phone = window.matchMedia('(max-width: 639px)');
    var cards = [].slice.call(track.querySelectorAll('.sa-team-card'));
    if (!cards.length) return;
    var timer = null;
    var resumeTimer = null;
    var direction = 1;

    function stop() {
      if (timer) window.clearInterval(timer);
      timer = null;
    }
    function start() {
      stop();
      if (!phone.matches || doc.hidden || track.matches(':hover') || track.contains(doc.activeElement)) return;
      timer = window.setInterval(function () {
        if (!phone.matches || doc.hidden || track.contains(doc.activeElement)) return;
        var left = track.getBoundingClientRect().left;
        var index = 0;
        var nearest = Infinity;
        cards.forEach(function (card, i) {
          var distance = Math.abs(card.getBoundingClientRect().left - left);
          if (distance < nearest) { nearest = distance; index = i; }
        });
        var next = index + direction;
        if (next >= cards.length || next < 0) {
          direction *= -1;
          next = index + direction;
        }
        var target = track.scrollLeft + cards[next].getBoundingClientRect().left - left;
        track.scrollTo({ left: target, behavior: 'smooth' });
      }, 4800);
    }
    function pause() {
      stop();
      if (resumeTimer) window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(start, 7000);
    }
    ['pointerdown', 'touchstart', 'focusin'].forEach(function (eventName) {
      track.addEventListener(eventName, pause, { passive: true });
    });
    track.addEventListener('pointerenter', stop);
    track.addEventListener('pointerleave', start);
    doc.addEventListener('visibilitychange', start);
    if (phone.addEventListener) phone.addEventListener('change', start);
    else if (phone.addListener) phone.addListener(start);
    start();
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

  /* ---------- enquiry form (sent through Web3Forms to the studio inbox) ---------- */
  var FORM_ENDPOINT = 'https://api.web3forms.com/submit';
  var FORM_ACCESS_KEY = 'c89484de-4c01-45e4-9880-dc219169f3d4';
  function initEnquiryForm() {
    var form = doc.querySelector('[data-enquiry]');
    if (!form) return;
    var status = doc.getElementById('form-status');
    var select = form.querySelector('#f-area');
    var button = form.querySelector('button[type="submit"]');

    var wanted = new URLSearchParams(window.location.search).get('area');
    if (wanted && select && select.querySelector('option[value="' + wanted + '"]')) select.value = wanted;

    function say(html, ok) {
      if (!status) return;
      status.innerHTML = html;
      status.className = 'font-body-sm text-body-sm ' + (ok ? 'text-primary' : 'text-on-surface');
    }

    function showSent() {
      var old = form.querySelector('.sa-sent'); if (old) old.remove();
      var dots = '';
      for (var i = 0; i < 14; i++) {
        var ang = (360 / 14) * i;
        dots += '<i style="--a:' + ang + 'deg;--d:' + (62 + (i % 3) * 14) + 'px;--t:' + (i % 4) * 40 + 'ms"></i>';
      }
      var card = doc.createElement('div');
      card.className = 'sa-sent' + (reduceMotion ? ' sa-sent--static' : '');
      card.setAttribute('role', 'status');
      card.innerHTML =
        '<div class="sa-sent__mark" aria-hidden="true">' + dots +
        '<svg viewBox="0 0 52 52" width="88" height="88"><circle class="sa-sent__ring" cx="26" cy="26" r="24" fill="none"/>' +
        '<path class="sa-sent__tick" fill="none" d="M14.5 27.5l8 8 15-17"/></svg></div>' +
        '<h3 class="sa-sent__title">Enquiry sent</h3>' +
        '<p class="sa-sent__text">Thank you. We have received your details and will reply to the email you gave.</p>' +
        '<button type="button" class="sa-sent__again">Send another enquiry</button>';
      form.classList.add('is-sent');
      form.insertBefore(card, form.firstChild);
      card.querySelector('.sa-sent__again').addEventListener('click', function () {
        card.remove(); form.classList.remove('is-sent'); say('', false);
        var first = form.querySelector('#f-name'); if (first) first.focus();
      });
      if (card.scrollIntoView) card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var v = function (id) { return (form.querySelector(id).value || '').trim(); };
      var honey = form.querySelector('[name="botcheck"]');
      if (honey && honey.checked) return; // spam bot
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
      var subject = 'Audit enquiry' + (v('#f-business') ? ' \u2014 ' + v('#f-business') : '');
      var cls = 'text-primary underline underline-offset-4';
      var gmail = 'https://mail.google.com/mail/?view=cm&fs=1&to=startupaudit.in%40gmail.com&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      var wa = 'https://wa.me/917205377366?text=' + encodeURIComponent(subject + '\n\n' + body);
      var fallback = 'Please send it via <a class="' + cls + '" href="' + gmail + '" target="_blank" rel="noopener">Gmail</a>, ' +
        '<a class="' + cls + '" href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>, or call +91 7205377366.';

      if (button) { button.disabled = true; button.style.opacity = '.6'; }
      say('Sending your enquiry\u2026', false);

      var payload = {
        access_key: FORM_ACCESS_KEY,
        subject: subject,
        from_name: 'Start-up Audit website',
        name: v('#f-name'),
        email: v('#f-email'),
        business: v('#f-business'),
        phone: v('#f-phone'),
        audit_area: area,
        message: v('#f-message')
      };

      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok && res.j && res.j.success) {
            form.reset();
            say('', true);
            showSent();
          } else {
            say('Sorry, your enquiry could not be sent. ' + fallback, false);
          }
        })
        .catch(function () { say('Sorry, your enquiry could not be sent. ' + fallback, false); })
        .then(function () { if (button) { button.disabled = false; button.style.opacity = ''; } });
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
