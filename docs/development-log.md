# Bitácora de desarrollo de Comunidad

## 2026-11-18 · Base de la aplicación

- Commit raíz `51445f7` en `main`. Inicializa la aplicación de Comunidad con Next.js y TypeScript, incorpora una portada en español, carga localmente la tipografía Wild World y añade la primera prueba de la página.
- Coordinación ejecutó `npm test` antes y después de implementar la portada. La primera ejecución falló porque todavía faltaba el módulo `./page`. La prueba pasó tras añadirlo.
- Coordinación completó `npm run typecheck` y `npm run build` y comprobó con `next start` que la portada en español y el archivo de la tipografía respondían con HTTP 200 en local.

### Revisión independiente

La revisión de Sol 6.2 con razonamiento `xhigh` señaló dos ajustes que se incorporaron a `main`:

- `1762930` excluye la caché de tipos de desarrollo (`.next/dev/types`) de `npm run typecheck` para comprobar los tipos de ruta recién generados. Coordinación volvió a ejecutar `npm test`, `npm run typecheck` y `npm run build` con éxito.
- `c08d7a4` aplica al título de la portada el color principal de Ad Astra y las mayúsculas del estilo de marca. Coordinación volvió a ejecutar `npm test` y `npm run build` con éxito.

## 2026-11-18 · Arranque del prototipo de Comunidad

- Jorge confirmó el alcance del prototipo local. El flujo parte de un alta simulada, utiliza datos sintéticos aislados por navegador y guarda el estado en SQLite local. El escenario de demostración contempla dos turnos.
- El trabajo en `codex/community-prototype` se reparte en paralelo entre implementación y seguimiento. Coordinación integra las aportaciones y sus comprobaciones. El agente de seguimiento recoge en esta bitácora los hitos y su evidencia.
- En este punto quedaba pendiente la revisión final del incremento.

### Integración de identidad, reservas y asistencia

- El trabajo en paralelo cubrió identidad y alta, actividades y reservas, asistencia por QR, integración visual y seguimiento.
- Identidad y alta simulada en `0b7f9f7`, `b9ae434` y `dc2bf15`. Catálogo, reservas y asistencia en `ff8728f` y `adf11f2`. Los agentes comunicaron pruebas unitarias de identidad y reservas en verde. En la disputa multiproceso por la última plaza, hubo un único ganador y una relectura confirmó que su reserva persistía.
- `777b669` integra la tarjeta firmada y la validación de asistencia por turno. Coordinación observó el fallo esperado de la prueba de la tarjeta y que pasó tras implementar la firma. `c1950ef` incorpora el acceso a la demo desde la portada.
- Coordinación confirmó cuatro casos de extremo a extremo en Chrome, dos por tamaño de pantalla. La cobertura incluyó un QR sintético leído por cámara y pegado manualmente, y una respuesta HTTP 404. `npm run build` pasó.

### Cierre técnico y relevo

- La [PR #1](https://github.com/Ad-Astra-UC3M/Ad-Astra-Community-Platform/pull/1) de `codex/community-prototype` a `main` estaba abierta al cerrar la revisión. La base es `48e288e`, la revisión inicial se hizo sobre el diff hasta `64573df` y el último commit de código verificado fue `e343591`.
- El revisor independiente Sol 6.2 (`xhigh`) confirmó el cierre de todos los hallazgos de código. `0753908` añade el 404 en español y aclara el plazo de cancelación. `7627b7d` aísla las pruebas unitarias de la base de la demo. `e343591` restaura el mismo estudiante al cambiar de rol si hay varias cuentas y comprueba que se puede repetir el alta después de caducar la verificación.
- Coordinación confirmó 13 pruebas unitarias, `npm run typecheck`, `npm run build` y 12 ejecuciones de extremo a extremo (dos casos, dos tamaños de pantalla y tres repeticiones).
- El lector anterior fallaba con algunos patrones. Coordinación comprobó que `jsQR` decodificó 100 de 100 QR sintéticos y verificó la cámara con vídeo simulado. Queda pendiente probar la lectura con una cámara física.
- El agente de interfaz verificó la demo en Edge a 320, 390 y 1280 píxeles y comprobó que la versión impresa oculta los controles.
- La demo conserva SQLite local y la verificación simulada del alta. La integración con Neon corresponde a una fase posterior. En ese momento se propuso revisar la demo con Gregorio.

## 2026-11-18 · Validación del prototipo y ajustes de navegación

- La PR #1 se fusionó en `main` en `ec1a7e4`, base de `codex/community-navigation`.
- Jorge validó el prototipo y pidió dos ajustes. El primero es adaptar la barra de navegación y el pie de la landing. El segundo es unificar el comportamiento de «Atrás» y la iconografía en Comunidad.
- Los dos frentes se trabajaron en paralelo. La prueba con una cámara física sigue sin confirmar.

### Cierre técnico de navegación

- La [PR #2](https://github.com/Ad-Astra-UC3M/Ad-Astra-Community-Platform/pull/2) de `codex/community-navigation` a `main` queda abierta. `bcb3a36` incorpora Hugeicons, `676cbee` unifica los enlaces de vuelta y las flechas, y `a37c4ee` adapta la barra de navegación y el pie institucional a Comunidad.
- La revisión independiente de Sol 6.2 (`xhigh`) señaló problemas de contraste en la llamada a la acción, visibilidad del foco y orden de tabulación en móvil. `ca825d1` y `ef6723e` incorporan los ajustes.
- Coordinación comprobó 14 pruebas unitarias, `npm run typecheck`, `npm run build` y seis pruebas de extremo a extremo. La verificación cubrió contraste, foco, destinos de vuelta, distintos tamaños de pantalla e impresión.

### Copia literal de la barra y el pie

- Jorge pidió incorporar a Comunidad copias literales de `Navbar.jsx` y `Footer.jsx` de la landing. Para este ajuste pidió omitir la verificación visual. Coordinación comprobará la coincidencia mediante hashes y ejecutará el build.

- Se comprobó la coincidencia SHA-256 y de los blobs Git de ambos JSX. La compatibilidad con enlaces y recursos reside fuera de los originales. La compilación y el chequeo de tipos pasaron.

### Convención JSX

- Jorge pidió usar JSX para los componentes internos de Comunidad. Los componentes de terceros pueden conservar TSX.
- La migración se incorporó en `codex/community-navigation` con `a2f08ba` (componentes internos, adaptador `src/institutional/next-link.jsx` y descubrimiento de pruebas JSX) y `3312051` (vistas de Comunidad y pruebas de interfaz en `.jsx`). `25074fc` actualizó `AGENTS.md` con el reparto de agentes en Antigravity (`Gemini 4 Argon`, `Gemini Neon` y `Opus 5.5`) y los criterios de calidad, legibilidad, sencillez y ausencia de ruido defensivo innecesario.
- El revisor independiente Opus 5.5 (`high`) en modo de solo lectura examinó `9fa42a3..3312051` y el diff completo de la PR #2 (`ec1a7e4..3312051`) y comunicó `No findings.`, confirmando que no quedan archivos `.tsx` internos y que `Navbar.jsx` y `Footer.jsx` permanecen intactos respecto a `9fa42a3`.
- Integración comunicó sobre `25074fc` la batería completa en verde: `npm test` (14/14 pruebas unitarias), `npm run typecheck`, `npm run build` (Next.js 16.4.6 Turbopack, 11/11 rutas) y `npm run test:e2e` con Chrome (6/6 pruebas en escritorio y móvil sobre `e2e/institutional-shell.spec.ts` y `e2e/community.spec.ts`).
- Los commits se publicaron en `origin/codex/community-navigation`, actualizando la [PR #2](https://github.com/Ad-Astra-UC3M/Ad-Astra-Community-Platform/pull/2) (que sigue abierta pendiente de fusión). La prueba con una cámara física sigue pendiente.

### Navegación nativa de Comunidad en la barra institucional

- Jorge aclaró que la reutilización de `Navbar.jsx` consiste en conservar su componente de interfaz (estructura JSX, clases Tailwind, `DesktopNavbar`, `MobileNavbar`, `HamburgerMenu` y `NavDropdown`), pero utilizando `next/link` de forma nativa y mostrando los enlaces y CTA propios de Comunidad según la sesión, en lugar de mantener `react-router` o los enlaces de la landing.
- `95ef1ae` (`Use native next/link and community navigation in Navbar`, sobre `2735b37`) sustituye `react-router` (`to`) por `next/link` (`href`) en `Navbar.jsx`, `NavDropdown.jsx`, `Footer.jsx` y `HamburgerMenu.jsx`, elimina el adaptador `src/institutional/next-link.jsx` y el alias `"react-router"` en `tsconfig.json`, configura `getCommunityNav(role)` en `src/institutional/data/navItems.js` conectado desde `src/app/layout.jsx` (`visitor`, `student` y `organizer`), y retira la barra duplicada `src/components/community-navigation.jsx` dejando en `CommunityBar` únicamente la franja de sesión demo.
- El revisor independiente Opus 5.5 (`high`) en modo de solo lectura revisó `2735b37..95ef1ae` y el diff completo `ec1a7e4..95ef1ae` de la PR #2 y devolvió `No findings.`.
- Integración comunicó sobre `95ef1ae` todas las comprobaciones en verde: `npm test` (17/17 pruebas unitarias, incluidas 3 nuevas en `src/institutional/data/navItems.test.js`), `npm run typecheck`, `npm run build` (Next.js 16.4.6 Turbopack, 11/11 rutas) y `npm run test:e2e` en Chrome (6/6 pruebas en escritorio y móvil sobre `e2e/institutional-shell.spec.ts` y `e2e/community.spec.ts`).
- `2735b37` y `95ef1ae` se publicaron en `origin/codex/community-navigation`, actualizando la [PR #2](https://github.com/Ad-Astra-UC3M/Ad-Astra-Community-Platform/pull/2) (abierta, pendiente de fusión). La prueba con una cámara física sigue pendiente.

## 2026-11-19 · Hito 1 · Oportunidades, perfil, cambios de turno y reemisión QR

- La [PR #2](https://github.com/Ad-Astra-UC3M/Ad-Astra-Community-Platform/pull/2) se fusionó en `main` en `b7057a8` (contenido idéntico a `f0589c5`), base de `codex/community-opportunities-and-profile`.
- El trabajo del Hito 1 se repartió en paralelo entre oportunidades/marcadores, perfil/talento/privacidad e integración (`b7057a8..2bd8706`):
  - `c4572ee` añade cambio atómico de turno, imágenes ordenadas de actividad y selección automática cuando hay un único turno.
  - `27fd3dc` incorpora reemisión versionada de tarjeta QR y enlaza el aviso de privacidad en `/sign-up`.
  - `8326f8f` y `940a23f` implementan el modelo SQLite de oportunidades y marcadores con sus invariantes y las vistas `/opportunities`, `/opportunities/[id]` y `/bookmarks`.
  - `e98afbc` y `79514e5` implementan el modelo SQLite y las vistas de perfil básico (`/profile`), talento (`/profile/talent`), preferencias de difusión y solicitud de supresión (`/profile/privacy`) y aviso de privacidad (`/privacy`).
  - `2bd8706` integra la navegación de oportunidades y perfil y añade cobertura E2E (`e2e/opportunities-and-profile.spec.ts`).
- El revisor independiente Opus 5.5 (`high`, modo solo lectura con `review-agent`) examinó `b7057a8..2bd8706` y comunicó `No findings.`, confirmando el cumplimiento de contratos e invariantes de cambios de turno, reemisión QR, oportunidades/marcadores y perfil/privacidad.
- Integración comunicó sobre `2bd8706` todas las comprobaciones en verde: `npm test` (28/28 pruebas unitarias), `npm run typecheck`, `npm run build` (Next.js 16.4.6 Turbopack, 17/17 rutas), `npm run test:e2e` en Chrome (12/12 pruebas en móvil y escritorio sobre `institutional-shell.spec.ts`, `community.spec.ts` y `opportunities-and-profile.spec.ts`) y `git ls-files "*.tsx"` vacío.
- La rama `codex/community-opportunities-and-profile` está publicada en `origin`. Quedan pendientes la apertura de la PR #3 (el comando `gh pr create` expiró esperando aprobación manual) y la prueba con cámara física.

## 2026-11-19 · Hito 2 · Autorización por capacidades, panel administrativo y recuperación de acceso

- La rama `codex/community-admin-and-auth` parte de `e8643f9` (cabecera de `codex/community-opportunities-and-profile`). El trabajo se repartió en paralelo entre acceso/capacidades, módulos administrativos e integración (`e8643f9..011e657`):
  - `71432c9` implementa autorización por cuatro capacidades independientes (`general_admin`, `content_editing`, `attendance_validation`, `talent_consultation` — con `general_admin` sin acceso a talento), estado de cuenta (`active`/`deactivated` con revocación inmediata de sesiones), auditoría de capacidades, recuperación de contraseña de un solo uso (`/forgot-password`, `/reset-password`) y retorno saneado a rutas protegidas (`/sign-in?next=...`).
  - `d8cd525` y `38d14c2` implementan el modelo administrativo SQLite y los módulos `/admin/*` (`/admin`, `/admin/attendance`, `/admin/activities`, `/admin/opportunities`, `/admin/accounts`, `/admin/deletion-requests`, `/admin/talent`), con HTTP 404 genérico ante falta de acceso, turno `normal` por defecto, protección de aforo y borrado de turnos, inscripción manual en puerta y confirmación/corrección manual de asistencia en acción separada con motivo y autor, y resolución motivada de solicitudes de supresión.
  - `011e657` bloquea reservas y cambios de turno en actividades archivadas, completa los retornos a rutas protegidas y añade cobertura E2E en `e2e/admin-and-auth.spec.ts`.
- El revisor independiente Opus 5.5 (`high`, modo solo lectura `review-agent` sobre `e8643f9..011e657`) comunicó `No findings.`, confirmando aislamiento de capacidades, HTTP 404 sin acceso, recuperación de un solo uso, invariantes de aforo/puerta/supresión y cero archivos `.tsx` internos.
- Integración comunicó sobre `011e657` todas las comprobaciones en verde: `npm test` (39/39 pruebas unitarias), `npm run typecheck`, `npm run build` (Next.js 16.4.6 Turbopack, 25/25 rutas), `npm run test:e2e` en Chrome (18/18 pruebas en móvil y escritorio sobre `institutional-shell.spec.ts`, `community.spec.ts`, `opportunities-and-profile.spec.ts` y `admin-and-auth.spec.ts`) y `git ls-files "*.tsx"` vacío.
- Pendientes de publicación remota: subir `e8643f9` en `codex/community-opportunities-and-profile` y abrir PR #3; subir `codex/community-admin-and-auth` y abrir PR #4; realizar la prueba con cámara física. La integración real con PostgreSQL en Neon y Neon Auth queda para la fase posterior.

## 2026-11-19 · Migración integral a Tailwind CSS v4

- Jorge aprobó migrar todas las vistas y componentes de Comunidad a **Tailwind CSS v4** eliminando las hojas de CSS tradicional separadas. La rama `codex/community-tailwind` parte de `ebc158c` (`codex/community-admin-and-auth`) y se trabajó en paralelo entre portal, panel administrativo e integración (`ebc158c..66bc989`):
  - `8b7e60b` sustituye `src/app/globals.css` por `@import "tailwindcss";` con los tokens de Ad Astra en `@theme`, `@font-face` (`Wild World`), `@layer base` mínimo y `@keyframes` del pie institucional; añade `src/app/globals.test.js`; elimina `src/components/navigation-links.css`, `src/components/institutional-shell.css` y `src/institutional/institutional.css`; migra el layout, la portada y las vistas de acceso/privacidad; y añade la directriz de Tailwind CSS en `AGENTS.md`.
  - `bdc52b5` migra a Tailwind CSS v4 las 12 vistas de `/admin/*`.
  - `66bc989` migra a Tailwind CSS v4 las 13 vistas del portal de Comunidad (`/home`, `/activities`, `/my-activities`, `/qr-card`, `/opportunities`, `/bookmarks` y `/profile/*`).
- El revisor independiente Opus 5.5 (`high`, modo solo lectura `review-agent` sobre `ebc158c..66bc989`) comunicó `No findings.`, confirmando que `src/app/globals.css` es la única hoja `.css` del repositorio, sin clases CSS tradicionales huérfanas ni archivos `.tsx` internos, y preservando accesibilidad (`Saltar al contenido`, alturas táctiles mínimas, landmarks/roles) e impresión (`print:hidden`).
- Integración comunicó sobre `66bc989` todas las comprobaciones en verde: `npm test` (40/40 pruebas unitarias, incluida `src/app/globals.test.js`), `npm run typecheck`, `npm run build` (Next.js 16.4.6 Turbopack, 25/25 rutas) y `npm run test:e2e` en Chrome (18/18 pruebas en móvil y escritorio en los 4 specs).
- Quedan pendientes la publicación remota de las ramas (`codex/community-opportunities-and-profile`, `codex/community-admin-and-auth` y `codex/community-tailwind`), la apertura de sus PRs y la prueba con cámara física.

## 2026-11-20 · Migración a Neon PostgreSQL, Neon Auth y limpieza de `src/demo/`

- La rama `codex/neon-migration` parte de `codex/community-tailwind` (`04e87b4`) y ejecuta la migración integral a PostgreSQL/Drizzle/Neon Auth con retirada completa de la capa temporal SQLite/demo (`04e87b4..e1ee84e`):
  - Commits: `9d1b7b3`, `3707fb9`, `27390d8`, `c9d4fc3`, `5d85f6f`, `c18750d`, `9f862ed`, `414cb84` y `e1ee84e`.
  - Alcance implementado: esquema simplificado de 13 tablas MVP + 7 ENUMs en `public` con Drizzle ORM y migración inicial `drizzle/0000_initial.sql`, driver dual Neon Pool / PGlite, `scripts/bootstrap-admin.ts`, integración Neon Auth + proxy `/api/auth/[...path]` con bloqueo `403` (`change-email`, `sign-up*`, `delete-user`, `admin/*`), repositorios PostgreSQL con transacciones `FOR UPDATE` deterministas, migración de las 26 rutas y eliminación total de `src/demo/` y de la interfaz demo.
- Revisión independiente (`@revisor`, Opus 5.5 `high`, modo solo lectura):
  - La revisión inicial sobre `04e87b4..414cb84` (#81) reportó 3 hallazgos confirmados: `[P1]` mover la verificación de correo fuera del render `GET` en `src/app/verify-email/page.jsx` (Server Action `verifyEmailAction` compatible con `Set-Cookie` de Neon Auth y segura frente a escáneres de enlaces), `[P2]` garantizar transaccionalmente el invariante `last_general_admin` con `FOR UPDATE` en `setProfileCapability` y `setProfileStatus`, y `[P2]` bloquear el secreto QR de prueba siempre que `NEON_AUTH_BASE_URL` esté definido en `src/server/services/attendance-card.ts`.
  - Los 3 hallazgos se corrigieron con TDD en `e1ee84e`. La re-revisión independiente sobre `414cb84..e1ee84e` (y rango total `04e87b4..e1ee84e`) cerró con `No findings.` (#85).
- Comprobaciones y procedencia sobre `e1ee84e`:
  - Comunicadas por `@integrador`: `npm test` **50/50**, `npm run typecheck` OK, `npm run build` OK (26 rutas `ƒ Dynamic`), `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` **18/18** (`desktop` y `mobile` sobre PGlite real + mailbox JSONL), auditoría Fase 4.4 con **0** restos SQLite/demo, **0** archivos `.tsx` internos y única hoja CSS `src/app/globals.css`.
  - Confirmadas independientemente por `@revisor`: árbol limpio en `e1ee84e`, **0** archivos `.tsx` y `npm test` **50/50** en verde.
- Pendientes concretos: configurar proyecto/branch real en Neon + Neon Auth (`DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `ATTENDANCE_QR_SECRET`), ejecutar `npm run db:migrate` y `npm run db:bootstrap-admin`, validar envío SMTP y cookies reales en vivo, subir ramas y abrir PR cuando Jorge autorice el `git push`, y probar la lectura QR con cámara física.

## 2026-11-20 · Verificación de correo y recuperación de contraseña por código

- Rama local `codex/email-otp`, sobre `b0dd5b2` de `codex/neon-migration`. El trabajo se reparte entre integración con el proveedor, formularios y acciones, y pruebas de navegador.
- `b9a7eb4` vincula los códigos de seis dígitos al correo institucional y al propósito (verificación o recuperación). `0e74668` incorpora los formularios y acciones. `f14fe2a` utiliza la identidad devuelta por el proveedor tras verificar y permite continuar al destino protegido cuando se abre una sesión válida.
- `b468226` adapta el seed y el buzón JSONL de pruebas y comprueba en el navegador el rechazo del código erróneo y del anterior tras solicitar otro, la sesión tras verificar y el retorno al destino protegido. En recuperación comprueba el reintento tras un error del formulario, la invalidación tras usar el código y la nueva contraseña.
- El agente de seguimiento comprobó en Chrome de escritorio el fallo esperado en la compilación de partida tras el alta: la ruta de verificación aún carecía del campo «Código de verificación». También confirmó que el seed genera las cuentas verificadas en un directorio PGlite temporal nuevo.
- Integración comunicó `npm test` **56/56**, `npm run typecheck` y `npm run build` correctos, y Playwright con Chrome **20/20** en escritorio y móvil sobre PGlite y buzón JSONL (35,9 s). La consulta al OpenAPI de Neon Auth confirmó las cuatro operaciones OTP. Queda por verificar con una cuenta real la entrega del correo y la sesión resultante.
- La [PR #3](https://github.com/Ad-Astra-UC3M/Ad-Astra-Community-Platform/pull/3) está abierta contra codex/neon-migration. El proveedor OTP se integró en fc6fdca. La revisión detectó que el SDK aún leía las cookies entrantes al continuar en la misma petición. Los commits 6b0d704 y 0748ee4 usan la respuesta de verificación para reconocer la nueva sesión. El revisor independiente volvió a revisar la PR completa y cerró sin hallazgos pendientes.
- En 0748ee4 pasaron las 56 pruebas unitarias y de integración, el chequeo de tipos, la compilación y los 20 recorridos de Chrome (39,7 s).

## 2026-11-20 · Opción C · Backend por funcionalidad con Next.js

- Jorge eligió el patrón de App Router y pidió guías para incorporar a personas que empiezan con Next.js. La rama codex/next-backend-modules se apila sobre 81b37a7 de codex/email-otp en la [PR #4](https://github.com/Ad-Astra-UC3M/Ad-Astra-Community-Platform/pull/4).
- El código de servidor se divide en actividades, cuentas, oportunidades, perfiles y Auth. Las páginas JSX leen mediante operaciones autorizadas. Las Server Actions procesan formularios y delegan escrituras. La reserva normal y el alta en puerta adjudican la plaza con la misma transacción, conservando sus horarios, capacidades, motivo y auditoría.
- La reemisión y la presentación de la tarjeta QR se leen en el módulo de actividades. La suite de navegador detectó referencias JSX sin resolver en la tarjeta y el enlace de retorno del catálogo filtrado. Ambos casos quedaron corregidos antes de la última ejecución completa.
- El proxy público de Neon Auth se retiró en 243caa6. La primera prueba del endpoint daba 403 en el código de partida. En la versión final, las rutas GET y POST comprobadas devuelven 404. Better Auth sigue gestionando identidad, OTP y sesión. Jorge confirmó alta, reenvío, código, acceso, recarga, salida y recuperación con Neon de desarrollo en la compilación sin proxy. Una consulta agregada confirmó un perfil verificado.
- La [guía de incorporación](backend/README.md) enlaza cinco guías por módulo con funciones, parámetros, resultados, llamadores y diagramas. Se cotejaron 266 declaraciones en archivos nuevos o modificados y se comprobaron los enlaces locales.
- Integración comprobó 56 pruebas unitarias y de integración, el chequeo de tipos, la compilación de producción y los 22 recorridos Chrome de escritorio y móvil con cuatro workers. Tras incorporar el POST de OTP a la regresión del proxy, la prueba focalizada volvió a pasar en ambos dispositivos. Las pruebas de aforo usan PGlite.
- La revisión independiente inspeccionó el diff completo y comprobó las 56 pruebas. Los hallazgos sobre documentación y cobertura del POST se corrigieron. La segunda revisión de las guías cerró sin hallazgos pendientes.

## 2026-11-20 · Documentación junto al código del backend

- Jorge pidió que las explicaciones se puedan consultar en los ficheros y en cada función. Se documentaron cabeceras, funciones, parámetros, efectos y llamadores en los módulos de servidor, acciones y páginas relacionadas, base de datos, configuración y pruebas.
- El mapa del backend señala dónde leer el código para seguir una reserva y dónde se documentan las decisiones de App Router, permisos, Neon y pruebas PGlite. AGENTS.md recoge el criterio para nuevos cambios.
- La comprobación estática cotejó 102 ficheros y 374 funciones y métodos, preservando el código ejecutable de 67654d3. Pasaron 56 pruebas unitarias y de integración, el chequeo de tipos, la compilación y 22 pruebas Playwright en Chrome de escritorio y móvil.
- La revisión verificó el uso de sesión o credenciales al recuperar una identidad de Neon, el límite de una reserva por persona y turno y la reutilización de layouts durante la navegación cliente. Se corrigieron las fichas correspondientes.

## 2026-11-22 · Rediseño de Comunidad

- El seguimiento comprobó que `codex/community-redesign` parte de `96553fe`, punta local de `origin/codex/email-otp` con la integración de la PR #4. Coordinación informa que la [PR #3](https://github.com/Ad-Astra-UC3M/Ad-Astra-Community-Platform/pull/3) sigue abierta hacia `codex/neon-migration`.
- El mapa de partida de `src/app` incluye la portada, el acceso y el aviso de privacidad en abierto. El portal agrupa el inicio, las actividades, las reservas, la tarjeta QR, las oportunidades, los marcadores y los perfiles. El panel administrativo tiene sus propias vistas y comparte la página 404. `src/app/layout.jsx` monta la barra y el pie institucionales. La barra de Comunidad aparece al resolver una sesión válida.
- El seguimiento identificó 11 casos Playwright de partida en cinco archivos, configurados para escritorio de 1280 px y móvil de 390 px. Se comprueban los destinos de navegación por rol, el pie, menú móvil, foco e impresión. La suite recorre también verificación y recuperación por código, reservas, asistencia, reemisión y revocación de tarjeta, filtro y retirada de marcadores, perfil y privacidad, capacidades y respuestas HTTP 404. La cámara usa vídeo simulado y la configuración E2E usa PGlite y un buzón JSONL de pruebas.

### Implementación y primeras comprobaciones · 2026-11-23

- `5fc4c6f` actualiza la portada, las vistas de acceso y verificación, el aviso de privacidad, los perfiles y la página 404. La portada reúne la foto, «Crear cuenta» y «Acceder» en una misma cabecera. La lectura `listMyReservations` admite `/home` como destino al pedir el inicio de sesión desde la agenda.
- En `a9cb18d`, el panel administrativo reorganiza los módulos visibles por capacidad. Los listados de cuentas, talento, turnos, oportunidades y solicitudes usan tablas con una región desplazable a la que se puede llegar por teclado. El control de asistencia distingue el lector y la entrada manual del código.
- `8d7b691` rediseña `/home`, el catálogo y detalle de actividades, las reservas, las oportunidades y marcadores, y la tarjeta QR. El inicio incorpora un saludo con el nombre, un enlace al catálogo, la próxima reserva confirmada o un mensaje de agenda vacía, y accesos directos. «Mis actividades» muestra las próximas reservas y el historial de asistencia. Los marcadores muestran con un icono si una oportunidad está guardada.
- El seguimiento comprobó en el diff que la prueba de navegador del recorrido de asistencia añade comprobaciones de agenda vacía, orden en móvil, reserva confirmada e historial. Las dos pruebas unitarias nuevas de marcadores examinan su nombre accesible, su estado y el destino del formulario.
- Coordinación informa que la prueba nueva de la cabecera oscura y la acción amarilla falló antes del cambio y que después pasaron las siete pruebas focalizadas de portada y OTP. El agente de administración informa que pasaron sus dos pruebas focalizadas de tabla y entrada manual, escritas antes de la implementación.
- El agente del portal informa que las dos pruebas de marcadores fallaron antes de implementar el componente y pasaron después. También comprobó que Tailwind generó los estilos de la diagonal, la cronología y el icono del marcador guardado.

### Ajustes de integración · 2026-11-23

- El seguimiento comprobó que `a84f082` distingue las reservas futuras, los turnos en curso y el historial. Inicio carga la primera reserva futura de una actividad publicada mediante `loadMyHome`. «Mis actividades» conserva las reservas de actividades archivadas con el título en texto. La prueba de integración de reservas comprueba las tres situaciones temporales y el estado editorial.
- En ese commit se ajusta el rango de fechas de los turnos y se permite que el texto largo se parta en las tablas. El lector muestra una guía de encuadre cuando se abre la cámara. La prueba de navegador de supresión localiza la solicitud por fila de tabla. El recorrido de marcadores comprueba el nombre estable y el estado pulsado al guardar y antes de retirar. El recorrido de asistencia comprueba que se carga la foto de Inicio y toma capturas de la agenda y el historial.
- Sol 6.2 (`xhigh`) revisó `96553fe..a84f082`. Coordinación informó que se cerraron las correcciones de código. El revisor comprobó aparte en Chrome el foco, OTP, las tablas y el estado del marcador, y pidió actualizar la guía del backend. El seguimiento comprobó que `d715d6e` documenta la lectura de Inicio en las guías de [actividades](backend/activities.md) y [autenticación](backend/auth.md).
- En las capturas de Chrome, coordinación observó que el saludo con apellidos ocupaba demasiado espacio. En `61a6fe8`, el saludo usa el nombre de pila del perfil y los encabezados adaptan su tamaño a la anchura. Las acciones de reserva, cambio, cancelación, edición de actividades y asistencia revalidan las vistas de agenda afectadas. El recorrido de reserva vuelve a Inicio mediante el logotipo, con navegación de cliente. Coordinación observó el fallo esperado de la prueba del nombre de pila antes de implementar el cambio. El revisor comunicó que el ajuste pasó su segunda revisión sin hallazgos nuevos.

### Verificación de integración · 2026-11-23

- En la primera comprobación de integración, coordinación informó que pasaron `npm test` (61/61 pruebas unitarias y de integración), `npm run typecheck` y `npm run build` (30 rutas con Turbopack). La compilación se completó en un worktree temporal con ruta sin espacios. En la ruta original, con espacios, falló el arranque del worker de PostCSS, también fuera del sandbox.
- Coordinación informó de 22 recorridos superados de 22 en Chrome sobre `a84f082`, con los casos de escritorio y móvil.
- Sobre `61a6fe8`, coordinación informó que volvieron a pasar `npm test` (61/61), la compilación Turbopack con comprobación de TypeScript (30 rutas) y los 22 recorridos de Chrome de escritorio y móvil (35,1 s), en el worktree temporal sin espacios. El recorrido de reserva verificó el saludo con el nombre de pila y el retorno a la agenda desde el enlace institucional. El alcance de navegador incluye el proveedor OTP de prueba y el lector QR con cámara simulada.
- Coordinación confirmó la apertura de la [PR #5](https://github.com/Ad-Astra-UC3M/Ad-Astra-Community-Platform/pull/5) desde `codex/community-redesign` hacia `codex/email-otp`. Al cerrar esta entrada, la PR #3 seguía abierta. Quedan pendientes la revisión de la PR #5 para su integración y la prueba con cámara física.

### Síntesis v1+v2 y wrappers animados · 2026-11-23

- Para compilar con Turbopack sin el fallo del worker PostCSS en rutas con espacios, se dejó el worktree secundario en `d6bc45a` (separado) y se continuó directamente en `codex/community-redesign` dentro de `Ad-Astra-Community-Platform`.
- `559052e` combina los acabados editoriales de `v1` (cuadrícula `.astra-blueprint-grid`, `OrbitalMotif`, cintas amarillas inclinadas, iniciales en `/profile`, esquinas QR en `/qr-card` y planos conceptuales en `public/brand/`) sobre los tokens, iconos Hugeicons y tablas de `v2`, además de corregir el selector duplicado del estado de difusión en `/profile/privacy`.
- Integra ambos wrappers animados de la landing: `AnimatedWordmark` (`SVGAnimationWrapper`) con sus siete glifos SVG en línea heredando `currentColor` (con modo `inline` sin `py-0.5`) en cada aparición visible de «Ad Astra» salvo el logotipo `<img>` del `Navbar`, y `TextSpanWrapper2` (`--ease-astra` en `src/app/globals.css`) en `PageHeading` y cabeceras principales del portal y administración.
- Revisión independiente de solo lectura (`research`, `Gemini 4 Neon` con razonamiento alto por agotamiento al `0%` de la cuota de `Claude Opus 5.5 (High)` hasta `2026-11-25T21:23:14Z`): detectó solapamiento de cascada Tailwind v4 en `portalPanelClassName` vs `bg-brand-panel` y `accentRibbonClassName`, reducción de tamaño por `py-0.5` en instancias `inline` de `AnimatedWordmark`, cabeceras `@file`/JSDoc pendientes, concatenación SR en `/qr-card`, dos imágenes copiadas sin uso y dos ajustes de retícula/corte en móvil; todos corregidos y revalidados antes de crear `559052e`.
- Comprobaciones en verde sobre `559052e`: `npm test` (`65/65` pruebas unitarias y PGlite, incluyendo `AnimatedWordmark.test.jsx` y `TextSpanWrapper2.test.jsx`), `npm run typecheck`, `npm run build` (`30` rutas Turbopack), cero `.tsx` en `src/` y único CSS en `src/app/globals.css`; `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --workers=4` fuera del sandbox por bloqueo de `taskkill` dentro del sandbox (`22/22` pasadas en `54,5 s`, escritorio `1280 px` y móvil `390 px`, proveedor OTP de prueba y cámara simulada).
- Queda pendiente en remoto subir `559052e` y los commits posteriores de bitácora a `origin/codex/community-redesign` (actualizar la PR #5) y completar la prueba presencial con cámara física.
