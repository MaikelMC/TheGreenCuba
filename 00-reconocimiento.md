Antes de implementar nuevas funcionalidades en La Verde, necesito un informe del estado actual del repositorio. **No modifiques ningún archivo en este paso.**

Lee el código instalado (no la documentación) y respóndeme con un informe en español, en este orden:

## 1. Planes y permisos

- Contenido de `src/lib/plans.ts`: cómo se definen las funciones (features), módulos, packs, límites y precios por defecto. Copia los nombres exactos de las claves de funciones.
- Cómo se comprueba en el servidor si un negocio tiene una función: nombre de la función o helper, archivo, y cómo se combinan pack, módulos y prueba.
- Cómo se marcan las funciones «Próximamente» y cómo se muestra el candado en la UI.
- Cómo el catálogo vivo de `/admin/planes` sobrescribe los valores de fábrica (tabla y archivo).

## 2. Base de datos

- Lista de tablas en `src/lib/db/schema/`, con una línea de qué guarda cada una.
- Columnas exactas de estas tablas, o de sus equivalentes: negocios, categorías, productos del catálogo, pedidos, reservas, suscripciones, notificaciones y seguidores.
- En productos: cómo se guarda el precio (texto libre, número o moneda) y el estado «Hoy hay».
- Cómo se generan y aplican las migraciones (scripts de `package.json`).

## 3. Catálogo, pedidos y reservas

- Archivos y componentes del catálogo público (menú QR) y de la ficha del negocio.
- Cómo se arma el carrito y el mensaje de WhatsApp del pedido: archivo, función y plantilla. Copia el formato actual del mensaje.
- Cómo se pide la dirección en el pedido.
- Cómo funcionan las reservas (`mesa`, `apartado`, `cita`) y dónde se configuran.

## 4. Panel del negocio

- Rutas y archivos de cada sección del panel: Dashboard, Catálogo, Pedidos, Editor, Ofertas, Publicar, Asistente, Equipo, Planes y Ajustes.
- Cómo se controla qué pestañas ve cada miembro del equipo.
- Patrón que usan los formularios para guardar: server actions o rutas de API, validación y librería de validación.

## 5. Telegram, notificaciones y offline

- Archivos del bot de Telegram y lista de comandos que existen ahora.
- Cómo se envían notificaciones internas, push y por Telegram a seguidores.
- Qué datos guardan los snapshots offline de la PWA y dónde se generan.

## 6. Convenciones

- Estructura de carpetas real de `src/` (dos niveles).
- Componentes de UI reutilizables más usados (tarjetas, formularios, interruptores, diálogos).
- Cómo se formatean precios y monedas en la UI (helper y archivo).
- Cualquier deuda técnica o incoherencia que veas y que convenga saber antes de añadir funciones.

## 7. Sistema de diseño

- Tokens reales: colores, tipografías, tamaños, radios, sombras y espaciados que se usan en `tailwind.config` y en los estilos globales. Copia los valores.
- Cómo está construido el panel del negocio a nivel visual: estructura de página, cabeceras, tarjetas de ajustes, formularios, estados vacíos, candados de plan y avisos.
- Cómo se ven el catálogo público y la ficha: jerarquía de nombre, precio, etiquetas y botones.
- Patrones de interacción que se repiten: guardado (automático o con botón), confirmaciones, toasts con `sonner` o `sileo`, diálogos, hojas inferiores en móvil.
- Uso de modo oscuro, si existe.
- Incoherencias visuales que veas entre secciones.

Para esta parte, si están instaladas, apóyate en las skills `ui-ux-pro-max`, `impeccable` y `design-taste-frontend` para describir el sistema de diseño y detectar problemas. Recuerda que en este paso no modificas nada.

Termina con un resumen de 10 líneas máximo de lo más importante para añadir funcionalidades nuevas sin romper nada.
