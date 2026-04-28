import * as THREE from 'three';
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
renderer.toneMappingExposure = 1.1;
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 1.5, 4.5);
camera.lookAt(0, 0, 0);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(10, 10);
const mouse01 = new THREE.Vector2(0.5, 0.5);
const terminalGroup = new THREE.Group();
scene.add(terminalGroup);

const interactive: THREE.Object3D[] = [];
let dropButtonMesh: THREE.Mesh;
let dropButtonBaseZ = 0;
let dropPressUntil = 0;
let activeChip: Chip | undefined;
let score = 0;
let startTime = performance.now();
let lastSecond = -1;
let reelAngle = 0;
let amberPhase = 0;
let progressPhase = 0;
const landings: Array<{ stamp: string; id: BucketId; points: number }> = [];
const distribution = new Map<BucketId, number>(buckets.map((bucket) => [bucket.id, 0]));
const stats = { L: 0, C: 0, R: 0 };

const screenCanvas = document.createElement('canvas');
screenCanvas.width = 320;
screenCanvas.height = 560;
const screenCtx = mustContext(screenCanvas);
const screenTexture = new THREE.CanvasTexture(screenCanvas);
screenTexture.encoding = THREE.sRGBEncoding;

const plasticMaterial = new THREE.MeshStandardMaterial({
  color: 0x2c3020,
  roughness: 0.88,
  metalness: 0.05,
  normalMap: makeNormalMap(),
  roughnessMap: makeRoughnessMap(),
  normalScale: new THREE.Vector2(0.4, 0.4)
});

const faceMaterial = plasticMaterial.clone();
faceMaterial.color = new THREE.Color(0x323820);

const insetMaterial = new THREE.MeshStandardMaterial({
  color: 0x1c2014,
  roughness: 0.92,
  metalness: 0.02
});

const rimMaterial = new THREE.MeshStandardMaterial({
  color: 0x3d4530,
  roughness: 0.72,
  metalness: 0.08
});

const darkMetal = new THREE.MeshStandardMaterial({
  color: 0x1a1c10,
  roughness: 0.7,
  metalness: 0.15
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

const bucketMaterials: THREE.MeshStandardMaterial[] = [];
const vuRows: THREE.Mesh[][] = [];
const distRows = new Map<BucketId, THREE.Mesh[]>();
const progressBlocks: THREE.Mesh[] = [];
const reelObjects: THREE.Object3D[] = [];

const scoreDisplay = makeTextPlane(512, 128, 0.55, 0.1);
const reelStatusDisplay = makeTextPlane(512, 96, 0.55, 0.06);
const elapsedDisplay = makeTextPlane(512, 96, 0.55, 0.08);
const landingLogDisplay = makeTextPlane(512, 512, 0.6, 0.55);
const statDisplays = {
  L: makeTextPlane(256, 64, 0.5, 0.055),
  C: makeTextPlane(256, 64, 0.5, 0.055),
  R: makeTextPlane(256, 64, 0.5, 0.055)
};
const footerStatus = makeTextPlane(360, 80, 0.48, 0.07);

buildLights();
buildEnvironment();
buildTerminal();
buildPlinkoPegs();
drawScreen();
updateAllReadouts(true);

window.addEventListener('resize', resize);
window.addEventListener('mousemove', (event) => {
  mouse01.set(event.clientX / window.innerWidth, event.clientY / window.innerHeight);
  pointer.set(mouse01.x * 2 - 1, -(mouse01.y * 2 - 1));
});
window.addEventListener('click', () => {
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(interactive, false)[0];
  if (hit?.object === dropButtonMesh) dropChip();
});
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    dropChip();
  }
});

resize();
requestAnimationFrame(animate);

function buildLights(): void {
  scene.add(new THREE.AmbientLight(0x1a2010, 0.4));

  const key = new THREE.DirectionalLight(0xffe8a0, 2.5);
  key.position.set(-3, 5, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x304060, 0.6);
  fill.position.set(4, 2, -2);
  scene.add(fill);

  const screenGlow = new THREE.PointLight(0x30ff70, 1.2, 2.5);
  screenGlow.position.set(0, 0.1, 0.6);
  terminalGroup.add(screenGlow);

  const rim = new THREE.SpotLight(0xa0b080, 0.8, 8, 0.32, 0.5, 1.4);
  rim.position.set(0, 6, 0);
  rim.target = terminalGroup;
  scene.add(rim, rim.target);
}

function buildEnvironment(): void {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 8),
    new THREE.MeshStandardMaterial({ color: 0x0a0c08, roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.2;
  ground.receiveShadow = true;
  scene.add(ground);
}

function buildTerminal(): void {
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 0.28), plasticMaterial);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  terminalGroup.add(chassis);

  const facePlate = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.0, 0.02), faceMaterial);
  facePlate.position.z = 0.15;
  facePlate.castShadow = true;
  facePlate.receiveShadow = true;
  terminalGroup.add(facePlate);

  addChamferStrips();
  addPanel(0.72, 1.7, -1.1, 0);
  addPanel(1.5, 1.9, 0.08, 0.05);
  addPanel(0.72, 1.7, 1.22, 0);

  buildHeaderFooter();
  buildCenterPanel();
  buildLeftPanel();
  buildRightPanel();
}

function addChamferStrips(): void {
  const stripMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1c10, roughness: 0.76, metalness: 0.1 });
  const strips = [
    { size: [3.15, 0.045, 0.035], pos: [0, 1.115, 0.165], rot: 0.35 },
    { size: [3.15, 0.045, 0.035], pos: [0, -1.115, 0.165], rot: -0.35 },
    { size: [0.045, 2.14, 0.035], pos: [-1.615, 0, 0.165], rot: -0.35 },
    { size: [0.045, 2.14, 0.035], pos: [1.615, 0, 0.165], rot: 0.35 }
  ];
  strips.forEach(({ size, pos, rot }) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), stripMaterial);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.z = rot;
    mesh.castShadow = true;
    terminalGroup.add(mesh);
  });
}

function addPanel(width: number, height: number, x: number, y: number): void {
  const panel = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.015), insetMaterial);
  panel.position.set(x, y, 0.155);
  panel.receiveShadow = true;
  terminalGroup.add(panel);

  const t = 0.012;
  [
    [width + t * 2, t, 0, height / 2 + t / 2],
    [width + t * 2, t, 0, -height / 2 - t / 2],
    [t, height, -width / 2 - t / 2, 0],
    [t, height, width / 2 + t / 2, 0]
  ].forEach(([w, h, ox, oy]) => {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.018), rimMaterial);
    rim.position.set(x + ox, y + oy, 0.168);
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
  const railMat = new THREE.MeshStandardMaterial({ color: 0x252d18, roughness: 0.85, metalness: 0.05 });
  const header = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.16, 0.03), railMat);
  header.position.set(0, 0.98, 0.19);
  terminalGroup.add(header);

  const footer = header.clone();
  footer.position.y = -0.98;
  terminalGroup.add(footer);

  addLabelPlane('PLNK-7 // UNIT', 0.72, 0.06, -0.98, 0.98, 0.211, 'left');
  addLabelPlane('MDL-7734 // REV.C', 0.72, 0.06, 0.95, 0.98, 0.211, 'right');
  addLabelPlane('(C) 1984 PLNK SYSTEMS', 0.76, 0.06, -0.96, -0.98, 0.211, 'left');
  footerStatus.mesh.position.set(1.03, -0.98, 0.212);
  terminalGroup.add(footerStatus.mesh);

  const lightMats = [
    new THREE.MeshStandardMaterial({ color: 0x3a0a0a, emissive: 0x330000, emissiveIntensity: 0.08, roughness: 0.35 }),
    new THREE.MeshStandardMaterial({ color: 0x2a1500, emissive: 0xff9a20, emissiveIntensity: 0.15, roughness: 0.35 }),
    new THREE.MeshStandardMaterial({ color: 0x0a2010, emissive: 0x30ff70, emissiveIntensity: 0.1, roughness: 0.35 })
  ];
  lightMats.forEach((mat, index) => {
    const lamp = makeFrontCylinder(0.018, 0.012, mat);
    lamp.position.set(-0.04 + index * 0.04, 0.98, 0.222);
    lamp.name = index === 1 ? 'amberLight' : '';
    terminalGroup.add(lamp);
  });

  for (let i = 0; i < 10; i += 1) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.025, 0.009), inactiveSegment.clone());
    block.position.set(-0.24 + i * 0.054, -0.98, 0.218);
    progressBlocks.push(block);
    terminalGroup.add(block);
  }
}

function buildCenterPanel(): void {
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 1.3),
    new THREE.MeshStandardMaterial({
      map: screenTexture,
      emissiveMap: screenTexture,
      emissive: 0x30ff70,
      emissiveIntensity: 0.18,
      roughness: 0.1,
      metalness: 0
    })
  );
  screen.position.set(0.08, 0.2, 0.185);
  terminalGroup.add(screen);

  addBezel(0.08, 0.2, 0.78, 1.36, 0.201);
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
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.06, 0.018), mat);
    mesh.position.set(-0.22 + index * 0.1, -0.52, 0.205);
    bucketMaterials.push(mat);
    terminalGroup.add(mesh);
    addLabelPlane(`${bucket.id}\n${bucket.points}`, 0.09, 0.055, mesh.position.x, -0.52, 0.216, 'center', 42);
  });
}

function buildDropControls(): void {
  const wellMat = new THREE.MeshStandardMaterial({ color: 0x161810, roughness: 0.86, metalness: 0.08 });
  const knobMat = new THREE.MeshStandardMaterial({ color: 0x1a1c10, roughness: 0.6, metalness: 0.3 });
  addKnob(-0.34, -0.78, 'FREQ', wellMat, knobMat, -0.55);
  addKnob(0.5, -0.78, 'BIAS', wellMat, knobMat, 0.75);

  const dropMat = new THREE.MeshStandardMaterial({ color: 0x2c3020, roughness: 0.75, metalness: 0.08 });
  dropButtonMesh = makeFrontCylinder(0.17, 0.035, dropMat, 32, 0.16);
  dropButtonMesh.position.set(0.08, -0.78, 0.23);
  dropButtonBaseZ = dropButtonMesh.position.z;
  dropButtonMesh.castShadow = true;
  interactive.push(dropButtonMesh);
  terminalGroup.add(dropButtonMesh);
  addLabelPlane('DROP', 0.22, 0.07, 0.08, -0.78, 0.252, 'center');
}

function buildLeftPanel(): void {
  addLabelPlane('VU METER', 0.42, 0.045, -1.1, 0.66, 0.2, 'center');
  for (let row = 0; row < 6; row += 1) {
    const rowMeshes: THREE.Mesh[] = [];
    for (let col = 0; col < 12; col += 1) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.014, 0.008), inactiveSegment.clone());
      seg.position.set(-1.265 + col * 0.03, 0.58 - row * 0.035, 0.202);
      rowMeshes.push(seg);
      terminalGroup.add(seg);
    }
    vuRows.push(rowMeshes);
  }

  addHousing(-1.1, 0.18, 0.62, 0.16);
  scoreDisplay.mesh.position.set(-1.1, 0.18, 0.218);
  terminalGroup.add(scoreDisplay.mesh);

  const reelMat = new THREE.MeshStandardMaterial({ color: 0x2c3020, roughness: 0.7, metalness: 0.2 });
  addReel(-1.19, -0.1, reelMat);
  addReel(-1.01, -0.1, reelMat);

  reelStatusDisplay.mesh.position.set(-1.1, -0.34, 0.218);
  terminalGroup.add(reelStatusDisplay.mesh);
  addLabelPlane('REEL STATUS', 0.5, 0.04, -1.1, -0.27, 0.205, 'center');

  (['L', 'C', 'R'] as const).forEach((key, index) => {
    addLabelPlane(key, 0.08, 0.04, -1.32, -0.52 - index * 0.075, 0.205, 'left');
    statDisplays[key].mesh.position.set(-1.08, -0.52 - index * 0.075, 0.215);
    terminalGroup.add(statDisplays[key].mesh);
  });
}

function buildRightPanel(): void {
  addLabelPlane('LANDING LOG', 0.48, 0.045, 1.22, 0.66, 0.2, 'center');
  landingLogDisplay.mesh.position.set(1.22, 0.35, 0.21);
  terminalGroup.add(landingLogDisplay.mesh);

  buckets.forEach((bucket, row) => {
    addLabelPlane(bucket.id, 0.12, 0.035, 0.93, -0.02 - row * 0.055, 0.205, 'left', 44);
    const segments: THREE.Mesh[] = [];
    for (let col = 0; col < 8; col += 1) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.014, 0.008), inactiveSegment.clone());
      seg.position.set(1.06 + col * 0.04, -0.02 - row * 0.055, 0.205);
      segments.push(seg);
      terminalGroup.add(seg);
    }
    distRows.set(bucket.id, segments);
  });

  addHousing(1.22, -0.7, 0.62, 0.14);
  elapsedDisplay.mesh.position.set(1.22, -0.7, 0.218);
  terminalGroup.add(elapsedDisplay.mesh);
}

function addBezel(x: number, y: number, w: number, h: number, z: number): void {
  [
    [w, 0.035, 0, h / 2 + 0.017],
    [w, 0.035, 0, -h / 2 - 0.017],
    [0.035, h, -w / 2 - 0.017, 0],
    [0.035, h, w / 2 + 0.017, 0]
  ].forEach(([bw, bh, ox, oy]) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.035), darkMetal);
    strip.position.set(x + ox, y + oy, z);
    strip.castShadow = true;
    terminalGroup.add(strip);
  });
}

function addHousing(x: number, y: number, w: number, h: number): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), darkMetal);
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
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.06, 0.006), phosphor.clone());
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
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.095, 0.012), darkMetal);
    spoke.rotation.z = (Math.PI * 2 * i) / 3;
    spoke.position.z = 0.012;
    reel.add(spoke);
  }
  reel.position.set(x, y, 0.218);
  reelObjects.push(reel);
  terminalGroup.add(reel);
}

function addScrew(x: number, y: number): void {
  const screw = makeFrontCylinder(
    0.018,
    0.01,
    new THREE.MeshStandardMaterial({ color: 0x1a1c14, roughness: 0.5, metalness: 0.6 }),
    16
  );
  screw.position.set(x, y, 0.19);
  terminalGroup.add(screw);
  const crossA = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.003, 0.002), darkMetal);
  const crossB = crossA.clone();
  crossB.rotation.z = Math.PI / 2;
  crossA.position.set(x, y, 0.197);
  crossB.position.set(x, y, 0.198);
  terminalGroup.add(crossA, crossB);
}

function makeFrontCylinder(radius: number, depth: number, material: THREE.Material, segments = 32, topRadius = radius): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(topRadius, radius, depth, segments), material);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function addLabelPlane(text: string, width: number, height: number, x: number, y: number, z: number, align: CanvasTextAlign, fontSize = 34): THREE.Mesh {
  const label = makeTextPlane(512, 128, width, height);
  drawTextTexture(label, text, { fontSize, align });
  label.mesh.position.set(x, y, z);
  terminalGroup.add(label.mesh);
  return label.mesh;
}

function buildPlinkoPegs(): void {
  // Pegs are drawn on the screen canvas; this function exists to keep the build stages mirrored.
}

function dropChip(): void {
  if (activeChip) return;
  dropPressUntil = performance.now() + 80;
  activeChip = {
    x: 160 + (Math.random() - 0.5) * 26,
    y: 44,
    vx: (Math.random() - 0.5) * 2.2,
    vy: 1.6,
    trail: []
  };
}

function animate(now: number): void {
  const targetY = (mouse01.x - 0.5) * 0.25;
  const targetX = (mouse01.y - 0.5) * -0.15;
  const alpha = Math.min(0.12, 0.06 * Math.max(1, (now - (animate as unknown as { last?: number }).last!) / 16.7 || 1));
  terminalGroup.rotation.y = THREE.MathUtils.lerp(terminalGroup.rotation.y, targetY, alpha);
  terminalGroup.rotation.x = THREE.MathUtils.lerp(terminalGroup.rotation.x, targetX, alpha);
  (animate as unknown as { last?: number }).last = now;

  amberPhase = (Math.sin(now / 700) + 1) * 0.25;
  const amber = terminalGroup.getObjectByName('amberLight') as THREE.Mesh | undefined;
  const amberMat = amber?.material as THREE.MeshStandardMaterial | undefined;
  if (amberMat) amberMat.emissiveIntensity = amberPhase;

  dropButtonMesh.position.z = now < dropPressUntil ? dropButtonBaseZ - 0.012 : THREE.MathUtils.lerp(dropButtonMesh.position.z, dropButtonBaseZ, 0.24);

  if (activeChip) {
    updatePhysics();
    updateVu();
    reelAngle += 0.12;
    progressPhase = (progressPhase + 0.18) % 10;
  }

  reelObjects[0].rotation.z = reelAngle;
  progressBlocks.forEach((block, index) => {
    const mat = block.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = activeChip && index <= progressPhase ? 0.55 : 0;
    mat.color.set(activeChip && index <= progressPhase ? 0x4dff91 : 0x112210);
  });

  const elapsed = Math.floor((performance.now() - startTime) / 1000);
  if (elapsed !== lastSecond) {
    lastSecond = elapsed;
    updateAllReadouts(false);
  }

  drawScreen();
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
  if (activeChip.x < 10) {
    activeChip.x = 10;
    activeChip.vx = Math.abs(activeChip.vx) * 0.55;
  }
  if (activeChip.x > 310) {
    activeChip.x = 310;
    activeChip.vx = -Math.abs(activeChip.vx) * 0.55;
  }

  for (const peg of getPegs()) {
    const dx = activeChip.x - peg.x;
    const dy = activeChip.y - peg.y;
    const dist = Math.hypot(dx, dy);
    const min = 13;
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
  activeChip.trail = activeChip.trail.slice(0, 14);

  if (activeChip.y >= 552) {
    const index = Math.max(0, Math.min(6, Math.floor(activeChip.x / (320 / 7))));
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
  const mat = bucketMaterials[buckets.indexOf(bucket)];
  mat.emissiveIntensity = 0.8;
  window.setTimeout(() => fadeBucket(mat), 16);
  activeChip = undefined;
  updateAllReadouts(true);
}

function fadeBucket(mat: THREE.MeshStandardMaterial): void {
  mat.emissiveIntensity = Math.max(0, mat.emissiveIntensity - 0.025);
  if (mat.emissiveIntensity > 0) window.setTimeout(() => fadeBucket(mat), 16);
}

function drawScreen(): void {
  screenCtx.fillStyle = '#0A1A08';
  screenCtx.fillRect(0, 0, 320, 560);
  screenCtx.fillStyle = '#060E05';
  screenCtx.fillRect(0, 0, 320, 30);
  screenCtx.fillStyle = '#4DFF91';
  screenCtx.font = '18px "Share Tech Mono", monospace';
  screenCtx.fillText(`SCORE: ${String(score).padStart(4, '0')}`, 12, 21);

  screenCtx.fillStyle = '#2A7A48';
  for (const peg of getPegs()) {
    screenCtx.beginPath();
    screenCtx.arc(peg.x, peg.y, 5, 0, Math.PI * 2);
    screenCtx.fill();
  }

  if (activeChip) {
    activeChip.trail.forEach((point, index) => {
      screenCtx.globalAlpha = (1 - index / activeChip!.trail.length) * 0.36;
      screenCtx.fillStyle = '#4DFF91';
      screenCtx.beginPath();
      screenCtx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      screenCtx.fill();
    });
    screenCtx.globalAlpha = 1;
    screenCtx.fillStyle = '#4DFF91';
    screenCtx.beginPath();
    screenCtx.arc(activeChip.x, activeChip.y, 8, 0, Math.PI * 2);
    screenCtx.fill();
    screenCtx.fillStyle = '#FFFFFF';
    screenCtx.beginPath();
    screenCtx.arc(activeChip.x, activeChip.y, 2, 0, Math.PI * 2);
    screenCtx.fill();
  }

  screenCtx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < 560; y += 3) screenCtx.fillRect(0, y, 320, 1);
  const vignette = screenCtx.createRadialGradient(160, 280, 80, 160, 280, 320);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
  screenCtx.fillStyle = vignette;
  screenCtx.fillRect(0, 0, 320, 560);
  screenTexture.needsUpdate = true;
}

function updateAllReadouts(force: boolean): void {
  drawTextTexture(scoreDisplay, String(score).padStart(4, '0'), { fontSize: 62, align: 'right' });
  drawTextTexture(reelStatusDisplay, activeChip ? 'ACTIVE' : 'STANDBY', { fontSize: 38, align: 'center' });
  drawTextTexture(elapsedDisplay, formatTime(lastSecond < 0 ? 0 : lastSecond), { fontSize: 48, align: 'center' });
  drawTextTexture(footerStatus, activeChip ? 'ACTIVE' : 'STANDBY', { fontSize: 34, align: 'right' });
  (['L', 'C', 'R'] as const).forEach((key) => {
    drawTextTexture(statDisplays[key], `${key}  ${String(stats[key]).padStart(2, '0')}`, { fontSize: 38, align: 'left' });
  });
  drawLandingLog();
  updateDistribution();
  if (force) updateVu();
}

function drawLandingLog(): void {
  const lines = landings.length ? landings.map((entry) => `${entry.stamp}    ${entry.id} / ${entry.points}`) : ['-- AWAITING DROP --'];
  const ctx = landingLogDisplay.context;
  ctx.fillStyle = '#061006';
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = '#4DFF91';
  ctx.font = '32px "Share Tech Mono", monospace';
  lines.forEach((line, index) => ctx.fillText(line, 18, 48 + index * 52));
  landingLogDisplay.texture.needsUpdate = true;
}

function updateVu(): void {
  vuRows.forEach((row) => {
    const active = activeChip ? 4 + Math.floor(Math.random() * 7) : 0;
    row.forEach((mesh, index) => {
      mesh.material = index < active ? phosphor : inactiveSegment;
    });
  });
}

function updateDistribution(): void {
  const max = Math.max(1, ...Array.from(distribution.values()));
  buckets.forEach((bucket) => {
    const active = Math.round(((distribution.get(bucket.id) ?? 0) / max) * 8);
    distRows.get(bucket.id)?.forEach((mesh, index) => {
      mesh.material = index < active ? phosphor : inactiveSegment;
    });
  });
}

function getPegs(): Array<{ x: number; y: number }> {
  const pegs: Array<{ x: number; y: number }> = [];
  const cols = 7;
  const spacingX = 38;
  const spacingY = 50;
  for (let row = 0; row < 8; row += 1) {
    const offset = row % 2 ? spacingX / 2 : 0;
    for (let col = 0; col < cols; col += 1) {
      pegs.push({ x: 45 + col * spacingX + offset, y: 88 + row * spacingY });
    }
  }
  return pegs;
}

function makeTextPlane(canvasWidth: number, canvasHeight: number, worldWidth: number, worldHeight: number): TextPlane {
  const textCanvas = document.createElement('canvas');
  textCanvas.width = canvasWidth;
  textCanvas.height = canvasHeight;
  const context = mustContext(textCanvas);
  const texture = new THREE.CanvasTexture(textCanvas);
  texture.encoding = THREE.sRGBEncoding;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: 0x30ff70,
    emissiveIntensity: 0.3,
    transparent: true,
    roughness: 0.24,
    metalness: 0
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldWidth, worldHeight), material);
  return { canvas: textCanvas, context, texture, mesh };
}

function drawTextTexture(
  plane: TextPlane,
  text: string,
  options: { fontSize?: number; align?: CanvasTextAlign } = {}
): void {
  const { context, canvas: textCanvas } = plane;
  const lines = text.split('\n');
  context.clearRect(0, 0, textCanvas.width, textCanvas.height);
  context.fillStyle = 'rgba(6, 16, 6, 0.82)';
  context.fillRect(0, 0, textCanvas.width, textCanvas.height);
  context.fillStyle = '#4DFF91';
  context.font = `${options.fontSize ?? 38}px "Share Tech Mono", monospace`;
  context.textAlign = options.align ?? 'center';
  context.textBaseline = 'middle';
  const x = options.align === 'left' ? 18 : options.align === 'right' ? textCanvas.width - 18 : textCanvas.width / 2;
  lines.forEach((line, index) => {
    context.fillText(line, x, textCanvas.height / 2 + (index - (lines.length - 1) / 2) * (options.fontSize ?? 38));
  });
  plane.texture.needsUpdate = true;
}

function makeNormalMap(): THREE.CanvasTexture {
  const size = 512;
  const source = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      source[y * size + x] =
        Math.sin(x * 0.045) * 0.32 +
        Math.sin(y * 0.061) * 0.26 +
        Math.sin((x + y) * 0.023) * 0.22 +
        Math.sin((x * 1.7 - y) * 0.012) * 0.18;
    }
  }
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const ctx = mustContext(normalCanvas);
  const image = ctx.createImageData(size, size);
  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const dx = source[y * size + x + 1] - source[y * size + x - 1];
      const dy = source[(y + 1) * size + x] - source[(y - 1) * size + x];
      const nx = -dx * 0.7;
      const ny = -dy * 0.7;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      image.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      image.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      image.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(normalCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

function makeRoughnessMap(): THREE.CanvasTexture {
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const ctx = mustContext(roughCanvas);
  const image = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y += 1) {
    for (let x = 0; x < 512; x += 1) {
      const smear = Math.sin(x * 0.025 + y * 0.01) * 28 + Math.sin((x - y) * 0.018) * 18;
      const value = Math.max(80, Math.min(230, 180 + smear + Math.random() * 24));
      const i = (y * 512 + x) * 4;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(roughCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
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
