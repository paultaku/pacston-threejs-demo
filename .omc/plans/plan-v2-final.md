# Three.js 3D "M" Logo Interactive Demo — Implementation Plan v2 (Final)

**Created:** 2026-02-13
**Status:** CONSENSUS REACHED (Planner + Architect + Critic)
**Complexity:** MEDIUM
**Files:** 10 source files + 1 font asset + 1 documentation file

---

## Consensus Changes from v1

| # | Source | Change | Rationale |
|---|--------|--------|-----------|
| 1 | Architect | Safari minimum → 16.4+ with import map feature detection | Import maps require Safari 16.4+ |
| 2 | Architect | Font loading: add CDN fallback chain | Resilience against deployment path issues |
| 3 | Architect | Remove `bloomPass.resolution.set()` from resize | `composer.setSize()` propagates internally |
| 4 | Architect | Clarify antialias as one-time context flag | Prevent runtime toggle attempt |
| 5 | Architect+Critic | Adaptive quality tiers instead of binary mobile detection | `ontouchstart` unreliable on touchscreen laptops |
| 6 | Architect | Add `visibilitychange` handler to pause/resume | Save GPU when tab hidden |
| 7 | Architect | Simplify state machine to 2 states (IDLE/HOVERING) | Easing inherently handles transitions |
| 8 | Critic | Add exact font download URL + curl command | Executor needs concrete acquisition step |
| 9 | Critic | Define `createAnimationLoop(deps)` param shape | Remove ambiguity |
| 10 | Critic | Specify particle parameters (radius, freq, amplitude) | Reduce iteration guesswork |
| 11 | Critic | Specify hover target color: `#2980b9` / emissive `#4fc3f7` | Remove vagueness |
| 12 | Critic | Add entrance animation (scale 0→1 ease-out) | Polished first impression |
| 13 | Critic | Add subtle Y-axis bobbing | Logo feels alive |
| 14 | Critic | Add mouse-reactive tilt (parallax) | "Logo watches you" effect |
| 15 | Critic | Add `package.json` for dev setup | Standard practice |
| 16 | Critic | Add page title, favicon, aria-label | Attention to detail |
| 17 | Architect | Increase loading timeout to 15s | Slow mobile connections |
| 18 | Architect | Add `renderer.dispose()` + `composer.dispose()` | Leak prevention |

---

## 1. Project Structure

```
threeJS-demo/
├── index.html                  # Entry point, import map, canvas host
├── package.json                # Dev scripts (npx serve)
├── css/
│   └── styles.css              # Layout, loading overlay, fallback styles
├── js/
│   ├── main.js                 # Bootstrap: init scene, start loop, bind events
│   ├── scene.js                # Scene, camera, renderer, lighting, composer
│   ├── logo.js                 # "M" letter geometry + materials + font loading
│   ├── animation.js            # Rotation controller, easing, entrance anim, bobbing
│   ├── interaction.js          # Raycaster hover, mouse/touch, parallax tilt
│   ├── effects.js              # Particles, bloom tuning, hover color shifts
│   └── utils.js                # WebGL detection, resize, disposal, quality tiers
├── assets/
│   └── fonts/
│       └── helvetiker_bold.typeface.json  # Bundled locally + CDN fallback
└── docs/
    └── TECHNICAL.md            # Architecture, animation, performance, library docs
```

---

## 2. Technology Stack

| Technology | Choice | Rationale |
|---|---|---|
| **Three.js** | r182 (v0.182.0) via jsDelivr CDN | Latest stable; CDN avoids build tooling |
| **Module System** | ES Modules + `<script type="importmap">` | Native browser support, no bundler |
| **CDN** | jsDelivr (`cdn.jsdelivr.net/npm/three@0.182.0/`) | Reliable, fast, all addon paths verified |
| **Font** | Helvetiker Bold typeface JSON (local + CDN fallback) | Parametric control, no external tooling |
| **Dev Server** | `npx serve .` | Zero config |
| **No frameworks** | Vanilla JS only | Requirement compliance |

### Import Map

```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/"
  }
}
</script>
```

### Required Addons

- `FontLoader` — `three/addons/loaders/FontLoader.js`
- `TextGeometry` — `three/addons/geometries/TextGeometry.js`
- `EffectComposer` — `three/addons/postprocessing/EffectComposer.js`
- `RenderPass` — `three/addons/postprocessing/RenderPass.js`
- `UnrealBloomPass` — `three/addons/postprocessing/UnrealBloomPass.js`
- `OutputPass` — `three/addons/postprocessing/OutputPass.js`

### Browser Compatibility

- Chrome 89+, Firefox 108+, Safari 16.4+, Edge 89+
- Import maps: 94.5% global coverage
- Feature detection snippet for unsupported browsers (CSS fallback)

---

## 3. 3D Model Strategy — TextGeometry

### Why TextGeometry

Best balance of parametric control and simplicity. No external modeling tools. No GLTF loading complexity. Single letter "M" is the ideal use case.

### Configuration

```js
const geometry = new TextGeometry('M', {
  font: loadedFont,
  size: 3,
  depth: 0.8,           // (formerly "height" in older versions)
  curveSegments: 12,
  bevelEnabled: true,
  bevelThickness: 0.08,
  bevelSize: 0.05,
  bevelSegments: 5
});
geometry.computeBoundingBox();
geometry.center();
```

### Material

```js
const material = new THREE.MeshStandardMaterial({
  color: 0x1a5276,          // Deep blue base
  metalness: 0.7,
  roughness: 0.25,
  emissive: 0x0a2a3f,       // Subtle self-illumination for bloom
  emissiveIntensity: 0.3
});
```

**Hover target values:**
- `color` → `0x2980b9` (brighter blue)
- `emissive` → `0x4fc3f7` (bright cyan glow)
- `emissiveIntensity` → `0.6`

---

## 4. Scene Setup

### Camera
- `PerspectiveCamera`, FOV 50, position `(0, 0, 8)`, near `0.1`, far `100`

### Lighting (3-point + ambient)
1. **Key:** `DirectionalLight` — `#ffffff`, intensity `1.5`, pos `(5, 5, 5)`
2. **Fill:** `DirectionalLight` — `#4a90d9`, intensity `0.6`, pos `(-3, 2, -2)`
3. **Rim:** `PointLight` — `#ff6b35`, intensity `0.8`, pos `(0, -3, 5)`
4. **Ambient:** `AmbientLight` — `#1a1a2e`, intensity `0.3`

### Renderer

```js
const renderer = new THREE.WebGLRenderer({
  canvas: canvasElement,
  antialias: window.devicePixelRatio < 2,  // One-time context flag
  alpha: false,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x0a0a1a);
```

### Post-Processing Pipeline

```
EffectComposer
  └── RenderPass
  └── UnrealBloomPass (strength: 0.8, radius: 0.4, threshold: 0.6)
  └── OutputPass
```

### Background
Dark gradient via CSS on `<body>` (zero GPU cost). Canvas uses opaque clear color `#0a0a1a`.

---

## 5. Animation System

### Two States with Easing

```
IDLE ←→ HOVERING (smooth exponential decay easing handles all transitions)
```

Speeds:
- IDLE: `0.3 rad/s` (slow, elegant)
- HOVERING: `1.8 rad/s` (~6x faster, noticeable)

### Easing Formula (frame-rate independent)

```js
currentSpeed += (targetSpeed - currentSpeed) * (1 - Math.exp(-easeFactor * deltaTime));
// easeFactor = 3.0
```

### Entrance Animation

On load, scale logo from `0` to `1` with ease-out over 1 second:
```js
// In animation controller
if (entranceProgress < 1) {
  entranceProgress = Math.min(1, entranceProgress + deltaTime);
  const t = 1 - Math.pow(1 - entranceProgress, 3); // ease-out cubic
  logoMesh.scale.setScalar(t);
}
```

### Y-Axis Bobbing

```js
logoMesh.position.y = Math.sin(elapsed * 0.5) * 0.1;
```

### Mouse-Reactive Tilt (Parallax)

Subtle 5-10° lean toward cursor:
```js
const targetRotX = (normalizedMouseY - 0.5) * 0.15; // ~8.5 degrees max
const targetRotZ = (normalizedMouseX - 0.5) * -0.1;
logoMesh.rotation.x += (targetRotX - logoMesh.rotation.x) * (1 - Math.exp(-2 * dt));
logoMesh.rotation.z += (targetRotZ - logoMesh.rotation.z) * (1 - Math.exp(-2 * dt));
```

### Animation Loop

```js
let lastTime = 0;

function animate(timestamp) {
  if (isPaused) { requestAnimationFrame(animate); return; }

  const deltaTime = Math.min((timestamp - lastTime) / 1000, 0.1); // Cap at 100ms
  lastTime = timestamp;

  animationController.update(deltaTime);
  logoMesh.rotation.y += animationController.currentSpeed * deltaTime;
  particleSystem.update(deltaTime);
  composer.render();

  requestAnimationFrame(animate);
}
```

### Visibility Handling

```js
document.addEventListener('visibilitychange', () => {
  isPaused = document.hidden;
  if (!document.hidden) lastTime = performance.now(); // Reset delta
});
```

### `createAnimationLoop(deps)` Parameter Shape

```js
/**
 * @param {Object} deps
 * @param {THREE.Mesh} deps.logoMesh
 * @param {AnimationController} deps.animationController
 * @param {ParticleSystem} deps.particleSystem
 * @param {EffectComposer} deps.composer
 * @param {InteractionManager} deps.interaction
 */
```

---

## 6. Interaction System

### Raycaster Hover Detection

Single mesh — raycasting every frame is trivially cheap.

```js
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// In animation loop:
raycaster.setFromCamera(pointer, camera);
const intersects = raycaster.intersectObject(logoMesh);
const isHovered = intersects.length > 0;
animationController.setHovered(isHovered);
```

### Events
- `pointermove` on canvas — update pointer + parallax coordinates
- `touchstart` / `touchmove` — map first touch to pointer for hover simulation
- `touchend` — reset to idle
- Cursor: set via JavaScript (`canvas.style.cursor`) on raycast hit, not CSS `:hover`

---

## 7. Visual Effects

### 7a. Bloom (UnrealBloomPass)
- `strength: 0.8`, `radius: 0.4`, `threshold: 0.6`
- Driven by logo's `emissive` color
- On hover: increase `emissiveIntensity` from `0.3` → `0.6`

### 7b. Floating Particles

| Parameter | Value |
|---|---|
| Count | 300 (reduce to 150 on low-quality tier) |
| Distribution | Spherical shell, radius 4-6 units from origin |
| Size | `0.03` units, with `sizeAttenuation: true` |
| Opacity | `0.6`, transparent |
| Motion | Sine drift: frequency `0.3`, amplitude `0.5` units |
| Hover response | Drift speed 2x, spread outward by 20% |

Implementation: `THREE.Points` + `BufferGeometry` with position attribute updates each frame.

### 7c. Hover Color Shift

- Base: `color: #1a5276`, `emissive: #0a2a3f`, `emissiveIntensity: 0.3`
- Hover: `color: #2980b9`, `emissive: #4fc3f7`, `emissiveIntensity: 0.6`
- Same exponential decay easing as rotation system

---

## 8. Performance Strategy

| Optimization | Implementation |
|---|---|
| Pixel ratio cap | `Math.min(devicePixelRatio, 2)` |
| Conditional antialias | `antialias: devicePixelRatio < 2` at construction |
| Delta-time animation | All motion uses `deltaTime` |
| Delta-time cap | `Math.min(deltaTime, 0.1)` |
| Visibility pause | Stop rendering when tab hidden |
| CSS background | Gradient on `<body>`, not Three.js |
| Draw call budget | <5 (1 mesh + 1 Points + post-processing) |
| Disposal | `renderer.dispose()`, `composer.dispose()`, geometry, materials |
| Adaptive quality | 3-tier system based on GPU capability |

### Adaptive Quality Tiers

```js
function getQualityTier(renderer) {
  const gl = renderer.getContext();
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
  const cores = navigator.hardwareConcurrency || 4;
  const isMobileGPU = /Mali|Adreno|PowerVR|Apple GPU/i.test(gpu);
  const isHoverDevice = window.matchMedia('(hover: hover)').matches;

  if (cores <= 4 && isMobileGPU) return 'low';    // No bloom, 150 particles
  if (cores <= 4 || isMobileGPU) return 'medium';  // Bloom, 200 particles
  return 'high';                                     // Full effects, 300 particles
}
```

---

## 9. RWD & Mobile

### Responsive Canvas

```js
function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  composer.setSize(width, height); // Propagates to all passes automatically
}
// Debounced at 150ms with leading edge
```

### Mobile Touch
- Bind touch events unconditionally (pointer events unify most cases)
- Touch maps to hover simulation; touchend resets idle
- `touch-action: none` on canvas to prevent scroll interference

### Aspect Ratio
- Portrait: camera pulls back slightly (increase Z) to fit logo
- Landscape: standard view

---

## 10. Error Handling

### Import Map Feature Detection (in `index.html`, before import map)

```html
<script>
  if (!HTMLScriptElement.supports || !HTMLScriptElement.supports('importmap')) {
    document.getElementById('fallback').style.display = 'flex';
    document.getElementById('three-canvas').style.display = 'none';
  }
</script>
```

### WebGL Detection
```js
function checkWebGLSupport() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}
```

### Font Loading — CDN Fallback Chain

```js
async function loadFont() {
  const loader = new FontLoader();
  try {
    return await loader.loadAsync('./assets/fonts/helvetiker_bold.typeface.json');
  } catch (localErr) {
    console.warn('Local font failed, trying CDN:', localErr);
    return await loader.loadAsync(
      'https://cdn.jsdelivr.net/npm/three@0.182.0/examples/fonts/helvetiker_bold.typeface.json'
    );
  }
}
```

### Loading State
- Branded overlay: pulsing "M" in CSS (not generic spinner)
- Timeout: **15 seconds** (accommodates slow mobile)
- Fade out on scene ready

### Runtime Error Boundary
- `try/catch` around init and animation loop
- On failure: stop loop, show CSS fallback, log error

---

## 11. File-by-File Implementation Order

### Step 0: Project Init

**Files:** `package.json`

```json
{
  "name": "threejs-3d-logo-demo",
  "version": "1.0.0",
  "description": "Interactive 3D Logo with Three.js — Pacston Demo",
  "scripts": { "start": "npx serve ." },
  "private": true
}
```

Font acquisition:
```bash
mkdir -p assets/fonts
curl -o assets/fonts/helvetiker_bold.typeface.json \
  https://cdn.jsdelivr.net/npm/three@0.182.0/examples/fonts/helvetiker_bold.typeface.json
```

---

### Step 1: HTML Entry Point

**File:** `index.html`

- HTML5 boilerplate with `<meta name="viewport">`
- `<title>Pacston 3D Logo</title>` + favicon (data URI)
- Import map feature detection snippet (before import map)
- Import map for Three.js r182
- `<canvas id="three-canvas" role="img" aria-label="Interactive 3D rotating M logo">`
- Loading overlay div (branded pulsing M)
- WebGL fallback div (hidden by default)
- `<script type="module" src="js/main.js">`

**AC:** Page loads, canvas fills viewport, import map resolves correctly.

---

### Step 2: Styles

**File:** `css/styles.css`

- CSS reset, full-viewport canvas, no scrollbars
- Dark gradient background
- Loading overlay: centered pulsing "M" animation
- Fallback message styles
- `touch-action: none` on canvas

**AC:** Canvas fills viewport, gradient visible, loading overlay centered.

---

### Step 3: Utilities

**File:** `js/utils.js`

- `checkWebGLSupport()`
- `showFallback()` / `hideLoading()`
- `debounce(fn, delay)` with leading edge
- `dispose(object)` — recursive, includes `renderer.dispose()` + `composer.dispose()`
- `getQualityTier(renderer)` — adaptive 3-tier system
- `isMobile()` — `matchMedia('(hover: none)')` based

**AC:** WebGL detection works, quality tier returns correct value, disposal cleans up.

---

### Step 4: Scene Setup

**File:** `js/scene.js`

- Export `createScene(canvas)` → `{ scene, camera, renderer, composer }`
- PerspectiveCamera at (0, 0, 8), FOV 50
- WebGLRenderer with all performance settings
- 3-point lighting + ambient
- EffectComposer → RenderPass → UnrealBloomPass → OutputPass
- Quality-tier-aware: skip bloom on `low` tier

**AC:** Empty scene renders dark background, bloom pipeline active.

---

### Step 5: 3D Logo

**File:** `js/logo.js`

- Export `createLogo(scene)` async → returns mesh
- Font loading with CDN fallback chain
- TextGeometry "M" with bevel, centered
- MeshStandardMaterial with metallic finish
- Handle font loading errors gracefully

**AC:** "M" renders centered, metallic appearance, fallback on font failure.

---

### Step 6: Animation System

**File:** `js/animation.js`

- Export `AnimationController` class
  - `currentSpeed`, `targetSpeed`, `idleSpeed: 0.3`, `hoverSpeed: 1.8`
  - `easeFactor: 3.0`
  - `setHovered(bool)` — sets target speed
  - `update(deltaTime)` — exponential decay interpolation
  - Entrance animation: scale `0→1` ease-out cubic, 1 second
  - Bobbing: `sin(elapsed * 0.5) * 0.1`
- Export `createAnimationLoop(deps)` with defined param shape:
  - `{ logoMesh, animationController, particleSystem, composer, interaction }`
- Visibility handling (pause on hidden tab)

**AC:** Logo rotates slowly, frame-rate independent, no jump on tab resume, entrance animation plays on load.

---

### Step 7: Interaction System

**File:** `js/interaction.js`

- Export `InteractionManager` class
- Raycaster + pointer tracking
- `pointermove` on canvas
- Touch events: `touchstart`, `touchmove`, `touchend`
- Per-frame `update()`: raycast → `animationController.setHovered()`
- Mouse-reactive tilt: subtle 5-10° lean toward cursor
- Cursor management via JavaScript (`canvas.style.cursor`)
- Normalized mouse position for parallax

**AC:** Hover speeds up rotation smoothly, leave slows down smoothly, tilt responds to mouse, touch works on mobile.

---

### Step 8: Visual Effects

**File:** `js/effects.js`

- Export `createParticleSystem(scene, quality)` → `ParticleSystem`
  - Particle count: 300 (high), 200 (medium), 150 (low)
  - Spherical shell radius 4-6 units
  - Size `0.03`, opacity `0.6`
  - Sine drift: freq `0.3`, amplitude `0.5`
- `ParticleSystem.update(deltaTime, isHovered)` — drift 2x on hover
- `updateMaterialOnHover(material, isHovered, deltaTime)`
  - Lerp color `#1a5276` ↔ `#2980b9`
  - Lerp emissive `#0a2a3f` ↔ `#4fc3f7`
  - Lerp emissiveIntensity `0.3` ↔ `0.6`

**AC:** Particles float gently, respond to hover, bloom makes logo glow, color shifts smoothly.

---

### Step 9: Main Bootstrap

**File:** `js/main.js`

- Import all modules
- WebGL check → fallback if unsupported
- Show loading overlay
- Determine quality tier
- `await createLogo(scene)` with error handling
- Wire all systems together
- Debounced resize handler (updates camera, renderer, composer)
- Hide loading overlay
- Start animation loop
- Error boundary: try/catch, show fallback on failure, 15s timeout

**AC:** Full demo loads and runs, all systems integrated, resize works, fallback on error.

---

### Step 10: Technical Documentation

**File:** `docs/TECHNICAL.md`

Sections:
1. Architecture Overview (module diagram, data flow)
2. Technology Choices (Three.js, CDN, import maps, TextGeometry)
3. Animation System (delta-time, exponential decay easing, entrance, bobbing)
4. Interaction Design (raycaster, pointer events, parallax, mobile touch)
5. Visual Effects (bloom pipeline, particles, color shifts)
6. Performance Optimizations (pixel ratio, quality tiers, visibility, disposal)
7. Responsive Design (resize, adaptive quality, aspect ratio)
8. Error Handling (WebGL detection, font fallback, import map detection)
9. Browser Compatibility (Chrome 89+, Firefox 108+, Safari 16.4+)
10. Running Locally (`npx serve .`)
11. Future Improvements

**AC:** Covers all 4 required areas: architecture, animation logic, performance, library choices.

---

## 12. Success Criteria

1. Page loads in under 3 seconds on broadband
2. 60fps on desktop, 30fps minimum on mobile
3. Smooth hover transition — no perceptible jump
4. Visually impressive — metallic + bloom + particles + parallax
5. Zero console errors
6. Responsive from 320px to 4K
7. Graceful degradation (CSS fallback if WebGL unavailable)
8. Each module under 150 lines, clear naming
9. Technical documentation covers all required areas
10. Entrance animation creates polished first impression

---

## 13. Guardrails

### Must Have
- 3D "M" letter, centered, auto-rotating
- Smooth hover speed-up / slow-down (exponential decay easing)
- Delta-time animation (frame-rate independent)
- Responsive canvas
- Loading state + error fallback
- Clean module structure

### Must NOT Have
- No bundlers (pure ES modules + CDN)
- No UI frameworks
- No npm production dependencies
- No OrbitControls (auto-rotate only, no user camera control)
- No over-engineering
