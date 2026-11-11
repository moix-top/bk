// Persistencia de libros. Todas las funciones reciben el userId de la sesión
// (lib/auth.ts) y solo tocan su partición.

import { randomUUID } from "node:crypto";
import { bookSk, getStore, userPk } from "@/lib/dynamo";
import { httpError } from "@/lib/http";
import type { Book, BookInput } from "@/lib/types";

const LIMITS: Record<keyof BookInput, number> = {
  title: 300,
  author: 200,
  repo: 500,
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
  if (out.finishedAt && !/^\d{4}-\d{2}-\d{2}$/.test(out.finishedAt)) throw httpError(400, "Fecha no válida");
  return out;
}

function toBook(item: Record<string, unknown>): Book {
  const { pk: _pk, sk: _sk, ...rest } = item;
  return rest as unknown as Book;
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
  const book: Book = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
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
  await getStore().delete(userPk(userId), bookSk(id));
}
