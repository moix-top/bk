import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore, setStore } from "@/lib/dynamo";
import { handleRpc } from "@/lib/mcp";
import { createToken, listTokens, resolveToken, revokeToken } from "@/lib/services/tokenService";

const call = (u: string, name: string, args: object) =>
  handleRpc(u, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) as Promise<{ result: any }>;

describe("MCP", () => {
  beforeEach(() => setStore(new MemoryStore()));

  it("initialize y tools/list", async () => {
    const r = (await handleRpc("a", { id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } })) as any;
    expect(r.result.protocolVersion).toBe("2025-03-26");
    expect(((await handleRpc("a", { id: 2, method: "tools/list" })) as any).result.tools.length).toBe(6);
    expect(await handleRpc("a", { method: "notifications/initialized" })).toBeNull();
  });

  it("añade, busca sin acentos, edita parcial y borra", async () => {
    const add = await call("a", "add_book", { title: "El Principito", author: "Saint-Exupéry", summary: "Un aviador…" });
    const id = add.result.structuredContent.id;
    expect((await call("a", "search_books", { query: "exupery" })).result.structuredContent.books).toHaveLength(1);
    expect((await call("b", "get_book", { id })).result.isError).toBe(true);
    const up = await call("a", "update_book", { id, takeaways: "Mirar con ojos de niño" });
    expect(up.result.structuredContent.summary).toBe("Un aviador…");
    expect((await call("a", "get_book", { id })).result.content[0].text).toContain("Lo que me aportó");
    await call("a", "delete_book", { id });
    expect((await call("a", "list_books", {})).result.structuredContent.books).toEqual([]);
  });

  it("tokens", async () => {
    const { token, info } = await createToken("a@x.com", "test");
    expect(await resolveToken(token)).toBe("a@x.com");
    expect(await resolveToken("bk_nope_nope_nope_nope_nope")).toBeNull();
    await expect(revokeToken("b@x.com", info.hash)).rejects.toThrow();
    await revokeToken("a@x.com", info.hash);
    expect(await resolveToken(token)).toBeNull();
    expect(await listTokens("a@x.com")).toEqual([]);
  });
});
