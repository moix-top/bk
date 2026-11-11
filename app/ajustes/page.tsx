import { requireSession } from "@/lib/auth";
import { listTokens } from "@/lib/services/tokenService";
import Header from "../Header";
import { deleteToken } from "../actions";
import TokenForm from "./TokenForm";

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : "nunca");

export default async function Ajustes() {
  const { userId, email } = await requireSession();
  const tokens = await listTokens(userId);
  return (
    <main className="shell narrow">
      <Header />
      <h2>Agentes de IA (MCP)</h2>
      <p className="muted">
        Conecta Claude u otro agente a tus libros con el servidor MCP <code>https://bk.moix.top/api/mcp</code>.
        Podrá listar, buscar, leer, añadir, editar y borrar libros de <strong>{email}</strong>.
      </p>
      <TokenForm />
      <h3 className="section-title">Tokens activos</h3>
      {tokens.length === 0 && <p className="muted">Ninguno.</p>}
      <ul className="tokens">
        {tokens.map((t) => (
          <li key={t.hash}>
            <div>
              <strong>{t.name}</strong>
              <div className="sub">Creado {fmt(t.createdAt)} · último uso {fmt(t.lastUsedAt)}</div>
            </div>
            <form action={deleteToken}>
              <input type="hidden" name="hash" value={t.hash} />
              <button type="submit" className="danger">Revocar</button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
