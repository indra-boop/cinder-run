import {
  ACC_A,
  ACC_G,
  APEX,
  BUFFER,
  COYOTE,
  DJUMP,
  FRIC,
  G_APEX,
  G_DOWN,
  G_UP,
  JUMP,
  MAX_FALL,
  PH,
  PW,
  RUN,
  VIEW_H,
  VIEW_W,
} from "./constants";
import { LEVELS, type Level, type Rect, type SurfacePoint } from "./levels";

export type Input = { left: boolean; right: boolean; jump: boolean; down: boolean };

export const EMPTY_INPUT: Input = { left: false, right: false, jump: false, down: false };

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grav: number;
};

export type Floater = { x: number; y: number; text: string; life: number; max: number };

type Support = { y: number; riding: number; oneway: boolean };

export type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  coyote: number;
  buffer: number;
  extra: number;
  cut: boolean;
  riding: number;
  oneway: boolean;
  drop: number;
  invuln: number;
  anim: number;
  jumpAge: number;
  land: number;
  dead: number;
  flash: number;
};

export type World = {
  levelIndex: number;
  time: number;
  player: Player;
  coins: boolean[];
  coinCount: number;
  cp: number;
  movers: Rect[];
  jumpPrev: boolean;
  particles: Particle[];
  floaters: Floater[];
  trauma: number;
  camX: number;
  camY: number;
  won: boolean;
  events: string[];
  fallSpeed: number;
};

function particle(): Particle {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: "#f0c14a", grav: 0 };
}

export function levelOf(w: World): Level {
  return LEVELS[w.levelIndex]!;
}

export function moverAt(m: Level["movers"][number], time: number): Rect {
  const s = Math.sin((time / m.period) * Math.PI * 2 + (m.phase ?? 0));
  return {
    x: m.x + (m.axis === "x" ? s * m.amp : 0),
    y: m.y + (m.axis === "y" ? s * m.amp : 0),
    w: m.w,
    h: m.h,
  };
}

function place(p: Player, spot: SurfacePoint) {
  p.x = spot.x;
  p.y = spot.surface - PH;
  p.vx = 0;
  p.vy = 0;
  p.grounded = true;
  p.coyote = COYOTE;
  p.buffer = 0;
  p.extra = 1;
  p.cut = false;
  p.riding = -1;
  p.oneway = false;
  p.drop = 0;
  p.jumpAge = 10;
  p.land = 0;
  p.dead = 0;
  p.flash = 0;
}

export function createWorld(levelIndex: number): World {
  const level = LEVELS[levelIndex]!;
  const player: Player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: true,
    coyote: COYOTE,
    buffer: 0,
    extra: 1,
    cut: false,
    riding: -1,
    oneway: false,
    drop: 0,
    invuln: 0,
    anim: 0,
    jumpAge: 10,
    land: 0,
    dead: 0,
    flash: 0,
  };
  place(player, level.spawn);
  const w: World = {
    levelIndex,
    time: 0,
    player,
    coins: level.coins.map(() => false),
    coinCount: 0,
    cp: -1,
    movers: level.movers.map((m) => moverAt(m, 0)),
    jumpPrev: false,
    particles: Array.from({ length: 96 }, particle),
    floaters: [],
    trauma: 0,
    camX: 0,
    camY: 0,
    won: false,
    events: [],
    fallSpeed: 0,
  };
  focusCamera(w, true);
  for (let i = 0; i < 18; i++) {
    burst(w, {
      x: Math.random() * level.width,
      y: Math.random() * level.height,
      vx: (Math.random() - 0.5) * 8,
      vy: -12 - Math.random() * 18,
      life: 2 + Math.random() * 4,
      max: 6,
      size: 1.5 + Math.random() * 2,
      color: Math.random() > 0.5 ? "#e07a3a" : "#f0c14a",
      grav: -4,
    });
  }
  return w;
}

function burst(w: World, spec: Particle) {
  const slot = w.particles.find((p) => p.life <= 0);
  if (!slot) return;
  slot.x = spec.x;
  slot.y = spec.y;
  slot.vx = spec.vx;
  slot.vy = spec.vy;
  slot.life = spec.life;
  slot.max = spec.max;
  slot.size = spec.size;
  slot.color = spec.color;
  slot.grav = spec.grav;
}

function spray(w: World, x: number, y: number, color: string, n: number, speed: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random());
    burst(w, {
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 20,
      life: 0.35 + Math.random() * 0.35,
      max: 0.7,
      size: 2 + Math.random() * 2.5,
      color,
      grav: 420,
    });
  }
}

function overlap(ax: number, ay: number, aw: number, ah: number, b: Rect) {
  return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
}

function supportUnder(w: World): Support | null {
  const p = w.player;
  const level = levelOf(w);
  const feet = p.y + PH;
  const x0 = p.x + 5;
  const x1 = p.x + PW - 5;
  let best: Support | null = null;
  const consider = (r: Rect, riding: number, oneway: boolean) => {
    if (oneway && p.drop > 0) return;
    if (feet > r.y + 8) return;
    if (feet < r.y - 1) return;
    if (x1 <= r.x || x0 >= r.x + r.w) return;
    if (!best || r.y < best.y) best = { y: r.y, riding, oneway };
  };
  if (p.vy >= 0) {
    for (const r of level.solids) consider(r, -1, false);
    w.movers.forEach((r, i) => consider(r, i, false));
    for (const r of level.oneways) consider(r, -1, true);
  }
  return best;
}

function resolveX(w: World) {
  const p = w.player;
  const level = levelOf(w);
  const blocks: { r: Rect; skip: boolean }[] = [];
  for (const r of level.solids) blocks.push({ r, skip: false });
  w.movers.forEach((r, i) => blocks.push({ r, skip: p.riding === i && p.grounded }));
  for (const b of blocks) {
    if (b.skip) continue;
    if (!overlap(p.x, p.y, PW, PH, b.r)) continue;
    if (p.vx > 0) p.x = b.r.x - PW;
    else if (p.vx < 0) p.x = b.r.x + b.r.w;
    else {
      const pushLeft = p.x + PW - b.r.x;
      const pushRight = b.r.x + b.r.w - p.x;
      p.x = pushLeft < pushRight ? b.r.x - PW : b.r.x + b.r.w;
    }
    p.vx = 0;
  }
  if (p.x < 0) {
    p.x = 0;
    p.vx = 0;
  }
  const maxX = levelOf(w).width - PW;
  if (p.x > maxX) {
    p.x = maxX;
    p.vx = 0;
  }
}

function resolveY(w: World, prevBottom: number) {
  const p = w.player;
  const level = levelOf(w);
  const prevTop = prevBottom - PH;
  const solids: { r: Rect; riding: number }[] = level.solids.map((r) => ({ r, riding: -1 }));
  w.movers.forEach((r, i) => solids.push({ r, riding: i }));

  for (const { r, riding } of solids) {
    if (!overlap(p.x, p.y, PW, PH, r)) continue;
    if (p.vy >= 0 && prevBottom <= r.y + 2) {
      p.y = r.y - PH;
      p.vy = 0;
      p.grounded = true;
      p.riding = riding;
      p.oneway = false;
    } else if (p.vy < 0 && prevTop >= r.y + r.h - 2) {
      p.y = r.y + r.h;
      p.vy = 0;
    } else if (prevBottom <= r.y + r.h * 0.5 && p.vy >= 0) {
      p.y = r.y - PH;
      p.vy = 0;
      p.grounded = true;
      p.riding = riding;
      p.oneway = false;
    } else if (p.vy < 0) {
      p.y = r.y + r.h;
      p.vy = 0;
    }
  }

  if (p.drop <= 0 && p.vy >= 0) {
    for (const r of level.oneways) {
      if (prevBottom > r.y + 1) continue;
      if (!overlap(p.x, p.y, PW, PH, r)) continue;
      p.y = r.y - PH;
      p.vy = 0;
      p.grounded = true;
      p.riding = -1;
      p.oneway = true;
    }
  }
}

function tryJump(w: World) {
  const p = w.player;
  if (p.buffer <= 0 || p.dead > 0 || w.won) return;
  if (p.grounded || p.coyote > 0) {
    p.vy = -JUMP;
    p.grounded = false;
    p.coyote = 0;
    p.buffer = 0;
    p.cut = false;
    p.extra = 1;
    p.riding = -1;
    p.oneway = false;
    p.jumpAge = 0;
    w.fallSpeed = 0;
    w.events.push("jump");
    spray(w, p.x + PW / 2, p.y + PH, "#f6efe6", 5, 50);
    return;
  }
  if (p.extra > 0) {
    p.vy = -DJUMP;
    p.extra = 0;
    p.buffer = 0;
    p.cut = false;
    p.riding = -1;
    p.jumpAge = 0;
    w.fallSpeed = 0;
    w.events.push("djump");
    spray(w, p.x + PW / 2, p.y + PH / 2, "#3ec8b0", 8, 90);
  }
}

function die(w: World) {
  const p = w.player;
  if (p.dead > 0 || p.invuln > 0 || w.won) return;
  p.dead = 0.9;
  p.flash = 0.2;
  p.vx = 0;
  p.vy = 0;
  w.trauma = Math.min(1, w.trauma + 0.72);
  w.events.push("hurt");
  spray(w, p.x + PW / 2, p.y + PH / 2, "#e07a3a", 16, 160);
}

function respawn(w: World) {
  const level = levelOf(w);
  const spot = w.cp >= 0 ? level.checkpoints[w.cp]! : level.spawn;
  place(w.player, spot);
  w.player.invuln = 0.85;
  w.player.facing = 1;
}

function focusCamera(w: World, snap: boolean) {
  const p = w.player;
  const level = levelOf(w);
  const look = p.facing * 90 + p.vx * 0.12;
  const focusX = p.x + PW / 2 + look;
  const focusY = p.y + PH * 0.42;
  let desiredX = focusX - VIEW_W * 0.42;
  let desiredY = focusY - VIEW_H * 0.5;
  if (!snap) {
    const cx = w.camX + VIEW_W * 0.42;
    const cy = w.camY + VIEW_H * 0.5;
    if (Math.abs(focusX - cx) < 28) desiredX = w.camX;
    if (Math.abs(focusY - cy) < 40) desiredY = w.camY;
  }
  const maxX = Math.max(0, level.width - VIEW_W);
  const maxY = Math.max(0, level.height - VIEW_H);
  desiredX = Math.max(0, Math.min(maxX, desiredX));
  desiredY = Math.max(0, Math.min(maxY, desiredY));
  if (snap) {
    w.camX = desiredX;
    w.camY = desiredY;
  } else {
    w.camX = desiredX;
    w.camY = desiredY;
  }
}

function updatePresentation(w: World, dt: number) {
  const p = w.player;
  p.anim += dt;
  if (p.land > 0) p.land = Math.max(0, p.land - dt);
  if (p.flash > 0) p.flash = Math.max(0, p.flash - dt);
  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
  w.trauma = Math.max(0, w.trauma - dt * 1.7);
  for (const part of w.particles) {
    if (part.life <= 0) continue;
    part.life -= dt;
    part.vy += part.grav * dt;
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    if (part.grav < 0 && part.y < -20) {
      part.y = levelOf(w).height + 10;
    }
  }
  for (let i = w.floaters.length - 1; i >= 0; i--) {
    const f = w.floaters[i]!;
    f.life -= dt;
    f.y -= 28 * dt;
    if (f.life <= 0) w.floaters.splice(i, 1);
  }
}

export function step(w: World, input: Input, dt: number, live: boolean) {
  dt = Math.min(dt, 0.05);
  w.time += dt;
  const level = levelOf(w);
  const p = w.player;

  const prevMovers = w.movers.map((r) => ({ ...r }));
  w.movers = level.movers.map((m) => moverAt(m, w.time));
  if (p.riding >= 0 && p.dead <= 0 && !w.won) {
    const next = w.movers[p.riding];
    const prev = prevMovers[p.riding];
    if (next && prev) {
      p.x += next.x - prev.x;
      p.y += next.y - prev.y;
    }
  }

  if (w.won) {
    updatePresentation(w, dt);
    smoothCamera(w, dt);
    return;
  }

  if (p.dead > 0) {
    p.dead -= dt;
    updatePresentation(w, dt);
    if (p.dead <= 0) respawn(w);
    smoothCamera(w, dt);
    return;
  }

  const use = live ? input : EMPTY_INPUT;
  let dir = 0;
  if (use.left) dir -= 1;
  if (use.right) dir += 1;
  const accel = p.grounded ? ACC_G : ACC_A;
  if (dir !== 0) {
    p.vx += dir * accel * dt;
    p.facing = dir < 0 ? -1 : 1;
  } else if (p.grounded) {
    const f = FRIC * dt;
    if (Math.abs(p.vx) <= f) p.vx = 0;
    else p.vx -= Math.sign(p.vx) * f;
  } else {
    p.vx *= Math.max(0, 1 - 0.35 * dt);
  }
  if (p.vx > RUN) p.vx = RUN;
  if (p.vx < -RUN) p.vx = -RUN;

  const pressed = use.jump && !w.jumpPrev;
  w.jumpPrev = use.jump;
  if (pressed) p.buffer = BUFFER;
  else p.buffer = Math.max(0, p.buffer - dt);

  if (p.grounded) {
    p.coyote = COYOTE;
    p.extra = 1;
    p.vy = 0;
  } else {
    p.coyote = Math.max(0, p.coyote - dt);
    let g = p.vy < 0 ? G_UP : G_DOWN;
    if (Math.abs(p.vy) < APEX) g = G_APEX;
    p.vy = Math.min(MAX_FALL, p.vy + g * dt);
  }

  if (!use.jump && p.vy < 0 && !p.cut) {
    p.vy *= 0.48;
    p.cut = true;
  }

  if (pressed && use.down && p.grounded && p.oneway) {
    p.drop = 0.2;
    p.grounded = false;
    p.oneway = false;
    p.vy = 60;
    p.buffer = 0;
    p.coyote = 0;
  } else {
    tryJump(w);
  }
  p.drop = Math.max(0, p.drop - dt);

  const wasGrounded = p.grounded;
  const speed = Math.max(Math.abs(p.vx), Math.abs(p.vy));
  const steps = Math.max(1, Math.ceil((speed * dt) / 7));
  const sdt = dt / steps;
  for (let i = 0; i < steps; i++) {
    p.x += p.vx * sdt;
    resolveX(w);
    const prevBottom = p.y + PH;
    p.y += p.vy * sdt;
    p.grounded = false;
    resolveY(w, prevBottom);
  }

  if (p.vy >= 0) {
    const support = supportUnder(w);
    if (support) {
      p.y = support.y - PH;
      p.vy = 0;
      p.grounded = true;
      p.riding = support.riding;
      p.oneway = support.oneway;
    } else if (!p.grounded) {
      p.riding = -1;
      p.oneway = false;
    }
  } else {
    p.riding = -1;
    p.oneway = false;
  }

  if (!wasGrounded && p.grounded) {
    p.land = 0.14;
    if (w.fallSpeed > 280) {
      w.events.push("land");
      w.trauma = Math.min(1, w.trauma + Math.min(0.25, w.fallSpeed / 4000));
      spray(w, p.x + PW / 2, p.y + PH, "#c4a48a", 6, 70);
    }
  }
  w.fallSpeed = p.grounded ? 0 : Math.max(w.fallSpeed, p.vy);
  p.jumpAge += dt;

  if (live && p.invuln <= 0) {
    for (const s of level.spikes) {
      if (overlap(p.x + 2, p.y + 4, PW - 4, PH - 4, s)) {
        die(w);
        break;
      }
    }
    if (p.y > level.killY) die(w);
  }

  if (live && p.dead <= 0) {
    const pcx = p.x + PW / 2;
    const pcy = p.y + PH / 2;
    level.coins.forEach((c, i) => {
      if (w.coins[i]) return;
      if (Math.abs(pcx - c.x) < 22 && Math.abs(pcy - c.y) < 24) {
        w.coins[i] = true;
        w.coinCount += 1;
        w.events.push("coin");
        w.floaters.push({ x: c.x, y: c.y, text: "+1", life: 0.7, max: 0.7 });
        spray(w, c.x, c.y, "#f0c14a", 8, 100);
      }
    });
    level.checkpoints.forEach((c, i) => {
      if (i <= w.cp) return;
      if (Math.abs(pcx - c.x) < 28 && p.y + PH > c.surface - 70 && p.y < c.surface) {
        w.cp = i;
        w.events.push("check");
        w.trauma = Math.min(1, w.trauma + 0.15);
        spray(w, c.x, c.surface - 40, "#3ec8b0", 10, 80);
      }
    });
    const flag = level.flag;
    if (
      Math.abs(pcx - (flag.x + 8)) < 28 &&
      p.y + PH > flag.surface - 96 &&
      p.y < flag.surface
    ) {
      w.won = true;
      p.vx = 0;
      p.vy = 0;
      w.events.push("win");
      w.trauma = Math.min(1, w.trauma + 0.35);
      spray(w, flag.x, flag.surface - 70, "#3ec8b0", 18, 140);
      spray(w, flag.x, flag.surface - 40, "#f0c14a", 14, 120);
    }
  }

  if (p.grounded && Math.abs(p.vx) > 80 && live) {
    if (Math.floor(w.time * 12) !== Math.floor((w.time - dt) * 12)) {
      burst(w, {
        x: p.x + PW / 2,
        y: p.y + PH,
        vx: -p.facing * 20,
        vy: -10,
        life: 0.25,
        max: 0.25,
        size: 2,
        color: "#b08968",
        grav: 80,
      });
    }
  }

  updatePresentation(w, dt);
  smoothCamera(w, dt);
}

function smoothCamera(w: World, dt: number) {
  const p = w.player;
  const level = levelOf(w);
  const look = p.facing * 96 + p.vx * 0.15;
  const focusX = p.x + PW / 2 + look;
  const focusY = p.y + PH * 0.4;
  let desiredX = focusX - VIEW_W * 0.4;
  let desiredY = focusY - VIEW_H * 0.48;
  const cx = w.camX + VIEW_W * 0.4;
  const cy = w.camY + VIEW_H * 0.48;
  if (Math.abs(focusX - cx) < 34) desiredX = w.camX;
  if (Math.abs(focusY - cy) < 46) desiredY = w.camY;
  const maxX = Math.max(0, level.width - VIEW_W);
  const maxY = Math.max(0, level.height - VIEW_H);
  desiredX = Math.max(0, Math.min(maxX, desiredX));
  desiredY = Math.max(0, Math.min(maxY, desiredY));
  const k = 1 - Math.exp(-5.5 * dt);
  w.camX += (desiredX - w.camX) * k;
  w.camY += (desiredY - w.camY) * k;
}
