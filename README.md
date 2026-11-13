## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```

## Variables de entorno

El formulario de contacto de `/acerca-de` envía correos con [Resend](https://resend.com). Copia `.env.example` a `.env.local` y rellena los valores:

```bash
cp .env.example .env.local
```

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `RESEND_API_KEY` | Sí | API key de Resend. Sin ella, el formulario muestra `[ERR] Servicio de correo no configurado.` |
| `CONTACT_TO_EMAIL` | Sí | Buzón del equipo que recibe los mensajes. |
| `CONTACT_FROM_EMAIL` | No | Remitente. Por defecto `Arcade Vault <onboarding@resend.dev>`. |

Todas son solo de servidor (sin prefijo `NEXT_PUBLIC_`). El build no las necesita: se leen en cada envío.

> **Sandbox de Resend:** mientras el remitente sea `onboarding@resend.dev`, Resend solo entrega correos al email de la cuenta de Resend. Usa ese email como `CONTACT_TO_EMAIL` hasta verificar un dominio propio y cambiar `CONTACT_FROM_EMAIL`.

> **Dependencia `@react-email/render`:** `resend` la declara como peer dependency y la carga dinámicamente para renderizar la plantilla React del correo. `@react-email/components` la trae anidada, pero `resend` no la resuelve desde ahí, por eso está instalada como dependencia directa. No la elimines.

### Supabase

La autenticación (`/auth`) usa [Supabase Auth](https://supabase.com/docs/guides/auth) mediante `@supabase/ssr`, y la sesión se guarda en cookies.

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto, p. ej. `https://mvznnvlgnqwqlwqrmxtt.supabase.co`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sí | Publishable key (`sb_publishable_...`). Es pública: los datos se protegen con RLS. |
| `SUPABASE_DB_PASSWORD` | Solo CLI | Contraseña de la base de datos para `npx supabase link` / `db push`. La app nunca la lee. |

Si faltan las dos variables `NEXT_PUBLIC_SUPABASE_*`, el build pasa, el proxy deja pasar las peticiones sin refrescar la sesión, el nav muestra "Iniciar Sesión" y el formulario de `/auth` responde `[ERR] Servicio de autenticación no configurado.`

> **Nunca** uses una secret key (`sb_secret_...`) ni la `service_role` en estas variables: todo lo que lleva prefijo `NEXT_PUBLIC_` termina en el bundle del navegador.

## Base de datos (Supabase CLI)

El esquema está versionado en `supabase/migrations/`. La CLI viene como devDependency, así que se usa con `npx supabase` (no hace falta instalarla de forma global).

```bash
npx supabase login                                   # una vez, en una terminal interactiva
npx supabase link --project-ref mvznnvlgnqwqlwqrmxtt # pide SUPABASE_DB_PASSWORD
npx supabase migration new <nombre>                  # crea supabase/migrations/<timestamp>_<nombre>.sql
npx supabase db push --remote                        # aplica las migraciones pendientes al proyecto vinculado
```

> La CLI 3.x apunta por defecto al stack local (Docker). Para el proyecto remoto, pasa siempre `--remote`.

La CLI no lee `.env.local`. Para no escribir la contraseña cada vez, expórtala en la terminal antes de `link` / `db push` (`$env:SUPABASE_DB_PASSWORD = "..."` en PowerShell).

## Configuración del dashboard de Supabase (manual)

Estos ajustes no los cubren las migraciones y se hacen a mano en el [dashboard](https://supabase.com/dashboard/project/mvznnvlgnqwqlwqrmxtt):

1. **Authentication → URL Configuration**
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** añadir `http://localhost:3000/**`
2. **Authentication → Sign In / Providers → Email**
   - **Confirm email:** activado.
3. **Authentication → Emails → Templates → Confirm signup**: el enlace debe pasar por `/auth/confirm` con `token_hash`, no por `{{ .ConfirmationURL }}`:

   ```html
   <h2>Confirma tu cuenta en Arcade Vault</h2>
   <p>Pulsa el enlace para activar tu cuenta:</p>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirmar mi correo</a></p>
   ```

   Si la plantilla se queda con `{{ .ConfirmationURL }}`, el enlace no pasa por la app y la sesión no se abre.

Al desplegar en otro dominio, cambia la Site URL y añade `https://<dominio>/**` a las Redirect URLs.

> **Límite de correos:** el SMTP por defecto de Supabase permite muy pocos correos por hora. Si las pruebas de registro lo agotan, el formulario muestra `[ERR] Demasiados intentos. Espera unos minutos.` y hay que esperar (o configurar un SMTP propio, fuera del alcance actual).