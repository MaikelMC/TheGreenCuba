import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { CATALOG_TAG } from "@/lib/db/queries";
import { projectRequests } from "@/lib/db/schema";
import { EXTENSION, MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/storage/image";
import { S3_BUCKET, S3_PUBLIC_URL, s3Client, s3ConfigProblem } from "@/lib/storage/s3";
import { generateId } from "@/lib/utils";
import { revalidateTag } from "next/cache";

type Params = { params: Promise<{ id: string }> };
const MAX_IMAGES = 8;

function publicUrl(key: string): string {
  return `${S3_PUBLIC_URL}/${key}`;
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
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "La imagen es demasiado grande." }, { status: 413 });
  }
  if (project.imageUrls.length >= MAX_IMAGES) {
    return NextResponse.json({ error: `Cada proyecto admite hasta ${MAX_IMAGES} fotos.` }, { status: 409 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffImageType(bytes);
  if (!contentType) {
    return NextResponse.json({ error: "El archivo no es una imagen JPEG, PNG o WebP." }, { status: 415 });
  }

  const key = `projects/${project.id}/${generateId()}.${EXTENSION[contentType]}`;
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: bytes,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));

  const imageUrls = [...project.imageUrls, publicUrl(key)];
  const [updated] = await db.update(projectRequests).set({
    imageUrls,
    ...(project.status === "pending" ? {} : { status: "pending" }),
    adminNote: null,
    updatedAt: new Date(),
  }).where(eq(projectRequests.id, project.id)).returning();

  revalidateTag(CATALOG_TAG, "max");
  return NextResponse.json({ imageUrls: updated!.imageUrls, status: updated!.status }, { status: 201 });
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
  if (!project.imageUrls.includes(imageUrl)) return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });

  const imageUrls = project.imageUrls.filter((url) => url !== imageUrl);
  const [updated] = await db.update(projectRequests).set({
    imageUrls,
    ...(project.status === "pending" ? {} : { status: "pending" }),
    adminNote: null,
    updatedAt: new Date(),
  }).where(eq(projectRequests.id, project.id)).returning();

  const prefix = `${S3_PUBLIC_URL}/projects/${project.id}/`;
  if (S3_PUBLIC_URL && imageUrl.startsWith(prefix)) {
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: imageUrl.slice(`${S3_PUBLIC_URL}/`.length),
      }));
    } catch (error) {
      console.error("No se pudo borrar una foto del proyecto del bucket:", error);
    }
  }

  revalidateTag(CATALOG_TAG, "max");
  return NextResponse.json({ imageUrls: updated!.imageUrls, status: updated!.status });
}