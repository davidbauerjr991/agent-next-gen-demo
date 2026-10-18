import { useState } from "react";
import {
  Button,
  ActionIconButton,
  Container,
  Tooltip,
  ProgressBar,
  AccordionHeadless,
  AccordionHeadlessItem,
  AccordionHeadlessContent,
  Spinner,
} from "@nicecxone/lyra-ui";
import { Phone, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildCustomerContextOverviewInfo } from "@/components/agent-next-gen-shared-utils";
import { usePageClock } from "@/components/agent-next-gen-page-clock";
import { ClockTick } from "@/components/agent-next-gen-clock-tick";

/* ── Marcus Webb's call transcript ──
 *  His script (src/scenarios/scripts/marcus-webb.ts) holds it; the sim
 *  engine writes it into his call's transcript when the scenario plays
 *  (P0.5c), and `useScenarioCases` renders it from the store. */

/* ── MarcusWebbIncomingCallNotice ──
 *  Per explicit request ("when a new call comes in (clicking the 'L' button
 *  to launch marcus webb) open a popover/toast that displays [a Copilot
 *  case-summary card]... this should animate up from the bottom of the
 *  screen... do not add the assignment to the assignment panel until an
 *  action is taken on the popover toast... use a popover component from
 *  lyra-ui... have it appear in the toast area and animate upward"):
 *  replaces the "L" trigger's old behavior of dropping Marcus straight into
 *  the left nav the instant the key is pressed. Now the trigger only builds
 *  the `Interaction` and holds it (see `marcusWebbPendingInteractionRef`,
 *  below `agentStatus`) — this card is what the agent actually sees, and
 *  `interactions` isn't touched until they click "Review" or "Takeover".
 *
 *  Built from lyra-ui primitives, matching the reference mockup's own
 *  layout: `Container variant="info"` for the case-summary card (same blue
 *  tint `ProgressBar.stories.tsx`'s "AI Confidence" demo already uses for
 *  this exact kind of copy), `Tag variant="critical"` for the "Escalated"
 *  pill (the same variant `agent-next-gen-contact-history.tsx` already
 *  uses for that exact status word), `ProgressBar` for AI Confidence. Per
 *  explicit follow-up requests, the card no longer includes an "Ask
 *  Copilot about this Case" input, nor the `DetailsPanelAccordions`
 *  Customer Profile/Contact Snapshot/Files section — it ends with the
 *  Case Summary container. `contextOverview` is still accepted/computed
 *  by the caller (`marcusWebbContextOverviewInfo`) but is currently unused
 *  by this component now that that section is gone.
 *
 *  The actual "animate upward from the toast area" mechanics are the
 *  CALLER's job, not this component's: the render site wraps this card's
 *  content in a lyra-ui `Popover` (`asAnchor`, `placement="top"`) anchored
 *  to a plain span planted directly inside the same `fixed bottom-4 right-4`
 *  block that already renders every other toast — `placement="top"` is what
 *  gets Popover's own existing `data-[side=top]:slide-in-from-bottom-2` /
 *  `slide-out-to-bottom-1` animate-in/out classes (popover.tsx) for free,
 *  with zero new CSS needed here. This component is purely the card's own
 *  content/copy.
 *
 *  Per a later explicit follow-up request ("hide the contact snapshot and
 *  review/takeover buttons and add a close button to the top right of the
 *  toast. In addition, load the assignment tile in the left nav when the
 *  toast comes in") — this reverses the "don't add the assignment until an
 *  action is taken" behavior described above: the "L" keydown handler now
 *  commits Marcus's interaction (and sets `marcusWebbReviewing`) the
 *  instant the toast opens, not when Review/Takeover is clicked (see that
 *  handler's own doc comment). With the tile already in the left nav, this
 *  card became a lighter notice — Contact Snapshot and Takeover are hidden
 *  behind `SHOW_MARCUS_NOTICE_DETAILS` below ("hide, don't destroy," same
 *  as `SHOW_APPROVE_PROCESSING_STEPS`/`SHOW_DO_SOMETHING_INPUT` elsewhere
 *  in this file), and a real close button was added. Per a further
 *  explicit follow-up ("add the Review button back (dismiss the toast when
 *  review is clicked and navigate to the assignment)"), Review itself is
 *  unconditional again — it's the fast path straight into the
 *  already-loaded tile, while Takeover stays reachable only from inside
 *  the interaction (the "Reviewing this conversation" action bar's own
 *  independent Takeover button, which flips `marcusWebbReviewing` false). */
const SHOW_MARCUS_NOTICE_DETAILS = false;

// Not rendered since P0.5c ("hide, don't destroy"): it was already never
// opened (its `open` state was never set true), and Marcus now arrives from
// the engine like any routed contact. Restore it by rendering it when his
// scenario contact first appears.
export function MarcusWebbIncomingCallNotice({
  onReview,
  onTakeover,
  onClose,
}: {
  /** Same shape `buildCustomerContextOverviewInfo` returns for every other
   *  consumer (`customerContextOverviewInfo`, this page's own docked-panel/
   *  hover-preview memo) — computed once for Marcus specifically
   *  (`marcusWebbContextOverviewInfo`, below `agentStatus`) rather than
   *  recomputed per render, same reasoning as that memo. */
  contextOverview: ReturnType<typeof buildCustomerContextOverviewInfo>;
  // `onReview` drives the always-visible Review button below. `onTakeover`
  // stays wired for whenever `SHOW_MARCUS_NOTICE_DETAILS` (below) is back
  // on — see that flag's own doc comment.
  onReview: () => void;
  onTakeover: () => void;
  /** Per explicit follow-up request ("add a close button to the top right
   *  of the toast") — the one way to dismiss this notice now that Review/
   *  Takeover are hidden by default. Only closes the notice itself; the
   *  interaction is already committed into `interactions` regardless (see
   *  the "L" keydown handler), so this doesn't need to touch anything
   *  else. */
  onClose: () => void;
}) {
  // Live "ringing" timer for the header chip (the "00:16" in the reference
  // mockup). The notice only mounts while it's open, so it counts from the
  // page-clock tick it mounted at: a later open starts from 00:00 again.
  // Only the chip's text re-renders each second (`<ClockTick>` below).
  const clock = usePageClock();
  const [openedAtTick] = useState(() => clock.now());
  // Per explicit follow-up request ("use the attached image as an
  // accordion within the popover toast"), Case Summary is now a genuine
  // collapsible accordion (chevron toggle, matching the reference
  // screenshot's own "Contact Snapshot" accordion styling — bulleted
  // content with the AI Confidence/Recommended Action boxes nested inside)
  // instead of the always-expanded plain `Container` it used to be. Kept
  // as local component state (not the shared `Accordion` component's own
  // `items`/`value` API) since there's exactly one section here and the
  // header row needs this card's own blue-tinted styling rather than
  // `Accordion`'s default row chrome — same externally-driven
  // `AccordionHeadless`/`-Item`/`-Content` building blocks
  // `agent-next-gen-transcript.tsx` already uses for the same reason
  // (a pill/button elsewhere drives `value`, not `AccordionPrimitive
  // .Trigger`). Per a later explicit follow-up request, starts CLOSED now
  // (reversing the reference screenshot's own chevron-up/expanded state).
  const [caseSummaryOpen, setCaseSummaryOpen] = useState(false);
  return (
    <div className="flex w-[400px] flex-col overflow-hidden rounded-lyra-lg border border-lyra-border-soft bg-lyra-bg-surface-overlay shadow-lg">
      {/* Header — avatar/name/status match `TranscriptSessionSeparator`'s
          own session-row conventions, except this bubble's own background
          (see its own doc comment just below) — not a plain text title,
          since this IS an incoming voice call notification. */}
      <div className="flex items-start gap-3 p-4 pb-3">
        {/* Per explicit follow-up request ("make the background of the
            avatar error instead of purple"), then ("use the hard red not
            the soft red, make the phone icon white"): this design system
            calls that severity color "critical", not "error" (see `Tag
            variant="critical"`, the "Escalated" tag right below, and
            `ActionBar`'s own `variant="error"` mapping internally to these
            same `status-critical-*` tokens) — `bg-lyra-status-critical-
            strong` (the "hard"/solid red, was `-subtle`) with `text-lyra-
            fg-on-primary` (white — the same token `Button`'s own
            `destructive` variant already uses for its label on a solid red
            fill) for the `Phone` icon below, rather than that icon reading
            in the critical-strong red itself (illegible against a same-red
            background). */}
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lyra-status-critical-strong text-lyra-fg-on-primary">
          {/* Incoming-call pulse — per explicit follow-up request ("reuse
              the spinner animation in the center of the avatar"): this
              swaps out the bespoke ring keyframes the previous pass added
              here for lyra-ui's own `Spinner` (`variant="circle"`) —
              already built for exactly this "circle growing from center,
              fading as it goes" pulse (spinner.tsx's own `lyra-circle-
              pulse` keyframes), so reused as-is rather than hand-rolling a
              second version of it. `size="lg"` (32px) sits just inside
              this 36px bubble; `absolute inset-0` centers it within the
              bubble without disturbing the `Phone` icon's own centering.
              `color="inverse"` (white) rather than the default `"primary"`
              blue — per explicit follow-up request, just to see how it
              reads against this bubble's own background.
              Rendered before the `Phone` icon so it sits behind it in
              paint order without needing an explicit z-index. */}
          <Spinner variant="circle" size="lg" color="inverse" className="absolute inset-0" />
          <Phone className="relative h-4 w-4" strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="lyra-heading-sm text-lyra-fg-default truncate">Marcus Webb</span>
            {/* Per explicit follow-up request ("remove the pink rounded
                rectangle to the right of marcus webb in the toast") — the
                "Escalated" `Tag` that used to sit here is gone. */}
            <span className="shrink-0 rounded-lyra-sm border border-lyra-border-subtle px-1.5 py-0.5 lyra-body-sm text-lyra-fg-secondary tabular-nums">
              {/* Only this text ticks; the notice itself doesn't re-render. */}
              <ClockTick>
                {(clockTick) => {
                  const elapsedSeconds = clockTick - openedAtTick;
                  const mm = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
                  const ss = String(elapsedSeconds % 60).padStart(2, "0");
                  return `${mm}:${ss}`;
                }}
              </ClockTick>
            </span>
          </div>
          <p className="lyra-body-sm text-lyra-fg-secondary mt-0.5 line-clamp-2">
            Voice Call escalation from AI Agent
          </p>
        </div>
        {/* Per explicit follow-up request ("add a close button to the top
            right of the toast") — last flex child of this `items-start`
            row, so it pins to the card's top-right corner for free with no
            extra positioning. `ActionIconButton` + `Tooltip` + lucide `X`,
            same icon-only-action convention this file already uses
            elsewhere (e.g. the docked panel's own "Full Screen" button).
            The render site's own `Popover` still `preventDefault()`s
            Escape/outside-click (see that doc comment) — this button is
            the one deliberate way to dismiss the notice now. */}
        <Tooltip content="Close" placement="top">
          <ActionIconButton
            aria-label="Close"
            size="sm"
            onClick={onClose}
            className="shrink-0 text-lyra-fg-secondary hover:text-lyra-fg-secondary"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </ActionIconButton>
        </Tooltip>
      </div>

      {SHOW_MARCUS_NOTICE_DETAILS && (
      <div className="flex flex-col gap-3 px-4 pb-4 max-h-[70vh] overflow-y-auto">
        <Container variant="info" className="overflow-hidden p-0">
          <AccordionHeadless
            type="single"
            collapsible
            value={caseSummaryOpen ? "case-summary" : ""}
            onValueChange={() => {}}
          >
            <AccordionHeadlessItem value="case-summary">
              {/* Header row IS the trigger — plain button (not
                  `AccordionPrimitive.Trigger`) driving the local
                  `caseSummaryOpen` state above, same externally-driven
                  shape this file's own doc comment on that state
                  describes. Chevron rotate mirrors `accordion.tsx`'s own
                  `Accordion` component chevron exactly (`ChevronDown`,
                  `rotate-180` when open), and so does the hover/active/
                  focus-visible treatment below (`accordion.tsx`'s own
                  `AccordionRow` trigger className) — this isn't that
                  component, but it should still feel like a clickable
                  accordion header, not a static label. */}
              <button
                type="button"
                onClick={() => setCaseSummaryOpen((v) => !v)}
                aria-expanded={caseSummaryOpen}
                className="flex w-full items-center justify-between gap-2 p-4 text-left transition-colors hover:bg-lyra-state-hover active:bg-lyra-state-pressed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lyra-border-focus focus-visible:ring-inset"
              >
                {/* Per explicit follow-up request ("case summary should not
                    be all capitals") — `uppercase` dropped, same fix
                    "AI Confidence"/"Recommended Action" already got earlier
                    (see those spans' own doc comments a bit further down):
                    the text itself was already normal/title case, only the
                    CSS transform was still rendering it in all caps. Label
                    itself later changed to "Contact Snapshot" per a further
                    explicit follow-up request — the local `caseSummaryOpen`
                    state/handler name (and every other internal reference
                    to "Case Summary" in this file's own doc comments) are
                    left as-is; only this visible heading text changed.
                    `tracking-wide` (the letter-spacing behind the earlier
                    "not have tracking" report) later dropped too, and the
                    label itself capitalized to "Contact Snapshot" (was
                    lowercase "snapshot") per that same follow-up. Typography
                    changed from `lyra-body-sm-emphasis` to plain
                    `lyra-body-md` per a further follow-up ("make it body
                    copy md to match accordion component") — `accordion.tsx`'s
                    own `AccordionRow` renders every item's title as
                    `lyra-body-md` (no emphasis weight), and this hand-rolled
                    header is deliberately styled to read as an accordion
                    trigger (see this block's own top doc comment), so its
                    title text now matches that component's actual title
                    typography instead of a heavier one it never used. Color
                    (`text-lyra-fg-active-strong`) is unchanged — that's
                    this bar's own accent, not part of the typography match. */}
                <span className="lyra-body-md text-lyra-fg-active-strong">Contact Snapshot</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-lyra-fg-active-strong transition-transform duration-200",
                    caseSummaryOpen && "rotate-180"
                  )}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </button>
              <AccordionHeadlessContent>
                <div className="px-4 pb-4">
                  {/* Bulleted per the reference screenshot's own "Contact
                      Snapshot" accordion content style, replacing the
                      previous single Sparkles-accented paragraph. */}
                  <ul className="list-disc space-y-1 pl-4 lyra-body-md text-lyra-fg-default">
                    <li>Customer called in for a refund on a $200 order</li>
                    <li>Refund exceeds the AI agent's $100 auto-approval limit</li>
                    <li>Customer placed on hold, pending human approval</li>
                  </ul>
                  <div className="mt-3 rounded-lyra-md border border-lyra-border-soft bg-lyra-bg-surface-overlay p-3">
                    <div className="flex items-center justify-between">
                      <span className="lyra-body-sm-emphasis text-lyra-fg-secondary">AI Confidence</span>
                      <span className="lyra-heading-sm text-lyra-status-info-strong">91%</span>
                    </div>
                    <ProgressBar value={91} size="sm" className="mt-2" />
                    <p className="lyra-body-sm text-lyra-fg-secondary mt-2">
                      Straightforward refund request — the only reason for
                      escalation is that $200 is above the AI agent's own
                      approval limit.
                    </p>
                  </div>
                  <div className="mt-3 rounded-lyra-md border border-lyra-border-soft bg-lyra-bg-surface-overlay p-3">
                    <p className="lyra-body-sm-emphasis text-lyra-fg-secondary">Recommended Action</p>
                    <p className="lyra-body-md text-lyra-fg-default mt-1">
                      Approve the $200 refund so the AI agent can complete
                      the request and take the customer off hold.
                    </p>
                  </div>
                </div>
              </AccordionHeadlessContent>
            </AccordionHeadlessItem>
          </AccordionHeadless>
        </Container>
      </div>
      )}

      {/* Per a later explicit follow-up request ("add the Review button
          back (dismiss the toast when review is clicked and navigate to
          the assignment)") — Review is unconditional again, unlike
          Takeover (still gated behind `SHOW_MARCUS_NOTICE_DETAILS`,
          untouched): the agent can jump straight into Marcus's already-
          loaded tile from here, but still takes over via the "Reviewing
          this conversation" action bar's own button once inside, not a
          second toast-level shortcut. */}
      <div className="flex items-center gap-2 border-t border-lyra-border-subtle p-3">
        <Button variant="outline" size="md" className="flex-1" onClick={onReview}>
          Review
        </Button>
        {SHOW_MARCUS_NOTICE_DETAILS && (
          <Button variant="default" size="md" className="flex-1" onClick={onTakeover}>
            Takeover
          </Button>
        )}
      </div>
    </div>
  );
}
