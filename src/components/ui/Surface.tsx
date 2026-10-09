import type { HTMLAttributes, Ref } from "react";
import type { SurfaceTexture, SurfaceTone, TextureIntensity } from "../../brand/textures";
import { cn } from "./cn";

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  /** Element to render. Default "section". */
  as?: "section" | "div" | "header" | "footer" | "aside" | "article" | "main";
  /** Gecko-world texture (see docs/brand/textures.md). "none" = flat tone only. Default "footprints". */
  texture?: SurfaceTexture | "none";
  /** subtle | standard (default) | bold. Text and text-2 pass 4.5:1 at every level. */
  intensity?: TextureIntensity;
  /** Ground: canvas (default), paper, green (gecko-wash / gecko-night), ink (dark island in both themes). */
  tone?: SurfaceTone;
  /** Follow the app theme (default) or force a variant (video frames, marketing, plates). */
  mode?: "auto" | "light" | "dark";
  ref?: Ref<HTMLElement>;
}

/**
 * A textured section. The texture follows <html data-theme> / prefers-color-scheme via the generated
 * classes in src/brand/surfaces.css; tone="ink" or mode="dark" re-scopes the semantic tokens, so
 * text-text, bg-surface and border-border inside read as the dark theme.
 * Put body copy longer than two lines, captions and controls on a content card (bg-surface + border).
 *
 *   <Surface texture="footprints" intensity="standard" tone="canvas" className="px-16 py-12">...</Surface>
 */
export function Surface({
  as: Tag = "section",
  texture = "footprints",
  intensity = "standard",
  tone = "canvas",
  mode = "auto",
  className,
  children,
  ref,
  ...rest
}: SurfaceProps) {
  return (
    <Tag
      ref={ref as Ref<HTMLElement & HTMLDivElement>}
      {...rest}
      data-texture={texture}
      className={cn(
        "surface",
        texture !== "none" && `surface-${texture}`,
        `surface--${intensity}`,
        `surface--${tone}`,
        mode !== "auto" && `surface--${mode}`,
        className,
      )}
    >
      {children}
    </Tag>
  );
}
