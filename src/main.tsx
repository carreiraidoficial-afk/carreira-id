import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { recarregarParaVersaoNova } from "@/lib/recarregar-apos-deploy";

// Arquivo de tela que não existe mais (o app foi atualizado enquanto estava aberto): recarrega sozinho em vez de quebrar.
window.addEventListener("vite:preloadError", (evento) => {
  evento.preventDefault();
  recarregarParaVersaoNova();
});

// App initialization
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
