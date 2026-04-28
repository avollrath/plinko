import type * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { boardConfig, economyConfig } from '../config';
import { getSlotForX } from './boardLayout';
import { PlinkoPhysics, type BallBody } from '../physics/PlinkoPhysics';
import { PlinkoScene } from '../three/PlinkoScene';
import { SoundHooks } from '../audio/soundHooks';
import type { SlotResult } from '../types';

export type GameState = {
  balance: number;
  bet: number;
  lastWin: number;
  lastSlot?: SlotResult;
  isDropping: boolean;
};

export type GameStateListener = (state: GameState) => void;

type ActiveBall = BallBody & {
  mesh: THREE.Mesh;
  settledAt?: number;
};

export class GameController {
  private readonly stateListeners = new Set<GameStateListener>();
  private readonly sounds = new SoundHooks();
  private activeBall?: ActiveBall;
  private state: GameState = {
    balance: economyConfig.startingBalance,
    bet: economyConfig.bets[0],
    lastWin: 0,
    isDropping: false
  };

  constructor(
    private readonly scene: PlinkoScene,
    private readonly physics: PlinkoPhysics
  ) {
    this.physics.world.addEventListener('beginContact', (event: { bodyA: CANNON.Body; bodyB: CANNON.Body }) => {
      this.handleContact(event.bodyA, event.bodyB);
    });
  }

  subscribe(listener: GameStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => this.stateListeners.delete(listener);
  }

  getState(): GameState {
    return { ...this.state };
  }

  setBet(bet: number): void {
    if (!economyConfig.bets.includes(bet as (typeof economyConfig.bets)[number])) {
      return;
    }
    this.state = { ...this.state, bet };
    this.emit();
  }

  dropBall(): void {
    if (this.state.isDropping || this.state.balance < this.state.bet) {
      return;
    }

    this.sounds.play('button');
    const spawnX = (Math.random() - 0.5) * 1.2;
    const ball = this.physics.createBall(spawnX);
    const mesh = this.scene.createBallMesh();
    this.activeBall = { ...ball, mesh };
    this.state = {
      ...this.state,
      balance: this.state.balance - this.state.bet,
      lastWin: 0,
      isDropping: true
    };
    this.emit();
  }

  reset(): void {
    if (this.activeBall) {
      this.clearBall(this.activeBall);
    }
    this.state = {
      balance: economyConfig.startingBalance,
      bet: economyConfig.bets[0],
      lastWin: 0,
      isDropping: false
    };
    this.emit();
  }

  update(): void {
    if (!this.activeBall) {
      return;
    }

    this.syncBall(this.activeBall);
    const { body, createdAt } = this.activeBall;
    const elapsed = performance.now() - createdAt;
    const lowEnoughForSlot = body.position.y <= -6.04;
    const movingSlowly = body.velocity.length() < 0.9;
    const timedOut = elapsed > 11500;

    if (lowEnoughForSlot && (movingSlowly || timedOut)) {
      this.resolveBall(getSlotForX(body.position.x));
      return;
    }

    if (timedOut || Math.abs(body.position.x) > boardConfig.width || body.position.y < -7.2) {
      this.resolveBall(getSlotForX(body.position.x));
    }
  }

  private handleContact(bodyA: CANNON.Body, bodyB: CANNON.Body): void {
    if (!this.activeBall) {
      return;
    }

    const ballId = this.activeBall.body.id;
    if (bodyA.id !== ballId && bodyB.id !== ballId) {
      return;
    }

    const other = bodyA.id === ballId ? bodyB : bodyA;
    if (other.material?.name === 'peg') {
      this.sounds.play('peg');
    }
  }

  private syncBall(ball: ActiveBall): void {
    ball.mesh.position.copy(ball.body.position as unknown as THREE.Vector3);
    ball.mesh.quaternion.copy(ball.body.quaternion as unknown as THREE.Quaternion);
  }

  private resolveBall(slot: SlotResult): void {
    if (!this.activeBall) {
      return;
    }

    const win = Math.round(this.state.bet * slot.multiplier);
    this.sounds.play('slot');
    this.clearBall(this.activeBall);
    this.activeBall = undefined;
    this.state = {
      ...this.state,
      balance: this.state.balance + win,
      lastWin: win,
      lastSlot: slot,
      isDropping: false
    };
    this.emit();
  }

  private clearBall(ball: ActiveBall): void {
    this.physics.removeBody(ball.body);
    this.scene.removeBallMesh(ball.mesh);
  }

  private emit(): void {
    const snapshot = this.getState();
    this.stateListeners.forEach((listener) => listener(snapshot));
  }
}
