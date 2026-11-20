/**
 * @file Configuración ejecutada por Next.js al iniciar o compilar. La regla de Turbopack permite que los
 * componentes institucionales importen PNG y SVG como recursos. Las rutas y las acciones de cuenta se
 * descubren por las convenciones de App Router.
 */

import type { NextConfig } from "next";

const config: NextConfig = {
  turbopack: {
    rules: {
      "*": {
        condition: { path: /(?:^|\/)src\/institutional\/assets\/.*\.(?:png|svg)$/ },
        type: "asset",
      },
    },
  },
};

export default config;
