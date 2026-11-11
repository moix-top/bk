"use client";

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
        <label>Terminado el<input type="date" name="finishedAt" defaultValue={book?.finishedAt} /></label>
      </div>
      <label>Repo de git<input name="repo" type="text" inputMode="url" placeholder="https://github.com/usuario/libro" defaultValue={book?.repo} /></label>
      <label>Resumen breve <span className="hint">de qué iba</span><textarea name="summary" rows={5} defaultValue={book?.summary} /></label>
      <label>Lo más importante<textarea name="highlights" rows={5} defaultValue={book?.highlights} /></label>
      <label>Lo que me aportó<textarea name="takeaways" rows={5} defaultValue={book?.takeaways} /></label>
      {state.error && <p className="error">{state.error}</p>}
      <div className="actions"><Submit /></div>
    </form>
  );
}
