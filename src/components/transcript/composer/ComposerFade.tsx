import { cn } from "@/lib/utils";

/**
 * The composer's soft top fade instead of a hard border-top — reads as the
 * content scrolling *under* the composer rather than stopping at a line.
 * Positioned outside its parent's box (negative top, the parent must be
 * `relative`), so it overlays the last 32px of the scrolling content above.
 * Used by the inline composer and by the docked panel composer's footer;
 * `toClassName` is the background it fades into (the surface behind it).
 */
export function ComposerFade({ toClassName = "to-lyra-bg-surface-base" }: { toClassName?: string }) {
  return (
    <div
      data-slot="composer-fade"
      className={cn("pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-b from-transparent", toClassName)}
      aria-hidden="true"
    />
  );
}
