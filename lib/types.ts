export interface Book {
  id: string;
  title: string;
  author: string;
  /** Repo de git con los apuntes (p. ej. https://github.com/radamuz/el-principito). */
  repo: string;
  /** Año de la publicación original (p. ej. "1943"), opcional. */
  publishedYear: string;
  /** Fecha en que lo empecé (YYYY-MM-DD), opcional. */
  startedAt: string;
  /** Fecha en que lo terminé (YYYY-MM-DD), opcional. */
  finishedAt: string;
  /** Resumen breve: de qué iba. */
  summary: string;
  /** Lo más importante del libro. */
  highlights: string;
  /** Lo que me aportó a mí. */
  takeaways: string;
  createdAt: string;
  updatedAt: string;
}

export type BookInput = Pick<Book, "title" | "author" | "publishedYear" | "repo" | "startedAt" | "finishedAt" | "summary" | "highlights" | "takeaways">;
