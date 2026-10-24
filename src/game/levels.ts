export type Rect = { x: number; y: number; w: number; h: number };

export type MoverDef = Rect & {
  axis: "x" | "y";
  amp: number;
  period: number;
  phase?: number;
};

export type SurfacePoint = { x: number; surface: number };

export type Level = {
  id: string;
  name: string;
  blurb: string;
  width: number;
  height: number;
  killY: number;
  spawn: SurfacePoint;
  solids: Rect[];
  oneways: Rect[];
  movers: MoverDef[];
  coins: { x: number; y: number }[];
  spikes: Rect[];
  checkpoints: SurfacePoint[];
  flag: SurfacePoint;
};

export const LEVELS: Level[] = [
  {
    id: "first-lantern",
    name: "First Lantern",
    blurb: "Run, jump, and pocket the embers.",
    width: 3900,
    height: 720,
    killY: 680,
    spawn: { x: 72, surface: 460 },
    solids: [
      { x: 0, y: 460, w: 680, h: 260 },
      { x: 860, y: 460, w: 680, h: 260 },
      { x: 1680, y: 360, w: 240, h: 28 },
      { x: 2060, y: 460, w: 360, h: 260 },
      { x: 2720, y: 460, w: 1180, h: 260 },
    ],
    oneways: [],
    movers: [{ x: 2340, y: 460, w: 280, h: 26, axis: "x", amp: 190, period: 3.6 }],
    coins: [
      { x: 760, y: 370 },
      { x: 820, y: 320 },
      { x: 900, y: 400 },
      { x: 1120, y: 420 },
      { x: 1320, y: 420 },
      { x: 1780, y: 320 },
      { x: 2360, y: 400 },
      { x: 3180, y: 420 },
      { x: 3380, y: 340 },
      { x: 3560, y: 420 },
    ],
    spikes: [{ x: 2190, y: 428, w: 70, h: 32 }],
    checkpoints: [{ x: 2140, surface: 460 }],
    flag: { x: 3640, surface: 460 },
  },
  {
    id: "twin-leap",
    name: "Twin Leap",
    blurb: "The wide gap wants a second jump.",
    width: 4600,
    height: 980,
    killY: 940,
    spawn: { x: 70, surface: 760 },
    solids: [
      { x: 0, y: 760, w: 540, h: 220 },
      { x: 700, y: 760, w: 460, h: 220 },
      { x: 1410, y: 760, w: 560, h: 220 },
      { x: 2280, y: 500, w: 760, h: 40 },
      { x: 3520, y: 700, w: 1080, h: 280 },
    ],
    oneways: [{ x: 2680, y: 340, w: 180, h: 16 }],
    movers: [
      { x: 2060, y: 600, w: 150, h: 26, axis: "y", amp: 160, period: 3.6 },
      { x: 3180, y: 688, w: 180, h: 26, axis: "x", amp: 200, period: 3.6, phase: 0.4 },
    ],
    coins: [
      { x: 620, y: 680 },
      { x: 660, y: 610 },
      { x: 1260, y: 660 },
      { x: 1310, y: 540 },
      { x: 1360, y: 660 },
      { x: 2500, y: 460 },
      { x: 2760, y: 290 },
      { x: 2940, y: 460 },
      { x: 3860, y: 660 },
      { x: 4120, y: 600 },
    ],
    spikes: [
      { x: 2000, y: 880, w: 240, h: 32 },
      { x: 3140, y: 860, w: 280, h: 32 },
    ],
    checkpoints: [
      { x: 980, surface: 760 },
      { x: 2460, surface: 500 },
    ],
    flag: { x: 4280, surface: 700 },
  },
  {
    id: "beacon-climb",
    name: "Beacon Climb",
    blurb: "Ride the stone up and light the flag.",
    width: 3480,
    height: 1560,
    killY: 1480,
    spawn: { x: 80, surface: 1320 },
    solids: [
      { x: 0, y: 1320, w: 700, h: 240 },
      { x: 1000, y: 1000, w: 420, h: 36 },
      { x: 1860, y: 940, w: 340, h: 36 },
      { x: 2240, y: 772, w: 260, h: 36 },
      { x: 3120, y: 250, w: 280, h: 48 },
    ],
    oneways: [
      { x: 2580, y: 640, w: 160, h: 16 },
      { x: 2760, y: 510, w: 160, h: 16 },
      { x: 2940, y: 380, w: 170, h: 16 },
    ],
    movers: [
      { x: 780, y: 1170, w: 150, h: 26, axis: "y", amp: 150, period: 3.5 },
      { x: 1560, y: 960, w: 160, h: 26, axis: "x", amp: 120, period: 2.9 },
    ],
    coins: [
      { x: 280, y: 1280 },
      { x: 520, y: 1200 },
      { x: 860, y: 1100 },
      { x: 1160, y: 960 },
      { x: 1320, y: 960 },
      { x: 1640, y: 910 },
      { x: 1920, y: 900 },
      { x: 2340, y: 680 },
      { x: 2660, y: 590 },
      { x: 3220, y: 210 },
    ],
    spikes: [
      { x: 2020, y: 908, w: 72, h: 32 },
      { x: 1200, y: 1410, w: 1800, h: 28 },
    ],
    checkpoints: [
      { x: 1080, surface: 1000 },
      { x: 1900, surface: 940 },
    ],
    flag: { x: 3220, surface: 250 },
  },
];
