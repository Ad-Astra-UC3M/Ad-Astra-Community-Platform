# Comunidad Ad Astra UC3M

Plataforma web en español de la asociación Ad Astra UC3M para gestionar cuentas verificadas con dominio UC3M, actividades con turnos y aforos, tarjeta QR personal, catálogo de oportunidades y marcadores, perfil de talento voluntario con difusión separada y panel administrativo por capacidades.

## Arquitectura

- **Next.js 16 (App Router)** con componentes propios en `.jsx` y estilos en **Tailwind CSS v4** (`src/app/globals.css`).
- **PostgreSQL en Neon** con **Drizzle ORM** (`src/db/schema/*`, `drizzle/*.sql`, 14 tablas MVP en `public`) y **PGlite** para pruebas automáticas locales y E2E.
- **Neon Auth** (`@neondatabase/auth/next/server`, `src/server/auth/`) con Better Auth gestionado por Neon. El acceso usa correo UC3M y contraseña. La verificación del alta y la recuperación usan códigos de seis dígitos por correo, específicos para cada operación. La asistencia usa tarjetas QR firmadas con `jose` (`HS256`, `ATTENDANCE_QR_SECRET`).
- **Neon Object Storage** (`src/server/storage/`, API compatible con S3 en modo path-style y firma AWS SigV4) en bucket privado para la foto de perfil opcional, servida con `Cache-Control: no-store` mediante los endpoints autenticados `/api/profile/avatar` y `/api/admin/talent/[id]/avatar`.
- **Iconos animados de Animate UI** (`src/components/animate-ui/`, licencia en su `LICENSE.md`). Se usa solo `@animate-ui/react/icons`: `overrides` en `package.json` fija su dependencia opcional `@floating-ui/react` a la 0.26.28 de Headless UI, fuera del rango `^0.27` que pide. Antes de importar otras primitivas de Animate UI que usen Floating UI, revisa ese ajuste.

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

- `AWS_ENDPOINT_URL_S3`: endpoint S3 del proyecto/rama en Neon (`https://<branch-id>.storage.<clúster>.<region>.aws.neon.tech`).
- `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY`: credenciales con permiso `storage:read` y `storage:write`.
- `AWS_REGION`: región del endpoint (p. ej. `eu-central-1`; se infiere del host de Neon si se omite y es obligatoria para otros hosts).
- `NEON_STORAGE_BUCKET`: nombre del bucket privado (p. ej. `ad-astra-avatars`).

La subida acepta JPEG, PNG o WebP estáticos de hasta 2 MiB. El servidor decodifica el archivo, aplica su orientación, ajusta la imagen a un máximo de 512 × 512 píxeles y conserva la menor codificación entre WebP y AVIF. Los metadatos de origen se descartan. El formulario enlaza a [Avatar Studio](https://avatar.adastrauc3m.es).

Con Node.js 24 y npm, ejecuta desde la raíz. El comando de migración carga la configuración local de Next.js.

```sh
npm ci
npm run db:migrate
npm run dev
```

Abre [Comunidad en local](http://127.0.0.1:3000). Para habilitar la primera cuenta administradora, regístrala con un correo UC3M y verifica el correo con el código recibido. Con la conexión del mismo entorno configurada, ejecuta el comando con esa dirección.

```sh
npm run db:bootstrap-admin -- correo@uc3m.es
```

El comando carga la configuración local de Next.js y concede `general_admin` a la cuenta activa y verificada. Desde `Cuentas` (`/admin/accounts`), puede administrar cuentas, capacidades y solicitudes de supresión. La edición de contenido, la validación de asistencia y la consulta de talento se conceden por separado en la ficha de la cuenta.

Si falla el borrado de una foto retirada, el titular puede pulsar «Completar retirada» en su perfil. Para reintentar todos los borrados pendientes, ejecuta `npm run avatars:cleanup` con la conexión a PostgreSQL y las credenciales de almacenamiento del entorno. Un código de salida distinto de cero indica que la limpieza requiere otro intento.

## Despliegue en Vercel

Configura las variables de la sección anterior en el entorno de Vercel que recibe el despliegue. Para una Preview usa PostgreSQL, Neon Auth y el bucket privado de la rama Neon de desarrollo. En Production usa los recursos de la rama Neon de producción. Usa como `APP_ORIGIN` el origen donde se abre ese entorno. Guarda las conexiones de base de datos, secretos de sesión y QR y credenciales del bucket como secretos de Vercel. [Variables de entorno en Vercel](https://vercel.com/docs/environment-variables)

El proyecto `ad-astra-community-platform` está en el equipo `jorgesu040s-projects`. La publicación se realiza desde la raíz del repositorio con Vercel CLI. Desde un checkout nuevo, vincula el directorio al proyecto y ejecuta el comando del entorno correspondiente.

```sh
vercel link --project ad-astra-community-platform --scope jorgesu040s-projects
vercel deploy
```

Para conservar el origen configurado en Neon Auth, asigna el alias estable al nuevo despliegue Preview con `vercel alias set <url-del-preview> ad-astra-community-preview-jorgesu040.vercel.app --scope jorgesu040s-projects`. [Alias de Vercel](https://vercel.com/docs/cli/alias)

Para preparar una compilación de Production y comprobarla antes de que reciba los dominios, ejecuta `vercel deploy --prod --skip-domain`. Cuando esté lista, asigna los dominios con `vercel promote <id-del-despliegue>`. [Despliegues en Vercel](https://vercel.com/docs/deployments)

Aplica `npm run db:migrate` a la rama Neon del entorno antes de desplegar código que use una migración nueva. Después de cambiar las variables, genera un despliegue nuevo. Comprueba la respuesta HTTPS en el dominio que lo va a servir, incluido el dominio institucional de Production. Jorge comprobó su acceso por HTTPS sin avisos en su navegador habitual. [Comunidad Ad Astra](https://comunidad.adastrauc3m.es)

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

- `npm run db:generate` compara el esquema de TypeScript con el último snapshot de `drizzle/meta/`. Versiona juntos el SQL nuevo, el snapshot y el journal que genera.
- `npm run db:migrate` sigue el journal de Drizzle y registra cada migración y su huella en `drizzle.app_migrations`. Cuando una base anterior incorpora el historial, el ejecutor reaplica los dos SQL de arranque idempotentes. Cualquier cambio posterior al esquema requiere un archivo SQL nuevo.
- `npm test` ejecuta las pruebas unitarias e integración contra PGlite en memoria.
- `npm run test:e2e` prepara una base PGlite temporal aislada (`e2e/seed-e2e-db.ts`), arranca la compilación de producción en el puerto 3941 y recorre los flujos en escritorio y móvil (puedes usar Chrome instalado con `PLAYWRIGHT_CHANNEL=chrome`).

## Estructura

- `src/db/`: esquema Drizzle (`schema/`), cliente PostgreSQL/PGlite (`client.ts`) y migraciones (`migrate.ts`).
- `drizzle/`: migraciones SQL incrementales, snapshots y journal de Drizzle Kit (`meta/`).
- `src/server/`: acceso, reglas de negocio y datos agrupados por `auth/`, `activities/`, `opportunities/`, `accounts/`, `profiles/` y `storage/`.
- `src/app/`: páginas y layouts JSX, junto con las Server Actions que invocan las funciones de servidor.
- `src/components/` y `src/institutional/`: barra/pie institucional y componentes compartidos.
- `scripts/`: utilidades operativas (`bootstrap-admin.ts` y `cleanup-avatars.ts`).
- `e2e/`: seed y recorridos de navegador con Playwright.

La [guía del backend](docs/backend/README.md) explica cómo seguir un formulario hasta su operación de servidor y documenta las funciones de cada módulo.

El [modo de trabajo con agentes](AGENTS.md) y la [bitácora de desarrollo](docs/development-log.md) permiten retomar el proyecto.
