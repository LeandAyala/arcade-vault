-- SPEC 06 — Catálogo de juegos y puntuaciones (leaderboard real).

-- ============================================================
-- Catálogo
-- ============================================================

create table public.games (
  id         text primary key check (id ~ '^[a-z0-9-]{1,32}$'),
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover      text not null,
  color      text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  sort_order smallint not null unique,
  created_at timestamptz not null default now()
);

comment on table public.games is 'Catálogo de juegos del Vault. Solo lectura desde la app.';

-- ============================================================
-- Puntuaciones
-- ============================================================

create table public.scores (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game_id    text not null references public.games (id) on delete cascade,
  score      integer not null check (score between 1 and 9999999),
  created_at timestamptz not null default now()
);

comment on table public.scores is 'Una fila por partida guardada. Solo el propio jugador puede insertar.';

create index scores_game_score_idx on public.scores (game_id, score desc, created_at);
create index scores_user_game_idx  on public.scores (user_id, game_id);

-- ============================================================
-- RLS
-- ============================================================

alter table public.games  enable row level security;
alter table public.scores enable row level security;

create policy "games_select_public" on public.games
  for select to anon, authenticated using (true);

create policy "scores_select_public" on public.scores
  for select to anon, authenticated using (true);

create policy "scores_insert_own" on public.scores
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Sin políticas de update/delete: nadie modifica ni borra desde la API.

-- ============================================================
-- Vistas (security_invoker: respetan la RLS de quien consulta)
-- ============================================================

-- Mejor marca por jugador y juego, con su puesto. A igual puntuación gana quien la logró antes.
create view public.game_leaderboard
with (security_invoker = true) as
with best as (
  select distinct on (s.game_id, s.user_id)
    s.game_id,
    s.user_id,
    s.score,
    s.created_at as achieved_at
  from public.scores s
  order by s.game_id, s.user_id, s.score desc, s.created_at asc
)
select
  b.game_id,
  b.user_id,
  p.username,
  b.score,
  b.achieved_at,
  (row_number() over (
    partition by b.game_id
    order by b.score desc, b.achieved_at asc, b.user_id
  ))::integer as rank
from best b
join public.profiles p on p.id = b.user_id;

-- Mejor puntuación y número de puntuaciones guardadas por juego (incluye juegos sin partidas).
create view public.game_stats
with (security_invoker = true) as
select
  g.id as game_id,
  max(s.score) as best,
  count(s.id)::integer as plays
from public.games g
left join public.scores s on s.game_id = g.id
group by g.id;

-- ============================================================
-- Seed del catálogo (los 8 juegos de lib/data.ts en el mismo orden)
-- ============================================================

insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  ('bloque-buster', 'BLOQUE BUSTER',
   'Rebota la pelota y destruye muros de neón.',
   'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?',
   'ARCADE', 'cover-bricks', 'cyan', 1),
  ('caida', 'CAÍDA',
   'Encaja las piezas antes de que el techo te aplaste.',
   'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.',
   'PUZZLE', 'cover-tetro', 'magenta', 2),
  ('serpentina', 'SERPENTINA',
   'Crece sin morder tu propia cola.',
   'Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.',
   'ARCADE', 'cover-snake', 'green', 3),
  ('gloton', 'GLOTÓN',
   'Devora puntos y escapa de los fantasmas.',
   'Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.',
   'ARCADE', 'cover-glot', 'yellow', 4),
  ('invasores', 'INVASORES',
   'Defiende el planeta de filas alienígenas.',
   'Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.',
   'SHOOTER', 'cover-invaders', 'green', 5),
  ('asteroides', 'ASTEROIDES',
   'Pulveriza asteroides en gravedad cero.',
   'Tu nave triangular flota en vacío absoluto. Rota, propulsa y dispara para partir los asteroides en fragmentos cada vez más pequeños. Atrapa el núcleo 3x para disparar en abanico y sobrevive oleada tras oleada.',
   'SHOOTER', 'cover-rocas', 'yellow', 6),
  ('ranaria', 'RANARIA',
   'Cruza la autopista de pixeles.',
   'Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.',
   'ARCADE', 'cover-rana', 'green', 7),
  ('duelo-pixel', 'DUELO PIXEL',
   'Dos paletas. Una pelota. Reflejos máximos.',
   'El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.',
   'VERSUS', 'cover-duelo', 'cyan', 8);
