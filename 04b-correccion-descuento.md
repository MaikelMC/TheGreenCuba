# Corrección: aplicar el descuento manual por negocio en los cobros

## El problema

Desde administración se puede poner a un negocio un descuento manual del 0 al 100 % (`suscripciones.descuento_pct`, escrito con `PATCH /api/admin/suscripciones`). Pero ese descuento **no se aplica en ningún cobro**: la creación de la factura de QvaPay (`src/app/api/pagos/qvapay/route.ts`) toma el precio completo del catálogo. El negocio con descuento paga el precio entero.

## Qué hay que hacer

**Requisito:** el pack a medida (funcionalidad 4) ya está terminado.

### 1. Un solo cálculo

Función pura `precioConDescuento(usd, descuentoPct)` en `src/lib/plans.ts` (o junto al cálculo de precios que ya exista):

- Aplica el descuento y redondea a centavos hacia el entero más cercano.
- `null`, 0 o un valor fuera del rango 0–100 = precio completo.
- Devuelve `{ original, final, descuentoPct }`.

Úsala en **todos** los sitios donde se muestra o se cobra el precio de un pack estándar o de un módulo suelto. **Nunca** en los packs a medida, cuyo precio ya es el final.

### 2. Cobro

En `src/app/api/pagos/qvapay/route.ts`:

- Lee `descuento_pct` de la suscripción del negocio en el servidor y calcula el precio con `precioConDescuento`, para `tipo: "plan"` y `tipo: "modulo"`.
- En `pagos`, añade `monto_original_centavos` y `descuento_pct` (migración Drizzle), para que quede constancia de qué descuento se aplicó en cada pago.
- **Si el precio final es 0** (descuento del 100 %): no crees factura en QvaPay, porque no admite cobros de 0. Aplica el derecho directamente en el servidor, con la misma función `aplicarDerecho` y dentro de una transacción. Crea la fila de `pagos` con `metodo = 'cortesia'`, `estado = 'pagado'` y `monto_centavos = 0`. Devuelve al cliente un resultado que el panel muestre como «Activado».

### 3. Mostrarlo

- **En `PlanCard`, `modulos-editor.tsx` y «Actívalo ahora» de `para-tu-negocio.tsx`:** si el negocio tiene descuento, el precio original va tachado en `muted-foreground` y el precio final en su lugar. Añade una etiqueta pequeña «Tu descuento: 20 %». Los precios en CUP se calculan sobre el precio final.
- **En los recordatorios de pago** (`recordatorios-pago-server.ts`): si el aviso menciona un monto, que sea el precio con descuento.
- **En el panel de administración:** donde se edita `descuento_pct`, una línea que muestre cómo queda el precio del pack actual del negocio con ese descuento.

### 4. Lo que no cambia

- El descuento no afecta al trial, ni a los packs a medida, ni a pagos ya hechos.
- Quitar el descuento solo afecta a los cobros siguientes.

## Cómo trabajar

1. Dime qué archivos vas a modificar y espera mi visto bueno.
2. Enséñame el SQL de la migración antes de `db:migrate`.
3. Ejecuta el typecheck, el lint, el build y los tests.

## Comprobación final

Dame esta lista marcada:

- [ ] Un negocio sin descuento paga exactamente lo mismo que antes.
- [ ] Un negocio con 20 % paga el 80 % en QvaPay, y `pagos` guarda el original y el porcentaje.
- [ ] Con 100 %, se activa sin pasar por QvaPay y queda registrado como `cortesia`.
- [ ] El precio mostrado en `PlanCard`, en los módulos, en «Para tu negocio» y en los recordatorios coincide con el que se cobra.
- [ ] Los packs a medida no reciben el descuento.
- [ ] Manipular la petición del cliente no cambia el precio.
- [ ] Typecheck, lint, build y tests sin errores.
