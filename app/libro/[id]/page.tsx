import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getBook } from "@/lib/services/bookService";
import Header from "../../Header";
import DeleteBook from "./DeleteBook";
import { photoUrl, photosEnabled } from "@/lib/photos";
import Photos from "./Photos";
import type { Book } from "@/lib/types";

export default async function BookPage({ params }: { params: { id: string } }) {
  const { userId } = await requireSession();
  const b = await getBook(userId, params.id);
  if (!b) notFound();

  return (
    <main className="shell narrow">
      <Header />
      <article className="book">
        <header className="book-head">
          <h2>{b.title}</h2>
          {b.author && <p className="byline">{b.author}</p>}
        </header>
        <Facts book={b} />
        {photosEnabled() && (
          <Photos bookId={b.id} title={b.title} photos={await Promise.all(b.photos.map(async (key) => ({ key, url: await photoUrl(key) })))} />
        )}
        <Section title="De qué iba" text={b.summary} />
        <Section title="Lo más importante" text={b.highlights} />
        <Section title="Lo que me aportó" text={b.takeaways} />
      </article>
      <div className="actions">
        <Link href={`/libro/${b.id}/editar`} className="btn">Editar</Link>
        <DeleteBook id={b.id} title={b.title} />
      </div>
    </main>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <section>
      <h3>{title}</h3>
      <div className="prose">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{ a: (p) => <a {...p} target="_blank" rel="noopener noreferrer" /> }}
        >
          {text}
        </Markdown>
      </div>
    </section>
  );
}

function Facts({ book: b }: { book: Book }) {
  const original = [b.publishedYear, b.originalPublisher].filter(Boolean);
  const edition = [b.editionPublisher, b.editionYear].filter(Boolean);
  const reading = readingSpan(b.startedAt, b.finishedAt);
  if (!original.length && !edition.length && !reading && !b.repo) return null;
  return (
    <dl className="facts">
      {original.length > 0 && (
        <div>
          <dt>Publicación original</dt>
          <dd>{b.publishedYear && <strong>{b.publishedYear}</strong>}{b.publishedYear && b.originalPublisher && " · "}{b.originalPublisher}</dd>
        </div>
      )}
      {edition.length > 0 && (
        <div>
          <dt>Mi edición</dt>
          <dd>{b.editionPublisher}{b.editionPublisher && b.editionYear && " · "}{b.editionYear && <strong>{b.editionYear}</strong>}</dd>
        </div>
      )}
      {reading && (
        <div className="wide">
          <dt>Lectura</dt>
          <dd>{reading}</dd>
        </div>
      )}
      {b.repo && (
        <div className="wide">
          <dt>Apuntes</dt>
          <dd><a href={b.repo} target="_blank" rel="noopener noreferrer" className="repo">{b.repo.replace(/^https?:\/\//, "")} ↗</a></dd>
        </div>
      )}
    </dl>
  );
}

const day = (d: string) => new Date(`${d}T12:00:00`);
const long = (d: string) => day(d).toLocaleDateString("es-ES", { dateStyle: "long" });

function readingSpan(start: string, end: string): string {
  if (start && end) {
    const days = Math.round((day(end).getTime() - day(start).getTime()) / 86400000) + 1;
    return `Del ${long(start)} al ${long(end)} · ${days} ${days === 1 ? "día" : "días"}`;
  }
  if (end) return `Terminado el ${long(end)}`;
  if (start) return `Empezado el ${long(start)} · en curso`;
  return "";
}
