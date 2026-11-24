/**
 * Punto de entrada del esquema público de Comunidad. client.ts lo carga para
 * tipar las consultas Drizzle sobre Neon o PGlite. drizzle.config.ts lo usa como
 * fuente para Drizzle Kit. Las tablas se agrupan por identidad, actividades,
 * oportunidades y talento.
 */

export * from "./identity";
export * from "./activities";
export * from "./opportunities";
export * from "./talent";
