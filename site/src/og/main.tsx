import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../brand/index.css";
import "./og.css";
import { OgCard } from "./OgCard";

// Dev-only page (og.html): renders the 1200 × 630 Open Graph card for capture to public/og.png.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OgCard />
  </StrictMode>,
);
