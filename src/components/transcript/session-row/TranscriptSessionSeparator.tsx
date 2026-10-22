// The session row (P-EXTRACT: split out of agent-next-gen-transcript.tsx).
// This file is the shell (sticky row, border, fade, the record-header
// portal); the left half is `SessionDetailsLink`, the right half
// `SessionActionCluster` (with the Outcome and status pill from
// `SessionStatusOutcomeCluster`).
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { SessionActionCluster } from "./SessionActionCluster";
import { SessionDetailsLink } from "./SessionDetailsLink";
import type { TranscriptSessionSeparatorProps } from "./session-row-props";

export type { TranscriptSessionSeparatorProps } from "./session-row-props";

/* ── TranscriptSessionSeparator ──
   The "# CTX-... · <date>" pill row between sessions. `sticky top-0` (no
   extra plumbing needed — this relies on plain CSS sticky-header stacking:
   each separator is the first child of its own session block, in normal
   document flow as a sibling of the next session block below it, so as the
   transcript's own `overflow-y-auto` container scrolls, a separator sticks
   to the top for as long as its session's messages are still scrolling by,
   then gets pushed off-screen the instant the *next* session block's own
   top — and therefore its own separator — reaches the scroll container's
   top edge. That hand-off is the "then it replaces the other one" behavior
   from the request; no scroll listener or IntersectionObserver needed for
   it, just each separator being `sticky top-0` in source order.
   `bg-lyra-bg-surface-base` keeps messages scrolling underneath from
   showing through while it's pinned; `z-[1]` keeps it above them —
   deliberately *not* `z-10`: `CustomerInformationSidePanel` (the
   docked panel this transcript sits beside) renders at `z-[5]`
   (side-panel.tsx), and a sticky element's own `z-index` opens a new
   stacking context compared against siblings up the tree, not just against
   the messages scrolling directly beneath it — `z-10` was outranking that
   panel and painting the separator/expanded Session Details card over top
   of it once the panel had content past the fold (confirmed via
   screenshot). `z-[1]` is enough to clear plain in-flow message content
   (which has no z-index of its own) while staying under every panel in
   this file that intentionally layers above the transcript.

   The trailing gradient div is the same "soft fade instead of a hard edge"
   technique `InteractionComposer` uses for its own top edge (see that
   component's doc comment), mirrored: `position: sticky` already
   establishes a containing block for an absolutely-positioned descendant
   (same as `relative` would), so no extra wrapper is needed here. Placed
   at `-bottom-8` (outside this div's own box, extending down into the
   messages scrolling underneath) rather than as internal bottom padding,
   so it overlays whatever message content is passing directly beneath the
   separator instead of just adding empty space inside it. Gradient runs
   solid (matching this bar's own background) at the top down to
   transparent at the bottom — the reverse of the composer's direction,
   since here the solid edge is at the *top* of the fade band, not the
   bottom.

   "View Details" used to expand `TranscriptSessionDetails` inline right
   below this pill, animated via lyra-ui's headless accordion building
   blocks (AccordionHeadless/-Item/-Content) — plain `div`s now (see
   `onViewDetails`'s own doc comment): per explicit request, it opens
   an external `InteriorPanel` instead (`InteractionTranscript`'s own
   `onViewSessionDetails` prop), so there's no open/closed state left here
   to animate. `openSessionIds`/`toggleSession` (the state that used to
   drive the accordion's `value`) are gone from `InteractionTranscript` for
   the same reason.

   The status `Tag` (e.g. "Resolved") used to be plain decoration inside
   the same big toggle button as the rest of the pill. It's now its own
   `Popover` trigger, pulled out of that button into a sibling — clicking
   it opens a status list (`Menu`, `bare` since `Popover`'s own content
   wrapper already supplies the surface) instead of toggling Session
   Details, so the two actions (change status / expand details) don't
   fight over one click target. Picking "Closed" swaps that same popover's
   `content` to a confirm view instead of closing it (`statusMenuView`) —
   one Popover instance, two possible bodies, not a second nested Popover —
   matching the reference screenshots' "select Closed → a warning to
   confirm" flow. Once a session's status IS "Closed", the trigger is
   `disabled` (`isClosed` below): there's no way back in from here, matching
   "closed cannot be re-opened." All the actual status state (which session
   is "Closed" now, which popover/view is open) lives in
   `InteractionTranscript` (this component owns no state of its own) —
   same reasoning `sessionMessages` already lives one level up: every
   session's status is independent, and only one status popover should
   ever be open across the whole transcript at a time. */
export function TranscriptSessionSeparator({
  session,
  onViewDetails,
  messageCount,
  channelClosed,
  isCurrentSession,
  channelType,
  direction,
  compactHeader = false,
  hideFade = false,
  showViewDetails = true,
  viewDetailsLabel = "View Details",
  portalTarget,
  ...cluster
}: TranscriptSessionSeparatorProps) {
  const isClosed = !isCurrentSession || !!channelClosed;
  // `content` (not a direct `return`) so `portalTarget` (this component's
  // own prop, doc comment in session-row-props.ts) can relocate the exact
  // same JSX into the record header via `createPortal` further down, with
  // zero duplication.
  const content = (
    // Plain `div` pair — was `AccordionHeadless`/`AccordionHeadlessItem`
    // (a headless accordion, chosen back when "View Details" expanded
    // `TranscriptSessionDetails` inline right below via `AccordionHeadless
    // Content`). Per explicit request, "View Details" now opens an external
    // `InteriorPanel` instead (see `onViewDetails`'s own doc comment) — this
    // row no longer has any open/closed state of its own to animate, so the
    // accordion primitives (and the `AccordionHeadlessContent` body they
    // wrapped) are gone; the same two classNames move straight onto plain
    // `div`s so the sticky/border behavior is otherwise untouched.
    <div
      // Per explicit follow-up request, un-reverting an earlier revert
      // ("dang - revert that last change - go back to full screen width"):
      // back to full-width again — the outer scroll wrapper (`Interaction
      // Transcript`'s own call site, see its doc comment) is unconstrained
      // (`w-full`, no max-width) once more, so this root carries its own
      // `px-6` directly again instead of inheriting a constrained parent's
      // inset. `px-6` lives HERE (not on a wrapping div) for the same
      // sticky-containing-block reasoning already established: a sticky
      // element's stickiness bounds are its own immediate parent's box — a
      // wrapper holding ONLY this separator has zero extra height to stick
      // through. This root stays a DIRECT sibling of the per-session
      // message content (both children of the same `<div key={session.id}>`,
      // which has real height) — that part was never touched by either the
      // revert or this un-revert.
      className={cn(
        "bg-lyra-bg-surface-base px-6",
        // Sticky-within-the-scroll-column positioning only makes sense
        // for the inline (non-portaled) rendering — see this className's
        // own doc comment just above for the "stickiness bounds are its
        // own immediate parent's box" reasoning, which no longer applies
        // once `portalTarget` relocates this whole row into the record
        // header's own, non-scrolling container instead.
        !portalTarget && "sticky top-0 z-[1]",
      )}
    >
      {/* `border-b border-lyra-border-subtle` lives on this row wrapper, not
          the sticky root above (a first attempt there didn't render — see
          this comment's own history) — now that "View Details" opens an
          external panel instead of expanding content below, this is simply
          the bottom border of the collapsed row. */}
      <div className="border-b border-lyra-border-subtle">
        {/* In the record header (portaled) it's the header's second line: the lyra PageHeader "Agent" story's spacing. */}
        <div className={cn("flex flex-wrap items-center justify-between gap-3", portalTarget ? "pb-3 pt-1" : "py-2")}>
          {/* Flat, left-aligned case info — no wrapping pill border/
              background and no flanking divider lines (per earlier design
              update matching the reference screenshot): plain inline
              content. The status tag itself sits at the far right (see the
              Consult/Transfer + Outcome cluster). Customer name +
              channel address used to sit here too, ahead of "# contactId ·
              date" — per explicit follow-up request, dropped as redundant
              (not just hidden): both are already shown elsewhere for this
              same conversation (the record-header tab's own face/tooltip,
              the Customer Information panel), so repeating them on every
              single session row added noise without new information. This
              component no longer takes `customerName`/`channelAddress`
              props at all as a result — see `InteractionTranscript`'s own
              call site, which no longer passes them either. (A later
              follow-up briefly reinstated `customerName` here, conditional
              on the Customer Information panel being closed — once that
              panel permanently docked to the right of the page, the
              condition itself stopped applying, so this was dropped again
              for good rather than kept as another toggle.)

              `flex-wrap` on the row above — per explicit follow-up request,
              when the container narrows the Consult/Transfer + Outcome +
              status tag cluster should break onto its own line rather than
              clipping/overflowing (an earlier overflow-hidden/truncate
              attempt was the wrong read of the request — undone here). The
              right-hand cluster lost its `ml-auto` for the same
              reason — it now left-aligns under this cluster once wrapped,
              rather than floating to the far right on its own line. */}
          <SessionDetailsLink
            session={session}
            onViewDetails={onViewDetails}
            messageCount={messageCount}
            channelType={channelType}
            direction={direction}
            compactHeader={compactHeader}
            showViewDetails={showViewDetails}
            viewDetailsLabel={viewDetailsLabel}
          />
          <SessionActionCluster session={session} isClosed={isClosed} channelType={channelType} {...cluster} />
        </div>
      </div>
      {/* The fade is for content scrolling under the sticky row; the header's copy doesn't scroll. */}
      {!hideFade && !portalTarget && (
        <div
          className="pointer-events-none absolute inset-x-0 -bottom-8 h-8 bg-gradient-to-b from-lyra-bg-surface-base to-transparent"
          aria-hidden="true"
        />
      )}
    </div>
  );
  // See `portalTarget`'s own doc comment — every other call site
  // (no target passed) renders `content` exactly where it always has.
  return portalTarget ? createPortal(content, portalTarget) : content;
}
