import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib';
import './styles.css';

type BucketId = 'L3' | 'L2' | 'L1' | 'CTR' | 'R1' | 'R2' | 'R3';

type Bucket = {
  id: BucketId;
  points: number;
};

type TextPlane = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  mesh: THREE.Mesh;
};

type DisplayModule = TextPlane & {
  group: THREE.Group;
  material: THREE.MeshStandardMaterial;
};

type Chip = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: Array<{ x: number; y: number }>;
};

const buckets: Bucket[] = [
  { id: 'L3', points: 100 },
  { id: 'L2', points: 200 },
  { id: 'L1', points: 500 },
  { id: 'CTR', points: 1000 },
  { id: 'R1', points: 500 },
  { id: 'R2', points: 200 },
  { id: 'R3', points: 100 }
];

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Expected #game canvas.');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x070808, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x080a06, 0.035);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 1.18, 3.35);
camera.lookAt(0, 0, 0);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(10, 10);
const mouse01 = new THREE.Vector2(0.5, 0.5);
const terminalGroup = new THREE.Group();
const detailGroup = new THREE.Group();
scene.add(terminalGroup);
terminalGroup.add(detailGroup);
RectAreaLightUniformsLib.init();

const interactive: THREE.Object3D[] = [];
let dropButtonMesh: THREE.Mesh;
let keyLight: THREE.DirectionalLight;
let dropButtonBaseZ = 0;
let dropPressUntil = 0;
let isPressingDrop = false;
let activeChip: Chip | undefined;
let score = 0;
let startTime = performance.now();
let lastSecond = -1;
let reelAngle = 0;
let amberPhase = 0;
let progressPhase = 0;
let targetRotX = 0;
let targetRotY = 0;
let currentRotX = 0;
let currentRotY = 0;
const landings: Array<{ stamp: string; id: BucketId; points: number }> = [];
const distribution = new Map<BucketId, number>(buckets.map((bucket) => [bucket.id, 0]));
const stats = { L: 0, C: 0, R: 0 };
let fontsReady = false;

const screenCanvas = document.createElement('canvas');
screenCanvas.width = 512;
screenCanvas.height = 1024;
const screenCtx = mustContext(screenCanvas);
const screenTexture = new THREE.CanvasTexture(screenCanvas);
screenTexture.encoding = THREE.sRGBEncoding;
configureDisplayTexture(screenTexture);

const SW = 512;
const SH = 1024;
const PEG_ROWS = 8;
const PEG_COLS = 7;

const sharedPlasticNormalMap = makeNormalMap('plastic');
const sharedScratchNormalMap = makeNormalMap('scratch');
const sharedRoughnessMap = makeRoughnessMap('fingerprint');
const sharedDirtMap = makeDirtMap();
const sharedAoMap = makePanelAoMap();

const plasticMaterial = new THREE.MeshStandardMaterial({
  color: 0x31351f,
  roughness: 0.86,
  metalness: 0.04,
  normalMap: sharedPlasticNormalMap,
  roughnessMap: sharedRoughnessMap,
  aoMap: sharedDirtMap,
  aoMapIntensity: 1,
  normalScale: new THREE.Vector2(0.22, 0.22)
});

const faceMaterial = plasticMaterial.clone();
faceMaterial.color = new THREE.Color(0x2e3222);
faceMaterial.aoMap = sharedDirtMap;
faceMaterial.aoMapIntensity = 0.85;
faceMaterial.normalMap = null;
faceMaterial.roughnessMap = null;

const insetMaterial = new THREE.MeshStandardMaterial({
  color: 0x1c2014,
  roughness: 0.92,
  metalness: 0.02,
  aoMap: sharedAoMap,
  aoMapIntensity: 0.6,
  side: THREE.FrontSide
});

const rimMaterial = new THREE.MeshStandardMaterial({
  color: 0x3d4530,
  roughness: 0.68,
  metalness: 0.18
});

const darkMetal = new THREE.MeshStandardMaterial({
  color: 0x1c201a,
  roughness: 0.45,
  metalness: 0.82
});

const phosphor = new THREE.MeshStandardMaterial({
  color: 0x4dff91,
  emissive: 0x30ff70,
  emissiveIntensity: 0.6,
  roughness: 0.42,
  metalness: 0
});

const inactiveSegment = new THREE.MeshStandardMaterial({
  color: 0x112210,
  emissive: 0x30ff70,
  emissiveIntensity: 0,
  roughness: 0.8,
  metalness: 0
});

const displayHousingMaterial = new THREE.MeshStandardMaterial({
  color: 0x0e1208,
  roughness: 0.7,
  metalness: 0.25
});

const displayRimMaterial = new THREE.MeshStandardMaterial({
  color: 0x2a3020,
  roughness: 0.45,
  metalness: 0.55
});
const staticLabels: Array<{ plane: TextPlane; text: string; align: CanvasTextAlign; fontSize: number }> = [];
const NEON = '#76FFAA';
const NEON_SOFT = '#4DFF91';
const NEON_DIM = '#2FE06D';

const bucketMaterials: THREE.MeshStandardMaterial[] = [];
const reelObjects: THREE.Object3D[] = [];

let scoreDisplay: DisplayModule;
let reelStatusDisplay: DisplayModule;
let dropStatsDisplay: DisplayModule;
let landingLogDisplay: DisplayModule;
let distChartDisplay: DisplayModule;
let elapsedDisplay: DisplayModule;
let vuDisplay: DisplayModule;
let headerDisplay: TextPlane;
let footerDisplay: TextPlane;
let dropButtonLabel: TextPlane;
let bucketRowDisplay: TextPlane;
let vuLevels = [0.05, 0.08, 0.11, 0.14, 0.17, 0.2];
let litBucketIndex = -1;

buildLights();
buildTerminal();
buildPlinkoPegs();
inspectSceneGeometry();
document.fonts.load('400 20px "Share Tech Mono"').then(() => {
  fontsReady = true;
  initAllDisplays();
  startRenderLoop();
});

window.addEventListener('resize', resize);
window.addEventListener('mousemove', (event) => {
  mouse01.set(event.clientX / window.innerWidth, event.clientY / window.innerHeight);
  pointer.set(mouse01.x * 2 - 1, -(mouse01.y * 2 - 1));
  targetRotY = (event.clientX / window.innerWidth - 0.5) * 0.2;
  targetRotX = -(event.clientY / window.innerHeight - 0.5) * 0.12;
});
window.addEventListener('click', () => {
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(interactive, false)[0];
  if (hit?.object === dropButtonMesh) dropChip();
});
window.addEventListener('mousedown', () => {
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(interactive, false)[0];
  isPressingDrop = hit?.object === dropButtonMesh;
});
window.addEventListener('mouseup', () => {
  isPressingDrop = false;
});
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    dropChip();
  }
});

resize();

function buildLights(): void {
  keyLight = new THREE.DirectionalLight(0xffe4a0, 1.65);
  keyLight.position.set(-2.4, 3.8, 3.2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.0002;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const fill = new THREE.DirectionalLight(0x7f95b2, 0.72);
  fill.position.set(2.7, 1.25, 2.4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xb7c88f, 0.55);
  rim.position.set(0.4, 3.2, -3.4);
  scene.add(rim);

  const screenRect = new THREE.RectAreaLight(0x18e84a, 0.55, 0.65, 1.15);
  screenRect.position.set(0, 0.08, 0.65);
  screenRect.lookAt(0, 0.08, 0);
  terminalGroup.add(screenRect);

  scene.add(new THREE.AmbientLight(0x0c140a, 0.6));
}

function buildTerminal(): void {
  const chassis = new THREE.Mesh(makeRoundedBox(3.2, 2.2, 0.28, 0.03, 5), plasticMaterial);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  terminalGroup.add(chassis);

  const facePlate = new THREE.Mesh(makeRoundedBox(3.0, 2.0, 0.02, 0.026, 4), faceMaterial);
  facePlate.position.z = 0.15;
  facePlate.castShadow = true;
  facePlate.receiveShadow = true;
  terminalGroup.add(facePlate);

  addPanel(0.72, 1.7, -1.1, 0);
  addPanel(1.5, 1.9, 0.08, 0.05);
  addPanel(0.66, 1.7, 1.18, 0);

  buildHeaderFooter();
  buildCenterPanel();
  buildLeftPanel();
  buildRightPanel();
}

function addPanel(width: number, height: number, x: number, y: number): void {
  const panel = new THREE.Mesh(makeRoundedBox(width, height, 0.015, 0.018, 3), insetMaterial);
  panel.position.set(x, y, 0.146);
  panel.receiveShadow = true;
  terminalGroup.add(panel);

  const lipMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1e10,
    roughness: 0.62,
    metalness: 0.3,
    side: THREE.FrontSide
  });
  const t = 0.008;
  [
    [width + t * 2, t, 0, height / 2 + t / 2],
    [width + t * 2, t, 0, -height / 2 - t / 2],
    [t, height, -width / 2 - t / 2, 0],
    [t, height, width / 2 + t / 2, 0]
  ].forEach(([w, h, ox, oy]) => {
    const rim = new THREE.Mesh(makeRoundedBox(w, h, 0.018, 0.004, 2), lipMaterial);
    rim.position.set(x + ox, y + oy, 0.162);
    terminalGroup.add(rim);
  });

  const sx = width / 2 - 0.045;
  const sy = height / 2 - 0.045;
  addScrew(x - sx, y - sy);
  addScrew(x + sx, y - sy);
  addScrew(x - sx, y + sy);
  addScrew(x + sx, y + sy);
}

function buildHeaderFooter(): void {
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x252d18,
    roughness: 0.85,
    metalness: 0.05
  });
  const header = new THREE.Mesh(makeRoundedBox(3.0, 0.16, 0.03, 0.018, 3), railMat);
  header.position.set(0, 0.98, 0.19);
  terminalGroup.add(header);

  const footer = header.clone();
  footer.position.y = -0.98;
  terminalGroup.add(footer);

  headerDisplay = makeTextPlane(1024, 128, 2.72, 0.11, 0.18);
  headerDisplay.mesh.position.set(0, 0.98, 0.212);
  terminalGroup.add(headerDisplay.mesh);
  footerDisplay = makeTextPlane(1024, 96, 2.72, 0.105, 0.18);
  footerDisplay.mesh.position.set(0, -0.98, 0.212);
  terminalGroup.add(footerDisplay.mesh);

  const lightMats = [
    new THREE.MeshStandardMaterial({ color: 0x3a0a0a, emissive: 0x330000, emissiveIntensity: 0.08, roughness: 0.35 }),
    new THREE.MeshStandardMaterial({ color: 0x2a1500, emissive: 0xff9a20, emissiveIntensity: 0.15, roughness: 0.35 }),
    new THREE.MeshStandardMaterial({ color: 0x0a2010, emissive: 0x30ff70, emissiveIntensity: 0.1, roughness: 0.35 })
  ];
  lightMats.forEach((mat, index) => {
    const lamp = makeFrontCylinder(0.018, 0.012, mat);
    lamp.position.set(-0.04 + index * 0.04, 0.98, 0.222);
    lamp.name = index === 1 ? 'amberLight' : '';
    detailGroup.add(lamp);
  });
}

function buildCenterPanel(): void {
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 1.3),
    new THREE.MeshStandardMaterial({
      map: screenTexture,
      emissiveMap: screenTexture,
      emissive: 0x30ff70,
      emissiveIntensity: 0.08,
      roughness: 0.1,
      metalness: 0
    })
  );
  screen.position.set(0, 0.2, 0.185);
  terminalGroup.add(screen);

  addScreenBezel(0, 0.2, 0.201);
  buildBuckets();
  buildDropControls();
}

function buildBuckets(): void {
  buckets.forEach((bucket, index) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x232818,
      roughness: 0.9,
      metalness: 0.03,
      emissive: 0x30ff70,
      emissiveIntensity: 0
    });
    const mesh = new THREE.Mesh(makeRoundedBox(0.095, 0.06, 0.018, 0.008, 2), mat);
    mesh.position.set(-0.3 + index * 0.1, -0.52, 0.205);
    bucketMaterials.push(mat);
    terminalGroup.add(mesh);
  });
  bucketRowDisplay = makeTextPlane(512, 128, 0.72, 0.1, 0.18);
  bucketRowDisplay.mesh.position.set(0, -0.52, 0.219);
  terminalGroup.add(bucketRowDisplay.mesh);
}

function buildDropControls(): void {
  const wellMat = new THREE.MeshStandardMaterial({ color: 0x161810, roughness: 0.86, metalness: 0.08 });
  const knobMat = new THREE.MeshStandardMaterial({ color: 0x1a1c10, roughness: 0.6, metalness: 0.3 });
  addKnob(-0.42, -0.78, 'FREQ', wellMat, knobMat, -0.55);
  addKnob(0.42, -0.78, 'BIAS', wellMat, knobMat, 0.75);

  const dropMat = new THREE.MeshStandardMaterial({
    color: 0x30351f,
    roughness: 0.72,
    metalness: 0.08,
    roughnessMap: makeButtonRoughnessMap()
  });
  dropButtonMesh = new THREE.Mesh(makeRoundedBox(0.42, 0.17, 0.055, 0.025, 4), dropMat);
  dropButtonMesh.position.set(0, -0.78, 0.23);
  dropButtonBaseZ = dropButtonMesh.position.z;
  dropButtonMesh.castShadow = true;
  interactive.push(dropButtonMesh);
  terminalGroup.add(dropButtonMesh);
  const collar = new THREE.Mesh(
    makeRoundedBox(0.48, 0.22, 0.018, 0.035, 4),
    new THREE.MeshStandardMaterial({
      color: 0x15190e,
      roughness: 0.42,
      metalness: 0.68
    })
  );
  collar.position.set(0, -0.78, 0.215);
  terminalGroup.add(collar);
  dropButtonLabel = makeTextPlane(256, 128, 0.34, 0.095, 0.8);
  const labelMat = dropButtonLabel.mesh.material as THREE.MeshStandardMaterial;
  labelMat.transparent = false;
  labelMat.depthTest = false;
  labelMat.emissiveIntensity = 0.8;
  dropButtonLabel.mesh.renderOrder = 10;
  dropButtonLabel.mesh.position.set(0, -0.78, 0.292);
  terminalGroup.add(dropButtonLabel.mesh);
}

function buildLeftPanel(): void {
  vuDisplay = makeDisplayModule(0.54, 0.4, 512, 384, 0.36);
  vuDisplay.group.position.set(-1.1, 0.46, 0.206);
  terminalGroup.add(vuDisplay.group);

  scoreDisplay = makeDisplayModule(0.54, 0.13, 512, 128, 0.42);
  scoreDisplay.group.position.set(-1.1, 0.08, 0.206);
  terminalGroup.add(scoreDisplay.group);

  const reelMat = new THREE.MeshStandardMaterial({ color: 0x2c3020, roughness: 0.7, metalness: 0.2 });
  addReel(-1.19, -0.18, reelMat);
  addReel(-1.01, -0.18, reelMat);

  reelStatusDisplay = makeDisplayModule(0.54, 0.1, 512, 96, 0.34);
  reelStatusDisplay.group.position.set(-1.1, -0.39, 0.206);
  terminalGroup.add(reelStatusDisplay.group);

  dropStatsDisplay = makeDisplayModule(0.54, 0.2, 512, 192, 0.34);
  dropStatsDisplay.group.position.set(-1.1, -0.66, 0.206);
  terminalGroup.add(dropStatsDisplay.group);
}

function buildRightPanel(): void {
  landingLogDisplay = makeDisplayModule(0.58, 0.58, 512, 512, 0.34);
  landingLogDisplay.group.position.set(1.18, 0.4, 0.206);
  terminalGroup.add(landingLogDisplay.group);

  distChartDisplay = makeDisplayModule(0.58, 0.58, 512, 512, 0.34);
  distChartDisplay.group.position.set(1.18, -0.28, 0.206);
  terminalGroup.add(distChartDisplay.group);

  elapsedDisplay = makeDisplayModule(0.54, 0.1, 512, 96, 0.42);
  elapsedDisplay.group.position.set(1.18, -0.76, 0.206);
  terminalGroup.add(elapsedDisplay.group);

  console.info('Right panel module widths');
  [landingLogDisplay.group, distChartDisplay.group, elapsedDisplay.group].forEach((child) => {
    const size = new THREE.Box3().setFromObject(child).getSize(new THREE.Vector3());
    console.info(child.name || 'right-panel-child', size.x, size.y, size.z);
  });
}

function addScreenBezel(x: number, y: number, z: number): void {
  const outerW = 0.8;
  const outerH = 1.42;
  const innerW = 0.68;
  const innerH = 1.28;
  const frameShape = new THREE.Shape();
  frameShape.moveTo(-outerW / 2, -outerH / 2);
  frameShape.lineTo(outerW / 2, -outerH / 2);
  frameShape.lineTo(outerW / 2, outerH / 2);
  frameShape.lineTo(-outerW / 2, outerH / 2);
  frameShape.lineTo(-outerW / 2, -outerH / 2);
  const hole = new THREE.Path();
  hole.moveTo(-innerW / 2, -innerH / 2);
  hole.lineTo(innerW / 2, -innerH / 2);
  hole.lineTo(innerW / 2, innerH / 2);
  hole.lineTo(-innerW / 2, innerH / 2);
  hole.lineTo(-innerW / 2, -innerH / 2);
  frameShape.holes.push(hole);
  const geometry = prepareGeometry(
    new THREE.ExtrudeGeometry(frameShape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.004,
      bevelSegments: 2
    })
  );
  geometry.center();
  const bezelMaterial = new THREE.MeshStandardMaterial({
    color: 0x141810,
    roughness: 0.42,
    metalness: 0.5
  });
  const bezel = new THREE.Mesh(geometry, bezelMaterial);
  bezel.position.set(x, y, z);
  bezel.castShadow = true;
  terminalGroup.add(bezel);
}

function addHousing(x: number, y: number, w: number, h: number): void {
  const mesh = new THREE.Mesh(makeRoundedBox(w, h, 0.02, 0.012, 2), darkMetal);
  mesh.position.set(x, y, 0.202);
  terminalGroup.add(mesh);
}

function addKnob(x: number, y: number, label: string, wellMat: THREE.Material, knobMat: THREE.Material, angle: number): void {
  const well = makeFrontCylinder(0.115, 0.018, wellMat);
  well.position.set(x, y, 0.205);
  terminalGroup.add(well);
  const knob = makeFrontCylinder(0.09, 0.025, knobMat);
  knob.position.set(x, y, 0.228);
  terminalGroup.add(knob);
  const mark = new THREE.Mesh(makeRoundedBox(0.004, 0.06, 0.006, 0.0015, 1), phosphor.clone());
  mark.position.set(x + Math.sin(angle) * 0.02, y + Math.cos(angle) * 0.02, 0.246);
  mark.rotation.z = -angle;
  terminalGroup.add(mark);
  addLabelPlane(label, 0.18, 0.04, x, y - 0.15, 0.21, 'center');
}

function addReel(x: number, y: number, mat: THREE.Material): void {
  const reel = new THREE.Group();
  const disc = makeFrontCylinder(0.09, 0.015, mat);
  reel.add(disc);
  for (let i = 0; i < 3; i += 1) {
    const spoke = new THREE.Mesh(makeRoundedBox(0.018, 0.095, 0.012, 0.003, 1), darkMetal);
    spoke.rotation.z = (Math.PI * 2 * i) / 3;
    spoke.position.z = 0.012;
    reel.add(spoke);
  }
  reel.position.set(x, y, 0.218);
  reelObjects.push(reel);
  detailGroup.add(reel);
}

function addScrew(x: number, y: number): void {
  const screw = new THREE.Mesh(makeCountersunkScrewGeometry(), new THREE.MeshStandardMaterial({
    color: 0x1c2018,
    roughness: 0.3,
    metalness: 0.8
  }));
  screw.rotation.x = Math.PI / 2;
  screw.position.set(x, y, 0.19);
  screw.castShadow = false;
  detailGroup.add(screw);
  const crossA = new THREE.Mesh(makeRoundedBox(0.025, 0.003, 0.002, 0.001, 1), darkMetal);
  const crossB = crossA.clone();
  crossB.rotation.z = Math.PI / 2;
  crossA.position.set(x, y, 0.197);
  crossB.position.set(x, y, 0.198);
  detailGroup.add(crossA, crossB);
}

function makeFrontCylinder(radius: number, depth: number, material: THREE.Material, segments = 32, topRadius = radius): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(topRadius, radius, depth, segments), material);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function makeCountersunkScrewGeometry(): THREE.BufferGeometry {
  const points = [
    new THREE.Vector2(0.004, -0.004),
    new THREE.Vector2(0.015, -0.003),
    new THREE.Vector2(0.019, 0.001),
    new THREE.Vector2(0.017, 0.006),
    new THREE.Vector2(0.009, 0.008),
    new THREE.Vector2(0.002, 0.008)
  ];
  return prepareGeometry(new THREE.LatheGeometry(points, 28));
}

function makeRoundedBox(width: number, height: number, depth: number, radius: number, segments = 3): THREE.BufferGeometry {
  const r = Math.min(radius, width / 2 - 0.0001, height / 2 - 0.0001);
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2 + r, -height / 2);
  shape.lineTo(width / 2 - r, -height / 2);
  shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + r);
  shape.lineTo(width / 2, height / 2 - r);
  shape.quadraticCurveTo(width / 2, height / 2, width / 2 - r, height / 2);
  shape.lineTo(-width / 2 + r, height / 2);
  shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - r);
  shape.lineTo(-width / 2, -height / 2 + r);
  shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + r, -height / 2);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: Math.min(0.006, depth * 0.4),
    bevelSize: Math.min(0.006, r * 0.65),
    bevelSegments: segments
  });
  geometry.center();
  return prepareGeometry(geometry);
}

function prepareGeometry<T extends THREE.BufferGeometry>(geometry: T): T {
  geometry.computeVertexNormals();
  const uv = geometry.getAttribute('uv');
  if (uv) geometry.setAttribute('uv2', uv.clone());
  return geometry;
}

function addLabelPlane(
  text: string,
  width: number,
  height: number,
  x: number,
  y: number,
  z: number,
  align: CanvasTextAlign,
  fontSize = 34,
  canvasWidth = 256,
  canvasHeight = 64
): THREE.Mesh {
  const label = makeTextPlane(canvasWidth, canvasHeight, width, height);
  staticLabels.push({ plane: label, text, align, fontSize });
  label.mesh.position.set(x, y, z);
  terminalGroup.add(label.mesh);
  return label.mesh;
}

function buildPlinkoPegs(): void {
  // Pegs are drawn on the screen canvas; this function exists to keep the build stages mirrored.
}

function inspectSceneGeometry(): void {
  const removable: THREE.Object3D[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const bounds = new THREE.Box3().setFromObject(object);
    const tooLarge =
      Math.abs(bounds.min.x) > 2 ||
      Math.abs(bounds.max.x) > 2 ||
      Math.abs(bounds.min.y) > 2 ||
      Math.abs(bounds.max.y) > 2 ||
      Math.abs(bounds.min.z) > 2 ||
      Math.abs(bounds.max.z) > 2;
    if (tooLarge) {
      console.warn('Removing rogue geometry outside terminal bounds:', object.name || object.uuid);
      removable.push(object);
    }
  });
  removable.forEach((object) => object.parent?.remove(object));
  console.info('Scene child count:', scene.children.length);
  console.info('Terminal child count:', terminalGroup.children.length);
}

function dropChip(): void {
  if (activeChip) return;
  dropPressUntil = performance.now() + 80;
  activeChip = {
    x: SW / 2 + (Math.random() - 0.5) * 42,
    y: 84,
    vx: (Math.random() - 0.5) * 2.2,
    vy: 1.6,
    trail: []
  };
}

function animate(now: number): void {
  currentRotX += (targetRotX - currentRotX) * 0.055;
  currentRotY += (targetRotY - currentRotY) * 0.055;
  terminalGroup.rotation.x = currentRotX;
  terminalGroup.rotation.y = currentRotY;
  terminalGroup.position.z = Math.abs(currentRotY) * 0.3 + Math.abs(currentRotX) * 0.2;

  amberPhase = (Math.sin(now / 700) + 1) * 0.25;
  const amber = terminalGroup.getObjectByName('amberLight') as THREE.Mesh | undefined;
  const amberMat = amber?.material as THREE.MeshStandardMaterial | undefined;
  if (amberMat) amberMat.emissiveIntensity = amberPhase;

  const pressedZ = dropButtonBaseZ - 0.01;
  const targetDropZ = isPressingDrop || now < dropPressUntil ? pressedZ : dropButtonBaseZ;
  dropButtonMesh.position.z = THREE.MathUtils.lerp(dropButtonMesh.position.z, targetDropZ, 0.3);

  if (activeChip) {
    updatePhysics();
    updateVu();
    reelAngle += 0.12;
    progressPhase = (progressPhase + 0.18) % 10;
  }

  reelObjects[0].rotation.z = reelAngle;
  drawFooter(footerDisplay.context, activeChip ? progressPhase / 10 : 0, activeChip ? 'ACTIVE' : 'STANDBY');
  footerDisplay.texture.needsUpdate = true;
  keyLight.position.x = -2.4 + currentRotY * -1.5;
  keyLight.position.y = 3.8 + currentRotX * -1.0;

  const elapsed = Math.floor((performance.now() - startTime) / 1000);
  if (fontsReady && elapsed !== lastSecond) {
    lastSecond = elapsed;
    updateAllReadouts(false);
  }

  if (fontsReady) drawScreen();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updatePhysics(): void {
  if (!activeChip) return;

  activeChip.vy += 0.35;
  activeChip.vx *= 0.993;
  activeChip.vy *= 0.996;
  const speed = Math.hypot(activeChip.vx, activeChip.vy);
  if (speed > 16) {
    activeChip.vx = (activeChip.vx / speed) * 16;
    activeChip.vy = (activeChip.vy / speed) * 16;
  }

  activeChip.x += activeChip.vx;
  activeChip.y += activeChip.vy;
  if (activeChip.x < 14) {
    activeChip.x = 14;
    activeChip.vx = Math.abs(activeChip.vx) * 0.55;
  }
  if (activeChip.x > SW - 14) {
    activeChip.x = SW - 14;
    activeChip.vx = -Math.abs(activeChip.vx) * 0.55;
  }

  for (const peg of getPegs()) {
    const dx = activeChip.x - peg.x;
    const dy = activeChip.y - peg.y;
    const dist = Math.hypot(dx, dy);
    const min = 22;
    if (dist > 0 && dist < min) {
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = min - dist;
      activeChip.x += nx * overlap;
      activeChip.y += ny * overlap;
      const dot = activeChip.vx * nx + activeChip.vy * ny;
      if (dot < 0) {
        activeChip.vx -= (1 + 0.45) * dot * nx;
        activeChip.vy -= (1 + 0.45) * dot * ny;
        activeChip.vx += (Math.random() - 0.5) * 1.7;
      }
    }
  }

  activeChip.trail.unshift({ x: activeChip.x, y: activeChip.y });
  activeChip.trail = activeChip.trail.slice(0, 8);

  if (activeChip.y >= SH - 14) {
    const index = Math.max(0, Math.min(6, Math.floor(activeChip.x / (SW / 7))));
    const bucket = buckets[index];
    landChip(bucket);
  }
}

function landChip(bucket: Bucket): void {
  score += bucket.points;
  distribution.set(bucket.id, (distribution.get(bucket.id) ?? 0) + 1);
  if (bucket.id === 'CTR') stats.C += 1;
  else if (bucket.id.startsWith('L')) stats.L += 1;
  else stats.R += 1;
  landings.unshift({ stamp: formatTime(Math.floor((performance.now() - startTime) / 1000)), id: bucket.id, points: bucket.points });
  landings.splice(8);
  litBucketIndex = buckets.indexOf(bucket);
  drawBucketRow(bucketRowDisplay.context, litBucketIndex);
  bucketRowDisplay.texture.needsUpdate = true;
  const mat = bucketMaterials[buckets.indexOf(bucket)];
  mat.emissiveIntensity = 0.8;
  window.setTimeout(() => fadeBucket(mat), 16);
  activeChip = undefined;
  updateAllReadouts(true);
}

function fadeBucket(mat: THREE.MeshStandardMaterial): void {
  mat.emissiveIntensity = Math.max(0, mat.emissiveIntensity - 0.025);
  if (mat.emissiveIntensity > 0) window.setTimeout(() => fadeBucket(mat), 16);
  else if (fontsReady) {
    litBucketIndex = -1;
    drawBucketRow(bucketRowDisplay.context, litBucketIndex);
    bucketRowDisplay.texture.needsUpdate = true;
  }
}

function drawScreen(): void {
  screenCtx.clearRect(0, 0, SW, SH);
  screenCtx.fillStyle = '#081208';
  screenCtx.fillRect(0, 0, SW, SH);

  screenCtx.fillStyle = 'rgba(0,0,0,0.10)';
  for (let y = 0; y < SH; y += 4) screenCtx.fillRect(0, y, SW, 1);

  const vignette = screenCtx.createRadialGradient(SW / 2, SH / 2, 150, SW / 2, SH / 2, 620);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
  screenCtx.fillStyle = vignette;
  screenCtx.fillRect(0, 0, SW, SH);

  for (const peg of getPegs()) {
    screenCtx.beginPath();
    screenCtx.fillStyle = '#1A6A38';
    screenCtx.strokeStyle = '#2A9A52';
    screenCtx.lineWidth = 1;
    screenCtx.arc(peg.x, peg.y, 8, 0, Math.PI * 2);
    screenCtx.fill();
    screenCtx.stroke();
  }

  if (activeChip) {
    [...activeChip.trail].reverse().forEach((point, index) => {
      screenCtx.globalAlpha = 0.05 + (index / Math.max(1, activeChip!.trail.length - 1)) * 0.3;
      screenCtx.fillStyle = '#4DFF91';
      screenCtx.beginPath();
      screenCtx.arc(point.x, point.y, 14, 0, Math.PI * 2);
      screenCtx.fill();
    });
    screenCtx.globalAlpha = 1;
    screenCtx.fillStyle = '#4DFF91';
    screenCtx.shadowColor = NEON;
    screenCtx.shadowBlur = 10;
    screenCtx.beginPath();
    screenCtx.arc(activeChip.x, activeChip.y, 14, 0, Math.PI * 2);
    screenCtx.fill();
    screenCtx.shadowBlur = 0;
    screenCtx.fillStyle = 'rgba(255,255,255,0.9)';
    screenCtx.beginPath();
    screenCtx.arc(activeChip.x, activeChip.y, 4, 0, Math.PI * 2);
    screenCtx.fill();
  }

  screenCtx.fillStyle = '#020802';
  screenCtx.fillRect(0, 0, SW, 80);
  screenCtx.fillStyle = '#4DFF91';
  screenCtx.font = '28px "Share Tech Mono", monospace';
  screenCtx.textBaseline = 'middle';
  screenCtx.textAlign = 'left';
  glowText(screenCtx, `SCORE: ${String(score).padStart(4, '0')}`, 20, 40, { color: NEON });

  screenCtx.strokeStyle = '#1A4A28';
  screenCtx.lineWidth = 1;
  for (let i = 1; i < 7; i += 1) {
    const x = (SW / 7) * i;
    screenCtx.beginPath();
    screenCtx.moveTo(x, 940);
    screenCtx.lineTo(x, 1000);
    screenCtx.stroke();
  }
  screenTexture.needsUpdate = true;
}

function updateAllReadouts(force: boolean): void {
  if (!fontsReady) return;
  drawScore(scoreDisplay.context, score);
  scoreDisplay.texture.needsUpdate = true;
  drawReelStatus(reelStatusDisplay.context, Boolean(activeChip));
  reelStatusDisplay.texture.needsUpdate = true;
  drawDropStats(dropStatsDisplay.context, stats.L, stats.C, stats.R);
  dropStatsDisplay.texture.needsUpdate = true;
  drawElapsed(elapsedDisplay.context, lastSecond < 0 ? 0 : lastSecond);
  elapsedDisplay.texture.needsUpdate = true;
  drawLandingLog();
  updateDistribution();
  if (force) updateVu();
}

function drawLandingLog(): void {
  drawLandingLogCanvas(
    landingLogDisplay.context,
    landings.map((entry) => ({ time: entry.stamp, slot: entry.id, pts: entry.points }))
  );
  landingLogDisplay.texture.needsUpdate = true;
}

function updateVu(): void {
  vuLevels = vuLevels.map((level, index) => {
    const target = activeChip ? 0.2 + Math.random() * 0.75 : 0.05 + index * 0.03;
    return THREE.MathUtils.lerp(level, target, activeChip ? 0.55 : 0.08);
  });
  drawVU(vuDisplay.context, vuLevels);
  vuDisplay.texture.needsUpdate = true;
}

function updateDistribution(): void {
  drawDistChart(distChartDisplay.context, buckets.map((bucket) => distribution.get(bucket.id) ?? 0));
  distChartDisplay.texture.needsUpdate = true;
}

function getPegs(): Array<{ x: number; y: number }> {
  const pegs: Array<{ x: number; y: number }> = [];
  const pegSpacingX = SW / (PEG_COLS + 1);
  const pegSpacingY = 780 / (PEG_ROWS + 1);
  for (let row = 0; row < PEG_ROWS; row += 1) {
    const offset = row % 2 === 0 ? 0 : pegSpacingX / 2;
    for (let col = 0; col < PEG_COLS; col += 1) {
      pegs.push({
        x: pegSpacingX + col * pegSpacingX + offset,
        y: 100 + (row + 1) * pegSpacingY
      });
    }
  }
  return pegs;
}

function makeTextPlane(canvasWidth: number, canvasHeight: number, worldWidth: number, worldHeight: number, emissiveIntensity = 0.2): TextPlane {
  const textCanvas = document.createElement('canvas');
  textCanvas.width = canvasWidth;
  textCanvas.height = canvasHeight;
  const context = mustContext(textCanvas);
  const texture = new THREE.CanvasTexture(textCanvas);
  texture.encoding = THREE.sRGBEncoding;
  configureDisplayTexture(texture);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: 0x76ffaa,
    emissiveIntensity,
    transparent: true,
    roughness: 0.24,
    metalness: 0
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldWidth, worldHeight), material);
  return { canvas: textCanvas, context, texture, mesh };
}

function makeDisplayModule(planeWidth: number, planeHeight: number, canvasWidth: number, canvasHeight: number, emissiveIntensity: number): DisplayModule {
  const display = makeTextPlane(canvasWidth, canvasHeight, planeWidth, planeHeight, emissiveIntensity);
  const group = new THREE.Group();
  const planeMaterial = display.mesh.material as THREE.MeshStandardMaterial;
  planeMaterial.color = new THREE.Color(0xffffff);
  planeMaterial.emissive = new THREE.Color(0x20ff60);
  planeMaterial.emissiveIntensity = emissiveIntensity;
  planeMaterial.roughness = 0.12;
  planeMaterial.metalness = 0;
  planeMaterial.normalMap = null;
  planeMaterial.roughnessMap = null;
  planeMaterial.aoMap = null;

  const housing = new THREE.Mesh(makeRoundedBox(planeWidth + 0.02, planeHeight + 0.02, 0.014, 0.004, 2), displayHousingMaterial);
  housing.position.z = -0.008;
  housing.castShadow = true;
  group.add(housing);

  const rim = new THREE.Mesh(makeRoundedBox(planeWidth + 0.014, planeHeight + 0.014, 0.003, 0.003, 2), displayRimMaterial);
  rim.position.z = 0.001;
  group.add(rim);

  display.mesh.position.z = 0.014;
  group.add(display.mesh);

  return {
    ...display,
    group,
    material: display.mesh.material as THREE.MeshStandardMaterial
  };
}

function initAllDisplays(): void {
  staticLabels.forEach(({ plane, text, align, fontSize }) => {
    drawDisplay(
      plane,
      text.split('\n').map((line, index, lines) => ({
        text: line,
        size: Math.min(fontSize, plane.canvas.height * (lines.length > 1 ? 0.32 : 0.48)),
        y: 0.5 + (index - (lines.length - 1) / 2) * 0.34,
        align,
        color: '#4DFF91'
      }))
    );
  });
  drawHeader(headerDisplay.context);
  headerDisplay.texture.needsUpdate = true;
  drawFooter(footerDisplay.context, 0, 'STANDBY');
  footerDisplay.texture.needsUpdate = true;
  drawDropBtn(dropButtonLabel.context);
  dropButtonLabel.texture.needsUpdate = true;
  drawBucketRow(bucketRowDisplay.context, litBucketIndex);
  bucketRowDisplay.texture.needsUpdate = true;
  drawScreen();
  updateAllReadouts(true);
}

function startRenderLoop(): void {
  requestAnimationFrame(animate);
}

function clearDisplay(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#030804';
  context.fillRect(0, 0, width, height);
  context.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < height; y += 4) context.fillRect(0, y, width, 1);
  const vignette = context.createRadialGradient(width / 2, height / 2, height * 0.2, width / 2, height / 2, height * 0.8);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}

function glowText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: { color?: string; blur?: number; alpha?: number } = {}
): void {
  context.save();
  context.shadowColor = options.color || NEON_SOFT;
  context.shadowBlur = options.blur ?? 10;
  context.globalAlpha = options.alpha ?? 0.55;
  context.fillText(text, x, y);
  context.globalAlpha = 1;
  context.shadowBlur = 0;
  context.fillText(text, x, y);
  context.restore();
}

function drawDisplay(plane: TextPlane, lines: Array<{ text: string; size: number; y: number; align?: CanvasTextAlign; color?: string }>): void {
  clearDisplay(plane.context, plane.canvas.width, plane.canvas.height);
  lines.forEach((line) => {
    plane.context.font = `400 ${line.size}px "Share Tech Mono"`;
    plane.context.fillStyle = line.color || NEON;
    plane.context.textBaseline = 'middle';
    plane.context.textAlign = line.align || 'left';
    const x = line.align === 'center' ? plane.canvas.width / 2 : line.align === 'right' ? plane.canvas.width - 12 : 12;
    glowText(plane.context, line.text, x, line.y * plane.canvas.height, { color: line.color || NEON });
  });
  plane.texture.needsUpdate = true;
}

function drawScore(context: CanvasRenderingContext2D, nextScore: number): void {
  clearDisplay(context, 512, 128);
  context.font = '400 22px "Share Tech Mono"';
  context.fillStyle = '#2A7A48';
  context.textAlign = 'left';
  context.textBaseline = 'top';
  glowText(context, 'SCORE_CTR', 20, 12, { color: NEON_DIM, blur: 7 });
  context.font = '400 72px "Share Tech Mono"';
  context.fillStyle = '#5DFF9A';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const value = String(nextScore).padStart(4, '0');
  glowText(context, value, 256, 82, { color: NEON, blur: 14, alpha: 0.7 });
  context.globalAlpha = 0.3;
  glowText(context, value, 256, 82, { color: NEON, blur: 18, alpha: 0.35 });
  context.globalAlpha = 1;
}

function drawReelStatus(context: CanvasRenderingContext2D, active: boolean): void {
  clearDisplay(context, 512, 96);
  context.font = '400 18px "Share Tech Mono"';
  context.fillStyle = '#2A7A48';
  context.textAlign = 'left';
  context.textBaseline = 'top';
  glowText(context, 'REEL_STATUS', 20, 8, { color: NEON_DIM, blur: 7 });
  context.font = '400 40px "Share Tech Mono"';
  context.fillStyle = active ? '#5DFF9A' : '#1A6A38';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  glowText(context, active ? 'ACTIVE' : 'STANDBY', 256, 62, { color: active ? NEON : NEON_DIM, blur: 12 });
}

function drawDropStats(context: CanvasRenderingContext2D, left: number, center: number, right: number): void {
  clearDisplay(context, 512, 192);
  context.font = '400 18px "Share Tech Mono"';
  context.fillStyle = '#2A7A48';
  context.textBaseline = 'top';
  context.textAlign = 'left';
  glowText(context, 'DROP_STATS', 20, 10, { color: NEON_DIM, blur: 7 });
  const rows: Array<[string, number]> = [
    ['L', left],
    ['C', center],
    ['R', right]
  ];
  rows.forEach(([label, value], index) => {
    const y = 50 + index * 46;
    context.font = '400 30px "Share Tech Mono"';
    context.fillStyle = '#3A8A58';
    context.textAlign = 'left';
    glowText(context, label, 30, y, { color: NEON_DIM, blur: 7 });
    context.fillStyle = '#5DFF9A';
    context.textAlign = 'right';
    glowText(context, String(value).padStart(2, '0'), 490, y, { color: NEON, blur: 10 });
    context.strokeStyle = '#1A4A28';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(20, y + 36);
    context.lineTo(492, y + 36);
    context.stroke();
  });
}

function drawLandingLogCanvas(context: CanvasRenderingContext2D, entries: Array<{ time: string; slot: string; pts: number }>): void {
  clearDisplay(context, 512, 512);
  context.font = '400 22px "Share Tech Mono"';
  context.fillStyle = '#2A7A48';
  context.textBaseline = 'top';
  context.textAlign = 'left';
  glowText(context, 'LANDING_LOG', 20, 14, { color: NEON_DIM, blur: 7 });
  context.strokeStyle = '#1A4A28';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(20, 44);
  context.lineTo(492, 44);
  context.stroke();

  if (entries.length === 0) {
    context.font = '400 24px "Share Tech Mono"';
    context.fillStyle = '#1A5A30';
    context.textAlign = 'center';
    glowText(context, '-- AWAITING DROP --', 256, 280, { color: NEON_DIM, blur: 9 });
    return;
  }

  entries.slice(-8).reverse().forEach((entry, index) => {
    const y = 60 + index * 56;
    context.font = '400 26px "Share Tech Mono"';
    context.fillStyle = '#2A7A48';
    context.textAlign = 'left';
    glowText(context, entry.time, 20, y, { color: NEON_DIM, blur: 7 });
    context.fillStyle = '#5DFF9A';
    context.textAlign = 'right';
    glowText(context, `${entry.slot} / ${entry.pts}`, 492, y, { color: NEON, blur: 9 });
    context.strokeStyle = '#0A2A14';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(20, y + 40);
    context.lineTo(492, y + 40);
    context.stroke();
  });
}

function drawDistChart(context: CanvasRenderingContext2D, counts: number[]): void {
  clearDisplay(context, 512, 512);
  context.font = '400 22px "Share Tech Mono"';
  context.fillStyle = '#2A7A48';
  context.textBaseline = 'top';
  context.textAlign = 'left';
  glowText(context, 'DIST_CHART', 20, 14, { color: NEON_DIM, blur: 7 });
  const labels = ['L3', 'L2', 'L1', 'CTR', 'R1', 'R2', 'R3'];
  const total = Math.max(1, counts.reduce((sum, value) => sum + value, 0));
  const segW = 18;
  const segGap = 4;
  const segH = 22;

  labels.forEach((label, index) => {
    const y = 58 + index * 62;
    context.font = '400 24px "Share Tech Mono"';
    context.fillStyle = '#3A8A58';
    context.textAlign = 'left';
    glowText(context, label, 20, y, { color: NEON_DIM, blur: 7 });
    const activeSeg = Math.round((counts[index] / total) * 14);
    for (let segment = 0; segment < 14; segment += 1) {
      const sx = 120 + segment * (segW + segGap);
      const active = segment < activeSeg;
      context.fillStyle = active ? '#4DFF91' : '#0A2010';
      context.fillRect(sx, y + 2, segW, segH);
      if (active) {
        context.fillStyle = 'rgba(255,255,255,0.15)';
        context.fillRect(sx, y + 2, segW, 3);
      }
    }
    context.font = '400 20px "Share Tech Mono"';
    context.fillStyle = '#2A7A48';
    context.textAlign = 'right';
    glowText(context, String(counts[index]), 500, y, { color: NEON_DIM, blur: 7 });
  });
}

function drawElapsed(context: CanvasRenderingContext2D, seconds: number): void {
  clearDisplay(context, 512, 96);
  context.font = '400 18px "Share Tech Mono"';
  context.fillStyle = '#2A7A48';
  context.textBaseline = 'top';
  context.textAlign = 'left';
  glowText(context, 'ELAPSED_TIME', 20, 8, { color: NEON_DIM, blur: 7 });
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const remaining = String(seconds % 60).padStart(2, '0');
  context.font = '400 48px "Share Tech Mono"';
  context.fillStyle = '#5DFF9A';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  glowText(context, `${minutes}:${remaining}`, 256, 65, { color: NEON, blur: 12 });
}

function drawDropBtn(context: CanvasRenderingContext2D): void {
  context.clearRect(0, 0, 256, 128);
  context.fillStyle = '#0A100A';
  context.fillRect(0, 0, 256, 128);
  context.strokeStyle = '#2A5A38';
  context.lineWidth = 4;
  context.strokeRect(12, 12, 232, 104);
  context.fillStyle = 'rgba(255,255,255,0.08)';
  context.fillRect(18, 18, 220, 12);
  context.font = '400 46px "Share Tech Mono"';
  context.fillStyle = '#5DFF9A';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  glowText(context, 'DROP', 128, 68, { color: NEON, blur: 16, alpha: 0.8 });
}

function drawBucketRow(context: CanvasRenderingContext2D, litIndex: number): void {
  clearDisplay(context, 512, 128);
  const labels = ['L3\n100', 'L2\n200', 'L1\n500', 'CTR\n1000', 'R1\n500', 'R2\n200', 'R3\n100'];
  const bucketWidth = 512 / 7;
  labels.forEach((label, index) => {
    const [name, points] = label.split('\n');
    const cx = index * bucketWidth + bucketWidth / 2;
    const active = index === litIndex;
    if (index > 0) {
      context.strokeStyle = '#1A4A28';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(index * bucketWidth, 0);
      context.lineTo(index * bucketWidth, 128);
      context.stroke();
    }
    context.font = '400 26px "Share Tech Mono"';
    context.fillStyle = active ? '#FFFFFF' : '#3A8A58';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    glowText(context, name, cx, 38, { color: active ? '#FFFFFF' : NEON_DIM, blur: active ? 12 : 7 });
    context.font = '400 30px "Share Tech Mono"';
    context.fillStyle = active ? '#5DFF9A' : '#2A6A40';
    glowText(context, points, cx, 90, { color: active ? NEON : NEON_DIM, blur: active ? 12 : 7 });
  });
}

function drawHeader(context: CanvasRenderingContext2D): void {
  context.clearRect(0, 0, 1024, 128);
  context.fillStyle = '#080E06';
  context.fillRect(0, 0, 1024, 128);
  context.font = '400 52px "Share Tech Mono"';
  context.fillStyle = '#4DFF91';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  glowText(context, 'PLNK-7 // UNIT', 30, 64, { color: NEON, blur: 14 });
  context.textAlign = 'right';
  context.fillStyle = '#2A7A48';
  glowText(context, 'MDL-7734 // REV.C', 994, 64, { color: NEON, blur: 14 });
}

function drawFooter(context: CanvasRenderingContext2D, progressPct: number, statusText: string): void {
  context.clearRect(0, 0, 1024, 96);
  context.fillStyle = '#060C04';
  context.fillRect(0, 0, 1024, 96);
  context.font = '400 26px "Share Tech Mono"';
  context.fillStyle = '#1A5A2A';
  context.textBaseline = 'middle';
  context.textAlign = 'left';
  glowText(context, '(C) 1984 PLNK SYSTEMS // ALL RIGHTS RESERVED', 20, 48, { color: NEON_DIM, blur: 8 });
  for (let index = 0; index < 12; index += 1) {
    const active = index < Math.round(progressPct * 12);
    context.fillStyle = active ? '#4DFF91' : '#0A2010';
    context.fillRect(420 + index * 30, 34, 22, 28);
  }
  context.font = '400 34px "Share Tech Mono"';
  context.fillStyle = '#4DFF91';
  context.textAlign = 'right';
  glowText(context, statusText, 1004, 48, { color: NEON, blur: 12 });
}

function drawVU(context: CanvasRenderingContext2D, levels: number[]): void {
  clearDisplay(context, 512, 384);
  context.font = '400 20px "Share Tech Mono"';
  context.fillStyle = '#2A7A48';
  context.textBaseline = 'top';
  context.textAlign = 'left';
  glowText(context, 'VU_METER', 20, 10, { color: NEON_DIM, blur: 7 });
  const segW = 28;
  const segH = 14;
  const segGap = 4;
  const cols = 12;
  const rowH = 44;
  levels.forEach((level, row) => {
    const y = 42 + row * rowH;
    const activeCols = Math.round(level * cols);
    for (let col = 0; col < cols; col += 1) {
      const x = 20 + col * (segW + segGap);
      const active = col < activeCols;
      let color = active ? '#4DFF91' : '#0A2010';
      if (active && col >= 10) color = '#FF4444';
      else if (active && col >= 8) color = '#E8A030';
      context.fillStyle = color;
      context.fillRect(x, y, segW, segH);
      if (active) {
        context.fillStyle = 'rgba(255,255,255,0.12)';
        context.fillRect(x, y, segW, 4);
      }
    }
  });
}

function drawTextTexture(
  plane: TextPlane,
  text: string,
  options: { fontSize?: number; align?: CanvasTextAlign } = {}
): void {
  const lines = text.split('\n');
  drawDisplay(
    plane,
    lines.map((line, index) => ({
      text: line,
      size: options.fontSize ?? plane.canvas.height * 0.34,
      y: 0.5 + (index - (lines.length - 1) / 2) * 0.28,
      align: options.align
    }))
  );
}

function configureDisplayTexture(texture: THREE.Texture): void {
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);
  texture.flipY = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
}

function makeNormalMap(kind: 'plastic' | 'scratch'): THREE.CanvasTexture {
  const size = 512;
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const ctx = mustContext(normalCanvas);
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const x = (i / 4) % size;
    const y = Math.floor(i / 4 / size);
    const waveScale = kind === 'scratch' ? 0.18 : 0.04;
    const nx = Math.sin(x * waveScale) * 0.5 + Math.sin(x * 0.13 + y * 0.07) * 0.3;
    const ny = Math.sin(y * waveScale) * 0.5 + Math.sin(y * 0.11 + x * 0.09) * 0.3;
    const scratch = Math.random() < (kind === 'scratch' ? 0.014 : 0.003) ? 0.8 : 0;
    image.data[i] = Math.max(0, Math.min(255, 128 + nx * (kind === 'scratch' ? 32 : 18) + scratch * 40));
    image.data[i + 1] = Math.max(0, Math.min(255, 128 + ny * (kind === 'scratch' ? 32 : 18) + scratch * 40));
    image.data[i + 2] = 255;
      image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(normalCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'scratch' ? 6 : 3, kind === 'scratch' ? 4 : 2);
  return texture;
}

function makeRoughnessMap(kind: 'fingerprint' | 'ground'): THREE.CanvasTexture {
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 256;
  roughCanvas.height = 256;
  const ctx = mustContext(roughCanvas);
  ctx.fillStyle = kind === 'ground' ? '#E6E6E6' : '#D9D9D9';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < (kind === 'ground' ? 32 : 12); i += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const radius = kind === 'ground' ? 16 + Math.random() * 70 : 20 + Math.random() * 30;
    const grd = ctx.createRadialGradient(x, y, 2, x, y, radius);
    grd.addColorStop(0, kind === 'ground' ? 'rgba(70,70,70,0.28)' : 'rgba(80,80,80,0.4)');
    grd.addColorStop(1, 'rgba(80,80,80,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 256, 256);
  }
  const texture = new THREE.CanvasTexture(roughCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'ground' ? 5 : 2, kind === 'ground' ? 4 : 2);
  return texture;
}

function makeButtonRoughnessMap(): THREE.CanvasTexture {
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 256;
  roughCanvas.height = 256;
  const ctx = mustContext(roughCanvas);
  const grd = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgb(120,120,120)');
  grd.addColorStop(0.45, 'rgb(150,150,150)');
  grd.addColorStop(1, 'rgb(210,210,210)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(roughCanvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function makePanelAoMap(): THREE.CanvasTexture {
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = 256;
  aoCanvas.height = 256;
  const ctx = mustContext(aoCanvas);
  const grd = ctx.createRadialGradient(128, 128, 40, 128, 128, 170);
  grd.addColorStop(0, '#FFFFFF');
  grd.addColorStop(1, '#777777');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(aoCanvas);
}

function makeDirtMap(): THREE.CanvasTexture {
  const dirtCanvas = document.createElement('canvas');
  dirtCanvas.width = 512;
  dirtCanvas.height = 512;
  const ctx = mustContext(dirtCanvas);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8; i += 1) {
    const x = Math.random() * 512;
    const grad = ctx.createLinearGradient(x, 0, x + 4, 512);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.3 + Math.random() * 0.4, 'rgba(0,0,0,0.08)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 3, 0, 10, 512);
  }
  [
    [0, 0],
    [512, 0],
    [0, 512],
    [512, 512]
  ].forEach(([cx, cy]) => {
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 180);
    g.addColorStop(0, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  });
  const seamGrad = ctx.createLinearGradient(0, 220, 0, 300);
  seamGrad.addColorStop(0, 'rgba(0,0,0,0)');
  seamGrad.addColorStop(0.5, 'rgba(0,0,0,0.12)');
  seamGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = seamGrad;
  ctx.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(dirtCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

function mustContext(canvasElement: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvasElement.getContext('2d');
  if (!context) throw new Error('Could not create 2D canvas context.');
  return context;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
