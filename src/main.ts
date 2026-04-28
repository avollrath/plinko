import './styles.css';
import { TerminalScene } from './threeScene';
import { buckets, createInitialState, type BucketId, type TerminalState } from './uiState';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const state = createInitialState();
let reelAngle = 0;
let footerTick = 0;

app.innerHTML = `
  <canvas id="terminal-scene" aria-hidden="true"></canvas>
  <main class="terminal-ui" aria-label="PLNK-7 terminal dashboard">
    <header class="header-rail">
      <div class="boxed-logo">PLNK-7 // UNIT</div>
      <div class="status-pills" aria-label="Status indicators">
        <span class="pill pill-red"></span>
        <span class="pill pill-amber" data-indicator="amber"></span>
        <span class="pill pill-green"></span>
      </div>
      <div class="model-id">MODEL ID: 88-X4 // REV.C</div>
    </header>

    <section class="dashboard-grid">
      <aside class="panel left-panel">
        <div class="screw screw-tl"></div><div class="screw screw-tr"></div>
        <h2>VU-METER</h2>
        <div class="vu-meter" data-vu></div>
        <div class="module">
          <h2>SCORE_CTR</h2>
          <div class="recessed numeric" data-score>0000</div>
        </div>
        <div class="module reel-module">
          <div class="reel-row">
            <div class="reel" data-reel-a><span></span></div>
            <div class="reel" data-reel-b><span></span></div>
          </div>
          <h2>REEL STATUS</h2>
          <div class="recessed status-readout" data-reel-status>STANDBY</div>
        </div>
        <div class="module">
          <h2>DROP_STATS</h2>
          <div class="stats-grid">
            <span>L</span><strong data-stat-left>00</strong>
            <span>C</span><strong data-stat-center>00</strong>
            <span>R</span><strong data-stat-right>00</strong>
          </div>
        </div>
      </aside>

      <section class="panel center-panel">
        <div class="screw screw-tl"></div><div class="screw screw-tr"></div>
        <div class="playfield-frame">
          <canvas id="plinko-canvas" width="400" height="480" aria-label="PLNK-7 plinko play field"></canvas>
        </div>
        <div class="bucket-row" data-buckets></div>
        <div class="control-bar">
          <div class="knob-wrap">
            <div class="knob"><span></span></div>
            <label>FREQ</label>
          </div>
          <button class="drop-dome" data-drop type="button">DROP</button>
          <div class="knob-wrap">
            <div class="knob knob-bias"><span></span></div>
            <label>BIAS</label>
          </div>
        </div>
      </section>

      <aside class="panel right-panel">
        <div class="screw screw-tl"></div><div class="screw screw-tr"></div>
        <h2>LANDING_LOG</h2>
        <ol class="landing-log" data-log></ol>
        <div class="module">
          <h2>DIST_CHART</h2>
          <div class="dist-chart" data-dist></div>
        </div>
        <div class="module">
          <h2>ELAPSED_TIME</h2>
          <div class="recessed numeric" data-time>00:00</div>
        </div>
      </aside>
    </section>

    <footer class="footer-rail">
      <div class="copyright">© 1984 PLNK SYSTEMS // ALL RIGHTS RESERVED</div>
      <div class="footer-progress" data-progress></div>
      <div class="footer-status" data-footer-status>STANDBY</div>
    </footer>
  </main>
`;

const dropButton = document.querySelector<HTMLButtonElement>('[data-drop]');
const terminalCanvas = document.querySelector<HTMLCanvasElement>('#terminal-scene');
const vuMeter = document.querySelector<HTMLDivElement>('[data-vu]');
const bucketRow = document.querySelector<HTMLDivElement>('[data-buckets]');
const distChart = document.querySelector<HTMLDivElement>('[data-dist]');
const progress = document.querySelector<HTMLDivElement>('[data-progress]');

if (!terminalCanvas) {
  throw new Error('Terminal scene canvas was not found.');
}

const terminalScene = new TerminalScene(terminalCanvas);

function resizeScene(): void {
  terminalScene.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio);
}

window.addEventListener('resize', resizeScene);
resizeScene();

if (vuMeter) {
  vuMeter.innerHTML = Array.from({ length: 6 }, (_, row) =>
    `<div class="vu-row" data-vu-row="${row}">${Array.from({ length: 12 }, () => '<i></i>').join('')}</div>`
  ).join('');
}

if (bucketRow) {
  bucketRow.innerHTML = buckets
    .map((bucket) => `<div class="bucket-tab" data-bucket="${bucket.id}"><strong>${bucket.id}</strong><span>${bucket.points}</span></div>`)
    .join('');
}

if (distChart) {
  distChart.innerHTML = buckets
    .map(
      (bucket) => `
        <div class="dist-row" data-dist-row="${bucket.id}">
          <span>${bucket.id}</span>
          <div>${Array.from({ length: 10 }, () => '<i></i>').join('')}</div>
        </div>`
    )
    .join('');
}

if (progress) {
  progress.innerHTML = Array.from({ length: 10 }, () => '<i></i>').join('');
}

dropButton?.addEventListener('click', () => setActive(true));
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    setActive(true);
  }
});

function setActive(active: boolean): void {
  if (state.active === active) {
    return;
  }
  state.active = active;
  renderState();
}

function renderState(): void {
  const score = document.querySelector<HTMLElement>('[data-score]');
  const time = document.querySelector<HTMLElement>('[data-time]');
  const reelStatus = document.querySelector<HTMLElement>('[data-reel-status]');
  const footerStatus = document.querySelector<HTMLElement>('[data-footer-status]');

  if (score) score.textContent = state.score.toString().padStart(4, '0').slice(-4);
  if (time) time.textContent = formatTime(state.elapsedSeconds);
  if (reelStatus) reelStatus.textContent = state.active ? 'TAPE_RUNNING' : 'STANDBY';
  if (footerStatus) footerStatus.textContent = state.active ? 'ACTIVE' : 'STANDBY';
  if (dropButton) dropButton.disabled = state.active;

  renderStats(state);
}

function renderStats(nextState: TerminalState): void {
  document.querySelector<HTMLElement>('[data-stat-left]')!.textContent = nextState.stats.left.toString().padStart(2, '0');
  document.querySelector<HTMLElement>('[data-stat-center]')!.textContent = nextState.stats.center.toString().padStart(2, '0');
  document.querySelector<HTMLElement>('[data-stat-right]')!.textContent = nextState.stats.right.toString().padStart(2, '0');
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
}

function animateShell(): void {
  state.elapsedSeconds += 1 / 60;
  footerTick = (footerTick + 1) % 10;

  const amber = document.querySelector<HTMLElement>('[data-indicator="amber"]');
  if (amber) amber.style.opacity = state.active ? (Math.sin(Date.now() * 0.006) > 0 ? '0.82' : '0.24') : '0.32';

  if (state.active) {
    document.querySelectorAll<HTMLDivElement>('.vu-row').forEach((row) => {
      const activeSegments = 2 + Math.floor(Math.random() * 10);
      row.querySelectorAll('i').forEach((segment, index) => segment.classList.toggle('is-on', index < activeSegments));
    });
    reelAngle += 3.8;
  }

  document.querySelectorAll<HTMLElement>('[data-reel-a], [data-reel-b]').forEach((reel, index) => {
    reel.style.transform = `rotate(${reelAngle * (index === 0 ? 1 : -0.72)}deg)`;
  });

  document.querySelectorAll<HTMLElement>('[data-progress] i').forEach((segment, index) => {
    segment.classList.toggle('is-on', state.active && index <= footerTick);
  });

  renderState();
  terminalScene.render();
  requestAnimationFrame(animateShell);
}

function registerLanding(id: BucketId, points: number): void {
  state.score += points;
  state.active = false;
  state.distribution[id] += 1;
  if (id === 'CTR') state.stats.center += 1;
  else if (id.startsWith('L')) state.stats.left += 1;
  else state.stats.right += 1;

  state.landings.unshift({ id, points, stamp: formatTime(state.elapsedSeconds) });
  state.landings = state.landings.slice(0, 8);
  state.flashBucket = id;
  renderState();
}

window.__PLINKO_REGISTER_LANDING__ = registerLanding;
renderState();
animateShell();

declare global {
  interface Window {
    __PLINKO_REGISTER_LANDING__?: (id: BucketId, points: number) => void;
  }
}
