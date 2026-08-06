export const siteConfig = {
  name: "La Verde",
  description: "Encuentra los mejores lugares en Cuba con ayuda de inteligencia artificial",
  slogan: "Tu guía de Cuba",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ogImage: "/og.png",
  links: {
    twitter: "https://twitter.com/laverde",
  },
  mainNav: [
    { title: "Explorar", href: "/home" },
    { title: "Para tu negocio", href: "/business" },
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
- Las monedas en Cuba son MLC, CUP, USD, EUR
- Las ciudades principales: La Habana, Santiago de Cuba, Varadero, Trinidad, Cienfuegos
- Los horarios pueden ser irregulares
- Muchos lugares aceptan múltiples monedas
- El transporte puede ser limitado, la cercanía es importante

Sé amable, útil y preciso. Siempre responde en español cubano natural.`,
};
