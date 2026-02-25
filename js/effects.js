/**
 * Visual effects: particle system, hover color shifts.
 */
import * as THREE from 'three';

const PARTICLE_CONFIG = {
  high: { count: 300, innerRadius: 4, outerRadius: 6 },
  medium: { count: 200, innerRadius: 4, outerRadius: 6 },
  low: { count: 150, innerRadius: 4, outerRadius: 6 }
};

export class ParticleSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {'low'|'medium'|'high'} quality
   */
  constructor(scene, quality = 'high') {
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
      const r = this.innerRadius + Math.random() * (this.outerRadius - this.innerRadius);
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
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x4a90d9,
      size: 0.03,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
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
    this.hoverFactor += (targetHover - this.hoverFactor) * (1 - Math.exp(-3 * deltaTime));

    const positions = this.points.geometry.attributes.position.array;
    const freq = 0.3;
    const amplitude = 0.5;
    const spreadMultiplier = 1 + this.hoverFactor * 0.2;
    const speedMultiplier = 1 + this.hoverFactor;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      const phase = this.phases[i];
      const t = this.elapsed * freq * speedMultiplier + phase;

      positions[i3] = this.basePositions[i3] * spreadMultiplier + Math.sin(t) * amplitude;
      positions[i3 + 1] = this.basePositions[i3 + 1] * spreadMultiplier + Math.cos(t * 0.7) * amplitude;
      positions[i3 + 2] = this.basePositions[i3 + 2] * spreadMultiplier + Math.sin(t * 1.3) * amplitude * 0.5;
    }

    this.points.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

// Color targets for hover transitions
const BASE_COLOR = new THREE.Color(0x1a5276);
const HOVER_COLOR = new THREE.Color(0x2980b9);
const BASE_EMISSIVE = new THREE.Color(0x0a2a3f);
const HOVER_EMISSIVE = new THREE.Color(0x4fc3f7);
const BASE_EMISSIVE_INTENSITY = 0.3;
const HOVER_EMISSIVE_INTENSITY = 0.6;

// Temp colors to avoid allocations
const _tmpColor = new THREE.Color();
const _tmpEmissive = new THREE.Color();

let currentHoverFactor = 0;

/**
 * Smoothly lerp material colors based on hover state.
 * @param {THREE.MeshStandardMaterial} material
 * @param {boolean} isHovered
 * @param {number} deltaTime
 */
export function updateMaterialOnHover(material, isHovered, deltaTime) {
  const target = isHovered ? 1 : 0;
  currentHoverFactor += (target - currentHoverFactor) * (1 - Math.exp(-3 * deltaTime));

  _tmpColor.copy(BASE_COLOR).lerp(HOVER_COLOR, currentHoverFactor);
  _tmpEmissive.copy(BASE_EMISSIVE).lerp(HOVER_EMISSIVE, currentHoverFactor);

  material.color.copy(_tmpColor);
  material.emissive.copy(_tmpEmissive);
  material.emissiveIntensity = BASE_EMISSIVE_INTENSITY
    + (HOVER_EMISSIVE_INTENSITY - BASE_EMISSIVE_INTENSITY) * currentHoverFactor;
}
