import * as CANNON from 'cannon-es';
import { boardConfig } from '../config';
import { getPegPositions } from '../game/boardLayout';

export type BallBody = {
  body: CANNON.Body;
  createdAt: number;
};

export class PlinkoPhysics {
  readonly world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -18, 0)
  });

  readonly ballMaterial = new CANNON.Material('ball');
  readonly pegMaterial = new CANNON.Material('peg');
  readonly wallMaterial = new CANNON.Material('wall');
  readonly slotMaterial = new CANNON.Material('slot');

  private readonly fixedTimeStep = 1 / 60;
  private readonly maxSubSteps = 4;
  private lastTime?: number;

  constructor() {
    this.world.allowSleep = true;
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.defaultContactMaterial.friction = 0.03;
    this.world.defaultContactMaterial.restitution = 0.42;

    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.ballMaterial, this.pegMaterial, {
        friction: 0.02,
        restitution: 0.76
      })
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.ballMaterial, this.wallMaterial, {
        friction: 0.01,
        restitution: 0.48
      })
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.ballMaterial, this.slotMaterial, {
        friction: 0.12,
        restitution: 0.18
      })
    );

    this.addPegs();
    this.addWalls();
    this.addSlotDividers();
  }

  step(nowMs: number): void {
    const now = nowMs / 1000;
    if (this.lastTime === undefined) {
      this.lastTime = now;
      return;
    }

    const delta = Math.min(now - this.lastTime, 0.08);
    this.world.step(this.fixedTimeStep, delta, this.maxSubSteps);
    this.lastTime = now;
  }

  createBall(x: number): BallBody {
    const shape = new CANNON.Sphere(boardConfig.ballRadius);
    const body = new CANNON.Body({
      mass: 1,
      material: this.ballMaterial,
      position: new CANNON.Vec3(x, 6.15, 0.14),
      shape,
      linearDamping: 0.08,
      angularDamping: 0.18
    });
    body.velocity.set((Math.random() - 0.5) * 0.9, -0.6, 0);
    body.angularVelocity.set(Math.random() * 2, 0, Math.random() * 2);
    body.allowSleep = false;
    this.world.addBody(body);
    return { body, createdAt: performance.now() };
  }

  removeBody(body: CANNON.Body): void {
    this.world.removeBody(body);
  }

  private addPegs(): void {
    const shape = new CANNON.Sphere(boardConfig.pegRadius);
    getPegPositions().forEach(({ x, y }) => {
      const body = new CANNON.Body({
        type: CANNON.Body.STATIC,
        material: this.pegMaterial,
        shape,
        position: new CANNON.Vec3(x, y, 0.14)
      });
      this.world.addBody(body);
    });
  }

  private addWalls(): void {
    const wallHeight = boardConfig.height - 1.1;
    const wallShape = new CANNON.Box(new CANNON.Vec3(0.16, wallHeight / 2, 0.5));
    [-1, 1].forEach((side) => {
      const body = new CANNON.Body({
        type: CANNON.Body.STATIC,
        material: this.wallMaterial,
        shape: wallShape,
        position: new CANNON.Vec3(side * (boardConfig.width / 2 - 0.06), -0.1, 0.12)
      });
      this.world.addBody(body);
    });

    const floor = new CANNON.Body({
      type: CANNON.Body.STATIC,
      material: this.slotMaterial,
      shape: new CANNON.Box(new CANNON.Vec3(boardConfig.width / 2, 0.12, 0.5)),
      position: new CANNON.Vec3(0, -6.7, 0.12)
    });
    this.world.addBody(floor);

    // A shallow back plate keeps the simulation essentially 2D while still using spheres.
    const back = new CANNON.Body({
      type: CANNON.Body.STATIC,
      material: this.wallMaterial,
      shape: new CANNON.Box(new CANNON.Vec3(boardConfig.width / 2, boardConfig.height / 2, 0.08)),
      position: new CANNON.Vec3(0, 0, -0.12)
    });
    this.world.addBody(back);
  }

  private addSlotDividers(): void {
    const slotWidth = boardConfig.width / boardConfig.slotCount;
    const dividerShape = new CANNON.Box(new CANNON.Vec3(0.045, 0.52, 0.5));
    for (let index = 1; index < boardConfig.slotCount; index += 1) {
      const x = -boardConfig.width / 2 + slotWidth * index;
      const body = new CANNON.Body({
        type: CANNON.Body.STATIC,
        material: this.slotMaterial,
        shape: dividerShape,
        position: new CANNON.Vec3(x, -6.2, 0.12)
      });
      this.world.addBody(body);
    }
  }
}
