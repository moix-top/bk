import Link from "next/link";
import { signOut } from "@/auth";

export default function Header() {
  return (
    <header className="top">
      <h1><Link href="/" className="brand">bk</Link></h1>
      <nav className="nav">
        <Link href="/ajustes" className="link-muted">MCP</Link>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
        <button type="submit" className="link-muted plain">Salir</button>
        </form>
      </nav>
    </header>
  );
}
