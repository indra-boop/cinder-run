type Kind = "jump" | "djump" | "coin" | "hurt" | "check" | "win" | "land";

export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  play(kind: Kind) {
    if (this.muted || !this.ctx) return;
    const ctx = this.ctx;
    if (ctx.state !== "running") return;
    const now = ctx.currentTime;
    if (kind === "jump") this.tone(ctx, 420, 280, 0.09, "square", 0.05, now);
    else if (kind === "djump") {
      this.tone(ctx, 560, 360, 0.1, "square", 0.05, now);
      this.tone(ctx, 780, 520, 0.08, "triangle", 0.03, now + 0.02);
    } else if (kind === "coin") {
      this.tone(ctx, 880, 880, 0.06, "triangle", 0.05, now);
      this.tone(ctx, 1175, 1175, 0.07, "triangle", 0.045, now + 0.05);
      this.tone(ctx, 1568, 1568, 0.1, "sine", 0.04, now + 0.1);
    } else if (kind === "hurt") this.tone(ctx, 220, 70, 0.22, "sawtooth", 0.06, now);
    else if (kind === "check") {
      this.tone(ctx, 523, 523, 0.1, "sine", 0.04, now);
      this.tone(ctx, 784, 988, 0.16, "sine", 0.04, now + 0.08);
    } else if (kind === "land") this.tone(ctx, 140, 90, 0.05, "sine", 0.03, now);
    else if (kind === "win") {
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => this.tone(ctx, n, n, 0.16, "triangle", 0.045, now + i * 0.09));
    }
  }

  private tone(
    ctx: AudioContext,
    f0: number,
    f1: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    when: number,
  ) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, when);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(40, f1), when + dur);
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }
}
