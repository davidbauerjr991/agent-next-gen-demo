import type { ReactNode } from "react";

/** The hover previews' `Popover` (channel icons and Contact Details): no
 *  surface of its own (the frame is the card), and no enter animation — the
 *  open delay already prevents flicker, and a fade on top of it flashed when
 *  the agent hovered then clicked fast (P-AIFIRST (k5)). No close animation
 *  either: lyra's is 100ms, not under the 100ms the rule allows. Important,
 *  because twMerge keeps the animate plugin's `animate-in` beside it. */
export const HOVER_PREVIEW_POPOVER_CLASS = "border-0 bg-transparent p-0 shadow-none !animate-none";

/** The record header's hover previews (every channel icon and Contact
 *  Details) share this frame (browser check, 2026-10-16): a column with a
 *  fixed header, one body that is the only scroller, and a fixed footer. A
 *  min height keeps an empty thread from looking collapsed (its placeholder
 *  centers in the body); content grows the frame up to the max, then the
 *  body scrolls. The frame itself never scrolls. */
export function HoverPreviewFrame({
  header,
  children,
  footer,
  onMouseEnter,
  onMouseLeave,
}: {
  header: ReactNode;
  /** The body: give it `min-h-0 flex-1` content (a transcript, or a scroller). */
  children: ReactNode;
  footer?: ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent<Element>) => void;
}) {
  return (
    <div
      data-slot="hover-preview"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="flex min-h-[360px] max-h-[min(560px,70vh)] w-[340px] flex-col overflow-hidden rounded-lyra-lg border border-lyra-border-soft bg-lyra-bg-surface-container-subtle shadow-lg"
    >
      <div className="shrink-0">{header}</div>
      <div data-slot="hover-preview-body" className="flex min-h-0 flex-1 flex-col">
        {children}
      </div>
      {footer && <div className="shrink-0">{footer}</div>}
    </div>
  );
}
