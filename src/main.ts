import './styles.css';
import { GameController } from './game/GameController';
import { PlinkoPhysics } from './physics/PlinkoPhysics';
import { PlinkoScene } from './three/PlinkoScene';
import { Hud } from './ui/Hud';

const root = document.querySelector<HTMLDivElement>('#hud-root');
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');

if (!canvas) {
  throw new Error('Game canvas was not found.');
}
if (!root) {
  throw new Error('HUD root was not found.');
}

const plinkoScene = new PlinkoScene(canvas);
const physics = new PlinkoPhysics();
const game = new GameController(plinkoScene, physics);
new Hud(root, game);

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
