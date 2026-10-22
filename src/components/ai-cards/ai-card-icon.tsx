import type { ComponentType } from "react";

/** A card or button icon at the size lyra's Agentic AI card stories use. */
export const aiCardIcon = (Icon: ComponentType<{ className?: string; strokeWidth?: number }>) => (
  <Icon className="h-4 w-4" strokeWidth={1.5} />
);

/** "9:15 AM" in the active locale. */
export const timeLabel = (at: number) => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(at);
