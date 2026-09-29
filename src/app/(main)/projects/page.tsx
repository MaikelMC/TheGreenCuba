import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth/user";
import { ProjectManagementPanel } from "@/components/profile/project-management-panel";

export default async function ProjectsPage() {
  const user = await getAppUser();
  if (!user) redirect("/login?next=/projects");
  return <ProjectManagementPanel />;
}