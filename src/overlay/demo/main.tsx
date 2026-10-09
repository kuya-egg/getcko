// Dev-only practice window: a stand-in spreadsheet app for demoing Screen Help without the AI.
import React from "react";
import ReactDOM from "react-dom/client";
import "../../brand/index.css";
import { initTheme } from "../../brand/theme";
import { PracticeSheet } from "./PracticeSheet";

initTheme();

ReactDOM.createRoot(document.getElementById("demo-root") as HTMLElement).render(
  <React.StrictMode>
    <PracticeSheet />
  </React.StrictMode>,
);
