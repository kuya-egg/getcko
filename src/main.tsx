import React from "react";
import ReactDOM from "react-dom/client";
import "./brand/index.css";
import { initTheme } from "./brand/theme";
import { injectTextureStyles } from "./brand/textures";
import App from "./App";

initTheme();
// .gc-tex-* recipe classes (textures.ts). The overlay window entry should call this too.
injectTextureStyles();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
