// An AI instruction row (P-EXTRACT: split out of agent-next-gen-transcript.tsx).
import { useEffect, useState } from "react";
import { Interstitial } from "@nicecxone/lyra-ui";

/** "AI agent is performing this now…" until the row's `performedAt`, then the clickable instruction row.
 *  The time is the row's own (set where the row is made: the provider's annotation, the Copilot ask), so a
 *  remount mid-way (a layout switch moving the row) shows exactly what the first mount would have, and a row
 *  past its time is clickable at once. The timer here only re-renders at that moment; it records nothing. */
export function InstructionInterstitial({
  instruction,
  timestamp,
  onOpen,
  active,
  performedAt: performedAtProp,
}: {
  /** True while this row's panel is the one open in the side panel (same selected look as Marcus's action-log rows). */
  active?: boolean;
  /** The row's message id (callers pass it; the row's state no longer depends on it). */
  id: string;
  instruction: { title: string; by: string; link: string; performedAt?: number };
  timestamp: string;
  onOpen: (link: string) => void;
  /** Overrides `instruction.performedAt` (Marcus's own Copilot rows). Absent on both: already performed. */
  performedAt?: number;
}) {
  const performedAt = performedAtProp ?? instruction.performedAt;
  const pending = performedAt !== undefined && Date.now() < performedAt;
  const [renders, rerender] = useState(0);
  useEffect(() => {
    if (!pending || performedAt === undefined) return;
    // `renders` in the deps: a timer that fires a hair early schedules another.
    const t = window.setTimeout(() => rerender((n) => n + 1), Math.max(0, performedAt - Date.now()));
    return () => window.clearTimeout(t);
  }, [pending, performedAt, renders]);
  return (
    <Interstitial
      title={instruction.title}
      by={instruction.by}
      timestamp={timestamp}
      pending={pending}
      active={active}
      onOpen={() => onOpen(instruction.link)}
    />
  );
}
