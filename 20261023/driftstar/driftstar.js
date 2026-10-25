// Driftstar: three diamond needles on X, Y and Z, merged with soft fillets. From the sketch
// camera (39 deg up, turned 45 deg) they read as a flat six-point star; turn it and they
// come apart into an object. The theme decides the colours: night shows satin porcelain,
// day shows gloss ink, each on the theme's own background.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const stage = document.getElementById('stage');
const sketchBtn = document.getElementById('t-sketch');
const turnBtn = document.getElementById('t-turn');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// The Blender hero camera (Cam_Hero), converted to glTF's Y-up: (x, y, z) -> (x, z, -y).
const HERO = new THREE.Vector3(-5.93, 6.78, 5.93);
const TARGET = new THREE.Vector3(0, 0, 0);
const HERO_FOV = 24.8; // 81.85 mm on a 36 mm sensor, square frame
const SHIFT_Y = 0.0417; // Blender shift_y, centres the star's bounds in the frame
const camera = new THREE.PerspectiveCamera(HERO_FOV, 1, 0.1, 200);
camera.position.copy(HERO);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 5;
controls.maxDistance = 24;
controls.autoRotateSpeed = 1.6;
controls.update();

// Key from camera left and high, a rim behind on the right: the same rig as the renders.
const key = new THREE.DirectionalLight(0xffffff, 2.2);
const rim = new THREE.DirectionalLight(0xffffff, 1.1);
scene.add(key, rim);
function placeLights() {
  // relative to the hero camera's azimuth, so the lighting stays put while the star turns
  const az = Math.atan2(HERO.x, HERO.z);
  const at = (rel, elev, d) => new THREE.Vector3(
    Math.sin(az + rel) * Math.cos(elev) * d, Math.sin(elev) * d, Math.cos(az + rel) * Math.cos(elev) * d);
  key.position.copy(at(-1.22, 0.7, 10));
  rim.position.copy(at(2.44, 0.38, 10));
}
placeLights();

// Per theme: the material, how much of the room it reflects, and the key and rim.
const LOOKS = {
  night: {
    mat: new THREE.MeshPhysicalMaterial({ color: 0xc9c5bd, roughness: 0.38, clearcoat: 0.2, clearcoatRoughness: 0.16, sheen: 0.12 }),
    env: 0.22, key: 1.5, rim: 0.9, exposure: 0.9,
  },
  day: {
    mat: new THREE.MeshPhysicalMaterial({ color: 0x030304, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 }),
    env: 0.32, key: 1.2, rim: 1.4, exposure: 1.0,
  },
};
let look = null; // the first applyTheme always paints
let star = null;

// The theme decides: a dark --bg gets the light star, a light --bg the dark one.
const probe = document.createElement('canvas').getContext('2d');
function bgIsDark() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#fff5f5';
  probe.fillStyle = '#000';
  probe.fillStyle = bg;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}
function applyTheme() {
  const next = bgIsDark() ? 'night' : 'day';
  if (next === look && (star ? star.userData.look === look : true)) return;
  look = next;
  const L = LOOKS[look];
  renderer.toneMappingExposure = L.exposure;
  scene.environmentIntensity = L.env;
  key.intensity = L.key;
  rim.intensity = L.rim;
  if (star) { star.traverse((m) => { if (m.isMesh) m.material = L.mat; }); star.userData.look = look; }
  wake();
}
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

function fit() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Hero framing with room for the chrome; narrow screens widen the view to keep the arms in.
  const t = Math.tan(THREE.MathUtils.degToRad(HERO_FOV * 1.18) / 2) * Math.max(1, 0.8 / camera.aspect);
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(t));
  camera.setViewOffset(w, h, 0, SHIFT_Y * h, w, h);
  camera.updateProjectionMatrix();
  wake();
}
addEventListener('resize', fit);

// Sketch: back to the sketch camera. Lights while there is a view to go back from.
let fly = null;
function atHero() { return camera.position.distanceTo(HERO) < 0.05; }
function toHero() {
  setTurn(false);
  if (reduced.matches) { camera.position.copy(HERO); controls.update(); wake(); return; }
  fly = { from: camera.position.clone(), t0: performance.now() };
  wake();
}
sketchBtn.addEventListener('click', toHero);

function setTurn(on) {
  controls.autoRotate = on;
  turnBtn.classList.toggle('is-on', on);
  turnBtn.setAttribute('aria-pressed', String(on));
  wake();
}
turnBtn.addEventListener('click', () => setTurn(!controls.autoRotate));
controls.addEventListener('start', () => { fly = null; });
controls.addEventListener('change', wake);

// Render on demand: idle frames cost nothing.
let raf = 0;
function wake() { if (!raf) raf = requestAnimationFrame(frame); }
function frame(now) {
  raf = 0;
  let moving = controls.autoRotate;
  if (fly) {
    const k = Math.min(1, (now - fly.t0) / 700);
    const e = 1 - Math.pow(1 - k, 3);
    // swing round on the sphere rather than cutting through the star
    const a = fly.from.clone().normalize(), b = HERO.clone().normalize();
    const r = THREE.MathUtils.lerp(fly.from.length(), HERO.length(), e);
    camera.position.copy(new THREE.Vector3().copy(a).lerp(b, e).normalize().multiplyScalar(r));
    if (k >= 1) { camera.position.copy(HERO); fly = null; }
    moving = true;
  }
  if (controls.update()) moving = true;
  sketchBtn.classList.toggle('is-on', !atHero());
  renderer.render(scene, camera);
  if (moving) wake();
}

const draco = new DRACOLoader().setDecoderPath('./vendor/draco/');
new GLTFLoader().setDRACOLoader(draco).load('./driftstar.glb', (g) => {
  star = g.scene;
  scene.add(star);
  applyTheme();
  window.driftstar = { ready: true, look: () => look };
  document.dispatchEvent(new CustomEvent('driftstar:ready'));
  wake();
});

fit();
applyTheme();
