export type SoundName = 'button' | 'peg' | 'slot';

export class SoundHooks {
  private lastPegAt = 0;

  play(name: SoundName): void {
    if (name === 'peg') {
      const now = performance.now();
      if (now - this.lastPegAt < 80) {
        return;
      }
      this.lastPegAt = now;
    }

    // Placeholder hook: replace this method with Web Audio samples or synth tones.
    window.dispatchEvent(new CustomEvent('plinko:sound', { detail: { name } }));
  }
}
