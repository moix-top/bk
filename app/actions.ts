"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createBook, deleteBook, parseBookInput, updateBook } from "@/lib/services/bookService";
import { HttpError } from "@/lib/http";

export interface FormState { error?: string }

const fromForm = (f: FormData) => parseBookInput(Object.fromEntries(f.entries()));

export async function saveBook(_prev: FormState, form: FormData): Promise<FormState> {
  const { userId } = await requireSession();
  const id = String(form.get("id") ?? "");
  let target: string;
  try {
    const input = fromForm(form);
    target = id ? (await updateBook(userId, id, input)).id : (await createBook(userId, input)).id;
  } catch (e) {
    return { error: e instanceof HttpError ? e.message : "No se pudo guardar" };
  }
  revalidatePath("/");
  redirect(`/libro/${target}`);
}

export async function removeBook(form: FormData): Promise<void> {
  const { userId } = await requireSession();
  await deleteBook(userId, String(form.get("id")));
  revalidatePath("/");
  redirect("/");
}

export async function requestPhotoUpload(bookId: string, type: string, size: number): Promise<{ key: string; url: string } | { error: string }> {
  const { userId } = await requireSession();
  const { getBook, MAX_PHOTOS } = await import("@/lib/services/bookService");
  const { presignUpload } = await import("@/lib/photos");
  const b = await getBook(userId, bookId);
  if (!b) return { error: "Libro no encontrado" };
  if (b.photos.length >= MAX_PHOTOS) return { error: `Máximo ${MAX_PHOTOS} fotos por libro` };
  try {
    return await presignUpload(userId, bookId, type, size);
  } catch (e) {
    return { error: e instanceof HttpError ? e.message : "No se pudo preparar la subida" };
  }
}

export async function confirmPhoto(bookId: string, key: string): Promise<{ error?: string }> {
  const { userId } = await requireSession();
  const { addPhoto } = await import("@/lib/services/bookService");
  try {
    await addPhoto(userId, bookId, key);
  } catch (e) {
    return { error: e instanceof HttpError ? e.message : "No se pudo guardar la foto" };
  }
  revalidatePath(`/libro/${bookId}`);
  return {};
}

export async function deletePhoto(form: FormData): Promise<void> {
  const { userId } = await requireSession();
  const { removePhoto } = await import("@/lib/services/bookService");
  const id = String(form.get("id"));
  await removePhoto(userId, id, String(form.get("key")));
  revalidatePath(`/libro/${id}`);
}

export interface TokenState { token?: string; name?: string; error?: string }

export async function newToken(_prev: TokenState, form: FormData): Promise<TokenState> {
  const { userId } = await requireSession();
  const { createToken } = await import("@/lib/services/tokenService");
  const { token, info } = await createToken(userId, String(form.get("name") ?? ""));
  revalidatePath("/ajustes");
  return { token, name: info.name };
}

export async function deleteToken(form: FormData): Promise<void> {
  const { userId } = await requireSession();
  const { revokeToken } = await import("@/lib/services/tokenService");
  await revokeToken(userId, String(form.get("hash")));
  revalidatePath("/ajustes");
}
