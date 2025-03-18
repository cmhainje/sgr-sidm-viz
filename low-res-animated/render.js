import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { GUI } from "lil-gui";

function generateTexture() {
  var size = 128;

  // create canvas
  var canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  // get context
  var context = canvas.getContext("2d");

  // define circle size
  var centerX = size / 2;
  var centerY = size / 2;
  var radius = size / 2;

  // draw circle
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
  context.closePath();
  context.fillStyle = "#FFFFFF";
  context.fill();

  // make into a texture
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  return texture;
}

const texture = generateTexture();

class PointCloudAnimator {
  constructor(path, partType) {
    this.path = path;
    this.pt = partType;

    this.snapshots = [];
    this.currentIndex = 0;
    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.4,
      opacity: 1.0,
      transparent: false,
      map: texture,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });
    this.mesh = new THREE.Points(this.geometry, this.material);

    this.isInitialized = false;

    this.playing = false;
    this.playbackSpeed = 1.0;
    this.currentTime = 0;
    this.frameTime = 1 / 30;
    this.alpha = 0;

    this.snapshotBuffer = null;
  }

  async loadSnapshot(index) {
    if (this.snapshotBuffer === null) {
      console.error("trying to load snapshot before snapshotBuffer is read");
      return null;
    }
    const start = 16 + index * this.snapshotSize;
    return new Float32Array(
      this.snapshotBuffer,
      start,
      this.pointsPerSnapshot * 3
    );
  }

  updatePointCloud(data) {
    this.geometry.setAttribute("position", new THREE.BufferAttribute(data, 3));
    this.geometry.attributes.position.needsUpdate = true;
  }

  async seekToFrame(frame) {
    frame = Math.min(frame, this.maxSnap);
    this.currentIndex = frame;
    this.currentTime = this.currentIndex * this.frameTime;

    this.currentSnapshot = await this.loadSnapshot(frame);
    this.nextSnapshot = await this.loadSnapshot(
      Math.min(frame + 1, this.maxSnap)
    );
    this.updatePointCloud(this.currentSnapshot);
  }

  async interpolatePositions(from, to, alpha) {
    const positions = new Float32Array(from.length);
    for (let i = 0; i < from.length; i++) {
      positions[i] = from[i] + (to[i] - from[i]) * alpha;
    }
    return positions;
  }

  async initialize() {
    this.snapshotBuffer = await (
      await fetch(`${import.meta.env.BASE_URL}${this.path}`)
    ).arrayBuffer();

    const headerView = new DataView(this.snapshotBuffer, 0, 16);
    this.maxSnap = headerView.getUint32(0, true) - 1;
    this.pointsPerSnapshot = headerView.getUint32(4, true);
    this.bytesPerPoint = headerView.getUint32(8, true);
    this.snapshotSize = this.pointsPerSnapshot * this.bytesPerPoint;

    const initialData = await this.loadSnapshot(0);
    if (initialData) {
      this.updatePointCloud(initialData);
      this.isInitialized = true;
    }
    return this.isInitialized;
  }

  async animate(deltaTime) {
    if (!this.isInitialized || !this.playing) return;
    if (!params.playing) {
      this.playing = params.playing;
      return;
    }

    this.currentTime += deltaTime * this.playbackSpeed;
    const frame = Math.floor(this.currentTime / this.frameTime);
    this.alpha = (this.currentTime % this.frameTime) / this.frameTime;

    if (frame !== this.currentIndex) {
      this.currentIndex = frame;
      params.frame = frame;

      // Stop at the last frame
      if (this.currentIndex >= this.maxSnap) {
        this.currentIndex = this.maxSnap;
        this.playing = false;
        return;
      }

      // Load current and next frame
      this.currentSnapshot = await this.loadSnapshot(this.currentIndex);
      // For the last frame, use the same snapshot for interpolation target
      const nextIndex = Math.min(this.currentIndex + 1, this.maxSnap);
      this.nextSnapshot = await this.loadSnapshot(nextIndex);
    }

    if (this.currentSnapshot && this.nextSnapshot) {
      const interpolatedPositions = await this.interpolatePositions(
        this.currentSnapshot,
        this.nextSnapshot,
        this.currentIndex === this.maxSnap ? 0 : this.alpha
      );
      this.updatePointCloud(interpolatedPositions);
    }
  }
}

const scene = new THREE.Scene();
const ratio = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(75, ratio, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);
const buffer = await (
  await fetch(`${import.meta.env.BASE_URL}data/mw_disk.bin`)
).arrayBuffer();
const positions = new Float32Array(buffer);
const mwGeo = new THREE.BufferGeometry();
mwGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const mwPts = new THREE.Points(
  mwGeo,
  new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.1,
    opacity: 0.4,
    transparent: true,
    map: texture,
    blending: THREE.AdditiveBlending,
    depthTest: false,
  })
);
scene.add(mwPts);

const sunGeo = new THREE.BufferGeometry();
const vertex = new Float32Array([-8.0, 0.0, 0.0]);
sunGeo.setAttribute("position", new THREE.BufferAttribute(vertex, 3));
const sunPt = new THREE.Points(
  sunGeo,
  new THREE.PointsMaterial({
    color: 0xfeb24c,
    size: 2,
    opacity: 1,
    transparent: false,
    map: texture,
    blending: THREE.AdditiveBlending,
    depthTest: false,
  })
);
scene.add(sunPt);

const cdmStar = new PointCloudAnimator("data/cdm_lr_star.bin", "star");
scene.add(cdmStar.mesh);

const cdmDark = new PointCloudAnimator("data/cdm_lr_dark.bin", "dark");
scene.add(cdmDark.mesh);

const sidmStar = new PointCloudAnimator("data/sidm_lr_star.bin", "star");
scene.add(sidmStar.mesh);

const sidmDark = new PointCloudAnimator("data/sidm_lr_dark.bin", "dark");
scene.add(sidmDark.mesh);

camera.position.y = -200;
camera.up = new THREE.Vector3(0, 0, 1);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 1;
controls.maxDistance = 300;
controls.saveState();

const params = {
  model: 0,
  stars: true,
  darkMatter: false,
  playing: false,
  frame: 0,
  speed: 1.0,
  ended: false,
  particleSize: 0.4,
  cdmStarColor: "#66ccee",
  cdmDarkColor: "#ee6677",
  sidmStarColor: "#ccbb44",
  sidmDarkColor: "#aa3377",
  play: () => {
    if (params.ended) {
      params.frame = 0;
      cdmStar.seekToFrame(0);
      cdmDark.seekToFrame(0);
      sidmStar.seekToFrame(0);
      sidmDark.seekToFrame(0);
      params.ended = false;
    }
    const newValue = !params.playing;
    params.playing = newValue;

    cdmStar.playing = newValue;
    cdmDark.playing = newValue;
    sidmStar.playing = newValue;
    sidmDark.playing = newValue;

    window.dispatchEvent(new CustomEvent("playchange", { detail: newValue }));
  },
  resetCamera: () => {
    controls.reset();
  },
  resetSettings: () => {
    params.playing = false;
    window.dispatchEvent(new CustomEvent("playchange", { detail: false }));

    cdmStar.playing = false;
    cdmDark.playing = false;
    sidmStar.playing = false;
    sidmDark.playing = false;

    gui.reset();
  },
};

cdmStar.material.color.set(params.cdmStarColor);
cdmDark.material.color.set(params.cdmDarkColor);
sidmStar.material.color.set(params.sidmStarColor);
sidmDark.material.color.set(params.sidmDarkColor);

const gui = new GUI();

const newContainer = document.createElement("div");
newContainer.style = "margin: 4px 0; padding: 0 4px;";
const newDiv = document.createElement("div");
newDiv.className = "gui-message";
newDiv.innerHTML = `
    <p><b>Low-resolution animation</b></p>
    <p><a href="/sgr-sidm-viz/">Go back to the landing page</a></p>
    <p><a href="/sgr-sidm-viz/high-res-still/">Go to the high-resolution still</a></p>
`;
newContainer.append(newDiv);
gui.$children.prepend(newContainer);

const playButton = gui.add(params, "play").name("Play");

gui
  .add(params, "speed", 0.1, 5)
  .onChange((value) => {
    cdmStar.playbackSpeed = value;
    cdmDark.playbackSpeed = value;
    sidmStar.playbackSpeed = value;
    sidmDark.playbackSpeed = value;
  })
  .name("Speed");

const frameController = gui
  .add(params, "frame", 0, 442)
  .step(1)
  .onChange((value) => {
    cdmStar.seekToFrame(value);
    cdmDark.seekToFrame(value);
    sidmStar.seekToFrame(value);
    sidmDark.seekToFrame(value);
  })
  .name("Frame number");

const modelController = gui
  .add(params, "model", { CDM: 0, SIDM: 1 })
  .name("DM model");
gui.add(params, "stars").name("Show stars");
gui.add(params, "darkMatter").name("Show DM");

gui.add(params, "resetCamera").name("Reset camera");
gui.add(params, "resetSettings").name("Reset settings");

const colorsFolder = gui.addFolder("Colors");
colorsFolder.addColor(params, "cdmStarColor").name("CDM star color");
colorsFolder.addColor(params, "cdmDarkColor").name("CDM DM color");
colorsFolder.addColor(params, "sidmStarColor").name("SIDM star color");
colorsFolder.addColor(params, "sidmDarkColor").name("SIDM DM color");
colorsFolder.close();

modelController.onChange((v) => {
  switch (v) {
    case 0:
      frameController.max(442);
      frameController.updateDisplay();
      break;
    case 1:
      frameController.max(416);
      frameController.updateDisplay();
      break;
    default:
      console.error("unknwon model controller value", v);
  }
});

window.addEventListener("playchange", (e) => {
  playButton.name(e.detail ? "Pause" : "Play");
});

let lastTime = 0;

function animate(currentTime) {
  const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
  lastTime = currentTime;

  controls.update();

  cdmStar.mesh.visible = params.model === 0 && params.stars;
  cdmDark.mesh.visible = params.model === 0 && params.darkMatter;
  sidmStar.mesh.visible = params.model === 1 && params.stars;
  sidmDark.mesh.visible = params.model === 1 && params.darkMatter;

  cdmStar.animate(deltaTime);
  cdmDark.animate(deltaTime);
  sidmStar.animate(deltaTime);
  sidmDark.animate(deltaTime);

  if (
    params.playing &&
    ((params.model === 0 && !cdmStar.playing) ||
      (params.model === 1 && !sidmStar.playing))
  ) {
    params.playing = false;
    params.ended = true;
    window.dispatchEvent(new CustomEvent("playchange", { detail: false }));
  }

  frameController.updateDisplay();

  renderer.render(scene, camera);
}

async function init() {
  await Promise.all([
    cdmStar.initialize(),
    cdmDark.initialize(),
    sidmStar.initialize(),
    sidmDark.initialize(),
  ]);

  lastTime = performance.now();

  // Start animation loop only after initialization
  renderer.setAnimationLoop(animate);
}

await init();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
});
