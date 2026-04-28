import { economyConfig } from '../config';
import type { GameController, GameState } from '../game/GameController';

export class Hud {
  private balanceEl?: HTMLElement;
  private lastWinEl?: HTMLElement;
  private slotEl?: HTMLElement;
  private dropButton?: HTMLButtonElement;
  private betButtons: HTMLButtonElement[] = [];

  constructor(
    private readonly root: HTMLDivElement,
    private readonly game: GameController
  ) {
    this.renderShell();
    this.game.subscribe((state) => this.renderState(state));
  }

  private renderShell(): void {
    this.root.innerHTML = `
      <header class="title-wrap">
        <div class="title-shadow">PLINKO</div>
        <h1 class="game-title">PLINKO</h1>
      </header>
      <section class="hud-panel" aria-label="Game controls">
        <div class="stats-row">
          <div class="stat">
            <span>Balance</span>
            <strong data-hud="balance">$100</strong>
          </div>
          <div class="stat">
            <span>Last Win</span>
            <strong data-hud="last-win">$0</strong>
          </div>
          <div class="stat slot-stat">
            <span>Slot</span>
            <strong data-hud="slot">-</strong>
          </div>
        </div>
        <div class="controls-row">
          <div class="bet-group" role="group" aria-label="Bet amount"></div>
          <button class="drop-button" type="button">Drop Ball</button>
          <button class="reset-button" type="button">Reset</button>
        </div>
      </section>
    `;

    this.balanceEl = this.root.querySelector('[data-hud="balance"]') ?? undefined;
    this.lastWinEl = this.root.querySelector('[data-hud="last-win"]') ?? undefined;
    this.slotEl = this.root.querySelector('[data-hud="slot"]') ?? undefined;
    this.dropButton = this.root.querySelector<HTMLButtonElement>('.drop-button') ?? undefined;
    const betGroup = this.root.querySelector<HTMLDivElement>('.bet-group');

    if (betGroup) {
      this.betButtons = economyConfig.bets.map((bet) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bet-button';
        button.textContent = `$${bet}`;
        button.addEventListener('click', () => this.game.setBet(bet));
        betGroup.append(button);
        return button;
      });
    }

    this.dropButton?.addEventListener('click', () => this.game.dropBall());
    this.root.querySelector<HTMLButtonElement>('.reset-button')?.addEventListener('click', () => this.game.reset());
  }

  private renderState(state: GameState): void {
    if (this.balanceEl) {
      this.balanceEl.textContent = `$${state.balance}`;
    }
    if (this.lastWinEl) {
      this.lastWinEl.textContent = `$${state.lastWin}`;
    }
    if (this.slotEl) {
      this.slotEl.textContent = state.lastSlot ? `${state.lastSlot.label} x${state.lastSlot.multiplier}` : '-';
    }
    this.betButtons.forEach((button) => {
      const bet = Number(button.textContent?.replace('$', ''));
      button.classList.toggle('is-active', bet === state.bet);
      button.disabled = state.isDropping;
    });
    if (this.dropButton) {
      this.dropButton.disabled = state.isDropping || state.balance < state.bet;
      this.dropButton.textContent = state.isDropping ? 'Dropping...' : 'Drop Ball';
    }
  }
}
