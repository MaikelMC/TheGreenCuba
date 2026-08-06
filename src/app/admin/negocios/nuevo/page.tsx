"use client";

import { useRouter } from "next/navigation";
import { BusinessForm } from "@/components/admin/business-form";

export default function NuevoNegocioPage() {
  const router = useRouter();
  return <BusinessForm onDone={() => router.push("/admin/negocios")} />;
}
