import React from "react";
import ReactDOM from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import "./brand/index.css";
import { initTheme } from "./brand/theme";
import { injectTextureStyles } from "./brand/textures";
import App from "./App";

initTheme();
// .gc-tex-* recipe classes (textures.ts). The overlay window entry should call this too.
injectTextureStyles();

async function start() {
  // `vite` in a plain browser: answer every IPC command from an in-memory backend
  // (src/lib/mock/README.md). Installed before the first render; never shipped in a build.
  if (import.meta.env.DEV && !isTauri()) {
    const { installMockBackend } = await import("./lib/mock");
    installMockBackend();
  }
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void start();
