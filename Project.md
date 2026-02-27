## 專案說明

#### 專案架構

根據不同用途「場景建立、動畫控制、視覺特效與互動邏輯」分工

- `main.js` 作為 High-level 主要管理邏輯的檔案(Facade Pattern)，負責檢查 WebGL 支援、建立場景與渲染管線、載入 3D LOGO 與 GLTF 模型、初始化互動與粒子系統，並串起整體動畫迴圈與 UI 事件（場景切換、文字輸入、側邊欄、材質與貼圖選擇）。
- `scene.js` 專注在 Three.js 場景建構：
  - 相機參數設定
  - WebGLRenderer 初始化
  - 燈光配置與後製特效（EffectComposer、Bloom 與 Output pass），並依偵測到的裝置效能給予不同品質等級。
- `animation.js` 提供 `AnimationController` 與 `createAnimationLoop`，前者負責旋轉速度、滑鼠 hover 狀態、進場補間與上下浮動效果，後者則包裝 `requestAnimationFrame` 迴圈，在每一幀更新控制器、互動狀態、模型動畫與粒子系統。
- `effects.js` 主要負責視覺效果，包括三維環繞粒子系統、根據 hover 漸變的顏色與發光強度，以及多種材質設定（金屬、玻璃、木頭、石材等）。

#### 動畫邏輯:

以時間為驅動核心：每幀計算 `deltaTime`，用指數緩動方式在 idle 與 hover 旋轉速度間平滑過渡，並透過 easing 曲線完成 LOGO 的進場放大以及持續的上下 bobbing。互動部分則把滑鼠 hover 與視覺反應解耦：控制器只紀錄狀態與速度，材質與粒子系統各自讀取「是否 hover」並做對應變化，維持模組化。

#### 效能考量:

1. 專案以裝置像素比與自訂的品質分級控制抗鋸齒、粒子數量與後製強度，避免在低階裝置上過度渲染。其中粒子系統在 `low` 檔位會明顯降低顆粒數與半徑，優先確保 FPS。
2. `deltaTime` 被限制上限以避免掉幀時造成跳動。
3. `document.hidden` 事件則在頁籤背景化時暫停更新，減少不必要的 GPU 負載。
4. 貼圖載入採用快取機制與共用 TextureLoader / TIFFLoader，並適當設定 `repeat` 與 `colorSpace` 以兼顧畫質與效能，同時提供集中釋放函式，於 `__cleanupThreeDemo` 階段一併對 cached textures 呼叫 `dispose()`，避免長時間使用造成 VRAM 累積。
5. 3D 文字 LOGO 的 `TextGeometry` 會依文字長度自動縮放，並在低品質模式下降低 curve/bevel 段數與厚度，在視覺細節與幾何面數之間取得平衡。

#### 效能主要評估重點

1. [*****]減少繪製呼叫: (Reduce Draw Calls)這是 WebGL 效能最常見的瓶頸。每一次 renderer.render 叫 GPU 畫東西，都會產生 CPU 與 GPU 之間的溝通開銷（Draw Call）。
   1. 物件合併 (BufferGeometryUtils.mergeGeometries): 將多個使用相同材質（Material）的 Mesh 合併成一個。
   2. 實例化渲染 (InstancedMesh): 如果場景中有幾千個重複的物件（如樹木、草地），不要建立幾千個 Mesh，使用 InstancedMesh 只需要一次 Draw Call 就能渲染所有物件。
2. 幾何體優化: (Geometry Optimization)GPU 處理的三角形越多，壓力就越大。簡化模型: 在 Blender 等建模軟體中盡量減少面數（Polygon count）。移除無用屬性: 如果不需要法向量（Normals）或 UV 座標，請將其從 BufferGeometry 中移除。使用索引緩衝 (Index Buffer): 確保你的幾何體是索引化的，這樣頂點就不會重複計算。
3. 材質與貼圖 (Textures & Materials)貼圖的大小直接影響顯存（VRAM）的佔用。2 的冪次方 (Power of Two): 貼圖尺寸最好是 256 x 256, 512 x 512 等，方便 GPU 優化。壓縮紋理 (Compressed Textures): 使用 `.basis`, `.ktx2` 格式代替傳統的 `jpg/png`，能大幅減少顯存佔用並加快載入。共享材質: 盡可能讓多個 Mesh 共用同一個 Material 實例。
4. 光影與渲染器設置 (Lighting & Renderer)光影運算是最耗能的部分之一。陰影優化: 陰影非常吃效能。如果可以，請使用烘焙貼圖 (Baking) 來代替即時陰影。若必須使用即時陰影，請限制 shadowMap 的解析度。關閉自動更新: ```javascriptrenderer.info.autoReset = false; // 手動監控效能scene.matrixAutoUpdate = false; // 對於靜態物件，關閉矩陣自動更新抗鋸齒 (Antialias): 在高解析度螢幕（如 Retina）上，抗鋸齒開銷巨大。建議偵測 window.devicePixelRatio，如果大於 1，可以考慮關閉 antialias: true。
5. 記憶體管理 (Memory Management): WebGL 不會像 JavaScript 那樣自動垃圾回收幾何體和材質。手動釋放 (Dispose): 當你從場景中移除物件時，必須呼叫 .dispose()。`geometry.dispose()`,`material.dispose()`,`texture.dispose()`
6. 效能監控工具在優化之前，你得先知道問題出在哪：工具用途Stats.js監測 FPS、MS（渲染一幀所需毫秒）與記憶體。Spector.js強大的 Chrome 擴充功能，可以查看每一幀的 Draw Calls 與 GPU 狀態。Three.js Inspector檢查場景結構與材質屬性。

#### 主要使用套件:

主要使用套件為 **Three.js** 及其官方擴充模組（後製管線、TIFFLoader、Stats 等）。目前需求看起來可以使用官方套件就完成對應的功能，需要有更深度的需求釐清才能知道有沒有安裝其他套件的需要。

#### 專案使用工具:

1. Cursor
2. Claude Code
3. Gemini
