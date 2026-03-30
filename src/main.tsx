import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress browser native PWA install prompt
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
