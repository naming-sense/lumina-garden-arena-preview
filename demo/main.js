import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const params = new URLSearchParams(window.location.search);
if (params.get("ui") === "0") document.body.classList.add("hide-ui");
const forcedQuality = params.get("quality");
const isConstrainedDevice =
  forcedQuality === "mobile" ||
  (forcedQuality !== "desktop" &&
    (window.matchMedia("(max-width: 820px)").matches ||
      (navigator.deviceMemory ?? 8) <= 4));
const isPortraitMobile = isConstrainedDevice && window.innerHeight > window.innerWidth;

const canvas = document.querySelector("#scene");
const loading = document.querySelector("#loading");
const progress = document.querySelector("#progress");
const statsElement = document.querySelector("#stats");
const validationElement = document.querySelector("#validation");
const referenceCard = document.querySelector("#reference-card");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isConstrainedDevice,
  alpha: true,
  powerPreference: isConstrainedDevice ? "low-power" : "high-performance",
});
renderer.setPixelRatio(isConstrainedDevice ? 1 : Math.min(window.devicePixelRatio, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.99;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = !isConstrainedDevice;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(
  0xd7f5f0,
  isPortraitMobile ? 30 : 24,
  isPortraitMobile ? 65 : 43,
);

const camera = new THREE.PerspectiveCamera(
  isPortraitMobile ? 60 : 31,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 9;
controls.maxDistance = isPortraitMobile ? 65 : 38;
controls.maxPolarAngle = Math.PI * 0.48;
controls.target.set(0, 0.25, -0.2);

const cameraViews = {
  overview: {
    position: isPortraitMobile
      ? new THREE.Vector3(0, 27, 26)
      : new THREE.Vector3(0, 18.7, 17.2),
    target: new THREE.Vector3(0, 0.3, -0.35),
  },
  top: {
    position: new THREE.Vector3(0, isPortraitMobile ? 40 : 31, 0.01),
    target: new THREE.Vector3(0, 0, 0),
  },
};

function setCameraView(name) {
  const view = cameraViews[name] ?? cameraViews.overview;
  camera.position.copy(view.position);
  controls.target.copy(view.target);
  controls.update();
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
  });
}

setCameraView(params.get("view") === "top" ? "top" : "overview");

const ambient = new THREE.AmbientLight(0xfff7e8, 0.3);
scene.add(ambient);

const hemisphere = new THREE.HemisphereLight(0xf4fffb, 0x91bd7c, 1.56);
scene.add(hemisphere);

const keyLight = new THREE.DirectionalLight(0xffefd2, 2.3);
keyLight.position.set(-6, 13, 8);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(isConstrainedDevice ? 1024 : 2048, isConstrainedDevice ? 1024 : 2048);
keyLight.shadow.camera.left = -12;
keyLight.shadow.camera.right = 12;
keyLight.shadow.camera.top = 9;
keyLight.shadow.camera.bottom = -9;
keyLight.shadow.camera.near = 2;
keyLight.shadow.camera.far = 38;
keyLight.shadow.bias = -0.00018;
keyLight.shadow.normalBias = 0.022;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x9beaff, 0.82);
fillLight.position.set(7, 7, -8);
scene.add(fillLight);

const frontFill = new THREE.DirectionalLight(0xffd9bd, 0.38);
frontFill.position.set(0, 5, 10);
scene.add(frontFill);

const objectRoot = new THREE.Group();
objectRoot.name = "garden-arena-instances";
scene.add(objectRoot);

const coreRoot = new THREE.Group();
coreRoot.name = "core-object-instances";
objectRoot.add(coreRoot);

const environmentRoot = new THREE.Group();
environmentRoot.name = "environment-object-instances";
objectRoot.add(environmentRoot);

const loadingManager = new THREE.LoadingManager();
let displayedProgress = 0;
loadingManager.onProgress = (_url, loaded, total) => {
  const measured = Math.round((loaded / Math.max(total, 1)) * 100);
  displayedProgress = Math.max(displayedProgress, Math.min(measured, 99));
  progress.textContent = `${displayedProgress}%`;
};

const textureLoader = new THREE.TextureLoader(loadingManager);
const gltfLoader = new GLTFLoader(loadingManager);

function createSoftShadowTexture() {
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const context = shadowCanvas.getContext("2d");
  const gradient = context.createRadialGradient(54, 50, 4, 64, 64, 61);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.94)");
  gradient.addColorStop(0.42, "rgba(255, 255, 255, 0.62)");
  gradient.addColorStop(0.78, "rgba(255, 255, 255, 0.18)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);

  const texture = new THREE.CanvasTexture(shadowCanvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

const contactShadowTexture = isConstrainedDevice ? createSoftShadowTexture() : null;
const contactShadowExcludedAssets = new Set(["waterway"]);

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function countTriangles(root) {
  let triangles = 0;
  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const geometry = child.geometry;
    triangles += geometry.index
      ? geometry.index.count / 3
      : (geometry.getAttribute("position")?.count ?? 0) / 3;
  });
  return Math.round(triangles);
}

const materialTuningByAsset = {
  straightWall: { emissiveLift: 0.28, maxMetalness: 0, minRoughness: 0.82 },
  flowerBush: { emissiveLift: 0.13, maxMetalness: 0.04, minRoughness: 0.76 },
  roundedPlanter: { emissiveLift: 0.13, maxMetalness: 0.02, minRoughness: 0.74 },
};
const mobileShadowExcludedAssets = new Set(["waterway"]);

function prepareTemplate(gltfScene, targetHeight, assetKey) {
  const model = gltfScene;
  const tuning = materialTuningByAsset[assetKey] ?? {
    emissiveLift: 0.045,
    maxMetalness: 0.12,
    minRoughness: 0.66,
  };
  model.updateMatrixWorld(true);

  let bounds = new THREE.Box3().setFromObject(model);
  const initialSize = bounds.getSize(new THREE.Vector3());
  const uniformScale = targetHeight / Math.max(initialSize.y, 0.0001);
  model.scale.multiplyScalar(uniformScale);
  model.updateMatrixWorld(true);

  bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= bounds.min.y;
  model.position.z -= center.z;
  model.updateMatrixWorld(true);

  model.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = !isConstrainedDevice || !mobileShadowExcludedAssets.has(assetKey);
    child.receiveShadow = !isConstrainedDevice;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      material.envMapIntensity = 0.88;
      if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
        material.metalness = Math.min(material.metalness, tuning.maxMetalness);
        material.roughness = Math.max(material.roughness, tuning.minRoughness);
      }
      if ((material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) && material.map) {
        material.emissive.set(0xfff4e8);
        material.emissiveMap = material.map;
        material.emissiveIntensity = tuning.emissiveLift;
      }
      material.needsUpdate = true;
    }
  });

  const pivot = new THREE.Group();
  pivot.add(model);
  const finalBounds = new THREE.Box3().setFromObject(pivot);
  const finalSize = finalBounds.getSize(new THREE.Vector3());

  return {
    pivot,
    triangles: countTriangles(model),
    size: [finalSize.x, finalSize.y, finalSize.z],
  };
}

function createPortalEnergy(color, targetHeight) {
  const effect = new THREE.Group();
  effect.userData.effect = true;

  const width = targetHeight * 0.43;
  const bottom = targetHeight * 0.24;
  const shoulder = targetHeight * 0.56;

  const radius = width / 2;
  const tubePoints = [new THREE.Vector3(0, bottom, -radius), new THREE.Vector3(0, shoulder, -radius)];
  for (let step = 1; step < 12; step += 1) {
    const angle = Math.PI - (Math.PI * step) / 12;
    tubePoints.push(
      new THREE.Vector3(0, shoulder + Math.sin(angle) * radius, Math.cos(angle) * radius),
    );
  }
  tubePoints.push(new THREE.Vector3(0, shoulder, radius), new THREE.Vector3(0, bottom, radius));
  const tubeCurve = new THREE.CatmullRomCurve3(tubePoints, false, "centripetal");
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(tubeCurve, 72, 0.022, 6, false),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.NormalBlending,
      depthWrite: false,
    }),
  );
  effect.add(tube);

  const light = new THREE.PointLight(color, 1.55, 2.8, 2);
  light.position.set(0, targetHeight * 0.52, 0);
  effect.add(light);
  return effect;
}

function createCrystalGlow(targetHeight) {
  const effect = new THREE.Group();
  effect.userData.effect = true;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(targetHeight * 0.47, 0.028, 10, 72),
    new THREE.MeshBasicMaterial({
      color: 0x35f7ff,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.045;
  effect.add(ring);

  const light = new THREE.PointLight(0x37edff, 4.2, 4.4, 2);
  light.position.y = targetHeight * 0.68;
  effect.add(light);
  return effect;
}

function addInstance(instance, config, template) {
  const placed = template.pivot.clone(true);
  placed.name = instance.id;
  placed.position.fromArray(instance.position);
  placed.rotation.y = THREE.MathUtils.degToRad(instance.rotationY ?? 0);
  placed.scale.multiplyScalar(instance.scale ?? 1);
  placed.userData.asset = instance.asset;
  placed.userData.team = instance.team ?? null;
  placed.userData.category = config.category;

  if (instance.asset === "portalArch") {
    const color = instance.team === "purple" ? 0xd74fff : 0x2ff7ef;
    placed.add(createPortalEnergy(color, config.targetHeight));
  }
  if (instance.asset === "crystalShrine") {
    placed.add(createCrystalGlow(config.targetHeight));
  }

  const targetRoot = config.category === "environment" ? environmentRoot : coreRoot;
  targetRoot.add(placed);
}

function addMobileContactShadows(instances, placement, templates, category, targetRoot) {
  if (!isConstrainedDevice || !contactShadowTexture) return 0;

  const shadowInstances = instances.filter(
    (instance) =>
      placement.models[instance.asset].category === category &&
      !contactShadowExcludedAssets.has(instance.asset),
  );
  if (shadowInstances.length === 0) return 0;

  const shadowGeometry = new THREE.PlaneGeometry(1, 1);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: contactShadowTexture,
    color: 0x294b45,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    toneMapped: false,
  });
  const shadows = new THREE.InstancedMesh(
    shadowGeometry,
    shadowMaterial,
    shadowInstances.length,
  );
  shadows.name = `${category}-mobile-contact-shadows`;
  shadows.renderOrder = -1;
  shadows.frustumCulled = false;
  shadows.userData.contactShadow = true;

  const groundRotation = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-Math.PI / 2, 0, 0),
  );
  const yawRotation = new THREE.Quaternion();
  const combinedRotation = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  shadowInstances.forEach((instance, index) => {
    const template = templates[instance.asset];
    const instanceScale = instance.scale ?? 1;
    const height = template.size[1] * instanceScale;
    const width = Math.max(template.size[0] * 0.76, 0.3) * instanceScale;
    const depth = Math.max(template.size[2] * 0.76, 0.3) * instanceScale;

    position.set(
      instance.position[0] + height * 0.045,
      0.022,
      instance.position[2] - height * 0.06,
    );
    yawRotation.setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      THREE.MathUtils.degToRad(instance.rotationY ?? 0),
    );
    combinedRotation.copy(yawRotation).multiply(groundRotation);
    scale.set(width, depth, 1);
    matrix.compose(position, combinedRotation, scale);
    shadows.setMatrixAt(index, matrix);
  });

  shadows.instanceMatrix.needsUpdate = true;
  targetRoot.add(shadows);
  return shadowInstances.length;
}

function setEffectsVisible(visible) {
  objectRoot.traverse((child) => {
    if (child.userData.effect) child.visible = visible;
  });
}

async function buildScene() {
  const [placement, floorMap] = await Promise.all([
    fetch("../scene-placement.json?v=14").then((response) => {
      if (!response.ok) throw new Error(`placement HTTP ${response.status}`);
      return response.json();
    }),
    textureLoader.loadAsync("../01-floor-only-map.png?v=10"),
  ]);

  floorMap.colorSpace = THREE.SRGBColorSpace;
  floorMap.anisotropy = Math.min(
    renderer.capabilities.getMaxAnisotropy(),
    isConstrainedDevice ? 2 : 16,
  );
  floorMap.minFilter = THREE.LinearMipmapLinearFilter;
  floorMap.magFilter = THREE.LinearFilter;

  const underlay = new THREE.Mesh(
    new THREE.PlaneGeometry(
      placement.arena.environmentWidth,
      placement.arena.environmentDepth,
    ),
    new THREE.MeshBasicMaterial({ color: 0x8fd8d3, transparent: true, opacity: 0.42 }),
  );
  underlay.rotation.x = -Math.PI / 2;
  underlay.position.y = -0.055;
  scene.add(underlay);

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorMap,
    roughness: 0.94,
    metalness: 0,
  });
  const floorSaturation = 0.9;
  floorMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
       float floorLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
       diffuseColor.rgb = mix(vec3(floorLuma), diffuseColor.rgb, ${floorSaturation.toFixed(2)});`,
    );
  };
  floorMaterial.customProgramCacheKey = () => `garden-floor-saturation-${floorSaturation}`;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(placement.arena.width, placement.arena.depth),
    floorMaterial,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const modelEntries = Object.entries(placement.models);
  const loadingConcurrency = isConstrainedDevice ? 2 : 4;
  const templateEntries = await mapWithConcurrency(
    modelEntries,
    loadingConcurrency,
    async ([key, config]) => {
      const gltf = await gltfLoader.loadAsync(config.url);
      return [key, prepareTemplate(gltf.scene, config.targetHeight, key)];
    },
  );
  const templates = Object.fromEntries(templateEntries);

  for (const instance of placement.instances) {
    addInstance(instance, placement.models[instance.asset], templates[instance.asset]);
  }

  const mobileContactShadowInstances =
    addMobileContactShadows(
      placement.instances,
      placement,
      templates,
      "core",
      coreRoot,
    ) +
    addMobileContactShadows(
      placement.instances,
      placement,
      templates,
      "environment",
      environmentRoot,
    );

  const perAssetInstances = placement.instances.reduce((counts, instance) => {
    counts[instance.asset] = (counts[instance.asset] ?? 0) + 1;
    return counts;
  }, {});
  const uniqueTriangles = Object.values(templates).reduce((sum, entry) => sum + entry.triangles, 0);
  const renderedTriangles = Object.entries(perAssetInstances).reduce(
    (sum, [asset, count]) => sum + templates[asset].triangles * count,
    0,
  );
  const report = {
    ready: true,
    floor: "2048x1152 v10 concept-matched grass",
    webOptimized: true,
    textureResolution: 1024,
    lightingPreset: "pastel-garden-v3-muted",
    toneMapping: "Neutral",
    toneMappingExposure: renderer.toneMappingExposure,
    floorSaturation,
    texturedMaterialAmbientLift: 0.045,
    perimeterWallAmbientLift: 0.28,
    roundedPlanterAmbientLift: 0.13,
    naturalMaterialMaxMetalness: 0.12,
    shadowMode: isConstrainedDevice ? "static-PCFSoftShadowMap+contact" : "PCFSoftShadowMap",
    shadowMapSize: isConstrainedDevice ? 1024 : 2048,
    shadowMapAutoUpdate: renderer.shadowMap.autoUpdate,
    mobileContactShadowInstances,
    constrainedDevice: isConstrainedDevice,
    portraitMobile: isPortraitMobile,
    loadingConcurrency,
    uniqueModels: modelEntries.length,
    instances: placement.instances.length,
    coreInstances: placement.instances.filter(
      (instance) => placement.models[instance.asset].category === "core",
    ).length,
    environmentInstances: placement.instances.filter(
      (instance) => placement.models[instance.asset].category === "environment",
    ).length,
    perAssetInstances,
    uniqueTriangles,
    renderedTriangles,
    modelSizes: Object.fromEntries(
      Object.entries(templates).map(([key, entry]) => [
        key,
        entry.size.map((value) => Number(value.toFixed(3))),
      ]),
    ),
  };

  statsElement.textContent = `${report.uniqueModels} GLBs · ${report.coreInstances} core + ${report.environmentInstances} environment · ${report.renderedTriangles.toLocaleString()} rendered tris`;
  validationElement.textContent = JSON.stringify(report);
  document.body.dataset.ready = "true";
  window.__ARENA_READY__ = true;
  window.__ARENA_REPORT__ = report;
  progress.textContent = "100%";
  loading.classList.add("hidden");
  if (isConstrainedDevice) renderer.shadowMap.needsUpdate = true;
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setCameraView(button.dataset.view));
});

document.querySelector("#core-objects").addEventListener("change", (event) => {
  coreRoot.visible = event.currentTarget.checked;
  if (isConstrainedDevice) renderer.shadowMap.needsUpdate = true;
});

document.querySelector("#environment").addEventListener("change", (event) => {
  environmentRoot.visible = event.currentTarget.checked;
  if (isConstrainedDevice) renderer.shadowMap.needsUpdate = true;
});

document.querySelector("#effects").addEventListener("change", (event) => {
  setEffectsVisible(event.currentTarget.checked);
});

document.querySelector("#reference").addEventListener("change", (event) => {
  referenceCard.classList.toggle("hidden", !event.currentTarget.checked);
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

try {
  await buildScene();
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  window.__ARENA_READY__ = false;
  window.__ARENA_ERROR__ = message;
  validationElement.textContent = JSON.stringify({ ready: false, error: message });
  document.body.dataset.ready = "false";
  loading.querySelector("strong").textContent = "Scene load failed";
  progress.textContent = message;
  console.error(error);
}

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
