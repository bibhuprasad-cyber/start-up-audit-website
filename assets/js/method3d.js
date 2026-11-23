/* Start-up Audit — Home "A Process Built Around Your Business": a cinematic 3D journey through the five stages.

   The section is a tall scroll track with a pinned stage (assets/css/method3d.css). Scrolling flies the camera along a glowing path from station to
   station: 01 Observe, 02 Diagnose, 03 Prioritise, 04 Recommend, 05 Improve. Each station has its own 3D identity. The words shown are the section's
   own heading, five step texts and closing sentence: this script only restyles and reveals them, it never writes methodology of its own.

   It switches on only for screens at least 640px wide and 520px tall, with WebGL, and when the visitor has not asked for reduced motion. Phones,
   no-JavaScript, no-WebGL and reduced-motion visitors keep the original section untouched. Plain WebGL (same glass / line / glow look as the hero and
   the audit dimensions) with no libraries, so it adds no download beyond this file. ?3ddebug in the address shows a small status box. */
(function () {
  'use strict';
  function sfx(n) { try { window.dispatchEvent(new CustomEvent('sa:sfx', { detail: n })); } catch (e) {} }   // sound hook only; nothing visual

  var doc = document, root = doc.documentElement;
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q).matches : false; };
  var DEBUG = /[?&]3ddebug/.test(window.location.search);
  var GATE = '(min-width: 640px) and (min-height: 520px)';
  var REDUCE = '(prefers-reduced-motion: reduce)';

  /* scroll story, measured in stage heights: intro, then per stage a flight (TR) and a pause (DW), then the pull-back. The CSS track is START + 5*STEP + 1.7 tall. */
  var START = 1.0, TR = .4, DW = .5, STEP = TR + DW;

  /* =============================================================== math */
  function ident() { var m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }
  function mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  }
  function T(x, y, z) { var m = ident(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function S(s) { var m = ident(); m[0] = m[5] = m[10] = s; return m; }
  function RX(a) { var m = ident(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  function RY(a) { var m = ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
  function RZ(a) { var m = ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
  function chain() { var m = ident(); for (var i = 0; i < arguments.length; i++) m = mul(m, arguments[i]); return m; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeBack(t) { if (t <= 0) return 0; if (t >= 1) return 1; var c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function hex(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
  function xf(m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
  function n3(m) { return new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]); }
  function perspective(fovy, asp, n, f, sx, sy) {                       // sx / sy = lens shift: slides the picture sideways / up without turning the camera
    var t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[8] = sx || 0; m[9] = sy || 0; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f);
    return m;
  }
  function lookAt(e, c, u) {
    var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], zl = Math.hypot(zx, zy, zz); zx /= zl; zy /= zl; zz /= zl;
    var xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx, xl = Math.hypot(xx, xy, xz); xx /= xl; xy /= xl; xz /= xl;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    var m = ident();
    m[0] = xx; m[1] = yx; m[2] = zx; m[4] = xy; m[5] = yy; m[6] = zy; m[8] = xz; m[9] = yz; m[10] = zz;
    m[12] = -(xx * e[0] + xy * e[1] + xz * e[2]); m[13] = -(yx * e[0] + yy * e[1] + yz * e[2]); m[14] = -(zx * e[0] + zy * e[1] + zz * e[2]);
    return m;
  }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function cr(a, b, c, d, t) { var t2 = t * t, t3 = t2 * t; return .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); }
  function splineAt(P, u) {                                              // smooth curve through the points P, u = 0 .. P.length - 1
    var n = P.length - 1, i = Math.min(Math.floor(u), n - 1), t = u - i, a = P[Math.max(i - 1, 0)], b = P[i], c = P[i + 1], d = P[Math.min(i + 2, n)];
    return [cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t), cr(a[2], b[2], c[2], d[2], t)];
  }
  /* scroll position (in stage heights) -> which station the camera is on: -1 = opening overview, 0..4 = stations, 5 = closing overview; eased flights, flat pauses */
  function spOf(ps) {
    if (ps <= START) return -1;
    var x = (ps - START) / STEP, i = Math.floor(x), fr = (x - i) * STEP;
    if (i >= 5) return (i === 5 && fr < TR) ? 4 + easeInOut(fr / TR) : 5;
    return fr < TR ? (i - 1) + easeInOut(fr / TR) : i;
  }

  /* brand palette: teal #008080, charcoal #293133, platinum #E5E4E2, white */
  var TEAL = hex('#008080'), TEAL_HI = hex('#16b3ac'), AQUA = hex('#6fe3d8'), PLAT = hex('#E5E4E2'), WHITE = hex('#FFFFFF'), MIST = hex('#a9d9d4');

  /* ============================================================== geometry */
  function Mesh() { this.p = []; this.n = []; this.i = []; }
  Mesh.prototype.v = function (x, y, z, nx, ny, nz) { this.p.push(x, y, z); this.n.push(nx, ny, nz); return this.p.length / 3 - 1; };
  function box(w, h, d) {
    var g = new Mesh(), x = w / 2, y = h / 2, z = d / 2;
    [[[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1]], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1]],
      [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0]], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0]],
      [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0]], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0]]
    ].forEach(function (q) {
      var n = q[4], a = g.v(q[0][0], q[0][1], q[0][2], n[0], n[1], n[2]), b = g.v(q[1][0], q[1][1], q[1][2], n[0], n[1], n[2]),
        c = g.v(q[2][0], q[2][1], q[2][2], n[0], n[1], n[2]), e = g.v(q[3][0], q[3][1], q[3][2], n[0], n[1], n[2]);
      g.i.push(a, b, c, a, c, e);
    });
    return g;
  }
  function boxLines(w, h, d) {
    var x = w / 2, y = h / 2, z = d / 2, c = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]], l = [];
    [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(function (e) { l.push(c[e[0]][0], c[e[0]][1], c[e[0]][2], c[e[1]][0], c[e[1]][1], c[e[1]][2]); });
    return l;
  }
  function sphere(r, lat, lon) {
    var g = new Mesh(), i, j;
    for (i = 0; i <= lat; i++) {
      var th = i / lat * Math.PI, st = Math.sin(th), ct = Math.cos(th);
      for (j = 0; j <= lon; j++) { var ph = j / lon * Math.PI * 2, x = st * Math.cos(ph), z = st * Math.sin(ph); g.v(r * x, r * ct, r * z, x, ct, z); }
    }
    for (i = 0; i < lat; i++) for (j = 0; j < lon; j++) { var a = i * (lon + 1) + j, b = a + lon + 1; g.i.push(a, b, b + 1, a, b + 1, a + 1); }
    return g;
  }
  function lathe(profile, seg) {                                         // surface of revolution around y; profile = [[radius, y], ...]
    var g = new Mesh(), i, j, np = profile.length;
    for (i = 0; i < np; i++) {
      var a = profile[Math.max(i - 1, 0)], b = profile[Math.min(i + 1, np - 1)], dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy) || 1, nr = -dy / l, ny = dr / l;
      for (j = 0; j <= seg; j++) { var ph = j / seg * Math.PI * 2, c = Math.cos(ph), s = Math.sin(ph); g.v(profile[i][0] * c, profile[i][1], profile[i][0] * s, nr * c, ny, nr * s); }
    }
    for (i = 0; i < np - 1; i++) for (j = 0; j < seg; j++) { var p = i * (seg + 1) + j, q = p + seg + 1; g.i.push(p, q, q + 1, p, q + 1, p + 1); }
    return g;
  }
  function circleLines(r, seg) {
    var l = [], k; for (k = 0; k < seg; k++) {
      var a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2;
      l.push(Math.cos(a0) * r, Math.sin(a0) * r, 0, Math.cos(a1) * r, Math.sin(a1) * r, 0);
    }
    return l;
  }
  function octa(r) {                                                     // faceted diamond
    var vs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], fs = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]], m = new Mesh();
    fs.forEach(function (f) {
      var a = vs[f[0]], b = vs[f[1]], c = vs[f[2]], ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
      var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      m.i.push(m.v(a[0] * r, a[1] * r, a[2] * r, nx, ny, nz), m.v(b[0] * r, b[1] * r, b[2] * r, nx, ny, nz), m.v(c[0] * r, c[1] * r, c[2] * r, nx, ny, nz));
    });
    return m;
  }

  /* ============================================================== shaders */
  var HP = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  var G_VS = 'attribute vec3 aPos;attribute vec3 aNor;uniform mat4 uVP;uniform mat4 uM;uniform mat3 uN;varying vec3 vN;varying vec3 vW;varying vec3 vL;' +
    'void main(){vec4 w=uM*vec4(aPos,1.0);vW=w.xyz;vL=aPos;vN=uN*aNor;gl_Position=uVP*w;}';
  var G_FS = HP + 'varying vec3 vN;varying vec3 vW;varying vec3 vL;uniform vec3 uColor;uniform vec3 uCam;uniform float uAlpha;uniform float uGlow;uniform float uHi;uniform float uTime;uniform float uFog;' +
    'void main(){vec3 n=normalize(vN);vec3 v=normalize(uCam-vW);float nv=dot(n,v);if(nv<0.0){n=-n;nv=-nv;}' +
    'float fr=pow(1.0-nv,2.4);vec3 L1=normalize(vec3(-0.45,0.85,0.55));vec3 L2=normalize(vec3(0.8,-0.25,0.5));' +
    'float d=max(dot(n,L1),0.0)*0.6+max(dot(n,L2),0.0)*0.3;vec3 r=reflect(-v,n);float env=smoothstep(-0.3,0.95,r.y);' +
    'vec3 h=normalize(L1+v);float sp=pow(max(dot(n,h),0.0),56.0);float scan=0.5+0.5*sin(vL.y*14.0-uTime*2.2);' +
    'vec3 col=uColor*(0.3+d*1.1)+vec3(0.6,1.0,0.96)*env*0.3*uHi+uColor*fr*1.25*uHi+vec3(1.0)*sp*1.1+uColor*uGlow*(0.7+0.3*scan);' +
    'float a=uAlpha*(0.2+0.6*fr+0.35*d)+sp*0.6+uGlow*0.3;a=clamp(a,0.0,1.0);a=mix(a,1.0,step(0.999,uAlpha));' +
    'float f=1.0-smoothstep(uFog*0.55,uFog,length(uCam-vW));a*=f;gl_FragColor=vec4(col*a,a);}';
  var L_VS = 'attribute vec3 aPos;uniform mat4 uVP;uniform mat4 uM;varying vec3 vW;void main(){vec4 w=uM*vec4(aPos,1.0);vW=w.xyz;gl_Position=uVP*w;}';
  var L_FS = HP + 'varying vec3 vW;uniform vec4 uCol;uniform vec3 uCam;uniform float uFog;' +
    'void main(){float f=1.0-smoothstep(uFog*0.5,uFog,length(vW-uCam));float a=uCol.a*f;gl_FragColor=vec4(uCol.rgb*a,a);}';
  var P_VS = 'attribute vec3 aPos;attribute vec2 aCor;attribute float aSize;attribute vec4 aCol;uniform mat4 uVP;uniform vec3 uRight;uniform vec3 uUp;varying vec2 vC;varying vec4 vCol;' +
    'void main(){vec3 w=aPos+(uRight*aCor.x+uUp*aCor.y)*aSize;vC=aCor;vCol=aCol;gl_Position=uVP*vec4(w,1.0);}';
  var P_FS = HP + 'varying vec2 vC;varying vec4 vCol;void main(){float d=length(vC);float g=pow(max(1.0-d,0.0),2.2);float c=smoothstep(0.22,0.0,d)*0.6;float a=(g+c)*vCol.a;gl_FragColor=vec4(vCol.rgb*a,a);}';

  function makeProgram(gl, vs, fs, uniforms, attribs) {
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var o = { p: p, u: {}, a: {}, locs: [] };
    uniforms.forEach(function (n) { o.u[n] = gl.getUniformLocation(p, n); });
    attribs.forEach(function (n) { var l = gl.getAttribLocation(p, n); o.a[n] = l; if (l >= 0) o.locs.push(l); });
    return o;
  }

  /* ==================================================================== UI */
  /* Finds the section's own pieces (header, five steps, closing sentence), tags them, and builds the HUD furniture. Returns null when the markup is not the expected one. */
  function initUI(sec) {
    var pin = null, i;
    for (i = 0; i < sec.children.length; i++) { if (sec.children[i].tagName === 'DIV') { pin = sec.children[i]; break; } }
    if (!pin) return null;
    var stepsEl = pin.querySelector('.sa-hscroll');
    if (!stepsEl) return null;
    var steps = [].slice.call(stepsEl.children), head = pin.firstElementChild, track = stepsEl.parentElement, outro = pin.querySelector(':scope > .mt-space-lg');
    if (steps.length !== 5 || !outro || head === track || track.parentElement !== pin) return null;
    var names = steps.map(function (s) { var h = s.querySelector('h3'); return h ? h.textContent.replace(/\s+/g, ' ').trim() : ''; });
    if (names.some(function (n) { return !n; })) return null;

    var api = { pin: pin, names: names, canvas: null, onGoto: null, onRailHover: null };
    var built = false, curEl = null, labels = [], ticks = [];
    var savedTab = stepsEl.getAttribute('tabindex'), savedLabel = stepsEl.getAttribute('aria-label');
    function el(tag, cls, parent) { var e = doc.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }

    function build() {
      if (built) return; built = true;
      head.classList.add('m3d-title'); track.classList.add('m3d-track'); stepsEl.classList.add('m3d-steps'); outro.classList.add('m3d-outro');
      steps.forEach(function (s) { s.classList.add('m3d-step'); });
      var glow = el('div', 'm3d-glow', pin); glow.setAttribute('aria-hidden', 'true');
      api.canvas = el('canvas', 'm3d-canvas', pin); api.canvas.setAttribute('aria-hidden', 'true');
      var hud = el('div', 'm3d-hud', pin); hud.setAttribute('aria-hidden', 'true');
      el('span', 'm3d-dot', hud);
      el('span', 'm3d-hud-o', hud).textContent = 'AUDIT PROCESS';
      var f = el('span', 'm3d-hud-f', hud); f.appendChild(doc.createTextNode('AUDIT PROCESS ')); el('i', '', f).textContent = '/'; f.appendChild(doc.createTextNode(' '));
      curEl = el('b', '', f); curEl.textContent = '01'; f.appendChild(doc.createTextNode(' OF 05'));
      var lw = el('div', 'm3d-labels', pin); lw.setAttribute('aria-hidden', 'true');
      var rail = el('div', 'm3d-rail', pin); rail.setAttribute('role', 'group'); rail.setAttribute('aria-label', 'Jump to a stage');
      names.forEach(function (n, k) {
        var lb = el('span', 'm3d-lbl', lw); el('b', '', lb).textContent = '0' + (k + 1); el('span', '', lb).textContent = n; labels.push(lb);
        var b = el('button', 'm3d-tick', rail); b.type = 'button'; b.setAttribute('aria-label', 'Go to stage ' + (k + 1) + ': ' + n);
        el('b', '', b).textContent = '0' + (k + 1); el('span', '', b).textContent = n; ticks.push(b);
        b.addEventListener('click', function () { if (api.onGoto) api.onGoto(k); });
        b.addEventListener('pointerenter', function () { if (api.onRailHover) api.onRailHover(k); });
        b.addEventListener('pointerleave', function () { if (api.onRailHover) api.onRailHover(-1); });
      });
      api.tap = el('button', 'sa-tap', pin); api.tap.type = 'button'; el('i', '', api.tap).setAttribute('aria-hidden', 'true'); el('span', '', api.tap).textContent = 'Tap the screen to explore';
      api.tap.addEventListener('click', function (e) { e.stopPropagation(); if (api.onTap) api.onTap(-1); });
      var hint = el('div', 'm3d-hint', pin); hint.setAttribute('aria-hidden', 'true'); hint.textContent = 'Scroll to travel through the five stages';
    }
    api.enable = function () {
      build(); sec.classList.add('m3d--ready');
      stepsEl.removeAttribute('tabindex'); stepsEl.setAttribute('aria-label', 'Audit process steps');
    };
    api.disable = function () {
      sec.classList.remove('m3d--ready', 'm3d--tall', 'm3d-intro', 'm3d-fin', 'm3d-focus', 'm3d-formed', 'm3d-rail-on', 'm3d-has-shown', 'm3d-idle');
      steps.forEach(function (s) { s.classList.remove('is-shown'); });
      if (savedTab !== null) stepsEl.setAttribute('tabindex', savedTab);
      if (savedLabel !== null) stepsEl.setAttribute('aria-label', savedLabel);
    };
    api.setIdle = function (v) { sec.classList.toggle('m3d-idle', v); };
    api.setTall = function (t) { sec.classList.toggle('m3d--tall', t); };
    api.setState = function (s) {
      var c = sec.classList;
      c.toggle('m3d-intro', s.intro); c.toggle('m3d-fin', s.fin); c.toggle('m3d-focus', s.focus); c.toggle('m3d-formed', s.formed); c.toggle('m3d-rail-on', s.rail); c.toggle('m3d-has-shown', s.shown >= 0);
      steps.forEach(function (st, k) { st.classList.toggle('is-shown', k === s.shown); });
      ticks.forEach(function (t, k) { t.classList.toggle('cur', k === s.cur); t.classList.toggle('done', s.cur >= 0 ? k < s.cur : s.done); });
      if (s.cur >= 0 && curEl) curEl.textContent = '0' + (s.cur + 1);
    };
    api.label = function (k, x, y, show, hov) {
      var l = labels[k]; if (!l) return;
      l.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)'; l.classList.toggle('is-on', show); l.classList.toggle('is-hover', hov);
    };
    api.tickHover = function (k) { ticks.forEach(function (t, j) { t.classList.toggle('is-hover', j === k); }); };
    return api;
  }

  /* ================================================================== scene */
  function initGL(sec, ui) {
    var canvas = ui.canvas, stage = ui.pin, gl = null;
    try { gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true }) || canvas.getContext('experimental-webgl'); } catch (e) { gl = null; }
    if (!gl) return null;
    var PG, PL, PS;
    try {
      PG = makeProgram(gl, G_VS, G_FS, ['uVP', 'uM', 'uN', 'uColor', 'uCam', 'uAlpha', 'uGlow', 'uHi', 'uTime', 'uFog'], ['aPos', 'aNor']);
      PL = makeProgram(gl, L_VS, L_FS, ['uVP', 'uM', 'uCol', 'uCam', 'uFog'], ['aPos']);
      PS = makeProgram(gl, P_VS, P_FS, ['uVP', 'uRight', 'uUp'], ['aPos', 'aCor', 'aSize', 'aCol']);
    } catch (e) { if (DEBUG && window.console) console.warn('method3d shader error', e); return null; }

    var lite = mq('(max-width: 899px)') || mq('(pointer: coarse)');
    var q = { dpr: Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2), slow: 0 };
    var st = { W: 2, H: 2, t: 0, last: 0, raf: 0, vis: false, lost: false, ps: -1, sp: -1, spS: -1, fresh: true, introS: 0, tall: false, hov: -1, railHov: -1,
      ptr: { x: 0, y: 0, on: false }, idle: false, px: 0, py: 0, ppx: 0, ppy: 0, key: '', scr: [], on: false, frames: 0 };

    /* ---------- GL state helpers ---------- */
    var enabled = [], MAXA = 8, qq;
    for (qq = 0; qq < MAXA; qq++) enabled[qq] = false;
    function use(pr) {
      gl.useProgram(pr.p);
      for (var k = 0; k < MAXA; k++) {
        var want = pr.locs.indexOf(k) >= 0;
        if (want !== enabled[k]) { if (want) gl.enableVertexAttribArray(k); else gl.disableVertexAttribArray(k); enabled[k] = want; }
      }
    }
    function upMesh(m) {
      var o = { n: m.i.length };
      o.p = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, o.p); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(m.p), gl.STATIC_DRAW);
      o.nr = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, o.nr); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(m.n), gl.STATIC_DRAW);
      o.i = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.i); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(m.i), gl.STATIC_DRAW);
      return o;
    }
    function upLines(arr) {
      var o = { n: arr.length / 3 };
      o.b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, o.b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      return o;
    }
    var MAXS = 420, sprBuf = gl.createBuffer(), sprData = new Float32Array(MAXS * 40), sprN = 0, sprIdx = gl.createBuffer(), idx = new Uint16Array(MAXS * 6), z;
    for (z = 0; z < MAXS; z++) { idx[z * 6] = z * 4; idx[z * 6 + 1] = z * 4 + 1; idx[z * 6 + 2] = z * 4 + 2; idx[z * 6 + 3] = z * 4; idx[z * 6 + 4] = z * 4 + 2; idx[z * 6 + 5] = z * 4 + 3; }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sprIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    var CORN = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    function spr(x, y, zz, size, c, a) {
      if (sprN >= MAXS || a <= .003) return;
      var o = sprN * 40, k;
      for (k = 0; k < 4; k++) {
        sprData[o] = x; sprData[o + 1] = y; sprData[o + 2] = zz; sprData[o + 3] = CORN[k][0]; sprData[o + 4] = CORN[k][1]; sprData[o + 5] = size;
        sprData[o + 6] = c[0]; sprData[o + 7] = c[1]; sprData[o + 8] = c[2]; sprData[o + 9] = a; o += 10;
      }
      sprN++;
    }

    /* ---------- part helpers ---------- */
    var IDM = function () { return ident(); };
    function mesh(g) { return upMesh(g); }
    function segs(arr) { return upLines(arr); }
    function at(x, y, zz) { var m = T(x, y, zz); return function () { return m; }; }
    function solid(g, col, glow, m) { return { g: g, c: col, gl: glow || 0, m: m || IDM }; }
    function glass(g, col, a, m) { return { g: g, c: col, a: a, m: m || IDM }; }
    function ln(l, col, a, m) { return { l: l, c: col, a: a, m: m || IDM }; }
    var HALF = Math.PI / 2, FLOOR = -1.15;
    var seg = lite ? 14 : 24;

    /* ---------- the five stations: each has its own silhouette and motion ---------- */
    function modObserve() {              // a scanning lens sweeping over a small business
      var d = { acc: AQUA, solids: [], glass: [], lines: [], sprites: null }, top = 1.25, rimY = FLOOR + .06, k;
      [[-.55, .25, .34, .5], [.05, .45, .3, .3], [.55, .05, .36, .74], [-.2, -.4, .3, .42], [.35, -.5, .26, .26]].forEach(function (b) {
        var m = at(b[0], FLOOR + .06 + b[3] / 2, b[1]);
        d.glass.push(glass(mesh(box(b[2], b[3], b[2])), TEAL_HI, .5, m));
        d.lines.push(ln(segs(boxLines(b[2], b[3], b[2])), WHITE, .55, m));
      });
      d.glass.push(glass(mesh(lathe([[0, top], [.95, rimY]], seg + 8)), AQUA, .16));
      var spokes = []; for (k = 0; k < 14; k++) { var a = k / 14 * Math.PI * 2; spokes.push(0, top, 0, Math.cos(a) * .95, rimY, Math.sin(a) * .95); }
      d.lines.push(ln(segs(spokes), AQUA, .4, function (t) { return RY(t * .5); }));
      d.lines.push(ln(segs(circleLines(.95, 64)), AQUA, .55, function () { return chain(T(0, rimY, 0), RX(HALF)); }));
      d.lines.push(ln(segs(circleLines(.66, 56)), WHITE, .7, function () { return chain(T(0, top, 0), RX(HALF)); }));
      d.lines.push(ln(segs(circleLines(.42, 48)), AQUA, .8, function (t) { return chain(T(0, top, 0), RX(HALF), RZ(-t * .6)); }));
      d.lines.push(ln(segs(circleLines(1, 56)), WHITE, function (t) { return .75 * Math.sin(((t * .3) % 1) * Math.PI); },
        function (t) { var u = (t * .3) % 1; return chain(T(0, lerp(top, rimY, u), 0), RX(HALF), S(.1 + .85 * u)); }));
      d.solids.push(solid(mesh(sphere(.12, 10, 14)), WHITE, 1.1, at(0, top, 0)));
      d.glass.push(glass(mesh(sphere(.3, 12, 18)), AQUA, .45, at(0, top, 0)));
      d.sprites = function (t, o) { var a2 = t * .8; o.push([0, top, 0, 1.5, AQUA, .6], [0, top, 0, .6, WHITE, .7], [Math.cos(a2) * .5, rimY + .08, Math.sin(a2) * .5, .45, WHITE, .75]); };
      return d;
    }
    function modDiagnose() {             // a glass cube being scanned, with a flagged weak point and a magnifier circling it
      var d = { acc: TEAL_HI, solids: [], glass: [], lines: [], sprites: null }, s = 1.5;
      d.glass.push(glass(mesh(box(s, s, s)), TEAL_HI, .2));
      d.lines.push(ln(segs(boxLines(s, s, s)), WHITE, .7));
      var P = [[-.4, .3, .2], [.35, .45, -.25], [.1, -.35, .4], [-.3, -.4, -.3], [.45, -.1, .3], [-.1, .1, -.45], [0, .55, .1], [.3, -.5, -.1]], flag = { 1: 1, 4: 1 };
      var E = [[0, 1], [1, 5], [5, 3], [3, 2], [2, 4], [4, 1], [0, 6], [6, 1], [2, 7], [7, 4], [0, 3]], ea = [];
      E.forEach(function (e) { ea.push(P[e[0]][0], P[e[0]][1], P[e[0]][2], P[e[1]][0], P[e[1]][1], P[e[1]][2]); });
      d.lines.push(ln(segs(ea), TEAL_HI, .75));
      var ns = mesh(sphere(.06, 8, 10)), nf = mesh(sphere(.095, 10, 14));
      P.forEach(function (p, i) {
        d.solids.push(flag[i] ? solid(nf, WHITE, function (t) { return .9 + .5 * Math.sin(t * 3 + i); }, at(p[0], p[1], p[2])) : solid(ns, TEAL_HI, .55, at(p[0], p[1], p[2])));
      });
      var plane = function (t) { return T(0, Math.sin(t * .9) * .62, 0); };
      d.glass.push(glass(mesh(box(s, .02, s)), AQUA, .4, plane));
      d.lines.push(ln(segs(boxLines(s, .02, s)), AQUA, .95, plane));
      var mag = function (t) { var a = t * .7; return chain(T(Math.cos(a) * 1.2, .2 + Math.sin(t * 1.3) * .1, Math.sin(a) * 1.2), RY(HALF - a)); };
      d.lines.push(ln(segs(circleLines(.34, 40)), WHITE, .85, mag)); d.lines.push(ln(segs([.24, -.24, 0, .56, -.56, 0]), WHITE, .85, mag));
      d.sprites = function (t, o) { var pu = .6 + .4 * Math.sin(t * 3); o.push([P[1][0], P[1][1], P[1][2], .95, WHITE, .5 * pu], [P[4][0], P[4][1], P[4][2], .95, WHITE, .5 * (1.1 - pu)]); };
      return d;
    }
    function modPrioritise() {           // issues ranked by impact and effort: the highest sits on top and glows
      var d = { acc: MIST, solids: [], glass: [], lines: [], sprites: null }, gy = -.7, g = [], i;
      for (i = -2; i <= 2; i++) g.push(i * .5, gy, -1, i * .5, gy, 1, -1, gy, i * .5, 1, gy, i * .5);
      d.lines.push(ln(segs(g), TEAL_HI, .5));
      d.glass.push(glass(mesh(box(2.2, .03, 2.2)), TEAL, .3, at(0, gy - .02, 0)));
      d.lines.push(ln(segs([-1.1, gy, -1.1, -1.1, gy + 1.9, -1.1, -1.1, gy + 1.9, -1.1, -1, gy + 1.76, -1.1, -1.1, gy + 1.9, -1.1, -1.2, gy + 1.76, -1.1]), WHITE, .6));
      var D = [[.65, .85, -.35, .2], [.2, .5, .15, .15], [-.3, .2, .4, .13], [-.55, -.1, -.2, .1], [.05, -.3, -.45, .08]], rank = [], stems = [];
      D.forEach(function (p, k) {
        var m = at(p[0], p[1], p[2]);
        d.solids.push(solid(mesh(sphere(p[3], 12, 16)), k === 0 ? WHITE : TEAL_HI, k === 0 ? 1.3 : .75 - k * .1, m));
        d.glass.push(glass(mesh(sphere(p[3] * 1.65, 12, 16)), k === 0 ? AQUA : TEAL_HI, .22, m));
        stems.push(p[0], gy, p[2], p[0], p[1] - p[3] * 1.6, p[2]);
        if (k < 4) rank.push(p[0], p[1], p[2], D[k + 1][0], D[k + 1][1], D[k + 1][2]);
      });
      d.lines.push(ln(segs(stems), TEAL_HI, .45)); d.lines.push(ln(segs(rank), WHITE, .6));
      var p0 = D[0];
      d.lines.push(ln(segs(circleLines(.42, 48)), AQUA, .85, function (t) { return chain(T(p0[0], p0[1], p0[2]), RX(HALF), S(1 + .14 * Math.sin(t * 2.4))); }));
      d.lines.push(ln(segs([p0[0], gy, p0[2], p0[0], p0[1] + 1.05, p0[2]]), WHITE, .4));
      d.sprites = function (t, o) {
        o.push([p0[0], p0[1], p0[2], 1.25, WHITE, .5 + .12 * Math.sin(t * 2.4)]);
        for (var k = 1; k < 5; k++) o.push([D[k][0], D[k][1], D[k][2], .55 - k * .06, TEAL_HI, .4]);
      };
      return d;
    }
    function modRecommend() {            // a plan on glass sheets with a route of milestones ending in a diamond
      var d = { acc: AQUA, solids: [], glass: [], lines: [], sprites: null }, W = 1.5, H = 1;
      var sheetG = mesh(box(W, H, .025)), sheetL = segs(boxLines(W, H, .025)), tl = [];
      [[.32, 1.1], [.14, .85], [-.04, 1], [-.22, .6]].forEach(function (r) { tl.push(-.58, r[0], .02, -.58 + r[1], r[0], .02); });
      var textL = segs(tl);
      var A = function () { return chain(RY(-.5), T(-.1, .05, -.1)); }, B = function () { return chain(RY(.5), T(.1, .05, -.1)); };
      d.glass.push(glass(sheetG, TEAL_HI, .28, A)); d.lines.push(ln(sheetL, MIST, .55, A)); d.lines.push(ln(textL, MIST, .4, A));
      d.glass.push(glass(sheetG, TEAL_HI, .28, B)); d.lines.push(ln(sheetL, MIST, .55, B)); d.lines.push(ln(textL, MIST, .4, B));
      var Cm = at(0, 0, .35);
      d.glass.push(glass(sheetG, AQUA, .32, Cm)); d.lines.push(ln(sheetL, WHITE, .8, Cm));
      var R = [[-.55, -.28], [-.2, -.05], [.05, -.22], [.3, .12], [.55, .3]], zz = .39, ra = [], nm = mesh(sphere(.05, 8, 12)), gr = [], i;
      for (i = 0; i < 4; i++) ra.push(R[i][0], R[i][1], zz, R[i + 1][0], R[i + 1][1], zz);
      d.lines.push(ln(segs(ra), AQUA, .9));
      for (i = -2; i <= 2; i++) gr.push(i * .3, -.45, .37, i * .3, .45, .37);
      d.lines.push(ln(segs(gr), TEAL_HI, .22));
      R.slice(0, 4).forEach(function (p, k) { d.solids.push(solid(nm, TEAL_HI, function (t) { return .3 + .9 * Math.max(0, Math.sin(t * 2.2 - k * .9)); }, at(p[0], p[1], zz))); });
      d.solids.push(solid(mesh(octa(.11)), WHITE, 1.1, function (t) { return chain(T(.55, .3 + .05 * Math.sin(t * 2), zz), RY(t * 1.2)); }));
      d.sprites = function (t, o) { o.push([.55, .3 + .05 * Math.sin(t * 2), zz, .8, WHITE, .5]); };
      return d;
    }
    function modImprove() {              // a rising spiral of widening rings: results checked, strategy lifted
      var d = { acc: TEAL_HI, solids: [], glass: [], lines: [], sprites: null }, N = lite ? 60 : 90, k;
      function hpos(u) { var a = u * Math.PI * 2 * 2.3, r = .3 + .42 * u; return [Math.cos(a) * r, lerp(-.8, .95, u), Math.sin(a) * r]; }
      var prev = hpos(0), arr = [];
      for (k = 1; k <= N; k++) { var c = hpos(k / N); arr.push(prev[0], prev[1], prev[2], c[0], c[1], c[2]); prev = c; }
      d.lines.push(ln(segs(arr), AQUA, .85, function (t) { return RY(t * .35); }));
      [[.48, -.55], [.66, .02], [.86, .6]].forEach(function (b) {
        d.glass.push(glass(mesh(lathe([[b[0], -.03], [b[0], .03]], seg + 8)), TEAL_HI, .38, at(0, b[1], 0)));
        d.lines.push(ln(segs(circleLines(b[0], 56)), TEAL_HI, .6, function () { return chain(T(0, b[1], 0), RX(HALF)); }));
      });
      d.glass.push(glass(mesh(lathe([[.05, -.9], [.05, 1]], 12)), AQUA, .3));
      d.solids.push(solid(mesh(sphere(.095, 10, 14)), WHITE, 1.3, function (t) { var p = hpos((t * .16) % 1); return chain(RY(t * .35), T(p[0], p[1], p[2])); }));
      d.lines.push(ln(segs([-.28, 0, 0, 0, .2, 0, 0, .2, 0, .28, 0, 0, -.28, -.2, 0, 0, 0, 0, 0, 0, 0, .28, -.2, 0]), WHITE, .85, function (t) { return chain(T(0, 1.3 + Math.sin(t * 2) * .08, 0), RY(t * .9)); }));
      d.sprites = function (t, o) {
        var p = hpos((t * .16) % 1), c = Math.cos(t * .35), s = Math.sin(t * .35);
        o.push([p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c, .9, WHITE, .6], [0, 1.3, 0, 1.1, AQUA, .4]);
      };
      return d;
    }

    var STN = [[-3, 0, 0], [3.2, .25, -6.8], [-2.8, -.15, -13.6], [3, .3, -20.4], [-1.6, 0, -27.2]];
    var objs = [modObserve(), modDiagnose(), modPrioritise(), modRecommend(), modImprove()].map(function (d, i) {
      d.p = STN[i]; d.hv = 0; d.spin = i * 1.1; d.M = ident(); d.al = 1; d.sc = 1; d.on = false; d.dist = 0;
      d.plate = [segs(circleLines(1.35, 6)), segs(circleLines(1.9, 64)), segs(circleLines(2.7, 64))];
      d.beacon = segs([0, FLOOR, 0, 0, 3.4, 0]);
      return d;
    });
    var N = objs.length, ring1 = segs(circleLines(1, 64)), I4 = ident();

    /* ---------- the glowing pathway: a ribbon and rails on the floor, joining the five stations ---------- */
    function pathPos(u) { var p = splineAt(STN, clamp(u, 0, 4)); return [p[0], p[1] + FLOOR + .03, p[2]]; }
    var K = lite ? 20 : 32, SEG = 4 * K, segEnd = [], pv = [], rib = new Mesh(), prev = pathPos(0), s0;
    for (s0 = 0; s0 < SEG; s0++) {
      var cur = pathPos((s0 + 1) / K), tx = cur[0] - prev[0], tz = cur[2] - prev[2], tl2 = Math.hypot(tx, tz) || 1, nx = -tz / tl2, nz = tx / tl2;
      pv.push(prev[0], prev[1], prev[2], cur[0], cur[1], cur[2]);
      pv.push(prev[0] + nx * .22, prev[1], prev[2] + nz * .22, cur[0] + nx * .22, cur[1], cur[2] + nz * .22);
      pv.push(prev[0] - nx * .22, prev[1], prev[2] - nz * .22, cur[0] - nx * .22, cur[1], cur[2] - nz * .22);
      if (s0 % 3 === 0) pv.push(prev[0] - nx * .38, prev[1], prev[2] - nz * .38, prev[0] + nx * .38, prev[1], prev[2] + nz * .38);
      segEnd.push(pv.length / 3);
      if (s0 === 0) { rib.v(prev[0] + nx * .2, prev[1], prev[2] + nz * .2, 0, 1, 0); rib.v(prev[0] - nx * .2, prev[1], prev[2] - nz * .2, 0, 1, 0); }
      var ia = rib.v(cur[0] + nx * .2, cur[1], cur[2] + nz * .2, 0, 1, 0), ib = rib.v(cur[0] - nx * .2, cur[1], cur[2] - nz * .2, 0, 1, 0);
      rib.i.push(ia - 2, ib - 2, ia, ib - 2, ib, ia);
      prev = cur;
    }
    var pathBuf = upLines(pv), ribbon = upMesh(rib);
    function vend(n) { return n <= 0 ? 0 : segEnd[Math.min(n, SEG) - 1]; }

    /* ---------- camera poses: an opening overview, one close-up per station, a closing overview ---------- */
    var DIST = 7.2, ANG = [0, -.3, .24, -.28, .18], PE = [[1.6, 9.8, 12.8]], PT = [[.4, -1.4, -12.6]];
    STN.forEach(function (p, i) { PE.push([p[0] + Math.sin(ANG[i]) * DIST, p[1] + 1.5, p[2] + Math.cos(ANG[i]) * DIST]); PT.push([p[0], p[1] - .05, p[2]]); });
    PE.push([-1.2, 11.5, 10.5]); PT.push([0, -1.5, -14]);

    /* drifting dust */
    var dust = [], rd = rng(11), nd = lite ? 70 : 140, di;
    for (di = 0; di < nd; di++) dust.push({ x: (rd() - .5) * 20, y: -2.4 + rd() * 7.4, z: 8 - rd() * 42, ph: rd() * 6.28, sz: .035 + rd() * .06, sp: .15 + rd() * .3 });

    /* ---------- sizing / input ---------- */
    function resize() {
      var r = stage.getBoundingClientRect(), W = Math.max(2, Math.round(r.width)), H = Math.max(2, Math.round(r.height));
      st.W = W; st.H = H; canvas.width = Math.round(W * q.dpr); canvas.height = Math.round(H * q.dpr);
      var tall = !(W >= 860 && W / H >= 1.15); if (tall !== st.tall) { st.tall = tall; ui.setTall(tall); }
    }
    function pick(x, y) {
      var best = -1, bd = 1e9, k;
      for (k = 0; k < N; k++) {
        var sc = st.scr[k]; if (!sc || sc.w <= 0 || objs[k].al < .35) continue;
        var d = Math.hypot(sc.x - x, sc.y - y); if (d < sc.r * 1.15 && d < bd) { bd = d; best = k; }
      }
      return best;
    }
    function local(e) { var r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    stage.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      var p = local(e); st.ptr.x = p[0]; st.ptr.y = p[1]; st.ptr.on = true; st.px = p[0] / st.W * 2 - 1; st.py = p[1] / st.H * 2 - 1;
    });
    stage.addEventListener('pointerleave', function () { st.ptr.on = false; st.px = 0; st.py = 0; st.hov = -1; ui.pin.style.cursor = ''; });
    stage.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a, button')) return;
      var p = local(e), k = pick(p[0], p[1]); if (ui.onTap) ui.onTap(k);
    });
    canvas.addEventListener('webglcontextlost', function (ev) { ev.preventDefault(); st.lost = true; if (api.onLost) api.onLost(); });

    /* ---------- the frame ---------- */
    var sprites = [];
    function frame(now) {
      st.raf = 0; if (!st.vis || st.lost) return;
      var dt = Math.min((now - st.last) / 1000 || .016, .05); st.last = now; st.t += dt;
      if (dt > .034) st.slow = (st.slow || 0) + 1; else st.slow = Math.max(0, (st.slow || 0) - 1);
      if (st.slow > 45 && q.dpr > 1) { q.dpr = Math.max(1, q.dpr - .25); st.slow = 0; resize(); }
      var t = st.t, ps = st.ps, W = st.W, H = st.H, k, i, p;
      if (st.fresh) { st.spS = st.sp; st.fresh = false; }
      st.spS += (st.sp - st.spS) * (1 - Math.exp(-dt * 5.5));
      st.introS += ((st.idle ? clamp((ps + .8) / .4, 0, 1) : clamp((ps + .35) / .9, 0, 1)) - st.introS) * (1 - Math.exp(-dt * 4));
      st.ppx += (st.px - st.ppx) * (1 - Math.exp(-dt * 3)); st.ppy += (st.py - st.ppy) * (1 - Math.exp(-dt * 3));
      var spS = st.spS, it = st.introS * 3.2, near = Math.round(spS), nd2 = Math.abs(spS - near);
      var f = easeInOut(clamp((spS + 1) / .8, 0, 1)) * (1 - easeInOut(clamp((spS - 4.2) / .8, 0, 1)));

      /* camera: a smooth flight through the poses, a slow drift while parked, a bank and a small push during each flight, pointer parallax */
      var u = clamp(spS + 1, 0, 6), E = splineAt(PE, u), Tg = splineAt(PT, u), ki = Math.floor(u), uf = u - ki;
      var wDw = (near >= 0 && near <= 4) ? 1 - clamp(nd2 * 4, 0, 1) : 0, ang = (ps - (START + near * STEP + TR + DW / 2)) * .55;
      E = [E[0] + Math.sin(ang) * .9 * wDw + st.ppx * .5, E[1] + Math.sin(ang * .7) * .14 * wDw - st.ppy * .25, E[2]];
      var zoom = st.tall ? clamp(1.25 / (W / H), 1, 2.2) : 1;
      E = [Tg[0] + (E[0] - Tg[0]) * zoom, Tg[1] + (E[1] - Tg[1]) * zoom, Tg[2] + (E[2] - Tg[2]) * zoom];
      var roll = 0, bump = 0;
      if (ki >= 1 && ki <= 4 && u < 5) { roll = Math.sin(uf * Math.PI) * .05 * (STN[ki][0] > STN[ki - 1][0] ? -1 : 1); bump = Math.sin(uf * Math.PI) * 5; }
      var fov = (st.tall ? 46 : 38) + bump, th = Math.tan(fov * Math.PI / 360);
      var shx = st.tall ? 0 : lerp(.26, -.4, f), shy = st.tall ? lerp(-.08, .4, f) : lerp(-.03, 0, f);
      var VIEW = lookAt(E, Tg, [Math.sin(roll), Math.cos(roll), 0]), VP = mul(perspective(fov * Math.PI / 180, W / H, .1, 130, -shx, -shy), VIEW);
      var right = [VIEW[0], VIEW[4], VIEW[8]], up = [VIEW[1], VIEW[5], VIEW[9]], FOG = 46;
      function proj(x, y, zz) {
        var cx = VP[0] * x + VP[4] * y + VP[8] * zz + VP[12], cy = VP[1] * x + VP[5] * y + VP[9] * zz + VP[13], w = VP[3] * x + VP[7] * y + VP[11] * zz + VP[15];
        return { x: (cx / w * .5 + .5) * W, y: (1 - (cy / w * .5 + .5)) * H, w: w };
      }

      /* stations: appear one after another, grow when the camera is on them, answer the pointer */
      var order = [], pk = (st.ptr.on && !st.tall) ? pick(st.ptr.x, st.ptr.y) : -1;
      if (pk !== st.lastHov) { if (pk >= 0) sfx('hover'); st.lastHov = pk; }
      st.hov = pk; ui.pin.style.cursor = pk >= 0 ? 'pointer' : '';
      for (k = 0; k < N; k++) {
        var o = objs[k], ap = easeBack(clamp((it - .3 - k * .3) / 1, 0, 1)), act = 1 - clamp(Math.abs(spS - k), 0, 1), hovNow = (st.hov === k || st.railHov === k) ? 1 : 0;
        o.hv += (hovNow - o.hv) * (1 - Math.exp(-dt * 9)); o.act = act;
        o.al = ap * lerp(.5, 1, Math.max(act, 1 - f, o.hv * .8));
        o.spin += dt * (.24 + .6 * o.hv);
        var bob = Math.sin(t * .9 + k * 1.7) * .07;
        o.sc = Math.max(ap * lerp(.86, 1.08, act) * (1 + .1 * o.hv), .0001); o.on = ap > .02;
        o.pos = [o.p[0], o.p[1] + bob, o.p[2]];
        o.M = chain(T(o.pos[0], o.pos[1], o.pos[2]), RY(o.spin), S(o.sc));
        o.dist = Math.hypot(E[0] - o.pos[0], E[1] - o.pos[1], E[2] - o.pos[2]);
        var pr = proj(o.pos[0], o.pos[1] + .1, o.pos[2]);
        st.scr[k] = { x: pr.x, y: pr.y, w: pr.w, r: .95 * Math.max(o.sc, .3) * (H / 2) / (th * o.dist) };
        order.push(k);
      }
      order.sort(function (a, b) { return objs[b].dist - objs[a].dist; });

      /* the HUD follows the (smoothed) camera, so text and picture stay in step */
      var shown = (spS > -.5 && spS < 4.5 && nd2 < .13) ? near : -1;
      var s = { cur: (spS > -.45 && spS < 4.45) ? clamp(near, 0, 4) : -1, shown: shown, intro: spS < -.8, fin: spS > 4.85, focus: f > .5, formed: st.introS > .97, rail: st.introS > .6, done: spS > 4.45 };
      var key = [s.cur, s.shown, +s.intro, +s.fin, +s.focus, +s.formed, +s.rail, +s.done].join();
      if (key !== st.key) { st.key = key; ui.setState(s); if (s.cur !== st.lastCur) { if (s.cur >= 0) sfx('whoosh'); st.lastCur = s.cur; } }
      ui.tickHover(st.hov >= 0 ? st.hov : st.railHov);
      for (k = 0; k < N; k++) {
        var sc = st.scr[k], showL = (1 - f > .5 && objs[k].al > .5) || st.hov === k || st.railHov === k;
        ui.label(k, sc.x + 16, sc.y - sc.r * .9 - 12, showL && sc.w > 0, st.hov === k || st.railHov === k);
      }

      /* ---- draw ---- */
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      var drawn = Math.floor(easeOut(clamp(it / 2.4, 0, 1)) * SEG), done = Math.floor(clamp(spS, 0, 4) * K), cutB = vend(Math.min(done, drawn)), cutE = vend(drawn);

      function drawMesh(g, M, col, a, glow, hi, first, count) {
        gl.uniformMatrix4fv(PG.u.uM, false, M); gl.uniformMatrix3fv(PG.u.uN, false, n3(M));
        gl.uniform3f(PG.u.uColor, col[0], col[1], col[2]); gl.uniform1f(PG.u.uAlpha, a); gl.uniform1f(PG.u.uGlow, glow); gl.uniform1f(PG.u.uHi, hi);
        gl.bindBuffer(gl.ARRAY_BUFFER, g.p); gl.vertexAttribPointer(PG.a.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, g.nr); gl.vertexAttribPointer(PG.a.aNor, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.i); gl.drawElements(gl.TRIANGLES, count === undefined ? g.n : count, gl.UNSIGNED_SHORT, (first || 0) * 2);
      }
      use(PG);
      gl.uniformMatrix4fv(PG.u.uVP, false, VP); gl.uniform3f(PG.u.uCam, E[0], E[1], E[2]); gl.uniform1f(PG.u.uTime, t); gl.uniform1f(PG.u.uFog, FOG);

      /* pass 1: opaque cores (write depth) */
      gl.depthMask(true);
      for (k = 0; k < N; k++) {
        var o1 = objs[k]; if (!o1.on) continue;
        var dim = lerp(.55, 1, o1.al), boost = .55 + .6 * Math.max(o1.act, o1.hv);
        for (i = 0; i < o1.solids.length; i++) {
          p = o1.solids[i];
          var gv = (typeof p.gl === 'function' ? p.gl(t) : p.gl) * boost * (.3 + .7 * o1.al);
          drawMesh(p.g, chain(o1.M, p.m(t)), [p.c[0] * dim, p.c[1] * dim, p.c[2] * dim], 1, gv, 1 + .25 * o1.hv);
        }
      }
      /* pass 2: glass, the path ribbon first, then stations far to near (no depth write) */
      gl.depthMask(false);
      if (cutB > 0 || cutE > cutB) {
        var rb = Math.min(done, drawn), rEnd = Math.min(drawn, SEG);
        if (rb > 0) drawMesh(ribbon, I4, TEAL_HI, .3, .5, 1, 0, rb * 6);
        if (rEnd > rb) drawMesh(ribbon, I4, TEAL, .13, .25, 1, rb * 6, (rEnd - rb) * 6);
      }
      for (var oi = 0; oi < N; oi++) {
        var og = objs[order[oi]]; if (!og.on) continue;
        for (i = 0; i < og.glass.length; i++) { p = og.glass[i]; drawMesh(p.g, chain(og.M, p.m(t)), p.c, p.a * og.al, .05 * og.act + .05 * og.hv, 1 + .3 * og.hv + .25 * og.act); }
      }
      /* pass 3: lines (additive) */
      use(PL); gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniformMatrix4fv(PL.u.uVP, false, VP); gl.uniform3f(PL.u.uCam, E[0], E[1], E[2]); gl.uniform1f(PL.u.uFog, FOG);
      function drawLines(L, M, c, a, first, count) {
        if (a <= .004) return;
        gl.uniformMatrix4fv(PL.u.uM, false, M); gl.uniform4f(PL.u.uCol, c[0], c[1], c[2], a);
        gl.bindBuffer(gl.ARRAY_BUFFER, L.b); gl.vertexAttribPointer(PL.a.aPos, 3, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.LINES, first || 0, count === undefined ? L.n : count);
      }
      if (cutB > 0) drawLines(pathBuf, I4, TEAL_HI, .95, 0, cutB);
      if (cutE > cutB) drawLines(pathBuf, I4, TEAL, .34, cutB, cutE - cutB);
      var pulse = .5 + .5 * Math.sin(t * 2.2);
      for (k = 0; k < N; k++) {
        var ol = objs[k]; if (!ol.on) continue;
        var base = chain(T(ol.p[0], ol.p[1] + FLOOR + .02, ol.p[2]), RX(HALF), S(Math.max(ol.sc, .01))), la = ol.al * (.55 + .45 * Math.max(ol.act, ol.hv));
        drawLines(ol.plate[0], base, ol.acc, .8 * la); drawLines(ol.plate[1], base, TEAL_HI, .45 * la); drawLines(ol.plate[2], base, TEAL_HI, .22 * la);
        var pf = (t * .4 + k * .3) % 1;
        drawLines(ring1, chain(T(ol.p[0], ol.p[1] + FLOOR + .02, ol.p[2]), RX(HALF), S((.5 + pf * 2.6) * ol.sc)), AQUA, (1 - pf) * .5 * ol.act * ol.al + (1 - pf) * .35 * ol.hv);
        drawLines(ol.beacon, T(ol.p[0], ol.p[1], ol.p[2]), ol.acc, .32 * la);
        for (i = 0; i < ol.lines.length; i++) { p = ol.lines[i]; drawLines(p.l, chain(ol.M, p.m(t)), p.c, (typeof p.a === 'function' ? p.a(t) : p.a) * la); }
      }
      /* pass 4: glow sprites, pulses travelling along the path, dust (additive) */
      sprN = 0;
      for (di = 0; di < nd; di++) {
        var d0 = dust[di], tw = .5 + .5 * Math.sin(t * .8 + d0.ph);
        spr(d0.x + Math.sin(t * d0.sp + d0.ph) * .35, d0.y + Math.cos(t * d0.sp * .8 + d0.ph) * .3, d0.z, d0.sz, di % 5 === 0 ? WHITE : MIST, (.12 + .26 * tw) * clamp(it / 2, 0, 1));
      }
      for (i = 0; i < 6; i++) {
        var uu = ((t * .05 + i / 6) % 1) * 4;
        if (uu * K < drawn) { var pp = pathPos(uu); spr(pp[0], pp[1] + .14, pp[2], .5, TEAL_HI, .3); spr(pp[0], pp[1] + .14, pp[2], .2, WHITE, .85); }
      }
      if (drawn > 4) { var me = pathPos(clamp(spS, 0, 4)); spr(me[0], me[1] + .2, me[2], .9, AQUA, .35 + .2 * pulse); spr(me[0], me[1] + .2, me[2], .3, WHITE, .9); }
      for (k = 0; k < N; k++) {
        var os = objs[k]; if (!os.on) continue;
        var gA = os.al * (.2 + .3 * Math.max(os.act, os.hv));
        spr(os.pos[0], os.pos[1], os.pos[2], (2.4 + 1.2 * os.act) * os.sc, os.acc, gA);
        spr(os.pos[0], os.pos[1] + 3.4 * os.sc, os.pos[2], .5, WHITE, .45 * os.al);
        sprites.length = 0; os.sprites(t, sprites);
        for (i = 0; i < sprites.length; i++) { var sp = sprites[i], w3 = xf(os.M, sp[0], sp[1], sp[2]); spr(w3[0], w3[1], w3[2], sp[3] * os.sc, sp[4], sp[5] * os.al * (.6 + .4 * Math.max(os.act, os.hv))); }
      }
      use(PS);
      gl.uniformMatrix4fv(PS.u.uVP, false, VP); gl.uniform3f(PS.u.uRight, right[0], right[1], right[2]); gl.uniform3f(PS.u.uUp, up[0], up[1], up[2]);
      gl.bindBuffer(gl.ARRAY_BUFFER, sprBuf); gl.bufferData(gl.ARRAY_BUFFER, sprData.subarray(0, sprN * 40), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(PS.a.aPos, 3, gl.FLOAT, false, 40, 0); gl.vertexAttribPointer(PS.a.aCor, 2, gl.FLOAT, false, 40, 12);
      gl.vertexAttribPointer(PS.a.aSize, 1, gl.FLOAT, false, 40, 20); gl.vertexAttribPointer(PS.a.aCol, 4, gl.FLOAT, false, 40, 24);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sprIdx); gl.drawElements(gl.TRIANGLES, sprN * 6, gl.UNSIGNED_SHORT, 0);
      gl.depthMask(true);

      if (++st.frames === 2) canvas.classList.add('is-on');
      if (DEBUG && dbg && st.frames % 20 === 0) dbg.textContent = 'method3d  sp ' + spS.toFixed(2) + '  ps ' + ps.toFixed(2) + '  dpr ' + q.dpr.toFixed(2) + '  fps ' + (1 / dt).toFixed(0) + '  hov ' + st.hov;
      st.raf = requestAnimationFrame(frame);
    }
    var dbg = null;
    if (DEBUG) { dbg = doc.createElement('div'); dbg.style.cssText = 'position:absolute;left:8px;bottom:8px;z-index:9;font:11px monospace;color:#9fe;background:#0008;padding:3px 6px;pointer-events:none'; stage.appendChild(dbg); }

    var api = {
      st: st, objs: objs, onLost: null,
      resize: resize,
      setScroll: function (ps, sp) { st.ps = ps; st.sp = sp; },
      setIdle: function (v) { st.idle = v; },
      setHover: function (k) { st.railHov = k; },
      setVisible: function (v) { st.vis = v && !doc.hidden; if (st.vis && !st.raf && !st.lost) { st.last = performance.now(); st.raf = requestAnimationFrame(frame); } },
      halt: function () { st.vis = false; if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; } }
    };
    resize();
    return api;
  }

  /* ================================================================== boot */
  function boot() {
    var sec = doc.getElementById('process');
    if (!sec) return;
    var ui = initUI(sec);
    if (!ui) return;
    var scene = null, on = false, failed = false, idle = true, top = 76, ph = 800, io = null, visible = true, qd = 0;
    function reduced() { return mq(REDUCE) && !root.classList.contains('sa-motion-on'); }
    function metrics() { top = parseFloat(getComputedStyle(ui.pin).top) || 76; ph = ui.pin.offsetHeight || 1; }
    function apply() {
      qd = 0; if (!on || !scene) return;
      var ps = (top - sec.getBoundingClientRect().top) / ph; scene.setScroll(ps, idle ? -1 : spOf(ps));
    }
    function onScroll() { if (!qd) { qd = 1; requestAnimationFrame(apply); } }
    function goto(i) {
      metrics();
      var y = window.pageYOffset + sec.getBoundingClientRect().top + (START + i * STEP + TR + .22) * ph - top;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    function activate(k) { if (!idle) return false; sfx('engage'); idle = false; ui.setIdle(false); if (scene) scene.setIdle(false); metrics(); apply(); goto(k >= 0 ? k : 0); return true; }
    ui.onTap = function (k) { if (!activate(k) && k >= 0) goto(k); };
    ui.onGoto = goto; ui.onRailHover = function (k) { if (scene) scene.setHover(k); };
    function fail() { failed = true; disable(); }
    function enable() {
      ui.enable();
      if (!scene) {
        try { scene = initGL(sec, ui); } catch (e) { scene = null; if (DEBUG && window.console) console.warn('method3d failed', e); }
        if (!scene) { failed = true; ui.disable(); return; }
        scene.onLost = fail;
        if ('IntersectionObserver' in window) {
          io = new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (scene && on) scene.setVisible(visible); }, { rootMargin: '300px 0px' });
          io.observe(sec);
        }
        if ('ResizeObserver' in window) new ResizeObserver(function () { if (on && scene) { metrics(); scene.resize(); apply(); } }).observe(ui.pin);
      }
      ui.setIdle(idle); scene.setIdle(idle);
      on = true; metrics(); scene.resize(); apply(); scene.setVisible(visible);
    }
    function disable() { on = false; if (scene) scene.halt(); ui.disable(); }
    function evaluate() { var want = !failed && mq(GATE) && !reduced(); if (want && !on) enable(); else if (!want && on) disable(); }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { if (on) { metrics(); if (scene) scene.resize(); onScroll(); } }, { passive: true });
    doc.addEventListener('visibilitychange', function () { if (scene && on) scene.setVisible(visible); });
    [GATE, REDUCE].forEach(function (qs) { var m = window.matchMedia && window.matchMedia(qs); if (m) { if (m.addEventListener) m.addEventListener('change', evaluate); else if (m.addListener) m.addListener(evaluate); } });
    evaluate();
    if (DEBUG) window.__m3d = { ui: ui, get scene() { return scene; }, spOf: spOf, goto: goto, metrics: function () { metrics(); return { top: top, ph: ph }; } };
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
}());
