"use client";

import { useState } from "react";
import { removeBook } from "../../actions";

/** Borrar exige un segundo clic explícito, con el título del libro a la vista. */
export default function DeleteBook({ id, title }: { id: string; title: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return <button type="button" className="danger" onClick={() => setAsking(true)}>Borrar</button>;
  }
  return (
    <form action={removeBook} className="confirm" role="alertdialog" aria-label="Confirmar borrado">
      <input type="hidden" name="id" value={id} />
      <p>¿Borrar «{title}» con todas sus notas y fotos? No se puede deshacer.</p>
      <div className="actions">
        <button type="button" className="btn" autoFocus onClick={() => setAsking(false)}>Cancelar</button>
        <button type="submit" className="danger">Sí, borrar</button>
      </div>
    </form>
  );
}
