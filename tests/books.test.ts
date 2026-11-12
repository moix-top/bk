import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore, setStore } from "@/lib/dynamo";
import { addPhoto, createBook, deleteBook, getBook, listBooks, parseBookInput, updateBook } from "@/lib/services/bookService";
import { photoPrefix } from "@/lib/photos";

const input = (o: Record<string, string> = {}) =>
  parseBookInput({ title: "El Principito", author: "Saint-Exupéry", repo: "github.com/radamuz/el-principito", ...o });

describe("bookService", () => {
  beforeEach(() => setStore(new MemoryStore()));

  it("valida y normaliza", () => {
    expect(input().repo).toBe("https://github.com/radamuz/el-principito");
    expect(() => parseBookInput({ title: "  " })).toThrow();
    expect(() => input({ finishedAt: "ayer" })).toThrow();
    expect(() => input({ publishedYear: "mil" })).toThrow();
    expect(input({ publishedYear: "1943" }).publishedYear).toBe("1943");
    expect(input({ originalTitle: " Le Petit Prince " }).originalTitle).toBe("Le Petit Prince");
    expect(() => input({ startedAt: "2026-10-30", finishedAt: "2026-10-29" })).toThrow();
    expect(input({ startedAt: "2026-10-25", finishedAt: "2026-10-29" }).startedAt).toBe("2026-10-25");
  });

  it("CRUD aislado por usuario", async () => {
    const b = await createBook("a@x.com", input());
    expect(await listBooks("b@x.com")).toEqual([]);
    expect(await getBook("b@x.com", b.id)).toBeNull();
    await expect(updateBook("b@x.com", b.id, input())).rejects.toThrow();
    const u = await updateBook("a@x.com", b.id, input({ takeaways: "Mirar con ojos de niño" }));
    expect(u.takeaways).toBe("Mirar con ojos de niño");
    expect(await listBooks("a@x.com")).toHaveLength(1);
    await deleteBook("a@x.com", b.id);
    expect(await listBooks("a@x.com")).toEqual([]);
  });
});

describe("ediciones y fotos", () => {
  beforeEach(() => setStore(new MemoryStore()));

  it("guarda editoriales y año de la edición", async () => {
    expect(() => input({ editionYear: "dos mil" })).toThrow();
    const b = await createBook("a@x.com", input({ originalPublisher: "Reynal & Hitchcock", editionPublisher: "Ediciones Salamandra", editionYear: "2018" }));
    expect(b.editionPublisher).toBe("Ediciones Salamandra");
    expect(b.photos).toEqual([]);
  });

  it("solo acepta fotos bajo el prefijo del usuario y libro", async () => {
    const b = await createBook("a@x.com", input());
    await expect(addPhoto("a@x.com", b.id, "u/otro/x.webp")).rejects.toThrow();
    const key = `${photoPrefix("a@x.com", b.id)}1.webp`;
    await expect(addPhoto("b@x.com", b.id, key)).rejects.toThrow();
    expect((await addPhoto("a@x.com", b.id, key)).photos).toEqual([key]);
    const u = await updateBook("a@x.com", b.id, input({ summary: "x" }));
    expect(u.photos).toEqual([key]);
  });
});
