/**
 * Oregon — Intro Animation
 * Partículas dispersas → giram em espiral → formam a logo Oregon
 */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.getElementById('intro')?.remove();
    return;
  }
  if (typeof THREE === 'undefined') {
    document.getElementById('intro')?.remove();
    return;
  }

  document.body.style.overflow = 'hidden';

  const introEl  = document.getElementById('intro');
  const canvasEl = document.getElementById('intro-canvas');
  if (!introEl || !canvasEl) return;

  const W      = window.innerWidth;
  const H      = window.innerHeight;
  const MOBILE = W < 768;

  // ── Three.js ──────────────────────────────────────────────────────────────
  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(55, W / H, 0.01, 100);
  camera.position.set(0, 0, 4.5);

  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: false });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  // ── Soft glow particle texture ─────────────────────────────────────────────
  function makeParticleTex() {
    const c  = document.createElement('canvas');
    c.width  = c.height = 64;
    const cx = c.getContext('2d');
    const g  = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0.0, 'rgba(255,255,255,1.0)');
    g.addColorStop(0.25,'rgba(255,220,140,0.85)');
    g.addColorStop(0.6, 'rgba(255,100,0,0.25)');
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  // ── Particles ──────────────────────────────────────────────────────────────
  const N = MOBILE ? 1800 : 3000;

  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const vel = Array.from({ length: N }, () => [0, 0, 0]);
  const tgt = Array.from({ length: N }, () => ({ x: 0, y: 0, z: 0, r: 1, g: 1, b: 1 }));

  // Start scattered as stars
  for (let i = 0; i < N; i++) {
    const ang      = Math.random() * Math.PI * 2;
    const rad      = 3.5 + Math.random() * 6;
    pos[i * 3]     = Math.cos(ang) * rad;
    pos[i * 3 + 1] = Math.sin(ang) * rad;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 3;
    col[i * 3]     = 0.75 + Math.random() * 0.25;
    col[i * 3 + 1] = 0.75 + Math.random() * 0.25;
    col[i * 3 + 2] = 0.85 + Math.random() * 0.15;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));

  const mat = new THREE.PointsMaterial({
    size:            MOBILE ? 0.085 : 0.062,
    map:             makeParticleTex(),
    vertexColors:    true,
    blending:        THREE.AdditiveBlending,
    depthWrite:      false,
    transparent:     true,
    alphaTest:       0.001,
    sizeAttenuation: true,
  });

  const pts = new THREE.Points(geo, mat);
  scene.add(pts);

  // ── Rasterise logo SVG → particle targets ──────────────────────────────────
  function makeLogoTargets() {
    return new Promise(resolve => {
      const img = new Image();

      img.onload = () => {
        try {
          const cw = 380, ch = 152;
          const c  = document.createElement('canvas');
          c.width  = cw; c.height = ch;
          const cx = c.getContext('2d');
          cx.drawImage(img, 0, 0, cw, ch);
          const d = cx.getImageData(0, 0, cw, ch).data;

          const pool = [];
          const step = MOBILE ? 4 : 3;
          for (let y = 0; y < ch; y += step) {
            for (let x = 0; x < cw; x += step) {
              const i = (y * cw + x) * 4;
              if (d[i + 3] > 80) {
                pool.push({
                  x:  (x / cw - 0.5) * (MOBILE ? 2.9 : 3.9),
                  y: -(y / ch - 0.5) * (MOBILE ? 1.15 : 1.55),
                  z:  (Math.random() - 0.5) * 0.04,
                  r:  d[i]     / 255,
                  g:  d[i + 1] / 255,
                  b:  d[i + 2] / 255,
                });
              }
            }
          }

          resolve(Array.from({ length: N }, () => pool[Math.floor(Math.random() * pool.length)]));
        } catch {
          resolve(null);
        }
      };

      img.onerror = () => resolve(null);
      img.src     = 'img/logo.svg';
    });
  }

  // ── Spring physics ─────────────────────────────────────────────────────────
  let spring = 0.022, friction = 0.84;

  function applyTargets(shapes) {
    const len = shapes.length;
    for (let i = 0; i < N; i++) {
      const s  = shapes[i % len];
      tgt[i].x = s.x; tgt[i].y = s.y; tgt[i].z = s.z || 0;
      tgt[i].r = s.r; tgt[i].g = s.g; tgt[i].b = s.b;
    }
  }

  // ── Rotation ───────────────────────────────────────────────────────────────
  let rotZ = 0, targetRotZ = 0;

  // ── Render loop ────────────────────────────────────────────────────────────
  let raf;

  function tick() {
    raf = requestAnimationFrame(tick);

    for (let i = 0; i < N; i++) {
      const t  = tgt[i];
      vel[i][0] = (vel[i][0] + (t.x - pos[i * 3])     * spring) * friction;
      vel[i][1] = (vel[i][1] + (t.y - pos[i * 3 + 1]) * spring) * friction;
      vel[i][2] = (vel[i][2] + (t.z - pos[i * 3 + 2]) * spring) * friction;
      pos[i * 3]     += vel[i][0];
      pos[i * 3 + 1] += vel[i][1];
      pos[i * 3 + 2] += vel[i][2];
      col[i * 3]     += (t.r - col[i * 3])     * 0.055;
      col[i * 3 + 1] += (t.g - col[i * 3 + 1]) * 0.055;
      col[i * 3 + 2] += (t.b - col[i * 3 + 2]) * 0.055;
    }

    rotZ += (targetRotZ - rotZ) * 0.06;
    pts.rotation.z = rotZ;

    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate    = true;
    renderer.render(scene, camera);
  }
  tick();

  // ── Exit ───────────────────────────────────────────────────────────────────
  let finished = false;

  function exit() {
    if (finished) return;
    finished = true;
    introEl.style.transition = 'opacity 0.8s ease';
    introEl.style.opacity    = '0';
    setTimeout(() => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      introEl.remove();
      document.body.style.overflow = '';
    }, 820);
  }

  introEl.addEventListener('click', exit, { once: true });

  // ── Sequence ───────────────────────────────────────────────────────────────
  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function run() {
    const logo = await makeLogoTargets();
    if (!logo) { exit(); return; }

    // Phase 1 — Stars hold briefly (800ms)
    await wait(800);

    // Phase 2 — Spiral inward: set targets to tight cluster + start spinning
    spring = 0.03; friction = 0.85;
    targetRotZ = Math.PI * 3; // 1.5 rotações
    for (let i = 0; i < N; i++) {
      const ang  = Math.random() * Math.PI * 2;
      const rad  = 0.15 + Math.random() * 0.5;
      tgt[i].x   = Math.cos(ang) * rad;
      tgt[i].y   = Math.sin(ang) * rad;
      tgt[i].z   = (Math.random() - 0.5) * 0.2;
      tgt[i].r   = 1; tgt[i].g = 0.55; tgt[i].b = 0.08;
    }
    await wait(1100);

    // Phase 3 — Desacelera rotação e forma a logo
    targetRotZ = Math.PI * 4; // mais meio giro, suave
    spring = 0.038; friction = 0.87;
    applyTargets(logo);

    // Zera a rotação gradualmente enquanto a logo forma
    setTimeout(() => { targetRotZ = 0; }, 600);

    await wait(2400); // logo se forma completamente

    // Phase 4 — Fade in crisp logo image on top of particles
    const logoImg = document.getElementById('intro-logo');
    if (logoImg) logoImg.classList.add('visible');

    await wait(1400); // hold with logo clearly visible
    exit();
  }

  run();
}());
