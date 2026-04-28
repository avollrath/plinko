import * as THREE from 'three';
import { boardConfig } from '../config';

type SceneResize = {
  width: number;
  height: number;
  pixelRatio: number;
};

export class PlinkoScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  readonly renderer: THREE.WebGLRenderer;
  readonly boardGroup = new THREE.Group();
  readonly pegGroup = new THREE.Group();
  readonly slotGroup = new THREE.Group();
  readonly ballGroup = new THREE.Group();

  private readonly clock = new THREE.Clock();
  private readonly neonMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly slotMaterials: THREE.MeshStandardMaterial[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.scene.fog = new THREE.Fog(0x041348, 18, 30);

    this.camera.position.set(0, 0.2, 20.5);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(this.boardGroup, this.ballGroup);
    this.boardGroup.add(this.pegGroup, this.slotGroup);

    this.addLights();
    this.addBoardPanel();
    this.addDecorativeRails();
    this.addPegMeshes();
    this.addSlotMeshes();
  }

  resize({ width, height, pixelRatio }: SceneResize): void {
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(pixelRatio, 2));
    this.camera.aspect = width / height;
    const portraitFit = height >= width ? 20 : 16.5;
    this.camera.position.z = portraitFit;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    const elapsed = this.clock.getElapsedTime();
    this.boardGroup.rotation.z = Math.sin(elapsed * 0.65) * 0.006;
    this.neonMaterials.forEach((material, index) => {
      material.emissiveIntensity = 1.4 + Math.sin(elapsed * 2.6 + index) * 0.35;
    });
    this.slotMaterials.forEach((material, index) => {
      material.emissiveIntensity = 0.28 + Math.sin(elapsed * 3 + index) * 0.08;
    });
    this.renderer.render(this.scene, this.camera);
  }

  createBallMesh(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(boardConfig.ballRadius, 32, 24);
    const material = new THREE.MeshStandardMaterial({
      color: 0xfff5a9,
      roughness: 0.2,
      metalness: 0.18,
      emissive: 0xff7a18,
      emissiveIntensity: 0.25
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    this.ballGroup.add(mesh);
    return mesh;
  }

  removeBallMesh(mesh: THREE.Object3D): void {
    this.ballGroup.remove(mesh);
  }

  private addLights(): void {
    const ambient = new THREE.AmbientLight(0x8bcfff, 1.1);
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(0, 5, 7);
    const rim = new THREE.PointLight(0x4effff, 22, 18);
    rim.position.set(-4, 2, 5);
    const warm = new THREE.PointLight(0xffa31a, 15, 16);
    warm.position.set(4, -5, 5);
    this.scene.add(ambient, key, rim, warm);
  }

  private addBoardPanel(): void {
    const panelShape = new THREE.Shape();
    const w = boardConfig.width / 2;
    const h = boardConfig.height / 2;
    panelShape.moveTo(-w + 0.35, -h);
    panelShape.lineTo(w - 0.35, -h);
    panelShape.quadraticCurveTo(w, -h, w, -h + 0.35);
    panelShape.lineTo(w, h - 0.35);
    panelShape.quadraticCurveTo(w, h, w - 0.35, h);
    panelShape.lineTo(-w + 0.35, h);
    panelShape.quadraticCurveTo(-w, h, -w, h - 0.35);
    panelShape.lineTo(-w, -h + 0.35);
    panelShape.quadraticCurveTo(-w, -h, -w + 0.35, -h);

    const geometry = new THREE.ExtrudeGeometry(panelShape, {
      depth: boardConfig.depth,
      bevelEnabled: true,
      bevelSegments: 8,
      bevelSize: 0.08,
      bevelThickness: 0.08
    });
    geometry.center();
    const material = new THREE.MeshStandardMaterial({
      color: 0x0a57bb,
      roughness: 0.34,
      metalness: 0.22,
      emissive: 0x002a80,
      emissiveIntensity: 0.18
    });
    const panel = new THREE.Mesh(geometry, material);
    panel.position.z = -0.28;
    this.boardGroup.add(panel);

    const blobMaterial = new THREE.MeshStandardMaterial({
      color: 0x083f9c,
      roughness: 0.5,
      metalness: 0.1,
      transparent: true,
      opacity: 0.65
    });
    const blobs = [
      [-1.9, 4.1, 0.9, 1.7],
      [1.7, 2.25, 1.1, 2.25],
      [-2.45, 0.1, 0.72, 1.55],
      [0.3, -2.15, 0.95, 1.5],
      [2.2, -3.3, 0.62, 1.0],
      [-1.45, -4.9, 0.92, 1.45],
      [1.25, -5.45, 0.75, 1.1]
    ];
    blobs.forEach(([x, y, sx, sy], index) => {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 16), blobMaterial);
      blob.scale.set(sx, sy, 0.055);
      blob.position.set(x, y, -0.02 + index * 0.001);
      this.boardGroup.add(blob);
    });
  }

  private addDecorativeRails(): void {
    const railGeometry = new THREE.BoxGeometry(0.12, boardConfig.height - 0.7, 0.18);
    const railColors = [0x48faff, 0x9bff20];
    [-1, 1].forEach((side, sideIndex) => {
      railColors.forEach((color, colorIndex) => {
        const material = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 1.45,
          roughness: 0.18
        });
        const rail = new THREE.Mesh(railGeometry, material);
        rail.position.set(side * (boardConfig.width / 2 + 0.22 + colorIndex * 0.16), 0, 0.12);
        rail.rotation.z = side * 0.035;
        this.boardGroup.add(rail);
        this.neonMaterials.push(material);
      });
      const capGeometry = new THREE.BoxGeometry(0.26, 2.2, 0.2);
      const capMaterial = new THREE.MeshStandardMaterial({
        color: sideIndex === 0 ? 0x37f4ff : 0x9dff27,
        emissive: sideIndex === 0 ? 0x37f4ff : 0x9dff27,
        emissiveIntensity: 1.2,
        roughness: 0.2
      });
      const cap = new THREE.Mesh(capGeometry, capMaterial);
      cap.position.set(side * (boardConfig.width / 2 + 0.36), -4.9, 0.18);
      cap.rotation.z = side * -0.5;
      this.boardGroup.add(cap);
      this.neonMaterials.push(capMaterial);
    });
  }

  private addPegMeshes(): void {
    const geometry = new THREE.SphereGeometry(boardConfig.pegRadius, 24, 18);
    const material = new THREE.MeshStandardMaterial({
      color: 0x86fff2,
      roughness: 0.18,
      metalness: 0.82,
      emissive: 0x0bbd94,
      emissiveIntensity: 0.35
    });
    for (let row = 0; row < boardConfig.pegRows; row += 1) {
      const count = boardConfig.pegsInFirstRow + (row % 2);
      const rowWidth = (count - 1) * boardConfig.pegSpacingX;
      const y = 4.55 - row * boardConfig.pegSpacingY;
      for (let index = 0; index < count; index += 1) {
        const peg = new THREE.Mesh(geometry, material);
        peg.position.set(index * boardConfig.pegSpacingX - rowWidth / 2, y, 0.2);
        this.pegGroup.add(peg);
      }
    }
  }

  private addSlotMeshes(): void {
    const slotWidth = boardConfig.width / boardConfig.slotCount;
    for (let index = 0; index < boardConfig.slotCount; index += 1) {
      const color = boardConfig.slotColors[index];
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.32,
        roughness: 0.28,
        metalness: 0.12
      });
      const slot = new THREE.Mesh(new THREE.BoxGeometry(slotWidth - 0.16, 0.55, 0.22), material);
      slot.position.set(-boardConfig.width / 2 + slotWidth * (index + 0.5), -6.28, 0.08);
      this.slotGroup.add(slot);
      this.slotMaterials.push(material);
    }
  }
}
