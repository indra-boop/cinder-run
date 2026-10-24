import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { Coins, Flag, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { SAVE_KEY, VIEW_H, VIEW_W } from "@/game/constants";
import { loadArt, render, type Art } from "@/game/draw";
import { LEVELS } from "@/game/levels";
import { Sfx } from "@/game/sfx";
import { createWorld, EMPTY_INPUT, step, type Input, type World } from "@/game/sim";

type Mode = "title" | "play" | "pause" | "clear";

type Save = {
  v: 1;
  best: [number, number, number];
  cleared: [boolean, boolean, boolean];
  shake: boolean;
  muted: boolean;
};

const DEFAULT_SAVE: Save = {
  v: 1,
  best: [0, 0, 0],
  cleared: [false, false, false],
  shake: true,
  muted: false,
};

const BLOCKED = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
]);

declare global {
  interface Window {
    __controlsTest?: {
      getX: () => number;
      getY: () => number;
      getSpeed: () => number;
      getYaw: () => number;
      getVy: () => number;
      getGrounded: () => boolean;
      setKeys: (codes: string[]) => void;
    };
  }
}

function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE, best: [0, 0, 0], cleared: [false, false, false] };
    const parsed = JSON.parse(raw) as Partial<Save>;
    if (parsed.v !== 1 || !parsed.best || !parsed.cleared) return { ...DEFAULT_SAVE };
    return {
      v: 1,
      best: [parsed.best[0] ?? 0, parsed.best[1] ?? 0, parsed.best[2] ?? 0],
      cleared: [!!parsed.cleared[0], !!parsed.cleared[1], !!parsed.cleared[2]],
      shake: parsed.shake !== false,
      muted: !!parsed.muted,
    };
  } catch {
    return { ...DEFAULT_SAVE, best: [0, 0, 0], cleared: [false, false, false] };
  }
}

function readInput(keys: Set<string>): Input {
  return {
    left: keys.has("KeyA") || keys.has("ArrowLeft"),
    right: keys.has("KeyD") || keys.has("ArrowRight"),
    jump: keys.has("Space") || keys.has("KeyW") || keys.has("ArrowUp") || keys.has("KeyZ"),
    down: keys.has("KeyS") || keys.has("ArrowDown"),
  };
}

export function CinderRun() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const keysRef = useRef(new Set<string>());
  const modeRef = useRef<Mode>("title");
  const sfxRef = useRef<Sfx | null>(null);
  const artRef = useRef<Art | null>(null);
  const shakeRef = useRef(true);
  const beginRef = useRef<(index: number, next: Mode) => void>(() => {});
  const [mode, setMode] = useState<Mode>("title");
  const [levelIndex, setLevelIndex] = useState(0);
  const [coins, setCoins] = useState(0);
  const [dead, setDead] = useState(false);
  const [checkpoint, setCheckpoint] = useState(-1);
  const [hint, setHint] = useState(false);
  const [save, setSave] = useState<Save>(DEFAULT_SAVE);
  const [touch, setTouch] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stored = loadSave();
    if (reduced) stored.shake = false;
    setSave(stored);
    shakeRef.current = stored.shake;
    const sfx = new Sfx();
    sfx.muted = stored.muted;
    sfxRef.current = sfx;

    const coarse = window.matchMedia("(pointer: coarse)");
    const updateTouch = () => setTouch(coarse.matches || window.innerWidth < 860);
    updateTouch();
    coarse.addEventListener("change", updateTouch);
    window.addEventListener("resize", updateTouch);

    const art = loadArt();
    artRef.current = art;
    worldRef.current = createWorld(0);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(VIEW_W * dpr);
      canvas.height = Math.round(VIEW_H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
    };
    fit();
    window.addEventListener("resize", fit);

    let last = performance.now();
    let raf = 0;
    let sig = "";

    const publish = (nextMode: Mode) => {
      const w = worldRef.current;
      if (!w) return;
      const level = LEVELS[w.levelIndex]!;
      const nextHint = nextMode === "play" && w.time < 4.2;
      const nextDead = w.player.dead > 0;
      const key = `${nextMode}|${w.levelIndex}|${w.coinCount}|${nextDead}|${w.cp}|${nextHint}|${w.won}`;
      if (key === sig) return;
      sig = key;
      setLevelIndex(w.levelIndex);
      setCoins(w.coinCount);
      setDead(nextDead);
      setCheckpoint(w.cp);
      setHint(nextHint);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = worldRef.current;
      const current = modeRef.current;
      if (w) {
        if (current === "play") step(w, readInput(keysRef.current), dt, true);
        else if (current === "title" || current === "clear") step(w, EMPTY_INPUT, dt, false);
        const events = w.events.splice(0, w.events.length);
        for (const event of events) {
          if (
            event === "jump" ||
            event === "djump" ||
            event === "coin" ||
            event === "hurt" ||
            event === "check" ||
            event === "win" ||
            event === "land"
          ) {
            sfx.play(event);
          }
          if (event === "check") {
            setToast("Lantern lit");
            window.setTimeout(() => setToast(""), 1600);
          }
          if (event === "win") {
            setSave((prev) => {
              const best: [number, number, number] = [...prev.best];
              const cleared: [boolean, boolean, boolean] = [...prev.cleared];
              best[w.levelIndex] = Math.max(best[w.levelIndex] ?? 0, w.coinCount);
              cleared[w.levelIndex] = true;
              const next = { ...prev, best, cleared };
              localStorage.setItem(SAVE_KEY, JSON.stringify(next));
              return next;
            });
            modeRef.current = "clear";
            setMode("clear");
          }
        }
        if (artRef.current) render(ctx, w, artRef.current, shakeRef.current);
        publish(modeRef.current);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      sfx.unlock();
      if (modeRef.current === "play" || modeRef.current === "pause" || modeRef.current === "clear") {
        if (BLOCKED.has(e.code)) e.preventDefault();
      }
      keysRef.current.add(e.code);
      if (e.code === "Escape" && modeRef.current === "play") {
        keysRef.current.clear();
        modeRef.current = "pause";
        setMode("pause");
      } else if (e.code === "Escape" && modeRef.current === "pause") {
        modeRef.current = "play";
        setMode("play");
      } else if (e.code === "KeyR" && modeRef.current !== "title") {
        beginRef.current(worldRef.current?.levelIndex ?? 0, "play");
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    const onBlur = () => keysRef.current.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    const unlock = () => sfx.unlock();
    window.addEventListener("pointerdown", unlock);

    window.__controlsTest = {
      getX: () => worldRef.current?.player.x ?? 0,
      getY: () => worldRef.current?.player.y ?? 0,
      getSpeed: () => worldRef.current?.player.vx ?? 0,
      getYaw: () => (worldRef.current?.player.facing === 1 ? 0 : Math.PI),
      getVy: () => worldRef.current?.player.vy ?? 0,
      getGrounded: () => worldRef.current?.player.grounded ?? false,
      setKeys: (codes: string[]) => {
        keysRef.current.clear();
        for (const code of codes) keysRef.current.add(code);
      },
    };

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
      window.removeEventListener("resize", updateTouch);
      coarse.removeEventListener("change", updateTouch);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointerdown", unlock);
      delete window.__controlsTest;
    };
  }, []);

  const begin = (index: number, next: Mode) => {
    keysRef.current.clear();
    worldRef.current = createWorld(index);
    modeRef.current = next;
    setMode(next);
    setLevelIndex(index);
    setCoins(0);
    setDead(false);
    setCheckpoint(-1);
    setHint(next === "play");
    setToast("");
    sfxRef.current?.unlock();
  };
  beginRef.current = begin;

  const level = LEVELS[levelIndex] ?? LEVELS[0]!;
  const total = level.coins.length;
  const perfect = coins >= total;
  const lastLevel = levelIndex >= LEVELS.length - 1;

  const hold = (code: string) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      keysRef.current.add(code);
      sfxRef.current?.unlock();
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
      keysRef.current.delete(code);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    },
    onPointerCancel: () => keysRef.current.delete(code),
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  });

  const toggleMute = () => {
    setSave((prev) => {
      const next = { ...prev, muted: !prev.muted };
      if (sfxRef.current) sfxRef.current.muted = next.muted;
      localStorage.setItem(SAVE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const toggleShake = () => {
    setSave((prev) => {
      const next = { ...prev, shake: !prev.shake };
      shakeRef.current = next.shake;
      localStorage.setItem(SAVE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const stageClass =
    mode === "title" ? "stage stage-title" : touch ? "stage stage-touch" : "stage";

  return (
    <div
      className={
        mode === "title"
          ? "min-h-dvh bg-bg text-fg"
          : "flex h-dvh flex-col overflow-hidden bg-bg text-fg"
      }
    >
      {mode === "title" ? (
        <header className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-8 sm:pt-10">
          <p className="text-xs font-medium tracking-[0.22em] text-ember uppercase">Dusk cliffs</p>
          <h1 className="mt-2 font-display text-5xl leading-none text-fg sm:text-6xl">Cinder Run</h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
            Carry the last lantern across the cliffs. Jump once to clear a gap, and again in the air
            when the stone runs out.
          </p>
        </header>
      ) : null}

      <div
        className={
          mode === "title"
            ? "mx-auto mt-5 w-full max-w-5xl px-4 sm:px-8"
            : "flex min-h-0 flex-1 items-center justify-center px-2 py-2 sm:px-4"
        }
      >
        <div className={`relative overflow-hidden rounded-2xl border border-border bg-ink ${stageClass}`}>
          <canvas
            ref={canvasRef}
            className="h-full w-full touch-none"
            width={VIEW_W}
            height={VIEW_H}
            aria-label="Cinder Run"
          />
          {mode !== "title" ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="pointer-events-none max-w-[60%]">
                  <p className="font-display text-lg leading-tight sm:text-2xl">{level.name}</p>
                  {hint ? <p className="mt-1 text-sm text-muted">{level.blurb}</p> : null}
                  {toast && checkpoint >= 0 && mode === "play" ? (
                    <p className="mt-1 text-sm text-teal">{toast}</p>
                  ) : null}
                </div>
                <div className="pointer-events-auto flex items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-full border border-border bg-ink/80 px-3 py-1.5 text-sm text-gold">
                    <Coins className="size-4" aria-hidden="true" />
                    <span>
                      {coins}
                      <span className="text-muted">/{total}</span>
                    </span>
                  </div>
                  <IconButton label="Restart level" onClick={() => begin(levelIndex, "play")}>
                    <RotateCcw className="size-4" />
                  </IconButton>
                  <IconButton label={save.muted ? "Unmute" : "Mute"} onClick={toggleMute}>
                    {save.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                  </IconButton>
                  {mode === "play" ? (
                    <IconButton
                      label="Pause"
                      onClick={() => {
                        keysRef.current.clear();
                        modeRef.current = "pause";
                        setMode("pause");
                      }}
                    >
                      <Pause className="size-4" />
                    </IconButton>
                  ) : null}
                </div>
              </div>
              {dead && mode === "play" ? (
                <div className="pointer-events-none mx-auto mb-6 rounded-2xl border border-border bg-ink/85 px-4 py-3 text-center">
                  <p className="font-display text-xl">Snuffed out</p>
                  <p className="text-sm text-muted">Back to the last lantern.</p>
                </div>
              ) : (
                <span />
              )}
            </div>
          ) : null}

          {mode === "pause" || mode === "clear" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/55 p-4">
              <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-lg">
                {mode === "pause" ? (
                  <>
                    <h2 className="font-display text-3xl">Paused</h2>
                    <p className="mt-1 text-sm text-muted">{level.name}</p>
                    <div className="mt-4 flex flex-col gap-2">
                      <Primary
                        onClick={() => {
                          modeRef.current = "play";
                          setMode("play");
                        }}
                      >
                        <Play className="size-4" /> Resume
                      </Primary>
                      <Ghost onClick={() => begin(levelIndex, "play")}>Restart level</Ghost>
                      <Ghost onClick={() => begin(0, "title")}>Level select</Ghost>
                      <Ghost onClick={toggleShake}>{save.shake ? "Screen shake on" : "Screen shake off"}</Ghost>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs tracking-[0.18em] text-teal uppercase">
                      {lastLevel ? "Beacon lit" : "Cliff cleared"}
                    </p>
                    <h2 className="mt-1 font-display text-3xl">{lastLevel ? "The beacon holds" : level.name}</h2>
                    <p className="mt-2 text-sm text-muted">
                      {perfect ? "Every ember collected." : `${coins} of ${total} embers.`}
                      {save.best[levelIndex] ? ` Best ${save.best[levelIndex]}.` : ""}
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                      {lastLevel ? null : (
                        <Primary onClick={() => begin(levelIndex + 1, "play")}>Next cliff</Primary>
                      )}
                      <Ghost onClick={() => begin(levelIndex, "play")}>Run it again</Ghost>
                      <Ghost onClick={() => begin(0, "title")}>Level select</Ghost>
                    </div>
                  </>
                )}
                <p className="mt-4 text-xs leading-relaxed text-muted">
                  A D or arrows move. Space, W, or Up jumps. Jump again to double-jump. Down plus jump drops
                  through a thin ledge. R restarts. Esc pauses.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {mode === "title" ? (
        <div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-10 sm:px-8">
          <div className="grid gap-3 sm:grid-cols-3">
            {LEVELS.map((entry, index) => (
              <article key={entry.id} className="flex flex-col rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between text-xs tracking-[0.16em] text-muted uppercase">
                  <span>0{index + 1}</span>
                  {save.cleared[index] ? (
                    <span className="inline-flex items-center gap-1 text-teal">
                      <Flag className="size-3.5" aria-hidden="true" /> Lit
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-2 font-display text-2xl">{entry.name}</h2>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">{entry.blurb}</p>
                <p className="mt-3 text-sm text-gold">
                  Best {save.best[index] ?? 0}/{entry.coins.length}
                </p>
                <button
                  type="button"
                  className="mt-3 inline-flex h-12 items-center justify-center rounded-xl bg-ember px-4 text-sm font-medium text-ink"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    begin(index, "play");
                  }}
                >
                  Play
                </button>
              </article>
            ))}
          </div>
          <ul className="mt-6 grid gap-2 text-sm text-muted sm:grid-cols-2">
            <li>Move with A and D, or the arrow keys.</li>
            <li>Jump with Space, W, or Up. Jump again in the air.</li>
            <li>Short taps hop. Hold the jump to go higher.</li>
            <li>Down plus jump drops through a thin ledge. R restarts.</li>
          </ul>
        </div>
      ) : null}

      {mode !== "title" && touch ? (
        <div className="flex items-end justify-between gap-3 px-3 pt-1 pb-4">
          <div className="flex gap-2">
            <button type="button" className="touch-btn rounded-2xl border border-border bg-surface px-4 text-fg" {...hold("KeyA")}>
              Left
            </button>
            <button type="button" className="touch-btn rounded-2xl border border-border bg-surface px-4 text-fg" {...hold("KeyD")}>
              Right
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" className="touch-btn rounded-2xl border border-border bg-surface px-3 text-sm text-fg" {...hold("KeyS")}>
              Drop
            </button>
            <button type="button" className="touch-btn rounded-2xl bg-ember px-5 font-medium text-ink" {...hold("Space")}>
              Jump
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-ink/80 text-fg"
    >
      {children}
    </button>
  );
}

function Primary({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ember px-4 text-sm font-medium text-ink"
    >
      {children}
    </button>
  );
}

function Ghost({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-ink px-4 text-sm text-fg"
    >
      {children}
    </button>
  );
}
