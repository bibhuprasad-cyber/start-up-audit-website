/* Start-up Audit — Home hero: "audit lattice", an interactive 3D business-intelligence scene.
   Self-contained WebGL (no libraries, no network). The original hero photo stays in the page and is
   used automatically whenever WebGL is unavailable, fails, or draws nothing.
   Add ?3ddebug to the URL to see a small status box (renderer, canvas size, errors). */
(function () {
  'use strict';
  function sfx(n) { try { window.dispatchEvent(new CustomEvent('sa:sfx', { detail: n })); } catch (e) {} }   // sound hook only; nothing visual

  var doc = document, root = doc.documentElement;
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q).matches : false; };

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
  function perspective(fovy, asp, n, f) {
    var t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f);
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
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeBack(t) { var c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function hex(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ========================================================== brand colours */
  var TEAL = hex('#008080'), TEAL_HI = hex('#16b3ac'), PLAT = hex('#E5E4E2'), WHITE = hex('#FFFFFF'), CHAR = hex('#293133'), CHAR_LT = hex('#3d4a4c');

  /* ============================================================== geometry */
  function Mesh() { this.p = []; this.n = []; this.i = []; }
  Mesh.prototype.v = function (x, y, z, nx, ny, nz) { this.p.push(x, y, z); this.n.push(nx, ny, nz); return this.p.length / 3 - 1; };

  function flatPoly(vs, fs, r) {                       // flat-shaded polyhedron + unique edge list
    var m = new Mesh(), edges = {}, lines = [];
    vs = vs.map(function (v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l * r, v[1] / l * r, v[2] / l * r]; });
    fs.forEach(function (f) {
      var a = vs[f[0]], b = vs[f[1]], c = vs[f[2]];
      var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
      var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      var cx = a[0] + b[0] + c[0], cy = a[1] + b[1] + c[1], cz = a[2] + b[2] + c[2];
      if (nx * cx + ny * cy + nz * cz < 0) { nx = -nx; ny = -ny; nz = -nz; var tmp = f[1]; f = [f[0], f[2], tmp]; b = vs[f[1]]; c = vs[f[2]]; }
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
  function sphere(r, lat, lon) {
    var g = new Mesh(), i, j;
    for (i = 0; i <= lat; i++) {
      var th = i / lat * Math.PI, st = Math.sin(th), ct = Math.cos(th);
      for (j = 0; j <= lon; j++) { var ph = j / lon * Math.PI * 2, x = st * Math.cos(ph), z = st * Math.sin(ph); g.v(r * x, r * ct, r * z, x, ct, z); }
    }
    for (i = 0; i < lat; i++) for (j = 0; j < lon; j++) { var a = i * (lon + 1) + j, b = a + lon + 1; g.i.push(a, b, b + 1, a, b + 1, a + 1); }
    return g;
  }
  function circleLines(r, seg) {
    var l = [], k; for (k = 0; k < seg; k++) {
      var a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2;
      l.push(Math.cos(a0) * r, Math.sin(a0) * r, 0, Math.cos(a1) * r, Math.sin(a1) * r, 0);
    }
    return l;
  }
  function rectLines(w, h) {
    var x = w / 2, y = h / 2;
    return [-x, -y, 0, x, -y, 0, x, -y, 0, x, y, 0, x, y, 0, -x, y, 0, -x, y, 0, -x, -y, 0];
  }

  /* ============================================================== shaders */
  var HP = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  var SOLID_VS = 'attribute vec3 aPos;attribute vec3 aNor;uniform mat4 uVP;uniform mat4 uM;uniform mat3 uN;varying vec3 vN;varying vec3 vW;' +
    'void main(){vec4 w=uM*vec4(aPos,1.0);vW=w.xyz;vN=uN*aNor;gl_Position=uVP*w;}';
  var SOLID_FS = HP + 'varying vec3 vN;varying vec3 vW;uniform vec3 uColor;uniform vec3 uCam;uniform vec3 uLight;uniform float uAlpha;uniform float uEmis;uniform float uFog;' +
    'void main(){vec3 n=normalize(vN);vec3 v=normalize(uCam-vW);if(dot(n,v)<0.0)n=-n;' +
    'vec3 L1=normalize(vec3(-0.4,0.8,0.5));vec3 L2=normalize(vec3(0.7,-0.3,0.4));' +
    'vec3 lp=uLight-vW;float ld=length(lp);vec3 L3=lp/max(ld,0.001);float att=1.0/(1.0+0.035*ld*ld);' +
    'float d=max(dot(n,L1),0.0)*0.62+max(dot(n,L2),0.0)*0.22+max(dot(n,L3),0.0)*1.25*att;' +
    'vec3 h=normalize(L3+v);float sp=pow(max(dot(n,h),0.0),40.0)*att*1.6;float rim=pow(1.0-max(dot(n,v),0.0),3.0);' +
    'vec3 col=uColor*(0.30+d)+vec3(0.85,1.0,1.0)*sp+vec3(0.0,0.55,0.55)*rim*0.55;col=mix(col,uColor*1.25,uEmis);' +
    'float f=1.0-smoothstep(uFog*0.55,uFog,length(uCam-vW));float a=uAlpha*f;gl_FragColor=vec4(col*a,a);}';
  var LINE_VS = 'attribute vec3 aPos;uniform mat4 uVP;uniform mat4 uM;varying vec3 vW;void main(){vec4 w=uM*vec4(aPos,1.0);vW=w.xyz;gl_Position=uVP*w;}';
  var LINE_FS = HP + 'varying vec3 vW;uniform vec4 uCol;uniform vec3 uFogC;uniform float uFogR;' +
    'void main(){float f=1.0-smoothstep(uFogR*0.35,uFogR,length(vW-uFogC));float a=uCol.a*f;gl_FragColor=vec4(uCol.rgb*a,a);}';
  var SPR_VS = 'attribute vec3 aPos;attribute vec2 aCor;attribute float aSize;attribute vec4 aCol;uniform mat4 uVP;uniform vec3 uRight;uniform vec3 uUp;varying vec2 vC;varying vec4 vCol;' +
    'void main(){vec3 w=aPos+(uRight*aCor.x+uUp*aCor.y)*aSize;vC=aCor;vCol=aCol;gl_Position=uVP*vec4(w,1.0);}';
  var SPR_FS = HP + 'varying vec2 vC;varying vec4 vCol;void main(){float d=length(vC);float g=pow(max(1.0-d,0.0),2.2);float c=smoothstep(0.22,0.0,d)*0.6;float a=(g+c)*vCol.a;gl_FragColor=vec4(vCol.rgb*a,a);}';

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

  /* ================================================================== boot */
  function boot() {
    var heroSection = doc.querySelector('main section:has([data-hero])') ||
      (doc.querySelector('[data-hero]') && doc.querySelector('[data-hero]').closest('section'));
    if (!heroSection) return;
    var img = heroSection.querySelector('img');
    var wrap = img && img.parentElement;
    if (!wrap) return;

    var reduce = mq('(prefers-reduced-motion: reduce)') && !root.classList.contains('sa-motion-on');   // reduced motion: one still frame
    var debugOn = /[?&]3ddebug/.test(window.location.search);

    var canvas = doc.createElement('canvas');
    canvas.className = 'sa-hero3d'; canvas.setAttribute('aria-hidden', 'true');
    var gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: true, stencil: false, premultipliedAlpha: true }) ||
        canvas.getContext('experimental-webgl');
    } catch (e) { gl = null; }
    if (!gl) { root.classList.remove('sa-h3d'); return; }

    var SOLID, LINE, SPR;
    try {
      SOLID = makeProgram(gl, SOLID_VS, SOLID_FS, ['uVP', 'uM', 'uN', 'uColor', 'uCam', 'uLight', 'uAlpha', 'uEmis', 'uFog'], ['aPos', 'aNor']);
      LINE = makeProgram(gl, LINE_VS, LINE_FS, ['uVP', 'uM', 'uCol', 'uFogC', 'uFogR'], ['aPos']);
      SPR = makeProgram(gl, SPR_VS, SPR_FS, ['uVP', 'uRight', 'uUp'], ['aPos', 'aCor', 'aSize', 'aCol']);
    } catch (e) { root.classList.remove('sa-h3d'); return; }

    wrap.appendChild(canvas);

    /* ---------- GL state helpers (only the attributes of the active program stay enabled) ---------- */
    var enabled = [], MAXA = 8, i0;
    for (i0 = 0; i0 < MAXA; i0++) enabled[i0] = false;
    function use(pr) {
      gl.useProgram(pr.p);
      for (var k = 0; k < MAXA; k++) {
        var want = pr.locs.indexOf(k) >= 0;
        if (want !== enabled[k]) { if (want) gl.enableVertexAttribArray(k); else gl.disableVertexAttribArray(k); enabled[k] = want; }
      }
    }
    function blend(mode) { if (mode === 'add') gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }

    function upMesh(m) {
      var o = { n: m.i.length };
      o.p = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, o.p); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(m.p), gl.STATIC_DRAW);
      o.nr = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, o.nr); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(m.n), gl.STATIC_DRAW);
      o.i = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.i); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(m.i), gl.STATIC_DRAW);
      return o;
    }
    function upLines(arr) {
      var o = { n: arr.length / 3, b: gl.createBuffer() };
      gl.bindBuffer(gl.ARRAY_BUFFER, o.b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      return o;
    }

    var ico1 = icosa(1.55), ico2 = icosa(1.12), ico3 = icosa(0.62), oct = octa(1);
    var G = {
      core: upMesh(ico3.mesh), octa: upMesh(oct.mesh), sphere: upMesh(sphere(1, 14, 20)), cube: upMesh(box(1, 1, 1)), glass: upMesh(box(2.6, 1.7, 0.03))
    };
    var LG = {
      ico1: upLines(ico1.lines), ico2: upLines(ico2.lines), circ: upLines(circleLines(1, 90)), rect: upLines(rectLines(2.6, 1.7)),
      rectIn: upLines(rectLines(2.4, 1.5)), octa: upLines(oct.lines),
      grid: upLines((function () { var a = [], k; for (k = -10; k <= 10; k++) { a.push(k, 0, -10, k, 0, 10, -10, 0, k, 10, 0, k); } return a; })()),
      panelGrid: upLines([-1.05, -0.45, 0, 1.05, -0.45, 0, -1.05, 0.05, 0, 1.05, 0.05, 0, -1.05, 0.55, 0, 1.05, 0.55, 0, -1.05, -0.7, 0, 1.05, -0.7, 0])
    };

    /* ---------- dynamic buffers: lines + glow sprites ---------- */
    var lineBuf = gl.createBuffer(), lineScr = new Float32Array(3 * 1400), lnV = 0;
    function seg(a, b) {
      if (lnV + 2 > 1400) return;
      var o = lnV * 3; lineScr[o] = a[0]; lineScr[o + 1] = a[1]; lineScr[o + 2] = a[2]; lineScr[o + 3] = b[0]; lineScr[o + 4] = b[1]; lineScr[o + 5] = b[2]; lnV += 2;
    }
    var MAXSPR = 700, sprBuf = gl.createBuffer(), sprIdx = gl.createBuffer(), sprScr = new Float32Array(MAXSPR * 4 * 10), nSpr = 0;
    (function () {
      var ix = new Uint16Array(MAXSPR * 6), k; for (k = 0; k < MAXSPR; k++) { var v = k * 4; ix.set([v, v + 1, v + 2, v, v + 2, v + 3], k * 6); }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sprIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ix, gl.STATIC_DRAW);
    })();
    var COR = [-1, -1, 1, -1, 1, 1, -1, 1];
    function spr(p, size, c, a) {
      if (nSpr >= MAXSPR) return;
      var o = nSpr * 40, k;
      for (k = 0; k < 4; k++) {
        var q = o + k * 10; sprScr[q] = p[0]; sprScr[q + 1] = p[1]; sprScr[q + 2] = p[2]; sprScr[q + 3] = COR[k * 2]; sprScr[q + 4] = COR[k * 2 + 1];
        sprScr[q + 5] = size; sprScr[q + 6] = c[0]; sprScr[q + 7] = c[1]; sprScr[q + 8] = c[2]; sprScr[q + 9] = a;
      }
      nSpr++;
    }

    /* ---------- quality tiers + scene data ---------- */
    var tierSmall = null, nodes = [], edges = [], pulses = [], dust = [];
    function normalMat(m) {
      var s = 1 / (Math.hypot(m[0], m[1], m[2]) || 1);
      return new Float32Array([m[0] * s, m[1] * s, m[2] * s, m[4] * s, m[5] * s, m[6] * s, m[8] * s, m[9] * s, m[10] * s]);
    }
    function build(small) {
      tierSmall = small;
      var R = rng(11), N = small ? 15 : 30, i, j;
      nodes = []; edges = []; pulses = []; dust = [];
      for (i = 0; i < N; i++) {
        var y = 1 - (i + 0.5) / N * 2, rad = Math.sqrt(1 - y * y), th = i * 2.399963, shell = i % 3;
        var r = [2.7, 3.7, 4.7][shell] * (0.85 + R() * 0.3);
        var base = [Math.cos(th) * rad * r * 1.15, y * r * 0.8, Math.sin(th) * rad * r];
        var bl = Math.hypot(base[0], base[1], base[2]);
        nodes.push({
          base: base, scatter: [base[0] / bl * (10 + R() * 5) + (R() - 0.5) * 4, base[1] / bl * (10 + R() * 5) + (R() - 0.5) * 4, base[2] / bl * (10 + R() * 5)],
          size: 0.1 + R() * 0.14, sphere: i % 4 === 0, delay: 0.5 + shell * 0.35 + R() * 0.9, ph: R() * 6.28, teal: R() < 0.4, spin: (R() - 0.5) * 1.4,
          core: shell === 0, w: [0, 0, 0], pn: 0, flash: 0, aud: 0, push: [0, 0, 0]
        });
      }
      var seen = {};
      function addEdge(a, b) { var k = Math.min(a, b) + '_' + Math.max(a, b); if (seen[k]) return; seen[k] = 1; edges.push([a, b]); }
      for (i = 0; i < N; i++) {
        var ds = [];
        for (j = 0; j < N; j++) if (j !== i) ds.push([j, Math.hypot(nodes[i].base[0] - nodes[j].base[0], nodes[i].base[1] - nodes[j].base[1], nodes[i].base[2] - nodes[j].base[2])]);
        ds.sort(function (a, b) { return a[1] - b[1]; });
        addEdge(i, ds[0][0]); addEdge(i, ds[1][0]);
        if (nodes[i].core) addEdge(i, -1);
      }
      var np = small ? 8 : 16;
      for (i = 0; i < np; i++) pulses.push({ e: Math.floor(R() * edges.length), sp: 0.12 + R() * 0.2, off: R() });
      var ND = small ? 70 : 150;
      for (i = 0; i < ND; i++) dust.push({ p: [(R() - 0.5) * 17, (R() - 0.5) * 10, (R() - 0.5) * 9 - 1], s: 0.025 + R() * 0.05, a: 0.18 + R() * 0.4, ph: R() * 6.28 });
    }

    var panelsDef = [
      { kind: 'bars', pos: [-3.0, 2.7, 1.3], yaw: 0.34, sc: 0.82, delay: 1.7, ph: 0.4 },
      { kind: 'trend', pos: [3.2, 2.5, 1.2], yaw: -0.38, sc: 0.86, delay: 2.05, ph: 1.9 },
      { kind: 'radar', pos: [2.7, -1.95, 1.6], yaw: -0.3, sc: 0.82, delay: 2.4, ph: 3.1 }
    ];
    var BARS = [0.35, 0.55, 0.42, 0.75, 0.62, 0.95, 1.15];
    var TREND = [0.1, 0.22, 0.17, 0.34, 0.3, 0.47, 0.42, 0.6, 0.55, 0.78, 0.72, 0.98];
    var RADAR = [0.5, 0.8, 0.42, 0.95, 0.6, 0.72, 0.38, 0.88, 0.55, 0.7, 0.45, 0.9, 0.62, 0.5];

    /* ---------- interaction state ---------- */
    var W = 1, H = 1, dpr = 1, aspect = 1, cssW = 0, cssH = 0, small = false;
    var mouse = { nx: 0, ny: 0, sx: 0, sy: 0, inside: false, last: -1e9 };
    var scrollP = 0, visible = true, running = false, on = false, failed = false, frames = 0, firstFrame = true, live = false;
    var t0 = performance.now(), heroH = heroSection.offsetHeight || 700, pulseT = -10, dbg = null, qScale = 1, slow = 0, lastNow = 0;

    function resize() {
      var r = wrap.getBoundingClientRect();
      small = window.innerWidth < 900 || mq('(pointer: coarse)');
      if (small !== tierSmall) build(small);
      dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2) * qScale;
      var w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
      var cap = small ? 1300000 : 2400000; if (w * h > cap) { var k = Math.sqrt(cap / (w * h)); w = Math.round(w * k); h = Math.round(h * k); }
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      W = w; H = h; aspect = w / h; heroH = heroSection.offsetHeight || heroH; cssW = r.width; cssH = r.height;
    }

    function report(msg) {
      if (!debugOn) return;
      if (!dbg) {
        dbg = doc.createElement('pre');
        dbg.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;margin:0;padding:8px 10px;background:#000c;color:#7fffd4;font:12px/1.4 monospace;max-width:92vw;white-space:pre-wrap';
        doc.body.appendChild(dbg);
      }
      var info = '';
      try {
        var ext = gl.getExtension('WEBGL_debug_renderer_info');
        info = (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) + ' | ' + gl.getParameter(gl.VERSION) + ' | depth ' + gl.getParameter(gl.DEPTH_BITS) + ' | err ' + gl.getError();
      } catch (e) { info = 'no gl info'; }
      dbg.textContent = '[3d] ' + msg + '\ncanvas ' + canvas.width + 'x' + canvas.height + ' css ' + Math.round(cssW) + 'x' + Math.round(cssH) + ' frames ' + frames + ' tier ' + (small ? 'mobile' : 'desktop') + '\n' + info;
    }
    function fail(msg) {
      failed = true; on = false; running = false; root.classList.remove('sa-h3d');
      try { if (window.console) console.warn('[sa3d] fallback to photo: ' + msg); } catch (e) {}
      wrap.classList.remove('sa-hero3d-wrap'); canvas.classList.remove('is-on'); canvas.style.display = 'none';
      report('FALLBACK: ' + msg);
    }
    function isBlank() {
      var buf = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      for (var q = 3; q < buf.length; q += 64) if (buf[q] > 0) return false;
      return true;
    }

    function setOn(v) {
      if (failed || v === on) return;
      on = v;
      if (v) { resize(); start(); } else { canvas.classList.remove('is-on'); }
    }

    window.addEventListener('pointermove', function (e) {
      if (!on) return;
      var r = canvas.getBoundingClientRect();
      mouse.nx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1.4, 1.4);
      mouse.ny = clamp(-((e.clientY - r.top) / r.height * 2 - 1), -1.4, 1.4);
      mouse.inside = e.clientY > r.top && e.clientY < r.bottom;
      mouse.last = performance.now(); start();
    }, { passive: true });
    window.addEventListener('pointerdown', function (e) {
      if (!on) return;
      var r = canvas.getBoundingClientRect();
      if (e.clientY > r.top && e.clientY < r.bottom && !e.target.closest('a,button,input,textarea,select,summary')) { pulseT = (performance.now() - t0) / 1000; start(); }
    }, { passive: true });
    window.addEventListener('scroll', function () { scrollP = clamp(window.scrollY / Math.max(1, heroH), 0, 1); if (on) start(); }, { passive: true });
    window.addEventListener('resize', function () { if (on) { resize(); start(); } });
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); fail('WebGL context lost'); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) start(); }, { threshold: 0 }).observe(heroSection);
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) start(); });
    function start() { if (!running && on && visible && !doc.hidden && !failed) { running = true; window.requestAnimationFrame(frame); } }

    /* ---------- draw helpers ---------- */
    var cam = [0, 0, 12], light = [0, 0, 5], VP = ident(), fogDist = 26;
    function drawMesh(g, model, color, alpha, emis) {
      gl.bindBuffer(gl.ARRAY_BUFFER, g.p); gl.vertexAttribPointer(SOLID.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.nr); gl.vertexAttribPointer(SOLID.a.aNor, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.i);
      gl.uniformMatrix4fv(SOLID.u.uM, false, model); gl.uniformMatrix3fv(SOLID.u.uN, false, normalMat(model));
      gl.uniform3fv(SOLID.u.uColor, color); gl.uniform1f(SOLID.u.uAlpha, alpha); gl.uniform1f(SOLID.u.uEmis, emis);
      gl.drawElements(gl.TRIANGLES, g.n, gl.UNSIGNED_SHORT, 0);
    }
    var IDENT = ident();
    function drawLines(lg, model, c, a, fogR) {
      gl.bindBuffer(gl.ARRAY_BUFFER, lg.b); gl.vertexAttribPointer(LINE.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(LINE.u.uM, false, model); gl.uniform4f(LINE.u.uCol, c[0], c[1], c[2], a); gl.uniform1f(LINE.u.uFogR, fogR || 16);
      gl.drawArrays(gl.LINES, 0, lg.n);
    }
    function flushDyn(c, a) {
      if (!lnV) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf); gl.bufferData(gl.ARRAY_BUFFER, lineScr.subarray(0, lnV * 3), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(LINE.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(LINE.u.uM, false, IDENT); gl.uniform4f(LINE.u.uCol, c[0], c[1], c[2], a); gl.uniform1f(LINE.u.uFogR, 17);
      gl.drawArrays(gl.LINES, 0, lnV); lnV = 0;
    }
    function project(x, y, z) {
      var cx = VP[0] * x + VP[4] * y + VP[8] * z + VP[12], cy = VP[1] * x + VP[5] * y + VP[9] * z + VP[13], cw = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
      return [cx / cw, cy / cw];
    }

    /* ============================================================ frame */
    var still = reduce;
    function frame(now) {
      try { draw(now); } catch (e) { fail('exception: ' + (e && e.message)); }
    }
    function draw(now) {
      running = false;
      if (failed || !on || !visible || doc.hidden) return;
      var rr = wrap.getBoundingClientRect();
      if (Math.abs(rr.width - cssW) > 1 || Math.abs(rr.height - cssH) > 1) resize();

      var t = still ? 7.5 : Math.max(0, (now - t0) / 1000);
      var dtm = lastNow ? now - lastNow : 16; lastNow = now;
      if (!still && frames > 20) {                                    // adaptive quality: drop resolution if frames are slow
        slow = slow * 0.95 + (dtm > 34 ? 1 : 0) * 0.05;
        if (slow > 0.5 && qScale > 0.6) { qScale = 0.7; slow = 0; resize(); }
      }

      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); blend('pre');

      /* pointer: smoothed; drifts on its own when idle (also the only motion source on touch screens) */
      var idle = (now - mouse.last) > 3500;
      var tx = idle ? Math.sin(t * 0.23) * 0.34 : mouse.nx, ty = idle ? Math.cos(t * 0.19) * 0.18 : mouse.ny;
      if (still) { tx = 0.1; ty = 0.05; }
      mouse.sx = lerp(mouse.sx, tx, 0.055); mouse.sy = lerp(mouse.sy, ty, 0.055);

      /* cinematic intro: camera dollies in while the structure assembles */
      var ie = easeOut(clamp(t / 3.4, 0, 1));
      var fit = small || aspect < 1.4 ? Math.pow(Math.min(1, aspect / 1.7), 0.7) : 1;
      var camZ = ((11.8 + scrollP * 3.5) / fit) + (1 - ie) * 9;
      var eye = [Math.sin((1 - ie) * 0.9) * camZ * 0.3 + mouse.sx * 0.6, mouse.sy * 0.35 + 0.35 + (1 - ie) * 1.6, camZ];
      var P = perspective(38 * Math.PI / 180, aspect, 0.1, 90);
      var shiftX = aspect > 1.7 ? 0.44 : aspect > 1.25 ? 0.36 : aspect > 0.95 ? 0.16 : 0;
      P[8] -= shiftX; P[9] -= small ? 0.12 : 0;
      var V = lookAt(eye, [0, 0, 0], [0, 1, 0]);
      VP = mul(P, V); cam = eye;
      var right = [V[0], V[4], V[8]], up = [V[1], V[5], V[9]];
      light = [mouse.sx * 6.5, mouse.sy * 3.8 + 1.2, 5.5];
      fogDist = camZ + 14;

      var gRot = chain(RX(-mouse.sy * 0.16 + 0.1 + scrollP * 0.3), RY(t * 0.05 + mouse.sx * 0.38 + scrollP * 0.9));
      var pls = Math.max(0, t - pulseT), pulse = pls < 2.4 ? Math.exp(-pls * 2.2) : 0;

      /* scan beam: sweeps top to bottom, audits the nodes it crosses */
      var cyc = (t - 3.6) % 9, scanOn = t > 3.6 && cyc < 3.4, scanY = scanOn ? 4.8 - cyc / 3.4 * 9.6 : -9;
      var afterScan = t > 3.6 && cyc >= 3.4 ? clamp(1 - (cyc - 3.4) / 3, 0, 1) : 0;

      /* ---------- floor grid ---------- */
      use(LINE);
      gl.uniformMatrix4fv(LINE.u.uVP, false, VP); gl.uniform3f(LINE.u.uFogC, 0, -3.8, 0);
      var gridA = easeOut(clamp((t - 0.2) / 2.2, 0, 1)) * 0.24;
      drawLines(LG.grid, chain(T(0, -3.9, 0), RY(t * 0.02), S(1.15)), TEAL_HI, gridA, 11);

      /* ---------- node positions ---------- */
      var ni;
      for (ni = 0; ni < nodes.length; ni++) {
        var nd = nodes[ni];
        nd.pn = easeOut(clamp((t - nd.delay) / 1.5, 0, 1));
        var bobX = Math.sin(t * 0.5 + nd.ph) * 0.12, bobY = Math.cos(t * 0.6 + nd.ph * 1.3) * 0.16, bobZ = Math.sin(t * 0.4 + nd.ph * 2.1) * 0.12;
        var lp = [lerp(nd.scatter[0], nd.base[0] + bobX, nd.pn), lerp(nd.scatter[1], nd.base[1] + bobY, nd.pn), lerp(nd.scatter[2], nd.base[2] + bobZ, nd.pn)];
        var wpos = xf(gRot, lp[0], lp[1], lp[2]);
        var sp = project(wpos[0], wpos[1], wpos[2]), pushT = [0, 0, 0], hover = 0;       // nodes near the cursor drift away and glow
        if (mouse.inside && !idle && nd.pn >= 1) {
          var dx = (sp[0] - mouse.nx) * aspect, dy = sp[1] - mouse.ny, dist = Math.hypot(dx, dy);
          if (dist < 0.4 && dist > 0.0001) { var f = (0.4 - dist) / 0.4; hover = f; pushT = [(right[0] * dx + up[0] * dy) / dist * f * 0.9, (right[1] * dx + up[1] * dy) / dist * f * 0.9, (right[2] * dx + up[2] * dy) / dist * f * 0.9]; }
        }
        for (var q = 0; q < 3; q++) nd.push[q] = lerp(nd.push[q], pushT[q], 0.1);
        nd.w = [wpos[0] + nd.push[0], wpos[1] + nd.push[1], wpos[2] + nd.push[2]];
        var dyScan = lp[1] - scanY;
        nd.flash = scanOn ? Math.exp(-Math.pow(dyScan / 0.5, 2)) : 0;
        nd.aud = scanOn ? smooth(-0.2, 0.9, dyScan) : afterScan;
        nd.hover = hover;
        if ((hover > 0.6) !== !!nd.hon) { nd.hon = hover > 0.6; if (nd.hon) sfx('hover'); }
      }

      /* ---------- scan plane (additive) ---------- */
      if (scanOn) {
        var sa = Math.sin(clamp(cyc / 3.4, 0, 1) * Math.PI);
        var pm = chain(gRot, T(0, scanY, 0), RX(Math.PI / 2), S(7));
        use(LINE); gl.uniformMatrix4fv(LINE.u.uVP, false, VP); gl.uniform3f(LINE.u.uFogC, 0, 0, 0);
        gl.depthMask(false); blend('add');
        drawLines(LG.rect, chain(pm, SC(2.9, 2.9, 1)), TEAL_HI, 0.55 * sa, 24);
        drawLines(LG.rectIn, chain(pm, SC(2.7, 2.7, 1)), WHITE, 0.2 * sa, 24);
        gl.depthMask(true); blend('pre');
      }

      /* ---------- opaque solids ---------- */
      use(SOLID);
      gl.uniformMatrix4fv(SOLID.u.uVP, false, VP); gl.uniform3fv(SOLID.u.uCam, cam); gl.uniform3fv(SOLID.u.uLight, light); gl.uniform1f(SOLID.u.uFog, fogDist);

      var coreP = easeBack(clamp(t / 1.3, 0, 1));
      var coreM = chain(gRot, S(Math.max(0.001, coreP) * (1 + pulse * 0.25)));
      drawMesh(G.core, chain(coreM, RY(t * 0.5), RX(t * 0.31)), TEAL_HI, 1, 0.55 + 0.25 * Math.sin(t * 1.6) + pulse * 0.4);

      for (ni = 0; ni < nodes.length; ni++) {
        var n2 = nodes[ni]; if (n2.pn <= 0.001) continue;
        var base = n2.teal ? TEAL_HI : PLAT, mixc = clamp(n2.aud * 0.85 + n2.hover * 0.5, 0, 1);
        var col = [lerp(base[0], TEAL_HI[0], mixc), lerp(base[1], TEAL_HI[1], mixc), lerp(base[2], TEAL_HI[2], mixc)];
        var m = chain(T(n2.w[0], n2.w[1], n2.w[2]), RY(t * n2.spin + n2.ph), RX(t * n2.spin * 0.7), S(n2.size * (0.6 + n2.pn * 0.4) * (1 + n2.flash * 0.5 + n2.hover * 0.4)));
        drawMesh(n2.sphere ? G.sphere : G.octa, m, col, clamp(n2.pn * 1.4, 0, 1), 0.15 + n2.flash * 0.7 + n2.hover * 0.4);
      }

      /* chart bars (solid) on the panels */
      var panelMats = [];
      panelsDef.forEach(function (pd, pi) {
        var show = pi === 0 ? !small || aspect > 0.9 : (!small || aspect > 1.2);
        var pe = show ? easeOut(clamp((t - pd.delay) / 1.4, 0, 1)) : 0;
        var pm2 = chain(T(pd.pos[0] / (small ? fit * 1.05 : 1), pd.pos[1] - (1 - pe) * 1.2 + Math.sin(t * 0.6 + pd.ph) * 0.1, pd.pos[2] - (1 - pe) * 2.5),
          RY(pd.yaw + mouse.sx * 0.14), RX(-mouse.sy * 0.07 + Math.sin(t * 0.5 + pd.ph) * 0.03), S(pd.sc * (0.85 + 0.15 * pe)));
        panelMats[pi] = { m: pm2, e: pe };
        if (pe <= 0.01) return;
        var k;
        if (pd.kind === 'bars') {
          for (k = 0; k < BARS.length; k++) {
            var gr = easeOut(clamp((t - pd.delay - 0.5 - k * 0.12) / 1.2, 0, 1)), h = Math.max(0.01, BARS[k] * gr * (1 + 0.05 * Math.sin(t * 1.3 + k)));
            drawMesh(G.cube, chain(pm2, T(-0.88 + k * 0.29, -0.62 + h * 0.5, 0.07), SC(0.2, h, 0.1)), k === BARS.length - 1 ? TEAL_HI : (k % 2 ? PLAT : WHITE), pe, k === BARS.length - 1 ? 0.7 : 0.12);
          }
        } else if (pd.kind === 'radar') {
          for (k = 0; k < RADAR.length; k++) {
            var gr2 = easeOut(clamp((t - pd.delay - 0.4 - k * 0.07) / 1.1, 0, 1)), h2 = Math.max(0.01, (0.22 + RADAR[k] * 0.34 * (0.85 + 0.15 * Math.sin(t * 0.9 + k * 0.8))) * gr2);
            drawMesh(G.cube, chain(pm2, T(0, -0.05, 0.07), RZ(k / RADAR.length * Math.PI * 2 + t * 0.12), T(0, 0.3 + h2 * 0.5, 0), SC(0.07, h2, 0.07)), k % 3 === 0 ? TEAL_HI : PLAT, pe, k % 3 === 0 ? 0.6 : 0.1);
          }
        }
      });

      /* ---------- dynamic lines: lattice edges, panel polylines ---------- */
      use(LINE);
      gl.uniformMatrix4fv(LINE.u.uVP, false, VP); gl.uniform3f(LINE.u.uFogC, 0, 0, 0);
      gl.depthMask(false); blend('add');
      var corePos = xf(gRot, 0, 0, 0), ei;
      for (ei = 0; ei < edges.length; ei++) {
        var ea = nodes[edges[ei][0]], eb = edges[ei][1] < 0 ? { w: corePos, pn: coreP } : nodes[edges[ei][1]];
        if (Math.min(ea.pn, eb.pn) > 0.05) seg(ea.w, eb.w);
      }
      flushDyn(TEAL_HI, 0.26 * easeOut(clamp((t - 1.0) / 2, 0, 1)));

      /* static wire polyhedra + orbit circles */
      var wireA = easeOut(clamp((t - 0.3) / 1.4, 0, 1));
      drawLines(LG.ico1, chain(coreM, RY(-t * 0.18), RX(t * 0.12)), WHITE, 0.45 * wireA, 20);
      drawLines(LG.ico2, chain(coreM, RY(t * 0.26), RZ(t * 0.17)), TEAL_HI, 0.5 * wireA, 20);
      var orbits = [[2.15, RX(Math.PI / 2 + Math.sin(t * 0.3) * 0.25), t * 0.35], [2.9, chain(RX(Math.PI / 2.3), RY(0.5)), -t * 0.25], [3.65, chain(RX(Math.PI / 1.8), RY(-0.4)), t * 0.18]];
      orbits.forEach(function (o, k) { drawLines(LG.circ, chain(gRot, o[1], RZ(o[2]), S(o[0] * (0.4 + 0.6 * wireA))), k === 1 ? TEAL_HI : PLAT, (k === 1 ? 0.4 : 0.22) * wireA, 18); });
      if (pulse > 0.01) drawLines(LG.circ, chain(gRot, RX(Math.PI / 2), S(0.8 + pls * 4.2)), WHITE, pulse * 0.6, 22);

      /* panels: glass, frame, gridlines, trend line */
      panelsDef.forEach(function (pd, pi) {
        var pe = panelMats[pi].e; if (pe <= 0.01) return;
        var pm3 = panelMats[pi].m;
        drawLines(LG.rect, pm3, TEAL_HI, 0.7 * pe, 24);
        drawLines(LG.panelGrid, chain(pm3, T(0, 0, 0.02)), PLAT, 0.14 * pe, 24);
        if (pd.kind === 'trend') {
          var prog = clamp((t - pd.delay - 0.5) / 2.2, 0, 1), cnt = (TREND.length - 1) * prog, k2;
          for (k2 = 0; k2 < TREND.length - 1; k2++) {
            if (k2 > cnt) break;
            var f2 = clamp(cnt - k2, 0, 1);
            var a1 = [-1.0 + k2 * 0.18, -0.62 + TREND[k2] * 1.05, 0.07], b1 = [-1.0 + (k2 + f2) * 0.18, -0.62 + lerp(TREND[k2], TREND[k2 + 1], f2) * 1.05, 0.07];
            seg(xf(pm3, a1[0], a1[1], a1[2]), xf(pm3, b1[0], b1[1], b1[2]));
          }
        }
      });
      flushDyn(WHITE, 0.85);
      gl.depthMask(true); blend('pre');

      /* glass faces last (translucent) */
      use(SOLID);
      gl.uniformMatrix4fv(SOLID.u.uVP, false, VP); gl.uniform3fv(SOLID.u.uCam, cam); gl.uniform3fv(SOLID.u.uLight, light); gl.uniform1f(SOLID.u.uFog, fogDist);
      gl.depthMask(false);
      panelsDef.forEach(function (pd, pi) { var pe = panelMats[pi].e; if (pe > 0.01) drawMesh(G.glass, panelMats[pi].m, CHAR_LT, 0.34 * pe, 0.25); });
      gl.depthMask(true);

      /* ---------- glow sprites (additive): core halo, node halos, pulses, satellites, trend head, dust, cursor light ---------- */
      nSpr = 0;
      var cs = Math.max(0.001, coreP);
      spr(corePos, 3.6 * cs * (1 + pulse * 0.5), TEAL_HI, (0.5 + 0.1 * Math.sin(t * 1.6)) + pulse * 0.4);
      spr(corePos, 8 * cs, TEAL, 0.16);
      for (ni = 0; ni < nodes.length; ni++) {
        var n3 = nodes[ni]; if (n3.pn < 0.02) continue;
        var hc = n3.teal || n3.aud > 0.3 ? TEAL_HI : PLAT;
        spr(n3.w, n3.size * (4.2 + n3.flash * 4 + n3.hover * 3), n3.flash > 0.2 ? WHITE : hc, (0.2 + n3.flash * 0.6 + n3.hover * 0.4 + n3.aud * 0.12) * n3.pn);
      }
      for (ei = 0; ei < pulses.length; ei++) {
        var pu = pulses[ei], ed = edges[pu.e % edges.length], pa = nodes[ed[0]], pb = ed[1] < 0 ? { w: corePos, pn: 1 } : nodes[ed[1]];
        if (Math.min(pa.pn, pb.pn) < 0.9) continue;
        var k3 = (t * pu.sp + pu.off) % 1;
        spr([lerp(pa.w[0], pb.w[0], k3), lerp(pa.w[1], pb.w[1], k3), lerp(pa.w[2], pb.w[2], k3)], 0.28, WHITE, 0.8 * Math.sin(k3 * Math.PI));
      }
      orbits.forEach(function (o, k) {
        var a = t * (0.9 - k * 0.22) + k * 2.0, sp2 = xf(chain(gRot, o[1], RZ(o[2])), Math.cos(a) * o[0] * wireA, Math.sin(a) * o[0] * wireA, 0);
        spr(sp2, 0.3, k === 1 ? TEAL_HI : WHITE, 0.9 * wireA);
      });
      panelsDef.forEach(function (pd, pi) {
        var pe = panelMats[pi].e; if (pe <= 0.01 || pd.kind !== 'trend') return;
        var prog = clamp((t - pd.delay - 0.5) / 2.2, 0, 1), cnt = (TREND.length - 1) * prog, kk = Math.min(TREND.length - 2, Math.floor(cnt)), ff = cnt - kk;
        var hp = xf(panelMats[pi].m, -1.0 + (kk + ff) * 0.18, -0.62 + lerp(TREND[kk], TREND[kk + 1], ff) * 1.05, 0.09);
        spr(hp, 0.32 + 0.08 * Math.sin(t * 4), TEAL_HI, 0.95 * pe); spr(hp, 0.12, WHITE, 0.9 * pe);
      });
      for (var di = 0; di < dust.length; di++) {
        var d = dust[di], dp = xf(gRot, d.p[0] + Math.cos(t * 0.27 + d.ph * 9) * 0.3, d.p[1] + Math.sin(t * 0.35 + d.ph * 6) * 0.35, d.p[2]);
        spr(dp, d.s, PLAT, d.a * easeOut(clamp((t - 0.4) / 2, 0, 1)));
      }
      if (!still && !idle && mouse.inside) spr(light, 0.9, TEAL_HI, 0.22);

      use(SPR);
      gl.uniformMatrix4fv(SPR.u.uVP, false, VP); gl.uniform3fv(SPR.u.uRight, right); gl.uniform3fv(SPR.u.uUp, up);
      blend('add'); gl.depthMask(false);
      gl.bindBuffer(gl.ARRAY_BUFFER, sprBuf); gl.bufferData(gl.ARRAY_BUFFER, sprScr.subarray(0, nSpr * 40), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(SPR.a.aPos, 3, gl.FLOAT, false, 40, 0); gl.vertexAttribPointer(SPR.a.aCor, 2, gl.FLOAT, false, 40, 12);
      gl.vertexAttribPointer(SPR.a.aSize, 1, gl.FLOAT, false, 40, 20); gl.vertexAttribPointer(SPR.a.aCol, 4, gl.FLOAT, false, 40, 24);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sprIdx);
      gl.drawElements(gl.TRIANGLES, nSpr * 6, gl.UNSIGNED_SHORT, 0);
      gl.depthMask(true); blend('pre');

      /* fade with scroll, dim a little on phones so the headline stays readable */
      canvas.style.setProperty('--sa3d-o', ((small ? 0.9 : 1) * lerp(1, 0.18, scrollP)).toFixed(3));

      frames++;
      if (frames === 30 || frames === 150) {
        if (isBlank()) { fail('canvas is blank after ' + frames + ' frames'); return; }
        report('OK, drawing');
      }
      if (firstFrame) {
        firstFrame = false; canvas.classList.add('is-on'); wrap.classList.add('sa-hero3d-wrap'); root.setAttribute('data-h3d', '1');
        window.setTimeout(function () { canvas.classList.add('is-live'); live = true; }, 1600);
      }
      if (!still) { running = true; window.requestAnimationFrame(frame); }
    }

    build(window.innerWidth < 900 || mq('(pointer: coarse)'));
    setOn(true);
  }

  if (doc.readyState !== 'loading') boot(); else doc.addEventListener('DOMContentLoaded', boot);
})();
