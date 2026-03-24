import { createRoot } from "react-dom/client";
import "./index.css";

console.log("HELLO FROM MAIN.TSX - START");

import App from "./App.tsx";
import { defineCustomElements as jeepSqlite } from "jeep-sqlite/loader";

console.log("HELLO FROM MAIN.TSX - IMPORTS LOADED");

// Stencil components registration
if (typeof window !== "undefined" && !customElements.get("jeep-sqlite")) {
  console.log("HELLO FROM MAIN.TSX - REGISTERING JEEP SQLITE");
  jeepSqlite(window);
}

const rootElement = document.getElementById("root");
if (rootElement && !rootElement.hasAttribute("data-react-root")) {
  console.log("HELLO FROM MAIN.TSX - RENDERING APP");
  rootElement.setAttribute("data-react-root", "true");
  createRoot(rootElement).render(<App />);
}
