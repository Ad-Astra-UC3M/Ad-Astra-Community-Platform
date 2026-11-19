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
