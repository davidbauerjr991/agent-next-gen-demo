// The session row's right-hand action cluster (P-EXTRACT: split out of
// `TranscriptSessionSeparator`): Add Participant, Consult/Transfer, Outcome,
// the kebab, the status pill, collapse, Unassign & Dismiss / Discard draft,
// and the "Open Details Panel" toggle with its hover preview.
import React, { useState } from "react";
import { Button, KebabMenuButton, Popover, Tooltip, type MenuEntry } from "@nicecxone/lyra-ui";
import { ChevronsDownUp, ChevronsUpDown, PanelRight, Trash2, UserPlus, UserX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DisabledReason } from "@/contact-handling/DisabledReason";
import { t } from "@/i18n";
import { TransferIcon } from "./session-row-parts";
import { SessionOutcomeButton, SessionStatusChip } from "./SessionStatusOutcomeCluster";
import type { TranscriptSessionSeparatorProps } from "./session-row-props";

type SessionActionClusterProps = Omit<
  TranscriptSessionSeparatorProps,
  "onViewDetails" | "messageCount" | "direction" | "compactHeader" | "hideFade" | "showViewDetails" | "viewDetailsLabel" | "portalTarget" | "channelClosed" | "isCurrentSession"
> & { isClosed: boolean };

export function SessionActionCluster({
  session,
  isClosed,
  onToggleDetailsPanel,
  detailsPanelOpen = false,
  detailsPanelPreviewContent,
  detailsPanelPreviewOpen = false,
  onDetailsPanelPreviewHoverStart,
  onDetailsPanelPreviewHoverEnd,
  statusMenuOpen,
  statusMenuView,
  onStatusMenuOpenChange,
  onSelectStatus,
  onConfirmClose,
  onCancelClose,
  outcome,
  onDismiss,
  showActionCluster = true,
  showConsultTransferAndAddParticipant = true,
  showKebabMenu = true,
  outcomeAfterStatus = false,
  // Per explicit follow-up request (Advanced only — "hide the add
  // participant icon button ... move the transfer inside the 3 dots menu
  // ... move the 3 dots to the left of the outcome button and move the
  // status chip to the left of the 3 dots button"): these three are
  // additive/independent of the three props just above, not replacements —
  // `showConsultTransferAndAddParticipant` still hides BOTH buttons
  // together for 2.0 Phase 1's own existing usage; these let a caller keep
  // Consult/Transfer while hiding just Add Participant, folding Transfer
  // into the kebab instead of showing it as its own icon, and reordering
  // Status/Kebab/Outcome independently of `outcomeAfterStatus`'s own
  // status-then-outcome arrangement. See each prop's own doc comment.
  showAddParticipant = true,
  transferInKebabMenu = false,
  statusAndKebabBeforeOutcome = false,
  controlsReadOnly = false,
  showStatus = true,
  channelType,
  isNewThread = false,
  collapsed = false,
  onToggleCollapsed,
}: SessionActionClusterProps) {
  // Per explicit follow-up request ("also in the interaction more options 3
  // dots add a tooltip that says more options (like in the
  // interactionNavItem)"): mirrors `ChannelRow`'s own `menuOpen` state
  // (channel-row.tsx) used to suppress its "More Options" tooltip while the
  // kebab dropdown itself is open, so the tooltip doesn't linger/overlap the
  // open menu here either.
  const [kebabMenuOpen, setKebabMenuOpen] = useState(false);
  // The "Open Details Panel" button itself, computed once here (rather than
  // inline below) so both the plain and hover-preview-wrapped renderings
  // (see `detailsPanelPreviewContent`'s own doc comment) share the
  // exact same markup with zero duplication — only whether it's wrapped in
  // a `Popover` differs.
  const detailsPanelButton = onToggleDetailsPanel && !detailsPanelOpen ? (
    <Button
      variant="ghost"
      size="icon-sm"
      title="Open Details Panel"
      className={cn("shrink-0 text-lyra-fg-secondary", outcomeAfterStatus && "order-5", statusAndKebabBeforeOutcome && "order-6")}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleDetailsPanel();
      }}
      // Per the hover-preview restoration above — no-ops (undefined) when
      // the caller hasn't wired `detailsPanelPreviewContent` through, same
      // as `CustomerInfoHoverPreview`'s own former trigger button wired
      // both pointer AND keyboard-focus hover-intent (mirrors it exactly).
      onMouseEnter={onDetailsPanelPreviewHoverStart}
      onMouseLeave={onDetailsPanelPreviewHoverEnd}
      onFocus={onDetailsPanelPreviewHoverStart}
      onBlur={onDetailsPanelPreviewHoverEnd}
    >
      <PanelRight className="h-3.5 w-3.5" strokeWidth={1.5} />
    </Button>
  ) : null;
  return (
    <>
          {/* Consult/Transfer + Outcome — same real buttons/icons
              `ChannelRow`'s own trailing cluster uses (channel-row.tsx). No
              more `ml-auto` on this cluster itself — that pinned it to the
              row's far right edge even once it wrapped onto its own line
              (reported via screenshot), which reads as floating rather than
              a natural line break. The row above now uses `justify-between`
              instead: while both clusters share one line, it still pushes
              this one flush to the row's right edge (identical look to
              before); once this cluster wraps onto its own line, being the
              lone item on that line means `justify-between` places it at
              that line's start (left) instead — exactly `flex-start`'s
              behavior for a single flex item, no `ml-auto` needed either
              way. Consult/Transfer has no real action anywhere in this app yet
              (see rule #30) — same static, unwired icon button here.
              Outcome IS real when `outcome` is passed (the current
              session only — see this prop's own doc comment): the exact
              same popover UI `ChannelRow`'s Outcome button renders,
              reusing its shared `outcomeDraftKey`/`outcomeDraft` state one
              level up so opening it here or from the LeftNav card shows
              the identical draft. `gap-1` (4px) between every item in this
              cluster (Transfer, Outcome, status chip, Unassign & Dismiss)
              — per explicit request, was `gap-0` (flush together). Per
              later explicit follow-up, this whole cluster (Transfer,
              Outcome, status chip, Unassign & Dismiss alike) is gated on
              `showActionCluster` — see that prop's own doc comment for the
              2.0-only reasoning. */}
          {showActionCluster && (
          <div className="shrink-0 flex items-center gap-1">
            {/* Per explicit follow-up request: once this SESSION reads
                "Closed" (`isClosed` — the exact same flag that already
                locks the status tag below), Consult/Transfer/Outcome/
                Unassign & Dismiss are removed entirely, not just disabled
                — there's nothing left to transfer, log an outcome for, or
                unassign from on a session that's already closed out, so no
                dead icon should linger there either. (First pass just
                `disabled`-grayed these — per this follow-up, that wasn't
                far enough.) The status tag itself is untouched here — it's
                not one of these icons, and still needs to show "Closed" as
                its own label. */}
            {/* Add Participant — leading item in this cluster, immediately
                left of Consult/Transfer, per explicit request/reference
                screenshot. Purely decorative/unwired, same as Transfer
                right next to it (see that button's own doc comment/rule
                #30) — there's no real multi-party call model in this
                prototype for this to add anyone to. Same `!isClosed &&
                !isNewThread` gate as the rest of this cluster: nothing to
                add a participant to on a closed or still-draft thread
                either. */}
            {showConsultTransferAndAddParticipant && showAddParticipant && !isClosed && !isNewThread && (
              <DisabledReason reason={controlsReadOnly ? t("Take over to add a participant") : undefined}>
                <Button variant="icon" size="icon-sm" title="Add Participant" disabled={controlsReadOnly} className="text-lyra-fg-secondary">
                  <UserPlus className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              </DisabledReason>
            )}
            {showConsultTransferAndAddParticipant && !transferInKebabMenu && !isClosed && !isNewThread && (
              <DisabledReason reason={controlsReadOnly ? t("Take over to transfer") : undefined}>
                <Button variant="icon" size="icon-sm" title="Consult / Transfer" disabled={controlsReadOnly} className="text-lyra-fg-secondary">
                  <TransferIcon />
                </Button>
              </DisabledReason>
            )}
            <SessionOutcomeButton
              outcome={outcome}
              isClosed={isClosed}
              isNewThread={isNewThread}
              controlsReadOnly={controlsReadOnly}
              outcomeAfterStatus={outcomeAfterStatus}
              statusAndKebabBeforeOutcome={statusAndKebabBeforeOutcome}
            />
            {/* The kebab holds only Consult / Transfer (transferInKebabMenu); without it there is nothing to open. */}
            {showKebabMenu && transferInKebabMenu && !isClosed && !isNewThread && (
              // Per explicit follow-up request ("also in the interaction
              // more options 3 dots add a tooltip that says more options
              // (like in the interactionNavItem)"): matches `ChannelRow`'s
              // own "More Options" tooltip on its kebab (channel-row.tsx),
              // including suppressing it while the dropdown is open via
              // `kebabMenuOpen`/`onOpenChange` below, same pattern.
              <Tooltip content="More Options" placement="bottom" disabled={kebabMenuOpen || controlsReadOnly}>
                <KebabMenuButton
                  ariaLabel="More Options"
                  align="right"
                  disabled={controlsReadOnly}
                  className={statusAndKebabBeforeOutcome ? "order-2" : undefined}
                  onOpenChange={setKebabMenuOpen}
                  items={
                    [
                      {
                        id: "consult-transfer",
                        label: "Consult / Transfer",
                        icon: <TransferIcon />,
                        onClick: () => {},
                      },
                    ] satisfies MenuEntry[]
                  }
                />
              </Tooltip>
            )}
            <SessionStatusChip
              session={session}
              statusMenuOpen={statusMenuOpen}
              statusMenuView={statusMenuView}
              onStatusMenuOpenChange={onStatusMenuOpenChange}
              onSelectStatus={onSelectStatus}
              onConfirmClose={onConfirmClose}
              onCancelClose={onCancelClose}
              showStatus={showStatus}
              isNewThread={isNewThread}
              channelType={channelType}
              isClosed={isClosed}
              controlsReadOnly={controlsReadOnly}
              outcomeAfterStatus={outcomeAfterStatus}
              statusAndKebabBeforeOutcome={statusAndKebabBeforeOutcome}
            />
            {/* Collapse icon — immediately right of the status tag, only for
                a session that actually reads "Closed" and only once
                `onToggleCollapsed` is passed (a caller that doesn't support
                collapsing closed sessions just omits it, same "renders for
                real regardless of a handler, or omit the slot entirely"
                shape the rest of this cluster already uses). Collapses this
                session's own message content — animated, owned by
                `InteractionTranscript` — while this whole row stays put;
                see `onToggleCollapsed`'s own doc comment. */}
            {session.status === "Closed" && onToggleCollapsed && (
              <Tooltip content={collapsed ? "Expand session" : "Collapse session"} placement="bottom">
                <Button
                  variant="icon"
                  size="icon-sm"
                  aria-label={collapsed ? "Expand session" : "Collapse session"}
                  aria-expanded={!collapsed}
                  className={cn("text-lyra-fg-secondary", outcomeAfterStatus && "order-3", statusAndKebabBeforeOutcome && "order-4")}
                  onClick={onToggleCollapsed}
                >
                  {collapsed ? (
                    <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                  ) : (
                    <ChevronsDownUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                  )}
                </Button>
              </Tooltip>
            )}
            {/* Unassign & Dismiss — immediately right of the status tag (and,
                once a session reads "Closed," immediately right of the
                collapse/expand chevron just above instead, since that's the
                last thing still showing) — per explicit request. Same icon/
                action `ChannelTab`'s own kebab entry uses for this channel
                (see `onDismiss`'s own doc comment for the exact
                scoping/wiring); only rendered at all for the current
                session, so there's no dead button on historical rows.
                Swaps to a plain `X` "Remove from Queue" icon once `isClosed`
                (still the exact same `onDismiss` handler underneath — see
                that branch just below) rather than disappearing entirely:
                per explicit follow-up request, a closed channel still needs
                a way to clear it out of the assignment queue, it just isn't
                "unassigning" anything live anymore. `UserX` (not a warning/
                alert glyph) — per
                explicit correction, this isn't a warning; it just removes
                the agent from the assignment, and sharing `TriangleAlert`
                with the SLA-severity tab icon made the two easy to
                confuse at a glance.
                Per later explicit follow-up request, restyled from a plain
                neutral icon button to a labeled outline-critical `Button`
                — same reasoning/exact same composed classes as the
                record-header's own now-matching copy of this button
                (Agent Workspace 2.0's icon-button cluster,
                AgentNextGenPage.tsx — see that call site's own doc comment
                for why no named `outline`+`critical` `Button` variant
                exists to reach for instead). `size="sm"` (24px) — matches
                this row's OTHER buttons (`icon-sm`, also 24px), unlike the
                header's own copy which sizes up to `md` (32px) to match
                that row's taller buttons instead.
                Per a later explicit follow-up request ("use a ghost button
                error variant"): `variant="outline"` (bordered) →
                `variant="ghost"` with the `border-lyra-status-critical-
                strong`/`hover:border-lyra-status-critical-strong` classes
                dropped — same critical-red icon color and
                `hover:bg-lyra-status-critical-subtle`/`active:bg-lyra-
                status-critical-medium` background states as before, just
                borderless now. Exactly the same `outline` → `ghost`
                treatment the record-header's own copy of this button
                already got (there's still no named `ghost`+`critical`
                `Button` variant, so this remains composed via `className`
                the same way — see that call site's own doc comment,
                AgentNextGenPage.tsx).
                For a brand-new outbound thread (`isNewThread`), this real
                button is swapped for a red trash-icon "Delete Draft"
                button instead — per explicit request, since closing a
                genuine, untouched draft (no message sent yet) actually
                deletes it outright rather than just dismissing a live
                assignment (see `onDismiss`'s own caller for the matching
                "skip Contact History" branch that pairs with this).
                Per a later explicit follow-up request ("make the delete
                icons in the session rows ghost button error variants that
                say 'Delete Draft'"): `variant="icon"` (icon-only, label
                only in the `title` tooltip) → `variant="ghost"` with the
                label rendered as visible text alongside the icon — same
                `text-lyra-status-critical-strong`/`hover:bg-lyra-status-
                critical-subtle`/`active:bg-lyra-status-critical-medium`
                "ghost + critical" color treatment the Unassign & Dismiss
                button just below already uses (there's still no named
                `ghost`+`critical` `Button` variant, so this stays composed
                via `className`). `size="sm"` (24px, labeled) instead of
                `size="icon-sm"` (also 24px, but icon-only) — the row has
                room for it since this button fully replaces the rest of
                the cluster for a draft thread (see this branch's own
                `isNewThread` gating above). `title` dropped since the
                label is visible text now, not just a tooltip. This ONE
                session-row copy only, per the request's own wording — the
                LeftNav card kebab and record-header tab kebab's matching
                `removeVariant="delete-draft"` fallback (channel-row.tsx)
                intentionally kept their original icon-only treatment,
                since neither was mentioned and both are much tighter
                spaces (a card row / a tab) than this session row has. */}
            {isNewThread
              ? onDismiss && !isClosed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-6 shrink-0 text-lyra-status-critical-strong hover:bg-lyra-status-critical-subtle hover:text-lyra-status-critical-strong active:bg-lyra-status-critical-medium", outcomeAfterStatus && "order-4")}
                    onClick={onDismiss}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    Discard draft
                  </Button>
                )
              : onDismiss && (
                  isClosed ? (
                    // Per explicit request: a CLOSED session has no live
                    // channel left for "Unassign & Dismiss" to apply to
                    // (that button stays gated `!isClosed` below), but the
                    // agent still needs a way to clear this assignment out
                    // of the queue once it's done — a plain close ("X")
                    // icon, immediately right of the collapse/expand
                    // chevron above, wired to this SAME `onDismiss` handler
                    // (`onDismissChannel`/`handleDismissInteraction` — see
                    // that prop's own doc comment). Same icon-only `ghost`+
                    // critical treatment as the open-session button just
                    // below, just a plain `X` glyph (not `UserX`) since
                    // there's no "unassign" framing left once the channel
                    // itself is already closed — this is just "remove it
                    // from my queue" at that point.
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Remove from Queue"
                      className={cn("shrink-0 text-lyra-status-critical-strong hover:bg-lyra-status-critical-subtle hover:text-lyra-status-critical-strong active:bg-lyra-status-critical-medium", outcomeAfterStatus && "order-4", statusAndKebabBeforeOutcome && "order-5")}
                      onClick={onDismiss}
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </Button>
                  ) : (
                    // Per explicit follow-up request (applies wherever this
                    // button renders, across all 3 tiers — this component is
                    // shared): icon-only, no visible label, to take up less
                    // space in the row — dropped from `size="sm"` (24px,
                    // labeled) to `size="icon-sm"` (also 24px, so the row's
                    // own height/alignment is unaffected) with the label
                    // moved into `title`, which `Button` itself auto-wraps in
                    // a Tooltip + sets as `aria-label` for any `icon-*` size
                    // (see that prop's own doc comment, button.tsx) — same
                    // pattern the `isNewThread` close button just above
                    // already uses (`title="Close"`).
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Unassign & Dismiss"
                      className={cn("shrink-0 text-lyra-status-critical-strong hover:bg-lyra-status-critical-subtle hover:text-lyra-status-critical-strong active:bg-lyra-status-critical-medium", outcomeAfterStatus && "order-4", statusAndKebabBeforeOutcome && "order-5")}
                      onClick={onDismiss}
                    >
                      <UserX className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </Button>
                  )
                )}
            {/* "Open Details Panel" — new icon button, immediately right of
                Unassign & Dismiss/Remove from Queue/Delete Draft (per
                explicit request). Per further explicit follow-up request
                ("this should say 'Open Details Panel' and just open/close
                - the panel not list the options"): no more menu — a plain
                toggle of the caller's own Details panel open/closed state
                (`onToggleDetailsPanel`'s own doc comment). Rendered
                for every row `onToggleDetailsPanel` is passed for, not
                just the current session — same reasoning as before, this
                button has no session-specific opinion to withhold from a
                closed/past session. Per explicit follow-up request ("hide
                the toggle icon button when the session details are
                open"): also gated on `!detailsPanelOpen` now — see that
                prop's own doc comment for the full "why". */}
            {detailsPanelButton &&
              (detailsPanelPreviewContent ? (
                // Same `Popover` shape `CustomerInfoHoverPreview`'s own
                // former call site used (bottom-end anchored, no arrow, no
                // padding of its own since the preview content brings its
                // own card chrome) — open/close timing is entirely the
                // caller's (`detailsPanelPreviewOpen`), this just renders
                // it. The two auto-focus preventions and the
                // `data-radix-popper-content-wrapper` outside-interaction
                // guard match that former call site exactly, so a nested
                // overflow menu inside the preview content doesn't get
                // treated as an "outside" click that closes this Popover.
                <Popover
                  open={detailsPanelPreviewOpen}
                  placement="bottom"
                  align="end"
                  showArrow={false}
                  bodyPadding={false}
                  className="border-0 bg-transparent p-0 shadow-none"
                  onOpenAutoFocus={(e: Event) => e.preventDefault()}
                  onCloseAutoFocus={(e: Event) => e.preventDefault()}
                  onInteractOutside={(e: Event) => {
                    if ((e.target as Element)?.closest?.("[data-radix-popper-content-wrapper]")) {
                      e.preventDefault();
                    }
                  }}
                  content={detailsPanelPreviewContent}
                >
                  {detailsPanelButton}
                </Popover>
              ) : (
                detailsPanelButton
              ))}
          </div>
          )}
    </>
  );
}
