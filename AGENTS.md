# Trabajar con agentes en Comunidad

## Retomar el trabajo

Lee el [README](README.md) y la última entrada de la [bitácora](docs/development-log.md). Comprueba `git status --short --branch`, el historial reciente, el remoto y las PR abiertas. Identifica qué está integrado, qué cambio tiene revisión pendiente y en qué punto retomar las pruebas. El prototipo usa datos sintéticos. La arquitectura de producto prevé Neon y Neon Auth para la fase de integración.

## Repartir una funcionalidad

1. Gemini 4 Argon coordina. Define el comportamiento observable y el criterio de aceptación. Abre una rama `codex/<funcionalidad>` desde la base vigente.
2. Delega bloques independientes en Gemini Neon o Opus 5.5 según la tarea. Elige el nivel de razonamiento de cada implementador. Acuerda qué rutas puede editar cada agente, las firmas compartidas, los estados de error y quién integra. Un cambio de contrato se comunica antes de modificar a sus consumidores.
3. Asigna en paralelo un agente de seguimiento a `docs/development-log.md`. Reactívalo al terminar incrementos, detectar bloqueos y cerrar la revisión. Distingue sus comprobaciones de las que le comunica otra persona.
4. Divide la funcionalidad en incrementos TDD. Escribe primero una prueba de comportamiento, observa el fallo esperado, implementa, verifica y refactoriza en verde. Haz commits pequeños con un propósito. Si varios agentes trabajan en el mismo árbol, limita también los commits a los archivos propios, por ejemplo `git commit --only -m "..." -- ruta1 ruta2` tras añadir los archivos nuevos. Coordina las operaciones Git y reserva la compilación compartida al integrador.

## Criterios de implementación

- Escribe los componentes React propios en JavaScript con extensión `.jsx`, incluidas páginas, layouts, adaptadores y pruebas que rendericen JSX. Los componentes de terceros pueden conservar `.tsx`.

- Prioriza calidad, legibilidad y sencillez (no peso). Usa modelos y contratos explícitos. Valida datos externos y permisos en las fronteras y conserva los invariantes en la operación que escribe, evitando ruido defensivo innecesario cuando las interfaces y modelos de datos estén bien definidos.
- Mantén rutas, subrutas, componentes y modelos en inglés, y la interfaz en español. Cuida una estructura de carpetas legible y accesible, organiza el código por recorrido y acerca sus pruebas. Extrae componentes cuando varias pantallas compartan un comportamiento concreto.
- Para el diseño, consulta el manual de identidad y las guías de diseño, producto y componentes del repositorio `Ad-Astra-Landing-page`. Reutiliza activos institucionales apropiados y verifica los estados de interacción en móvil y escritorio.

## Integrar, revisar y entregar

1. Ejecuta `npm test`, `npm run typecheck`, `npm run build` y los recorridos afectados con `npm run test:e2e`. El chequeo de tipos genera los tipos de ruta e ignora los validadores antiguos de desarrollo. Las instrucciones de instalación del navegador están en el README.
2. Sube la rama y abre una PR por funcionalidad terminada. Indica alcance, cómo reproducir el recorrido, comprobaciones y límites. Comprueba la rama base y el commit de cabecera.
3. Delega la revisión a **otro agente Opus 5.5 con razonamiento alto (`high`)** y la skill `review-agent`. Dale la PR, la base real y las condiciones de aceptación. Debe examinar el diff completo desde el ancestro común y los puntos de entrada, en modo de solo lectura. El implementador corrige cada hallazgo confirmado con una prueba cuando corresponda. Repite las verificaciones, actualiza la PR y devuelve al revisor el nuevo commit.
4. En el relevo, registra en la bitácora rama, commits, PR, resultados y procedencia de las pruebas, hallazgos, correcciones y pendientes concretos. Verifica el estado final de Git. Una PR abierta y una publicación son hitos distintos.
