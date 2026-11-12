"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { confirmPhoto, deletePhoto, requestPhotoUpload } from "../../actions";

type Photo = { key: string; url: string };

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

export default function Photos({ bookId, title, photos }: { bookId: string; title: string; photos: Photo[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);

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

  // Si se quita una foto, el índice abierto puede quedar fuera de rango.
  useEffect(() => {
    if (open !== null && open >= photos.length) setOpen(photos.length ? photos.length - 1 : null);
  }, [open, photos.length]);

  return (
    <section>
      <h3>Fotos{photos.length > 0 && <span className="count"> · {photos.length}</span>}</h3>
      {photos.length > 0 && (
        <ul className="photos">
          {photos.map((p, i) => (
            <li key={p.key}>
              <button type="button" className="thumb" onClick={() => setOpen(i)} aria-label={`Ver foto ${i + 1} de ${photos.length}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" loading="lazy" />
              </button>
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
      {open !== null && photos[open] && (
        <Lightbox bookId={bookId} title={title} photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}

function Lightbox({ bookId, title, photos, index, onIndex, onClose }: {
  bookId: string; title: string; photos: Photo[]; index: number;
  onIndex: (i: number) => void; onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const n = photos.length;
  const photo = photos[index];

  const go = useCallback((d: number) => { setConfirming(false); onIndex((index + d + n) % n); }, [index, n, onIndex]);

  useEffect(() => setLoaded(false), [photo.key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (confirming) setConfirming(false); else onClose(); }
      else if (e.key === "ArrowRight" && !confirming) go(1);
      else if (e.key === "ArrowLeft" && !confirming) go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, confirming]);

  // Bloquea el scroll de la página y devuelve el foco al cerrar.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    return () => { document.body.style.overflow = overflow; prev?.focus(); };
  }, []);

  useEffect(() => {
    strip.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index]);

  // Precarga las vecinas para que pasar de foto sea instantáneo.
  useEffect(() => {
    if (n < 2) return;
    for (const d of [1, -1]) new Image().src = photos[(index + d + n) % n].url;
  }, [index, n, photos]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Fotos de ${title}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lb-bar">
        <span className="lb-count">{index + 1} / {n}</span>
        <div className="lb-tools">
          <a href={photo.url} target="_blank" rel="noopener noreferrer" className="lb-btn" aria-label="Abrir original">↗</a>
          <button type="button" className="lb-btn danger" onClick={() => setConfirming(true)} aria-label="Quitar foto">🗑</button>
          <button ref={closeBtn} type="button" className="lb-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
      </div>

      <div className="lb-stage"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          const t = touch.current; touch.current = null;
          if (!t || confirming) return;
          const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
          else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
        }}>
        {n > 1 && <button type="button" className="lb-nav prev" onClick={() => go(-1)} aria-label="Anterior">‹</button>}
        {!loaded && <div className="lb-spinner" aria-hidden />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={photo.key} src={photo.url} alt={`Foto ${index + 1} de ${title}`} className={loaded ? "in" : ""} onLoad={() => setLoaded(true)} />
        {n > 1 && <button type="button" className="lb-nav next" onClick={() => go(1)} aria-label="Siguiente">›</button>}
      </div>

      {confirming && (
        <form action={deletePhoto} className="lb-confirm" role="alertdialog" aria-label="Confirmar">
          <input type="hidden" name="id" value={bookId} />
          <input type="hidden" name="key" value={photo.key} />
          <p>¿Quitar esta foto? No se puede deshacer.</p>
          <div className="actions">
            <button type="button" autoFocus onClick={() => setConfirming(false)}>Cancelar</button>
            <RemoveButton />
          </div>
        </form>
      )}

      {n > 1 && (
        <div className="lb-strip" ref={strip}>
          {photos.map((p, i) => (
            <button key={p.key} data-i={i} type="button" className={i === index ? "on" : ""}
              onClick={() => { setConfirming(false); onIndex(i); }} aria-label={`Foto ${i + 1}`} aria-current={i === index}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn danger-fill" disabled={pending}>{pending ? "Quitando…" : "Sí, quitar"}</button>;
}
