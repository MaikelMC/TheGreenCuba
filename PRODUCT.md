# Product

## Register

product

## Users

Dueños de negocios pequeños en Cuba: cafeterías, restaurantes, bares,
discotecas, mercados, casas de renta. Muchos son negocios privados de una o dos
personas, sin equipo de marketing y sin web propia. Entran al panel desde el
móvil, casi siempre con datos móviles caros y a veces sin WiFi, muchas noches
con el servicio eléctrico inestable. Hablan español y no manejan vocabulario
técnico.

El trabajo que vienen a hacer es corto y concreto: rellenar su ficha para que
los encuentren, publicar la carta o los precios, y saber si alguien los está
mirando. No vienen a "gestionar su presencia digital". Vienen a resolver una
tarea de dos minutos antes de volver al mostrador.

## Product Purpose

La Verde es el mapa de lugares de Cuba. La gente busca con sus propias palabras
—«un café tranquilo cerca de mi»— y la IA entiende la frase y recomienda. Para
que eso funcione hace falta que los negocios estén dentro y estén al día.

El panel del negocio existe para eso: es la puerta por la que un dueño crea su
ficha, la mantiene viva y ve qué está pasando con ella. Tiene que caber en un
móvil, en una conexión mala, y en la cabeza de alguien que no ha usado nunca
una herramienta de este tipo.

El éxito no es que el dueño pase tiempo en el panel. Es que salga rápido y su
ficha quede correcta.

## Brand Personality

Premium pero accesible. Local y auténtico, no corporativo.

La voz es la de alguien del barrio que sabe del tema y no te hace sentir tonto:
directa, cálida, sin jerga de marketing ni de ingeniería. Explica lo que hace
falta y calla el resto. Nunca vende de más ni promete lo que el producto no
hace.

Tres palabras: **directa, cálida, honesta**.

## Anti-references

- **El SaaS genérico.** Dashboards con cifras que van en un cuadrado blanco con
  una flechita de tendencia, gráficos de líneas sin datos detrás, y un
  "Welcome back, John" que nadie pidió. Aquí las métricas se enseñan cuando
  existen y se callan cuando no.
- **El corporativo frío.** Grises, azules marinos, Inter a todas las tallas y
  un tono neutro de manual. La Verde es verde y cálida a propósito.
- **Los paneles que se explican a sí mismos.** Tarjetas que empiezan con un
  párrafo sobre por qué existe la función, antes de enseñar el control. El
  dueño ya está dentro; no hay que convencerlo de nada.
- **La app diseñada para escritorio y encogida al móvil.** Si un formulario no
  cabe y hay que bajar cuatro pantallas para llegar al botón de guardar, no
  está hecho.

## Design Principles

1. **Peso bajo, siempre.** Cada kilobyte se paga en datos móviles de alguien.
   Menos texto, menos imagen, menos consulta. Si algo se puede decir en una
   línea, no se dicen tres.
2. **El control primero, la explicación si acaso.** La acción y su nombre van
   arriba. La prosa que la justifica no es bienvenida por defecto.
3. **Nada inventado.** Una cifra que no se puede comprobar no se enseña. El
   panel llegó a tener un "342 visitas, +18%" escrito a mano; hoy no hay
   ninguna métrica que no salga de la base.
4. **Una pantalla, una tarea.** El dueño entra a hacer una cosa. Lo demás se
   pliega o se va a otra sección.
5. **Se respeta lo que ya existe.** El design system está hecho y es bueno
   (tokens en OKLCH, sombras teñidas de tinta, `ease-outquint`). Se reusa; no
   se reinventa ni se añade una variante nueva por comodidad.

## Accessibility & Inclusion

- **Contraste:** texto primario ≥7:1, secundario ≥4.5:1, acento sobre blanco
  ≥4.5:1 (ver DESIGN.md §7).
- **Móvil primero de verdad:** texto ≥16px en campos para que iOS no haga zoom,
  cero scroll horizontal entre 320px y 430px, safe areas respetadas.
- **Touch targets:** 44×44px mínimo, 8px de separación entre ellos.
- **Red:** la conexión es mala por defecto. Los estados de carga son skeletons
  sin salto de maquetación, y un fallo de red dice qué no se guardó en vez de
  fingir que sí.
- **Movimiento:** toda animación respeta `prefers-reduced-motion`.
- El contenido nunca queda oculto esperando una animación: la transición
  mejora algo que ya se ve.
