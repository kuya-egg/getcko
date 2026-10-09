import ReactDOM from "react-dom/client";
import { Overlay } from "./Overlay";
import "./overlay.css";

// No StrictMode: its double-run effects would register and unregister the global
// shortcuts twice concurrently, racing the plugin's registration state.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<Overlay />);
