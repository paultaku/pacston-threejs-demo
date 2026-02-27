/**
 * Animation controller: rotation easing, entrance animation, bobbing.
 */

export class AnimationController {
  constructor() {
    this.idleSpeed = 0.3; // rad/s
    this.hoverSpeed = 2.4; // rad/s (~6x)
    this.easeFactor = 3.0;
    this.currentSpeed = this.idleSpeed;
    this.targetSpeed = this.idleSpeed;

    // Entrance animation state
    this.entranceProgress = 0;
    this.entranceDuration = 1.0; // seconds

    // Elapsed time for bobbing
    this.elapsed = 0;

    // Hover state
    this.isHovered = false;
  }

  /**
   * Set hover state and update target speed.
   * @param {boolean} hovered
   */
  setHovered(hovered) {
    this.isHovered = hovered;
    this.targetSpeed = hovered ? this.hoverSpeed : this.idleSpeed;
  }

  /**
   * Update animation state each frame.
   * @param {number} deltaTime - seconds
   */
  update(deltaTime) {
    this.elapsed += deltaTime;

    // Exponential decay easing for rotation speed
    this.currentSpeed +=
      (this.targetSpeed - this.currentSpeed) *
      (1 - Math.exp(-this.easeFactor * deltaTime));

    // Entrance animation progress
    if (this.entranceProgress < 1) {
      this.entranceProgress = Math.min(
        1,
        this.entranceProgress + deltaTime / this.entranceDuration,
      );
    }
  }

  /**
   * Get entrance animation scale (ease-out cubic).
   * @returns {number} 0 to 1
   */
  getEntranceScale() {
    const t = this.entranceProgress;
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Get Y-axis bobbing offset.
   * @returns {number}
   */
  getBobbingY() {
    return Math.sin(this.elapsed * 0.5) * 0.1;
  }
}

/**
 * Create and start the main animation loop.
 * @param {Object} deps
 * @param {import('three').Mesh} deps.logoMesh
 * @param {import('three').Group} [deps.modelGroup]
 * @param {import('three').AnimationMixer} [deps.mixer]
 * @param {AnimationController} deps.animationController
 * @param {import('./effects.js').ParticleSystem} deps.particleSystem
 * @param {import('three/addons/postprocessing/EffectComposer.js').EffectComposer} deps.composer
 * @param {import('./interaction.js').InteractionManager} deps.interaction
 * @param {import('three').Material} deps.logoMaterial
 * @param {import('./effects.js').updateMaterialOnHover} deps.updateMaterial
 * @returns {{ stop: Function }}
 */
export function createAnimationLoop(deps) {
  const {
    logoMesh,
    modelGroup,
    mixer,
    animationController,
    particleSystem,
    composer,
    interaction,
    logoMaterial,
    updateMaterial,
    stats,
  } = deps;

  let lastTime = 0;
  let isPaused = false;
  let animationId = null;

  function animate(timestamp) {
    animationId = requestAnimationFrame(animate);

    if (isPaused) return;

    const deltaTime = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    // Skip first frame (deltaTime would be huge)
    if (deltaTime <= 0) return;

    // Update systems
    animationController.update(deltaTime);
    interaction.update();

    const isHovered = animationController.isHovered;

    // Entrance animation
    const scale = animationController.getEntranceScale();
    const bobbingY = animationController.getBobbingY();

    // Animate text logo
    logoMesh.rotation.y += animationController.currentSpeed * deltaTime;
    logoMesh.scale.setScalar(scale);
    logoMesh.position.y = bobbingY;
    interaction.applyTilt(logoMesh, deltaTime);

    // Animate GLTF model
    if (modelGroup) {
      modelGroup.rotation.y += animationController.currentSpeed * deltaTime;
      modelGroup.position.y = bobbingY;
      interaction.applyTilt(modelGroup, deltaTime);
    }

    // Update GLTF animation mixer
    if (mixer) {
      mixer.update(deltaTime);
    }

    // Particle + material effects
    particleSystem.update(deltaTime, isHovered);
    updateMaterial(logoMaterial, isHovered, deltaTime);

    // Render
    composer.render();
    if (stats) stats.update();
  }

  // Visibility handling
  function onVisibilityChange() {
    isPaused = document.hidden;
    if (!document.hidden) {
      lastTime = performance.now();
    }
  }
  document.addEventListener("visibilitychange", onVisibilityChange);

  // Start
  lastTime = performance.now();
  animationId = requestAnimationFrame(animate);

  return {
    stop() {
      if (animationId) cancelAnimationFrame(animationId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}
