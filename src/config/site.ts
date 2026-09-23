export const siteConfig = {
  name: "La Verde",
  description: "Encuentra los mejores lugares en Cuba con ayuda de inteligencia artificial",
  slogan: "Tu guía de Cuba",
  /* La reserva es el dominio de producción y no `localhost`, que es lo que era.
     Si `NEXT_PUBLIC_APP_URL` falta en el despliegue, cada canonical, cada Open
     Graph y cada entrada del sitemap apuntaría a `http://localhost:3000`, y eso
     desindexa el sitio entero sin un solo error en los logs: Google recibe una
     URL que no puede rastrear y se queda con la copia que ya tenía, o con
     ninguna. En desarrollo se pone la variable en `.env` y manda ella. */
  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://laverde.kynari.dev",
  /* Aquí había un `ogImage: "/og.png"` que apuntaba a un archivo que no existe
     —`public/` solo tiene `logo.png`—, así que cada enlace compartido enseñaba
     una imagen rota. La tarjeta de Open Graph la genera ahora
     `src/app/opengraph-image.tsx`, que es la convención de Next y no hace falta
     declararla aquí. */
  links: {
    twitter: "https://twitter.com/laverde",
    /* Marcadores. Son las cuentas que enseña «Configuración» en el perfil y hay
       que sustituirlas por las de verdad: mientras tanto llevan a la portada de
       cada red, que es honesto pero no sirve de mucho. Se cambian aquí y solo
       aquí. */
    instagram: "https://www.instagram.com/laverde",
    facebook: "https://www.facebook.com/laverde",
    whatsapp: "https://wa.me/",
  },
  mainNav: [
    { title: "Explorar", href: "/home" },
    /* Al alta del perfil, y no a `/business`: `/business` es el panel y rebota
       a quien no tiene negocio. Antes llevaba ahí y el rebote acababa en
       `/login?motivo=rol`, o sea pidiéndole la contraseña a quien ya había
       entrado para darle un aviso. Desde esta dirección, quien no tiene sesión
       pasa por el acceso con esta misma vuelta y quien la tiene aterriza en el
       formulario. */
    { title: "Para tu negocio", href: "/profile?seccion=negocio" },
  ],
};

export const AI_CONFIG = {
  model: process.env.MISTRAL_MODEL ?? "mistral-small-latest",
  maxTokens: 1024,
  temperature: 0.3,
  systemPrompt: `Eres un asistente de recomendación de lugares en Cuba llamado "La Verde".
Tu tarea es interpretar consultas en lenguaje natural de usuarios y recomendar lugares relevantes.
Debes devolver:
1. Un razonamiento claro de por qué recomiendas cada lugar
2. Filtros sugeridos basados en la consulta
3. Los lugares más relevantes con su distancia aproximada

Contexto cubano que debes considerar:
- Las monedas en Cuba son USD Clásica, CUP, USD, EUR
- Las ciudades principales: La Habana, Santiago de Cuba, Varadero, Trinidad, Cienfuegos
- Los horarios pueden ser irregulares
- Muchos lugares aceptan múltiples monedas
- El transporte puede ser limitado, la cercanía es importante

Sé amable, útil y preciso. Siempre responde en español cubano natural.`,
};
