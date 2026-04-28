import './styles.css';

const root = document.querySelector<HTMLDivElement>('#hud-root');

if (root) {
  root.innerHTML = `
    <div class="boot-panel">
      <p class="eyebrow">Arcade Physics</p>
      <h1>PLINKO</h1>
      <p>Loading the board...</p>
    </div>
  `;
}
