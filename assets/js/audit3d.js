/* Start-up Audit — Home "Inside the Business": a scroll-driven 3D audit story.
   The section is one pinned, full-width stage that continues the hero. Scrolling brings the six glass modules together;
   a tap (or more scrolling) sends the first module to the left and its details appear on the right as HUD text; scrolling on
   brings each next module up in the middle, slides it left, and so on through all six.

   Self-contained WebGL, no libraries and no network — the same approach as the hero (assets/js/hero3d.js).
   The six dimensions live in the page as plain HTML, so the section still reads when WebGL or JavaScript is unavailable.
   Add ?3ddebug to the URL to log renderer info and quality changes to the console. */
(function () {
  'use strict';
  function sfx(n) { try { window.dispatchEvent(new CustomEvent('sa:sfx', { detail: n })); } catch (e) {} }   // sound hook only; nothing visual

  var doc = document, root = doc.documentElement;
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q).matches : false; };
  var DEBUG = /[?&]3ddebug/.test(window.location.search);

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
  function SC(x, y, z) { var m = ident(); m[0] = x; m[5] = y; m[10] = z; return m; }
  function RX(a) { var m = ident(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  function RY(a) { var m = ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
  function RZ(a) { var m = ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
  function chain() { var m = ident(); for (var i = 0; i < arguments.length; i++) m = mul(m, arguments[i]); return m; }
  function xf(m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
  function n3(m) { return new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]); }
  function perspective(fovy, asp, n, f, sx, sy) {                       // sx / sy = lens shift (moves the picture sideways / up without turning the camera)
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
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeBack(t) { var c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
  function hex(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* brand palette: teal #008080, charcoal #293133, platinum #E5E4E2, white */
  var TEAL = hex('#008080'), TEAL_HI = hex('#16b3ac'), AQUA = hex('#6fe3d8'), PLAT = hex('#E5E4E2'), WHITE = hex('#FFFFFF'), MIST = hex('#a9d9d4');

  /* ============================================================== geometry */
  function Mesh() { this.p = []; this.n = []; this.i = []; }
  Mesh.prototype.v = function (x, y, z, nx, ny, nz) { this.p.push(x, y, z); this.n.push(nx, ny, nz); return this.p.length / 3 - 1; };

  function flatPoly(vs, fs, r) {
    var m = new Mesh(), edges = {}, lines = [];
    vs = vs.map(function (v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l * r, v[1] / l * r, v[2] / l * r]; });
    fs.forEach(function (f) {
      var a = vs[f[0]], b = vs[f[1]], c = vs[f[2]];
      var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
      var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      var i0 = m.v(a[0], a[1], a[2], nx, ny, nz), i1 = m.v(b[0], b[1], b[2], nx, ny, nz), i2 = m.v(c[0], c[1], c[2], nx, ny, nz);
      m.i.push(i0, i1, i2);
      [[f[0], f[1]], [f[1], f[2]], [f[2], f[0]]].forEach(function (e) {
        var k = Math.min(e[0], e[1]) + '_' + Math.max(e[0], e[1]);
        if (!edges[k]) { edges[k] = 1; lines.push(vs[e[0]][0], vs[e[0]][1], vs[e[0]][2], vs[e[1]][0], vs[e[1]][1], vs[e[1]][2]); }
      });
    });
    return { mesh: m, lines: lines };
  }
  function icosa(r) {
    var t = (1 + Math.sqrt(5)) / 2;
    return flatPoly([[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]],
      [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]], r);
  }
  function octa(r) {
    return flatPoly([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
      [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]], r);
  }
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
  /* extruded outline (counter-clockwise, star-shaped around the origin), axis = z */
  function prism(pts, h) {
    var g = new Mesh(), n = pts.length, z = h / 2, i;
    for (i = 0; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, nx = dy / l, ny = -dx / l;
      var a = g.v(p[0], p[1], -z, nx, ny, 0), b = g.v(q[0], q[1], -z, nx, ny, 0), c = g.v(q[0], q[1], z, nx, ny, 0), d = g.v(p[0], p[1], z, nx, ny, 0);
      g.i.push(a, b, c, a, c, d);
    }
    var ct = g.v(0, 0, z, 0, 0, 1), cb = g.v(0, 0, -z, 0, 0, -1), t0 = g.p.length / 3, b0;
    for (i = 0; i < n; i++) { g.v(pts[i][0], pts[i][1], z, 0, 0, 1); }
    b0 = g.p.length / 3;
    for (i = 0; i < n; i++) { g.v(pts[i][0], pts[i][1], -z, 0, 0, -1); }
    for (i = 0; i < n; i++) { g.i.push(ct, t0 + i, t0 + (i + 1) % n); g.i.push(cb, b0 + (i + 1) % n, b0 + i); }
    return g;
  }
  function prismLines(pts, h) {
    var l = [], n = pts.length, z = h / 2, i;
    for (i = 0; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n];
      l.push(p[0], p[1], z, q[0], q[1], z, p[0], p[1], -z, q[0], q[1], -z);
    }
    return l;
  }
  /* surface of revolution around y; profile = [[radius, y], ...] */
  function lathe(profile, seg) {
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
  function gearPts(teeth, rO, rR) {
    var p = [], s = Math.PI * 2 / teeth, i;
    for (i = 0; i < teeth; i++) {
      [[0, rR], [.12, rO], [.40, rO], [.52, rR]].forEach(function (q) { var an = i * s + q[0] * s; p.push([Math.cos(an) * q[1], Math.sin(an) * q[1]]); });
    }
    return p;
  }
  function circlePts(r, seg) { var p = [], k; for (k = 0; k < seg; k++) p.push([Math.cos(k / seg * Math.PI * 2) * r, Math.sin(k / seg * Math.PI * 2) * r]); return p; }

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

  /* ================================================================ UI (stage text, hints, progress) */
  function initUI(host) {
    var arts = [].slice.call(host.querySelectorAll('.a3d-art'));
    var segs = [].slice.call(host.querySelectorAll('.a3d-rail i'));
    var curEl = host.querySelector('[data-cur]');
    var names = [].slice.call(host.querySelectorAll('.a3d-lbl')).map(function (l) { return l.getAttribute('data-name') || ''; });
    var want = -2;

    function lock(a, on) {
      if (on) { a.setAttribute('inert', ''); a.setAttribute('aria-hidden', 'true'); } else { a.removeAttribute('inert'); a.removeAttribute('aria-hidden'); }
    }
    return {
      names: names,
      /* the immersive layout is only switched on once WebGL is confirmed: until then (and without it) the six dimensions are plain stacked cards */
      enable: function () {
        host.classList.remove('a3d--no3d'); host.classList.add('a3d--ready');
        arts.forEach(function (a) { a.classList.remove('is-shown'); lock(a, true); });
      },
      disable: function () {
        host.classList.remove('a3d--ready', 'is-focus', 'is-last', 'has-shown', 'is-formed'); host.classList.add('a3d--no3d');
        arts.forEach(function (a) { a.classList.remove('is-shown'); lock(a, false); });
      },
      /* which stage the scroll position asks for (-1 = overview) */
      setWant: function (i) {
        if (i === want) return;
        want = i;
        host.classList.toggle('is-focus', i >= 0);
        host.classList.toggle('is-last', i === arts.length - 1);
        if (curEl && i >= 0) curEl.textContent = '0' + (i + 1);
        segs.forEach(function (s, k) { s.classList.toggle('on', k <= i); s.classList.toggle('cur', k === i); });
      },
      /* which dimension's details are on screen (called by the scene once its module has slid into place) */
      setShown: function (i) {
        arts.forEach(function (a) {
          var on = +a.getAttribute('data-i') === i;
          a.classList.toggle('is-shown', on); lock(a, !on);
        });
        host.classList.toggle('has-shown', i >= 0);
      }
    };
  }

  /* ================================================================ 3D scene */
  function initGL(host, ui) {
    var stage = host.querySelector('.a3d-pin'), canvas = host.querySelector('.a3d-canvas');
    if (!stage || !canvas) return null;

    var gl = null;
    try { gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: true, stencil: false, premultipliedAlpha: true }) || canvas.getContext('experimental-webgl'); } catch (e) { gl = null; }
    if (!gl) return null;

    var PG, PL, PS;
    try {
      PG = makeProgram(gl, G_VS, G_FS, ['uVP', 'uM', 'uN', 'uColor', 'uCam', 'uAlpha', 'uGlow', 'uHi', 'uTime', 'uFog'], ['aPos', 'aNor']);
      PL = makeProgram(gl, L_VS, L_FS, ['uVP', 'uM', 'uCol', 'uCam', 'uFog'], ['aPos']);
      PS = makeProgram(gl, P_VS, P_FS, ['uVP', 'uRight', 'uUp'], ['aPos', 'aCor', 'aSize', 'aCol']);
    } catch (e) { if (DEBUG) console.warn('[audit3d] shader error', e); return null; }

    var lite = mq('(max-width: 899px)') || mq('(pointer: coarse)');
    var reduce = function () { return mq('(prefers-reduced-motion: reduce)') && !root.classList.contains('sa-motion-on'); };
    var still = reduce();

    /* ---------- GL state helpers ---------- */
    var enabled = [], MAXA = 8, q;
    for (q = 0; q < MAXA; q++) enabled[q] = false;
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
    var dynLines = gl.createBuffer();            // spokes + links, rebuilt every frame
    var MAXS = 520;                               // sprites per frame
    var sprBuf = gl.createBuffer(), sprData = new Float32Array(MAXS * 4 * 10), sprN = 0;
    var sprIdx = gl.createBuffer(), idx = new Uint16Array(MAXS * 6), z;
    for (z = 0; z < MAXS; z++) { idx[z * 6] = z * 4; idx[z * 6 + 1] = z * 4 + 1; idx[z * 6 + 2] = z * 4 + 2; idx[z * 6 + 3] = z * 4; idx[z * 6 + 4] = z * 4 + 2; idx[z * 6 + 5] = z * 4 + 3; }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sprIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    var CORN = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    function spr(x, y, zz, size, c, a) {
      if (sprN >= MAXS || a <= 0.003) return;
      var o = sprN * 40, k;
      for (k = 0; k < 4; k++) {
        sprData[o] = x; sprData[o + 1] = y; sprData[o + 2] = zz; sprData[o + 3] = CORN[k][0]; sprData[o + 4] = CORN[k][1]; sprData[o + 5] = size;
        sprData[o + 6] = c[0]; sprData[o + 7] = c[1]; sprData[o + 8] = c[2]; sprData[o + 9] = a; o += 10;
      }
      sprN++;
    }

    /* ---------- part helpers ---------- */
    var IDM = function () { return ident(); };
    function mesh(g) { return upMesh(g.mesh || g); }
    function solid(g, col, glow, m) { return { g: g, c: col, a: 1, gl: glow || 0, m: m || IDM }; }
    function glass(g, col, a, m) { return { g: g, c: col, a: a, gl: 0, m: m || IDM }; }
    function ln(l, col, a, m) { return { l: l, c: col, a: a, m: m || IDM }; }
    function segs(arr) { return upLines(arr); }
    var HALF = Math.PI / 2;

    /* ---------- the six modules: each has its own silhouette and motion ---------- */
    function modBrand() {              // identity globe with orbiting touchpoint ring
      var sph = mesh(sphere(.46, lite ? 12 : 18, lite ? 18 : 28)), core = mesh(sphere(.14, 10, 14)), sat = mesh(sphere(.055, 8, 10));
      var ra = segs(circleLines(.68, 64)), rb = segs(circleLines(.6, 64)), eq = segs(circleLines(.47, 48));
      return {
        acc: TEAL_HI, y: .2, solids: [
          solid(core, AQUA, 1, function (t) { return S(1 + .14 * Math.sin(t * 3)); }),
          solid(sat, WHITE, 1, function (t) { var a = t * 1.3; return chain(RX(1.15), RZ(t * .5), T(Math.cos(a) * .68, Math.sin(a) * .68, 0)); })
        ],
        glass: [glass(sph, TEAL_HI, .95)],
        lines: [ln(ra, AQUA, .9, function (t) { return chain(RX(1.15), RZ(t * .5)); }), ln(rb, WHITE, .5, function (t) { return chain(RZ(.8), RX(1.4), RZ(-t * .6)); }),
          ln(eq, WHITE, .4, function () { return RX(HALF); }), ln(eq, WHITE, .3, function (t) { return chain(RY(t * .35), RX(.2)); })],
        sprites: function (t) { var a = t * 1.3, p = xf(chain(RX(1.15), RZ(t * .5)), Math.cos(a) * .68, Math.sin(a) * .68, 0); return [[p[0], p[1], p[2], .28, AQUA, .7]]; }
      };
    }
    function modFinance() {            // rising bars + a spinning coin
      var bars = [[.22, .38, -.34, TEAL], [.22, .64, 0, TEAL_HI], [.22, .96, .34, AQUA]], b = bars.map(function (d) {
        return { g: mesh(box(d[0], d[1], d[0])), l: segs(boxLines(d[0], d[1], d[0])), h: d[1], x: d[2], c: d[3] };
      });
      var coin = mesh(prism(circlePts(.2, lite ? 18 : 28), .06)), coinL = segs(prismLines(circlePts(.2, 28), .06)), base = segs([-.62, -.45, 0, .62, -.45, 0, -.62, -.45, 0, -.62, -.38, 0, 0, -.45, 0, 0, -.4, 0, .62, -.45, 0, .62, -.38, 0]);
      var m = { acc: MIST, y: -.2, solids: [solid(coin, PLAT, .22, function (t) { return chain(T(0, .78 + .05 * Math.sin(t * 1.4), 0), RY(t * 1.5)); })], glass: [], lines: [ln(base, MIST, .6), ln(coinL, WHITE, .8, function (t) { return chain(T(0, .78 + .05 * Math.sin(t * 1.4), 0), RY(t * 1.5)); })] };
      b.forEach(function (d, i) {
        var mm = function (t) { var k = 1 + .05 * Math.sin(t * 1.6 + i * 1.2); return chain(T(d.x, -.45 + d.h * k / 2, 0), SC(1, k, 1)); };
        m.glass.push(glass(d.g, d.c, .95, mm)); m.lines.push(ln(d.l, WHITE, .65, mm));
      });
      m.sprites = function (t) { return [[0, .78 + .05 * Math.sin(t * 1.4), 0, .3, PLAT, .5]]; };
      return m;
    }
    function modOps() {                // two meshing gears
      var g1p = gearPts(10, .52, .4), g2p = gearPts(7, .3, .22);
      var g1 = mesh(prism(g1p, .18)), g2 = mesh(prism(g2p, .18)), hub = mesh(prism(circlePts(.13, 16), .26)), g1l = segs(prismLines(g1p, .18)), g2l = segs(prismLines(g2p, .18));
      var r1 = function (t) { return chain(RZ(t * .6)); }, r2 = function (t) { return chain(T(.68, -.42, 0), RZ(-t * .6 * 10 / 7 + .22)); };
      return {
        acc: TEAL, y: .18, solids: [solid(hub, AQUA, 1, r1)],
        glass: [glass(g1, TEAL_HI, .95, r1), glass(g2, AQUA, .95, r2)],
        lines: [ln(g1l, WHITE, .75, r1), ln(g2l, WHITE, .7, r2)],
        sprites: function () { return [[0, 0, .1, .34, AQUA, .55]]; }
      };
    }
    function modCustomer() {           // customer diamond with touchpoints on a journey orbit
      var oc = octa(.52), o = mesh(oc.mesh), ol = segs(oc.lines), ic = octa(.2), inner = mesh(ic.mesh), sat = mesh(sphere(.07, 8, 10)), orb = segs(circleLines(.8, 64));
      var tilt = function (t) { return chain(RX(1.1), RZ(.3 + t * .1)); };
      var m = {
        acc: AQUA, y: -.15, solids: [solid(inner, AQUA, 1, function (t) { return chain(RY(-t * .9), S(1 + .12 * Math.sin(t * 2.4))); })],
        glass: [glass(o, TEAL_HI, .92, function (t) { return RY(t * .6); })], lines: [ln(ol, WHITE, .7, function (t) { return RY(t * .6); }), ln(orb, AQUA, .6, tilt)], sprites: null
      };
      var pos = function (t, i) { var a = t * .9 + i * 2.094; return [Math.cos(a) * .8, Math.sin(a) * .8, 0]; };
      [0, 1, 2].forEach(function (i) { m.solids.push(solid(sat, WHITE, 1, function (t) { var p = pos(t, i); return chain(tilt(t), T(p[0], p[1], p[2])); })); });
      m.sprites = function (t) { return [0, 1, 2].map(function (i) { var p = pos(t, i), w = xf(tilt(t), p[0], p[1], p[2]); return [w[0], w[1], w[2], .22, AQUA, .7]; }); };
      return m;
    }
    function modMarketing() {          // acquisition funnel feeding a retention loop
      var fun = mesh(lathe([[.62, .5], [.5, .2], [.22, -.2], [.13, -.5]], lite ? 18 : 28)), r = [[.62, .5], [.5, .2], [.22, -.2], [.13, -.5]].map(function (p) { return { l: segs(circleLines(p[0], 48)), y: p[1] }; });
      var loop = segs(circleLines(.34, 48)), loopSat = mesh(sphere(.05, 8, 10));
      var lm = function (t) { return chain(T(0, -.68, 0), RX(1.35), RZ(t * .9)); };
      var m = {
        acc: TEAL_HI, y: .1, solids: [solid(loopSat, WHITE, 1, function (t) { var a = t * 1.8; return chain(lm(t), T(Math.cos(a) * .34, Math.sin(a) * .34, 0)); })],
        glass: [glass(fun, TEAL_HI, .85)], lines: [ln(loop, AQUA, .85, lm)]
      };
      r.forEach(function (d) { m.lines.push(ln(d.l, WHITE, .5, function () { return chain(T(0, d.y, 0), RX(HALF)); })); });
      m.sprites = function (t) {
        var out = [], i, u, y;
        for (i = 0; i < 5; i++) { u = (t * .32 + i * .2) % 1; y = .5 - u; var rr = .4 * (1 - u * .85); out.push([Math.cos(i * 2.4 + u * 5) * rr, y, Math.sin(i * 2.4 + u * 5) * rr, .1 * (1 - .5 * u) + .05, i % 2 ? AQUA : WHITE, .8]); }
        return out;
      };
      return m;
    }
    function modGrowth() {             // stepped ascent topped by a target
      var sizes = [.98, .74, .5, .26], cols = [TEAL, TEAL_HI, AQUA, MIST], m = { acc: AQUA, y: -.1, solids: [], glass: [], lines: [] };
      sizes.forEach(function (w, i) {
        var g = mesh(box(w, .17, w)), l = segs(boxLines(w, .17, w)), mm = function () { return T(0, -.5 + .085 + i * .19, 0); };
        m.glass.push(glass(g, cols[i], .95, mm)); m.lines.push(ln(l, WHITE, .65, mm));
      });
      var oc = octa(.17), tgt = mesh(oc.mesh), tl = segs(oc.lines), tm = function (t) { return chain(T(0, .66 + .06 * Math.sin(t * 2), 0), RY(t * 1.6)); };
      var arrow = segs([-.12, .96, 0, 0, 1.1, 0, 0, 1.1, 0, .12, .96, 0, -.09, .84, 0, 0, .96, 0, 0, .96, 0, .09, .84, 0]);
      m.solids.push(solid(tgt, WHITE, 1, tm)); m.lines.push(ln(tl, WHITE, .9, tm), ln(arrow, AQUA, .8, function (t) { return T(0, .04 * Math.sin(t * 2 + 1), 0); }));
      m.sprites = function (t) { return [[0, .66 + .06 * Math.sin(t * 2), 0, .36, WHITE, .4]]; };
      return m;
    }

    var DEFS = [modBrand, modFinance, modOps, modCustomer, modMarketing, modGrowth];
    var N = DEFS.length, RAD = 1.95;
    var mods = DEFS.map(function (f, i) {
      var d = f(); d.a = i * Math.PI * 2 / N; d.name = ui.names[i] || '';
      d.sc = 0; d.hv = 0; d.sl = 0; d.spin = i * 1.3; d.M = ident(); d.pos = [0, 0, 0]; d.al = 1; d.lal = 1; d.appear = 0; d.vis = 1; d.fc = 0; d.on = false; d.vv = 1;
      d.plate = [segs(circleLines(.82, 6)), segs(circleLines(.56, 48))];
      return d;
    });


    /* core: the audit hub every dimension connects to */
    var coreIc = icosa(.64), coreOut = mesh(coreIc.mesh), coreOutL = segs(coreIc.lines), coreIn = mesh(icosa(.3).mesh), coreRing = segs(circleLines(.86, 64)), coreRing2 = segs(circleLines(1.02, 64));
    var ringOrbit = segs(circleLines(RAD, 96)), ticksArr = [], tk;
    for (tk = 0; tk < 96; tk++) { var ta = tk / 96 * Math.PI * 2, r0 = RAD + .55, r1 = RAD + (tk % 4 === 0 ? .78 : .66); ticksArr.push(Math.cos(ta) * r0, 0, Math.sin(ta) * r0, Math.cos(ta) * r1, 0, Math.sin(ta) * r1); }
    var ticks = segs(ticksArr);
    var FLOOR_Y = -1.5, floorRings = [1.4, 2.6, 3.8, 5.0].map(function (r) { return segs(circleLines(r, 96)); });
    var dust = [], rd = rng(7), nd = lite ? 46 : 110, di;
    for (di = 0; di < nd; di++) dust.push({ x: (rd() - .5) * 11, y0: rd() * 5.6, z: (rd() - .5) * 8 - .5, vy: .05 + rd() * .1, s: .03 + rd() * .06, ph: rd() * 6.28, c: rd() > .6 ? WHITE : TEAL_HI });

    /* ---------- state ----------
       want  = the stage the scroll position asks for (-1 = overview of all six, 0..5 = one dimension)
       cur   = the module that is actually on stage right now (it can lag behind `want` while one leaves and the next arrives)
       shx/shy = where the structure sits on screen (lens shift): overview -> middle -> side (left on desktop, top on phones) */
    var st = { t: 2, intro: 0, introT: 0, introOn: false, yaw: 0, yawV: 0, f: 0, want: -1, cur: -1, shown: -1, fromStage: false, formed: false, hov: -1, pulse: -9,
      mx: 0, my: 0, px: 0, py: 0, ride: 0, rideT: 0, shx: 0, shy: 0, visible: false, dirty: true, q: 1, W: 1, H: 1, wide: true, ptr: null, lbl: false };
    var scr = mods.map(function () { return { x: 0, y: 0, r: 0, z: 0 }; });
    var camEye = [0, 2, 9], camTgt = [0, 0, 0];
    var rate = function (dt, r) { return still ? 1 : 1 - Math.exp(-dt * r); };
    var labelsEl = host.querySelector('.a3d-labels'), lbls = [].slice.call(host.querySelectorAll('.a3d-lbl'));
    function slot(n) {
      if (st.wide) return n === 'ov' ? [.30, 0] : n === 'mid' ? [0, 0] : [-.42, 0];
      return n === 'ov' ? [0, -.27] : n === 'mid' ? [0, -.02] : [0, .45];
    }
    function away(a) { return Math.abs(st.shx - a[0]) + Math.abs(st.shy - a[1]); }
    (function () { var s0 = slot('ov'); st.shx = s0[0]; st.shy = s0[1]; })();

    /* ---------- sizing ---------- */
    function resize() {
      var cw = Math.max(1, stage.clientWidth), ch = Math.max(1, stage.clientHeight), dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2) * st.q;
      var w = Math.max(2, Math.round(cw * dpr)), h = Math.max(2, Math.round(ch * dpr));
      var cap = lite ? 1300000 : 2600000; if (w * h > cap) { var kk = Math.sqrt(cap / (w * h)); w = Math.round(w * kk); h = Math.round(h * kk); }
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      var wasWide = st.wide;
      st.W = cw; st.H = ch; st.wide = cw >= 860 && cw / ch >= 1.15; st.dirty = true;
      host.classList.toggle('a3d--tall', !st.wide);
      if (wasWide !== st.wide) { var s1 = slot(st.want < 0 ? 'ov' : (st.shown >= 0 ? 'side' : 'mid')); st.shx = s1[0]; st.shy = s1[1]; }
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
    resize();

    /* ---------- pointer: a light parallax and a hover highlight on the overview (the scroll drives everything else) ---------- */
    function setHover(i) {
      if (i === st.hov) return;
      st.hov = i; if (i >= 0) sfx('hover'); lbls.forEach(function (l, k) { l.classList.toggle('is-hover', k === i); }); st.dirty = true;
    }
    function hitTest(px, py) {
      var best = -1, bz = 1e9, k;
      for (k = 0; k < N; k++) {
        if (!mods[k].on) continue;
        var s = scr[k], d = Math.hypot(px - s.x, py - s.y);
        if (d < s.r * 1.05 && s.z < bz) { bz = s.z; best = k; }
      }
      return best;
    }
    stage.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      st.ptr = [x, y]; st.mx = (x / st.W - .5) * 2; st.my = (y / st.H - .5) * 2; st.dirty = true;
    });
    stage.addEventListener('pointerleave', function () { st.ptr = null; st.mx = 0; st.my = 0; setHover(-1); });

    /* ---------- update ---------- */
    var fpsAcc = 0, fpsN = 0, slow = 0;
    function update(dt) {
      if (!still) st.t += dt;
      var dI = st.introT - st.intro;
      st.intro = (still || Math.abs(dI) < .0008) ? st.introT : st.intro + dI * rate(dt, 3.2);
      st.ride += (st.rideT - st.ride) * rate(dt, 3);
      var it = st.intro * 3.6, want = st.want, k, m;
      var ov = slot('ov'), mid = slot('mid'), side = slot('side');

      /* which module is on stage: the current one leaves first (shrinks away, or glides back into the ring), then the requested one arrives in the middle */
      var cur = st.cur;
      if (cur >= 0 && want !== cur) {
        if (st.shown >= 0) { st.shown = -1; ui.setShown(-1); }
        var mc = mods[cur];
        if (want >= 0) { st.fromStage = true; if (mc.vis < .06 && away(mid) < .05) { st.cur = cur = -1; } }
        else if (mc.fc < .06) { st.cur = cur = -1; }
      }
      if (cur < 0 && want >= 0) {
        st.cur = cur = want;
        if (st.fromStage) { mods[want].fc = 1; mods[want].vis = 0; }          // arrives from nothing, in the middle of the screen
        st.fromStage = false;
      }

      /* where the structure sits on screen */
      var tgt = want < 0 ? ov : (cur === want && mods[cur].fc > .93 && mods[cur].vis > .85 ? side : mid);
      st.shx += (tgt[0] - st.shx) * rate(dt, 2.7); st.shy += (tgt[1] - st.shy) * rate(dt, 2.7);
      if (cur >= 0 && want === cur && st.shown !== cur) {                        // details appear once the module has slid most of the way to its side
        var span = Math.abs(side[0] - mid[0]) + Math.abs(side[1] - mid[1]), done = 1 - away(side) / Math.max(span, .01);
        if (done > .74 || still) { st.shown = cur; ui.setShown(cur); }
      }
      st.f += ((want >= 0 ? 1 : 0) - st.f) * rate(dt, 3);

      if (want < 0 && !still) {                                                   // the whole structure turns slowly in the overview
        var auto = .2 * clamp((it - 1.8) / 1.2, 0, 1);
        st.yawV += (auto - st.yawV) * rate(dt, 1.4); st.yaw += st.yawV * dt;
      } else st.yawV += (0 - st.yawV) * rate(dt, 3);
      st.px += (st.mx - st.px) * rate(dt, 2.4); st.py += (st.my - st.py) * rate(dt, 2.4);

      for (k = 0; k < N; k++) {
        m = mods[k];
        var tv, tf;
        if (k === cur) { if (want === k) { tv = 1; tf = 1; } else if (want < 0) { tv = 1; tf = 0; } else { tv = 0; tf = 1; } }
        else { tv = want < 0 ? 1 : 0; tf = 0; }
        m.vis += (tv - m.vis) * rate(dt, tv ? 4.2 : 6.5); m.fc += (tf - m.fc) * rate(dt, 3.2);
        if (Math.abs(tv - m.vis) < .002) m.vis = tv;
        if (Math.abs(tf - m.fc) < .002) m.fc = tf;
        m.p = clamp((it - .5 - k * .2) / 1.2, 0, 1);
        m.appear = easeOut(m.p);
        m.hv += ((st.hov === k && st.f < .2 ? 1 : 0) - m.hv) * rate(dt, 9);
        if (!still) {
          if (m.fc > .5) { var tg = .35 + .55 * Math.sin(st.t * .42), dd = wrap(tg - m.spin); m.spin += dd * rate(dt, 3); }   // on stage: a slow 3/4 sweep so every face is seen
          else m.spin += dt * (.5 + m.hv * .5);
        } else m.spin = .42;
      }
      var formed = st.intro > .97;
      if (formed !== st.formed) { st.formed = formed; host.classList.toggle('is-formed', formed); }

      /* adaptive quality: step the render resolution down if the device can't hold ~40fps */
      if (!still && st.introOn) {
        fpsAcc += dt; fpsN++;
        if (fpsN >= 90) {
          var avg = fpsAcc / fpsN; fpsAcc = 0; fpsN = 0;
          if (avg > .028 && st.q > .55) { slow++; if (slow >= 2) { st.q = Math.max(.55, st.q - .15); slow = 0; resize(); if (DEBUG) console.log('[audit3d] quality ->', st.q.toFixed(2), 'avg frame', (avg * 1000).toFixed(1) + 'ms'); } }
          else slow = 0;
        }
      }
    }

    /* ---------- draw ---------- */
    var VP, VIEW;
    function draw() {
      var W = canvas.width, H = canvas.height, t = st.t, it = st.intro * 3.6;
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.depthFunc(gl.LEQUAL);

      /* camera: wide overview -> a closer, steadier shot while one module is on stage; the lens shift slides the subject to its side of the screen */
      var asp = st.W / st.H, fov = (st.wide ? 38 : 50) * Math.PI / 180, th = Math.tan(fov / 2);
      var over = st.wide ? clamp(3.3 / (.7 * th * Math.min(asp, 2.4)) * 1.08, 8.4, 16) : clamp(3.25 / (th * asp) * 1.06, 9, 20);
      var foc = st.wide ? clamp(8.4 + (1.6 - Math.min(asp, 1.6)) * 3, 7.6, 11.5) : clamp(2.4 / (th * asp) + 1.5, 9, 17);
      var f = easeInOut(st.f), io = 1 - easeOut(clamp(st.intro, 0, 1)), par = still ? 0 : 1;
      camEye[0] = st.px * .55 * (1 - .45 * f) * par;
      camEye[1] = lerp(2.15, .9, f) - st.py * .28 * par + st.ride * .45 * (1 - f) + io * 1.7;
      camEye[2] = lerp(over - st.ride * .7, foc, f) + io * 6;
      camTgt[0] = 0; camTgt[1] = lerp(-.1, 0, f); camTgt[2] = 0;
      VIEW = lookAt(camEye, camTgt, [0, 1, 0]);
      var proj = perspective(fov, asp, .1, 80, -st.shx, -st.shy);
      VP = mul(proj, VIEW);
      var right = [VIEW[0], VIEW[4], VIEW[8]], up = [VIEW[1], VIEW[5], VIEW[9]];
      var FOG = 34, k, p, i, FS = st.wide ? 1.85 : 1.5;

      /* modules: each sits in the ring, or (when on stage) glides to the middle and grows */
      var yaw = st.yaw + (1 - easeOut(clamp(st.intro, 0, 1))) * -2.8;
      var order = [];
      for (k = 0; k < N; k++) {
        var m = mods[k], e = easeInOut(clamp(m.fc, 0, 1)), rr = RAD * easeBack(m.p), ang = m.a + yaw;
        var bob = still ? 0 : Math.sin(t * .9 + k * 1.7) * .09, vv = easeOut(clamp(m.vis, 0, 1));
        var ox = Math.sin(ang) * rr, oy = m.y * .9 + bob, oz = Math.cos(ang) * rr;
        var sc = m.appear * vv * lerp(1 + .12 * m.hv, FS, e);
        m.pos = [lerp(ox, 0, e), lerp(oy, m.y * .45 + bob * .5, e), lerp(oz, 0, e)];
        m.scl = Math.max(sc, .0001); m.vv = vv; m.on = m.appear > .02 && vv > .02;
        m.M = chain(T(m.pos[0], m.pos[1], m.pos[2]), RY(m.spin), S(m.scl));
        m.sl = e * vv;
        m.al = m.appear * vv;
        m.lal = m.appear * vv * (.62 + .38 * Math.max(m.sl, m.hv));
        var c4 = xf(VP, m.pos[0], m.pos[1], m.pos[2]), w4 = VP[3] * m.pos[0] + VP[7] * m.pos[1] + VP[11] * m.pos[2] + VP[15];
        var dist = Math.hypot(camEye[0] - m.pos[0], camEye[1] - m.pos[1], camEye[2] - m.pos[2]);
        scr[k].x = (c4[0] / w4 * .5 + .5) * st.W; scr[k].y = (1 - (c4[1] / w4 * .5 + .5)) * st.H;
        scr[k].r = .78 * Math.max(sc, .3) * (st.H / 2) / (th * dist); scr[k].z = dist;
        order.push(k);
      }
      order.sort(function (a, b) { return scr[b].z - scr[a].z; });
      var core = { M: chain(RY(t * .25), RX(t * .12), S(1 + .03 * Math.sin(t * 2))), al: clamp(it / .8, 0, 1) * (1 - f) };
      var pulse = .5 + .5 * Math.sin(t * 2.2);

      /* ---- pass 1: opaque cores (write depth) ---- */
      use(PG);
      gl.uniformMatrix4fv(PG.u.uVP, false, VP); gl.uniform3f(PG.u.uCam, camEye[0], camEye[1], camEye[2]); gl.uniform1f(PG.u.uTime, t); gl.uniform1f(PG.u.uFog, FOG);
      function drawMesh(g, M, col, a, glow, hi) {
        gl.uniformMatrix4fv(PG.u.uM, false, M); gl.uniformMatrix3fv(PG.u.uN, false, n3(M));
        gl.uniform3f(PG.u.uColor, col[0], col[1], col[2]); gl.uniform1f(PG.u.uAlpha, a); gl.uniform1f(PG.u.uGlow, glow); gl.uniform1f(PG.u.uHi, hi);
        gl.bindBuffer(gl.ARRAY_BUFFER, g.p); gl.vertexAttribPointer(PG.a.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, g.nr); gl.vertexAttribPointer(PG.a.aNor, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.i); gl.drawElements(gl.TRIANGLES, g.n, gl.UNSIGNED_SHORT, 0);
      }
      gl.depthMask(true);
      if (core.al > .01) drawMesh(coreIn, chain(core.M, S(.9 + .1 * pulse)), TEAL_HI, 1, .75 + .4 * pulse, 1);
      for (k = 0; k < N; k++) {
        var mo = mods[k]; if (!mo.on) continue;
        for (i = 0; i < mo.solids.length; i++) { p = mo.solids[i]; drawMesh(p.g, chain(mo.M, p.m(t)), p.c, 1, p.gl * (.7 + .2 * mo.hv + .5 * mo.sl) * (.4 + .6 * mo.al), 1 + .2 * mo.hv + .3 * mo.sl); }
      }

      /* ---- pass 2: glass (far to near, no depth write) ---- */
      gl.depthMask(false);
      if (core.al > .01) drawMesh(coreOut, core.M, TEAL, .62 * core.al, 0, 1.1);
      for (var oi = 0; oi < N; oi++) {
        var mg = mods[order[oi]]; if (!mg.on) continue;
        for (i = 0; i < mg.glass.length; i++) { p = mg.glass[i]; drawMesh(p.g, chain(mg.M, p.m(t)), p.c, p.a * mg.al, .05 * mg.sl + .04 * mg.hv, 1 + .25 * mg.hv + .3 * mg.sl); }
      }

      /* ---- pass 3: lines (additive) ---- */
      use(PL);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniformMatrix4fv(PL.u.uVP, false, VP); gl.uniform3f(PL.u.uCam, camEye[0], camEye[1], camEye[2]); gl.uniform1f(PL.u.uFog, FOG);
      function drawLines(L, M, c, a) {
        if (a <= .004) return;
        gl.uniformMatrix4fv(PL.u.uM, false, M); gl.uniform4f(PL.u.uCol, c[0], c[1], c[2], a);
        gl.bindBuffer(gl.ARRAY_BUFFER, L.b); gl.vertexAttribPointer(PL.a.aPos, 3, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.LINES, 0, L.n);
      }
      var I4 = ident(), vis = clamp(it / 1.2, 0, 1), fy = FLOOR_Y - .55 * f;
      /* floor grid + expanding scan ring (and a burst of it whenever the screen is tapped) */
      for (i = 0; i < floorRings.length; i++) drawLines(floorRings[i], chain(T(0, fy, 0), RX(HALF)), TEAL_HI, (.34 - i * .06) * vis * (1 + .6 * f));
      var sc0 = still ? .55 : (t % 5) / 5;
      drawLines(floorRings[0], chain(T(0, fy, 0), RX(HALF), S(.4 + sc0 * 3.9)), AQUA, (1 - sc0) * .7 * vis * (still ? 0 : 1));
      var pu = (t - st.pulse) / 1.3;
      if (pu >= 0 && pu < 1 && !still) drawLines(floorRings[0], chain(T(0, fy, 0), RX(HALF), S(.5 + easeOut(pu) * 4.6)), WHITE, (1 - pu) * .85);
      drawLines(ringOrbit, I4, TEAL_HI, .5 * vis * (1 - f));
      drawLines(ticks, RY(yaw), MIST, .5 * vis * (1 - f));
      /* core detail */
      if (core.al > .01) {
        drawLines(coreOutL, core.M, WHITE, .7 * core.al);
        drawLines(coreRing, chain(RX(1.2 + .1 * Math.sin(t * .5)), RZ(t * .4)), AQUA, .75 * core.al);
        drawLines(coreRing2, chain(RX(.5), RY(t * .3), RZ(-t * .35)), WHITE, .35 * core.al);
      }
      /* module lines + plates */
      for (k = 0; k < N; k++) {
        var ml = mods[k]; if (!ml.on) continue;
        for (i = 0; i < ml.lines.length; i++) { p = ml.lines[i]; drawLines(p.l, chain(ml.M, p.m(t)), p.c, p.a * ml.lal); }
        var pm = chain(ml.M, T(0, -.72, 0), RX(HALF), RZ(Math.PI / 6));
        drawLines(ml.plate[0], pm, ml.acc, (.5 + .4 * ml.sl + .25 * ml.hv) * ml.lal); drawLines(ml.plate[1], pm, ml.acc, .28 * ml.lal);
      }
      /* connections: spokes to the core + links between neighbouring modules (overview only) */
      var dyn = [], sdyn = [], ldyn = [];
      for (k = 0; k < N; k++) {
        var mc2 = mods[k], arr = (k === st.hov) ? sdyn : dyn;
        arr.push(0, 0, 0, mc2.pos[0], mc2.pos[1], mc2.pos[2]);
        var nx = mods[(k + 1) % N]; ldyn.push(mc2.pos[0], mc2.pos[1], mc2.pos[2], nx.pos[0], nx.pos[1], nx.pos[2]);
      }
      function drawDyn(arr, c, a) {
        if (!arr.length || a <= .004) return;
        gl.uniformMatrix4fv(PL.u.uM, false, I4); gl.uniform4f(PL.u.uCol, c[0], c[1], c[2], a);
        gl.bindBuffer(gl.ARRAY_BUFFER, dynLines); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(PL.a.aPos, 3, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.LINES, 0, arr.length / 3);
      }
      var conn = clamp((it - 1.1) / 1.4, 0, 1) * (1 - f);
      drawDyn(dyn, TEAL_HI, .42 * conn); drawDyn(ldyn, MIST, .26 * conn); drawDyn(sdyn, AQUA, .95 * conn);

      /* ---- pass 4: glow sprites, data packets, dust (additive) ---- */
      sprN = 0;
      spr(0, 0, 0, 3.4 * core.al, TEAL, (.5 + .15 * pulse) * core.al);
      spr(0, 0, 0, 1.3 * core.al, AQUA, .4 * core.al);
      for (k = 0; k < N; k++) {
        var ms = mods[k]; if (!ms.on) continue;
        var gA = ms.al * (.18 + .3 * ms.sl + .14 * ms.hv);
        spr(ms.pos[0], ms.pos[1], ms.pos[2], (1.5 + 1.6 * ms.sl) * ms.appear * ms.vv, ms.acc, gA);
        if (ms.sl > .02) spr(ms.pos[0], ms.pos[1], ms.pos[2], 3.4 * ms.sl, TEAL, .24 * ms.sl);
        if (ms.sprites) {
          var sp = ms.sprites(t);
          for (i = 0; i < sp.length; i++) { var w = xf(ms.M, sp[i][0], sp[i][1], sp[i][2]); spr(w[0], w[1], w[2], sp[i][3] * ms.scl * .95, sp[i][4], sp[i][5] * ms.al); }
        }
        /* data packets running along the spoke */
        var np = 2 * (still ? 0 : 1), spd = .26;
        for (i = 0; i < np; i++) {
          var u = ((t * spd + k * .37 + i / np) % 1), dir = i % 2 ? 1 - u : u, e2 = easeOut(clamp(conn, 0, 1));
          spr(ms.pos[0] * dir, ms.pos[1] * dir, ms.pos[2] * dir, .08, i % 2 ? WHITE : AQUA, .85 * conn * e2 * (.4 + .6 * Math.sin(u * Math.PI)));
        }
      }
      for (i = 0; i < dust.length; i++) {
        var ds = dust[i], y = ((ds.y0 + t * ds.vy) % 5.6) - 2.4, tw = .5 + .5 * Math.sin(t * 1.3 + ds.ph);
        spr(ds.x, y, ds.z, ds.s, ds.c, (.14 + .4 * tw) * vis * (y < -2 ? clamp((y + 2.4) / .4, 0, 1) : 1));
      }
      use(PS);
      gl.uniformMatrix4fv(PS.u.uVP, false, VP); gl.uniform3f(PS.u.uRight, right[0], right[1], right[2]); gl.uniform3f(PS.u.uUp, up[0], up[1], up[2]);
      gl.bindBuffer(gl.ARRAY_BUFFER, sprBuf); gl.bufferData(gl.ARRAY_BUFFER, sprData.subarray(0, sprN * 40), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(PS.a.aPos, 3, gl.FLOAT, false, 40, 0); gl.vertexAttribPointer(PS.a.aCor, 2, gl.FLOAT, false, 40, 12);
      gl.vertexAttribPointer(PS.a.aSize, 1, gl.FLOAT, false, 40, 20); gl.vertexAttribPointer(PS.a.aCol, 4, gl.FLOAT, false, 40, 24);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sprIdx); gl.drawElements(gl.TRIANGLES, sprN * 6, gl.UNSIGNED_SHORT, 0);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(true);

      /* numbered labels under each module while the whole structure is on show */
      var showLbl = st.want < 0 && st.f < .08 && it > 3;
      if (showLbl !== st.lbl) { st.lbl = showLbl; if (labelsEl) labelsEl.classList.toggle('is-on', showLbl); }
      if (showLbl) {
        for (k = 0; k < N; k++) {
          var s = scr[k], lx = clamp(s.x, 70, st.W - 70), ly = Math.min(s.y + s.r + 4, st.H - 64);
          lbls[k].style.transform = 'translate(' + Math.round(lx) + 'px,' + Math.round(ly) + 'px) translate(-50%,0)';
        }
      }
    }

    /* ---------- loop ---------- */
    var raf = 0, last = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
      still = reduce();
      if (st.ptr && st.f < .15) {                                              // hover highlight while the structure moves underneath the pointer
        var h = hitTest(st.ptr[0], st.ptr[1]);
        if (h !== st.hov) setHover(h);
      } else if (st.hov >= 0) setHover(-1);
      update(dt);
      if (still && !st.dirty) return;
      draw(); st.dirty = false;
    }
    function run() { if (!raf && st.visible && !doc.hidden && !lost) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    function halt() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    var lost = false;
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; halt(); ui.disable(); });
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) halt(); else run(); });
    if (DEBUG) console.log('[audit3d] ready', gl.getParameter(gl.RENDERER), 'lite=' + lite, 'still=' + still);

    return {
      setVisible: function (v) { st.visible = v; if (v) { st.dirty = true; run(); } else halt(); },
      start: function () {
        if (st.introOn) return; st.introOn = true; st.dirty = true; canvas.classList.add('is-on'); resize(); run();
      },
      /* targets from the scroll controller */
      set: function (o) {
        if (o.want !== undefined) st.want = o.want;
        if (o.intro !== undefined) st.introT = o.intro;
        if (o.ride !== undefined) st.rideT = o.ride;
        st.dirty = true; run();
      },
      pulse: function () { st.pulse = st.t; st.dirty = true; },
      _state: st, _scr: scr
    };
  }

  /* ================================================================ boot: scroll story */
  function boot() {
    var host = doc.querySelector('[data-a3d]');
    if (!host) return;
    var track = host.querySelector('.a3d-track'), pin = host.querySelector('.a3d-pin');
    if (!track || !pin) return;
    if (!mq('(min-width: 640px) and (min-height: 520px)')) return;
    var ui = initUI(host), scene = null;
    try { scene = initGL(host, ui); } catch (e) { scene = null; if (DEBUG) console.warn('[audit3d]', e); }
    if (!scene) { host.classList.add('a3d--no3d'); return; }                 // plain stacked cards
    ui.enable();
    window.__audit3d = scene;                                                  // handy for debugging in the console

    /* scroll position -> story position `ps`, in units of one screen of the pinned stage:
         -0.25 .. 0.65   the six shapes assemble        1.0 + 0.8*i .. +0.8   stage i (0..5) is on stage       6.0   the stage lets go */
    var START = 1, LEN = .8, top = 0, ph = 1, stageIdx = -1, lastIdx = -1, qd = 0;
    /* Until the visitor taps, the stage is only one screen tall: scrolling simply carries on to the next page. The tap opens the pinned story. */
    var GATE = '(min-width: 640px) and (min-height: 520px)', idle = mq(GATE), tap = null;
    function setIdle(v) { idle = v; host.classList.toggle('a3d--idle', v); }
    if (idle) {
      setIdle(true);
      tap = doc.createElement('button'); tap.type = 'button'; tap.className = 'sa-tap';
      tap.innerHTML = '<i aria-hidden="true"></i><span>Tap the screen to explore</span>';
      pin.appendChild(tap);
    }
    function metrics() { top = parseFloat(getComputedStyle(pin).top) || 0; ph = pin.offsetHeight || 1; }
    function pickStage(ps, prev) {
      var raw = ps < START ? -1 : Math.min(5, Math.floor((ps - START) / LEN));
      if (raw === prev || Math.abs(raw - prev) > 1) return raw;
      var db = .04;                                                            // a little hysteresis so a nudge at a boundary doesn't flicker
      if (raw > prev) return ps > START + (prev + 1) * LEN + db ? raw : prev;
      return ps < START + prev * LEN - db ? raw : prev;
    }
    function apply() {
      qd = 0;
      var ps = (top - track.getBoundingClientRect().top) / ph;
      if (idle) { stageIdx = -1; scene.set({ want: -1, intro: clamp((ps + .8) / .4, 0, 1), ride: 0 }); ui.setWant(-1); return; }
      stageIdx = pickStage(ps, stageIdx);
      if (stageIdx !== lastIdx) { if (stageIdx >= 0) sfx('select'); lastIdx = stageIdx; }
      scene.set({ want: stageIdx, intro: clamp((ps + .25) / .9, 0, 1), ride: clamp(ps, 0, 1) });
      ui.setWant(stageIdx);
    }
    function onScroll() { if (!qd) qd = requestAnimationFrame(apply); }
    function scrollToPs(ps) {
      var y = window.scrollY + track.getBoundingClientRect().top - top + ps * ph;
      var calm = mq('(prefers-reduced-motion: reduce)') && !root.classList.contains('sa-motion-on');
      window.scrollTo({ top: Math.max(0, y), behavior: calm ? 'auto' : 'smooth' });
    }
    function advance() {                                                       // a tap = "go on": overview -> first module -> next module ...
      var to = stageIdx < 0 ? START + LEN * .5 : stageIdx < 5 ? START + (stageIdx + 1) * LEN + LEN * .5 : START + 6 * LEN + .2;
      scene.pulse(); scrollToPs(to);
    }

    function activate() { if (!idle) return; sfx('engage'); setIdle(false); metrics(); apply(); advance(); }
    if (tap) tap.addEventListener('click', function (e) { e.stopPropagation(); activate(); });

    var down = null;
    pin.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) { down = null; return; }
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    pin.addEventListener('pointerup', function (e) {
      var d = down; down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || performance.now() - d.t > 600) return;
      if (e.target.closest && e.target.closest('a, button, .a3d-panel')) return;
      if (idle) { activate(); return; }
      advance();
    });
    pin.addEventListener('pointercancel', function () { down = null; });       // the browser took the gesture over to scroll

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { if (idle && !mq(GATE)) setIdle(false); metrics(); onScroll(); });
    window.addEventListener('load', function () { metrics(); onScroll(); });
    metrics(); apply();

    if (!('IntersectionObserver' in window)) { scene.setVisible(true); scene.start(); return; }
    new IntersectionObserver(function (entries) {
      var vis = entries[0].isIntersecting;
      scene.setVisible(vis);
      if (vis) { scene.start(); onScroll(); }
    }, { rootMargin: '120px 0px', threshold: 0 }).observe(track);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
