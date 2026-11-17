// Los 5 niveles de BLOQUE BUSTER, portados literalmente de started-games/04-arkanoid/levels.js.

export type BlockColor = "gray" | "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green";

export interface LevelDef {
  /** Multiplicador de la velocidad de la pelota. */
  speed: number;
  blocks: readonly { col: number; row: number; color: BlockColor }[];
}

type BlockDef = LevelDef["blocks"][number];

function buildLevels(): readonly LevelDef[] {
  const rowColors1: BlockColor[] = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
  const rowColors2: BlockColor[] = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
  const rowColors4: BlockColor[] = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];

  // 1 — Parrilla completa 10×6
  const l1: BlockDef[] = [];
  for (let row = 0; row < 6; row++) for (let col = 0; col < 10; col++) l1.push({ col, row, color: rowColors1[row] });

  // 2 — Pirámide centrada
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  const l2: BlockDef[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++) l2.push({ col, row, color: rowColors2[row] });

  // 3 — Tablero de ajedrez
  const l3: BlockDef[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0) l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  // 4 — Filas con huecos
  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: BlockDef[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) if (!gaps4[row].includes(col)) l4.push({ col, row, color: rowColors4[row] });

  // 5 — Marco + cruz central
  const l5: BlockDef[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross) l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
}

export const LEVELS: readonly LevelDef[] = buildLevels();
