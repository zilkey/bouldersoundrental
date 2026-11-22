/* 3D hero for bouldersoundrental.com.
   1. The sound system (two speakers on stands + a sub): drag to spin it.
   2. The Flatirons strip with the waveform behind it: drag to look around.
   If WebGL or the three.js download fails, the page keeps its flat SVG art. */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const AMBER = 0xf4b13d, AMBER2 = 0xffd27a;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function mount(host, cls) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.domElement.className = cls;
  host.appendChild(r.domElement);
  return r;
}

function dragger(el, onMove, onStart, onEnd) {
  let id = null, lx = 0, ly = 0;
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") e.preventDefault();
    id = e.pointerId; lx = e.clientX; ly = e.clientY;
    try { el.setPointerCapture(id); } catch (_) {}
    el.classList.add("grabbing");
    if (onStart) onStart();
  });
  el.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    onMove(e.clientX - lx, e.clientY - ly);
    lx = e.clientX; ly = e.clientY;
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null; el.classList.remove("grabbing");
    if (onEnd) onEnd();
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

/* =====================================================================
   1. The sound system
   ===================================================================== */
function buildRig(host) {
  const renderer = mount(host, "rig3d");
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const canvas = renderer.domElement;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const target = new THREE.Vector3(0, 0.8, 0);

  scene.add(new THREE.HemisphereLight(0xffe6bd, 0x0e0a06, 0.7));
  const key = new THREE.DirectionalLight(0xfff0d6, 2.6); key.position.set(2.2, 3.6, 3.4); scene.add(key);
  const rim = new THREE.DirectionalLight(AMBER, 2.4); rim.position.set(-3, 2.2, -3.5); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(AMBER2, 1.1); rim2.position.set(3.5, 1.2, -2.5); scene.add(rim2);
  const floorLight = new THREE.PointLight(AMBER, 5, 5, 1.6); floorLight.position.set(0, 0.25, 0.9); scene.add(floorLight);

  const M = {
    body: new THREE.MeshStandardMaterial({ color: 0x1d1711, roughness: 0.5, metalness: 0.3 }),
    face: new THREE.MeshStandardMaterial({ color: 0x0e0b08, roughness: 0.85, metalness: 0.1 }),
    cone: new THREE.MeshStandardMaterial({ color: 0x2a2014, roughness: 0.65, metalness: 0.15, side: THREE.DoubleSide }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0b0907, roughness: 0.9 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x57493a, roughness: 0.35, metalness: 0.85 }),
    edge: new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0.3 })
  };
  const glowMat = () => new THREE.MeshStandardMaterial({ color: AMBER, emissive: AMBER, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.3 });

  function roundedBox(w, h, d, r) {
    const b = Math.min(r, 0.02), x = w / 2 - b, y = h / 2 - b, rr = Math.max(r - b, 0.001);
    const s = new THREE.Shape();
    s.moveTo(-x + rr, -y); s.lineTo(x - rr, -y); s.quadraticCurveTo(x, -y, x, -y + rr);
    s.lineTo(x, y - rr); s.quadraticCurveTo(x, y, x - rr, y);
    s.lineTo(-x + rr, y); s.quadraticCurveTo(-x, y, -x, y - rr);
    s.lineTo(-x, -y + rr); s.quadraticCurveTo(-x, -y, -x + rr, -y);
    const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 6 });
    g.center();
    return g;
  }

  const drivers = [];
  // A speaker driver sitting on the cabinet's front face. z is the face.
  function driver(r, z, kind) {
    const g = new THREE.Group(); g.position.z = z;
    const ringMat = glowMat();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.065, 14, 56), ringMat); ring.position.z = r * 0.16; g.add(ring);
    const back = new THREE.Mesh(new THREE.CircleGeometry(r * 1.12, 48), M.face); back.position.z = 0.002; g.add(back);
    const moving = new THREE.Group(); g.add(moving);
    const surround = new THREE.Mesh(new THREE.TorusGeometry(r * 0.84, r * 0.09, 12, 48), M.rubber); surround.position.z = r * 0.12; moving.add(surround);
    const cone = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(r * 0.2, r * 0.02), new THREE.Vector2(r * 0.5, r * 0.06), new THREE.Vector2(r * 0.8, r * 0.14)], 48), M.cone);
    cone.rotation.x = Math.PI / 2; moving.add(cone);
    const capMat = glowMat(); capMat.emissiveIntensity = 0.25; capMat.color.set(0x8a6420);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.24, 24, 14), capMat); cap.scale.z = 0.45; cap.position.z = r * 0.03; moving.add(cap);
    drivers.push({ ringMat, capMat, moving, r, kind });
    return g;
  }

  function cabinet(w, h, d, r) {
    const g = new THREE.Group();
    const geo = roundedBox(w, h, d, r);
    g.add(new THREE.Mesh(geo, M.body));
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 42), M.edge));
    return g;
  }

  function speaker() {
    const w = 0.3, h = 0.5, d = 0.28;
    const g = cabinet(w, h, d, 0.035);
    const woofer = driver(0.1, d / 2, "low"); woofer.position.y = -0.09; g.add(woofer);
    const horn = driver(0.042, d / 2, "high"); horn.position.y = 0.155; g.add(horn);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c9 }));
    led.position.set(0.112, -0.218, d / 2 + 0.004); g.add(led);
    const handle = new THREE.Mesh(roundedBox(0.12, 0.03, 0.02, 0.012), M.rubber); handle.position.set(0, h / 2 + 0.002, 0); g.add(handle);
    return g;
  }

  function stand(height) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.02, height, 16), M.metal); pole.position.y = height / 2; g.add(pole);
    const hubY = 0.46;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.07, 16), M.rubber); hub.position.y = hubY; g.add(hub);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.05, 16), M.rubber); collar.position.y = height * 0.72; g.add(collar);
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const foot = new THREE.Vector3(Math.cos(a) * 0.43, 0.012, Math.sin(a) * 0.43), top = new THREE.Vector3(0, hubY, 0);
      const dir = foot.clone().sub(top), len = dir.length();
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 10), M.metal);
      leg.position.copy(top).addScaledVector(dir, 0.5);
      leg.quaternion.setFromUnitVectors(up, dir.clone().normalize());
      g.add(leg);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), M.rubber); tip.position.copy(foot); g.add(tip);
    }
    return g;
  }

  const rig = new THREE.Group(); scene.add(rig);
  const POLE = 1.14;
  [-1, 1].forEach((side) => {
    const st = stand(POLE); st.position.x = side * 0.64; rig.add(st);
    const sp = speaker(); sp.position.set(side * 0.64, POLE + 0.25, 0); sp.rotation.y = -side * 0.16; rig.add(sp);
  });
  const sub = cabinet(0.46, 0.46, 0.46, 0.04); sub.position.set(0, 0.25, 0.08);
  const subDrv = driver(0.155, 0.23, "sub"); sub.add(subDrv);
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 12), M.rubber);
    f.position.set(sx * 0.17, -0.24, sz * 0.17); sub.add(f);
  }));
  rig.add(sub);

  // floor: soft amber pool of light and sound rings rolling outward
  const gc = document.createElement("canvas"); gc.width = gc.height = 256;
  const gx = gc.getContext("2d"), grad = gx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(244,177,61,.55)"); grad.addColorStop(0.35, "rgba(244,177,61,.16)"); grad.addColorStop(1, "rgba(244,177,61,0)");
  gx.fillStyle = grad; gx.fillRect(0, 0, 256, 256);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.45, 64), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.001; rig.add(pool);
  const rings = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.982, 1, 128), new THREE.MeshBasicMaterial({ color: AMBER2, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.004 + i * 0.001; rig.add(m); rings.push(m);
  }

  // dust in the light
  const N = 140, pos = new Float32Array(N * 3), seed = [];
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.2 + Math.random() * 1.15;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.random() * 1.9; pos[i * 3 + 2] = Math.sin(a) * r;
    seed.push(0.02 + Math.random() * 0.05);
  }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: AMBER2, size: 0.014, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  rig.add(dust);

  // interaction
  let yaw = -0.62, pitch = 0.2, vel = 0, dragging = false, idle = 2, intro = 0;
  const AUTO = reduced ? 0 : 0.32;      // radians per second
  const hint = host.querySelector(".spin-hint");
  dragger(canvas, (dx, dy) => {
    yaw += dx * 0.0085; vel = dx * 0.0085 * 60;
    pitch = clamp(pitch + dy * 0.004, -0.12, 0.75);
  }, () => { dragging = true; if (hint) hint.classList.add("gone"); }, () => { dragging = false; idle = 0; });

  let dist = 5;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    const t = Math.tan((cam.fov / 2) * Math.PI / 180);
    dist = Math.max(1.16 / t, 1.08 / (t * cam.aspect));
    cam.updateProjectionMatrix();
  }

  function render(t, dt) {
    if (!dragging) {
      idle += dt;
      const want = idle > 1.2 ? AUTO : 0;
      vel += (want - vel) * Math.min(1, dt * (idle > 1.2 ? 1.2 : 3.5));
      yaw += vel * dt;
    }
    intro = Math.min(1, intro + dt * 0.9);
    const e = 1 - Math.pow(1 - intro, 3);
    rig.rotation.y = yaw + (1 - e) * -1.6;
    rig.scale.setScalar(0.86 + 0.14 * e);
    cam.position.set(0, target.y + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
    cam.lookAt(target);

    const beat = (t * 100) / 60;
    const kick = reduced ? 0.3 : Math.exp(-(beat % 1) * 6);
    const hat = reduced ? 0.3 : Math.exp(-((beat * 2 + 0.5) % 1) * 9);
    drivers.forEach((d) => {
      const v = d.kind === "high" ? hat : kick;
      d.moving.position.z = v * d.r * (d.kind === "sub" ? 0.16 : 0.1);
      d.ringMat.emissiveIntensity = 0.55 + v * (d.kind === "sub" ? 1.9 : 1.3);
      d.capMat.emissiveIntensity = 0.15 + v * 0.5;
    });
    floorLight.intensity = 4 + kick * 5;
    pool.material.opacity = 0.75 + kick * 0.25;
    rings.forEach((m, i) => {
      const p = reduced ? (i + 1) / 5 : ((t / 2.4) + i / 4) % 1;
      m.scale.setScalar(0.3 + p * 1.1);
      m.material.opacity = Math.pow(1 - p, 1.6) * 0.6 * Math.min(1, p / 0.08);
    });
    if (!reduced) {
      const a = dustGeo.attributes.position;
      for (let i = 0; i < N; i++) {
        let y = a.getY(i) + seed[i] * dt;
        if (y > 1.9) y = 0;
        a.setY(i, y);
      }
      a.needsUpdate = true;
    }
    renderer.render(scene, cam);
  }
  return { el: canvas, resize, render, setYaw: (v, p) => { yaw = v; vel = 0; idle = -1e9; intro = 1; if (p != null) pitch = p; } };
}

/* =====================================================================
   2. The Flatirons, with the waveform standing behind them
   ===================================================================== */
function buildMountains(hero) {
  const renderer = mount(hero, "mtns3d");
  const canvas = renderer.domElement;
  const scene = new THREE.Scene();
  const FOV = 20, cam = new THREE.PerspectiveCamera(FOV, 4.8, 0.1, 80);
  const D0 = 1.5 / Math.tan((FOV / 2) * Math.PI / 180);   // distance that frames the full 3-unit height

  scene.add(new THREE.AmbientLight(0xffe6bd, 0.9));
  const sun = new THREE.DirectionalLight(0xffe2b0, 1.9); sun.position.set(-4, 5, 6); scene.add(sun);
  const back = new THREE.PointLight(AMBER, 14, 14, 1.4); back.position.set(4.6, 1.7, -3.2); scene.add(back);

  // points are in the old SVG's 1440 x 300 space
  const X = (x) => (x - 720) / 100, Y = (y) => (300 - y) / 100;
  function ridge(pts, z, color) {
    const s = new THREE.Shape();
    s.moveTo(-14, -4); s.lineTo(-14, Y(pts[0][1]));
    pts.forEach((p) => s.lineTo(X(p[0]), Y(p[1])));
    s.lineTo(14, Y(pts[pts.length - 1][1])); s.lineTo(14, -4);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color }));
    const k = (D0 - z) / D0;                 // keep its on-screen size the same at any depth
    m.scale.set(k, k, 1); m.position.set(0, 1.5 * (1 - k), z);
    scene.add(m);
    return m;
  }
  ridge([[0, 210], [130, 150], [230, 185], [360, 120], [470, 175], [600, 110], [760, 190], [900, 135], [1040, 185], [1180, 125], [1310, 175], [1440, 140]], -5, 0x17120c);
  ridge([[0, 250], [90, 215], [210, 245], [330, 200], [520, 255], [700, 225], [900, 262], [1060, 218], [1230, 252], [1440, 215]], -2.4, 0x15100b);
  ridge([[0, 285], [160, 262], [330, 280], [520, 264], [760, 284], [1000, 268], [1200, 285], [1440, 270]], 0.9, 0x0c0a08);

  // the slabs: thick plates of rock leaning back, like the real ones
  const slabMat = new THREE.MeshStandardMaterial({ color: 0x2f2314, roughness: 0.9, metalness: 0.05, flatShading: true });
  const slabEdge = new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0.45 });
  const slabs = new THREE.Group(); slabs.position.z = -0.9;
  [[[985, 300], [1010, 118], [1052, 106], [1128, 300]], [[1088, 300], [1112, 72], [1160, 58], [1262, 300]],
   [[1200, 300], [1224, 134], [1264, 124], [1344, 300]], [[1292, 300], [1312, 168], [1346, 160], [1410, 300]]].forEach((pts, i) => {
    const s = new THREE.Shape();
    pts.forEach((p, j) => (j ? s.lineTo(X(p[0]), Y(p[1])) : s.moveTo(X(p[0]), Y(p[1]))));
    const depth = 0.55;
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    g.translate(0, 0, -depth);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(g, slabMat));
    grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), slabEdge));
    grp.rotation.x = -0.3;
    grp.position.z = -i * 0.22;
    slabs.add(grp);
  });
  scene.add(slabs);

  // the waveform: a row of glowing bars far behind the ridges
  const NB = 96, ZB = -6.6, kb = (D0 - ZB) / D0;
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }), NB);
  const info = [], dummy = new THREE.Object3D(), col = new THREE.Color(), base = new THREE.Color(0xc97f12), tip = new THREE.Color(AMBER);
  for (let i = 0; i < NB; i++) {
    const env = 0.35 + 0.65 * Math.abs(Math.sin(i * 0.23) * Math.cos(i * 0.071 + 1));
    const u = i / (NB - 1), fade = Math.min(1, Math.min(u, 1 - u) / 0.14);
    info.push({ x: (u - 0.5) * 10.6, h: 0.14 + env * 0.92, dur: 1.8 + (i % 7) * 0.22, delay: (i * 0.17) % 2.4, fade });
    col.copy(base).lerp(tip, env).multiplyScalar(0.12 + 0.88 * fade * fade);
    bars.setColorAt(i, col);
  }
  bars.scale.set(kb, kb, 1); bars.position.set(0, 1.5 * (1 - kb), ZB);
  scene.add(bars);

  let dragYaw = 0, dragPitch = 0, hoverYaw = 0, hoverTarget = 0, dragging = false;
  dragger(canvas, (dx, dy) => {
    dragYaw = clamp(dragYaw - dx * 0.0016, -0.34, 0.34);
    dragPitch = clamp(dragPitch + dy * 0.0012, 0, 0.13);
  }, () => { dragging = true; }, () => { dragging = false; });
  hero.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || dragging) return;
    const r = hero.getBoundingClientRect();
    hoverTarget = -((e.clientX - r.left) / r.width - 0.5) * 0.14;
  });
  hero.addEventListener("pointerleave", () => { hoverTarget = 0; });

  let H = 3, dist = D0, tx = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    H = Math.min(3, 14.4 / cam.aspect);                    // same crop the flat SVG used
    dist = (H / 2) / Math.tan((FOV / 2) * Math.PI / 180);
    tx = Math.max(0, (14.4 - H * cam.aspect) / 2) * 0.82;  // on narrow screens, slide over to the Flatirons
    cam.updateProjectionMatrix();
  }

  function render(t, dt) {
    if (!dragging) { const k = Math.exp(-dt * 2.2); dragYaw *= k; dragPitch *= k; }
    hoverYaw += (hoverTarget - hoverYaw) * Math.min(1, dt * 3);
    const yaw = dragYaw + hoverYaw + (reduced ? 0 : Math.sin(t * 0.22) * 0.035);
    const pitch = dragPitch;
    const ty = H / 2;
    cam.position.set(tx + Math.sin(yaw) * Math.cos(pitch) * dist, ty + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    cam.lookAt(tx, ty, 0);

    let glow = 0;
    for (let i = 0; i < NB; i++) {
      const b = info[i];
      const s = reduced ? 0.7 : 0.35 + 0.65 * (0.5 - 0.5 * Math.cos(((t + b.delay) / b.dur) * Math.PI * 2));
      glow += s;
      dummy.position.set(b.x, 1.8, 0);
      dummy.scale.set(0.05, b.h * s, 0.05);
      dummy.updateMatrix();
      bars.setMatrixAt(i, dummy.matrix);
    }
    bars.instanceMatrix.needsUpdate = true;
    back.intensity = 8 + (glow / NB) * 14;
    renderer.render(scene, cam);
  }
  return { el: canvas, resize, render };
}

/* ===================================================================== */
function start() {
  const hero = document.querySelector(".hero"), art = document.querySelector(".hero-art");
  if (!hero || !art) return;
  const parts = [];
  try { parts.push(buildRig(art)); art.classList.add("is3d"); } catch (e) { console.warn("3D rig unavailable", e); }
  try { parts.push(buildMountains(hero)); hero.classList.add("has3d"); } catch (e) { console.warn("3D mountains unavailable", e); }
  if (!parts.length) return;
  window.BSR3D = parts;

  const onResize = () => parts.forEach((p) => p.resize());
  onResize();
  if ("ResizeObserver" in window) { const ro = new ResizeObserver(onResize); parts.forEach((p) => ro.observe(p.el)); }
  window.addEventListener("resize", onResize);

  let visible = true;
  if ("IntersectionObserver" in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(hero);

  let last = performance.now();
  (function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (visible && !document.hidden) parts.forEach((p) => p.render(now / 1000, dt));
    requestAnimationFrame(tick);
  })(last);
}
start();
