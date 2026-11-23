/* Start-up Audit — Home sound design for the interactive 3D sections. Optional, quiet, no music.

   - OFF by default. Nothing is loaded or created (no AudioContext) until the visitor presses the HUD "Sound" button; no sound ever plays on its own.
   - Every sound is synthesised in the browser with the Web Audio API: zero audio files to download, nothing for the phone to decode.
   - The 3D scripts only announce events ('sa:sfx': hover, select, whoosh, engage); this file decides what, if anything, to play.
   - Sound map: hero entrance = soft atmosphere (when sound is switched on at the hero); 3D object hover = soft mechanical servo; audit dimension selected =
     short digital confirmation; methodology stage change = subtle cinematic whoosh; tap buttons = whoosh + click; HUD buttons = soft interface clicks.
   - Calm by design: low master volume, one sound at a time per lane, cooldowns, a voice cap, and it goes quiet when the tab is hidden.
   - The on/off choice is kept for the browser session only. */
(function () {
  'use strict';
  var doc = document, KEY = 'sa-sfx';
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  var on = false;
  try { on = window.sessionStorage.getItem(KEY) === 'on'; } catch (e) {}
  var ctx = null, master = null, noise = null, ends = [], lastAny = 0, lastBy = {}, hidden = false;
  var VOL = .9, MAXV = 8;
  var COOL = { hover: 260, tick: 120, click: 70, select: 380, whoosh: 900, engage: 1400, enter: 8000 };

  function now() { return window.performance && performance.now ? performance.now() : Date.now(); }
  function setup() {
    if (ctx) return true;
    try { ctx = new AC(); } catch (e) { ctx = null; return false; }
    master = ctx.createGain(); master.gain.value = VOL;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
    var comp = ctx.createDynamicsCompressor(); master.connect(lp); lp.connect(comp); comp.connect(ctx.destination);
    var n = ctx.sampleRate, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    noise = b; return true;
  }
  function env(g, t, a, peak, dur) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + dur); }
  function done(endT) { ends.push(endT); }
  function live() { var t = ctx.currentTime; ends = ends.filter(function (e) { return e > t; }); return ends.length; }
  function tone(t, f0, f1, dur, vol, type, att) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, att || Math.min(.02, dur / 3), vol, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .03); done(t + dur + .03);
  }
  function air(t, dur, vol, f0, f1, q, type, att) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise; s.loop = true; f.type = type || 'bandpass'; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, att || dur * .4, vol, dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + .03); done(t + dur + .03);
  }

  var SFX = {
    enter: function (t) {                                                       // hero: a slow, deep atmosphere
      tone(t, 82.4, 82.4, 3.6, .07, 'sine', 1.3); tone(t, 123.5, 124.4, 3.4, .045, 'triangle', 1.4); tone(t + .3, 247, 248.5, 3, .02, 'sine', 1.3);
      air(t, 3.4, .05, 220, 1500, .7, 'bandpass', 1.5);
    },
    hover: function (t) {                                                       // soft mechanical servo
      tone(t, 150, 92, .09, .05, 'sine', .004); air(t, .08, .035, 2400, 1500, 3.5, 'bandpass', .006); tone(t + .045, 520, 430, .05, .012, 'triangle', .004);
    },
    select: function (t) {                                                      // short digital confirmation
      tone(t, 880, 880, .09, .05, 'sine', .006); tone(t + .075, 1318.5, 1318.5, .16, .045, 'sine', .006); tone(t + .075, 2637, 2637, .12, .012, 'sine', .006);
    },
    whoosh: function (t) {                                                      // subtle cinematic pass
      air(t, .95, .06, 180, 1900, 1.1, 'bandpass', .42); tone(t, 98, 58, .9, .045, 'sine', .22); tone(t + .86, 1760, 1760, .12, .012, 'sine', .01);
    },
    engage: function (t) {                                                      // tap button: click, then a whoosh
      SFX.click(t); air(t + .02, .8, .07, 220, 2600, 1.1, 'bandpass', .35); tone(t + .02, 110, 62, .8, .055, 'sine', .2); tone(t + .5, 1174.7, 1174.7, .3, .03, 'sine', .01);
    },
    click: function (t) {                                                       // soft interface click
      air(t, .03, .04, 3200, 2400, 1.6, 'highpass', .003); tone(t, 1900, 1500, .03, .02, 'sine', .002);
    },
    tick: function (t) { tone(t, 1500, 1300, .025, .014, 'sine', .002); }
  };

  function play(name) {
    if (!on || hidden || !SFX[name]) return;
    var t0 = now();
    if (t0 - (lastBy[name] || -1e9) < COOL[name]) return;                       // no stutter of the same sound
    if (name === 'hover' || name === 'tick') { if (t0 - lastAny < 200) return; }   // small sounds never sit on top of anything else
    else if (t0 - lastAny < 120) return;                                        // ...and big ones do not stack
    if (!setup()) return;
    if (live() >= MAXV) return;
    var go = function () { try { SFX[name](ctx.currentTime + .02); lastBy[name] = t0; lastAny = t0; } catch (e) {} };
    if (ctx.state === 'running') go(); else if (ctx.state === 'suspended') ctx.resume().then(go, function () {});
  }

  /* the HUD button: a small control in the same HUD language, bottom left */
  var btn = doc.createElement('button'); btn.type = 'button'; btn.className = 'sa-sound';
  btn.innerHTML = '<span class="sa-sound__eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="sa-sound__t">Sound</span><b class="sa-sound__s"></b>';
  function paint() {
    btn.classList.toggle('is-on', on); btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? 'Sound on. Press to turn off' : 'Sound off. Press to turn on');
    btn.querySelector('.sa-sound__s').textContent = on ? 'ON' : 'OFF';
  }
  function heroInView() { var h = doc.getElementById('home-hero'); if (!h) return false; var r = h.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight * .6; }
  btn.addEventListener('click', function (e) {
    e.stopPropagation(); on = !on; paint();
    try { window.sessionStorage.setItem(KEY, on ? 'on' : 'off'); } catch (er) {}
    if (on) { if (setup()) { var after = function () { lastAny = 0; if (heroInView()) play('enter'); else play('click'); }; if (ctx.state === 'suspended') ctx.resume().then(after, function () {}); else after(); } }
    else if (ctx && ctx.state === 'running') ctx.suspend().catch(function () {});
  });
  paint();
  (doc.body || doc.documentElement).appendChild(btn);
  window.setTimeout(function () { btn.classList.add('is-in'); }, 900);

  /* events from the 3D scenes */
  window.addEventListener('sa:sfx', function (e) { play(e.detail); });

  /* HUD interactions: soft clicks on the 3D sections' own controls, and a faint tick as the pointer passes over them */
  var HUDSEL = '.a3d-rail, .a3d-rail *, .m3d-tick';
  doc.addEventListener('click', function (e) { var t = e.target; if (t && t.closest && t.closest('.m3d-tick, .a3d-rail button')) play('click'); }, true);
  doc.addEventListener('mouseover', function (e) { var t = e.target; if (t && t.closest && t.closest('.m3d-tick') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.m3d-tick') === t.closest('.m3d-tick'))) play('tick'); }, true);

  /* stay quiet when the tab is hidden; a returning visitor who is on hears sound again after their next tap */
  doc.addEventListener('visibilitychange', function () {
    hidden = doc.hidden;
    if (!ctx) return;
    if (hidden) ctx.suspend().catch(function () {}); else if (on) ctx.resume().catch(function () {});
  });
  window.addEventListener('pointerdown', function () { if (on && ctx && ctx.state === 'suspended' && !hidden) ctx.resume().catch(function () {}); }, { capture: true, passive: true });
}());
