/**
 * El id del negocio de prueba, en un módulo sin dependencias.
 *
 * Vive aparte de `dev-place.ts` para que los componentes de cliente puedan
 * preguntar «¿es el negocio de prueba?» sin arrastrar al navegador lo que aquel
 * importa (la sesión del servidor).
 */
export const DEV_PLACE_ID = "dev-cafe-la-ceiba";
