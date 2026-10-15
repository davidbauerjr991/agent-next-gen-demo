import * as React from "react";
import { CircleCheck, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@nicecxone/lyra-ui";

/**
 * PROTOTYPE — local to agent-next-gen-v3 only. NOT in lyra-ui yet. See
 * CollapsedChannelBadge.tsx's own doc comment for the same "why local"
 * convention this follows (build new things locally, promote to lyra-ui
 * only once explicitly asked).
 *
 * Depicts an interaction's own live voice call as "on hold" once the agent
 * has navigated away to a different interaction — per explicit request
 * ("if the agent goes to a different interactionNavItem the call controls
 * should go into a hold mode and be depicted as on hold in the
 * interactionNavItem"). Each page derives WHICH interaction this applies to
 * itself (an interaction has a live, not-yet-hung-up voice thread AND isn't
 * the currently active interaction — see each page's own
 * `findLiveVoiceThread` doc comment) and passes that down as
 * `InteractionNavCard`'s own `onHold` prop; this file only owns the two
 * actual renderings, since `InteractionNavItem` (lyra-ui, read-only) has no
 * built-in slot for either.
 *
 * Two renderings because `InteractionNavCard` (each page's own local wrapper
 * around `InteractionNavItem`, not this file) itself renders two
 * structurally different shapes depending on whether the LeftNav rail is
 * expanded:
 *  - `OnHoldCornerBadge` — collapsed (icon-rail) tile: an absolutely-
 *    positioned corner badge, the same "external overlay on a `relative`
 *    wrapper" technique `CollapsedChannelBadge` already uses for that same
 *    tile (that component's own doc comment has the full "why external,
 *    why `relative`" reasoning) — parked at the OPPOSITE corner
 *    (`right-0 top-0`) so it never collides with that badge's `left-0
 *    top-0`.
 *  - `OnHoldPill` — expanded (full detail) card: a small inline pill meant
 *    for `InteractionNavItem`'s own `headerAction` slot (rendered at the
 *    end of the card's header row, next to the customer name) — the only
 *    slot that component exposes for arbitrary extra content there.
 */
export function OnHoldCornerBadge({ className }: { className?: string }) {
  return (
    <Badge
      shape="circle"
      size="sm"
      aria-label="Call on hold"
      className={cn(
        "pointer-events-none absolute right-0 top-0 z-10 h-[18px] w-[18px] min-w-0 border border-transparent bg-lyra-status-warning-strong p-0.5 text-lyra-fg-on-primary",
        className
      )}
    >
      <Pause className="h-full w-full" strokeWidth={2.25} aria-hidden="true" />
    </Badge>
  );
}

/** A voice row whose call has ended and is in wrap-up, waiting for the
 *  agent's outcome (P0.5d.1). The nav row's on-hold chip style in the info
 *  color, passed to lyra `ChannelRow`'s `statusBadge` slot (its own line
 *  below the skill name; the call timer stays put). `elapsed` is the
 *  after-call work time, formatted by the caller inside its `<ClockTick>`. */
export function NeedsOutcomeBadge({ elapsed }: { elapsed: string }) {
  return (
    <Badge
      shape="pill"
      color="info"
      variant="subtle"
      fontSize={12}
      icon={<CircleCheck strokeWidth={2} />}
      aria-label={`Call ended, needs outcome, ${elapsed} in wrap-up`}
    >
      Needs outcome · {elapsed}
    </Badge>
  );
}

export function OnHoldPill({ className }: { className?: string }) {
  return (
    <span
      aria-label="Call on hold"
      className={cn(
        // Reverted per explicit follow-up: a prior pass gave this chip
        // itself a solid `warning-medium` fill + `warning-strong` border,
        // but the "make it yellow with a warning border" request was
        // actually meant for the whole card (see `InteractionNavItemProps.
        // onHold`, interaction-nav-item.tsx) — this chip stays its original
        // plain, light `warning-subtle` fill with no border.
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-lyra-status-warning-subtle px-2 py-0.5 lyra-body-xs-emphasis text-lyra-status-warning-strong",
        className
      )}
    >
      <Pause className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
      On Hold
    </span>
  );
}
