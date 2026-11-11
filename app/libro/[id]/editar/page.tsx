import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getBook } from "@/lib/services/bookService";
import BookForm from "../../../BookForm";
import Header from "../../../Header";

export default async function EditBook({ params }: { params: { id: string } }) {
  const { userId } = await requireSession();
  const b = await getBook(userId, params.id);
  if (!b) notFound();
  return (
    <main className="shell narrow">
      <Header />
      <h2>Editar libro</h2>
      <BookForm book={b} />
    </main>
  );
}
