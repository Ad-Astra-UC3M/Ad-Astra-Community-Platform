# Comunidad Ad Astra UC3M

Prototipo navegable en español para ensayar el alta de estudiante, la reserva de un turno y el registro de asistencia. Usa datos ficticios. La base SQLite y la verificación simulada permiten recorrer la demo desde un único navegador. La arquitectura del MVP prevé Neon y Neon Auth.

## Ejecutar en local

Con Node.js 24 y npm, ejecuta desde la raíz:

```sh
npm ci
npm run dev
```

Abre [Comunidad en local](http://127.0.0.1:3000). Usa la misma dirección y el mismo perfil de navegador durante todo el recorrido. Una ventana privada nueva permite ensayar con un espacio de datos independiente.

## Probar los dos roles

1. Abre **Crear cuenta de prueba**, utiliza los datos de ejemplo y acepta el aviso. Pulsa **Simular verificación** para entrar. La demo realiza la verificación en pantalla.
2. En **Actividades**, abre los turnos del taller de CubeSat. Reserva el turno de mañana. El turno de tarde está completo. En **Mis actividades** puedes comprobar la reserva y cancelarla antes de la asistencia.
3. Abre **Mi tarjeta QR**. Puedes imprimirla. Para probar en un solo equipo, despliega **Usar el código sin cámara** y copia el código.
4. Pulsa **Probar como organizador** y selecciona el turno de mañana. Usa la cámara para leer la tarjeta impresa o pega el código y pulsa **Validar tarjeta**. Repite la validación para ver «Ya registrado». El turno de tarde rechaza esa misma tarjeta por falta de reserva.
5. Pulsa **Volver a estudiante**. En **Mis actividades** aparece la asistencia. Los atajos de rol pertenecen al prototipo y comparten el espacio de demostración de ese navegador.

La demo admite ensayar la asistencia antes de la fecha ficticia del taller. La cámara necesita permiso del navegador. Los datos se guardan en `.community-demo/community.sqlite`, que Git ignora. Puedes escoger otro archivo con `AD_ASTRA_DEMO_DB`.

## Verificar

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

La suite de navegador arranca la compilación de producción en el puerto 3941 con una base de prueba propia. Ejecuta el recorrido en dos tamaños de pantalla y alimenta el lector con la imagen QR emitida por la aplicación. Puedes seleccionar un Chrome instalado con la variable `PLAYWRIGHT_CHANNEL=chrome`. Para servir la compilación localmente utiliza `npm start`.

## Estructura

- `src/app/` contiene las rutas, las acciones de servidor y la interfaz de cada flujo.
- `src/components/` reúne la navegación y las vistas compartidas. Los recursos de marca están en `public/`.
- `src/demo/` contiene la identidad simulada, las reservas, las tarjetas firmadas y sus pruebas.
- `e2e/` contiene los recorridos de navegador.

El [modo de trabajo con agentes](AGENTS.md) y la [bitácora de desarrollo](docs/development-log.md) permiten retomar el proyecto.
