# Three.js 3D "M" Logo — Technical Documentation

## 1. Architecture Overview

### Module Dependency Diagram

```
index.html
  └── js/main.js (bootstrap orchestrator)
        ├── js/utils.js        (WebGL detection, quality tiers, helpers)
        ├── js/scene.js        (scene, camera, renderer, lights, composer)
        ├── js/logo.js         (font loading, TextGeometry, material)
        ├── js/animation.js    (rotation controller, easing, entrance, bobbing)
        ├── js/interaction.js  (raycaster hover, parallax tilt, touch)
        └── js/effects.js      (particle system, bloom, color shifts)
```

### Data Flow

`main.js` is the sole orchestrator. It:
1. Checks WebGL support and shows fallback if unavailable
2. Creates the scene (camera, lights, renderer, post-processing)
3. Determines the device quality tier (low / medium / high)
4. Loads the 3D "M" logo asynchronously
5. Initializes the animation controller, interaction manager, and particle system
6. Starts the `requestAnimationFrame` loop
7. Binds the resize handler

All state lives in controller classes (`AnimationController`, `InteractionManager`, `ParticleSystem`). No global mutable state.

---

## 2. Technology Choices

| Technology | Choice | Rationale |
|---|---|---|
| **Three.js r182** | WebGL rendering library | Industry standard for 3D on the web. Well-documented, actively maintained, rich addon ecosystem. |
| **CDN (jsDelivr)** | Delivery method | Zero build step. `cdn.jsdelivr.net` is fast and reliable. Version pinned to `0.182.0` for reproducibility. |
| **ES Modules + Import Maps** | Module system | Native browser feature (Chrome 89+, Firefox 108+, Safari 16.4+). No bundler (Webpack/Vite) needed. |
| **TextGeometry** | 3D letter approach | Parametric control over size, depth, bevel. No external modeling tools required. Ideal for a single letter. |
| **Vanilla JavaScript** | No framework | Requirement compliance. Minimizes bundle size and complexity. |

### Why Not GLTF?

A pre-built GLTF model would require Blender or similar tool, add a loading dependency, and offer no advantage for a single letter. TextGeometry gives us full control over bevel, depth, and curve segments directly in code.

### Why Not a Bundler?

Import maps provide native ES module resolution with zero config. For a demo project with no npm production dependencies, a bundler adds complexity without benefit.

---

## 3. Animation System

### Delta-Time Based Rotation

All animation uses `deltaTime` (seconds elapsed since last frame) for frame-rate independence:

```js
logoMesh.rotation.y += currentSpeed * deltaTime;
```

This ensures the logo rotates at the same visual speed whether the display runs at 30fps, 60fps, or 144fps.

### Delta-Time Cap

```js
const deltaTime = Math.min((timestamp - lastTime) / 1000, 0.1);
```

The 100ms cap prevents the "tab-away spiral": when a user switches tabs, `requestAnimationFrame` pauses. On return, the accumulated delta would be seconds or minutes, causing the logo to jump. The cap limits this to a single 100ms frame.

### Exponential Decay Easing

Hover transitions use exponential decay interpolation instead of a tweening library:

```js
currentSpeed += (targetSpeed - currentSpeed) * (1 - Math.exp(-easeFactor * deltaTime));
```

**Properties:**
- **Smooth**: Asymptotic approach to target — no sudden jumps
- **Frame-rate independent**: Uses `deltaTime` in the exponent
- **Self-correcting**: Works regardless of current state — no need for explicit start/end states
- **Lightweight**: One line of math per frame, no library needed

**Tuning:**
- `easeFactor = 3.0` — higher = snappier transitions
- `idleSpeed = 0.3 rad/s` — slow, elegant rotation
- `hoverSpeed = 1.8 rad/s` — ~6x faster, clearly noticeable

### Entrance Animation

On page load, the logo scales from 0 to 1 over 1 second with an ease-out cubic curve:

```js
const t = entranceProgress; // 0 → 1 over 1 second
const scale = 1 - Math.pow(1 - t, 3); // ease-out cubic
```

### Y-Axis Bobbing

A subtle floating motion makes the logo feel alive at idle:

```js
logoMesh.position.y = Math.sin(elapsed * 0.5) * 0.1;
```

Frequency `0.5 Hz` and amplitude `0.1 units` — gentle enough to not distract.

### Visibility Handling

When the tab is hidden, the animation loop pauses to save GPU cycles:

```js
document.addEventListener('visibilitychange', () => {
  isPaused = document.hidden;
  if (!document.hidden) lastTime = performance.now(); // Reset delta
});
```

---

## 4. Interaction Design

### Raycaster Hover Detection

The scene contains exactly one mesh (the "M" logo), making raycasting trivially cheap. A `THREE.Raycaster` tests intersection every frame:

```js
raycaster.setFromCamera(pointer, camera);
const intersects = raycaster.intersectObject(logoMesh);
const isHovered = intersects.length > 0;
```

No throttling or spatial partitioning is needed for a single object.

### Pointer Events

We use `pointermove` instead of `mousemove` for unified mouse, pen, and touch support. A `pointerleave` handler resets the hover state when the cursor exits the canvas.

### Mouse-Reactive Parallax Tilt

The logo subtly leans toward the cursor position (5-10 degrees max), creating a "the logo watches you" effect:

```js
const targetRotX = normalizedMouseY * 0.15;  // ~8.5° max
const targetRotZ = normalizedMouseX * -0.1;  // ~5.7° max
mesh.rotation.x += (targetRotX - mesh.rotation.x) * (1 - Math.exp(-2 * dt));
```

This uses the same exponential decay easing as the rotation system.

### Mobile Touch Support

- `touchstart` / `touchmove` — map the first touch to pointer coordinates for hover simulation
- `touchend` — reset to idle state (touch has no persistent hover)
- `touch-action: none` on the canvas prevents scroll interference
- `event.preventDefault()` on `touchmove` prevents page scrolling during interaction

---

## 5. Visual Effects Pipeline

### Post-Processing Chain

```
EffectComposer
  └── RenderPass (renders the scene normally)
  └── UnrealBloomPass (adds glow to bright emissive areas)
  └── OutputPass (final color correction for sRGB output)
```

**Bloom configuration:**
- `strength: 0.8` — subtle cinematic glow
- `radius: 0.4` — moderate spread
- `threshold: 0.6` — only bright emissive areas bloom

The logo's `emissive` material property drives what glows. On hover, emissive intensity increases from `0.3` to `0.6`, creating a "power up" effect.

### Particle System

300 floating particles (scaled by quality tier) surround the logo:

- **Distribution:** Spherical shell between radius 4-6 units
- **Motion:** Sine-wave drift with per-particle phase offsets (frequency `0.3`, amplitude `0.5`)
- **Material:** `PointsMaterial` with additive blending and depth-write disabled for a soft glow
- **Hover response:** On hover, particles drift 2x faster and spread outward by 20%

Implementation uses `THREE.Points` with `BufferGeometry`. Position attributes are updated per-frame with `needsUpdate = true`.

### Hover Color Shift

Material colors smoothly transition between idle and hover states:

| Property | Idle | Hover |
|---|---|---|
| `color` | `#1a5276` (deep blue) | `#2980b9` (bright blue) |
| `emissive` | `#0a2a3f` (dark) | `#4fc3f7` (bright cyan) |
| `emissiveIntensity` | `0.3` | `0.6` |

All transitions use the same exponential decay easing for consistency.

---

## 6. Performance Optimizations

| Optimization | Detail | Impact |
|---|---|---|
| **Pixel ratio cap** | `Math.min(devicePixelRatio, 2)` | Prevents 3x/4x rendering on high-DPI mobile |
| **Conditional antialias** | `antialias: devicePixelRatio < 2` (one-time at context creation) | AA is redundant on high-DPI; saves fill rate |
| **Delta-time animation** | All motion uses `deltaTime` | Frame-rate independent; no speed drift |
| **Delta-time cap** | `Math.min(deltaTime, 0.1)` | Prevents physics explosion on tab resume |
| **Visibility pause** | Stops rendering when tab is hidden | Zero GPU cost when not visible |
| **CSS background** | Gradient on `<body>`, not a Three.js plane | Zero draw calls for background |
| **Draw call budget** | <5 calls (1 mesh + 1 Points + post-processing passes) | Well within GPU comfort zone |
| **Adaptive quality** | 3 tiers based on GPU + core count | Low-end devices skip bloom, reduce particles |
| **No memory leaks** | Full `dispose()` chain for geometry, materials, renderer, composer | Safe for SPA embedding |
| **Additive blending** | Particles use `AdditiveBlending` + `depthWrite: false` | Cheap transparency without sorting |

### Adaptive Quality Tiers

```
HIGH   — 300 particles + bloom + full effects
MEDIUM — 200 particles + bloom
LOW    — 150 particles, no bloom
```

Detection uses `WEBGL_debug_renderer_info` for GPU identification and `navigator.hardwareConcurrency` for CPU core count, which is more reliable than touch-based mobile detection.

---

## 7. Responsive Design

### Resize Handler

A debounced (150ms, leading edge) resize handler updates:
- Camera aspect ratio + projection matrix
- Renderer size
- EffectComposer size (automatically propagates to all passes)

### Aspect Ratio Handling

The camera at position `(0, 0, 8)` with FOV 50 provides comfortable framing from 320px mobile to 4K desktop. The logo is centered at the origin, so it remains centered regardless of aspect ratio.

### Touch Support

Touch events are bound unconditionally. The CSS `touch-action: none` property prevents scrolling when interacting with the canvas.

---

## 8. Error Handling

| Scenario | Detection | Response |
|---|---|---|
| **Import maps unsupported** | `HTMLScriptElement.supports('importmap')` | Show CSS fallback before any JS loads |
| **WebGL unsupported** | `canvas.getContext('webgl2' \| 'webgl')` | Show CSS fallback with browser upgrade message |
| **Font loading failed** | `try/catch` around `FontLoader.loadAsync()` | Retry from CDN; if both fail, show CSS fallback |
| **Loading timeout** | `setTimeout` at 15 seconds | Show CSS fallback |
| **Runtime error** | `try/catch` around entire `init()` | Show CSS fallback, log to console |

The CSS fallback displays a styled "M" with a gradient, ensuring the brand is always visible even when WebGL fails.

---

## 9. Browser Compatibility

| Browser | Minimum Version | Notes |
|---|---|---|
| Chrome | 89+ | Full support |
| Firefox | 108+ | Import maps added in 108 |
| Safari | 16.4+ | Import maps added in 16.4 |
| Edge | 89+ | Chromium-based, same as Chrome |

Import maps have ~94.5% global browser coverage as of early 2026.

---

## 10. Running Locally

### Prerequisites

Any static file server. The project has zero npm production dependencies.

### Quick Start

```bash
npx serve .
```

Or use VS Code Live Server extension.

### Alternative

```bash
python3 -m http.server 3000
```

Then open `http://localhost:3000` in a modern browser.

> **Note:** Opening `index.html` directly as a file (`file://`) will not work due to ES module CORS restrictions. A local server is required.

---

## 11. Future Improvements

- **WebGPU renderer** — Three.js r182 supports WebGPU experimentally; migration would improve performance on supported browsers
- **Custom shaders** — GLSL shaders for advanced material effects (iridescence, animated noise)
- **Environment map** — CubeTexture reflections for more realistic metallic appearance
- **OrbitControls** — User-driven camera rotation (currently auto-rotate only)
- **Dynamic text** — Allow users to type their own letter/word
- **GLTF model support** — Load custom branded 3D models
- **Performance monitoring** — Integrate Stats.js behind a `?debug` query parameter
