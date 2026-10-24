import { PH, PW, RUN, VIEW_H, VIEW_W } from "./constants";
import type { Level, Rect } from "./levels";
import { levelOf, type Player, type World } from "./sim";

export type Art = {
  idle: HTMLImageElement[];
  run: HTMLImageElement[];
  jump: HTMLImageElement[];
  coin: HTMLImageElement[];
  flag: HTMLImageElement[];
  spike: HTMLImageElement;
  lantern: HTMLImageElement;
  ledgeL: HTMLImageElement;
  ledgeM: HTMLImageElement;
  ledgeR: HTMLImageElement;
  bg: HTMLImageElement;
};

function image(src: string) {
  const el = new Image();
  el.crossOrigin = "anonymous";
  el.src = src;
  return el;
}

function frames(name: string, count: number) {
  return Array.from({ length: count }, (_, i) => image(`/game/${name}-${i}.png`));
}

export function loadArt(): Art {
  return {
    idle: frames("idle", 4),
    run: frames("run", 4),
    jump: frames("jump", 4),
    coin: frames("coin", 4),
    flag: frames("flag", 4),
    spike: image("/game/spike.png"),
    lantern: image("/game/lantern.png"),
    ledgeL: image("/game/ledge-left.png"),
    ledgeM: image("/game/ledge-mid.png"),
    ledgeR: image("/game/ledge-right.png"),
    bg: image("/game/bg.jpg"),
  };
}

function ok(img: HTMLImageElement | undefined) {
  return !!img && img.complete && img.naturalWidth > 0;
}

function heroFrame(art: Art, p: Player) {
  if (!p.grounded) {
    if (p.jumpAge < 0.07) return art.jump[0];
    if (p.vy < -140) return art.jump[1];
    if (p.vy < 60) return art.jump[2];
    return art.jump[3];
  }
  if (Math.abs(p.vx) > 24) {
    const speed = Math.min(1, Math.abs(p.vx) / RUN);
    const step = 0.12 - speed * 0.05;
    return art.run[Math.floor(p.anim / step) % 4];
  }
  return art.idle[Math.floor(p.anim / 0.18) % 4];
}

export function render(ctx: CanvasRenderingContext2D, w: World, art: Art, shake: boolean) {
  const level = levelOf(w);
  const mag = shake ? w.trauma * w.trauma : 0;
  const sx = Math.sin(w.time * 47) * 12 * mag + Math.sin(w.time * 23) * 5 * mag;
  const sy = Math.cos(w.time * 39) * 8 * mag;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(sx, sy);
  drawSky(ctx, w, art);
  const camX = Math.round(w.camX);
  const camY = Math.round(w.camY);
  for (const r of level.solids) drawStone(ctx, r, camX, camY, art, false, w.time);
  for (const r of level.oneways) drawStone(ctx, r, camX, camY, art, false, w.time);
  for (const r of w.movers) drawStone(ctx, r, camX, camY, art, true, w.time);
  for (const s of level.spikes) drawSpike(ctx, s, camX, camY, art);
  level.checkpoints.forEach((c, i) => drawLantern(ctx, c.x, c.surface, camX, camY, art, i <= w.cp, w.time));
  level.coins.forEach((c, i) => {
    if (w.coins[i]) return;
    drawCoin(ctx, c.x, c.y + Math.sin(w.time * 3 + i) * 4, camX, camY, art, w.time);
  });
  drawFlag(ctx, level, camX, camY, art, w.time, w.won);
  drawPlayer(ctx, w, camX, camY, art);
  drawParticles(ctx, w, camX, camY);
  ctx.restore();
  vignette(ctx);
  if (w.player.dead > 0.35) {
    ctx.fillStyle = `rgba(180, 40, 30, ${Math.min(0.35, (w.player.dead - 0.35) * 0.8)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawSky(ctx: CanvasRenderingContext2D, w: World, art: Art) {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, "#241422");
  sky.addColorStop(0.45, "#6a3a38");
  sky.addColorStop(1, "#1a1218");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (ok(art.bg)) {
    const parallax = w.camX * 0.22 + w.camY * 0.05;
    const dh = VIEW_H * 1.15;
    const dw = dh * (art.bg.naturalWidth / art.bg.naturalHeight);
    const y = -VIEW_H * 0.06 - w.camY * 0.04;
    const start = -((parallax % dw) + dw) % dw;
    for (let x = start; x < VIEW_W; x += dw) {
      ctx.drawImage(art.bg, x, y, dw, dh);
    }
  }
  const fade = ctx.createLinearGradient(0, VIEW_H * 0.35, 0, VIEW_H);
  fade.addColorStop(0, "rgba(26,18,24,0)");
  fade.addColorStop(0.7, "rgba(26,18,24,0.35)");
  fade.addColorStop(1, "rgba(26,18,24,0.82)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawStone(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  camX: number,
  camY: number,
  art: Art,
  moving: boolean,
  time: number,
) {
  const x = Math.round(r.x - camX);
  const y = Math.round(r.y - camY);
  if (x > VIEW_W + 80 || x + r.w < -80 || y > VIEW_H + 80 || y + r.h < -120) return;
  if (r.h > 64) {
    ctx.fillStyle = "#2c1a16";
    ctx.fillRect(x, y + 30, r.w, r.h - 30);
    const shade = ctx.createLinearGradient(x, y + 30, x, y + r.h);
    shade.addColorStop(0, "rgba(90, 48, 32, 0.55)");
    shade.addColorStop(1, "rgba(18, 10, 12, 0.9)");
    ctx.fillStyle = shade;
    ctx.fillRect(x, y + 30, r.w, r.h - 30);
  }
  const artH = r.h > 64 ? 52 : Math.max(34, r.h + 16);
  blitLedge(ctx, art, x, y, r.w, artH);
  if (moving) {
    ctx.strokeStyle = `rgba(240, 193, 74, ${0.4 + Math.sin(time * 5) * 0.25})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1.5, y + 1.5, r.w - 3, Math.min(r.h, artH) - 3);
  }
}

function blitLedge(ctx: CanvasRenderingContext2D, art: Art, x: number, y: number, w: number, h: number) {
  if (!ok(art.ledgeL) || !ok(art.ledgeM) || !ok(art.ledgeR)) {
    ctx.fillStyle = "#c46a3a";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#e7b089";
    ctx.fillRect(x, y, w, 4);
    return;
  }
  const ratio = art.ledgeL.naturalWidth / art.ledgeL.naturalHeight;
  const cap = Math.min(h * ratio, Math.max(18, w * 0.34));
  ctx.drawImage(art.ledgeL, x, y, cap, h);
  ctx.drawImage(art.ledgeR, x + w - cap, y, cap, h);
  const midW = w - cap * 2;
  if (midW > 1) ctx.drawImage(art.ledgeM, x + cap - 1, y, midW + 2, h);
}

function drawSpike(ctx: CanvasRenderingContext2D, r: Rect, camX: number, camY: number, art: Art) {
  const x = r.x - camX;
  const y = r.y - camY;
  if (!ok(art.spike)) {
    ctx.fillStyle = "#8c3a3a";
    ctx.fillRect(x, y, r.w, r.h);
    return;
  }
  const dh = r.h + 22;
  const dw = dh * (art.spike.naturalWidth / art.spike.naturalHeight);
  const inset = (13 / 256) * dh;
  ctx.drawImage(art.spike, x + r.w / 2 - dw / 2, y + r.h - dh + inset, dw, dh);
}

function drawLantern(
  ctx: CanvasRenderingContext2D,
  x: number,
  surface: number,
  camX: number,
  camY: number,
  art: Art,
  lit: boolean,
  time: number,
) {
  const fx = x - camX;
  const fy = surface - camY;
  if (lit) {
    const glow = ctx.createRadialGradient(fx, fy - 36, 4, fx, fy - 36, 54);
    glow.addColorStop(0, `rgba(240, 193, 74, ${0.28 + Math.sin(time * 4) * 0.06})`);
    glow.addColorStop(1, "rgba(240, 193, 74, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(fx, fy - 36, 54, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!ok(art.lantern)) return;
  ctx.save();
  if (!lit) ctx.filter = "brightness(0.42) saturate(0.35)";
  const dh = 86;
  const dw = dh;
  const inset = (13 / 256) * dh;
  ctx.drawImage(art.lantern, fx - dw / 2, fy - dh + inset, dw, dh);
  ctx.restore();
}

function drawCoin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  camX: number,
  camY: number,
  art: Art,
  time: number,
) {
  const frame = art.coin[Math.floor(time * 8) % 4];
  if (!ok(frame)) {
    ctx.fillStyle = "#f0c14a";
    ctx.beginPath();
    ctx.arc(x - camX, y - camY, 8, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const dh = 36;
  ctx.drawImage(frame!, x - camX - dh / 2, y - camY - dh / 2, dh, dh);
}

function drawFlag(
  ctx: CanvasRenderingContext2D,
  level: Level,
  camX: number,
  camY: number,
  art: Art,
  time: number,
  won: boolean,
) {
  const frame = art.flag[Math.floor(time * 6) % 4];
  const fx = level.flag.x - camX;
  const fy = level.flag.surface - camY;
  const glow = ctx.createRadialGradient(fx, fy - 70, 4, fx, fy - 60, won ? 80 : 48);
  glow.addColorStop(0, "rgba(62, 200, 176, 0.28)");
  glow.addColorStop(1, "rgba(62, 200, 176, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(fx + 6, fy - 64, won ? 80 : 48, 0, Math.PI * 2);
  ctx.fill();
  if (!ok(frame)) return;
  const dh = 128;
  const inset = (12 / 256) * dh;
  ctx.drawImage(frame!, fx - dh * 0.42, fy - dh + inset, dh, dh);
}

function drawPlayer(ctx: CanvasRenderingContext2D, w: World, camX: number, camY: number, art: Art) {
  const p = w.player;
  if (p.dead > 0.45) return;
  const footX = p.x + PW / 2 - camX;
  const footY = p.y + PH - camY;
  if (p.grounded) {
    ctx.fillStyle = "rgba(12, 6, 8, 0.35)";
    ctx.beginPath();
    ctx.ellipse(footX, footY + 1, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const frame = heroFrame(art, p);
  const k = p.land > 0 ? p.land / 0.14 : 0;
  let sy = 1 - 0.1 * k;
  let sx = 1 / sy;
  if (!p.grounded) {
    const stretch = Math.max(-0.4, Math.min(0.55, -p.vy / 1400));
    sy = 1 + stretch * 0.08;
    sx = 1 / sy;
  }
  const alpha = p.invuln > 0 && Math.floor(w.time * 16) % 2 === 0 ? 0.45 : 1;
  if (!ok(frame)) {
    ctx.fillStyle = "#e07a3a";
    ctx.fillRect(footX - 12, footY - PH, 24, PH);
    return;
  }
  const dh = 78;
  const dw = dh;
  const inset = (23 / 256) * dh;
  ctx.save();
  ctx.translate(footX, footY);
  ctx.scale(p.facing * sx, sy);
  if (p.flash > 0) ctx.filter = "brightness(2.6) saturate(0.4)";
  ctx.globalAlpha = alpha;
  ctx.drawImage(frame!, -dw / 2, -dh + inset, dw, dh);
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, w: World, camX: number, camY: number) {
  for (const part of w.particles) {
    if (part.life <= 0) continue;
    const a = Math.max(0, part.life / part.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = part.color;
    ctx.beginPath();
    ctx.arc(part.x - camX, part.y - camY, part.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = "700 16px Outfit, sans-serif";
  ctx.textAlign = "center";
  for (const f of w.floaters) {
    ctx.globalAlpha = Math.max(0, f.life / f.max);
    ctx.fillStyle = "#f0c14a";
    ctx.fillText(f.text, f.x - camX, f.y - camY);
  }
  ctx.globalAlpha = 1;
}

function vignette(ctx: CanvasRenderingContext2D) {
  const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
