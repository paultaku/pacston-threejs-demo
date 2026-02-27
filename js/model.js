/**
 * GLTF model loading for the Model scene.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PARROT_URL = 'https://threejs.org/examples/models/gltf/Parrot.glb';

/**
 * Load the Parrot GLTF model and add it to the scene.
 * @param {THREE.Scene} scene
 * @returns {Promise<{ model: THREE.Group, mixer: THREE.AnimationMixer|null }>}
 */
export async function loadModel(scene) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(PARROT_URL);

  const model = gltf.scene;
  model.scale.setScalar(0.035);
  model.visible = false;
  scene.add(model);

  let mixer = null;
  if (gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    const action = mixer.clipAction(gltf.animations[0]);
    action.play();
  }

  return { model, mixer };
}
