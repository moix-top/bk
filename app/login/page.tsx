// Login con Google. Server component: el botón es una server action.

import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  "email-not-verified": "Tu cuenta de Google no tiene el email verificado.",
  "no-email": "Google no ha devuelto ningún email para esa cuenta.",
  Configuration: "Falta configuración de acceso en el servidor (variables AUTH_*).",
  AccessDenied: "Acceso denegado.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; callbackUrl?: string };
}) {
  const session = await auth();
  if (session?.user?.email) redirect("/");
  const error = searchParams.error ? ERRORS[searchParams.error] ?? "No se pudo iniciar sesión." : null;
  const callbackUrl = searchParams.callbackUrl || "/";

  return (
    <main className="shell login">
      <h1>bk</h1>
      <p className="muted">Tus libros leídos: de qué iban, lo más importante y lo que te aportaron.</p>
      {error && <p className="error">{error}</p>}
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: callbackUrl });
        }}
      >
        <button type="submit" className="btn">Entrar con Google</button>
      </form>
      {process.env.NODE_ENV === "development" && process.env.DEV_LOGIN_EMAIL && (
        <form
          action={async () => {
            "use server";
            await signIn("dev", { redirectTo: callbackUrl });
          }}
        >
          <button type="submit" className="link-muted">Entrar como {process.env.DEV_LOGIN_EMAIL} (dev)</button>
        </form>
      )}
    </main>
  );
}
