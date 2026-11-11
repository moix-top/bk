// Tokens personales para el MCP. Se guarda solo el SHA-256: el token en claro
// se enseña una vez al crearlo y no se puede recuperar.

import { createHash, randomBytes } from "node:crypto";
import { getStore, tokenPk, tokenSk, userPk } from "@/lib/dynamo";
import { httpError } from "@/lib/http";

export interface TokenInfo { hash: string; name: string; createdAt: string; lastUsedAt?: string }

const sha = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createToken(userId: string, name: string): Promise<{ token: string; info: TokenInfo }> {
  const clean = name.trim().slice(0, 60) || "Agente";
  const token = `bk_${randomBytes(24).toString("base64url")}`;
  const info: TokenInfo = { hash: sha(token), name: clean, createdAt: new Date().toISOString() };
  const store = getStore();
  await store.put({ pk: tokenPk(info.hash), sk: "TOKEN", userId });
  await store.put({ pk: userPk(userId), sk: tokenSk(info.hash), ...info });
  return { token, info };
}

export async function listTokens(userId: string): Promise<TokenInfo[]> {
  const items = await getStore().query(userPk(userId), "TOKEN#");
  return items
    .map(({ hash, name, createdAt, lastUsedAt }) => ({ hash, name, createdAt, lastUsedAt }) as TokenInfo)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function revokeToken(userId: string, hash: string): Promise<void> {
  const store = getStore();
  const own = await store.get(userPk(userId), tokenSk(hash));
  if (!own) throw httpError(404, "Token no encontrado");
  await store.delete(tokenPk(hash), "TOKEN");
  await store.delete(userPk(userId), tokenSk(hash));
}

export async function resolveToken(token: string): Promise<string | null> {
  if (!/^bk_[A-Za-z0-9_-]{20,}$/.test(token)) return null;
  const hash = sha(token);
  const store = getStore();
  const idx = await store.get(tokenPk(hash), "TOKEN");
  const userId = typeof idx?.userId === "string" ? idx.userId : null;
  if (!userId) return null;
  // Marca de último uso, como mucho una vez por hora para no escribir en cada llamada.
  const own = await store.get(userPk(userId), tokenSk(hash));
  if (!own) return null;
  const last = typeof own.lastUsedAt === "string" ? Date.parse(own.lastUsedAt) : 0;
  if (Date.now() - last > 3600_000) await store.put({ ...own, lastUsedAt: new Date().toISOString() });
  return userId;
}
