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
