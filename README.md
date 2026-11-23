# Comunidad Ad Astra UC3M

Plataforma web en español de la asociación Ad Astra UC3M para gestionar cuentas verificadas con dominio UC3M, actividades con turnos y aforos, tarjeta QR personal, catálogo de oportunidades y marcadores, perfil de talento voluntario con difusión separada y panel administrativo por capacidades.

## Arquitectura

- **Next.js 16 (App Router)** con componentes propios en `.jsx` y estilos en **Tailwind CSS v4** (`src/app/globals.css`).
- **PostgreSQL en Neon** con **Drizzle ORM** (`src/db/schema/*`, `drizzle/0000_initial.sql`, `drizzle/0001_profile_avatar.sql`, 13 tablas MVP en `public`) y **PGlite** para pruebas automáticas locales y E2E.
- **Neon Auth** (`@neondatabase/auth/next/server`, `src/server/auth/`) con Better Auth gestionado por Neon. El acceso usa correo UC3M y contraseña. La verificación del alta y la recuperación usan códigos de seis dígitos por correo, específicos para cada operación. La asistencia usa tarjetas QR firmadas con `jose` (`HS256`, `ATTENDANCE_QR_SECRET`).
- **Neon Object Storage** (`src/server/storage/`, API compatible con S3 en modo path-style y firma AWS SigV4) en bucket privado para la foto de perfil opcional, servida mediante los endpoints autenticados `/api/profile/avatar` y `/api/admin/talent/[id]/avatar` sin enlaces públicos.

En cada rama de Neon Auth, activa la verificación al registrarse mediante código por correo, el inicio automático de sesión tras verificar y la revocación de sesiones al restablecer la contraseña. El MVP utiliza el proveedor de correo compartido de Neon.

## Configuración local

Copia `.env.example` a `.env.local` y completa las 6 variables obligatorias:

- `DATABASE_URL`: conexión pooled a PostgreSQL en Neon (SSL).
- `DATABASE_URL_UNPOOLED`: conexión directa para migraciones (`drizzle-kit` / `db:migrate`).
- `NEON_AUTH_BASE_URL`: endpoint de Neon Auth del proyecto/rama.
- `NEON_AUTH_COOKIE_SECRET`: secreto de firma/cifrado de cookies de sesión (mín. 32 bytes).
- `ATTENDANCE_QR_SECRET`: secreto HMAC-SHA256 exclusivo para tokens de tarjeta QR (mín. 32 bytes).
- `APP_ORIGIN`: origen canónico (p. ej. `http://127.0.0.1:3000` en local o `https://comunidad.adastrauc3m.es`).

Para habilitar la subida de fotos de perfil en un bucket privado de Neon Object Storage, define además estas 5 variables opcionales:

- `AWS_ENDPOINT_URL_S3`: endpoint S3 del proyecto/rama en Neon (`https://<branch-id>.storage.<region>.aws.neon.tech`).
- `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY`: credenciales con permiso `storage:read` y `storage:write`.
- `AWS_REGION`: región del endpoint (p. ej. `eu-central-1`; se infiere del endpoint si se omite).
- `NEON_STORAGE_BUCKET`: nombre del bucket privado (p. ej. `ad-astra-avatars`).

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
- `drizzle/`: migraciones SQL incrementales (`0000_initial.sql`, `0001_profile_avatar.sql`).
- `src/server/`: acceso, reglas de negocio y datos agrupados por `auth/`, `activities/`, `opportunities/`, `accounts/`, `profiles/` y `storage/`.
- `src/app/`: páginas y layouts JSX, junto con las Server Actions que invocan las funciones de servidor.
- `src/components/` y `src/institutional/`: barra/pie institucional y componentes compartidos.
- `scripts/`: utilidades operativas (`bootstrap-admin.ts`).
- `e2e/`: seed y recorridos de navegador con Playwright.

La [guía del backend](docs/backend/README.md) explica cómo seguir un formulario hasta su operación de servidor y documenta las funciones de cada módulo.

El [modo de trabajo con agentes](AGENTS.md) y la [bitácora de desarrollo](docs/development-log.md) permiten retomar el proyecto.
