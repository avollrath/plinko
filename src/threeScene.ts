import * as THREE from 'three';

export class TerminalScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly terminal: THREE.Mesh;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera.position.set(0, 2, 5);
    this.camera.lookAt(0, 0, 0);

    this.terminal = this.createTerminalBody();
    this.scene.add(this.terminal);
    this.addLighting();
    this.addGround();
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.renderer.setPixelRatio(Math.min(pixelRatio, 2));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.terminal.rotation.x = 0.12;
    this.terminal.rotation.y = 0.05 + Math.sin(Date.now() * 0.0003) * 0.04;
    this.renderer.render(this.scene, this.camera);
  }

  private createTerminalBody(): THREE.Mesh {
    const geometry = createRoundedBoxGeometry(5.8, 7.4, 0.62, 0.28, 10);
    const material = new THREE.MeshStandardMaterial({
      color: 0xd4c4a0,
      roughness: 0.85,
      metalness: 0,
      normalMap: createScuffedNormalMap(),
      normalScale: new THREE.Vector2(0.25, 0.25)
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0.02, -0.55);
    mesh.rotation.x = 0.12;
    mesh.rotation.y = 0.05;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private addLighting(): void {
    const warm = new THREE.DirectionalLight(0xffd580, 1.2);
    warm.position.set(-3, 5, 4);
    warm.castShadow = true;
    warm.shadow.mapSize.set(2048, 2048);
    warm.shadow.camera.near = 0.5;
    warm.shadow.camera.far = 14;
    warm.shadow.camera.left = -5;
    warm.shadow.camera.right = 5;
    warm.shadow.camera.top = 5;
    warm.shadow.camera.bottom = -5;

    const cool = new THREE.DirectionalLight(0xa0b8d0, 0.4);
    cool.position.set(3, -1, 3);

    const hemi = new THREE.HemisphereLight(0xe8d8b0, 0x4a3c2a, 0.5);
    this.scene.add(warm, cool, hemi);
  }

  private addGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.ShadowMaterial({ color: 0x3a2a1a, opacity: 0.18 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -3.2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }
}

function createScuffedNormalMap(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create normal-map canvas.');

  context.fillStyle = 'rgb(128, 128, 255)';
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 1600; i += 1) {
    const shade = 116 + Math.random() * 28;
    context.strokeStyle = `rgba(${shade}, ${shade}, 255, ${0.05 + Math.random() * 0.16})`;
    context.lineWidth = Math.random() * 1.6;
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 8);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.needsUpdate = true;
  return texture;
}

function createRoundedBoxGeometry(width: number, height: number, depth: number, radius: number, segments: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;

  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: radius * 0.42,
    bevelThickness: radius * 0.36,
    bevelSegments: segments
  });
  geometry.center();
  return geometry;
}
