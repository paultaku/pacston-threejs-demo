/**
 * Utility functions: WebGL detection, quality tiers, resize, disposal.
 */

/**
 * Check if the browser supports WebGL.
 * @returns {boolean}
 */
export function checkWebGLSupport() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Show the CSS fallback message and hide the canvas.
 */
export function showFallback() {
  const fallback = document.getElementById('fallback');
  const canvas = document.getElementById('three-canvas');
  const loading = document.getElementById('loading');
  if (fallback) fallback.style.display = 'flex';
  if (canvas) canvas.style.display = 'none';
  if (loading) loading.style.display = 'none';
}

/**
 * Fade out and remove the loading overlay.
 */
export function hideLoading() {
  const loading = document.getElementById('loading');
  if (!loading) return;
  loading.classList.add('fade-out');
  setTimeout(() => {
    loading.style.display = 'none';
  }, 600);
}

/**
 * Show the loading overlay.
 */
export function showLoading() {
  const loading = document.getElementById('loading');
  if (!loading) return;
  loading.classList.remove('fade-out');
  loading.style.display = 'flex';
}

/**
 * Debounce a function with leading edge execution.
 * @param {Function} fn
 * @param {number} delay - milliseconds
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timer = null;
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn.apply(this, args);
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      lastCall = Date.now();
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * Recursively dispose of a Three.js object and its children.
 * @param {import('three').Object3D} object
 */
export function dispose(object) {
  if (!object) return;
  if (object.children) {
    while (object.children.length > 0) {
      dispose(object.children[0]);
      object.remove(object.children[0]);
    }
  }
  if (object.geometry) object.geometry.dispose();
  if (object.material) {
    if (Array.isArray(object.material)) {
      object.material.forEach(m => m.dispose());
    } else {
      object.material.dispose();
    }
  }
}

/**
 * Determine rendering quality tier using a temporary WebGL context.
 * Call before creating the Three.js renderer.
 * @returns {'low'|'medium'|'high'}
 */
export function detectQualityTier() {
  try {
    const tempCanvas = document.createElement('canvas');
    const gl = tempCanvas.getContext('webgl') || tempCanvas.getContext('experimental-webgl');
    if (!gl) return 'low';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
    const cores = navigator.hardwareConcurrency || 4;
    const isMobileGPU = /Mali|Adreno|PowerVR|Apple GPU/i.test(gpu);

    // Lose context to free the temporary canvas
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();

    if (cores <= 4 && isMobileGPU) return 'low';
    if (cores <= 4 || isMobileGPU) return 'medium';
    return 'high';
  } catch {
    return 'medium';
  }
}

/**
 * Check if primary input lacks hover capability (typically mobile/tablet).
 * @returns {boolean}
 */
export function isNoHoverDevice() {
  return window.matchMedia('(hover: none)').matches;
}
