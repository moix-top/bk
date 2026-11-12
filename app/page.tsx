import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listBooks } from "@/lib/services/bookService";
import { photoUrl, photosEnabled } from "@/lib/photos";
import Header from "./Header";

export default async function Home({ searchParams }: { searchParams: { q?: string; orden?: string } }) {
  const { userId } = await requireSession();
  const all = await listBooks(userId);
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const books = q
    ? all.filter((b) => [b.title, b.originalTitle, b.author, b.summary, b.highlights, b.takeaways].join(" ").toLowerCase().includes(q))
    : all;
  // listBooks ya viene del más reciente al más antiguo (por fecha de fin).
  const oldest = searchParams.orden === "antiguo";
  if (oldest) books.reverse();
  const sortHref = (orden: string) => {
    const p = new URLSearchParams();
    if (searchParams.q) p.set("q", searchParams.q);
    if (orden === "antiguo") p.set("orden", orden);
    const qs = p.toString();
    return qs ? `/?${qs}` : "/";
  };
  const covers = photosEnabled()
    ? await Promise.all(books.map((b) => (b.photos[0] ? photoUrl(b.photos[0]) : Promise.resolve(""))))
    : books.map(() => "");

  return (
    <main className="shell">
      <Header />
      <div className="bar-row">
        <form className="search">
          <input name="q" type="search" placeholder="Buscar por título, autor o idea…" defaultValue={searchParams.q} />
          {oldest && <input type="hidden" name="orden" value="antiguo" />}
        </form>
        <Link href="/libro/nuevo" className="btn">+ Libro</Link>
      </div>
      <p className="muted">{all.length} {all.length === 1 ? "libro leído" : "libros leídos"}{q && ` · ${books.length} encontrados`}</p>
      {all.length > 1 && (
        <nav className="sort" aria-label="Ordenar por fecha de lectura">
          <span className="muted">Leído:</span>
          <Link href={sortHref("reciente")} className={oldest ? "" : "on"} aria-current={!oldest || undefined}>Más reciente</Link>
          <Link href={sortHref("antiguo")} className={oldest ? "on" : ""} aria-current={oldest || undefined}>Más antiguo</Link>
        </nav>
      )}
      {all.length === 0 && <p className="empty">Aún no hay nada. Añade el primer libro que hayas leído.</p>}
      <ul className="grid">
        {books.map((b, i) => (
          <li key={b.id}>
            <Link href={`/libro/${b.id}`} className="card book-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {covers[i] && <img src={covers[i]} alt="" className="cover" loading="lazy" />}
              <span className="card-body">
                <span className="title">{b.title}</span>
                {b.originalTitle && b.originalTitle !== b.title && <span className="sub"><em>{b.originalTitle}</em></span>}
                {b.author && <span className="sub">{b.author}</span>}
                {b.summary && <span className="excerpt">{plain(b.summary)}</span>}
                {b.finishedAt && <span className="sub date">{fmt(b.finishedAt)}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

const fmt = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });

// Extracto de la tarjeta: sin sintaxis Markdown.
const plain = (md: string) =>
  md
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*([-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`>~]/g, "");
