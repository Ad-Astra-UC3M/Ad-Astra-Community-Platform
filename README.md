# Comunidad Ad Astra UC3M

Plataforma web en español de la asociación Ad Astra UC3M para gestionar cuentas verificadas con dominio UC3M, actividades con turnos y aforos, tarjeta QR personal, catálogo de oportunidades y marcadores, perfil de talento voluntario con difusión separada y panel administrativo por capacidades.

## Arquitectura

- **Next.js 16 (App Router)** con componentes propios en `.jsx` y estilos en **Tailwind CSS v4** (`src/app/globals.css`).
- **PostgreSQL en Neon** con **Drizzle ORM** (`src/db/schema/*`, `drizzle/0000_initial.sql`, 13 tablas MVP en `public`) y **PGlite** para pruebas automáticas locales y E2E.
- **Neon Auth** (`@neondatabase/auth/next/server`, `src/lib/auth/*`, `src/app/api/auth/[...path]/route.ts`) con Better Auth gestionado por Neon. El acceso usa correo UC3M y contraseña. La verificación del alta y la recuperación usan códigos de seis dígitos por correo, específicos para cada operación. La asistencia usa tarjetas QR firmadas con `jose` (`HS256`, `ATTENDANCE_QR_SECRET`).

## Configuración local

Copia `.env.example` a `.env.local` y completa las 6 variables obligatorias:

- `DATABASE_URL`: conexión pooled a PostgreSQL en Neon (SSL).
- `DATABASE_URL_UNPOOLED`: conexión directa para migraciones (`drizzle-kit` / `db:migrate`).
- `NEON_AUTH_BASE_URL`: endpoint de Neon Auth del proyecto/rama.
- `NEON_AUTH_COOKIE_SECRET`: secreto de firma/cifrado de cookies de sesión (mín. 32 bytes).
- `ATTENDANCE_QR_SECRET`: secreto HMAC-SHA256 exclusivo para tokens de tarjeta QR (mín. 32 bytes).
- `APP_ORIGIN`: origen canónico (p. ej. `http://127.0.0.1:3000` en local o `https://comunidad.adastrauc3m.es`).

Con Node.js 24 y npm, ejecuta desde la raíz:

```sh
npm ci
npm run db:migrate
npm run dev
```

Abre [Comunidad en local](http://127.0.0.1:3000). Para conceder la capacidad inicial `general_admin` a una cuenta UC3M activa y verificada (con auditoría `bootstrap`):

```sh
npm run db:bootstrap-admin -- persona@alumnos.uc3m.es
```

## Scripts y verificación

```sh
npm run db:generate
npm run db:migrate
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

- `npm test` ejecuta las pruebas unitarias e integración contra PGlite en memoria.
- `npm run test:e2e` prepara una base PGlite temporal aislada (`e2e/seed-e2e-db.ts`), arranca la compilación de producción en el puerto 3941 y recorre los flujos en escritorio y móvil (puedes usar Chrome instalado con `PLAYWRIGHT_CHANNEL=chrome`).

## Estructura

- `src/db/`: esquema Drizzle (`schema/`), cliente PostgreSQL/PGlite (`client.ts`) y migraciones (`migrate.ts`).
- `drizzle/`: migraciones SQL (`0000_initial.sql`).
- `src/lib/auth/`: validación UC3M, integración Neon Auth, proveedor de autenticación de pruebas y frontera de sesión (`session.ts`).
- `src/server/`: servicios (`auth/`, `services/attendance-card.ts`) y repositorios PostgreSQL (`repositories/`).
- `src/app/`: rutas, layouts, acciones de servidor y API `/api/auth/[...path]`.
- `src/components/` y `src/institutional/`: barra/pie institucional y componentes compartidos.
- `scripts/`: utilidades operativas (`bootstrap-admin.ts`).
- `e2e/`: seed y recorridos de navegador con Playwright.

El [modo de trabajo con agentes](AGENTS.md) y la [bitácora de desarrollo](docs/development-log.md) permiten retomar el proyecto.
