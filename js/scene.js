/**
 * Scene setup: camera, renderer, lighting, post-processing composer.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Create the full scene with camera, renderer, lighting, and post-processing.
 * @param {HTMLCanvasElement} canvas
 * @param {'low'|'medium'|'high'} quality
 * @returns {{ scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, composer: EffectComposer }}
 */
export function createScene(canvas, quality = 'high') {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Scene
  const scene = new THREE.Scene();

  // Camera
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 0, 8);

  // Renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: window.devicePixelRatio < 2,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0a0a1a);

  // Lighting — 3-point + ambient
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
  keyLight.position.set(5, 5, 5);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x4a90d9, 0.6);
  fillLight.position.set(-3, 2, -2);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0xff6b35, 0.8);
  rimLight.position.set(0, -3, 5);
  scene.add(rimLight);

  const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.3);
  scene.add(ambientLight);

  // Post-processing
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  if (quality !== 'low') {
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.8,  // strength
      0.4,  // radius
      0.6   // threshold
    );
    composer.addPass(bloomPass);
  }

  composer.addPass(new OutputPass());

  return { scene, camera, renderer, composer };
}
