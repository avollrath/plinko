import { buckets, type BucketId } from './uiState';

type Vec2 = {
  x: number;
  y: number;
};

type Chip = {
  position: Vec2;
  velocity: Vec2;
  radius: number;
  trail: Vec2[];
};

type Peg = Vec2 & {
  radius: number;
};

type PlinkoOptions = {
  onStart: () => void;
  onLanding: (id: BucketId, points: number) => void;
  isActive: () => boolean;
};

export class PlinkoPhysics {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pegs: Peg[] = [];
  private chip?: Chip;
  private lastTime = performance.now();
  private flashUntil = 0;
  private flashBucket?: BucketId;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: PlinkoOptions
  ) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create Plinko canvas context.');
    this.ctx = context;
    this.pegs = this.createPegs();
  }

  drop(): void {
    if (this.chip || this.options.isActive()) {
      return;
    }

    this.options.onStart();
    this.chip = {
      position: { x: 200 + (Math.random() - 0.5) * 34, y: 34 },
      velocity: { x: (Math.random() - 0.5) * 38, y: 18 },
      radius: 8,
      trail: []
    };
  }

  update(now = performance.now()): void {
    const delta = Math.min((now - this.lastTime) / 1000, 1 / 30);
    this.lastTime = now;

    if (this.chip) {
      this.integrate(this.chip, delta);
    }

    this.draw();
  }

  private integrate(chip: Chip, delta: number): void {
    chip.velocity.y += 920 * delta;
    chip.velocity.x *= 0.993;
    chip.velocity.y *= 0.997;

    const speed = Math.hypot(chip.velocity.x, chip.velocity.y);
    if (speed > 760) {
      chip.velocity.x = (chip.velocity.x / speed) * 760;
      chip.velocity.y = (chip.velocity.y / speed) * 760;
    }

    chip.position.x += chip.velocity.x * delta;
    chip.position.y += chip.velocity.y * delta;

    if (chip.position.x - chip.radius < 12) {
      chip.position.x = 12 + chip.radius;
      chip.velocity.x = Math.abs(chip.velocity.x) * 0.52;
    }
    if (chip.position.x + chip.radius > 388) {
      chip.position.x = 388 - chip.radius;
      chip.velocity.x = -Math.abs(chip.velocity.x) * 0.52;
    }

    for (const peg of this.pegs) {
      this.resolvePegCollision(chip, peg);
    }

    chip.trail.unshift({ ...chip.position });
    chip.trail = chip.trail.slice(0, 12);

    if (chip.position.y + chip.radius >= this.canvas.height) {
      this.resolveLanding(chip.position.x);
    }
  }

  private resolvePegCollision(chip: Chip, peg: Peg): void {
    const dx = chip.position.x - peg.x;
    const dy = chip.position.y - peg.y;
    const distance = Math.hypot(dx, dy);
    const minDistance = chip.radius + peg.radius;

    if (distance >= minDistance || distance === 0) {
      return;
    }

    const nx = dx / distance;
    const ny = dy / distance;
    const overlap = minDistance - distance;
    chip.position.x += nx * overlap;
    chip.position.y += ny * overlap;

    const velocityAlongNormal = chip.velocity.x * nx + chip.velocity.y * ny;
    if (velocityAlongNormal < 0) {
      chip.velocity.x -= (1 + 0.45) * velocityAlongNormal * nx;
      chip.velocity.y -= (1 + 0.45) * velocityAlongNormal * ny;
      chip.velocity.x += (Math.random() - 0.5) * 42;
    }
  }

  private resolveLanding(x: number): void {
    const bucketWidth = this.canvas.width / buckets.length;
    const index = Math.max(0, Math.min(buckets.length - 1, Math.floor(x / bucketWidth)));
    const bucket = buckets[index];
    this.chip = undefined;
    this.flashBucket = bucket.id;
    this.flashUntil = performance.now() + 600;
    this.options.onLanding(bucket.id, bucket.points);
  }

  private draw(): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawField();
    this.drawPegs();
    if (this.chip) this.drawChip(this.chip);
    this.drawBucketGuides();
  }

  private drawField(): void {
    const { ctx } = this;
    ctx.fillStyle = '#8A9A7A';
    ctx.fillRect(0, 0, 400, 480);

    ctx.strokeStyle = 'rgba(58, 42, 26, 0.18)';
    ctx.lineWidth = 1;
    for (let y = 24; y < 480; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(400, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#3a2a1a';
    ctx.font = '18px "Share Tech Mono", monospace';
    ctx.fillText('DROP VECTOR FIELD // 400x480', 18, 28);

    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10, 44);
    ctx.lineTo(10, 480);
    ctx.moveTo(390, 44);
    ctx.lineTo(390, 480);
    ctx.stroke();
  }

  private drawPegs(): void {
    const { ctx } = this;
    for (const peg of this.pegs) {
      ctx.beginPath();
      ctx.fillStyle = '#3a2a1a';
      ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawChip(chip: Chip): void {
    const { ctx } = this;
    chip.trail.forEach((point, index) => {
      ctx.globalAlpha = (1 - index / chip.trail.length) * 0.22;
      ctx.beginPath();
      ctx.fillStyle = '#E0D4B0';
      ctx.arc(point.x, point.y, chip.radius + 1, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.fillStyle = '#E0D4B0';
    ctx.arc(chip.position.x, chip.position.y, chip.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = '#3a2a1a';
    ctx.arc(chip.position.x, chip.position.y, chip.radius * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBucketGuides(): void {
    const { ctx } = this;
    const bucketWidth = this.canvas.width / buckets.length;
    buckets.forEach((bucket, index) => {
      const x = index * bucketWidth;
      const flashing = this.flashBucket === bucket.id && performance.now() < this.flashUntil;
      ctx.fillStyle = flashing ? 'rgba(200, 184, 130, 0.72)' : 'rgba(58, 42, 26, 0.08)';
      ctx.fillRect(x + 2, 424, bucketWidth - 4, 54);
      ctx.strokeStyle = '#3a2a1a';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, 424, bucketWidth - 4, 54);
      ctx.fillStyle = '#3a2a1a';
      ctx.font = '15px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(bucket.id, x + bucketWidth / 2, 447);
      ctx.font = '13px "Share Tech Mono", monospace';
      ctx.fillText(String(bucket.points), x + bucketWidth / 2, 467);
    });
    ctx.textAlign = 'start';
  }

  private createPegs(): Peg[] {
    const pegs: Peg[] = [];
    const rows = 8;
    const cols = 9;
    const startY = 92;
    const spacingX = 38;
    const spacingY = 39;
    const firstX = 48;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = firstX + col * spacingX + (row % 2 === 1 ? spacingX / 2 : 0);
        if (x > 360) continue;
        pegs.push({ x, y: startY + row * spacingY, radius: 5 });
      }
    }
    return pegs;
  }
}
