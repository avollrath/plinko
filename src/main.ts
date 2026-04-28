import './styles.css';
import { GameController } from './game/GameController';
import { PlinkoPhysics } from './physics/PlinkoPhysics';
import { PlinkoScene } from './three/PlinkoScene';

const root = document.querySelector<HTMLDivElement>('#hud-root');
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');

if (root) {
  root.innerHTML = `
    <div class="boot-panel">
      <p class="eyebrow">Arcade Physics</p>
      <h1>PLINKO</h1>
      <p>Loading the board...</p>
    </div>
  `;
}

if (!canvas) {
  throw new Error('Game canvas was not found.');
}

const plinkoScene = new PlinkoScene(canvas);
const physics = new PlinkoPhysics();
const game = new GameController(plinkoScene, physics);

window.addEventListener('pointerdown', (event) => {
  if (event.target === canvas) {
    game.dropBall();
  }
});

function resize(): void {
  plinkoScene.resize({
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: window.devicePixelRatio
  });
}

function animate(): void {
  physics.step(performance.now());
  game.update();
  plinkoScene.render();
  window.requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);
resize();
animate();
