// Fotos de los libros en S3 (bucket privado del stack bk-data).
//
//   u/<sha256(email)[:32]>/<bookId>/<uuid>.<ext>
//
// El email no aparece en la clave. El navegador sube con un PUT prefirmado
// (sin pasar por Vercel) y las fotos se muestran con GET prefirmados de corta
// duración. El libro guarda la lista de claves; el servidor solo acepta claves
// bajo el prefijo del usuario y libro de la sesión.

import { createHash, randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { REGION } from "@/lib/dynamo";
import { httpError } from "@/lib/http";

export const BUCKET = process.env.S3_BUCKET || "";
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

export const photosEnabled = (): boolean => Boolean(BUCKET);

export const photoPrefix = (userId: string, bookId: string): string =>
  `u/${createHash("sha256").update(userId).digest("hex").slice(0, 32)}/${bookId}/`;

let client: S3Client | undefined;
const s3 = () => (client ??= new S3Client({ region: REGION }));

export async function presignUpload(userId: string, bookId: string, type: string, size: number) {
  if (!BUCKET) throw httpError(503, "Las fotos no están configuradas");
  const ext = TYPES[type];
  if (!ext) throw httpError(400, "Formato no admitido (usa WebP, JPEG o PNG)");
  if (!Number.isInteger(size) || size <= 0 || size > MAX_PHOTO_BYTES) throw httpError(400, "La foto es demasiado grande");
  const key = `${photoPrefix(userId, bookId)}${randomUUID()}.${ext}`;
  const url = await getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: type, ContentLength: size }),
    { expiresIn: 300 },
  );
  return { key, url };
}

export async function photoUrl(key: string): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 3600 });
}

export async function deleteObject(key: string): Promise<void> {
  if (!BUCKET) return;
  await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
