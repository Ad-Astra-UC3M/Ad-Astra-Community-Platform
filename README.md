# Comunidad Ad Astra UC3M

Monolito Next.js de la comunidad universitaria de Ad Astra. Esta primera versión sirve la portada en español y permite ejecutar las pruebas en local.

## Desarrollo local

Con Node.js 24 y npm, ejecuta desde la raíz:

```sh
npm ci
npm run dev
```

Abre [la aplicación local](http://localhost:3000). Para verificar cambios ejecuta `npm test`, `npm run typecheck` y `npm run build`. Usa `npm start` para servir la compilación de producción.

## Dónde trabajar

- `src/app/` contiene las rutas del App Router. En la raíz están el layout, los estilos globales y la página de entrada con su prueba.
- `public/fonts/` contiene la tipografía institucional utilizada por la portada.
- [AGENTS.md](AGENTS.md) recoge las convenciones de implementación y revisión.

La arquitectura prevé PostgreSQL en Neon y Neon Auth. Esta base arranca sin configurar servicios externos.
