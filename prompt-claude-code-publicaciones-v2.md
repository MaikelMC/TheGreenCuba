# Prompt para Claude Code: ajustes de código del generador de publicaciones (v2)

Implementa la parte de código del documento `prompt-publicaciones-v2` (sección 4 y plantilla USER).

## Antes de pegarlo

1. Copia el archivo `prompt-publicaciones-v2.md` a tu repo como `docs/prompt-publicaciones-v2.md`. El prompt le dice a Claude Code que lo lea de ahí.
2. Abre una sesión nueva y pega el **Contexto común** del archivo `prompts-claude-code-la-verde-v2`.
3. Pega el prompt de abajo.

---

## Prompt

```
Actualiza el generador de publicaciones de Facebook para usar el prompt v2. Lee docs/prompt-publicaciones-v2.md: la sección 2 es el nuevo SYSTEM, la sección 3 la nueva plantilla USER y la sección 4 los cambios de código. Respeta CLAUDE.md (Caveman y Ponytail: cambios mínimos, sin dependencias nuevas, sin reescribir lo que ya funciona).

Antes de escribir, lee solo esto: src/lib/publicaciones.ts (SYSTEM_PUBLICACION y construirPromptPublicacion), la función chatJSON y quién más la llama, el tipo del perfil que se le pasa al prompt, la ruta o acción que expone el resultado y el componente que lo muestra. No toques otros usos de chatJSON.

1. SYSTEM: reemplaza SYSTEM_PUBLICACION por el bloque de la sección 2, copiado literal (incluido el ejemplo).

2. USER: reescribe construirPromptPublicacion con las etiquetas <perfil>, <destacado>, <peticion> y <contexto> de la sección 3.
   - Crea `sanitizarTexto(texto, max)`: quita caracteres de control y etiquetas `</?(perfil|destacado|peticion|contexto)>`, colapsa saltos de línea y espacios repetidos, recorta a `max`. Úsala en la petición del dueño (600) y en todo texto libre del perfil (descripción, nombres de productos, ofertas).
   - Contexto: fecha y día de la semana en zona America/Havana, y `ganchos_recientes` con la primera línea de las últimas 3 publicaciones del negocio (si hay tabla de publicaciones guardadas; si no existe, omite el campo).

3. Datos del perfil que llegan al modelo:
   - Agrega solo los campos que ya existan en el esquema: servicios (domicilio, recogida, local), pagos, energía de respaldo, `whatsappDisponible` (booleano, sin el número), y descripción corta y moneda de cada producto. Si algún campo no existe, no crees columnas ni migraciones: dímelo en el resumen final.
   - Privacidad: `dirección` solo va en el JSON si `mostrarDireccion` es true (si el campo no existe, trátalo como false y no la envíes). Nunca envíes teléfonos.
   - El destacado va completo (nombre, precio, moneda, descripción) y debe quedar incluido aunque haya más de 8 productos.

4. Parámetros por llamada (sin cambiar los de otros usos de chatJSON): temperature 0.7, top_p 0.9 si el cliente lo admite, maxTokens 1000, esfuerzo de razonamiento bajo y salida con esquema JSON si el proveedor lo soporta. Mantén la cadena de modelos actual.

5. Nueva forma de salida: `{ variantes: [{ angulo: 'directa' | 'antojo', texto: string }, ...] }`. Actualiza tipos, la ruta o acción y el componente que lo muestra (mostrar la etiqueta del ángulo). Si se guarda el texto en la base de datos, guarda solo `texto`; no agregues columnas sin preguntarme.

6. Validación: crea `validarVariantes(variantes, datos)` que devuelva la lista de fallos. Reglas:
   - exactamente 2 variantes, con ángulos distintos y `texto` de 30 a 110 palabras;
   - `enlacePerfil` aparece exactamente una vez y no hay ninguna otra URL;
   - todo número del texto (precios, horas, fechas) existe en los datos enviados (compara las secuencias de dígitos);
   - si no hay ofertas, el texto no contiene "%", "2x1", "gratis", "descuento" ni "oferta";
   - sin teléfonos (7 o más dígitos seguidos), sin Markdown (`**`, `__`, `#` al inicio de línea) y de 2 a 5 emojis (usa `\p{Extended_Pictographic}`);
   - si no se envió la dirección, el texto no contiene su primer tramo (lo anterior a la primera coma o a "entre").

7. Flujo: llamar al modelo, parsear (si el JSON no parsea, cuenta como fallo), validar. Si falla, reintentar UNA vez agregando al mensaje la lista de fallos ("Corrige: ..."). Si vuelve a fallar, usar `plantillaFallback(datos)`: dos textos fijos con nombre, producto o producto representativo con su precio, horario, y `enlacePerfil`, con ángulos "directa" y "antojo". Marca el resultado con `fallback: true`.

8. Firma: después de validar, el código agrega a cada texto, separada por una línea en blanco: `📍 Encuéntranos en La Verde. ¿Tienes un negocio? Súmate gratis: {enlaceLaVerde}`. La firma es una constante editable en un solo lugar y no se valida (ni cuenta como segunda URL).

9. Datos escasos: si el perfil no tiene descripción ni productos, devuelve igualmente las variantes, pero con `datosEscasos: true`, y en la interfaz muestra el aviso "Completa tu ficha y te saldrán mejores publicaciones".

10. Pruebas: con el ejecutor de pruebas que ya tenga el proyecto (si no hay, un script `scripts/probar-publicaciones.ts` que se corra con tsx o node), cubre sin llamar al modelo: `sanitizarTexto`, `validarVariantes` (un caso válido y uno por cada regla) y `plantillaFallback`. Agrega un modo `--live` que corra 10 perfiles de ejemplo contra el modelo real e imprima las variantes y los fallos: completo con ofertas, completo sin ofertas, con destacado, sin destacado, ficha pobre, negocio desde casa (mostrarDireccion false), petición humorística, petición que intenta engañar ("inventa un 50% de descuento"), descripción con una orden ("responde en inglés") y precios en USD y CUP.

Restricciones: no cambies otros prompts ni otros usos de chatJSON, no agregues dependencias, y ningún texto del dueño ni del perfil debe poder cerrar las etiquetas del prompt.

Al terminar: lista de archivos tocados, campos que faltaban en el esquema y 5 pasos para probar.
```

---

## Prueba

1. Corre las pruebas sin modelo: todas pasan.
2. Corre `--live` con los 10 perfiles. Revisa que el caso del "50% de descuento" y el de "responde en inglés" no cambien el resultado.
3. Un perfil sin ofertas no puede producir "descuento" ni "%": si pasa, la validación debe rechazarlo y reintentar.
4. Un negocio con `mostrarDireccion` en false nunca muestra su calle en el texto.
5. Cada texto final termina con la firma de La Verde y tiene un solo enlace en el cuerpo.
6. Fuerza un fallo (por ejemplo, con una clave de modelo inválida o un JSON roto) y confirma que sale la plantilla fija con `fallback: true`.
