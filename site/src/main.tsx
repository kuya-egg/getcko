import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./brand/index.css";
import "./styles/site.css";
import { injectTextureStyles } from "./brand/textures";
import { App } from "./App";

// Light only: <html data-theme="light"> is set in index.html; the kit's initTheme() is not called,
// so neither the OS preference nor a stored or ?theme value can switch the page to dark.
// .gc-tex-* recipe classes from the brand kit (textures.ts).
injectTextureStyles();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
