import BookForm from "../../BookForm";
import Header from "../../Header";

export default function NewBook() {
  return (
    <main className="shell narrow">
      <Header />
      <h2>Nuevo libro</h2>
      <BookForm />
    </main>
  );
}
