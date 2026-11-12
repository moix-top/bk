// Persistencia de libros. Todas las funciones reciben el userId de la sesión
// (lib/auth.ts) y solo tocan su partición.

import { randomUUID } from "node:crypto";
import { bookSk, getStore, userPk } from "@/lib/dynamo";
import { httpError } from "@/lib/http";
import { deleteObject, photoPrefix } from "@/lib/photos";
import type { Book, BookInput } from "@/lib/types";

const LIMITS: Record<keyof BookInput, number> = {
  title: 300,
  author: 200,
  repo: 500,
  publishedYear: 5,
  originalPublisher: 200,
  editionPublisher: 200,
  editionYear: 5,
  startedAt: 10,
  finishedAt: 10,
  summary: 20000,
  highlights: 20000,
  takeaways: 20000,
};

export function parseBookInput(raw: Record<string, unknown>): BookInput {
  const out = {} as BookInput;
  for (const key of Object.keys(LIMITS) as (keyof BookInput)[]) {
    const v = typeof raw[key] === "string" ? (raw[key] as string).trim() : "";
    if (v.length > LIMITS[key]) throw httpError(400, `El campo ${key} es demasiado largo`);
    out[key] = v;
  }
  if (!out.title) throw httpError(400, "El título es obligatorio");
  if (out.repo && !/^https?:\/\//i.test(out.repo)) out.repo = `https://${out.repo}`;
  if (out.repo) {
    try {
      const u = new URL(out.repo);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    } catch {
      throw httpError(400, "El repo no es una URL válida");
    }
  }
  if (out.publishedYear && !/^-?\d{1,4}$/.test(out.publishedYear)) throw httpError(400, "Año de publicación no válido");
  if (out.editionYear && !/^\d{1,4}$/.test(out.editionYear)) throw httpError(400, "Año de la edición no válido");
  for (const k of ["startedAt", "finishedAt"] as const) {
    if (out[k] && !/^\d{4}-\d{2}-\d{2}$/.test(out[k])) throw httpError(400, "Fecha no válida");
  }
  if (out.startedAt && out.finishedAt && out.startedAt > out.finishedAt) {
    throw httpError(400, "La fecha de comienzo es posterior a la de fin");
  }
  return out;
}

function toBook(item: Record<string, unknown>): Book {
  const { pk: _pk, sk: _sk, ...rest } = item;
  return { startedAt: "", publishedYear: "", originalPublisher: "", editionPublisher: "", editionYear: "", photos: [], ...rest } as unknown as Book;
}

export async function listBooks(userId: string): Promise<Book[]> {
  const items = await getStore().query(userPk(userId), "BOOK#");
  return items
    .map(toBook)
    .sort((a, b) => (b.finishedAt || b.createdAt).localeCompare(a.finishedAt || a.createdAt));
}

export async function getBook(userId: string, id: string): Promise<Book | null> {
  const item = await getStore().get(userPk(userId), bookSk(id));
  return item ? toBook(item) : null;
}

export async function createBook(userId: string, input: BookInput): Promise<Book> {
  const now = new Date().toISOString();
  const book: Book = { ...input, id: randomUUID(), photos: [], createdAt: now, updatedAt: now };
  await getStore().put({ pk: userPk(userId), sk: bookSk(book.id), ...book });
  return book;
}

export async function updateBook(userId: string, id: string, input: BookInput): Promise<Book> {
  const prev = await getBook(userId, id);
  if (!prev) throw httpError(404, "Libro no encontrado");
  const book: Book = { ...prev, ...input, updatedAt: new Date().toISOString() };
  await getStore().put({ pk: userPk(userId), sk: bookSk(id), ...book });
  return book;
}

export async function deleteBook(userId: string, id: string): Promise<void> {
  const prev = await getBook(userId, id);
  await getStore().delete(userPk(userId), bookSk(id));
  if (prev?.photos.length) await Promise.all(prev.photos.map(deleteObject));
}

export const MAX_PHOTOS = 20;

/** Registra una foto ya subida a S3. La clave debe pertenecer a este usuario y libro. */
export async function addPhoto(userId: string, id: string, key: string): Promise<Book> {
  const prev = await getBook(userId, id);
  if (!prev) throw httpError(404, "Libro no encontrado");
  if (!key.startsWith(photoPrefix(userId, id))) throw httpError(400, "Foto no válida");
  if (prev.photos.includes(key)) return prev;
  if (prev.photos.length >= MAX_PHOTOS) throw httpError(400, `Máximo ${MAX_PHOTOS} fotos por libro`);
  const book: Book = { ...prev, photos: [...prev.photos, key], updatedAt: new Date().toISOString() };
  await getStore().put({ pk: userPk(userId), sk: bookSk(id), ...book });
  return book;
}

export async function removePhoto(userId: string, id: string, key: string): Promise<void> {
  const prev = await getBook(userId, id);
  if (!prev || !prev.photos.includes(key)) throw httpError(404, "Foto no encontrada");
  const book: Book = { ...prev, photos: prev.photos.filter((k) => k !== key), updatedAt: new Date().toISOString() };
  await getStore().put({ pk: userPk(userId), sk: bookSk(id), ...book });
  await deleteObject(key);
}
