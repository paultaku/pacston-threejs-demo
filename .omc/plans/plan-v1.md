# Three.js 3D "M" Logo Interactive Demo -- Implementation Plan v1

**Created:** 2026-02-13
**Status:** DRAFT -- Pending Architect + Critic Review
**Estimated Complexity:** MEDIUM
**Estimated Files:** 8-10 files

---

## 1. Project Structure

```
threeJS-demo/
├── index.html                  # Entry point, import map, canvas host
├── css/
│   └── styles.css              # Layout, loading overlay, fallback styles
├── js/
│   ├── main.js                 # Bootstrap: init scene, start loop, bind events
│   ├── scene.js                # Scene, camera, renderer, lighting setup
│   ├── logo.js                 # "M" letter 3D geometry creation + materials
│   ├── animation.js            # Rotation controller, easing system, delta-time loop
│   ├── interaction.js          # Raycaster hover detection, mouse/touch handlers
│   ├── effects.js              # Particles, bloom post-processing, glow
│   └── utils.js                # WebGL detection, resize handler, disposal helpers
├── assets/
│   └── fonts/
│       └── helvetiker_bold.typeface.json  # Three.js-compatible font (bundled)
└── docs/
    └── TECHNICAL.md            # Architecture, animation logic, performance notes
```

**Rationale:** Flat module structure (no bundler required). Each file is a single-responsibility ES module. The project runs from a local dev server or any static file host with zero build step.

---

## 2. Technology Stack

| Technology | Choice | Rationale |
|---|---|---|
| **Three.js** | r182 (v0.182.0) via jsDelivr CDN | Latest stable; CDN avoids build tooling |
| **Module System** | ES Modules + `<script type="importmap">` | Native browser support, no bundler needed |
| **CDN** | jsDelivr (`cdn.jsdelivr.net/npm/three@0.182.0/`) | Reliable, fast, supports `three/addons/` path |
| **Font** | Helvetiker Bold typeface JSON (bundled locally) | Avoids external font dependency; ships with Three.js examples |
| **Dev Server** | Any static server (`npx serve .` or VS Code Live Server) | Zero config |
| **No frameworks** | Vanilla JS only | Requirement: plain JavaScript + Three.js |

### Import Map Configuration

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

### Addons Required

- `FontLoader` -- from `three/addons/loaders/FontLoader.js`
- `TextGeometry` -- from `three/addons/geometries/TextGeometry.js`
- `EffectComposer` -- from `three/addons/postprocessing/EffectComposer.js`
- `RenderPass` -- from `three/addons/postprocessing/RenderPass.js`
- `UnrealBloomPass` -- from `three/addons/postprocessing/UnrealBloomPass.js`
- `OutputPass` -- from `three/addons/postprocessing/OutputPass.js`

---

## 3. 3D Model Strategy -- TextGeometry Approach

### Why TextGeometry (not ExtrudeGeometry from SVG, not GLTF)

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **TextGeometry + FontLoader** | Native Three.js; parametric control over depth, bevel; no external modeling tool | Requires JSON font file; limited to supported fonts | **CHOSEN** -- best balance of control and simplicity |
| ExtrudeGeometry from SVG path | Pixel-perfect custom shapes | Requires manual SVG path definition; more complex setup | Overkill for a single letter |
| Pre-built GLTF model | Maximum visual fidelity | Requires Blender/external tool; adds loading complexity | Over-engineered for this scope |

### TextGeometry Configuration

```js
const geometry = new TextGeometry('M', {
  font: loadedFont,
  size: 3,              // World units
  depth: 0.8,           // Extrusion depth (formerly "height" in older versions)
  curveSegments: 12,    // Smoothness of front-face curves
  bevelEnabled: true,
  bevelThickness: 0.08,
  bevelSize: 0.05,
  bevelOffset: 0,
  bevelSegments: 5
});
// Center the geometry on origin
geometry.computeBoundingBox();
geometry.center();
```

### Material Strategy

Use `MeshStandardMaterial` with the following properties:
- Metallic finish (`metalness: 0.7`, `roughness: 0.25`) for a premium look
- A rich color (deep blue `#1a5276` or gradient via vertex colors)
- `emissive` property for subtle self-illumination that enhances the bloom effect
- Optional: `envMap` from a simple CubeTexture for reflections (stretch goal)

---

## 4. Scene Setup

### Camera

- **Type:** `PerspectiveCamera`
- **FOV:** 50 degrees (natural perspective, not too wide)
- **Position:** `(0, 0, 8)` -- looking at origin
- **Near/Far:** `0.1` / `100` (tight frustum for culling)

### Lighting (3-point setup)

1. **Key Light:** `DirectionalLight` -- color `#ffffff`, intensity `1.5`, position `(5, 5, 5)`
2. **Fill Light:** `DirectionalLight` -- color `#4a90d9`, intensity `0.6`, position `(-3, 2, -2)`
3. **Rim Light:** `PointLight` -- color `#ff6b35`, intensity `0.8`, position `(0, -3, 5)` (warm accent from below/behind)
4. **Ambient:** `AmbientLight` -- color `#1a1a2e`, intensity `0.3` (prevents pure black shadows)

### Renderer

```js
const renderer = new THREE.WebGLRenderer({
  canvas: canvasElement,
  antialias: true,
  alpha: false,           // Opaque background (better performance)
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;  // Required for bloom
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
```

### Background

Dark gradient background via CSS on the `<body>` (cheaper than a Three.js background plane). The canvas uses `alpha: false` with `renderer.setClearColor('#0a0a1a')` for a deep dark blue.

---

## 5. Animation System

### Core Architecture: Delta-Time Rotation Controller

The animation system is built around a single `AnimationController` class that manages rotation state using delta-time for frame-rate independence.

```
State Machine:
  IDLE  ──(mouseenter)──>  HOVER_IN  ──(settled)──>  HOVERING
  HOVERING ──(mouseleave)──> HOVER_OUT ──(settled)──> IDLE

Rotation speeds:
  IDLE:      0.3 rad/s  (slow, elegant)
  HOVERING:  1.8 rad/s  (noticeably faster, ~6x)
```

### Easing Strategy -- Smooth Interpolation via Exponential Decay

Instead of tweening libraries, use exponential interpolation (lerp) each frame:

```js
// Each frame:
currentSpeed += (targetSpeed - currentSpeed) * (1 - Math.exp(-easeFactor * deltaTime));
```

- `easeFactor = 3.0` -- controls transition speed (higher = snappier)
- This produces smooth, natural-feeling acceleration and deceleration
- Frame-rate independent (uses `deltaTime`)
- No sudden jumps -- asymptotic approach to target

### Animation Loop

```js
let lastTime = 0;

function animate(timestamp) {
  const deltaTime = Math.min((timestamp - lastTime) / 1000, 0.1); // Cap at 100ms to prevent spiral
  lastTime = timestamp;

  // Update rotation speed (easing)
  animationController.update(deltaTime);

  // Apply rotation
  logoMesh.rotation.y += animationController.currentSpeed * deltaTime;

  // Update particles
  particleSystem.update(deltaTime);

  // Render (via EffectComposer for post-processing)
  composer.render();

  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
```

**Key detail:** The delta-time cap at `0.1s` prevents the "tab-away spiral" where returning to a backgrounded tab causes a massive time jump.

---

## 6. Interaction System

### Hover Detection via Raycaster

The scene has exactly 1 mesh (the "M" logo), so raycasting is trivially cheap. No BVH or spatial partitioning needed.

```js
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function onPointerMove(event) {
  // Normalize to [-1, 1]
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

// In animation loop (every frame is fine for 1 object):
raycaster.setFromCamera(pointer, camera);
const intersects = raycaster.intersectObject(logoMesh);
const isHovered = intersects.length > 0;
animationController.setHovered(isHovered);
```

### Mouse Events

- `pointermove` on the canvas -- update pointer coordinates
- No click handling needed (hover only)
- Use `pointer` events (not `mouse`) for unified mouse + pen + touch support

### Touch / Mobile Gesture Support

- `touchstart` / `touchmove` -- map first touch to pointer coordinates for hover simulation
- `touchend` -- trigger "unhover" (since touch has no persistent hover state)
- Optional stretch goal: pinch-to-zoom via touch distance tracking, or swipe to manually rotate

### Optimization

- Throttle raycasting is NOT needed here (single object). Performing it every frame is negligible cost.
- Use `raycaster.near` and `raycaster.far` to limit ray distance.

---

## 7. Visual Effects (Bonus Features)

### 7a. Bloom / Glow Effect (UnrealBloomPass)

Post-processing pipeline:

```
EffectComposer
  └── RenderPass (renders scene normally)
  └── UnrealBloomPass (adds glow to bright areas)
  └── OutputPass (final color correction)
```

Configuration:
- `strength: 0.8` (subtle glow, not overwhelming)
- `radius: 0.4` (spread of the glow)
- `threshold: 0.6` (only bright parts bloom)

The logo's `emissive` color drives what glows. On hover, increase `emissive` intensity slightly for a "power up" feel.

### 7b. Floating Particle System

Ambient floating particles around the logo for visual depth:

- **Implementation:** `THREE.Points` with `BufferGeometry`
- **Count:** 200-400 particles (low GPU cost)
- **Shape:** Distributed in a sphere/torus around the logo
- **Motion:** Slow drift using sine waves on position attributes (GPU-friendly: update positions in the animation loop via `BufferAttribute.needsUpdate`)
- **Material:** `PointsMaterial` with small size (`0.03`), transparency, and a soft circular texture (or `alphaMap`)
- **On hover:** particles drift faster / spread outward slightly

### 7c. Subtle Color Shift on Hover

- On hover: lerp the logo's material color toward a warmer/brighter tone
- On leave: lerp back to the base color
- Same exponential decay easing as the rotation system

---

## 8. Performance Strategy

### Rendering Optimizations

| Optimization | Implementation | Impact |
|---|---|---|
| Pixel ratio cap | `Math.min(devicePixelRatio, 2)` | Prevents 3x/4x rendering on high-DPI mobile |
| Frustum culling | Enabled by default; tight near/far planes | Minimal (single object) but good practice |
| Geometry disposal | `dispose()` on geometry, material, textures in cleanup | Prevents memory leaks |
| Delta-time animation | All motion uses `deltaTime` | Frame-rate independent; no speed drift |
| Delta-time cap | `Math.min(deltaTime, 0.1)` | Prevents physics explosion on tab resume |
| Antialias | Only when `devicePixelRatio < 2` | AA is redundant on high-DPI; saves fill rate |
| Tone mapping | `ACESFilmicToneMapping` | Needed for bloom; minimal cost |
| Background | CSS gradient (not Three.js plane) | Zero GPU cost for background |
| Object count | 1 mesh + 1 Points system | Trivially low draw call count (<5) |

### Performance Monitoring (Development Only)

- Include optional `Stats.js` panel (Three.js addon) behind a `?debug` query param
- Log FPS drops to console if they persist below 30fps

### Target Performance

- **Desktop:** Solid 60fps
- **Mobile:** Solid 30fps minimum, target 60fps
- **Low-end devices:** Graceful degradation (disable bloom, reduce particles)

---

## 9. RWD and Mobile Support

### Responsive Canvas

```js
function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  composer.setSize(width, height); // Post-processing must also resize

  // Adjust bloom resolution
  bloomPass.resolution.set(width, height);
}

window.addEventListener('resize', onResize);
```

### Debounce Strategy

- Debounce resize handler at 150ms to prevent thrashing during drag-resize
- Immediate first call (leading edge) so the canvas is never visually broken

### Mobile-Specific Adjustments

- Detect mobile via `'ontouchstart' in window` or `navigator.maxTouchPoints > 0`
- On mobile: reduce particle count by 50%, disable bloom if GPU is slow
- Touch events: map touch position to pointer for hover simulation
- Prevent default on `touchmove` to avoid page scroll when interacting with canvas
- `<meta name="viewport" content="width=device-width, initial-scale=1.0">` in HTML

### Aspect Ratio Handling

- Portrait mode: scale logo slightly smaller so it fits
- Landscape mode: standard view
- Adjust camera FOV or position based on aspect ratio if needed

---

## 10. Error Handling

### WebGL Detection

```js
function checkWebGLSupport() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) throw new Error('WebGL not available');
    return true;
  } catch (e) {
    return false;
  }
}
```

### Fallback Strategy

If WebGL is not available:
1. Hide the canvas element
2. Show a static fallback: CSS-styled "M" letter with a gradient background
3. Display a message: "Your browser does not support WebGL. Please use a modern browser."

### Font Loading Error Handling

```js
try {
  const font = await fontLoader.loadAsync('./assets/fonts/helvetiker_bold.typeface.json');
  // proceed
} catch (error) {
  console.error('Font loading failed:', error);
  // Fallback: use a simple BoxGeometry shaped like an "M" via merged boxes
  // Or show the CSS fallback
}
```

### Loading State

- Show a loading overlay (CSS spinner or animated text) while the font loads
- Fade it out once the scene is ready and first frame is rendered
- Timeout after 10 seconds -- show error message if assets fail to load

### Runtime Error Boundary

- Wrap the animation loop in a try/catch
- On error: stop the loop, show fallback, log error details
- Never let a Three.js error crash the page silently

---

## 11. File-by-File Implementation Order

### Step 1: Project Scaffold + HTML Entry Point

**File:** `index.html`

**Work:**
- HTML5 boilerplate with viewport meta tag
- Import map for Three.js r182 via jsDelivr
- `<canvas id="three-canvas">` element
- Loading overlay div
- WebGL fallback div (hidden by default)
- Link to `css/styles.css`
- `<script type="module" src="js/main.js">`

**Acceptance Criteria:**
- Page loads without errors in browser console
- Canvas element is visible and fills the viewport
- Import map resolves `three` and `three/addons/` correctly (verified by a test import in main.js)

---

### Step 2: Base Styles

**File:** `css/styles.css`

**Work:**
- CSS reset (margin, padding, box-sizing)
- Full-viewport canvas styling (no scrollbars)
- Dark gradient background on body
- Loading overlay styles (centered spinner, semi-transparent backdrop)
- Fallback message styles
- `cursor: pointer` on canvas when hovering is active

**Acceptance Criteria:**
- Canvas fills entire viewport with no scrollbars
- Background gradient is visible
- Loading overlay displays centered on page

---

### Step 3: Utilities Module

**File:** `js/utils.js`

**Work:**
- `checkWebGLSupport()` function
- `showFallback()` function (hides canvas, shows fallback div)
- `hideLoading()` function (fades out loading overlay)
- `showLoading()` function
- `debounce(fn, delay)` utility
- `dispose(object)` recursive disposal helper for Three.js objects
- `isMobile()` detection helper

**Acceptance Criteria:**
- WebGL detection correctly identifies support/no-support
- Fallback UI shows/hides correctly
- Loading overlay fades out smoothly

---

### Step 4: Scene Setup

**File:** `js/scene.js`

**Work:**
- Export `createScene()` function returning `{ scene, camera, renderer, composer }`
- PerspectiveCamera at (0, 0, 8), FOV 50
- WebGLRenderer with performance settings (pixel ratio cap, tone mapping, color space)
- 3-point lighting setup (key, fill, rim, ambient)
- EffectComposer with RenderPass + UnrealBloomPass + OutputPass
- Clear color: `#0a0a1a`

**Acceptance Criteria:**
- Empty scene renders without errors (dark background visible)
- Bloom post-processing pipeline is active (can be verified by adding a test emissive sphere)
- Renderer size matches viewport

---

### Step 5: 3D Logo Creation

**File:** `js/logo.js`

**Work:**
- Export `createLogo(scene)` async function
- Load Helvetiker Bold font via `FontLoader.loadAsync()`
- Create `TextGeometry` for letter "M" with bevel
- Center geometry on origin via `geometry.center()`
- Apply `MeshStandardMaterial` with metalness, roughness, emissive
- Add mesh to scene
- Return the mesh reference for interaction/animation use

**File:** `assets/fonts/helvetiker_bold.typeface.json`
- Download from Three.js examples repository and bundle locally

**Acceptance Criteria:**
- "M" letter renders centered on screen
- Material has a metallic/reflective appearance
- Font loads without errors; fallback triggers if font fails
- Geometry is properly centered (rotation around center, not corner)

---

### Step 6: Animation System

**File:** `js/animation.js`

**Work:**
- Export `AnimationController` class
- Properties: `currentSpeed`, `targetSpeed`, `idleSpeed`, `hoverSpeed`, `easeFactor`
- `setHovered(bool)` method -- sets `targetSpeed` based on hover state
- `update(deltaTime)` method -- applies exponential decay interpolation
- `getCurrentSpeed()` getter
- Export `createAnimationLoop(deps)` that sets up `requestAnimationFrame` with delta-time tracking and delta cap

**Acceptance Criteria:**
- Logo rotates slowly around Y-axis at idle speed
- Rotation is smooth and frame-rate independent (test by throttling to 30fps in DevTools)
- Delta-time cap prevents jump when returning from a backgrounded tab
- Animation runs at consistent speed regardless of monitor refresh rate

---

### Step 7: Interaction System

**File:** `js/interaction.js`

**Work:**
- Export `InteractionManager` class
- Initialize `Raycaster` and `Vector2` for pointer
- Bind `pointermove` event on canvas
- Bind `touchstart`, `touchmove`, `touchend` events for mobile
- Per-frame `update()` method: perform raycast, call `animationController.setHovered()`
- Cursor style management (pointer on hover, default otherwise)

**Acceptance Criteria:**
- Hovering mouse over the "M" triggers speed increase
- Moving mouse away triggers smooth return to idle speed
- Transition is smooth in both directions (no sudden jumps)
- Touch on mobile simulates hover correctly
- Touch end resets to idle state
- Cursor changes to pointer when over the logo

---

### Step 8: Visual Effects

**File:** `js/effects.js`

**Work:**
- Export `createParticleSystem(scene)` function
  - 300 particles in a spherical distribution around origin
  - `PointsMaterial` with transparency, small size, soft alpha
  - Slow sine-wave drift animation
- Export `ParticleSystem` class with `update(deltaTime, isHovered)` method
  - Particles drift faster when hovered
- Export `updateMaterialOnHover(material, isHovered, deltaTime)` helper
  - Lerp emissive intensity and color on hover transitions

**Acceptance Criteria:**
- Particles float gently around the logo
- Particles respond to hover state (drift faster / spread)
- Bloom effect makes the logo glow subtly
- Emissive intensity increases on hover, decreases on leave
- Particles do not cause noticeable FPS drop (< 2fps impact)

---

### Step 9: Main Bootstrap + Integration

**File:** `js/main.js`

**Work:**
- Import all modules
- WebGL check -- show fallback if unsupported
- Show loading overlay
- `await createLogo()` to load font and build geometry
- Set up scene, animation controller, interaction manager, particle system
- Wire resize handler (debounced) updating camera, renderer, composer
- Hide loading overlay
- Start animation loop
- Error boundary: try/catch around init, show fallback on failure

**Acceptance Criteria:**
- Full demo loads and runs without console errors
- Loading overlay shows during font load, then fades out
- All systems work together: rotation + hover interaction + particles + bloom
- Resize works correctly (no distortion, no performance issues)
- WebGL fallback displays correctly when WebGL is disabled
- Mobile touch interaction works

---

### Step 10: Technical Documentation

**File:** `docs/TECHNICAL.md`

**Work:**
- Architecture overview with module dependency diagram
- Animation logic explanation (exponential decay easing, delta-time)
- Performance considerations and optimizations applied
- Library choice rationale (Three.js, CDN, no bundler)
- Browser compatibility notes
- How to run locally
- Known limitations and potential improvements

**Acceptance Criteria:**
- Document covers all four required areas: architecture, animation logic, performance, library choices
- Includes code snippets for key algorithms (easing formula, delta-time loop)
- Readable by a developer unfamiliar with the project

---

## 12. Technical Documentation Outline

```
docs/TECHNICAL.md

# Three.js 3D "M" Logo -- Technical Documentation

## 1. Architecture Overview
   - Module dependency diagram (ASCII)
   - Data flow: main.js orchestrates, modules communicate via shared references
   - No global state; all state lives in controller classes

## 2. Technology Choices
   - Why Three.js (industry standard, well-documented, performant)
   - Why CDN + import maps (zero build step, modern browser native)
   - Why TextGeometry over GLTF or SVG extrusion
   - Why no React/Vue/framework (requirement + simplicity)

## 3. Animation System
   - Delta-time based rotation (frame-rate independence)
   - Exponential decay easing formula: derivation and tuning
   - State machine: IDLE -> HOVER_IN -> HOVERING -> HOVER_OUT -> IDLE
   - Why not a tweening library (overhead for a single interpolation)

## 4. Interaction Design
   - Raycaster approach for hover detection
   - Pointer events for unified mouse/pen/touch
   - Mobile touch simulation of hover

## 5. Visual Effects Pipeline
   - EffectComposer post-processing chain
   - UnrealBloomPass configuration and tuning
   - Particle system architecture (BufferGeometry + Points)
   - Hover-reactive material transitions

## 6. Performance Optimizations
   - Pixel ratio capping strategy
   - Delta-time cap for backgrounded tabs
   - Conditional antialias based on device pixel ratio
   - Geometry disposal and memory management
   - Draw call budget (<5 calls)
   - CSS background vs Three.js background plane

## 7. Responsive Design
   - Resize handler with debounce
   - Mobile detection and graceful degradation
   - Aspect ratio handling

## 8. Error Handling
   - WebGL detection and CSS fallback
   - Font loading failure recovery
   - Runtime error boundary

## 9. Browser Compatibility
   - Supported: Chrome 90+, Firefox 90+, Safari 15+, Edge 90+
   - Import maps: supported in all modern browsers
   - WebGL2: supported in all modern browsers; WebGL1 fallback

## 10. Running Locally
   - Prerequisites: any static file server
   - Commands: `npx serve .` or VS Code Live Server
   - No build step, no npm install for production

## 11. Future Improvements
   - WebGPU renderer migration path
   - Custom shaders for advanced material effects
   - OrbitControls for user-driven rotation
   - Environment map reflections
   - Dynamic text (user types their own letter)
```

---

## 13. Guardrails

### Must Have
- Single "M" letter, 3D, centered, auto-rotating
- Smooth hover speed-up and smooth return to idle
- Delta-time animation (frame-rate independent)
- Responsive canvas that handles resize
- Loading state and error fallback
- Clean module structure (no single 500-line file)

### Must NOT Have
- No build tools / bundlers (Webpack, Vite, Rollup) -- pure ES modules + CDN
- No UI frameworks (React, Vue, Svelte)
- No npm dependencies in production (CDN only)
- No OrbitControls (the logo auto-rotates; user does not control camera)
- No over-engineering (no state management library, no ECS pattern)
- No external font CDN calls -- font file must be bundled locally

---

## 14. Success Criteria

1. **Page loads in under 3 seconds** on a standard broadband connection
2. **60fps on desktop**, 30fps minimum on mobile
3. **Smooth hover transition** -- no perceptible jump or stutter when entering/leaving hover
4. **Visually impressive** -- metallic material + bloom + particles create a polished, professional look
5. **Zero console errors** in production
6. **Responsive** -- works from 320px mobile to 4K desktop without distortion
7. **Graceful degradation** -- shows CSS fallback if WebGL unavailable
8. **Code quality** -- each module under 150 lines, clear naming, JSDoc comments on public functions
9. **Documentation complete** -- all four required areas covered with sufficient detail

---

## References

- [Three.js CDN on jsDelivr](https://www.jsdelivr.com/package/npm/three)
- [Three.js Import Maps Tutorial](https://sbcode.net/threejs/importmap/)
- [TextGeometry Best Practices](https://threejs-journey.com/lessons/3d-text)
- [UnrealBloomPass Source](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/postprocessing/UnrealBloomPass.js)
- [Three.js Particle Performance](https://medium.com/@joshmarinacci/threejs-particles-faster-88171a03c3d1)
- [Raycaster Best Practices 2026](https://copyprogramming.com/howto/what-is-three-js-raycaster-exactly-doing)
- [100 Three.js Performance Tips (2026)](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
- [Three.js 2026 Changes: WebGPU and Beyond](https://www.utsubo.com/blog/threejs-2026-what-changed)
