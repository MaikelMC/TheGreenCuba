import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { CATALOG_TAG } from "@/lib/db/queries";
import { projectRequests } from "@/lib/db/schema";
import { EXTENSION, MAX_GIF_UPLOAD_BYTES, MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/storage/image";
import { MAX_PROJECT_MEDIA } from "@/lib/storage/project-media";
import { S3_BUCKET, S3_PUBLIC_URL, s3Client, s3ConfigProblem } from "@/lib/storage/s3";
import { generateId } from "@/lib/utils";
import { revalidateTag } from "next/cache";

type Params = { params: Promise<{ id: string }> };
type ImageRole = "cover" | "pin" | "gallery";

function publicUrl(key: string): string {
  return `${S3_PUBLIC_URL}/${key}`;
}

function projectImageUrls(project: typeof projectRequests.$inferSelect): string[] {
  return [...new Set([
    project.coverImageUrl,
    project.mapImageUrl,
    ...project.imageUrls,
  ].filter((url): url is string => Boolean(url)))];
}

function imageResponse(project: typeof projectRequests.$inferSelect) {
  return {
    coverImageUrl: project.coverImageUrl,
    mapImageUrl: project.mapImageUrl,
    imageUrls: project.imageUrls,
    status: project.status,
  };
}

function markForReview(project: typeof projectRequests.$inferSelect) {
  return {
    ...(project.status === "approved" || project.status === "pending" ? {} : { status: "pending" as const }),
    adminNote: null,
    updatedAt: new Date(),
  };
}

async function deleteStoredImage(projectId: string, imageUrl: string, remaining: string[]) {
  const prefix = `${S3_PUBLIC_URL}/projects/${projectId}/`;
  if (!S3_PUBLIC_URL || !imageUrl.startsWith(prefix) || remaining.includes(imageUrl)) return;
  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: imageUrl.slice(`${S3_PUBLIC_URL}/`.length),
    }));
  } catch (error) {
    console.error("No se pudo borrar un material del proyecto del bucket:", error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const [project] = await db
    .select()
    .from(projectRequests)
    .where(eq(projectRequests.id, id))
    .limit(1);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  if (project.userId !== user.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const configProblem = s3ConfigProblem();
  if (configProblem) return NextResponse.json({ error: configProblem }, { status: 500 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const file = form.get("file");
  const roleValue = form.get("role");
  const role: ImageRole = roleValue === "cover" || roleValue === "pin" ? roleValue : "gallery";
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "La imagen es demasiado grande." }, { status: 413 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffImageType(bytes);
  if (!contentType) {
    return NextResponse.json({ error: "Usa una imagen JPEG, PNG, WebP o GIF." }, { status: 415 });
  }
  if (contentType === "image/gif" && role !== "gallery") {
    return NextResponse.json({ error: "Los GIF animados solo se pueden añadir a la galería." }, { status: 415 });
  }
  if (contentType === "image/gif" && file.size > MAX_GIF_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Los GIF deben pesar como máximo 2 MB." }, { status: 413 });
  }

  const existingUrls = projectImageUrls(project);
  const replacedUrl = role === "cover" ? project.coverImageUrl : role === "pin" ? project.mapImageUrl : null;
  const otherSlotUrl = role === "cover" ? project.mapImageUrl : project.coverImageUrl;
  const replacedUrlIsUnique = Boolean(
    replacedUrl && !project.imageUrls.includes(replacedUrl) && replacedUrl !== otherSlotUrl,
  );
  if (existingUrls.length >= MAX_PROJECT_MEDIA && !replacedUrlIsUnique) {
    return NextResponse.json({ error: `Cada proyecto admite hasta ${MAX_PROJECT_MEDIA} materiales visuales.` }, { status: 409 });
  }

  const key = `projects/${project.id}/${generateId()}.${EXTENSION[contentType]}`;
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: bytes,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));

  const imageUrl = publicUrl(key);
  const imageUrls = role === "gallery" ? [...project.imageUrls, imageUrl] : project.imageUrls;
  const [updated] = await db.update(projectRequests).set({
    imageUrls,
    ...(role === "cover" ? { coverImageUrl: imageUrl } : {}),
    ...(role === "pin" ? { mapImageUrl: imageUrl } : {}),
    ...markForReview(project),
  }).where(eq(projectRequests.id, project.id)).returning();

  if (replacedUrl && replacedUrl !== imageUrl && updated) {
    await deleteStoredImage(project.id, replacedUrl, projectImageUrls(updated));
  }
  revalidateTag(CATALOG_TAG, "max");
  return NextResponse.json(imageResponse(updated!), { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const [project] = await db.select().from(projectRequests).where(eq(projectRequests.id, id)).limit(1);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  if (project.userId !== user.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { imageUrl?: unknown; role?: unknown } | null;
  if (typeof body?.imageUrl !== "string" || (body.role !== "cover" && body.role !== "pin")) {
    return NextResponse.json({ error: "Selecciona una foto y el uso que tendrá." }, { status: 400 });
  }
  const imageUrl = body.imageUrl;
  if (!projectImageUrls(project).includes(imageUrl)) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }
  if (imageUrl.toLowerCase().split("?")[0]?.endsWith(".gif")) {
    return NextResponse.json({ error: "Los GIF animados solo se pueden usar en la galería." }, { status: 415 });
  }

  const role = body.role;
  const previousUrl = role === "cover" ? project.coverImageUrl : project.mapImageUrl;
  const otherSlotUrl = role === "cover" ? project.mapImageUrl : project.coverImageUrl;
  const imageUrls = project.imageUrls.filter((url) => url !== imageUrl);
  if (previousUrl && previousUrl !== imageUrl && previousUrl !== otherSlotUrl && !imageUrls.includes(previousUrl)) {
    imageUrls.push(previousUrl);
  }
  const [updated] = await db.update(projectRequests).set({
    imageUrls,
    ...(role === "cover" ? { coverImageUrl: imageUrl } : { mapImageUrl: imageUrl }),
    ...markForReview(project),
  }).where(eq(projectRequests.id, project.id)).returning();
  if (!updated) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  revalidateTag(CATALOG_TAG, "max");
  return NextResponse.json(imageResponse(updated));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const imageUrl = req.nextUrl.searchParams.get("imageUrl");
  if (!imageUrl) return NextResponse.json({ error: "Falta imageUrl" }, { status: 400 });

  const [project] = await db
    .select()
    .from(projectRequests)
    .where(eq(projectRequests.id, id))
    .limit(1);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  if (project.userId !== user.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (!projectImageUrls(project).includes(imageUrl)) return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });

  const imageUrls = project.imageUrls.filter((url) => url !== imageUrl);
  const [updated] = await db.update(projectRequests).set({
    imageUrls,
    ...(project.coverImageUrl === imageUrl ? { coverImageUrl: null } : {}),
    ...(project.mapImageUrl === imageUrl ? { mapImageUrl: null } : {}),
    ...markForReview(project),
  }).where(eq(projectRequests.id, project.id)).returning();
  if (updated) await deleteStoredImage(project.id, imageUrl, projectImageUrls(updated));

  revalidateTag(CATALOG_TAG, "max");
  return NextResponse.json(imageResponse(updated!));
}