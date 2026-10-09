// Files dropped on the window. Tauri's webview takes the drop natively (HTML drop events don't
// fire and File objects carry no path), so listen on the webview: it hands over absolute paths,
// the same thing pickDocuments() returns, ready for docImport. Does nothing in the browser mock.
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useRef, useState } from "react";

/** Returns true while files are held over the window (drives DropZone's `dragging`). */
export function useDocumentDrop(onPaths: (paths: string[]) => void, enabled: boolean): boolean {
  const [over, setOver] = useState(false);
  const cb = useRef(onPaths);
  cb.current = onPaths;

  useEffect(() => {
    if (!enabled || !isTauri()) return;
    let off: (() => void) | undefined;
    let dead = false;
    void getCurrentWebview()
      .onDragDropEvent(({ payload }) => {
        if (payload.type === "enter" || payload.type === "over") setOver(true);
        else if (payload.type === "leave") setOver(false);
        else {
          setOver(false);
          if (payload.paths.length) cb.current(payload.paths);
        }
      })
      .then((u) => {
        if (dead) u();
        else off = u;
      });
    return () => {
      dead = true;
      off?.();
      setOver(false);
    };
  }, [enabled]);

  return over;
}

/** True inside the Tauri window (native drop gives paths); false in the browser mock. */
export const NATIVE_DROP = isTauri();
