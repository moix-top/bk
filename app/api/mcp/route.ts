// Endpoint MCP (Streamable HTTP, sin estado). Autenticación: Bearer bk_… creado
// en /ajustes. Ver lib/mcp.ts.

import { NextResponse } from "next/server";
import { requireTokenUser } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { handleRpc } from "@/lib/mcp";

export const dynamic = "force-dynamic";

const rpcError = (status: number, message: string) =>
  NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message } }, {
    status,
    headers: status === 401 ? { "WWW-Authenticate": 'Bearer realm="bk", error="invalid_token"' } : undefined,
  });

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireTokenUser(req);
  } catch (e) {
    return rpcError(e instanceof HttpError ? e.status : 500, e instanceof Error ? e.message : "Error");
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON no válido" } }, { status: 400 });
  }
  const batch = Array.isArray(body);
  const msgs = (batch ? body : [body]) as Parameters<typeof handleRpc>[1][];
  const out = (await Promise.all(msgs.map((m) => handleRpc(userId, m)))).filter(Boolean);
  if (out.length === 0) return new NextResponse(null, { status: 202 });
  return NextResponse.json(batch ? out : out[0]);
}

// Sin SSE: el servidor nunca inicia mensajes.
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
