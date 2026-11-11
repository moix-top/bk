"use client";

import { useFormState } from "react-dom";
import { newToken, type TokenState } from "../actions";

const URL_MCP = "https://bk.moix.top/api/mcp";

export default function TokenForm() {
  const [state, action] = useFormState<TokenState, FormData>(newToken, {});
  const t = state.token;
  return (
    <>
      <form action={action} className="bar-row">
        <input name="name" placeholder="Nombre (p. ej. Claude Code portátil)" maxLength={60} />
        <button type="submit" className="btn">Crear token</button>
      </form>
      {t && (
        <div className="panel">
          <p><strong>Token «{state.name}».</strong> Cópialo ahora: no se volverá a mostrar.</p>
          <Snippet label="Claude Code" code={`claude mcp add --transport http --scope user bk ${URL_MCP} --header "Authorization: Bearer ${t}"`} />
          <Snippet label="JSON (Claude Desktop, Cursor, etc.)" code={JSON.stringify({ mcpServers: { bk: { type: "http", url: URL_MCP, headers: { Authorization: `Bearer ${t}` } } } }, null, 2)} />
        </div>
      )}
    </>
  );
}

function Snippet({ label, code }: { label: string; code: string }) {
  return (
    <div className="snippet">
      <div className="snippet-head">
        <span className="sub">{label}</span>
        <button type="button" onClick={() => navigator.clipboard.writeText(code)}>Copiar</button>
      </div>
      <pre>{code}</pre>
    </div>
  );
}
