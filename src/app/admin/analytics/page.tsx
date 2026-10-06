import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";

/**
 * Pantalla de analítica del panel.
 *
 * El guardia de rol ya lo pone el layout de `/admin`: aquí no se vuelve a mirar
 * la sesión. Los datos los pide el componente al backend, que **sí** comprueba
 * el rol en cada llamada (`§39`: el frontend nunca decide).
 */
export default function AdminAnalyticsPage() {
  return <AnalyticsDashboard />;
}
