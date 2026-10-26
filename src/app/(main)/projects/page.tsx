import { ProjectManagementPanel } from "@/components/profile/project-management-panel";

/* La sesión no se comprueba aquí. `/projects` está en `PROTECTED_PREFIXES`, así
   que el proxy corta antes de renderizar, y los datos los defiende
   `/api/project-requests` con su propio `getAppUser`. Volver a preguntarlo en la
   página costaba una consulta a Neon por entrada y la convertía en dinámica:
   Next no precarga rutas dinámicas, así que la primera visita esperaba al
   servidor con la pantalla quieta. Sin esa espera la ruta es estática y se
   precarga entera. */
export default function ProjectsPage() {
  return <ProjectManagementPanel />;
}