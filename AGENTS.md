# Desarrollo de Comunidad

- Mantén las rutas, subrutas, componentes y modelos en inglés. Escribe en español los textos de la interfaz.
- Sigue las guías de diseño, producto y componentes del repositorio Ad-Astra-Landing-page y el manual de identidad de Ad Astra.
- Prioriza calidad, legibilidad y sencillez. Define los contratos de datos y comprueba entradas externas y permisos en sus puntos de entrada. Evita repetir validaciones que el contrato ya garantiza.
- Organiza cada funcionalidad cerca de su ruta y sus pruebas. Extrae módulos compartidos cuando haya consumidores concretos.
- Trabaja con TDD en incrementos pequeños. Comprueba el fallo esperado, implementa el comportamiento y refactoriza con las pruebas en verde. Haz commits frecuentes con un propósito claro.
- Astra 6.2 coordina y delega en Sol 6.2 o Terra 6.1 según la tarea. El coordinador elige el razonamiento de cada agente y acuerda alcance, archivos y contratos al repartir trabajo en paralelo. Comunica los cambios de contrato y los resultados de pruebas antes de integrar.
- Abre una PR por funcionalidad terminada. Encarga la revisión independiente a Sol 6.2 con razonamiento muy alto (`xhigh`) y la skill `review-agent`. El revisor examina el diff en modo de solo lectura. El autor atiende los hallazgos confirmados y vuelve a ejecutar las comprobaciones.
- Durante el desarrollo, el coordinador mantiene un agente de seguimiento en paralelo. Ese agente registra en docs/development-log.md los hitos, commits, pruebas con resultado, bloqueos y su resolución. Identifica qué comprobó y qué le comunicaron. Reactívalo al cambiar el estado de un incremento o de su revisión.
