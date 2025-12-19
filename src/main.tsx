import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initMobile } from "./utils/mobile.ts";

// Initialize mobile features if running on native platform
initMobile();

createRoot(document.getElementById("root")!).render(<App />);
