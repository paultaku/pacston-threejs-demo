/**
 * Visual effects: particle system, hover color shifts.
 */
import * as THREE from "three";

const textureLoader = new THREE.TextureLoader();
const textureCache = {};

const PARTICLE_CONFIG = {
  high: { count: 300, innerRadius: 4, outerRadius: 6 },
  medium: { count: 200, innerRadius: 4, outerRadius: 6 },
  low: { count: 150, innerRadius: 4, outerRadius: 6 },
};

export class ParticleSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {'low'|'medium'|'high'} quality
   */
  constructor(scene, quality = "high") {
    const config = PARTICLE_CONFIG[quality] || PARTICLE_CONFIG.high;
    this.count = config.count;
    this.innerRadius = config.innerRadius;
    this.outerRadius = config.outerRadius;

    // Base positions for sine drift
    this.basePositions = new Float32Array(this.count * 3);
    const positions = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      // Random point in spherical shell
      const r =
        this.innerRadius +
        Math.random() * (this.outerRadius - this.innerRadius);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      this.basePositions[i3] = x;
      this.basePositions[i3 + 1] = y;
      this.basePositions[i3 + 2] = z;
    }

    // Phase offsets for variation
    this.phases = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      this.phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x4a90d9,
      size: 0.03,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.elapsed = 0;
    this.hoverFactor = 0; // 0 = idle, 1 = hovered

    scene.add(this.points);
  }

  /**
   * Update particle positions each frame.
   * @param {number} deltaTime
   * @param {boolean} isHovered
   */
  update(deltaTime, isHovered) {
    this.elapsed += deltaTime;

    // Ease hover factor
    const targetHover = isHovered ? 1 : 0;
    this.hoverFactor +=
      (targetHover - this.hoverFactor) * (1 - Math.exp(-3 * deltaTime));

    const positions = this.points.geometry.attributes.position.array;
    const freq = 0.3;
    const amplitude = 0.5;
    const spreadMultiplier = 1 + this.hoverFactor * 0.2;
    const speedMultiplier = 1 + this.hoverFactor;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      const phase = this.phases[i];
      const t = this.elapsed * freq * speedMultiplier + phase;

      positions[i3] =
        this.basePositions[i3] * spreadMultiplier + Math.sin(t) * amplitude;
      positions[i3 + 1] =
        this.basePositions[i3 + 1] * spreadMultiplier +
        Math.cos(t * 0.7) * amplitude;
      positions[i3 + 2] =
        this.basePositions[i3 + 2] * spreadMultiplier +
        Math.sin(t * 1.3) * amplitude * 0.5;
    }

    this.points.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

// Color targets for hover transitions (mutable for color picker)
const baseColor = new THREE.Color(0x1a5276);
const hoverColor = new THREE.Color(0x2980b9);
const baseEmissive = new THREE.Color(0x0a2a3f);
const hoverEmissive = new THREE.Color(0x4fc3f7);
let baseEmissiveIntensity = 0.3;
let hoverEmissiveIntensity = 0.6;

// Temp colors to avoid allocations
const _tmpColor = new THREE.Color();
const _tmpEmissive = new THREE.Color();
const _tmpHSL = {};

let currentHoverFactor = 0;

// Track whether an image texture is active
let hasImageTexture = false;

// Saved user color for restoring when switching from texture to solid
const savedBaseColor = new THREE.Color(0x1a5276);

// White-based colors for when image texture is active
const TEX_BASE_COLOR = new THREE.Color(0xffffff);
const TEX_HOVER_COLOR = new THREE.Color(0xffffff);
const TEX_BASE_EMISSIVE = new THREE.Color(0x222222);
const TEX_HOVER_EMISSIVE = new THREE.Color(0x666666);

/**
 * Derive hover and emissive colors from a base color.
 * Saved for restoring when switching away from image textures.
 * @param {string} hexColor - CSS hex color like "#1a5276"
 */
export function setBaseColor(hexColor) {
  savedBaseColor.set(hexColor);

  // Only apply to rendering colors if no image texture is active
  if (!hasImageTexture) {
    _applyColorScheme(hexColor);
  }
}

/**
 * Internal: apply a color scheme to the rendering color targets.
 */
function _applyColorScheme(hexColor) {
  baseColor.set(hexColor);

  baseColor.getHSL(_tmpHSL);
  hoverColor.setHSL(
    _tmpHSL.h,
    Math.min(1, _tmpHSL.s * 1.3),
    Math.min(0.65, _tmpHSL.l * 1.5),
  );

  baseEmissive.setHSL(_tmpHSL.h, _tmpHSL.s * 0.8, _tmpHSL.l * 0.4);

  hoverEmissive.setHSL(
    _tmpHSL.h,
    Math.min(1, _tmpHSL.s * 1.2),
    Math.min(0.8, _tmpHSL.l * 2.5),
  );

  baseEmissiveIntensity = 0.3;
  hoverEmissiveIntensity = 0.6;
}

// Texture presets — modify material surface properties
// Add texturePath to apply an image texture to material.map
const TEXTURE_PRESETS = {
  metallic: {
    metalness: 0.7,
    roughness: 0.25,
    wireframe: false,
    transparent: false,
    opacity: 1.0,
    baseEI: 0.3,
    hoverEI: 0.6,
  },
  matte: {
    metalness: 0.0,
    roughness: 0.9,
    wireframe: false,
    transparent: false,
    opacity: 1.0,
    baseEI: 0.2,
    hoverEI: 0.4,
  },
  chrome: {
    metalness: 1.0,
    roughness: 0.0,
    wireframe: false,
    transparent: false,
    opacity: 1.0,
    baseEI: 0.1,
    hoverEI: 0.3,
  },
  neon: {
    metalness: 0.0,
    roughness: 0.3,
    wireframe: false,
    transparent: false,
    opacity: 1.0,
    baseEI: 0.8,
    hoverEI: 1.5,
  },
  glass: {
    metalness: 0.1,
    roughness: 0.05,
    wireframe: false,
    transparent: true,
    opacity: 0.55,
    baseEI: 0.2,
    hoverEI: 0.5,
  },
  plastic: {
    metalness: 0.0,
    roughness: 0.4,
    wireframe: false,
    transparent: false,
    opacity: 1.0,
    baseEI: 0.2,
    hoverEI: 0.5,
  },
  wireframe: {
    metalness: 0.3,
    roughness: 0.5,
    wireframe: true,
    transparent: false,
    opacity: 1.0,
    baseEI: 0.5,
    hoverEI: 1.0,
  },
  wood: {
    metalness: 0.0,
    roughness: 0.7,
    wireframe: false,
    transparent: false,
    opacity: 1.0,
    baseEI: 0.1,
    hoverEI: 0.3,
    texturePath: "./assets/textures/wood.jpg",
  },
  marble: {
    metalness: 0.3,
    roughness: 0.2,
    wireframe: false,
    transparent: false,
    opacity: 1.0,
    baseEI: 0.2,
    hoverEI: 0.4,
    texturePath: "./assets/textures/marble.jpg",
  },
  brick: {
    metalness: 0.0,
    roughness: 0.9,
    wireframe: false,
    transparent: false,
    opacity: 1.0,
    baseEI: 0.1,
    hoverEI: 0.3,
    texturePath: "./assets/textures/brick.tif",
  },
  stone: {
    metalness: 0.1,
    roughness: 0.8,
    wireframe: false,
    transparent: false,
    opacity: 1.0,
    baseEI: 0.1,
    hoverEI: 0.3,
    texturePath: "./assets/textures/stone.jpg",
  },
};

/**
 * Load a texture with caching and proper wrapping.
 * @param {string} path
 * @returns {THREE.Texture}
 */
function loadCachedTexture(path) {
  if (!textureCache[path]) {
    textureCache[path] = textureLoader.load(
      path,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 2);
      },
      undefined,
      (err) => {
        console.warn("Failed to load texture:", path, err);
      },
    );
  }
  return textureCache[path];
}

/**
 * Apply a texture preset to the material.
 * When an image texture is active, switches to white color mode
 * so the texture's true colors show through.
 * @param {THREE.MeshStandardMaterial} material
 * @param {string} presetName
 */
export function applyTexturePreset(material, presetName) {
  const preset = TEXTURE_PRESETS[presetName];
  if (!preset) return;

  material.metalness = preset.metalness;
  material.roughness = preset.roughness;
  material.wireframe = preset.wireframe;
  material.transparent = preset.transparent;
  material.opacity = preset.opacity;
  material.depthWrite = !preset.transparent;

  // Apply or clear image texture
  if (preset.texturePath) {
    material.map = loadCachedTexture(preset.texturePath);
    hasImageTexture = true;

    // Switch to white color mode so texture shows true colors
    baseColor.copy(TEX_BASE_COLOR);
    hoverColor.copy(TEX_HOVER_COLOR);
    baseEmissive.copy(TEX_BASE_EMISSIVE);
    hoverEmissive.copy(TEX_HOVER_EMISSIVE);
    baseEmissiveIntensity = preset.baseEI;
    hoverEmissiveIntensity = preset.hoverEI;
  } else {
    material.map = null;
    hasImageTexture = false;

    // Restore user-selected color scheme
    _applyColorScheme(savedBaseColor);
    baseEmissiveIntensity = preset.baseEI;
    hoverEmissiveIntensity = preset.hoverEI;
  }
  material.needsUpdate = true;
}

/**
 * Smoothly lerp material colors based on hover state.
 * @param {THREE.MeshStandardMaterial} material
 * @param {boolean} isHovered
 * @param {number} deltaTime
 */
export function updateMaterialOnHover(material, isHovered, deltaTime) {
  const target = isHovered ? 1 : 0;
  currentHoverFactor +=
    (target - currentHoverFactor) * (1 - Math.exp(-3 * deltaTime));

  _tmpColor.copy(baseColor).lerp(hoverColor, currentHoverFactor);
  _tmpEmissive.copy(baseEmissive).lerp(hoverEmissive, currentHoverFactor);

  material.color.copy(_tmpColor);
  material.emissive.copy(_tmpEmissive);
  material.emissiveIntensity =
    baseEmissiveIntensity +
    (hoverEmissiveIntensity - baseEmissiveIntensity) * currentHoverFactor;
}
