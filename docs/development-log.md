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
