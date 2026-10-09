// Hero QA page: the hero alone, plus a scroll spacer so the offscreen pause can be checked.
import ReactDOM from "react-dom/client";
import "../index.css";
import { initTheme } from "../theme";
import { GetCkoHero } from "./GetCkoHero";

initTheme();

const q = new URLSearchParams(window.location.search);
const at = q.get("at");
const still = q.has("still");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <div className="min-h-screen bg-bg">
    <GetCkoHero autoplay={!still} at={at != null ? Number(at) : undefined} />
    {q.has("scroll") && <div className="h-[200vh]" />}
  </div>,
);
