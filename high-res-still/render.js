import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { GUI } from "lil-gui";

async function loadPositions(filename) {
  const buffer = await (
    await fetch(`${import.meta.env.BASE_URL}${filename}`)
  ).arrayBuffer();
  const positions = new Float32Array(buffer);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function generateTexture() {
  var size = 128;

  // create canvas
  var canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  // get context
  var context = canvas.getContext("2d");

  // draw circle
  var centerX = size / 2;
  var centerY = size / 2;
  var radius = size / 2;

  context.beginPath();
  context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
  context.closePath();
  context.fillStyle = "#FFFFFF";
  context.fill();

  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  return texture;
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

const texture = generateTexture();

function makeMaterial(size = 0.3, opacity = 1) {
  return new THREE.PointsMaterial({
    color: 0xffffff,
    size,
    opacity,
    transparent: opacity < 1,
    map: texture,
    blending: THREE.AdditiveBlending,
    depthTest: false,
  });
}

const materials = {
  mw: makeMaterial(0.1, 0.4),
  sun: makeMaterial(2),
  cdmStar: makeMaterial(),
  cdmDark: makeMaterial(),
  sidmStar: makeMaterial(),
  sidmDark: makeMaterial(),
};

// Load the data
const mwGeo = await loadPositions("data/mw_disk.bin");
const mwPts = new THREE.Points(mwGeo, materials.mw);
scene.add(mwPts);

const cdmStarGeo = await loadPositions("data/cdm_star.bin");
const cdmStarPts = new THREE.Points(cdmStarGeo, materials.cdmStar);
scene.add(cdmStarPts);

const cdmDarkGeo = await loadPositions("data/cdm_dark.bin");
const cdmDarkPts = new THREE.Points(cdmDarkGeo, materials.cdmDark);
cdmDarkPts.visible = false;
scene.add(cdmDarkPts);

const sidmStarGeo = await loadPositions("data/sidm_star.bin");
const sidmStarPts = new THREE.Points(sidmStarGeo, materials.sidmStar);
sidmStarPts.visible = false;
scene.add(sidmStarPts);

const sidmDarkGeo = await loadPositions("data/sidm_dark.bin");
const sidmDarkPts = new THREE.Points(sidmDarkGeo, materials.sidmDark);
sidmDarkPts.visible = false;
scene.add(sidmDarkPts);

const sunGeo = new THREE.BufferGeometry();
const vertex = new Float32Array([-8.0, 0.0, 0.0]);
sunGeo.setAttribute("position", new THREE.BufferAttribute(vertex, 3));
materials.sun.color.set(0xfeb24c);
const sunPts = new THREE.Points(sunGeo, materials.sun);
scene.add(sunPts);

camera.position.y = -200;
camera.up = new THREE.Vector3(0, 0, 1);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth rotation
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 1;
controls.maxDistance = 300;
controls.saveState();

const gui = new GUI();
const settings = {
  resetCamera: () => {
    controls.reset();
  },
  resetSettings: () => {
    gui.reset();
  },
};

const newContainer = document.createElement("div");
newContainer.style = "margin: 4px 0; padding: 0 4px;";
const newDiv = document.createElement("div");
newDiv.className = "gui-message";
newDiv.innerHTML = `
    <p><b>High-resolution still</b></p>
    <p><a href="/sgr-sidm-viz/">Go back to the landing page</a></p>
    <p><a href="/sgr-sidm-viz/low-res-animated/">Go to the low-resolution animation</a></p>
`;
newContainer.append(newDiv);
gui.$children.prepend(newContainer);

gui.add(settings, "resetCamera").name("Reset camera");
gui.add(settings, "resetSettings").name("Reset settings");
const cdmSettings = {
  stars: true,
  starColor: "#66ccee",
  darkMatter: false,
  darkColor: "#ee6677",
};
const cdmGui = gui.addFolder("CDM");
cdmGui.add(cdmSettings, "stars").name("Enable stars");
cdmGui.addColor(cdmSettings, "starColor").name("Star color");
cdmGui.add(cdmSettings, "darkMatter").name("Enable DM");
cdmGui.addColor(cdmSettings, "darkColor").name("DM color");

const sidmSettings = {
  stars: false,
  starColor: "#ccbb44",
  darkMatter: false,
  darkColor: "#aa3377",
};
const sidmGui = gui.addFolder("SIDM");
sidmGui.add(sidmSettings, "stars").name("Enable stars");
sidmGui.addColor(sidmSettings, "starColor").name("Star color");
sidmGui.add(sidmSettings, "darkMatter").name("Enable DM");
sidmGui.addColor(sidmSettings, "darkColor").name("DM color");

function animate() {
  // update visibilities
  cdmStarPts.visible = cdmSettings.stars;
  cdmDarkPts.visible = cdmSettings.darkMatter;
  sidmStarPts.visible = sidmSettings.stars;
  sidmDarkPts.visible = sidmSettings.darkMatter;

  // update colors
  materials.cdmStar.color.set(cdmSettings.starColor);
  materials.cdmDark.color.set(cdmSettings.darkColor);
  materials.sidmStar.color.set(sidmSettings.starColor);
  materials.sidmDark.color.set(sidmSettings.darkColor);

  controls.update();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
});
