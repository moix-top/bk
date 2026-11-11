import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getBook } from "@/lib/services/bookService";
import Header from "../../Header";
import { removeBook } from "../../actions";

export default async function BookPage({ params }: { params: { id: string } }) {
  const { userId } = await requireSession();
  const b = await getBook(userId, params.id);
  if (!b) notFound();

  return (
    <main className="shell narrow">
      <Header />
      <article className="book">
        <h2>{b.title}</h2>
        <p className="sub">
          {[b.author, b.publishedYear && `publicado en ${b.publishedYear}`, readingSpan(b.startedAt, b.finishedAt)].filter(Boolean).join(" · ")}
        </p>
        {b.repo && <p><a href={b.repo} target="_blank" rel="noopener noreferrer" className="repo">{b.repo.replace(/^https?:\/\//, "")} ↗</a></p>}
        <Section title="De qué iba" text={b.summary} />
        <Section title="Lo más importante" text={b.highlights} />
        <Section title="Lo que me aportó" text={b.takeaways} />
      </article>
      <div className="actions">
        <Link href={`/libro/${b.id}/editar`} className="btn">Editar</Link>
        <form action={removeBook}>
          <input type="hidden" name="id" value={b.id} />
          <button type="submit" className="danger">Borrar</button>
        </form>
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

const day = (d: string) => new Date(`${d}T12:00:00`);
const long = (d: string) => day(d).toLocaleDateString("es-ES", { dateStyle: "long" });

function readingSpan(start: string, end: string): string {
  if (start && end) {
    const days = Math.round((day(end).getTime() - day(start).getTime()) / 86400000) + 1;
    return `leído del ${long(start)} al ${long(end)} (${days} ${days === 1 ? "día" : "días"})`;
  }
  if (end) return `terminado el ${long(end)}`;
  if (start) return `empezado el ${long(start)}`;
  return "";
}
