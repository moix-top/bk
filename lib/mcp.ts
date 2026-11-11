// Servidor MCP mínimo (JSON-RPC 2.0 sobre Streamable HTTP, sin estado y sin
// SSE: cada POST lleva su respuesta en JSON). Puro: recibe el userId ya
// resuelto por la ruta, así se puede testear sin red.

import { createBook, deleteBook, getBook, listBooks, parseBookInput, updateBook } from "@/lib/services/bookService";
import { HttpError } from "@/lib/http";
import type { Book } from "@/lib/types";

export const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "bk", title: "bk · libros leídos", version: "1.0.0" };

const INSTRUCTIONS = `bk es el registro personal de libros leídos del usuario. Cada libro tiene: título, autor, repo de git con sus apuntes, fecha en que lo terminó, un resumen breve (de qué iba), lo más importante del libro y lo que le aportó personalmente.
- Antes de añadir un libro, busca con search_books para no duplicarlo.
- Escribe en español, con tildes, tono cercano. "takeaways" (lo que me aportó) va en primera persona: es la voz del usuario, no la tuya; si no te lo ha contado, pregúntaselo en lugar de inventarlo.
- Si el usuario tiene un repo de apuntes del libro, úsalo como fuente para resumir.`;

const bookFields = {
  title: { type: "string", description: "Título del libro" },
  author: { type: "string", description: "Autor o autores" },
  repo: { type: "string", description: "URL del repo de git con los apuntes del libro" },
  finishedAt: { type: "string", description: "Fecha en que lo terminó, YYYY-MM-DD" },
  summary: { type: "string", description: "Resumen breve: de qué iba el libro" },
  highlights: { type: "string", description: "Lo más importante del libro (ideas clave, moraleja)" },
  takeaways: { type: "string", description: "Lo que le aportó al usuario, en primera persona" },
};

const bookOutput = {
  type: "object",
  properties: { id: { type: "string" }, ...bookFields, createdAt: { type: "string" }, updatedAt: { type: "string" } },
};

export const TOOLS = [
  {
    name: "list_books",
    title: "Listar libros",
    description: "Lista todos los libros leídos (id, título, autor, fecha y resumen), del más reciente al más antiguo.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "search_books",
    title: "Buscar libros",
    description: "Busca libros por texto en título, autor, resumen, lo más importante y lo que me aportó. Sin acentos ni mayúsculas.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "Texto a buscar" } }, required: ["query"] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_book",
    title: "Ver libro",
    description: "Devuelve la ficha completa de un libro por id.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    outputSchema: bookOutput,
    annotations: { readOnlyHint: true },
  },
  {
    name: "add_book",
    title: "Añadir libro",
    description: "Añade un libro leído. Solo el título es obligatorio.",
    inputSchema: { type: "object", properties: bookFields, required: ["title"] },
    outputSchema: bookOutput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: "update_book",
    title: "Editar libro",
    description: "Modifica un libro. Solo cambia los campos que pases; el resto se queda igual. Pasa \"\" para vaciar un campo.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, ...bookFields }, required: ["id"] },
    outputSchema: bookOutput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "delete_book",
    title: "Borrar libro",
    description: "Borra un libro para siempre. Confírmalo con el usuario antes.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
];

interface RpcRequest { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const brief = (b: Book) => ({ id: b.id, title: b.title, author: b.author, finishedAt: b.finishedAt, summary: b.summary.slice(0, 280) });

function asMarkdown(b: Book): string {
  const lines = [`# ${b.title}`, [b.author, b.finishedAt && `terminado el ${b.finishedAt}`].filter(Boolean).join(" · ")];
  if (b.repo) lines.push(`Repo: ${b.repo}`);
  if (b.summary) lines.push(`\n## De qué iba\n${b.summary}`);
  if (b.highlights) lines.push(`\n## Lo más importante\n${b.highlights}`);
  if (b.takeaways) lines.push(`\n## Lo que me aportó\n${b.takeaways}`);
  lines.push(`\n(id: ${b.id})`);
  return lines.join("\n");
}

const text = (t: string, structured?: unknown) => ({
  content: [{ type: "text", text: t }],
  ...(structured !== undefined ? { structuredContent: structured } : {}),
});

const str = (v: unknown) => (typeof v === "string" ? v : "");

async function callTool(userId: string, name: string, args: Record<string, unknown>) {
  switch (name) {
    case "list_books": {
      const books = (await listBooks(userId)).map(brief);
      return text(books.length ? JSON.stringify(books, null, 2) : "Todavía no hay libros.", { books });
    }
    case "search_books": {
      const q = norm(str(args.query).trim());
      const books = (await listBooks(userId))
        .filter((b) => norm([b.title, b.author, b.summary, b.highlights, b.takeaways].join(" ")).includes(q))
        .map(brief);
      return text(books.length ? JSON.stringify(books, null, 2) : `Ningún libro coincide con "${args.query}".`, { books });
    }
    case "get_book": {
      const b = await getBook(userId, str(args.id));
      if (!b) return { ...text(`No existe ningún libro con id ${args.id}.`), isError: true };
      return text(asMarkdown(b), b);
    }
    case "add_book": {
      const b = await createBook(userId, parseBookInput(args));
      return text(`Añadido «${b.title}» (id: ${b.id}). https://bk.moix.top/libro/${b.id}`, b);
    }
    case "update_book": {
      const prev = await getBook(userId, str(args.id));
      if (!prev) return { ...text(`No existe ningún libro con id ${args.id}.`), isError: true };
      const merged: Record<string, unknown> = { ...prev };
      for (const k of Object.keys(bookFields)) if (typeof args[k] === "string") merged[k] = args[k];
      const b = await updateBook(userId, prev.id, parseBookInput(merged));
      return text(`Actualizado «${b.title}».`, b);
    }
    case "delete_book": {
      const b = await getBook(userId, str(args.id));
      if (!b) return { ...text(`No existe ningún libro con id ${args.id}.`), isError: true };
      await deleteBook(userId, b.id);
      return text(`Borrado «${b.title}».`);
    }
  }
  return null;
}

/** Procesa un mensaje JSON-RPC. Devuelve null para notificaciones (sin id). */
export async function handleRpc(userId: string, msg: RpcRequest): Promise<object | null> {
  const id = msg.id ?? null;
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
  if (msg.id === undefined) return null;

  switch (msg.method) {
    case "initialize": {
      const asked = str(msg.params?.protocolVersion);
      return ok({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call": {
      const name = str(msg.params?.name);
      const args = (msg.params?.arguments as Record<string, unknown>) ?? {};
      try {
        const r = await callTool(userId, name, args);
        return r ? ok(r) : fail(-32602, `Herramienta desconocida: ${name}`);
      } catch (e) {
        const m = e instanceof HttpError ? e.message : "Error interno";
        return ok({ ...text(m), isError: true });
      }
    }
    case "resources/list": {
      const books = await listBooks(userId);
      return ok({
        resources: books.map((b) => ({
          uri: `bk://libro/${b.id}`, name: b.title, title: b.title,
          description: b.author || undefined, mimeType: "text/markdown",
        })),
      });
    }
    case "resources/read": {
      const uri = str(msg.params?.uri);
      const b = uri.startsWith("bk://libro/") ? await getBook(userId, uri.slice("bk://libro/".length)) : null;
      if (!b) return fail(-32002, `Recurso no encontrado: ${uri}`);
      return ok({ contents: [{ uri, mimeType: "text/markdown", text: asMarkdown(b) }] });
    }
    default:
      return fail(-32601, `Método no soportado: ${msg.method}`);
  }
}
