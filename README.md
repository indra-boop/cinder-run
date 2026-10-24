# Cinder Run

Side-scrolling platformer. Carry the last lantern across three dusk cliffs. Jump a gap, then jump again in the air when the stone runs out. Light lanterns as checkpoints, collect every ember, and reach the flag.

## Play

| Action | Keys |
| --- | --- |
| Move | A D or arrow keys |
| Jump / double-jump | Space, W, or Up |
| Drop through a thin ledge | Down + jump |
| Restart level | R |
| Pause | Esc |

On a phone, use the on-screen buttons. Progress (best ember counts, cleared cliffs, mute, screen shake) stays in the browser.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (port 8080).

Stack: React 19, TanStack Start, Vite, canvas. Sprites live in `public/game/`. Simulation is in `src/game/`.
