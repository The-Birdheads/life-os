import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

import { defineCustomElements as jeepSqlite } from "jeep-sqlite/loader";

// Stencil components registration
if (typeof window !== "undefined" && !customElements.get("jeep-sqlite")) {
  jeepSqlite(window);
}

const rootElement = document.getElementById("root");
if (rootElement && !rootElement.hasAttribute("data-react-root")) {
  rootElement.setAttribute("data-react-root", "true");
  createRoot(rootElement).render(<App />);
}
