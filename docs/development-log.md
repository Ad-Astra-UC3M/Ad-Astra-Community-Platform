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
- El alcance corresponde al arranque del prototipo. La revisión final del incremento sigue pendiente.

### Integración de identidad, reservas y asistencia

- El trabajo en paralelo cubrió identidad y alta, actividades y reservas, asistencia por QR, integración visual y seguimiento. Queda pendiente la revisión independiente final.
- Identidad y alta simulada en `0b7f9f7`, `b9ae434` y `dc2bf15`. Catálogo, reservas y asistencia en `ff8728f` y `adf11f2`. Los agentes comunicaron pruebas unitarias de identidad y reservas en verde. En la disputa multiproceso por la última plaza, hubo un único ganador y una relectura confirmó que su reserva persistía.
- `777b669` integra la tarjeta firmada y la validación de asistencia por turno. Coordinación observó el fallo esperado de la prueba de la tarjeta y que pasó tras implementar la firma. `c1950ef` incorpora el acceso a la demo desde la portada.
- Coordinación confirmó cuatro casos de extremo a extremo en Chrome, dos por tamaño de pantalla. La cobertura incluyó un QR sintético leído por cámara y pegado manualmente, y una respuesta HTTP 404. `npm run build` pasó. La validación visual final sigue pendiente.
