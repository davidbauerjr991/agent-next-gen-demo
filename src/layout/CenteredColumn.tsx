// The one centring primitive (P-LAYOUT-F3 13): a max-width column centred in the width available to it. Every side
// panel is a flex sibling of the page column (the assignments panel on the left; the reference column, the docked AI
// panel, the queue panel and the Contact Details slide-over on the right, P-LAYOUT-F3 4), so the column's container
// is the content card's width less whatever is open beside it; opening or closing one re-centres the content through
// that panel's own width transition (push). A panel that doesn't fit overlays, leaving the width alone. Every page's
// main column uses it: the interaction's action area, a kind cell, Home's body.
import * as React from "react";
import { cn } from "@/lib/utils";
import { CONTENT_MAX_WIDTH_CLASS, type ContentWidth } from "./content-width";

export interface CenteredColumnProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Which page's width (`content-width.ts`); "full" stretches. */
  width: ContentWidth;
}

export const CenteredColumn = React.forwardRef<HTMLDivElement, CenteredColumnProps>(function CenteredColumn(
  { width, className, ...props },
  ref,
) {
  return <div ref={ref} className={cn("mx-auto w-full", CONTENT_MAX_WIDTH_CLASS[width], className)} data-centered-column={width} {...props} />;
});
