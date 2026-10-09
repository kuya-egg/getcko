// Where the main window runs, read once. "on this Mac" / "on this PC" comes from PLACE[PLATFORM].
import { PLACE } from "../brand/lexicon";
import { detectPlatform, type Platform } from "../components/ui/platform";

export const PLATFORM: Platform = detectPlatform();

/** { onThis: "on this Mac", thisDevice: "this Mac" } (or "PC" on Windows). */
export const place = PLACE[PLATFORM];
