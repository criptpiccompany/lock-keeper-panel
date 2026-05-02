import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyDomPatches } from "./lib/domPatches";

// Harden DOM against translation-extension interference before React mounts.
applyDomPatches();

createRoot(document.getElementById("root")!).render(<App />);
