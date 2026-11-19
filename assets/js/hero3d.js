/* Start-up Audit — interactive 3D business ecosystem for the Home hero.
   Self-contained WebGL (no libraries, no network). Desktop with a motion-OK visitor only;
   phones, tablets, reduced-motion and non-WebGL browsers keep the original hero photo. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; };

  /* ------------------------------------------------------------------ math */
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
  function hex(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutBack(t) { var c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

  /* -------------------------------------------------------------- geometry */
  function Geo() { this.p = []; this.n = []; this.i = []; }
  Geo.prototype.v = function (x, y, z, nx, ny, nz) { this.p.push(x, y, z); this.n.push(nx, ny, nz); return this.p.length / 3 - 1; };
  Geo.prototype.quad = function (a, b, c, d) { this.i.push(a, b, c, a, c, d); };

  function box(w, h, d) {
    var g = new Geo(), x = w / 2, y = h / 2, z = d / 2;
    var f = [
      [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1]],
      [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1]],
      [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0]],
      [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0]],
      [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0]],
      [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0]]
    ];
    f.forEach(function (q) {
      var n = q[4], a = g.v(q[0][0], q[0][1], q[0][2], n[0], n[1], n[2]), b = g.v(q[1][0], q[1][1], q[1][2], n[0], n[1], n[2]),
        c = g.v(q[2][0], q[2][1], q[2][2], n[0], n[1], n[2]), e = g.v(q[3][0], q[3][1], q[3][2], n[0], n[1], n[2]);
      g.quad(a, b, c, e);
    });
    return g;
  }
  function cylinder(r, h, seg) {
    var g = new Geo(), y = h / 2, k, a0, a1;
    for (k = 0; k < seg; k++) {
      a0 = k / seg * Math.PI * 2; a1 = (k + 1) / seg * Math.PI * 2;
      var c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      var A = g.v(r * c0, -y, r * s0, c0, 0, s0), B = g.v(r * c1, -y, r * s1, c1, 0, s1), C = g.v(r * c1, y, r * s1, c1, 0, s1), D = g.v(r * c0, y, r * s0, c0, 0, s0);
      g.quad(A, B, C, D);
      var t0 = g.v(0, y, 0, 0, 1, 0), t1 = g.v(r * c0, y, r * s0, 0, 1, 0), t2 = g.v(r * c1, y, r * s1, 0, 1, 0); g.i.push(t0, t2, t1);
      var b0 = g.v(0, -y, 0, 0, -1, 0), b1 = g.v(r * c0, -y, r * s0, 0, -1, 0), b2 = g.v(r * c1, -y, r * s1, 0, -1, 0); g.i.push(b0, b1, b2);
    }
    return g;
  }
  function sphere(r, lat, lon) {
    var g = new Geo(), i, j;
    for (i = 0; i <= lat; i++) {
      var th = i / lat * Math.PI, st = Math.sin(th), ct = Math.cos(th);
      for (j = 0; j <= lon; j++) {
        var ph = j / lon * Math.PI * 2, x = st * Math.cos(ph), z = st * Math.sin(ph);
        g.v(r * x, r * ct, r * z, x, ct, z);
      }
    }
    for (i = 0; i < lat; i++) for (j = 0; j < lon; j++) {
      var a = i * (lon + 1) + j, b = a + lon + 1; g.quad(a, b, b + 1, a + 1);
    }
    return g;
  }
  function torus(R, r, seg, tube) {
    var g = new Geo(), i, j;
    for (i = 0; i <= seg; i++) {
      var u = i / seg * Math.PI * 2, cu = Math.cos(u), su = Math.sin(u);
      for (j = 0; j <= tube; j++) {
        var v = j / tube * Math.PI * 2, cv = Math.cos(v), sv = Math.sin(v);
        g.v((R + r * cv) * cu, (R + r * cv) * su, r * sv, cv * cu, cv * su, sv);
      }
    }
    for (i = 0; i < seg; i++) for (j = 0; j < tube; j++) {
      var a = i * (tube + 1) + j, b = a + tube + 1; g.quad(a, b, b + 1, a + 1);
    }
    return g;
  }
  function gear(rOut, rRoot, rHole, teeth, depth) {
    var g = new Geo(), N = teeth * 4, z = depth / 2, out = [], inn = [], k;
    for (k = 0; k < N; k++) {
      var tooth = Math.floor(k / 4), sub = k % 4, base = tooth / teeth * Math.PI * 2, step = Math.PI * 2 / teeth;
      var off = [0.0, 0.2, 0.5, 0.7][sub] * step, rad = (sub === 1 || sub === 2) ? rOut : rRoot, a = base + off;
      out.push([Math.cos(a) * rad, Math.sin(a) * rad]);
      var ai = k / N * Math.PI * 2; inn.push([Math.cos(ai) * rHole, Math.sin(ai) * rHole]);
    }
    for (k = 0; k < N; k++) {
      var k2 = (k + 1) % N, o1 = out[k], o2 = out[k2], i1 = inn[k], i2 = inn[k2];
      [[1, z], [-1, -z]].forEach(function (s) {
        var nz = s[0], zz = s[1];
        var a = g.v(o1[0], o1[1], zz, 0, 0, nz), b = g.v(o2[0], o2[1], zz, 0, 0, nz), c = g.v(i2[0], i2[1], zz, 0, 0, nz), d = g.v(i1[0], i1[1], zz, 0, 0, nz);
        g.quad(a, b, c, d);
      });
      var ex = o2[0] - o1[0], ey = o2[1] - o1[1], el = Math.hypot(ex, ey), nx = ey / el, ny = -ex / el;
      var p1 = g.v(o1[0], o1[1], -z, nx, ny, 0), p2 = g.v(o2[0], o2[1], -z, nx, ny, 0), p3 = g.v(o2[0], o2[1], z, nx, ny, 0), p4 = g.v(o1[0], o1[1], z, nx, ny, 0);
      g.quad(p1, p2, p3, p4);
      var ix = i2[0] - i1[0], iy = i2[1] - i1[1], il = Math.hypot(ix, iy), mx = -iy / il, my = ix / il;
      var q1 = g.v(i1[0], i1[1], -z, mx, my, 0), q2 = g.v(i2[0], i2[1], -z, mx, my, 0), q3 = g.v(i2[0], i2[1], z, mx, my, 0), q4 = g.v(i1[0], i1[1], z, mx, my, 0);
      g.quad(q1, q2, q3, q4);
    }
    return g;
  }

  /* --------------------------------------------------------------- shaders */
  var VS = 'attribute vec3 aPos;attribute vec3 aNor;uniform mat4 uVP;uniform mat4 uM;uniform mat3 uN;varying vec3 vN;varying vec3 vW;' +
    'void main(){vec4 w=uM*vec4(aPos,1.0);vW=w.xyz;vN=uN*aNor;gl_Position=uVP*w;}';
  var FS = 'precision mediump float;varying vec3 vN;varying vec3 vW;uniform vec3 uColor;uniform vec3 uCam;uniform float uAlpha;uniform float uEmis;' +
    'void main(){vec3 n=normalize(vN);vec3 v=normalize(uCam-vW);if(dot(n,v)<0.0)n=-n;' +
    'vec3 L1=normalize(vec3(-0.5,0.8,0.6));vec3 L2=normalize(vec3(0.7,-0.2,0.4));' +
    'float d1=max(dot(n,L1),0.0);float d2=max(dot(n,L2),0.0);vec3 h=normalize(L1+v);' +
    'float sp=pow(max(dot(n,h),0.0),48.0);float rim=pow(1.0-max(dot(n,v),0.0),3.0);' +
    'vec3 col=uColor*(0.34+0.72*d1+0.28*d2);col+=vec3(0.9,1.0,1.0)*sp*0.32;col+=vec3(0.10,0.70,0.68)*rim*0.5;' +
    'col=mix(col,uColor*1.15,uEmis);gl_FragColor=vec4(col*uAlpha,uAlpha);}';
  var LVS = 'attribute vec3 aPos;uniform mat4 uVP;void main(){gl_Position=uVP*vec4(aPos,1.0);}';
  var LFS = 'precision mediump float;uniform vec4 uCol;void main(){gl_FragColor=vec4(uCol.rgb*uCol.a,uCol.a);}';
  var PVS = 'attribute vec3 aPos;attribute float aSeed;uniform mat4 uVP;uniform float uT;uniform float uSize;varying float vA;' +
    'void main(){vec3 p=aPos;p.y+=sin(uT*0.35+aSeed*6.28)*0.35;p.x+=cos(uT*0.27+aSeed*9.0)*0.3;' +
    'gl_Position=uVP*vec4(p,1.0);gl_PointSize=uSize*(0.5+fract(aSeed*7.0));vA=0.25+0.5*fract(aSeed*13.0);}';
  var PFS = 'precision mediump float;varying float vA;void main(){float d=length(gl_PointCoord-0.5)*2.0;float a=smoothstep(1.0,0.2,d)*vA;gl_FragColor=vec4(vec3(0.90,0.93,0.93)*a,a);}';

  function program(gl, vs, fs) {
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    var heroSection = doc.querySelector('main section:has([data-hero])') ||
      (doc.querySelector('[data-hero]') && doc.querySelector('[data-hero]').closest('section'));
    if (!heroSection) return;
    var img = heroSection.querySelector('img');
    var wrap = img && img.parentElement;
    if (!wrap) return;

    var reduce = mq('(prefers-reduced-motion: reduce)').matches && !root.classList.contains('sa-motion-on');
    var desktop = mq('(min-width: 900px)');
    var fine = mq('(hover: hover) and (pointer: fine)');
    if (reduce) return;

    var canvas = doc.createElement('canvas');
    canvas.className = 'sa-hero3d';
    canvas.setAttribute('aria-hidden', 'true');
    var gl;
    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' }) ||
        canvas.getContext('experimental-webgl');
    } catch (e) { gl = null; }
    if (!gl) return;

    var prog, lprog, pprog;
    try { prog = program(gl, VS, FS); lprog = program(gl, LVS, LFS); pprog = program(gl, PVS, PFS); } catch (e) { return; }

    wrap.appendChild(canvas);

    /* geometry buffers */
    function upload(geo) {
      var o = { n: geo.i.length };
      o.p = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, o.p); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.p), gl.STATIC_DRAW);
      o.nr = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, o.nr); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.n), gl.STATIC_DRAW);
      o.i = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.i);
      var idx = geo.p.length / 3 > 65535 ? null : new Uint16Array(geo.i);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      return o;
    }

    var C = {
      teal: hex('#0a9a96'), tealHi: hex('#22c5bd'), plat: hex('#E5E4E2'), white: hex('#ffffff'),
      char: hex('#3b4648'), charDk: hex('#293133'), steel: hex('#aeb6b7')
    };
    var G = {
      sphere: upload(sphere(1, 20, 28)), cyl: upload(cylinder(1, 1, 36)), cube: upload(box(1, 1, 1))
    };
    var geoCache = {};
    function geo(key, make) { return geoCache[key] || (geoCache[key] = upload(make())); }

    /* parts: {g: geoBuffer, m: local matrix, c: colour, a: alpha, e: emissive, spin: [axis, rate], glass} */
    function part(g, m, c, o) { o = o || {}; return { g: g, m: m, c: c, a: o.a == null ? 1 : o.a, e: o.e || 0, spin: o.spin || null, glass: !!o.glass, sc: o.sc || null }; }
    function bx(w, h, d) { return geo('b' + w + h + d, function () { return box(w, h, d); }); }
    function cy(r, h) { return geo('c' + r + h, function () { return cylinder(r, h, 36); }); }
    function sp(r) { return geo('s' + r, function () { return sphere(r, 18, 24); }); }
    function to(r, rr) { return geo('t' + r + rr, function () { return torus(r, rr, 56, 14); }); }

    /* ---- the six ecosystem objects ---- */
    var objects = [];
    function addObj(name, parts, x, y, z, o) {
      objects.push({
        name: name, parts: parts, base: [x, y, z], phase: Math.random() * 6.28, spin: o.spin || 0.25, tilt: o.tilt || 0,
        scale: o.scale || 1, delay: o.delay || 0, off: [0, 0], offT: [0, 0], yaw0: o.yaw0 || 0
      });
    }

    // storefront
    addObj('shop', [
      part(bx(1.4, .9, .9), T(0, -.15, 0), C.plat),
      part(bx(1.62, .14, 1.08), T(0, .37, 0), C.char),
      part(bx(1.62, .1, .5), chain(T(0, .22, .6), RX(-.4)), C.teal),
      part(bx(.36, .56, .05), T(.36, -.33, .46), C.teal),
      part(bx(.56, .36, .05), T(-.36, -.1, .46), C.charDk, { e: .1 }),
      part(bx(.56, .05, .08), T(-.36, -.3, .48), C.steel)
    ], -3.55, 1.55, .5, { spin: .22, tilt: .12, scale: 1.05, delay: .1, yaw0: .5 });

    // graph bars
    addObj('bars', [
      part(bx(1.6, .08, .9), T(0, -.7, 0), C.char),
      part(bx(.28, .35, .28), T(-.55, -.485, 0), C.plat),
      part(bx(.28, .65, .28), T(-.18, -.335, 0), C.plat),
      part(bx(.28, .95, .28), T(.18, -.185, 0), C.teal),
      part(bx(.28, 1.4, .28), T(.55, .04, 0), C.tealHi, { e: .25 })
    ], .1, 2.55, -.3, { spin: .2, tilt: .1, scale: 1.05, delay: .25, yaw0: -.5 });

    // magnifier (audit)
    addObj('audit', [
      part(to(.58, .075), ident(), C.plat),
      part(cy(.56, .025), RX(Math.PI / 2), C.tealHi, { a: .22, glass: true, e: .6 }),
      part(cy(.075, .78), chain(T(.62, -.62, 0), RZ(-Math.PI * 3 / 4)), C.teal)
    ], 3.55, 1.45, .4, { spin: .3, tilt: 0, scale: 1.2, delay: .4, yaw0: 0 });

    // gears (operations)
    addObj('ops', [
      part(geo('g1', function () { return gear(.78, .62, .24, 10, .3); }), ident(), C.tealHi, { spin: ['z', .35], e: .1 }),
      part(geo('g2', function () { return gear(.44, .34, .14, 7, .3); }), T(.98, -.56, 0), C.plat, { spin: ['z', -.5], sc: .5 })
    ], 3.3, -1.7, -.2, { spin: .22, tilt: .12, scale: 1.05, delay: .55, yaw0: -.4 });

    // coins (money)
    addObj('money', [
      part(cy(.52, .13), T(0, -.4, 0), C.plat),
      part(cy(.52, .13), T(.05, -.24, -.03), C.teal),
      part(cy(.52, .13), T(-.04, -.08, .02), C.plat),
      part(cy(.52, .13), T(.03, .08, 0), C.teal),
      part(cy(.52, .13), chain(T(.12, .42, 0), RX(.35)), C.tealHi, { e: .2 })
    ], -.2, -2.6, .3, { spin: .3, tilt: .1, scale: 1.1, delay: .7, yaw0: .3 });

    // team
    function figure(x, h, c) {
      return [
        part(cy(.17, h), T(x, -.15 + h / 2 - .1, 0), c),
        part(sp(.16), T(x, -.15 + h + .08, 0), c === C.teal ? C.tealHi : C.plat)
      ];
    }
    addObj('team', [
      part(cy(.82, .06), T(0, -.45, 0), C.char)
    ].concat(figure(-.42, .4, C.plat), figure(.42, .4, C.plat), figure(0, .52, C.teal)), -3.6, -1.75, .1, { spin: .25, tilt: .08, scale: 1.1, delay: .85, yaw0: .35 });

    /* hub */
    var hubParts = [part(sp(.62), ident(), C.tealHi, { e: .45 })];
    var ringA = geo('ringA', function () { return torus(1.15, .02, 90, 8); });
    var ringB = geo('ringB', function () { return torus(1.65, .014, 110, 8); });
    var ringC = geo('ringC', function () { return torus(2.15, .01, 130, 8); });
    var dotG = geo('dot', function () { return sphere(.07, 10, 12); });

    /* connector lines + pulses */
    var lineBuf = gl.createBuffer();
    var lineData = new Float32Array(objects.length * 6);

    /* particles */
    var PN = 140, pData = new Float32Array(PN * 4), pi;
    for (pi = 0; pi < PN; pi++) {
      pData[pi * 4] = (Math.random() - .5) * 13; pData[pi * 4 + 1] = (Math.random() - .5) * 8; pData[pi * 4 + 2] = (Math.random() - .5) * 6 - 1; pData[pi * 4 + 3] = Math.random();
    }
    var pBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.bufferData(gl.ARRAY_BUFFER, pData, gl.STATIC_DRAW);

    /* uniforms */
    var U = {
      vp: gl.getUniformLocation(prog, 'uVP'), m: gl.getUniformLocation(prog, 'uM'), n: gl.getUniformLocation(prog, 'uN'),
      col: gl.getUniformLocation(prog, 'uColor'), cam: gl.getUniformLocation(prog, 'uCam'), a: gl.getUniformLocation(prog, 'uAlpha'), e: gl.getUniformLocation(prog, 'uEmis')
    };
    var A = { pos: gl.getAttribLocation(prog, 'aPos'), nor: gl.getAttribLocation(prog, 'aNor') };
    var LU = { vp: gl.getUniformLocation(lprog, 'uVP'), col: gl.getUniformLocation(lprog, 'uCol') }, LA = gl.getAttribLocation(lprog, 'aPos');
    var PU = { vp: gl.getUniformLocation(pprog, 'uVP'), t: gl.getUniformLocation(pprog, 'uT'), size: gl.getUniformLocation(pprog, 'uSize') };
    var PA = { pos: gl.getAttribLocation(pprog, 'aPos'), seed: gl.getAttribLocation(pprog, 'aSeed') };

    /* ----- state ----- */
    var W = 1, H = 1, dpr = 1, aspect = 1;
    var mouse = { x: 0, y: 0, nx: 0, ny: 0, inside: false, sx: 0, sy: 0 };
    var scrollP = 0, visible = true, running = false, on = false, t0 = performance.now(), firstFrame = true;
    var heroH = heroSection.offsetHeight || 700;

    function resize() {
      var r = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
      var cap = 2400000; if (w * h > cap) { var k = Math.sqrt(cap / (w * h)); w = Math.round(w * k); h = Math.round(h * k); }
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      W = w; H = h; aspect = w / h; heroH = heroSection.offsetHeight || heroH;
    }

    function setOn(v) {
      if (v === on) return;
      on = v;
      if (!v) wrap.classList.remove('sa-hero3d-wrap');
      canvas.classList.toggle('is-on', v && !firstFrame);
      if (v) { resize(); start(); } else { canvas.classList.remove('is-on'); }
    }
    function check() { setOn(desktop.matches && !reduce); }

    window.addEventListener('mousemove', function (e) {
      if (!on) return;
      var r = canvas.getBoundingClientRect();
      mouse.nx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1.5, 1.5);
      mouse.ny = clamp(-((e.clientY - r.top) / r.height * 2 - 1), -1.5, 1.5);
      mouse.inside = e.clientY > r.top && e.clientY < r.bottom;
      start();
    }, { passive: true });
    window.addEventListener('scroll', function () {
      scrollP = clamp(window.scrollY / Math.max(1, heroH), 0, 1);
      if (on) start();
    }, { passive: true });
    window.addEventListener('resize', function () { check(); if (on) { resize(); start(); } });
    if (desktop.addEventListener) desktop.addEventListener('change', check);
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); setOn(false); on = false; });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) start(); }, { threshold: 0 }).observe(heroSection);
    }
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) start(); });

    function start() { if (!running && on && visible && !doc.hidden) { running = true; window.requestAnimationFrame(frame); } }

    /* ----- drawing helpers ----- */
    function normalMat(m) {
      var n = new Float32Array(9), s = 1 / (Math.hypot(m[0], m[1], m[2]) || 1);
      n[0] = m[0] * s; n[1] = m[1] * s; n[2] = m[2] * s; n[3] = m[4] * s; n[4] = m[5] * s; n[5] = m[6] * s; n[6] = m[8] * s; n[7] = m[9] * s; n[8] = m[10] * s;
      return n;
    }
    function drawPart(g, model, color, alpha, emis) {
      gl.bindBuffer(gl.ARRAY_BUFFER, g.p); gl.enableVertexAttribArray(A.pos); gl.vertexAttribPointer(A.pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.nr); gl.enableVertexAttribArray(A.nor); gl.vertexAttribPointer(A.nor, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.i);
      gl.uniformMatrix4fv(U.m, false, model); gl.uniformMatrix3fv(U.n, false, normalMat(model));
      gl.uniform3fv(U.col, color); gl.uniform1f(U.a, alpha); gl.uniform1f(U.e, emis);
      gl.drawElements(gl.TRIANGLES, g.n, gl.UNSIGNED_SHORT, 0);
    }
    function project(vp, x, y, z) {
      var cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12], cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13], cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
      return [cx / cw, cy / cw];
    }

    var glassQueue = [];

    function frame(now) {
      running = false;
      if (!on || !visible || doc.hidden) return;
      var t = (now - t0) / 1000;
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      /* smooth mouse */
      mouse.sx = lerp(mouse.sx, mouse.nx, .06); mouse.sy = lerp(mouse.sy, mouse.ny, .06);

      /* camera: centre of the scene sits on the right of the hero, text stays free on the left */
      var camZ = 11.6 + Math.max(0, 2 - aspect) * 3 + scrollP * 3.2;
      var P = perspective(36 * Math.PI / 180, aspect, .1, 60);
      var shift = aspect > 1.75 ? .5 : .46;
      P[8] -= shift;                      // pushes the scene centre to the right
      var eye = [mouse.sx * .5, mouse.sy * .3 + .2, camZ];
      var V = lookAt(eye, [0, 0, 0], [0, 1, 0]);
      var VP = mul(P, V);

      /* scene rotation follows the mouse + scroll */
      var gRot = chain(RX(-mouse.sy * .16 + scrollP * .35), RY(mouse.sx * .32 + scrollP * 1.1 + Math.sin(t * .15) * .06));
      var spread = 1 + scrollP * .45;

      gl.useProgram(prog);
      gl.uniformMatrix4fv(U.vp, false, VP); gl.uniform3fv(U.cam, eye);

      var worldPos = [];
      glassQueue.length = 0;

      /* hub */
      var introHub = easeOutBack(clamp(t / 1.2, 0, 1));
      var hubM = chain(gRot, S(Math.max(.001, introHub)));
      drawPart(G.sphere, chain(hubM, S(.62)), C.tealHi, 1, .5);
      var rings = [[ringA, RX(Math.PI / 2 + Math.sin(t * .3) * .25), t * .35], [ringB, chain(RX(Math.PI / 2.3), RY(.5)), -t * .25], [ringC, chain(RX(Math.PI / 1.8), RY(-.4)), t * .18]];
      rings.forEach(function (r, ix) {
        drawPart(r[0], chain(hubM, r[1], RZ(r[2])), ix === 1 ? C.tealHi : C.plat, ix === 0 ? .95 : .55, ix === 1 ? .6 : .25);
        // satellite dot travelling along the ring
        var rad = [1.15, 1.65, 2.15][ix], a = t * (.9 - ix * .22) + ix * 2;
        var local = chain(r[1], RZ(r[2]), T(Math.cos(a) * rad, Math.sin(a) * rad, 0));
        drawPart(dotG, chain(hubM, local), ix === 1 ? C.tealHi : C.white, 1, .8);
      });

      /* ecosystem objects */
      objects.forEach(function (o, idx) {
        var pr = clamp((t - o.delay) / 1.5, 0, 1), es = easeOutBack(pr);
        var float = Math.sin(t * .8 + o.phase) * .2, bob = Math.cos(t * .6 + o.phase) * .08;
        var bx0 = o.base[0] * .68 * spread, by0 = o.base[1] * .8 * spread + float, bz0 = o.base[2] + bob - (1 - pr) * 3;
        var wp = (function () { var v = [bx0 + o.off[0], by0 + o.off[1], bz0]; return v; })();
        // rotate with the scene to find where it lands on screen (for the mouse push)
        var sx_ = gRot[0] * wp[0] + gRot[4] * wp[1] + gRot[8] * wp[2], sy_ = gRot[1] * wp[0] + gRot[5] * wp[1] + gRot[9] * wp[2], sz_ = gRot[2] * wp[0] + gRot[6] * wp[1] + gRot[10] * wp[2];
        var sc = project(VP, sx_, sy_, sz_);
        if (mouse.inside && pr >= 1) {
          var dx = (sc[0] - mouse.nx) * aspect, dy = sc[1] - mouse.ny, dist = Math.hypot(dx, dy), R = .55;
          if (dist < R && dist > .0001) {
            var f = (R - dist) / R; o.offT[0] = (dx / dist) * f * 1.1 / aspect * 1.2; o.offT[1] = (dy / dist) * f * 1.1;
          } else { o.offT[0] = 0; o.offT[1] = 0; }
        } else { o.offT[0] = 0; o.offT[1] = 0; }
        o.off[0] = lerp(o.off[0], o.offT[0], .09); o.off[1] = lerp(o.off[1], o.offT[1], .09);

        var yaw = o.yaw0 + Math.sin(t * o.spin + o.phase) * .6 + mouse.sx * .25;
        var objM = chain(gRot, T(wp[0], wp[1], wp[2]), RY(yaw), RX(o.tilt + Math.sin(t * .5 + o.phase) * .06), S(Math.max(.001, es) * o.scale * .82));
        worldPos[idx] = [sx_, sy_, sz_];

        o.parts.forEach(function (p) {
          var m = p.m;
          if (p.spin) m = mul(m, RZ(t * p.spin[1]));
          var model = mul(objM, m);
          if (p.glass) { glassQueue.push([p, model]); return; }
          drawPart(p.g, model, p.c, p.a, p.e);
        });
      });

      /* connector lines hub -> objects */
      gl.useProgram(lprog);
      gl.uniformMatrix4fv(LU.vp, false, VP);
      for (var li = 0; li < objects.length; li++) {
        lineData[li * 6] = 0; lineData[li * 6 + 1] = 0; lineData[li * 6 + 2] = 0;
        lineData[li * 6 + 3] = worldPos[li][0]; lineData[li * 6 + 4] = worldPos[li][1]; lineData[li * 6 + 5] = worldPos[li][2];
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf); gl.bufferData(gl.ARRAY_BUFFER, lineData, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(LA); gl.vertexAttribPointer(LA, 3, gl.FLOAT, false, 0, 0);
      gl.uniform4f(LU.col, .25, .85, .8, .38);
      gl.drawArrays(gl.LINES, 0, objects.length * 2);

      /* pulses travelling along the lines */
      gl.useProgram(prog);
      gl.uniformMatrix4fv(U.vp, false, VP); gl.uniform3fv(U.cam, eye);
      for (var pu = 0; pu < objects.length; pu++) {
        var k = (t * .35 + pu * .17) % 1, w = worldPos[pu];
        drawPart(dotG, chain(T(w[0] * k, w[1] * k, w[2] * k), S(.9)), C.white, 1, 1);
      }

      /* glass last */
      gl.depthMask(false);
      glassQueue.forEach(function (q) { drawPart(q[0].g, q[1], q[0].c, q[0].a, q[0].e); });
      gl.depthMask(true);

      /* drifting particles */
      gl.useProgram(pprog);
      gl.uniformMatrix4fv(PU.vp, false, mul(VP, gRot)); gl.uniform1f(PU.t, t); gl.uniform1f(PU.size, 4.2 * dpr);
      gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
      gl.enableVertexAttribArray(PA.pos); gl.vertexAttribPointer(PA.pos, 3, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(PA.seed); gl.vertexAttribPointer(PA.seed, 1, gl.FLOAT, false, 16, 12);
      gl.drawArrays(gl.POINTS, 0, PN);

      if (firstFrame) { firstFrame = false; if (on) { canvas.classList.add('is-on'); wrap.classList.add('sa-hero3d-wrap'); } }
      running = true; window.requestAnimationFrame(frame);   // ambient float is always moving while the hero is in view
    }

    check();
  }

  if (doc.readyState !== 'loading') boot(); else doc.addEventListener('DOMContentLoaded', boot);
})();
