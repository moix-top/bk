import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore, setStore } from "@/lib/dynamo";
import { createBook, deleteBook, getBook, listBooks, parseBookInput, updateBook } from "@/lib/services/bookService";

const input = (o: Record<string, string> = {}) =>
  parseBookInput({ title: "El Principito", author: "Saint-Exupéry", repo: "github.com/radamuz/el-principito", ...o });

describe("bookService", () => {
  beforeEach(() => setStore(new MemoryStore()));

  it("valida y normaliza", () => {
    expect(input().repo).toBe("https://github.com/radamuz/el-principito");
    expect(() => parseBookInput({ title: "  " })).toThrow();
    expect(() => input({ finishedAt: "ayer" })).toThrow();
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
