import React from "react";
import ReactDOM from "react-dom/client";
import "../brand/index.css";
import "./overlay.css";
import { initTheme } from "../brand/theme";
import { Overlay } from "./Overlay";

initTheme();

ReactDOM.createRoot(document.getElementById("overlay-root") as HTMLElement).render(
  <React.StrictMode>
    <Overlay />
  </React.StrictMode>,
);
