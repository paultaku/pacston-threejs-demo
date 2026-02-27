/**
 * 3D text logo creation with dynamic text support.
 */
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

const LOCAL_FONT_PATH = './assets/fonts/helvetiker_bold.typeface.json';
const CDN_FONT_PATH = 'https://cdn.jsdelivr.net/npm/three@0.182.0/examples/fonts/helvetiker_bold.typeface.json';

let loadedFont = null;
let currentQuality = 'high';

/**
 * Load font with local-first, CDN-fallback strategy.
 * @returns {Promise<import('three/addons/loaders/FontLoader.js').Font>}
 */
async function loadFont() {
  const loader = new FontLoader();
  try {
    return await loader.loadAsync(LOCAL_FONT_PATH);
  } catch (localErr) {
    console.warn('Local font failed, trying CDN:', localErr);
    return await loader.loadAsync(CDN_FONT_PATH);
  }
}

/**
 * Create a TextGeometry for the given string.
 * Auto-scales size to fit longer strings, and adjusts detail by quality tier.
 * @param {string} text
 * @param {import('three/addons/loaders/FontLoader.js').Font} font
 * @param {'low'|'medium'|'high'} [quality='high']
 */
function createTextGeometry(text, font, quality = 'high') {
  const displayText = text || 'M';
  const size = Math.min(3, 10 / displayText.length);
  const clampedSize = Math.max(0.8, size);
  const depth = clampedSize * 0.27;

  const isLow = quality === 'low';
  const curveSegments = isLow ? 8 : 12;
  const bevelSegments = isLow ? 3 : 5;
  const bevelThickness = isLow ? 0.06 : 0.08;
  const bevelSize = isLow ? 0.04 : 0.05;

  const geometry = new TextGeometry(displayText, {
    font,
    size: clampedSize,
    depth,
    curveSegments,
    bevelEnabled: true,
    bevelThickness,
    bevelSize,
    bevelSegments
  });

  geometry.computeBoundingBox();
  geometry.center();
  return geometry;
}

/**
 * Create the 3D logo mesh and add it to the scene.
 * @param {THREE.Scene} scene
 * @param {'low'|'medium'|'high'} [quality='high']
 * @returns {Promise<THREE.Mesh>}
 */
export async function createLogo(scene, quality = 'high') {
  loadedFont = await loadFont();
  currentQuality = quality;

  const geometry = createTextGeometry('M', loadedFont, quality);

  const material = new THREE.MeshStandardMaterial({
    color: 0x1a5276,
    metalness: 0.7,
    roughness: 0.25,
    emissive: 0x0a2a3f,
    emissiveIntensity: 0.3
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.setScalar(0); // Start at 0 for entrance animation
  scene.add(mesh);

  return mesh;
}

/**
 * Update the logo mesh with new text.
 * Disposes old geometry and creates a new one.
 * @param {THREE.Mesh} mesh
 * @param {string} text
 */
export function updateLogoText(mesh, text) {
  if (!loadedFont) return;

  const oldGeometry = mesh.geometry;
  mesh.geometry = createTextGeometry(text, loadedFont, currentQuality);
  oldGeometry.dispose();
}
