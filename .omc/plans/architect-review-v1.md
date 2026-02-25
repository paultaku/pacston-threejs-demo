# Architect Review -- Plan v1

**Reviewer:** Architect (Oracle)
**Date:** 2026-02-13
**Plan:** Three.js 3D "M" Logo Interactive Demo -- Implementation Plan v1

---

## Verdict: APPROVE WITH CHANGES

The plan is well-structured, technically sound, and demonstrates strong understanding of Three.js architecture. All CDN URLs have been verified as resolving to valid modules. The font file is available and bundleable. The module decomposition is clean and follows single-responsibility principles. However, there are several issues ranging from a potential showstopper (Firefox import map note is misleading in the plan's browser compat table) to important implementation details that need tightening before execution begins.

---

## Strengths

- **Verified CDN strategy:** All six addon URLs (`FontLoader`, `TextGeometry`, `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`) have been confirmed to resolve to valid JavaScript modules at `cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/`. No 404 risk.
- **Correct version pinning:** Three.js r182 (v0.182.0) is confirmed as the latest stable release on npm as of February 2026. Pinning to an exact version in the import map is correct practice.
- **Font file availability confirmed:** `helvetiker_bold.typeface.json` exists in the Three.js repository at `examples/fonts/` and is also accessible via jsDelivr at `cdn.jsdelivr.net/npm/three@0.182.0/examples/fonts/helvetiker_bold.typeface.json`. The plan's approach of bundling it locally is sound.
- **TextGeometry API is correct:** The plan correctly uses `depth: 0.8` (not the deprecated `height` parameter). This was renamed in a prior Three.js release. The comment on line 87 of the plan noting `(formerly "height" in older versions)` is accurate and helpful for maintainers.
- **Delta-time architecture is solid:** The exponential decay easing via `1 - Math.exp(-easeFactor * deltaTime)` is mathematically correct for frame-rate-independent interpolation. The delta cap at 100ms prevents the tab-resume spiral. This is the right approach for a single-value interpolation -- a tweening library would be overkill.
- **Performance strategy is appropriate for scope:** Pixel ratio capping at 2x, CSS background instead of a Three.js plane, tight frustum, and conditional antialiasing are all pragmatic choices. The draw call budget of <5 is realistic (1 mesh + 1 Points + post-processing passes).
- **Clean module boundaries:** Each file has a clear responsibility. No module owns more than one concern. The `main.js` orchestrator pattern is appropriate for this scale.
- **Error handling is thoughtful:** WebGL detection, font loading fallback, loading overlay with timeout, and runtime error boundary cover the major failure modes.

---

## Issues (by severity)

### Critical (must fix before implementation)

**None.** There are no plan-level showstoppers. All CDN paths, library versions, and API choices have been verified as correct.

### Important (should fix)

#### 1. Firefox import map support claim needs correction in docs plan

**Location:** Plan Section 12, Technical Documentation Outline, item 9 "Browser Compatibility"

The plan states: `Import maps: supported in all modern browsers`. This is now accurate (Firefox added support in v108, Safari in 16.4, Chrome/Edge in 89). Import maps have 94.52% global browser coverage as of early 2026. However, the plan's browser compatibility section in the documentation outline (Section 12, line 682) lists `Safari 15+` as supported. Import maps require Safari 16.4+. The minimum Safari version should be updated to **16.4+**.

**Impact:** A user on Safari 15-16.3 would get a blank page with no error message. The import map would silently fail to register.

**Recommendation:** Update the browser compatibility line to `Safari 16.4+`. Additionally, consider adding a `<script nomodule>` fallback or a simple feature-detection snippet that shows the CSS fallback message if `HTMLScriptElement.supports('importmap')` returns false. This is a 5-line addition to `index.html`.

#### 2. Font loading path should have a CDN fallback chain

**Location:** Plan Section 10, Step 5 (logo.js), line 388

The plan loads the font from a local path: `./assets/fonts/helvetiker_bold.typeface.json`. If the local file is missing, corrupt, or the path is wrong relative to the deployment root, the only fallback is a "BoxGeometry shaped like an M" which would look noticeably poor.

**Recommendation:** Implement a two-tier loading strategy:
```
1. Try local: ./assets/fonts/helvetiker_bold.typeface.json
2. On failure, try CDN: https://cdn.jsdelivr.net/npm/three@0.182.0/examples/fonts/helvetiker_bold.typeface.json
3. On double failure: show CSS fallback
```
This adds resilience at minimal complexity. The CDN URL has been verified as serving the correct file.

#### 3. Resize handler needs to also update the EffectComposer render targets

**Location:** Plan Section 9, lines 323-337

The resize handler calls `composer.setSize(width, height)` and `bloomPass.resolution.set(width, height)`, which is correct. However, the plan does not mention that `UnrealBloomPass` internally creates render targets at construction time sized to the resolution parameter. When calling `bloomPass.resolution.set()`, this updates the internal uniform but does **not** recreate the render targets. The correct approach in r182 is to rely solely on `composer.setSize()` which propagates `setSize()` to all passes including `UnrealBloomPass`, which handles its own render target recreation internally.

**Recommendation:** Remove the explicit `bloomPass.resolution.set(width, height)` line from the resize handler. `composer.setSize(width, height)` is sufficient and handles everything. The extra call is either redundant (if UnrealBloomPass.setSize handles it) or potentially harmful (if it desynchronizes internal state).

#### 4. Antialias toggling at runtime is not possible

**Location:** Plan Section 8, Performance table, line 300

The plan states: `Antialias: Only when devicePixelRatio < 2 -- AA is redundant on high-DPI; saves fill rate`. This is a good optimization, but the wording implies it could be toggled. The `antialias` flag is a WebGL context creation parameter -- it is set once at `WebGLRenderer` construction and cannot be changed afterward.

**Recommendation:** Clarify in the plan that this check happens once at renderer initialization:
```js
const renderer = new THREE.WebGLRenderer({
  antialias: window.devicePixelRatio < 2,
  // ...
});
```
This is what the plan likely intends, but the implementation guide should make it explicit to avoid an implementer attempting runtime toggling.

#### 5. Mobile detection strategy is fragile

**Location:** Plan Section 9, line 348

The plan uses `'ontouchstart' in window` or `navigator.maxTouchPoints > 0` for mobile detection. These are unreliable in 2026: many laptops have touchscreens (Surface, convertibles), and `ontouchstart` is present in Chrome DevTools touch emulation. Misidentifying a desktop with a touchscreen as "mobile" would unnecessarily disable bloom and reduce particles.

**Recommendation:** Instead of binary mobile detection, use a capability-based approach:
- **For particle reduction:** Check `navigator.hardwareConcurrency` (core count) and `renderer.capabilities.maxTextureSize` as GPU capability proxies. Reduce particles if cores <= 4 or max texture size is low.
- **For bloom disable:** Only disable if frame rate drops below 30fps in the first 60 frames (adaptive quality).
- **For touch events:** Bind touch events unconditionally. Pointer events already unify mouse/pen/touch, so the touch-specific bindings are only needed for the hover simulation workaround.

### Minor (nice to have)

#### 6. Missing `renderer.dispose()` in cleanup path

**Location:** Plan Section 8, Performance table, line 297

The plan mentions `dispose()` on geometry, material, and textures, but does not mention `renderer.dispose()` or `composer.dispose()`. For a single-page demo this is unlikely to cause issues, but if the demo is ever embedded in a larger app or SPA, the WebGL context would leak.

**Recommendation:** Add `renderer.dispose()` and `composer.dispose()` to the disposal helper in `utils.js`.

#### 7. Loading timeout of 10 seconds may be too short on slow mobile connections

**Location:** Plan Section 10, line 402

The `helvetiker_bold.typeface.json` file is approximately 200KB. On a slow 3G connection (~400kbps), this would take around 4 seconds. Combined with the Three.js library itself loading from CDN (~600KB), the total could exceed 10 seconds.

**Recommendation:** Increase timeout to 15 seconds, or better, tie the timeout to network conditions using `navigator.connection.effectiveType` if available (part of the Network Information API). If `effectiveType === '2g'` or `'slow-2g'`, extend to 30 seconds.

#### 8. `bevelOffset: 0` is redundant

**Location:** Plan Section 3, line 93

`bevelOffset` defaults to 0. Including it is harmless but adds clutter. Not a real issue -- just a minor cleanliness note.

#### 9. Consider `requestAnimationFrame` visibility handling

**Location:** Plan Section 5, lines 183-201

While `requestAnimationFrame` already throttles when a tab is backgrounded, the plan does not mention the `document.visibilitychange` event. When the page is hidden, `requestAnimationFrame` callbacks may still fire at a reduced rate (typically 1fps) in some browsers, wasting GPU cycles.

**Recommendation:** Add a visibility check:
```js
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { /* pause loop */ }
  else { /* resume, reset lastTime */ }
});
```
This is a minor optimization but demonstrates good practice in the technical documentation.

#### 10. State machine has undocumented HOVER_IN and HOVER_OUT states

**Location:** Plan Section 5, lines 155-161

The plan diagrams four states (IDLE, HOVER_IN, HOVERING, HOVER_OUT) but the implementation code only uses a boolean `isHovered` and a speed lerp. The state machine diagram is more complex than the implementation needs. The exponential decay easing inherently handles the transition states -- there is no need for explicit HOVER_IN and HOVER_OUT states in code.

**Recommendation:** Either simplify the state machine diagram to match the actual implementation (two states: IDLE and HOVERING, with easing handling transitions), or if you want the state machine for extensibility (e.g., triggering particle burst only on HOVER_IN), implement it explicitly. The current disconnect between diagram and implementation could confuse an implementer.

---

## Specific Technical Recommendations

### 1. Import map feature detection (add to index.html)

```html
<script>
  if (!HTMLScriptElement.supports || !HTMLScriptElement.supports('importmap')) {
    document.getElementById('fallback').style.display = 'flex';
    document.getElementById('three-canvas').style.display = 'none';
  }
</script>
```

Place this before the import map script tag. This catches Safari < 16.4, older Firefox < 108, and any other browser without import map support. Cost: 4 lines of inline JS.

### 2. Font fallback chain implementation sketch

```js
async function loadFont() {
  const loader = new FontLoader();
  try {
    return await loader.loadAsync('./assets/fonts/helvetiker_bold.typeface.json');
  } catch (localError) {
    console.warn('Local font failed, trying CDN:', localError);
    try {
      return await loader.loadAsync(
        'https://cdn.jsdelivr.net/npm/three@0.182.0/examples/fonts/helvetiker_bold.typeface.json'
      );
    } catch (cdnError) {
      console.error('All font sources failed:', cdnError);
      return null; // Caller shows CSS fallback
    }
  }
}
```

### 3. Adaptive quality instead of binary mobile detection

```js
function getQualityTier(renderer) {
  const gl = renderer.getContext();
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
  const cores = navigator.hardwareConcurrency || 4;
  const isMobileGPU = /Mali|Adreno|PowerVR|Apple GPU/i.test(gpu);

  if (cores <= 4 && isMobileGPU) return 'low';    // Disable bloom, 150 particles
  if (cores <= 4 || isMobileGPU) return 'medium';  // Keep bloom, 200 particles
  return 'high';                                     // Full effects, 300 particles
}
```

This is more accurate than touch detection and adapts to actual device capability.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Font file 404 in deployment** (wrong relative path from deployed root) | Medium | High (blank scene) | CDN fallback chain (Recommendation #2) |
| **Import map unsupported in user's browser** | Low (5.5% of browsers) | High (blank page) | Feature detection + CSS fallback (Recommendation #1) |
| **Bloom performance on low-end mobile GPU** | Medium | Medium (janky FPS) | Adaptive quality tier (Recommendation #3) |
| **jsDelivr CDN outage** | Very Low | Critical (nothing loads) | Accept risk for demo project; could add unpkg.com fallback for production |
| **Three.js r182 breaking change in addons** | Very Low | Medium | Version is pinned; no risk unless plan changes version |
| **TextGeometry font rendering quality** | Low | Low (aesthetic only) | Helvetiker Bold is well-tested with Three.js; bevel settings in plan are reasonable |
| **Touch hover simulation feels unnatural** | Medium | Low (UX friction on mobile) | Accept for v1; could add explicit tap-to-toggle as enhancement |
| **Post-processing resolution mismatch on resize** | Low | Medium (blurry bloom) | Use only `composer.setSize()`, not manual resolution set (Issue #3) |

---

## References

- `plan-v1.md:50-58` -- Import map configuration (verified: all URLs resolve correctly)
- `plan-v1.md:84-98` -- TextGeometry configuration (verified: `depth` is the correct parameter name in r182)
- `plan-v1.md:128-140` -- Renderer configuration (verified: API is correct for r182)
- `plan-v1.md:155-161` -- State machine diagram (mismatch with implementation approach)
- `plan-v1.md:169-171` -- Exponential decay easing formula (mathematically correct)
- `plan-v1.md:300` -- Antialias optimization (clarification needed: context creation parameter, not runtime toggle)
- `plan-v1.md:323-337` -- Resize handler (remove redundant `bloomPass.resolution.set()`)
- `plan-v1.md:348` -- Mobile detection (`ontouchstart` is unreliable on modern devices)
- `plan-v1.md:388` -- Font loading (needs CDN fallback chain)
- `plan-v1.md:682` -- Browser compatibility (Safari minimum should be 16.4+, not 15+)

### Verification Sources

- [Three.js on npm](https://www.npmjs.com/package/three) -- confirmed v0.182.0 is latest
- [Import maps browser support (Can I Use)](https://caniuse.com/import-maps) -- 94.52% global coverage, Firefox 108+, Safari 16.4+, Chrome 89+
- [Three.js font file on GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/fonts/helvetiker_bold.typeface.json) -- confirmed available
- [jsDelivr CDN for Three.js](https://www.jsdelivr.com/package/npm/three) -- all addon paths verified
- [Three.js Import Maps Tutorial](https://sbcode.net/threejs/importmap/) -- confirmed import map pattern is standard
- [TextGeometry docs](https://threejs.org/docs/#examples/en/geometries/TextGeometry) -- confirmed `depth` parameter
