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