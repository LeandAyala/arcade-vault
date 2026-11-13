/**
 * Variables públicas de Supabase. Se leen en cada llamada (nunca a nivel de módulo) para que el
 * build no dependa del `.env`: sin ellas la app sigue funcionando sin sesión.
 *
 * Se accede con nombres literales (`process.env.NEXT_PUBLIC_…`) para que Next pueda sustituirlas
 * también en el runtime del proxy.
 */
export interface SupabaseEnv {
  url: string;
  publishableKey: string;
}

/** Una variable vacía (como quedan al copiar `.env.example`) cuenta como no definida. */
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Devuelve la URL y la publishable key, o `null` si falta alguna. Nunca lanza. */
export function getSupabaseEnv(): SupabaseEnv | null {
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}
