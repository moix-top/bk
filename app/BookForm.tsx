"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { saveBook, type FormState } from "./actions";
import type { Book } from "@/lib/types";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>;
}

export default function BookForm({ book }: { book?: Book }) {
  const [state, action] = useFormState<FormState, FormData>(saveBook, {});
  return (
    <form action={action} className="form">
      {book && <input type="hidden" name="id" value={book.id} />}
      <label>Título<input name="title" required defaultValue={book?.title} autoFocus={!book} /></label>
      <div className="two">
        <label>Autor<input name="author" defaultValue={book?.author} /></label>
        <label>Año de publicación<input name="publishedYear" inputMode="numeric" placeholder="1943" maxLength={5} defaultValue={book?.publishedYear} /></label>
      </div>
      <label>Editorial original<input name="originalPublisher" placeholder="Reynal & Hitchcock" defaultValue={book?.originalPublisher} /></label>
      <div className="two">
        <label>Editorial de mi edición<input name="editionPublisher" placeholder="Ediciones Salamandra" defaultValue={book?.editionPublisher} /></label>
        <label>Año de mi edición<input name="editionYear" inputMode="numeric" placeholder="2018" maxLength={4} defaultValue={book?.editionYear} /></label>
      </div>
      <div className="two">
        <label>Empezado el<input type="date" name="startedAt" defaultValue={book?.startedAt} /></label>
        <label>Terminado el<input type="date" name="finishedAt" defaultValue={book?.finishedAt} /></label>
      </div>
      <label>Repo de git<input name="repo" type="text" inputMode="url" placeholder="https://github.com/usuario/libro" defaultValue={book?.repo} /></label>
      <label>Resumen breve <span className="hint">de qué iba · admite Markdown</span><textarea name="summary" rows={5} defaultValue={book?.summary} /></label>
      <label>Lo más importante<textarea name="highlights" rows={5} defaultValue={book?.highlights} /></label>
      <label>Lo que me aportó<textarea name="takeaways" rows={5} defaultValue={book?.takeaways} /></label>
      {state.error && <p className="error">{state.error}</p>}
      <div className="actions">
        <Submit />
        {/* Cancelar no guarda nada: vuelve a la ficha (o al inicio si es nuevo). */}
        <Link href={book ? `/libro/${book.id}` : "/"} className="btn secondary">Cancelar</Link>
      </div>
    </form>
  );
}
