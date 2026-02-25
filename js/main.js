/**
 * Main bootstrap: initializes scene, loads logo, wires all systems.
 */
import {
  checkWebGLSupport,
  showFallback,
  hideLoading,
  debounce,
  detectQualityTier,
  dispose,
} from "./utils.js";
import { createScene } from "./scene.js";
import { createLogo, updateLogoText } from "./logo.js";
import { AnimationController, createAnimationLoop } from "./animation.js";
import { InteractionManager } from "./interaction.js";
import {
  ParticleSystem,
  updateMaterialOnHover,
  setBaseColor,
  applyTexturePreset,
} from "./effects.js";

const LOADING_TIMEOUT_MS = 15000;

async function init() {
  // WebGL check
  if (!checkWebGLSupport()) {
    showFallback();
    return;
  }

  const canvas = document.getElementById("three-canvas");
  if (!canvas) {
    console.error("Canvas element not found");
    showFallback();
    return;
  }

  // Loading timeout
  const loadingTimer = setTimeout(() => {
    console.error("Loading timed out");
    showFallback();
  }, LOADING_TIMEOUT_MS);

  try {
    // Detect quality tier before creating the scene
    const quality = detectQualityTier();

    // Create scene once with the correct quality
    const { scene, camera, renderer, composer } = createScene(canvas, quality);

    // Load 3D logo
    const logoMesh = await createLogo(scene);
    const logoMaterial = logoMesh.material;

    // Animation controller
    const animationController = new AnimationController();

    // Interaction manager
    const interaction = new InteractionManager(
      canvas,
      camera,
      logoMesh,
      animationController,
    );

    // Particle system
    const particleSystem = new ParticleSystem(scene, quality);

    // Resize handler
    const handleResize = debounce(() => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
      composer.setSize(width, height);
    }, 150);
    window.addEventListener("resize", handleResize);

    // Clear loading timeout and hide overlay
    clearTimeout(loadingTimer);
    hideLoading();

    // Text input — update 3D text as user types
    const textInput = document.getElementById("text-input");
    if (textInput) {
      textInput.addEventListener("input", () => {
        updateLogoText(logoMesh, textInput.value);
      });
    }

    // Sidebar tab switching
    const sidebarTabs = document.querySelectorAll(".sidebar-tab");
    const sidebarPanels = document.querySelectorAll(".sidebar-panel");
    sidebarTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        sidebarTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const panelId = tab.dataset.panel + "-panel";
        sidebarPanels.forEach((p) => p.classList.toggle("hidden", p.id !== panelId));
      });
    });

    // Color swatches — update material color
    const swatches = document.querySelectorAll(".color-swatch");
    swatches.forEach((swatch) => {
      swatch.addEventListener("click", () => {
        swatches.forEach((s) => s.classList.remove("active"));
        swatch.classList.add("active");
        setBaseColor(swatch.dataset.color);
      });
    });

    // Texture options — switch material texture preset
    const textureOptions = document.querySelectorAll(".texture-option");
    textureOptions.forEach((option) => {
      option.addEventListener("click", () => {
        textureOptions.forEach((o) => o.classList.remove("active"));
        option.classList.add("active");
        applyTexturePreset(logoMaterial, option.dataset.texture);
      });
    });

    // Start animation loop
    const loop = createAnimationLoop({
      logoMesh,
      animationController,
      particleSystem,
      composer,
      interaction,
      logoMaterial,
      updateMaterial: updateMaterialOnHover,
    });

    // Cleanup function (for potential SPA embedding)
    window.__cleanupThreeDemo = () => {
      loop.stop();
      interaction.dispose();
      particleSystem.dispose();
      dispose(scene);
      composer.dispose();
      renderer.dispose();
      window.removeEventListener("resize", handleResize);
    };
  } catch (error) {
    console.error("Failed to initialize 3D demo:", error);
    clearTimeout(loadingTimer);
    showFallback();
  }
}

init();
