// The session row's Outcome and status pill (P-EXTRACT: split out of
// `TranscriptSessionSeparator`). Two pieces, not one wrapper: the action
// cluster renders them in its own order (the kebab sits between them), so
// the row's DOM is unchanged.
import type React from "react";
import { Button, OutcomePanel, SuccessIconSolid, Tooltip, type ChannelOutcomeConfig } from "@nicecxone/lyra-ui";
import { cn } from "@/lib/utils";
import { useOutcomeClaim } from "@/contact-handling/useOutcomeClaim";
import { ChannelStatusTag } from "./session-row-parts";
import type { TranscriptSessionSeparatorProps } from "./session-row-props";

type OrderProps = Pick<TranscriptSessionSeparatorProps, "outcomeAfterStatus" | "statusAndKebabBeforeOutcome">;

/** Outcome: the real popover when `outcome` is passed (the current session),
 *  else a plain button. Open only while this row holds the claim. */
export function SessionOutcomeButton({
  outcome: outcomeIn,
  isClosed,
  isNewThread,
  controlsReadOnly,
  outcomeAfterStatus,
  statusAndKebabBeforeOutcome,
}: OrderProps & {
  outcome?: ChannelOutcomeConfig;
  isClosed: boolean;
  isNewThread: boolean;
  controlsReadOnly: boolean;
}) {
  const outcome = useOutcomeClaim(outcomeIn);
  return (
    <>
            {/* Outcome and the status pill show on every channel tab once it's live; a draft
                (`isNewThread`: agent-initiated, nothing sent yet, `isDraftThread`, k6 9) shows only "Discard draft". */}
            {!isNewThread && (outcome && !isClosed ? (
              // Shared with the LeftNav's own `ChannelRow` Outcome button —
              // lyra-ui's `OutcomePanel` owns the Status/Tags/Disposition/
              // Summary form (and the Resolution dropdown's own local
              // open/view state) so this session row can't drift into a
              // second, hand-kept-in-sync copy of the same popover again.
              // Tooltip wraps `OutcomePanel` from the OUTSIDE (a plain
              // `<span className="inline-flex">` for Radix's `asChild` to
              // clone onto), with `disabled={outcome.open}` — same fix,
              // same reasoning, as `ChannelRow`'s own Outcome button
              // (channel-row.tsx): a plain `title`-driven `Button` tooltip
              // has no way to suppress itself once the popover it sits on
              // is open, so the "Outcome" hover label could still be
              // showing (the pointer is still resting on this same button
              // right after the click that opened it) at the same time as
              // the popover card, visibly bleeding out from behind/beside
              // it.
              <Tooltip content="Outcome" placement="bottom" className="z-[10020]">
                <span className="inline-flex">
                  <OutcomePanel outcome={outcome} alignOffset={-20}>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Outcome"
                      disabled={controlsReadOnly}
                      className={cn("gap-1.5 text-lyra-fg-default", outcomeAfterStatus && "order-2", statusAndKebabBeforeOutcome && "order-3")}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      {/* Per explicit request ("make the outcome check button
                          a solid blue circle"): swaps the outline `CircleCheck`
                          lucide icon for lyra-ui's own `SuccessIconSolid` (a
                          filled circle + white checkmark, recolorable via
                          `text-*` since its circle is `fill="currentColor"`)
                          — same component `WarningIconSolid` a few hundred
                          lines up already uses for its own solid badge. Kept
                          the existing `text-lyra-status-info-strong` blue tint
                          rather than switching to the icon's "success" green
                          default, matching the blue this Outcome icon has
                          always used. */}
                      <SuccessIconSolid className="h-4 w-4 text-lyra-status-info-strong" />
                      {/* Per explicit request: in the session row, Outcome is a
                          ghost button with a visible label next to the solid
                          blue check. The interactionNavItem / ChannelRow
                          Outcome button stays icon-only (not touched). */}
                      <span>Outcome</span>
                    </Button>
                  </OutcomePanel>
                </span>
              </Tooltip>
            ) : (
              // Also covers the `outcome && isClosed` case now (the real
              // popover above is gated on `!isClosed` too) — a historical
              // session with no `outcome` prop at all already rendered
              // nothing here once THIS branch itself is skipped for
              // `isClosed`, so a just-closed CURRENT session reads
              // identically (no icon) rather than a static disabled one.
              !isClosed && (
                <Button variant="ghost" size="sm" title="Outcome" disabled={controlsReadOnly} className={cn("gap-1.5 text-lyra-fg-default", outcomeAfterStatus && "order-2", statusAndKebabBeforeOutcome && "order-3")}>
                  {/* Per explicit request ("make the outcome check button
                      a solid blue circle"): swaps the outline `CircleCheck`
                      lucide icon for lyra-ui's own `SuccessIconSolid` (a
                      filled circle + white checkmark, recolorable via
                      `text-*` since its circle is `fill="currentColor"`)
                      — same component `WarningIconSolid` a few hundred
                      lines up already uses for its own solid badge. Kept
                      the existing `text-lyra-status-info-strong` blue tint
                      rather than switching to the icon's "success" green
                      default, matching the blue this Outcome icon has
                      always used. */}
                  <SuccessIconSolid className="h-4 w-4 text-lyra-status-info-strong" />
                  <span>Outcome</span>
                </Button>
              )
            ))}
    </>
  );
}

/** The status pill (not for voice, not for a draft). */
export function SessionStatusChip({
  session,
  statusMenuOpen,
  statusMenuView,
  onStatusMenuOpenChange,
  onSelectStatus,
  onConfirmClose,
  onCancelClose,
  showStatus = true,
  isNewThread,
  channelType,
  isClosed,
  controlsReadOnly,
  outcomeAfterStatus,
  statusAndKebabBeforeOutcome,
}: OrderProps &
  Pick<
    TranscriptSessionSeparatorProps,
    "session" | "statusMenuOpen" | "statusMenuView" | "onStatusMenuOpenChange" | "onSelectStatus" | "onConfirmClose" | "onCancelClose" | "showStatus" | "channelType"
  > & { isNewThread: boolean; isClosed: boolean; controlsReadOnly: boolean }) {
  return (
    <>
            {/* Status tag — moved to the far right of the Consult/Transfer +
                Outcome cluster (was previously the leading element at the
                far left of this row) per explicit request. Same Popover/
                Menu/confirm-view behavior as before, just relocated —
                and, since a later request, extracted into its own
                `ChannelStatusTag` (session-row-parts.tsx) so
                `AgentNextGenPage.tsx`'s record header can render the
                identical control once this row's own copy is hidden there
                (2.0 only).
                Per explicit follow-up request, also hidden for a brand-new
                outbound thread (`isNewThread`) — same reasoning as
                Consult/Transfer/Outcome/the kebab right above: a genuine,
                never-launched draft has no real status yet either, so this
                session row collapses down to ONLY the Delete Draft trash
                button (further below) once `isNewThread`, matching the
                mockup's 2+-channel draft state exactly. Previously this was
                the one piece of the cluster that stayed visible regardless
                of `isNewThread` — a real, confirmed bug fixed here
                alongside the header's own identical fix. */}
            {showStatus && !isNewThread && channelType !== "voice" && (
              <ChannelStatusTag
                status={session.status}
                menuOpen={statusMenuOpen}
                menuView={statusMenuView}
                onMenuOpenChange={onStatusMenuOpenChange}
                onSelectStatus={onSelectStatus}
                onConfirmClose={onConfirmClose}
                onCancelClose={onCancelClose}
                disabled={isClosed || controlsReadOnly}
                className={cn(outcomeAfterStatus && "order-1", statusAndKebabBeforeOutcome && "order-1")}
              />
            )}
    </>
  );
}
