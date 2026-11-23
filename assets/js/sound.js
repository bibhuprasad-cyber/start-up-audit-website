/* Start-up Audit — Home sound. Everything is synthesised in the browser with the Web Audio API (no audio files, no libraries):
   a soft "system online" swell when the visitor first touches the page, and a short activation sound for the tap buttons of the 3D stories.
   Browsers do not allow sound before a first tap, click or key press, so the landing sound plays on that first interaction.
   A small HUD button (bottom left, screens 640px and wider) turns the sound on and off; the choice is remembered. */
(function () {
  'use strict';
  var doc = document, KEY = 'sa-sound';
  if (!window.matchMedia || !window.matchMedia('(min-width: 640px)').matches) return;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches, saved = null;
  try { saved = window.localStorage.getItem(KEY); } catch (e) {}
  var on = saved ? saved === 'on' : !reduced;            // reduced-motion visitors start muted unless they switch it on
  var ctx = null, master = null, played = false, noiseBuf = null;

  function setup() {
    if (ctx) return true;
    try { ctx = new AC(); } catch (e) { ctx = null; return false; }
    master = ctx.createGain(); master.gain.value = 1;
    var comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    var n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = b; return true;
  }
  function env(g, t, a, peak, dur) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + dur); }
  function tone(t, f0, f1, dur, vol, type) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, Math.min(.04, dur / 3), vol, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
  }
  function whoosh(t, dur, vol, f0, f1) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 1.1;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, dur * .45, vol, dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + .05);
  }
  function landing() {
    var t = ctx.currentTime + .03;
    tone(t, 70, 150, 1.7, .26); tone(t, 140, 300, 1.7, .1, 'triangle');          // low swell (kept above 60 Hz so small speakers can play it)
    whoosh(t, 1.6, .2, 260, 2600);                                               // air rising
    tone(t + .95, 659.25, 659.25, 1.9, .16); tone(t + 1.04, 987.77, 987.77, 1.8, .12); tone(t + 1.16, 1318.5, 1318.5, 1.7, .09);   // teal chord
  }
  function activate() {
    var t = ctx.currentTime + .02;
    whoosh(t, .7, .16, 400, 3200); tone(t, 220, 440, .5, .2, 'triangle'); tone(t + .06, 1174.7, 1174.7, .7, .14);
  }
  function ready(fn) {
    if (!on || !setup()) return;
    var go = function () { try { fn(); } catch (e) {} };
    if (ctx.state === 'suspended') ctx.resume().then(go, function () {}); else go();
  }

  /* the HUD button */
  var btn = doc.createElement('button'); btn.type = 'button'; btn.className = 'sa-sound';
  btn.innerHTML = '<span class="sa-sound__eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="sa-sound__t">Sound</span><b class="sa-sound__s"></b>';
  function paint() {
    btn.classList.toggle('is-on', on); btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? 'Sound on. Press to turn off' : 'Sound off. Press to turn on');
    btn.querySelector('.sa-sound__s').textContent = on ? 'ON' : 'OFF';
  }
  btn.addEventListener('click', function (e) {
    e.stopPropagation(); on = !on; paint();
    try { window.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (er) {}
    if (on) { played = true; ready(activate); }
  });
  paint();
  (doc.body || doc.documentElement).appendChild(btn);
  window.setTimeout(function () { btn.classList.add('is-in'); }, 900);

  /* landing sound on the first real interaction; tap buttons of the 3D stories get their own sound */
  function first(e) {
    if (played) return;
    if (e.target && e.target.closest && e.target.closest('.sa-sound')) return;
    played = true; cleanup(); ready(landing);
  }
  var evs = ['pointerdown', 'keydown', 'touchstart'];
  function cleanup() { evs.forEach(function (n) { window.removeEventListener(n, first, true); }); }
  evs.forEach(function (n) { window.addEventListener(n, first, { capture: true, passive: true }); });
  doc.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('.sa-tap')) ready(activate);
  }, true);
}());
