"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmPhoto, deletePhoto, requestPhotoUpload } from "../../actions";

/** Reduce a 1600 px de lado mayor y recodifica en WebP (quita también el EXIF/GPS). */
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.82));
  if (!blob) throw new Error("No se pudo procesar la imagen");
  return blob;
}

export default function Photos({ bookId, photos }: { bookId: string; photos: { key: string; url: string }[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function upload(files: FileList) {
    setError("");
    try {
      for (const [i, file] of [...files].entries()) {
        setBusy(`Subiendo ${i + 1} de ${files.length}…`);
        const blob = await shrink(file);
        const r = await requestPhotoUpload(bookId, blob.type, blob.size);
        if ("error" in r) throw new Error(r.error);
        const put = await fetch(r.url, { method: "PUT", body: blob, headers: { "Content-Type": blob.type } });
        if (!put.ok) throw new Error("Falló la subida a S3");
        const c = await confirmPhoto(bookId, r.key);
        if (c.error) throw new Error(c.error);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setBusy("");
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section>
      <h3>Fotos</h3>
      {photos.length > 0 && (
        <ul className="photos">
          {photos.map((p) => (
            <li key={p.key}>
              <a href={p.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="Foto del libro" loading="lazy" />
              </a>
              <form action={deletePhoto}>
                <input type="hidden" name="id" value={bookId} />
                <input type="hidden" name="key" value={p.key} />
                <button type="submit" className="danger" aria-label="Quitar foto">Quitar</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <label className="btn upload">
        {busy || "Añadir fotos"}
        <input ref={input} type="file" accept="image/*" multiple hidden disabled={!!busy}
          onChange={(e) => e.target.files?.length && upload(e.target.files)} />
      </label>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
