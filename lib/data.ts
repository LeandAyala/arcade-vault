// Datos mock compartidos — migrados desde references/resources/templates/data.jsx

export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type CategoryFilter = "TODOS" | Category;
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string; // slug usado en la URL: "bloque-buster"
  title: string; // "BLOQUE BUSTER"
  short: string; // descripción corta de la tarjeta
  long: string; // descripción larga del detalle
  cat: Category;
  cover: string; // clase CSS de portada: "cover-bricks"
  color: GameColor; // color del botón JUGAR
  best: number; // mejor puntuación global
  plays: string; // "12.4K"
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // "dd/mm/2026"
}

export const GAMES: Game[] = [
  {
    id: "bloque-buster",
    title: "BLOQUE BUSTER",
    short: "Rebota la pelota y destruye muros de neón.",
    long: "Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?",
    cat: "ARCADE",
    cover: "cover-bricks",
    color: "cyan",
    best: 28450,
    plays: "12.4K",
  },
  {
    id: "caida",
    title: "CAÍDA",
    short: "Encaja las piezas antes de que el techo te aplaste.",
    long: "Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.",
    cat: "PUZZLE",
    cover: "cover-tetro",
    color: "magenta",
    best: 184220,
    plays: "31.8K",
  },
  {
    id: "serpentina",
    title: "SERPENTINA",
    short: "Crece sin morder tu propia cola.",
    long: "Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.",
    cat: "ARCADE",
    cover: "cover-snake",
    color: "green",
    best: 7820,
    plays: "9.1K",
  },
  {
    id: "gloton",
    title: "GLOTÓN",
    short: "Devora puntos y escapa de los fantasmas.",
    long: "Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.",
    cat: "ARCADE",
    cover: "cover-glot",
    color: "yellow",
    best: 96400,
    plays: "27.2K",
  },
  {
    id: "invasores",
    title: "INVASORES",
    short: "Defiende el planeta de filas alienígenas.",
    long: "Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.",
    cat: "SHOOTER",
    cover: "cover-invaders",
    color: "green",
    best: 54190,
    plays: "18.0K",
  },
  {
    id: "asteroides",
    title: "ASTEROIDES",
    short: "Pulveriza asteroides en gravedad cero.",
    long: "Tu nave triangular flota en vacío absoluto. Rota, propulsa y dispara para partir los asteroides en fragmentos cada vez más pequeños. Atrapa el núcleo 3x para disparar en abanico y sobrevive oleada tras oleada.",
    cat: "SHOOTER",
    cover: "cover-rocas",
    color: "yellow",
    best: 41200,
    plays: "15.6K",
  },
  {
    id: "ranaria",
    title: "RANARIA",
    short: "Cruza la autopista de pixeles.",
    long: "Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.",
    cat: "ARCADE",
    cover: "cover-rana",
    color: "green",
    best: 18900,
    plays: "6.4K",
  },
  {
    id: "duelo-pixel",
    title: "DUELO PIXEL",
    short: "Dos paletas. Una pelota. Reflejos máximos.",
    long: "El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.",
    cat: "VERSUS",
    cover: "cover-duelo",
    color: "cyan",
    best: 24,
    plays: "4.2K",
  },
];

export const CATS: CategoryFilter[] = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];

const PLAYERS = [
  "PX_KAI", "NEONFOX", "Z3R0COOL", "M00NRYU", "VAULT_07", "GLITCHA",
  "ATARI_KID", "CYBER_LU", "MAGENTA88", "SCANLINE", "BIT_LORD", "ARKADYA",
  "DROID_X", "RGB_QUEEN", "PIXEL_DAD", "RETROVIRA", "VECTORX", "JOY_STK",
];

/** Genera filas de puntuación deterministas: mismo seed → mismas filas. */
export function seededScores(seed: number, count = 12): ScoreRow[] {
  let s = seed;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const used = new Set<string>();
  const rows: ScoreRow[] = [];
  for (let i = 0; i < count; i++) {
    let name: string;
    do {
      name = PLAYERS[Math.floor(rand() * PLAYERS.length)];
    } while (used.has(name) && used.size < PLAYERS.length);
    used.add(name);
    const base = Math.floor(50000 + rand() * 250000);
    const score = base - i * Math.floor(2000 + rand() * 4000);
    const day = String(1 + Math.floor(rand() * 28)).padStart(2, "0");
    const mon = String(1 + Math.floor(rand() * 12)).padStart(2, "0");
    rows.push({ rank: i + 1, name, score: Math.max(score, 1000), date: `${day}/${mon}/2026` });
  }
  return rows.sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, rank: i + 1 }));
}

export function getGame(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}

// ===== Home (landing) — mocks de references/resources/templates/home-about/home.jsx =====

export type FeatureIcon = "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";

export interface HomeFeature {
  icon: FeatureIcon;
  title: string;
  desc: string;
  color: GameColor;
}

export interface HomeStat {
  value: string;
  unit: string;
  sub: string;
}

export interface RecentScore {
  player: string;
  game: string; // texto libre, como en el template
  score: number;
  ago: string;
  color: GameColor;
}

export interface TopPlayer {
  rank: number;
  player: string;
  score: number;
}

export interface FaqItem {
  q: string;
  a: string;
}

export const HOME_FEATURES: HomeFeature[] = [
  { icon: "GAMEPAD", title: "JUEGOS CLÁSICOS", desc: "Arkanoid, Tetris, Snake y muchos más. Los mejores arcades de todos los tiempos en un solo lugar.", color: "cyan" },
  { icon: "FREE", title: "100% GRATIS", desc: "Sin suscripciones, sin pagos ocultos. Todos los juegos disponibles de forma gratuita.", color: "yellow" },
  { icon: "TROPHY", title: "LADDER BOARDS", desc: "Compite con jugadores de todo el mundo. Escala el ranking y demuestra quién es el mejor.", color: "magenta" },
  { icon: "ROCKET", title: "SIEMPRE CRECIENDO", desc: "Agregamos nuevos juegos constantemente. Vuelve seguido, siempre habrá algo nuevo que jugar.", color: "green" },
];

export const HOME_STATS: HomeStat[] = [
  { value: "12+", unit: "JUEGOS", sub: "Y CONTANDO" },
  { value: "MILES", unit: "DE PARTIDAS", sub: "JUGADAS CADA DÍA" },
  { value: "GLOBAL", unit: "RANKING", sub: "COMPITE CON EL MUNDO" },
];

export const RECENT_SCORES: RecentScore[] = [
  { player: "NEONFOX", game: "Caída", score: 184220, ago: "hace 2 min", color: "magenta" },
  { player: "PX_KAI", game: "Glotón", score: 96400, ago: "hace 5 min", color: "yellow" },
  { player: "Z3R0COOL", game: "Invasores", score: 54190, ago: "hace 8 min", color: "green" },
  { player: "VAULT_07", game: "Asteroides", score: 41200, ago: "hace 12 min", color: "cyan" },
  { player: "GLITCHA", game: "Bloque Buster", score: 28450, ago: "hace 18 min", color: "cyan" },
  { player: "ARKADYA", game: "Serpentina", score: 7820, ago: "hace 24 min", color: "green" },
  { player: "CYBER_LU", game: "Ranaria", score: 18900, ago: "hace 31 min", color: "yellow" },
];

export const TOP_PLAYERS_TODAY: TopPlayer[] = [
  { rank: 1, player: "NEONFOX", score: 312840 },
  { rank: 2, player: "PX_KAI", score: 248110 },
  { rank: 3, player: "M00NRYU", score: 196720 },
  { rank: 4, player: "VAULT_07", score: 154300 },
  { rank: 5, player: "GLITCHA", score: 138900 },
];

export const PRICING_FAQ: FaqItem[] = [
  { q: "¿REALMENTE ES GRATIS?", a: "Sí. Arcade Vault es un proyecto sin fines de lucro hecho por amor a los clásicos. No hay versión \"premium\" escondida." },
  { q: "¿NECESITO CREAR CUENTA?", a: "No. Puedes jugar como invitado. Si quieres guardar tu puntuación y aparecer en el ranking, regístrate en 10 segundos." },
  { q: "¿CÓMO SOBREVIVEN SIN COBRAR?", a: "Es un proyecto comunitario. Si te gusta, compártelo. Esa es toda la moneda que aceptamos." },
];
