/**
 * Interaction system: raycaster hover, parallax tilt, touch support.
 */
import * as THREE from 'three';

export class InteractionManager {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {THREE.PerspectiveCamera} camera
   * @param {THREE.Mesh} logoMesh
   * @param {import('./animation.js').AnimationController} animationController
   */
  constructor(canvas, camera, logoMesh, animationController) {
    this.canvas = canvas;
    this.camera = camera;
    this.logoMesh = logoMesh;
    this.animationController = animationController;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-10, -10); // Off-screen initially

    // Normalized mouse for parallax (-0.5 to 0.5)
    this.normalizedMouse = { x: 0, y: 0 };

    // Bind events
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onPointerLeave = this._onPointerLeave.bind(this);

    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerleave', this._onPointerLeave);
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this._onTouchEnd, { passive: true });
  }

  _onPointerMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.normalizedMouse.x = (event.clientX / window.innerWidth) - 0.5;
    this.normalizedMouse.y = (event.clientY / window.innerHeight) - 0.5;
  }

  _onPointerLeave() {
    this.pointer.set(-10, -10);
    this.animationController.setHovered(false);
    this.canvas.style.cursor = 'default';
  }

  _onTouchStart(event) {
    if (event.touches.length > 0) {
      this._updatePointerFromTouch(event.touches[0]);
    }
  }

  _onTouchMove(event) {
    event.preventDefault();
    if (event.touches.length > 0) {
      this._updatePointerFromTouch(event.touches[0]);
    }
  }

  _onTouchEnd() {
    this.pointer.set(-10, -10);
    this.animationController.setHovered(false);
  }

  _updatePointerFromTouch(touch) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

    this.normalizedMouse.x = (touch.clientX / window.innerWidth) - 0.5;
    this.normalizedMouse.y = (touch.clientY / window.innerHeight) - 0.5;
  }

  /**
   * Per-frame update: raycast and update hover state.
   */
  update() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObject(this.logoMesh);
    const isHovered = intersects.length > 0;

    this.animationController.setHovered(isHovered);
    this.canvas.style.cursor = isHovered ? 'pointer' : 'default';
  }

  /**
   * Apply parallax tilt to the logo mesh based on mouse position.
   * @param {THREE.Mesh} mesh
   * @param {number} deltaTime
   */
  applyTilt(mesh, deltaTime) {
    const targetRotX = this.normalizedMouse.y * 0.15;
    const targetRotZ = this.normalizedMouse.x * -0.1;
    const factor = 1 - Math.exp(-2 * deltaTime);

    // Preserve Y rotation (auto-rotate), ease X and Z
    mesh.rotation.x += (targetRotX - mesh.rotation.x) * factor;
    mesh.rotation.z += (targetRotZ - mesh.rotation.z) * factor;
  }

  /**
   * Clean up event listeners.
   */
  dispose() {
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('pointerleave', this._onPointerLeave);
    this.canvas.removeEventListener('touchstart', this._onTouchStart);
    this.canvas.removeEventListener('touchmove', this._onTouchMove);
    this.canvas.removeEventListener('touchend', this._onTouchEnd);
  }
}
