import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, CheckCircle2, ChevronRight, CornerDownLeft, History, MessageSquareText, XCircle } from "lucide-react";
import {
  Accordion,
  AIInput,
  AIProcess,
  type AIProcessStep,
  AttachmentThumbnail,
  Avatar,
  Button,
  Container,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Spinner,
  Textarea,
  cn,
} from "@nicecxone/lyra-ui";
import damagedHeadphonesImg from "@/assets/headphones.jpg";
import {
  KnowledgeArticleSummaryRow,
  type KnowledgeArticleCardData,
} from "@/components/agent-next-gen-knowledge-article-card";
import { ApprovalRequestAccordion, InstructionInterstitial, type TranscriptApprovalSummary } from "@/components/transcript/InteractionTranscript";
import { MarcusWebbTransactionsTable } from "@/components/agent-next-gen-marcus-webb-transactions-panel";

// Placeholder content for the "Do Something" scaffold — per explicit
// request, verbatim from the reference screenshot, so this actually
// looks like the intended reference rather than generic lorem ipsum.
// Every submission currently shows this SAME card (see `suggestedArticles`
// below) — real, per-command content is a separate, later, saved-for-now
// piece of work (the local-LLM plan).
const PLACEHOLDER_KNOWLEDGE_ARTICLE: KnowledgeArticleCardData = {
  id: "tablet-warranty-coverage",
  title: "Tablet Warranty Coverage",
  body:
    "Tablet units on the OneTread x1000 carry a 24-month parts warranty. A blinking red light with a frozen " +
    "display is a documented board fault and qualifies for replacement, not repair.",
  internalNote: "If the unit is outside 24 months, quote the paid replacement price before opening a claim.",
  webLinks: [
    { title: "Warranty policy — tablets", copyValue: "https://example.com/kb/warranty-policy-tablets" },
    { title: "Board fault diagnostic guide", copyValue: "https://example.com/kb/board-fault-diagnostic-guide" },
  ],
  processSteps: ["Verify serial number", "Confirm fault matches diagnostic guide", "Submit replacement claim"],
};

/* ── MarcusWebbNextBestActionCard ──
   Per explicit request ("i want the next best action content ... to
   populate like the way claude asks questions ... with a way to add
   something else"): replaces the plain one-sentence "Next Best Action"
   text (`ContactOverview`'s own `nextBestAction` string prop,
   lyra-ui/contact-overview.tsx) for Marcus Webb's refund-escalation
   interaction specifically, via that component's new `nextBestActionContent`
   prop — see that prop's own doc comment for why a rich-content override was
   added there rather than widening `nextBestAction` itself.

   Scoped to Marcus Webb only (per explicit decision) — every other
   interaction keeps the original plain-sentence Next Best Action untouched;
   this component is never rendered for them. The three context bullets
   below are a more detailed expansion of the two already shown in Marcus's
   "Contact Snapshot" accordion just above this one (same call,
   AgentWorkspaceAdvancedPage.tsx `MARCUS_WEBB_ID` branch) — grounded in the
   same scripted facts as `MARCUS_WEBB_CALL_TRANSCRIPT` (order #48213,
   noise-cancelling headphones, cracked ear cup, $200 refund, $100
   auto-approval limit, placed last Tuesday), not invented ones.

   Built from lyra-ui's `RadioGroup`/`RadioGroupItem` (radio.tsx) for real
   radio semantics/keyboard nav — its `label` prop was widened from `string`
   to `React.ReactNode` to allow the stacked title+description block used
   here, rather than hand-rolling a fresh Radix radio group locally (no
   existing lyra-ui component already has this "option card with a
   description" shape to reuse as-is). Each option's own bordered wrapper
   (not part of `RadioGroupItem` itself) reuses the same selected-state
   token pair (`bg-lyra-bg-active-subtle`/`border-lyra-border-active`)
   `ToggleGroup` and the (currently disabled) Marcus decision card in
   `AgentWorkspace2WithDeskPage.tsx` already use for "this option is
   picked," for visual consistency with those existing patterns.

   Per a later explicit follow-up ("we need a button to do the command when
   it's selected kind of like the enter button... in screenshot 2"),
   selecting an option alone is no longer the end of the interaction — an
   inline confirm button (Rule Zero: never a hand-rolled `<button>` —
   `InlineSubmitButton` below, `CornerDownLeft` echoing Claude Code's own
   `AskUserQuestion` "Enter to submit" affordance; originally a ghost
   `ActionIconButton`, later made solid-filled per explicit request — see
   `InlineSubmitButton`'s own doc comment) appears on the currently
   selected row. Confirming locks that choice in (`confirmed`) and
   replaces the option list with a
   static summary of the command that was "issued," plus a `Spinner` +
   elapsed-timer status line simulating the AI agent acting on it — per
   explicit clarification, still no real backend wiring, just a convincing
   completed/in-progress look (same "simulate, don't actually call
   anything" convention this app already uses elsewhere, e.g. the customer
   auto-reply timer). There's no way to reopen/change the answer once
   confirmed — "lock in" was explicit, and this stays intentionally simple.

   Per a later explicit bug report ("it's still hung up" — the performing/
   spinner row never resolved), the simulated action now actually finishes:
   4 real seconds after confirming, `completed` flips true, the elapsed
   timer freezes (its own interval simply stops being recreated — see that
   effect's own guard), and the spinner/status text swap to a finished
   look. Still no real backend call — just a bounded simulated duration
   instead of an indefinite one, same "simulate, don't actually call
   anything" convention as the rest of this card.

   Per a later explicit bug report ("the transcript doesn't appear to have
   updated") — completing the action now DOES have one real, visible
   effect outside this card: `onComplete` (new prop, called once, the same
   moment `completed` flips true) hands the caller a follow-up line for the
   AI agent to "say" back on the call, reflecting whatever was decided.
   This is the one deliberate exception to this card's earlier "no
   callback prop, nothing wired to real interaction state" design — the
   caller (`AgentWorkspaceAdvancedPage.tsx`) appends it to Marcus's own
   scripted `MARCUS_WEBB_CALL_TRANSCRIPT`-seeded `liveMessages`, the same
   mechanism `handleSendMessage` already uses for the composer, so the
   transcript actually shows the call being wrapped up instead of staying
   frozen on "please hold." The message text itself is still just static,
   hand-written copy per option — no real generation involved. Per a
   LATER explicit bug report, "something else" no longer posts anything
   to the transcript via `onComplete` at all: a "something else" note is
   an internal workflow instruction for the AI agent, not something it
   would ever say to the customer on the call, so `somethingElseRounds`'s
   own step effect (below) doesn't call `onComplete` — the note only ever
   shows in-card (the instruction row + its own follow-up bubble).

   Per a later explicit request, "Approve" specifically (not Reject/
   Something else — scoped to just this one option) drops the generic
   `Spinner`+elapsed-timer row for lyra-ui's own `AIProcess` step list
   (ai-process.tsx — already a generic, caller-driven component with no
   timers of its own; this file supplies the `steps`/statuses and drives
   them forward itself, same pattern `App.tsx` already uses it with). Each
   of the three steps completing fires its own named callback
   (`onAgentContactedCustomer`/`onCustomerApprovedResolution`/
   `onDispositionUpdated`) — a second, larger exception to the original
   "no callback prop" design, since these are real effects the caller
   applies to actual interaction state (a transcript message, a status
   change), not just narration. Per a later explicit follow-up, this list
   no longer ends on its own "close/dismiss" step — that's no longer
   simulated as part of Approve at all (`onAssignmentClosed` stays a real
   prop on this card, just for the separate "flag for review" flow's own
   step list instead; see `FLAG_STEP_LABELS`). `confirmed === "approve"`'s own
   render branch and `approveStepIndex`/its effect are entirely separate
   from the `completed`/`elapsedSeconds` machinery above, which now only
   drives Something else.

   Per a later explicit request, Reject grew its own multi-stage flow,
   parallel to (but distinct from) Approve's — it no longer shares the
   generic `completed`/`elapsedSeconds` spinner at all:
   1. The instant Reject is confirmed, a follow-up question appears asking
      the agent WHY — a `Textarea` + the same inline "Enter" confirm
      affordance used for option selection above (`rejectReason`/
      `rejectReasonSubmitted`).
   2. Only once THAT'S submitted does `onComplete` fire, with the same
      `AGENT_REPLY.reject` text as before, posting the rejection note to
      the transcript. Per an explicit correction, this used to fire the
      instant Reject was confirmed — driven off real state instead of a
      blind timer, "do the same thing as Approve," but still notifying
      Marcus before the agent had even said why; now it waits for the
      reason (`rejectionNoteFiredRef` guards it firing more than once).
   3. Submitting the reason also starts a second `AIProcess` step list
      (`REJECT_STEP_LABELS`/`rejectStepIndex`, same shape as Approve's own
      step machinery): the AI agent asks the customer for a photo of the
      damaged item (`onPhotoRequested` — a real transcript line, the AI
      agent actually said this), then waits for their response.

   Per explicit correction, the customer's photo itself never touches the
   transcript at all — it's rendered right here in this card, directly
   below the step list, once both reject steps finish (a small note plus
   lyra-ui's `AttachmentThumbnail`). Clicking it fires `onPhotoExpand`; this
   card doesn't own the expanded/full-screen state itself — the caller
   (`AgentWorkspaceAdvancedPage.tsx`) takes over the MAIN interaction
   column with it, the same "takes over" mechanic the video call window
   already uses, NOT the transcript column (an earlier pass got this
   backwards — the photo briefly lived as a transcript message with an
   image attachment, expanding inside the transcript itself). Per a later
   explicit request, this is now a real photo (`src/assets/headphones.jpg`,
   `AttachmentThumbnail`'s own `src` prop) rather than the generic photo-
   icon-plus-filename placeholder every other mocked attachment in this app
   still uses.

   Per explicit decision, nothing here auto-opens the Outcome popover or
   auto-selects a disposition — "Flagged for Review" was simply added to
   `OUTCOME_DISPOSITION_OPTIONS` (agent-next-gen-transcript.tsx) for the
   human agent to pick themselves once they've seen the photo.

   Per a later explicit request, the photo isn't the end of the Reject
   flow — a SECOND "How would you like to proceed?" question appears right
   below it (`NextBestActionOptionPicker`, extracted once this and the
   top-level question needed the exact same radio+inline-confirm markup),
   with its own three options answered by `handlePhotoDecisionConfirm`:
   - **Approve** appends the approve summary/`AIProcess` (`approveBlock`)
     below everything already on screen, via `approvedAfterReject` — NOT
     `confirmed`, which stays `"reject"` (see the next paragraph for why).
   - **Reject and provide another reason** appends a fresh round
     (`rejectRounds`) rather than resetting the current one.
   - **Something else** locks in its own "flag for review" `AIProcess`
     (`FLAG_STEP_LABELS`/`flagStepIndex`/`flagConfirmed`): flagging the
     account, updating the session status to "Escalated" (a real status
     change, `onStatusEscalated` — same `handleInteractionStatusChange`
     mechanism `onDispositionUpdated` already uses for Approve), then
     dismissing the assignment (reuses `onAssignmentClosed` — dismissing is
     dismissing, regardless of which path got here).

   Per an explicit bug report ("the conversation should continue in line -
   not reset... treat this like an actual claude session"), Approve/Reject
   at this second question used to ERASE the photo and reason history:
   Approve called `setConfirmed("approve")`, which switched the ENTIRE
   render branch away from `"reject"`; Reject reset `rejectReason`/
   `rejectStepIndex` back to their starting values, hiding the very photo
   the agent had just been asking about. Fixed by making Reject's own state
   an append-only LIST of rounds (`rejectRounds`, each `{ reason,
   reasonSubmitted, stepIndex }`) instead of a few flat fields that get
   overwritten — every earlier round renders exactly as it finished
   (frozen), and only the LAST round is ever "live" (still asking for a
   reason, or still advancing its own `AIProcess`/photo reveal). Approve no
   longer touches `confirmed` at all — `approvedAfterReject` just appends
   `approveBlock` after the rounds, so the original "Refund rejected"
   summary and every round's own history stay exactly as they were,
   consistent with a real conversation where nothing already said gets
   retroactively erased.

   Per a later explicit request, clicking "Takeover" (`marcusWebbReviewing`
   flipping to `false`, `AgentWorkspaceAdvancedPage.tsx`) replaces
   EVERYTHING above with a hand-off moment (`takenOver` prop) — the
   original question(s) no longer make sense once a human is personally
   handling the call instead of directing the AI. A note ("Agent Smith has
   taken over the conversation.") plus a third option list
   (`REMEDY_OPTIONS`: Store Credit / Discount Code / Something else)
   replace them; picking one locks it in (`remedyConfirmed`) and fires
   `onRemedyIssued`. This is the third real use of
   `NextBestActionOptionPicker`'s radio+inline-confirm markup — it's
   generic over the option-value type now (`<T extends string>`) with an
   optional `noteFor` prop (`OPTIONS`/`PHOTO_DECISION_OPTIONS`/
   `REMEDY_OPTIONS` all set it, to `"something-else"`) rather than
   hardcoding that one value in. A separate, short-delay pair of
   transcript lines (the human agent's own
   greeting, then the customer's reply — `onTakeoverGreeting`/
   `onCustomerRespondedToTakeover`) plays out independently of when the
   agent actually picks a remedy, same "narration is real transcript
   effects the caller applies" pattern as everywhere else on this card. Per
   explicit answer, issuing a remedy does NOT change the session status or
   dismiss the assignment — unlike Approve/the flag flow, this one's
   completion is left for the reviewing agent to wrap up manually.

   Per a later explicit request ("the action should be recorded inline with
   the contact"), every real action above now also appends to a growing,
   append-only `actionLog` (`MarcusWebbActionLogEntry[]`), rendered right
   below the context bullets — visible no matter which state the rest of
   the card is currently in, same "nothing already recorded gets erased"
   principle as `rejectRounds`. Two kinds:
   - **`"simple"`** — a bare timestamp + bold title, no icon/border/click
     target. For plain milestones only (per explicit decision, not every
     timer-driven `AIProcess` sub-step, which is already visible live in
     those step lists): the photo arriving, the disposition/status
     changes, and Takeover starting.
   - **`"note"`** — a bordered card (icon + title + timestamp + actor +
     trailing chevron, a description line below); clicking one fires
     `onActionLogEntryOpen` so the caller can show its `detail` (the
     question that was asked, every option that was available, which one
     was picked) in a side panel. For the three genuine DECISIONS on this
     card (the top-level question, the post-photo question, the remedy
     question) — each already `RadioGroup`+confirm-backed. Every note's
     `actorName` is hardcoded `"John Smith"` (per explicit decision) — this
     card still has no concept of the page's own current-agent name beyond
     that one hardcoded string, matching the "Agent Smith"/"John Smith"
     split already established for Takeover's own narration.
   Reject's own top-level decision is a special case: unlike Approve/
   Something-else (whose descriptive text exists the instant they're
   confirmed), Reject's "why" isn't known until the reason `Textarea` is
   submitted a step later — so its note logs then instead (same moment as
   `rejectionNoteFiredRef`'s transcript note), not at the moment of
   confirming. Every later round's own reason submission gets its own
   follow-up note the same way. */

type MarcusWebbNextBestActionSelection = "approve" | "reject" | "something-else";

/** Shared shape for every option list this card renders through
 *  `NextBestActionOptionPicker` below — generic over the option-value type
 *  since there are now three distinct vocabularies (the top-level
 *  approve/reject/something-else, the same again for the post-photo
 *  question, and the post-takeover remedy list, which has no
 *  "something-else" at all). */
interface NextBestActionOption<T extends string> {
  value: T;
  title: string;
  description?: string;
}

type MarcusWebbNextBestActionOption = NextBestActionOption<MarcusWebbNextBestActionSelection>;

const OPTIONS: MarcusWebbNextBestActionOption[] = [
  {
    value: "approve",
    title: "Approve the refund",
    description:
      "The AI agent immediately processes the full $200 refund to Marcus's original payment method, confirms it with him, and resumes the call to close out the request. Once approved there's no further review — reserve this for claims where the damage report and order details already check out.",
  },
  {
    value: "reject",
    title: "Reject the refund",
    description:
      "The AI agent tells Marcus the refund wasn't approved as requested and offers next steps — a replacement, store credit, or escalation to a supervisor. No money moves until a different resolution is reached — use this if the claim needs more verification (e.g. photos of the damage) or doesn't fit policy.",
  },
  {
    value: "something-else",
    title: "Something else",
  },
];

/** Approve's confirmation body — same layout as Lucas's Approve panel (headline, description, Experience Memory line,
 *  card, confirm button), with Marcus's refund content. */
const MARCUS_PHOTO_ARTICLE: KnowledgeArticleCardData = {
  id: "damage-photo-verification",
  title: "RET-4.1 · Verifying damage by photo",
  body: "Before approving a damage refund, ask the customer to send clear photos of the damaged item so the claim can be verified and attached to the order.",
  internalNote: "Photo verification is required for refunds over the $100 auto-approval limit. Do not approve until photos are on file.",
  webLinks: [],
  processSteps: [
    "Ask the customer to photograph the damage from at least two angles, including the packaging.",
    "Have them include the order number or packing slip in one photo.",
    "Attach the photos to the order and confirm the damage matches the report.",
    "Approve the refund, or request replacement photos if the damage can't be verified.",
  ],
};

/** Confirmation body for an option (Approve / Reject), shown in place of the plain description. */
interface MarcusOptionPanel {
  headline: string;
  description: string;
  memory: string;
  /** Optional summary card (omitted for Marcus: the headline already says the amount). */
  card?: { title: string; sub: string };
  confirmLabel: string;
  /** Knowledge article linked from the panel (defaults to the photo-verification article). */
  article?: KnowledgeArticleCardData;
}

const MARCUS_POLICY_ARTICLE: KnowledgeArticleCardData = {
  id: "refund-alternatives",
  title: "RET-2.3 · Refund exceptions and alternatives",
  body: "When a refund can't be approved as requested, offer an alternative resolution instead: a replacement, store credit, or escalation to a supervisor.",
  internalNote: "Claims over the $100 auto-approval limit that fail verification must not be refunded until a supervisor has reviewed them.",
  webLinks: [],
  processSteps: [
    "Explain to the customer why the refund can't be approved as requested.",
    "Offer a replacement or store credit for the full order value.",
    "If the customer declines, escalate the claim to a supervisor with the order and damage details.",
    "Log the outcome on the order so no money moves until a resolution is agreed.",
  ],
};

const MARCUS_REJECT_PANEL: MarcusOptionPanel = {
  headline: "Reject the refund: no money moves until a different resolution is reached",
  description:
    "The AI agent tells Marcus the refund wasn't approved as requested and offers a replacement, store credit, or escalation to a supervisor. Use this if the claim needs more verification or doesn't fit policy.",
  memory: "Experience Memory: refund exceeds the $100 auto-approval limit · damage reported on delivery",
  confirmLabel: "Reject the Refund",
  article: MARCUS_POLICY_ARTICLE,
};

const MARCUS_APPROVE_PANEL: MarcusOptionPanel = {
  headline: "Approve the refund: return the full $200.00 to Marcus's original payment method",
  description: "The cracked ear cup was reported on delivery and the refund qualifies under the return policy.",
  memory: "Experience Memory: damage reported on order #48213 · on hold while the refund is reviewed",
  confirmLabel: "Authorize the Refund",
};

// What actually shows once an option is confirmed — icon/label for the
// locked summary block, and an optional "command" sentence underneath it.
// `something-else`'s command is the agent's own typed note instead (see
// its render site below), so it has no entry here. Reject has no `command`
// — per explicit correction, the box appears the instant Reject is
// confirmed, before any reason has been typed and before Marcus has
// actually been told anything (see this file's own top doc comment for
// when the real transcript note fires), so a "Notifying Marcus..." line
// here would be inaccurate at that moment.
const CONFIRMED_META: Record<
  Exclude<MarcusWebbNextBestActionSelection, "something-else">,
  { icon: React.ReactNode; label: string; command?: string }
> = {
  approve: {
    icon: <CheckCircle2 className="h-4 w-4 text-lyra-status-success-strong" strokeWidth={1.5} aria-hidden="true" />,
    label: "Refund approved",
    command: "Processing the $200 refund to Marcus's original payment method.",
  },
  reject: {
    icon: <XCircle className="h-4 w-4 text-lyra-status-critical-strong" strokeWidth={1.5} aria-hidden="true" />,
    label: "Refund rejected",
  },
};

// What the AI agent "says" back on the call once the action completes —
// appended to Marcus's transcript via `onComplete` (see this file's own
// top doc comment). `something-else` has no fixed line here since it
// depends on the agent's own typed note (see its call site below).
const AGENT_REPLY: Record<Exclude<MarcusWebbNextBestActionSelection, "something-else">, string> = {
  approve:
    "Great news — I've received approval from a supervisor. I'm processing your $200 refund now; you should see it back on your original payment method within 3-5 business days. Is there anything else I can help with?",
  reject:
    "Thanks for holding — I heard back from a supervisor, and unfortunately this refund wasn't approved as submitted. I'd like to offer you a replacement or store credit instead — which would you prefer?",
};

// Was restored per an earlier explicit follow-up request ("add back in the
// steps after the refund is approved/rejected"), then per a LATER explicit
// request ("hide the approval steps and just show the agent working
// animation when approve is clicked") turned back off again — "hide, don't
// destroy" still applies: flipping this back to `true` restores the full
// `AIProcess` step list with no other changes needed. While `false`,
// `approveBlock` (below) doesn't render nothing — it falls back to the
// same plain `Spinner` + status-line treatment Reject/Something else
// already use elsewhere in this file (see this file's own top doc comment,
// "drops the generic Spinner+elapsed-timer row for lyra-ui's own AIProcess
// step list" — this flag now toggles between those same two looks, rather
// than between the step list and nothing).
const SHOW_APPROVE_PROCESSING_STEPS = false;

// Per explicit request ("since we are not in Guide Mode we should limit
// the amount of feedback from a reject selection ... just display the
// attached response from the ai ... show the agent working and agent
// typing states and animate as you do in the accept condition"), Reject
// round 0's own `AIProcess` "Requesting additional information" step
// list, its attached photo, and the "how would you like to proceed"
// photo-decision question that used to follow it are all hidden now —
// same "hide, don't destroy" flag pattern as `SHOW_APPROVE_PROCESSING_
// STEPS` just above (and, while off, the exact same replacement look:
// working spinner → `MarcusWebbAiTypingIndicator` →  ONE completion
// `MarcusWebbAiChatBubble`, no further round-trip — see `rejectBlock`/
// `rejectCompletionTyping`/`rejectCompletionTimestamp`, their own doc
// comments). The underlying simulated steps (`onPhotoRequested`, the
// "Refund rejected. Requested customer provide visual proof" milestone)
// still run in the background unchanged, same "simulate, don't actually call anything,
// only the VISUAL is toggled" convention `SHOW_APPROVE_PROCESSING_STEPS`
// already established — flipping this back to `true` restores the full
// original flow (photo, photo-decision question, "reject again" round-
// trip) with no other changes needed.
const SHOW_REJECT_PROCESSING_STEPS = false;

// Per explicit request, hides the "Do something" `AIInput` for now ("I may
// bring it back so don't delete it") — "hide, don't destroy," same pattern
// as `SHOW_APPROVE_PROCESSING_STEPS` just above. `commandSlotContent`'s own
// render (below) is gated on this flag; the rest of that section (state,
// the `onSubmit` handler, the suggested-article cards it appends) stays
// fully wired, so flipping this back to `true` restores the input with no
// other changes needed.
const SHOW_DO_SOMETHING_INPUT = false;

// Per explicit request, hides the separate "Contact Overview" card now
// that its facts are folded into the top-level bubble's own intro text
// (see `MarcusWebbTaskCard`'s call site) — "hide, don't destroy," same
// pattern as the two flags above. `contactOverviewItem`/
// `buildContactOverviewContainer` stay fully defined; only the render
// call site is gated.
const SHOW_CONTACT_OVERVIEW = false;

// "Approve"-only step list — see this file's own top doc comment for why
// this is separate from `completed`/`AGENT_REPLY` above (Reject/Something
// else keep the plain spinner treatment; only Approve gets this).
const APPROVE_STEP_LABELS = [
  "AI Agent contacting customer",
  "Waiting for customer response",
  'Disposition updated to "Exception Approved"',
];

// Reject-only step list, run AFTER the agent submits a reason (see this
// file's own top doc comment). Only step 1 fires a real callback
// (`onPhotoRequested`) — step 2 completing just reveals the photo+note
// block rendered locally below (see `rejectStepIndex`'s own render site).
const REJECT_STEP_LABELS = ["AI Agent requesting photo of damaged item", "Waiting for customer response"];

// "Something else" round's final `stepIndex` — see `SomethingElseRound`'s
// own doc comment, above its state declaration, for the full step
// breakdown (0 = performing, 1 = instruction card + analyzing, 2 = done).
const SOMETHING_ELSE_STEPS = 2;

// How long `MarcusWebbAiTypingIndicator` stays up after the approval
// finishes, before the completion bubble itself appears — see
// `completionTyping`'s own doc comment, below. Same 1500ms cadence the
// approve step list/spinner already advances on (`approveStepIndex`'s own
// effect), so the whole sequence reads as one consistent pace rather than
// switching speeds partway through.
const COMPLETION_TYPING_DELAY_MS = 1500;

// Second "how would you like to proceed?" question, asked once the
// customer's photo comes back (see this file's own top doc comment) —
// same option shape as `OPTIONS` above, reusing the exact same
// approve/reject/something-else semantics: Approve here locks `confirmed`
// over to `"approve"` (re-using that entire flow verbatim, as if it had
// been picked from the very start); Reject loops back to a fresh reason
// question (`handlePhotoDecisionConfirm` below); Something else is its own
// "flag for review" process (`FLAG_STEP_LABELS`).
const PHOTO_DECISION_OPTIONS: MarcusWebbNextBestActionOption[] = [
  {
    value: "approve",
    title: "Approve the refund",
    description: "The photo adequately displays replaceable damage — proceed with the $200 refund as originally requested.",
  },
  {
    value: "reject",
    title: "Reject and provide another reason",
    description: "The photo doesn't resolve the concern — ask Marcus for more information before deciding.",
  },
  {
    value: "something-else",
    title: "Something else",
  },
];

// "Something else"-at-the-photo-decision-only step list — see this file's
// own top doc comment. Step 3 reuses the same `onAssignmentClosed` prop
// Approve's own step 4 already uses (dismissing is dismissing, regardless
// of which path got here).
const FLAG_STEP_LABELS = [
  "Flagging account for review",
  'Updating status to "Escalated"',
  "Unassigning and dismissing assignment",
];

// Post-takeover remedy options — see this file's own top doc comment.
type RemedySelection = "store-credit" | "discount-code" | "something-else";
const REMEDY_OPTIONS: NextBestActionOption<RemedySelection>[] = [
  {
    value: "store-credit",
    title: "Store Credit",
    description:
      "Issue the full $200 as store credit Marcus can use toward a future purchase — no cash refund, but the fastest way to make this right.",
  },
  {
    value: "discount-code",
    title: "Discount Code",
    description:
      "Send Marcus a discount code for a future order instead of a refund — keeps the current order as-is while still offering him something for the trouble.",
  },
  {
    value: "something-else",
    title: "Something else",
  },
];

/** One entry in the growing, append-only action log rendered below the
 *  context bullets — see this file's own top doc comment for the full
 *  "simple" vs. "note" distinction. Per a later explicit follow-up, the
 *  once-separate `"transactions"` kind (an inline expandable accordion)
 *  is gone — a "Something else" instruction now renders as a plain
 *  `ActionLogNoteEntry`-style row (title = the instruction itself,
 *  truncated) that opens the transactions table in a side panel instead
 *  of expanding inline, same as every other note row. See
 *  `somethingElseRounds`' own render call site. */
export interface MarcusWebbActionLogEntry {
  id: string;
  kind: "simple" | "note";
  title: string;
  timestamp: string;
  /** `"note"` only. */
  icon?: React.ReactNode;
  /** For `"note"`, always `"John Smith"` today (see this file's own top
   *  doc comment for why) — the human agent's own decisions/instructions.
   *  For `"simple"`, `"Cognigy AI Agent"` on the handful of milestones the
   *  AI itself performs (disposition updates, status changes, requesting
   *  the photo — see `logMilestone`'s own call sites), `undefined` on the
   *  one genuinely human-triggered "simple" milestone ("Agent Smith has
   *  taken over the conversation.", which already names the human in its
   *  own title) and on every "simple" milestone logged before this
   *  distinction existed. Per explicit follow-up request ("for anything
   *  the AI does, credit the AI"). */
  actorName?: string;
  /** `"note"` only — the quoted line below the header row, shown in its
   *  own side panel. */
  description?: string;
  /** `"note"` only — powers the side panel `onActionLogEntryOpen` opens:
   *  the question that was asked, and every option that was available. */
  detail?: {
    context: string;
    options: { title: string; description?: string; selected: boolean }[];
  };
}

/** The side-panel body for one `"note"` entry — the caller (`AgentWorkspace
 *  AdvancedPage.tsx`) renders this inside its own floating overlay (the
 *  same "View customer info" `InteriorPanel` mechanic, per explicit
 *  request), passing in whichever entry was clicked. */
export function MarcusWebbActionDetailPanelBody({ entry }: { entry: MarcusWebbActionLogEntry }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {entry.detail && (
        <>
          <p className="lyra-body-md-emphasis text-lyra-fg-default">{entry.detail.context}</p>
          <div className="flex flex-col gap-2">
            {entry.detail.options.map((option) => (
              <div
                key={option.title}
                className={cn(
                  "flex items-start gap-2 rounded-lyra-md border p-3",
                  option.selected
                    ? "border-lyra-border-active bg-lyra-bg-active-subtle"
                    : "border-lyra-border-subtle bg-lyra-bg-surface-base"
                )}
              >
                {option.selected && (
                  <CheckCircle2
                    className="h-4 w-4 shrink-0 mt-0.5 text-lyra-status-success-strong"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="lyra-body-md-emphasis text-lyra-fg-default">{option.title}</span>
                  {option.description && (
                    <span className="lyra-body-sm text-lyra-fg-secondary">{option.description}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {entry.description && (
        <div className="flex flex-col gap-1">
          <p className="lyra-body-sm-emphasis text-lyra-fg-default">Details</p>
          <p className="lyra-body-md text-lyra-fg-default">"{entry.description}"</p>
        </div>
      )}
    </div>
  );
}

/** Placeholder order data for the new order-info side panel the top-level
 *  bubble's "order for noise-cancelling headphones" link opens — per
 *  explicit request, same static-scaffold-first convention as the
 *  transactions table (`agent-next-gen-marcus-webb-transactions-panel.tsx`)
 *  and the knowledge-article card: real-looking placeholder content, no
 *  backend behind it yet. Same facts Contact Overview's own bullets
 *  already used (order #48213, noise-cancelling headphones, $200, placed
 *  last Tuesday, cracked ear cup). */
export interface MarcusWebbOrderInfo {
  orderId: string;
  itemName: string;
  price: string;
  orderedDate: string;
  status: string;
  shippingAddress: string;
}

export const MARCUS_WEBB_ORDER: MarcusWebbOrderInfo = {
  orderId: "#48213",
  itemName: "Noise-Cancelling Headphones",
  price: "$200.00",
  orderedDate: "Last Tuesday",
  status: "Delivered — customer reported a cracked ear cup",
  shippingAddress: "412 Birchwood Lane, Springfield, IL 62704",
};

/** The side-panel body for the order-info panel — same field-row shape
 *  (label above value) other detail panels in this app already use. */
export function MarcusWebbOrderDetailPanelBody({ order }: { order: MarcusWebbOrderInfo }) {
  const fields: { label: string; value: string }[] = [
    { label: "Order ID", value: order.orderId },
    { label: "Item", value: order.itemName },
    { label: "Price", value: order.price },
    { label: "Ordered", value: order.orderedDate },
    { label: "Status", value: order.status },
    { label: "Shipping address", value: order.shippingAddress },
  ];
  return (
    <div className="flex flex-col gap-4 p-4">
      {fields.map((field) => (
        <div key={field.label} className="flex flex-col gap-1">
          <p className="lyra-body-sm-emphasis text-lyra-fg-default">{field.label}</p>
          <p className="lyra-body-md text-lyra-fg-default">{field.value}</p>
        </div>
      ))}
    </div>
  );
}

/** The side-panel body for a "Something else" instruction's transactions
 *  table — per explicit follow-up request, this replaces the old inline
 *  expandable accordion (`MarcusWebbInstructionTransactionsEntry`,
 *  removed): the instruction row now opens this in a side panel instead,
 *  same as every other note-row detail. Quotes the instruction itself
 *  above the table since the row's own title is now that same text,
 *  truncated — this is where the full, untruncated text is guaranteed
 *  visible.
 *
 *  Per explicit follow-up ("only display the last 10 transactions for
 *  the something else on the first selection for Marcus Webb. For
 *  subsequent something elses ... just open the panel with the 'Agent
 *  Smith requested {something else} {time}{date}'"), the real table
 *  (`MarcusWebbTransactionsTable`) is now gated on `showFullTransactions`
 *  — see `SomethingElseRound`/`PostCompletionRound`'s identical field for
 *  how that's computed (true only for the very first "something else"
 *  round ever submitted this session, across both mechanisms). Every
 *  later round instead gets a plain placeholder line — deliberately
 *  minimal for now ("we may expand on this content in the future"), not
 *  worth its own dedicated panel component yet. */
export function MarcusWebbTransactionsDetailPanelBody({
  note,
  timestamp,
  date,
  showFullTransactions,
}: {
  note: string;
  timestamp: string;
  date: string;
  showFullTransactions: boolean;
}) {
  if (!showFullTransactions) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="lyra-body-md text-lyra-fg-default">
          Agent Smith requested "{note}" at {timestamp} on {date}.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="lyra-body-md text-lyra-fg-default">"{note}"</p>
      <MarcusWebbTransactionsTable />
    </div>
  );
}

/** A plain milestone/state-change row — timestamp above bold title, no
 *  icon/border/click target. See this file's own top doc comment.
 *
 *  `animate-in slide-in-from-bottom-4 fade-in-0 duration-200` — per
 *  explicit request ("add animations to the notes and AI chats, use the
 *  same animation as when an agent is chatting with a customer"), the
 *  same entrance treatment this file already uses for the "Something
 *  else" round's own live-appearing rows (see that render site's
 *  identical classes). Safe on every re-render: each entry keeps the same
 *  `key` (`entry.id`) once logged, so React never remounts an
 *  already-rendered entry — this only plays once, the moment a NEW entry
 *  is appended to `actionLog`. */
function ActionLogSimpleEntry({
  timestamp,
  title,
  actorName,
}: {
  timestamp: string;
  title: string;
  /** Per explicit follow-up request ("for anything the AI does, credit
   *  the AI (ie. 2:25PM Cognigy AI Agent Disposition updated to
   *  'Exception Approved')") — an AI-performed milestone (see
   *  `logMilestone`'s own call sites for which ones those are) now shows
   *  "{timestamp} · Cognigy AI Agent" in this row's header, the exact
   *  same "{timestamp} · Cognigy AI Agent" format `MarcusWebbAiChatBubble`
   *  already uses for the AI's own chat messages, rather than a plain
   *  bare timestamp that leaves the reader guessing who/what did this.
   *  `undefined` (every milestone logged before this request, and the
   *  one genuinely human-triggered milestone — "Agent Smith has taken
   *  over the conversation.", which already names the human right in its
   *  own title) keeps the original plain-timestamp header untouched. */
  actorName?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 animate-in slide-in-from-bottom-4 fade-in-0 duration-200">
      <span className="lyra-body-sm text-lyra-fg-secondary">
        {actorName ? `${timestamp} · ${actorName}` : timestamp}
      </span>
      <span className="lyra-body-md-emphasis text-lyra-fg-default">{title}</span>
    </div>
  );
}

/** A clickable, bordered decision row — icon + title + timestamp + actor,
 *  trailing chevron, description below. See this file's own top doc
 *  comment. `selected` (this entry's own side panel is the one currently
 *  open) swaps in the same `bg-lyra-status-info-subtle` tint the Home
 *  page's Contact History rows use for their own "this row's summary is
 *  open" state (agent-next-gen-contact-history.tsx) — per explicit
 *  request, for visual consistency with that established pattern.
 *  `min-w-0 flex-1 truncate` on the title span — per a later explicit
 *  request ("Something else" instructions use their own full text as
 *  this title now, which can run long) — lets a long title truncate
 *  with an ellipsis instead of pushing the timestamp/actor/chevron out
 *  of the row or wrapping; harmless for every other (short, fixed)
 *  title this component already renders.
 *
 *  `w-full` on the button itself — per explicit bug report (confirmed
 *  via screenshot: a "Something else" round's instruction row rendered
 *  as a narrow, content-sized pill instead of spanning the row). Root
 *  cause: every OTHER caller renders this `<button>` as a DIRECT flex
 *  item of a `flex flex-col` list (`actionLog.map(...)`), where the
 *  parent's default `align-items: stretch` forces it full width
 *  regardless of the button's own sizing — but a `<button>` (a form
 *  control) is one of the few elements whose `width: auto` resolves via
 *  shrink-to-fit/intrinsic sizing rather than "fill available space" the
 *  way a plain `<div>` would, so as soon as ANY caller nests it one
 *  level deeper inside its own wrapper div (the `somethingElseRounds`
 *  render block does, for its entrance-animation classes — see that
 *  call site), it's no longer a flex item and that stretch protection
 *  disappears. Making the button explicitly `w-full` fixes it at the
 *  source instead of leaning on incidental flex-stretch from whatever
 *  happens to wrap it — harmless for every existing direct-flex-item
 *  usage, which was already effectively full width. */
function ActionLogNoteEntry({
  entry,
  selected,
  onClick,
}: {
  entry: MarcusWebbActionLogEntry;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      onClick={onClick}
      className={cn(
        // Entrance animation — see `ActionLogSimpleEntry`'s own doc
        // comment just above for the "why"/safety-on-rerender reasoning;
        // identical classes, same stable-`key`-per-entry guarantee.
        "flex w-full flex-col gap-1 rounded-lyra-md border p-3 text-left transition-colors animate-in slide-in-from-bottom-4 fade-in-0 duration-200",
        selected
          ? "border-lyra-border-active bg-lyra-status-info-subtle"
          : "border-lyra-border-subtle bg-lyra-bg-surface-base hover:border-lyra-state-border-hover-neutral"
      )}
    >
      <div className="flex items-center gap-2">
        {entry.icon}
        <span className="lyra-body-md-emphasis text-lyra-fg-default min-w-0 flex-1 truncate">{entry.title}</span>
        <span className="lyra-body-sm text-lyra-fg-secondary shrink-0">{entry.timestamp}</span>
        {entry.actorName && <span className="lyra-body-sm text-lyra-fg-secondary shrink-0">{entry.actorName}</span>}
        <ChevronRight
          className="ml-auto h-4 w-4 shrink-0 text-lyra-fg-secondary"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </div>
      {entry.description && (
        <p className="lyra-body-sm text-lyra-fg-secondary">"{entry.description}"</p>
      )}
    </button>
  );
}

/** Every `activeQuestionItem` — the top-level "How would you like to
 *  proceed?", the post-takeover "Suggested remedies," and the post-photo
 *  "How would you like to proceed?" decision — renders as an incoming
 *  chat message FROM the AI agent, per explicit request (with a reference
 *  screenshot): an avatar + sender name + timestamp header, then a gray
 *  message bubble holding the question text and (while it's still the
 *  live `activeQuestionItem`) its options below it. Modeled on lyra-ui's
 *  `ChatMessage` (`chat-message.tsx`) — same avatar size/shape
 *  (`h-7 w-7 rounded-full`), same bubble corner squared toward the avatar
 *  (`rounded-tl-none`), same gray "other party" bubble background
 *  (`bg-lyra-state-hover`), and the same `"{timestamp} · {name}"` header
 *  convention already established there — built locally rather than
 *  reusing `ChatMessage` directly since that component takes a plain
 *  `initials: string` for its avatar (not an icon) and has no notion of
 *  "keep rendering after answered, just without the options." Full width
 *  (not `ChatMessage`'s `max-w-[80%]`) since it holds real form content,
 *  not a short text message.
 *
 *  Per explicit follow-up (screenshot 2), the bubble's TEXT stays visible
 *  once its question has been answered — it doesn't disappear the way
 *  the old `Accordion`-based card used to — only its options go away.
 *  This component itself doesn't know "answered or not"; the caller
 *  simply stops passing `children` once the question is no longer the
 *  live `activeQuestionItem` (see `askedQuestions`, below).
 *
 *  `title` widened from `string` to `React.ReactNode` (and its own
 *  `<p>` wrapper dropped in favor of the caller supplying its own markup)
 *  per a later explicit request: the top-level bubble's intro is now a
 *  multi-paragraph narrative with inline links (see its own call site),
 *  which can't be wrapped in a single outer `<p>`. Remedies/photo-decision
 *  still just pass a plain string, wrapped in their own `<p>` at their own
 *  call sites — see `activeQuestionItem`'s `"remedies"`/`"photo-decision"`
 *  branches.
 *
 *  `animate-in slide-in-from-bottom-4 fade-in-0 duration-200` on the
 *  outer wrapper — see `ActionLogSimpleEntry`'s own doc comment for the
 *  "why"/safety reasoning (same explicit request, same stable-`key`-per-
 *  bubble guarantee: `askedQuestions`/the completion bubble/etc. all key
 *  each `MarcusWebbAiChatBubble` by a stable id, so this only plays once
 *  per bubble, the moment it first appears).
 *
 *  Per explicit follow-up (with a reference screenshot comparing this
 *  against a real customer `ChatMessage` bubble), the "{timestamp} ·
 *  Cognigy AI Agent" header used to sit on its OWN line above the whole
 *  avatar+bubble row — `ChatMessage` instead keeps the avatar and header
 *  in the SAME row (header inside the content column beside the avatar,
 *  directly above the bubble), which is what actually aligns the header
 *  text next to the avatar instead of floating disconnected above it.
 *  Restructured to match exactly: the avatar row now wraps a content
 *  column (`flex min-w-0 flex-1 flex-col gap-1`) holding the header THEN
 *  the bubble, mirroring `chat-message.tsx`'s own
 *  `flex items-start gap-2` → `flex min-w-0 flex-col gap-1` shape. */
/** Marcus's refund approval request, in the same blue "Approval request" accordion the Lucas Thomas flow uses. */
const MARCUS_WEBB_APPROVAL_SUMMARY: TranscriptApprovalSummary = {
  title: "Approval request · Cognigy AI Agent",
  headline: "Marcus Webb is requesting a $200 refund",
  description:
    "Marcus placed an order for noise-cancelling headphones last Tuesday and reported the item arrived with a cracked ear cup. I've confirmed the $200 refund qualifies, but it exceeds our $100 auto-approval limit, so I've placed Marcus on hold pending your sign-off.",
  checklist: [
    { label: "Order verified", link: "memory:order-placed", detail: "Noise-cancelling headphones, order #48213, placed last Tuesday", status: "done" },
    { label: "Damage reported", link: "memory:damage-reported", detail: "Cracked ear cup reported by the customer", status: "done" },
    { label: "Refund eligibility", link: "memory:refund-escalated", detail: "$200 refund qualifies under the return policy", status: "done" },
    { label: "Refund approval", link: "memory:refund-escalated", detail: "Exceeds the $100 auto-approval limit", status: "attention", badge: "Needs a person" },
  ],
  memoryTitle: "Experience Memory",
  memory: [
    "Marcus is on hold while this is reviewed",
    "Refund exceeds the $100 auto-approval limit",
    "Cracked ear cup reported on delivery",
  ],
  sentimentLabel: "Customer sentiment",
  sentimentValue: "Concerned",
  sentimentLevel: 3,
};

function MarcusWebbAiChatBubble({
  title,
  timestamp,
  children,
}: {
  title: React.ReactNode;
  timestamp: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 animate-in slide-in-from-bottom-4 fade-in-0 duration-200">
      {/* The AI avatar: lyra's AI accent fill (`bg-accent`, #6149C1 by
          default — the exact shade requested, distinct from
          `accent-purple-strong`'s #634DBD) and the text on it; a brand
          accent (Settings → Appearance) overrides both. */}
      <Avatar icon={Bot} size="xs" className="bg-lyra-bg-accent text-lyra-fg-on-accent" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="lyra-body-sm text-lyra-fg-secondary px-1">{timestamp} · Cognigy AI Agent</span>
        <div className="flex min-w-0 flex-col gap-3 rounded-lyra-lg rounded-tl-none bg-lyra-accent-purple-soft px-4 py-3">
          {title}
          {children}
        </div>
      </div>
    </div>
  );
}

/** "AI agent is typing" indicator — shown for `COMPLETION_TYPING_DELAY_MS`
 *  right after the approval finishes, before the completion
 *  `MarcusWebbAiChatBubble` itself appears (see `completionTyping`'s own
 *  doc comment). Per explicit request ("use the same typing animation as
 *  the customer typing animation"), same three-dot `animate-bounce`
 *  bubble as the transcript's own customer-side `TypingIndicator`
 *  (agent-next-gen-transcript.tsx) — staggered 0/150/300ms delays,
 *  identical bubble shape/colors. Deliberately NOT that component reused
 *  directly: this needs the AI agent's own avatar (matching
 *  `MarcusWebbAiChatBubble`'s just above — blue circle, `Bot` icon), not
 *  `TypingIndicator`'s customer-colored initials/person avatar, and this
 *  card has no `Contact`/`narrow`/`bubbleFullWidth` measurements to plumb
 *  through for it. No header line above it (unlike `MarcusWebbAiChatBubble`'s
 *  own "{timestamp} · Cognigy AI Agent") — there's no timestamp yet to
 *  show until the real message lands, same reasoning `TypingIndicator`
 *  itself skips a header entirely. */
function MarcusWebbAiTypingIndicator() {
  return (
    <div
      className="flex items-start gap-2 animate-in slide-in-from-bottom-4 fade-in-0 duration-200"
      aria-live="polite"
      aria-label="AI agent is typing"
    >
      {/* The AI avatar: lyra's AI accent fill (`bg-accent`, #6149C1 by
          default — the exact shade requested, distinct from
          `accent-purple-strong`'s #634DBD) and the text on it; a brand
          accent (Settings → Appearance) overrides both. */}
      <Avatar icon={Bot} size="xs" className="bg-lyra-bg-accent text-lyra-fg-on-accent" />
      <div className="rounded-lyra-lg rounded-tl-none bg-lyra-accent-purple-soft px-4 py-3.5">
        <div className="flex items-center gap-1">
          {[0, 150, 300].map((delayMs) => (
            <span
              key={delayMs}
              className="block h-1.5 w-1.5 animate-bounce rounded-full bg-lyra-accent-purple-strong"
              style={{ animationDelay: `${delayMs}ms` }}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** The inline "Enter"-style confirm trigger used everywhere on this card
 *  (per-option-row, and every option's own inline note row — "something
 *  else", "reject") — per explicit request, a solid-filled `Button`
 *  (`variant="default"`, lyra-ui's only true filled/primary style) instead
 *  of the original ghost `ActionIconButton`, for more visible "this is the
 *  action to take" affordance. Same `CornerDownLeft` glyph throughout —
 *  only the fill changed, not the icon (see this file's own top doc
 *  comment for why that icon was chosen in the first place). */
function InlineSubmitButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="default" size="icon-sm" title="Confirm" aria-label="Confirm" disabled={disabled} onClick={onClick}>
      <CornerDownLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
    </Button>
  );
}

/** The "Dismiss And Unassign" / "Something Else" action row on EVERY
 *  completion-style `MarcusWebbAiChatBubble` — the original Approve/Reject
 *  completion bubbles, and every subsequent `PostCompletionRound`'s own
 *  response bubble after it (see that state's own doc comment,
 *  `postCompletionRounds`). Extracted once the same row needed to appear
 *  in more than one place with identical behavior: per explicit request
 *  ("any time something else is clicked from an ai chat bubble open the
 *  input field and if something is submitted, add a note inline and
 *  perform the agent working and then have the agent respond"),
 *  "Something Else" no longer a no-op — it swaps this same row for a
 *  `Textarea` + `Button`, submitting which is what appends a new round.
 *  `inputOpen`/`note`/`onNoteChange` are lifted to the caller (one shared
 *  `postCompletionInputOpen`/`postCompletionNote` pair covers whichever
 *  bubble currently renders this — only ever one at a time, since only
 *  the LAST relevant bubble ever renders it live).
 *
 *  Per explicit follow-up ("match the something else input design to the
 *  other something else inputs — perform task button below instead of
 *  inline"), the input no longer pairs the `Textarea` with an
 *  `InlineSubmitButton` beside it — it now matches `MarcusWebbTaskCard`'s
 *  own "something else" note exactly: the `Textarea` alone, then a
 *  separate full "Perform Task" `Button` below it (`variant="default"
 *  size="md" className="self-start"`), same classes verbatim. */
function MarcusWebbCompletionActions({
  onDismissAndUnassign,
  inputOpen,
  note,
  onNoteChange,
  onOpenInput,
  onSubmit,
}: {
  onDismissAndUnassign?: () => void;
  inputOpen: boolean;
  note: string;
  onNoteChange: (value: string) => void;
  onOpenInput: () => void;
  onSubmit: () => void;
}) {
  if (inputOpen) {
    return (
      <div className="flex flex-col gap-3 animate-in slide-in-from-bottom-4 fade-in-0 duration-200">
        <Textarea
          rows={2}
          placeholder="Describe what you'd like the AI agent to do instead..."
          value={note}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onNoteChange(e.target.value)}
        />
        <Button
          variant="default"
          size="md"
          className="self-start"
          disabled={note.trim().length === 0}
          onClick={onSubmit}
        >
          Perform Task
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="md" onClick={onDismissAndUnassign}>
        Dismiss And Unassign
      </Button>
      <Button variant="outline" size="md" onClick={onOpenInput}>
        Something Else
      </Button>
    </div>
  );
}

/** The radio-options-with-an-inline-"Enter"-confirm-button block, shared by
 *  every option list on this card — extracted once the top-level and
 *  post-photo questions needed the exact same markup/behavior, and made
 *  generic over the option-value type once a third list (the post-takeover
 *  remedies) needed it too but has no free-text option at all. `notes` is
 *  a per-option-value map of which option(s) show a `Textarea` beside
 *  their own inline confirm instead of a confirm button on their own row
 *  — a map rather than a single scalar since, per explicit request, the
 *  top-level list needs TWO independent notes at once (`reject`'s reason
 *  and `something-else`'s free text), each with its own bound state.
 *  Omit `notes` entirely for a list where every option confirms directly,
 *  like the remedies. While a given option's own note is showing, that
 *  option's `description` is hidden in favor of the note `Textarea` —
 *  per explicit request, for "Reject the refund" specifically, so its
 *  long descriptive subhead doesn't sit above the reason input it no
 *  longer needs to explain once the agent's already picked it. */
function NextBestActionOptionPicker<T extends string>({
  options,
  selected,
  onSelectedChange,
  onConfirm,
  confirmDisabled,
  notes,
}: {
  options: NextBestActionOption<T>[];
  selected: T | undefined;
  onSelectedChange: (value: T) => void;
  onConfirm: (value: T) => void;
  confirmDisabled: boolean;
  notes?: Partial<
    Record<T, { value: string; onChange: (value: string) => void; placeholder?: string; label?: string }>
  >;
}) {
  return (
    // `selected ?? ""`, not bare `selected` — Radix's `RadioGroup.Root`
    // treats a `value` of `undefined` as "uncontrolled" (its own
    // `useControllableState` falls back to internal state whenever the
    // prop is `undefined`), so resetting `selected` back to `undefined`
    // after a confirm (see `handleTopLevelConfirm`'s "something-else"
    // branch, which needs the picker to visually clear for the next
    // round) silently failed to un-check the previously-picked radio —
    // confirmed via screenshot: "Something else" stayed shown as selected
    // after confirming and having its own `selected` state reset. `""` is
    // never a real option `value` here, so it reads as "nothing selected"
    // while staying genuinely controlled.
    <RadioGroup value={selected ?? ""} onValueChange={(value) => onSelectedChange(value as T)}>
      {options.map((option) => {
        const note = notes?.[option.value];
        const isSelected = selected === option.value;
        const showNote = isSelected && !!note;
        return (
          <div
            key={option.value}
            className={cn(
              "flex flex-col gap-2 rounded-lyra-md border p-3 transition-colors",
              // `has-[[role=radio]:focus-visible]` — per explicit request,
              // this option now reads as a BUTTON (see `RadioGroupItem`'s
              // own `className` below, which visually hides the radio
              // circle) rather than a radio-list row, but the underlying
              // control is still a real Radix radio for accessible
              // single-select semantics. Hiding it moves its own
              // `focus-visible` ring off-screen with it, so the ring is
              // re-anchored here, on the row a keyboard user actually
              // sees, instead of being lost entirely.
              "has-[[role=radio]:focus-visible]:ring-2 has-[[role=radio]:focus-visible]:ring-lyra-border-focus",
              isSelected
                ? "border-lyra-border-active bg-lyra-bg-active-subtle"
                : "border-lyra-border-subtle bg-lyra-bg-surface-base hover:border-lyra-state-border-hover-neutral"
            )}
          >
            <div className="flex items-start gap-2">
              <RadioGroupItem
                value={option.value}
                // `[&_[role=radio]]:sr-only` — hides just the visible
                // circle indicator (not exposed as its own prop by
                // lyra-ui's `RadioGroupItem`, and not worth modifying that
                // core component for yet) while keeping it in the
                // accessibility tree and focusable. Clicking anywhere in
                // this row already selects the radio regardless — it's
                // nested inside `RadioGroupItem`'s own wrapping `<label>`,
                // which forwards clicks to it independent of the circle's
                // visibility.
                className="flex-1 items-start [&_[role=radio]]:sr-only"
                label={
                  <span className="flex flex-col gap-0.5">
                    <span className="lyra-body-md-emphasis text-lyra-fg-default">{option.title}</span>
                    {option.description && !showNote && (
                      <span className="lyra-body-sm text-lyra-fg-secondary">{option.description}</span>
                    )}
                  </span>
                }
              />
              {/* Inline "confirm" trigger — only on the currently selected
                  row, per explicit request ("like the enter button ...
                  in screenshot 2"). Not for an option with its own
                  `note` — per explicit follow-up, that one's confirm
                  button moves down beside its own `Textarea` instead
                  (see below), since confirming there needs the typed
                  note, not just the row selection. */}
              {isSelected && !note && (
                <InlineSubmitButton disabled={confirmDisabled} onClick={() => onConfirm(option.value)} />
              )}
            </div>
            {/* The note — per explicit follow-up, nested INSIDE this same
                bordered option row (rather than a separate block below
                the whole `RadioGroup`, as it briefly was), with its own
                `Label` (lyra-ui's real `Label` atom, not a hand-rolled
                span — rule zero) above the `Textarea` rather than folded
                into `Textarea`'s own built-in `label` prop, so the
                `InlineSubmitButton` beside it can stay aligned with the
                textarea's own top edge instead of the label row above it. */}
            {showNote && (
              <div className="flex flex-col gap-1.5">
                {note.label && <Label label={note.label} labelFor={`${option.value}-note`} />}
                <div className="flex items-start gap-2">
                  <Textarea
                    id={`${option.value}-note`}
                    className="flex-1"
                    placeholder={note.placeholder}
                    rows={3}
                    value={note.value}
                    onChange={(e) => note.onChange(e.target.value)}
                  />
                  <InlineSubmitButton disabled={confirmDisabled} onClick={() => onConfirm(option.value)} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </RadioGroup>
  );
}

/** The top-level bubble's own options UI — per explicit request ("I would
 *  like this to feel like a conversation with the AI agent so restyle
 *  all three for now"), a "task card" instead of `NextBestActionOption
 *  Picker`'s stacked radio-cards: options render as a row of pill
 *  buttons (title only), the SELECTED option's own description shows
 *  below the row (not every option's, unlike the old picker), a note
 *  field appears there too when the option has one, and a single
 *  "Perform Task" button replaces the old per-row/per-note
 *  `InlineSubmitButton`. Originally used ONLY for the top-level question;
 *  per explicit follow-up request ("display the remedies like the
 *  buttons in the first bubble (inline 3 up)"), the post-takeover
 *  remedies question was migrated onto this SAME component too (see its
 *  own `activeQuestionItem` branch) — `heading`/`extra` (below) exist
 *  specifically to make that reuse possible without touching the
 *  top-level question's own behavior. Photo-decision still keeps
 *  `NextBestActionOptionPicker` exactly as shipped, unaffected.
 *
 *  `heading` — the bold line above the pill row ("How would you like to
 *  proceed?" for the top-level question, "Suggested remedies" for
 *  remedies) — used to be hardcoded to the former; lifted to a prop so a
 *  second caller can supply its own. Omit for no heading at all.
 *
 *  `extra` — arbitrary content rendered for whichever option is
 *  currently selected, right after that option's own `description`/
 *  `note` (if any) and before "Perform Task". Built for remedies' own
 *  per-option follow-ups (`store-credit`'s editable amount `Input`,
 *  `discount-code`'s 3-way percentage picker — see `MarcusWebbNextBestAction
 *  Card`'s own `remedyExtra`) that don't fit the existing plain-`Textarea`
 *  `notes` shape; the top-level question doesn't use it (always
 *  `undefined` there). Deliberately independent of `notes` — an option
 *  can have `extra`, a `note`, both, or neither.
 *
 *  `phase` drives what actually renders once a task is performed:
 *  `"picking"` is this row-of-buttons state (covers "nothing chosen
 *  yet," a chosen-but-not-yet-confirmed option, AND — since Reject and
 *  Something else don't have their own completion screens yet — is also
 *  what's showing right up until either of those actually fires); the
 *  caller (see `topLevelPhase`, computed in `MarcusWebbNextBestAction
 *  Card`) only ever passes `"processing"`/`"completed"` for Approve.
 *  Both `"processing"` and `"completed"` render nothing HERE — per
 *  explicit follow-up ("the processing approval should show after the
 *  refund approved note, not inside the AI chat bubble"), the
 *  `approveBlock`/`AIProcess` "Processing the approval" loader stays in
 *  its ORIGINAL position instead (the "pure history" block, after the
 *  action log's "Refund approved" entry — see `MarcusWebbNextBestAction
 *  Card`'s own render), and the completion message/buttons (screenshot
 *  3) are their own separate new chat bubble, further below still (see
 *  `completionTimestamp`'s own render call site). This component's job
 *  ends once a task is confirmed — everything after that is someone
 *  else's render. */
function MarcusWebbTaskCard<T extends string>({
  heading,
  options,
  selected,
  onSelectedChange,
  onConfirm,
  confirmDisabled,
  notes,
  extra,
  phase,
  optionPanels,
  onViewArticle,
  selectedArticleId,
}: {
  onViewArticle?: (article: KnowledgeArticleCardData) => void;
  selectedArticleId?: string | null;
  /** Per-option confirmation body (Lucas-style): replaces that option's description and relabels the confirm button. */
  optionPanels?: Partial<Record<T, MarcusOptionPanel>>;
  heading?: React.ReactNode;
  options: NextBestActionOption<T>[];
  selected: T | undefined;
  onSelectedChange: (value: T) => void;
  onConfirm: (value: T) => void;
  confirmDisabled: boolean;
  notes?: Partial<
    Record<T, { value: string; onChange: (value: string) => void; placeholder?: string; label?: string }>
  >;
  extra?: React.ReactNode;
  phase: "picking" | "processing" | "completed";
}) {
  // Per explicit follow-up, neither Approve sub-phase renders anything
  // inside the original bubble anymore — see this component's own doc
  // comment above.
  if (phase !== "picking") return null;

  const note = selected ? notes?.[selected] : undefined;
  const selectedOption = options.find((option) => option.value === selected);
  const panel = selected ? optionPanels?.[selected] : undefined;

  return (
    <div className="flex flex-col gap-3">
      {/* Per explicit follow-up request ("you can remove 'How would you
          like to proceed' after the agent proceeds"), this lives here —
          in the `"picking"` phase only — rather than in the bubble's own
          fixed intro text. Once the agent actually proceeds (Reject
          freezes the bubble entirely, Approve moves to `"processing"`/
          `"completed"`), this component stops rendering this line right
          along with the rest of the row-of-buttons UI, with no separate
          state needed. "Something else" rounds stay on `"picking"`
          (per `topLevelPhase`'s own doc comment), so the question
          correctly reappears for another round instead of vanishing. */}
      {heading && <p className="lyra-body-md-emphasis text-lyra-fg-default">{heading}</p>}
      {/* `selected ?? ""` — same Radix uncontrolled-when-`undefined`
          gotcha `NextBestActionOptionPicker` already documents. */}
      <RadioGroup value={selected ?? ""} onValueChange={(value) => onSelectedChange(value as T)}>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const isSelected = selected === option.value;
            return (
              <RadioGroupItem
                key={option.value}
                value={option.value}
                className={cn(
                  "rounded-lyra-md border px-3 py-2 [&_[role=radio]]:sr-only",
                  "has-[[role=radio]:focus-visible]:ring-2 has-[[role=radio]:focus-visible]:ring-lyra-border-focus",
                  isSelected
                    ? "border-lyra-border-active bg-lyra-bg-active-subtle"
                    : "border-lyra-border-subtle bg-lyra-bg-surface-base hover:border-lyra-state-border-hover-neutral"
                )}
                label={
                  <span className="flex items-center gap-1.5 lyra-body-md-emphasis text-lyra-fg-default">
                    {isSelected && (
                      <CheckCircle2
                        className="h-4 w-4 text-lyra-status-success-strong"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    )}
                    {option.title}
                  </span>
                }
              />
            );
          })}
        </div>
      </RadioGroup>
      {/* Per explicit request/reference screenshot ("include the rejected
          reasoning text above the enter a reason box when the agent
          selects 'Reject'"), this no longer hides once the option also has
          a `note` (the "Enter a reason" `Textarea` just below) — it used
          to (`&& !note`), which suppressed Reject's own description the
          instant its reason box appeared. Safe for every other option:
          Approve has no `note` (nothing to conflict with), and "Something
          else" has no `description` at all (see `OPTIONS`), so this only
          actually changes Reject's behavior. */}
      {selectedOption?.description && !panel && (
        <p className="lyra-body-sm text-lyra-fg-secondary">{selectedOption.description}</p>
      )}
      {panel && (
        <div className="flex flex-col gap-1.5 rounded-lyra-lg border border-lyra-border-subtle bg-lyra-bg-surface-base px-4 py-3 animate-in slide-in-from-bottom-2 fade-in-0 duration-200">
          <p className="lyra-body-lg-emphasis text-lyra-fg-default">{panel.headline}</p>
          <p className="lyra-body-md text-lyra-fg-secondary">{panel.description}</p>
          <p className="flex items-start gap-1.5 lyra-body-md text-lyra-accent-purple-strong">
            <History className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            {panel.memory}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {panel.card && (
              <div className="flex min-w-0 flex-col rounded-lyra-lg border border-lyra-border-subtle bg-lyra-bg-surface-base px-4 py-2.5">
                <span className="lyra-body-md-emphasis text-lyra-fg-default">{panel.card.title}</span>
                <span className="lyra-body-sm text-lyra-fg-secondary">{panel.card.sub}</span>
              </div>
            )}
            <KnowledgeArticleSummaryRow
              data={panel.article ?? MARCUS_PHOTO_ARTICLE}
              selected={selectedArticleId === (panel.article ?? MARCUS_PHOTO_ARTICLE).id}
              onClick={() => onViewArticle?.(panel.article ?? MARCUS_PHOTO_ARTICLE)}
            />
          </div>
        </div>
      )}
      {note && (
        <div className="flex flex-col gap-1.5">
          {note.label && <Label label={note.label} labelFor={`${selected}-note`} />}
          <Textarea
            id={`${selected}-note`}
            rows={3}
            placeholder={note.placeholder}
            value={note.value}
            onChange={(e) => note.onChange(e.target.value)}
          />
        </div>
      )}
      {extra}
      {selected && (
        <Button
          variant="default"
          size="md"
          className="self-start"
          disabled={confirmDisabled}
          onClick={() => onConfirm(selected)}
        >
          {panel?.confirmLabel ?? "Perform Task"}
        </Button>
      )}
    </div>
  );
}

export function MarcusWebbNextBestActionCard({
  onComplete,
  onAgentContactedCustomer,
  onCustomerApprovedResolution,
  onDispositionUpdated,
  onAssignmentClosed,
  onPhotoRequested,
  onCustomerReactedToRejection,
  onCustomerReactedToPhotoRequest,
  onPhotoExpand,
  onAccountFlagged,
  onStatusEscalated,
  takenOver,
  onTakeoverGreeting,
  onCustomerRespondedToTakeover,
  onRemedyIssued,
  onActionLogEntryOpen,
  onViewArticle,
  selectedActionLogEntryId,
  selectedArticleId,
  onOpenCustomerInfo,
  onOpenOrderInfo,
  onOpenExperienceMemory,
  copilotRequests,
  onOpenCopilotRequest,
  activeCopilotRequestId,
  onOpenTransactions,
  selectedTransactionsId,
  onDismissAndUnassign,
  questionSlotElement,
}: {
  /** For Reject, fired immediately (no delay) the moment it's confirmed,
   *  with the fixed `AGENT_REPLY.reject` text — see this file's own top
   *  doc comment. Not used by Approve, which instead fires the four step
   *  callbacks below. Also NOT used by "Something else" — per explicit
   *  bug report, a "something else" note is an internal workflow
   *  instruction for the AI agent, not something it would ever say to
   *  the customer on the call, so `somethingElseRounds`'s own step effect
   *  no longer posts it to the transcript via this callback (it used to;
   *  removed outright, not gated, since there's no reading of "the AI
   *  relays this to the customer" that's ever correct). */
  onComplete?: (message: string) => void;
  /** Fired when the Approve flow's step 1 ("AI Agent contacting customer")
   *  completes. */
  onAgentContactedCustomer?: () => void;
  /** Fired when step 2 ("Waiting for customer response") completes. */
  onCustomerApprovedResolution?: () => void;
  /** Fired when step 3 ("Disposition updated...") completes. */
  onDispositionUpdated?: () => void;
  /** Fired when step 4 ("Closing and dismissing assignment") completes —
   *  the caller is expected to actually dismiss the assignment here, at
   *  which point this whole component is unmounted. */
  onAssignmentClosed?: () => void;
  /** Fired when the Reject flow's own step 1 ("AI Agent requesting photo of
   *  damaged item") completes, once a reason has been submitted. */
  onPhotoRequested?: () => void;
  /** Per explicit request ("add customer responses to the transcript
   *  indicating they are annoyed they have to provide visual proof and
   *  that the refund was denied"), fired once the SAME moment `onComplete`
   *  fires with `AGENT_REPLY.reject` (round 0's reason submission) — the
   *  caller is expected to post Marcus's own annoyed reaction to the
   *  refund being denied onto the transcript, same "AI line, then a
   *  simulated customer reply" pairing `onCustomerApprovedResolution`
   *  already establishes for Approve. */
  onCustomerReactedToRejection?: () => void;
  /** Fired at the SAME point the "Refund rejected. Requested customer
   *  provide visual proof" milestone logs (round 0 only, `stepIndex`
   *  reaching `REJECT_STEP_LABELS.length`, ~1.5s after `onPhotoRequested`)
   *  — the caller is expected to post Marcus's own annoyed reaction to
   *  being asked for photo proof. */
  onCustomerReactedToPhotoRequest?: () => void;
  /** Fired when the Reject flow's photo (rendered locally once both reject
   *  steps finish) is clicked — the caller is expected to take over the
   *  MAIN interaction column with it, not the transcript. */
  onPhotoExpand?: () => void;
  /** Fired when the post-photo "flag for review" step 1 completes. */
  onAccountFlagged?: () => void;
  /** Fired when the post-photo "flag for review" step 2 completes — the
   *  caller is expected to make a real status change (to "Escalated"). */
  onStatusEscalated?: () => void;
  /** True once the reviewing agent has clicked "Takeover" — replaces
   *  everything above (whichever question/flow was showing) with the
   *  hand-off note + remedy question. See this file's own top doc
   *  comment. */
  takenOver?: boolean;
  /** Fired once, ~1s after `takenOver` becomes true — the caller is
   *  expected to append the human agent's own greeting to the transcript. */
  onTakeoverGreeting?: () => void;
  /** Fired once, a couple seconds after `onTakeoverGreeting` — the caller
   *  is expected to append the customer's reply. */
  onCustomerRespondedToTakeover?: () => void;
  /** Fired when the reviewing agent confirms a remedy — the caller is
   *  expected to append the human agent's own confirmation line. Exactly
   *  one of the three `detail` fields is ever set, matching `remedy`:
   *  `note` for `"something-else"` (the agent's own typed instruction),
   *  `storeCreditAmount` for `"store-credit"` (the agent-edited dollar
   *  amount — defaults to "200", but is a real editable field now, not a
   *  fixed sum — see `storeCreditAmount`'s own doc comment), or
   *  `discountPercent` for `"discount-code"` (one of the 3 offered
   *  percentages — see `DISCOUNT_PERCENT_OPTIONS`). Does NOT change
   *  status or dismiss the assignment (per explicit decision). */
  onRemedyIssued?: (
    remedy: RemedySelection,
    detail: { note?: string; storeCreditAmount?: string; discountPercent?: string }
  ) => void;
  /** Fired when a `"note"` action-log entry is clicked — the caller is
   *  expected to show `entry.detail` in a side panel (via
   *  `MarcusWebbActionDetailPanelBody`, exported above). See this file's
   *  own top doc comment. */
  onActionLogEntryOpen?: (entry: MarcusWebbActionLogEntry) => void;
  /** Fired when a "Do Something" suggested-article row is clicked — the
   *  caller is expected to show it in a side panel (via
   *  `KnowledgeArticleDetailPanelBody`, exported from
   *  agent-next-gen-knowledge-article-card.tsx), the same floating-
   *  `InteriorPanel` mechanism `onActionLogEntryOpen` already uses. The
   *  caller owns the toggle-closed-on-second-click behavior (mirroring
   *  `onActionLogEntryOpen`'s own); this card only calls back with
   *  whichever article was clicked. */
  onViewArticle?: (article: KnowledgeArticleCardData) => void;
  /** Fired when the top-level bubble's "Marcus Webb" inline link is
   *  clicked — the caller is expected to open the real Customer
   *  Information overlay (e.g. `focusCustomerPanelTab("Overview")`). */
  onOpenCustomerInfo?: () => void;
  /** Fired when the top-level bubble's order inline link is clicked —
   *  the caller is expected to show placeholder order info in a side
   *  panel (via `MarcusWebbOrderDetailPanelBody`, exported above), the
   *  same floating-`InteriorPanel` mechanism `onActionLogEntryOpen`/
   *  `onViewArticle` already use. */
  onOpenOrderInfo?: () => void;
  /** Opens the docked Experience Memory view focused on the given event id (approval checklist links). */
  onOpenExperienceMemory?: (focus: string) => void;
  /** Questions the agent asked Copilot (shown as interstitial rows), and which one's result panel is open. */
  /** `performedAt`: when the row's "performing…" step ends (epoch ms). */
  copilotRequests?: { id: string; text: string; time: string; performedAt?: number }[];
  onOpenCopilotRequest?: (request: { id: string; text: string; time: string }) => void;
  activeCopilotRequestId?: string | null;
  /** Fired when a "Something else" round's instruction row is clicked —
   *  per explicit follow-up request, that row now opens the customer's
   *  last-10-transactions table in a side panel (rather than expanding
   *  inline the way it used to), the same floating-`InteriorPanel`
   *  mechanism `onActionLogEntryOpen`/`onViewArticle`/`onOpenOrderInfo`
   *  already use. `id` lets the caller round-trip it back via
   *  `selectedTransactionsId` (below), and `note`/`timestamp` are
   *  exactly what that round's row itself already shows. `date` and
   *  `showFullTransactions` are `SomethingElseRound`/`PostCompletionRound`'s
   *  own identical fields (see either one's doc comment) — the caller is
   *  expected to only show the real transactions table when
   *  `showFullTransactions` is true, and a plain placeholder otherwise. */
  onOpenTransactions?: (round: {
    id: string;
    note: string;
    timestamp: string;
    date: string;
    showFullTransactions: boolean;
  }) => void;
  /** The `id` (see `onOpenTransactions`'s own `round.id`) of whichever
   *  "Something else" instruction row's side panel is currently open —
   *  same "caller reflects it back for the selected-state highlight"
   *  contract as `selectedActionLogEntryId`/`selectedArticleId` below. */
  selectedTransactionsId?: string | null;
  /** Fired when "Dismiss And Unassign" is clicked on the top-level
   *  bubble's post-approval completion screen — the caller is expected
   *  to actually dismiss/unassign this whole interaction (unconditionally,
   *  unlike `onAssignmentClosed` above, which stays gated behind
   *  `MARCUS_WEBB_AUTO_DISMISS_ON_CLOSE` for its own, automatic-
   *  completion flow — this one is a direct, explicit agent click). */
  onDismissAndUnassign?: () => void;
  /** The `id` of the note entry whose side panel is currently open (or
   *  `null`/omitted) — drives `ActionLogNoteEntry`'s own selected-state
   *  highlight. The caller owns whether a second click on the same entry
   *  toggles its panel closed; this card only reflects whichever id it's
   *  told is selected. */
  selectedActionLogEntryId?: string | null;
  /** Same idea as `selectedActionLogEntryId`, for `KnowledgeArticleSummaryRow`'s
   *  own selected-state highlight. */
  selectedArticleId?: string | null;
  /** A page-provided DOM node, pinned to the bottom of the interaction
   *  column above the "Reviewing this conversation" `ActionBar` (the same
   *  "fixed slot replaces the composer/controls" mechanic that bar already
   *  uses), that content can portal into instead of rendering inline.
   *  Per explicit request ("none of these should be fixed"), NONE of the
   *  three `activeQuestionItem` questions (top-level, post-takeover
   *  remedies, post-photo decision) use this anymore — all three render
   *  inline now, as chat bubbles (see `MarcusWebbAiChatBubble` below). This prop
   *  still exists for the (currently hidden, `SHOW_DO_SOMETHING_INPUT`)
   *  "Do something" `AIInput` (`commandSlotContent`), which still portals
   *  here if it's ever re-enabled. Everything else on this card (bullets,
   *  the action log, `AIProcess` step lists, the photo) stays inline
   *  regardless — those are history, not something awaiting an answer.
   *  Omit to render everything in place (no regression risk for a caller
   *  that doesn't wire this up). See `portalToQuestionSlot` below. */
  questionSlotElement?: HTMLElement | null;
}) {
  const [selected, setSelected] = useState<MarcusWebbNextBestActionSelection | undefined>(undefined);
  const [customNote, setCustomNote] = useState("");
  const [confirmed, setConfirmed] = useState<MarcusWebbNextBestActionSelection | undefined>(undefined);

  // The growing action log — see this file's own top doc comment for the
  // full "simple" vs. "note" distinction and every point below that logs
  // into it.
  const [actionLog, setActionLog] = useState<MarcusWebbActionLogEntry[]>([]);
  const nextLogId = useRef(0);
  const nowTimestamp = () => new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  // Same "capture once, at creation" reasoning as `nowTimestamp` — used
  // alongside it wherever a "something else" round's transactions-panel
  // fallback (`showFullTransactions`, see `SomethingElseRound`/
  // `PostCompletionRound`'s own doc comments) needs a date, not just a
  // time, to quote back.
  const nowDate = () => new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  // Every distinct `activeQuestionItem.id` this card has ever shown,
  // recorded once (with a timestamp frozen at first appearance) the
  // moment it first becomes active — see the effect right after
  // `activeQuestionItem` is computed, below, and `MarcusWebbAiChatBubble`'s
  // own doc comment for why this exists: per explicit request, an
  // answered question's chat bubble stays visible (just without its
  // options), so it can't simply be read off the ephemeral
  // `activeQuestionItem` the way the old design was.
  const [askedQuestions, setAskedQuestions] = useState<{ id: string; title: React.ReactNode; timestamp: string }[]>([]);
  const logMilestone = (title: string, actorName?: string) => {
    setActionLog((log) => [
      ...log,
      { id: String(nextLogId.current++), kind: "simple", title, timestamp: nowTimestamp(), actorName },
    ]);
  };
  // Returns the entry it just created — every existing call site ignores
  // the return value, but the command flow's own auto-open-the-panel step
  // (below) needs the exact entry it just logged, not a fresh lookup.
  const logDecision = (entry: Omit<MarcusWebbActionLogEntry, "id" | "kind" | "timestamp" | "actorName">) => {
    const full: MarcusWebbActionLogEntry = {
      id: String(nextLogId.current++),
      kind: "note",
      actorName: "John Smith",
      timestamp: nowTimestamp(),
      ...entry,
    };
    setActionLog((log) => [...log, full]);
    return full;
  };
  // "Something else" only — per explicit follow-up request (with a
  // reference screenshot), this went from one instant, synchronous
  // `actionLog` append to a real, REPEATABLE multi-step animated round:
  // (0) "AI agent is performing this now…" spinner, no instruction card
  // yet; (1) the "Instruction sent" card appears (animated in) and a
  // SECOND, separate "AI agent is analyzing…" spinner starts; (2) that
  // analyzing spinner is replaced by a brand-new chat bubble with an
  // analysis message + a fresh row of buttons. A growing LIST of rounds
  // (not a few flat pieces of state), same reasoning `rejectRounds` below
  // already established for the same kind of "this needs to work again
  // on repeat" requirement — the OLD `completed`/`elapsedSeconds`
  // mechanism this replaces only ever fired once (its effect was keyed on
  // `[confirmed]`, which doesn't change value between repeat "something
  // else" submissions, so a second round's spinner never played). See
  // the render call site (below the action log) for how each round's
  // step maps to what's on screen, and `SOMETHING_ELSE_STEPS` for the
  // step-advance effect that drives it.
  interface SomethingElseRound {
    note: string;
    timestamp: string;
    date: string;
    // Per explicit request ("only display the last 10 transactions for
    // the something else on the first selection for Marcus Webb. For
    // subsequent something elses ... just open the panel with the
    // 'Agent Smith requested {something else} {time}{date}'"), only the
    // very FIRST "something else" round ever submitted — across BOTH this
    // array and `postCompletionRounds` combined, whichever comes first —
    // opens the real transactions table; every later one (from either
    // mechanism) opens the plain placeholder instead. Computed once, at
    // creation time, from both arrays' lengths — see this field's own
    // write site (`handleTopLevelConfirm`'s "something-else" branch) and
    // `PostCompletionRound`'s identical field for the other mechanism.
    showFullTransactions: boolean;
    stepIndex: number;
  }
  const [somethingElseRounds, setSomethingElseRounds] = useState<SomethingElseRound[]>([]);
  const lastSomethingElseRound = somethingElseRounds[somethingElseRounds.length - 1];
  useEffect(() => {
    if (!lastSomethingElseRound || lastSomethingElseRound.stepIndex >= SOMETHING_ELSE_STEPS) return;
    const idx = somethingElseRounds.length - 1;
    const timeout = window.setTimeout(() => {
      setSomethingElseRounds((rounds) => rounds.map((r, i) => (i === idx ? { ...r, stepIndex: r.stepIndex + 1 } : r)));
    }, 1500);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSomethingElseRound?.stepIndex, somethingElseRounds.length]);

  // Reject only — per explicit request ("treat this like an actual Claude
  // session"), this is a growing LIST of rounds rather than a few flat
  // pieces of state that get reset/overwritten — picking "Reject and
  // provide another reason" at the post-photo question used to reset
  // `rejectReason`/`rejectStepIndex` back to their starting values, which
  // erased the photo/steps that were already on screen instead of just
  // continuing the conversation below them. Every earlier round now stays
  // rendered (frozen, `reasonSubmitted`/`stepIndex` never change again once
  // a NEW round is appended after it) — only the LAST round in this array
  // is ever "live" (still asking for a reason, or still advancing its own
  // step list).
  interface RejectRound {
    reason: string;
    reasonSubmitted: boolean;
    stepIndex: number;
  }
  const [rejectRounds, setRejectRounds] = useState<RejectRound[]>([
    { reason: "", reasonSubmitted: false, stepIndex: 0 },
  ]);
  const updateLastRejectRound = (patch: Partial<RejectRound>) => {
    setRejectRounds((rounds) => rounds.map((r, i) => (i === rounds.length - 1 ? { ...r, ...patch } : r)));
  };
  const lastRejectRound = rejectRounds[rejectRounds.length - 1];

  // Fires the rejection note once the FIRST round's reason is submitted —
  // exactly once (`rejectionNoteFiredRef` guards against `onComplete`'s
  // own identity changing across re-renders re-firing this), and only for
  // round 0: Marcus already knows the refund was declined by the time a
  // second/third round starts, so later rounds don't repeat this line.
  const rejectionNoteFiredRef = useRef(false);
  // Flips once, alongside `rejectionNoteFiredRef`, and stays `true` —
  // exists purely so the delayed customer-reaction effect just below can
  // depend on something that DOESN'T keep changing (unlike `rejectRounds`
  // itself, which mutates twice more right after this as `stepIndex`
  // advances). Depending on `rejectRounds` directly for that timeout was
  // the first attempt, and it silently never fired: React tears down an
  // effect's previous cleanup on every dependency change before re-running
  // it, so the `stepIndex` bump 1500ms later (the exact moment this
  // timeout was also about to fire) cancelled it via `clearTimeout` a beat
  // before it could — the same "hung" bug class `onPhotoRequested`'s own
  // effect (below) already documents guarding against, just triggered by
  // a changing dependency instead of an excluded callback.
  const [rejectionNoted, setRejectionNoted] = useState(false);
  useEffect(() => {
    if (confirmed !== "reject" || !rejectRounds[0]?.reasonSubmitted || rejectionNoteFiredRef.current) return;
    rejectionNoteFiredRef.current = true;
    setRejectionNoted(true);
    onComplete?.(AGENT_REPLY.reject);
    logDecision({
      title: "Refund rejected",
      description: rejectRounds[0].reason.trim(),
      icon: <XCircle className="h-4 w-4 text-lyra-status-critical-strong" strokeWidth={1.5} aria-hidden="true" />,
      detail: {
        context: "How would you like to proceed?",
        options: OPTIONS.map((o) => ({ title: o.title, description: o.description, selected: o.value === "reject" })),
      },
    });
  }, [confirmed, rejectRounds, onComplete]);
  // Delayed (not fired in the same tick as `onComplete` above) so Marcus's
  // own annoyed reply reads as a real response to the AI's rejection line
  // rather than appearing simultaneously with it. Deliberately SHORTER
  // than the reject step effect's own 1500ms cadence (below) — that effect
  // fires `onPhotoRequested` at the same 1500ms mark independently, and
  // two unrelated timers racing at the identical delay landed this
  // customer reply AFTER the photo request in testing (confirmed via
  // screenshot), reading as if Marcus were reacting to being asked for a
  // photo rather than to the rejection itself. 800ms guarantees this
  // fires first: AI rejects (t0) → Marcus reacts to the rejection (t800)
  // → AI asks for a photo (t1500) → Marcus reacts to THAT (t3000, via
  // `onCustomerReactedToPhotoRequest`). Isolated to its own effect, gated
  // on `rejectionNoted` alone (see that state's own doc comment above)
  // specifically so nothing else can tear this timeout down before it
  // fires.
  useEffect(() => {
    if (!rejectionNoted) return;
    const timeout = window.setTimeout(() => onCustomerReactedToRejection?.(), 800);
    return () => window.clearTimeout(timeout);
    // `onCustomerReactedToRejection` deliberately excluded — same reasoning
    // `onPhotoRequested`'s own effect documents: a fresh inline function
    // every render would tear down and restart this timeout before it
    // ever fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejectionNoted]);

  // Every round AFTER round 0 gets its own follow-up note, logged once
  // each the moment that round's own reason is submitted — round 0's own
  // note is logged above instead (it doubles as the top-level Reject
  // decision, per this file's own top doc comment). Only the LAST round
  // can ever transition `reasonSubmitted` (earlier rounds are frozen), so
  // tracking the highest round index already logged is enough to log each
  // one exactly once regardless of how many rounds pile up. Per explicit
  // follow-up, round ≥ 1 no longer simulates another photo request (see
  // the step-advancing effect below) — it's simply another rejection, so
  // this logs as "Refund rejected" (reusing `CONFIRMED_META.reject`'s own
  // label/icon, matching round 0's), not "Requested additional
  // information" (which implied a request cycle that no longer happens).
  const followUpReasonLoggedIndexRef = useRef(0);
  useEffect(() => {
    if (confirmed !== "reject") return;
    const idx = rejectRounds.length - 1;
    if (idx === 0 || !rejectRounds[idx].reasonSubmitted || idx <= followUpReasonLoggedIndexRef.current) return;
    followUpReasonLoggedIndexRef.current = idx;
    logDecision({
      title: CONFIRMED_META.reject.label,
      description: rejectRounds[idx].reason.trim(),
      icon: CONFIRMED_META.reject.icon,
      detail: {
        context: "How would you like to proceed?",
        options: PHOTO_DECISION_OPTIONS.map((o) => ({
          title: o.title,
          description: o.description,
          selected: o.value === "reject",
        })),
      },
    });
  }, [confirmed, rejectRounds]);

  // Advances round 0's own step every 1.5s once its reason has been
  // submitted, same shape as `approveStepIndex` below. Per explicit
  // follow-up, this ONLY ever plays out for round 0 — rejecting again
  // after the photo (round ≥ 1) is terminal: no second simulated
  // "request another photo" round-trip, just the follow-up note above.
  // Gating on `rejectRounds.length === 1` (rather than "the last round",
  // as this used to) is what freezes every later round's `stepIndex` at
  // 0 forever, which in turn is what keeps the photo-decision question
  // (gated on `lastRejectRound.stepIndex >= REJECT_STEP_LABELS.length`)
  // from ever reappearing after round 0 — one flag change avoids having
  // to separately gate that question, too.
  useEffect(() => {
    if (confirmed !== "reject" || rejectRounds.length > 1 || !lastRejectRound.reasonSubmitted) return;
    if (lastRejectRound.stepIndex >= REJECT_STEP_LABELS.length) return;
    const timeout = window.setTimeout(() => {
      if (lastRejectRound.stepIndex === 0) onPhotoRequested?.();
      if (lastRejectRound.stepIndex === 1) {
        logMilestone("Refund rejected. Requested customer provide visual proof", "Cognigy AI Agent");
        onCustomerReactedToPhotoRequest?.();
      }
      updateLastRejectRound({ stepIndex: lastRejectRound.stepIndex + 1 });
    }, 1500);
    return () => window.clearTimeout(timeout);
    // `onPhotoRequested`/`onCustomerReactedToPhotoRequest` deliberately
    // excluded — same reasoning as `approveStepIndex`'s own effect below:
    // fresh inline functions every render of the caller, and including
    // them here would tear down and restart this timeout on every
    // unrelated page re-render (e.g. the shared clock tick) before it
    // ever gets a chance to fire — exactly the "hung on step 1" bug this
    // fixes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed, rejectRounds]);

  // Auto-collapses each round's own `AIProcess` once ITS OWN steps finish
  // loading — per explicit request, a completed step list left fully
  // expanded shows too much info sitting around for no further reason to
  // look at it. Keyed by round index (not just "the last round") since an
  // earlier round can still be on screen, fully done, while a later one
  // is freshly appended and still loading. A plain `Set`, not a field on
  // `RejectRound` itself, since `onExpandedChange` needs to let the agent
  // manually reopen a collapsed round afterward — independent of anything
  // `updateLastRejectRound` already tracks (and updating only ever
  // touches the LAST round, not an arbitrary earlier one).
  const [collapsedRejectRounds, setCollapsedRejectRounds] = useState<Set<number>>(new Set());
  useEffect(() => {
    rejectRounds.forEach((round, i) => {
      if (round.stepIndex >= REJECT_STEP_LABELS.length) {
        setCollapsedRejectRounds((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
      }
    });
  }, [rejectRounds]);
  const setRejectRoundExpanded = (i: number, expanded: boolean) =>
    setCollapsedRejectRounds((prev) => {
      const next = new Set(prev);
      if (expanded) next.delete(i);
      else next.add(i);
      return next;
    });

  const buildRejectSteps = (stepIndex: number): AIProcessStep[] =>
    REJECT_STEP_LABELS.map((label, i) => ({
      id: String(i),
      label,
      status: i < stepIndex ? "done" : i === stepIndex ? "active" : "pending",
    }));

  // Round 0's own in-progress visual — see `SHOW_REJECT_PROCESSING_STEPS`'s
  // own doc comment. `SHOW_REJECT_PROCESSING_STEPS` true keeps the
  // original `AIProcess` step list + attached photo (rendered inline at
  // this round's own render site, further down — unchanged, still keyed
  // per round for the (currently unreachable while the flag is off, but
  // still fully wired) multi-round "reject again" case); `false` swaps in
  // the exact same plain `Spinner` + status-line treatment `approveBlock`
  // already uses for the same reason, visible for as long as
  // `lastRejectRound.stepIndex < REJECT_STEP_LABELS.length` — once that
  // real (unchanged) background timer finishes, this simply disappears
  // and `rejectCompletionTyping`/`rejectCompletionTimestamp` (their own
  // doc comments, above `takeoverIntroducedRef`) take over.
  const rejectBlock = SHOW_REJECT_PROCESSING_STEPS
    ? null
    : lastRejectRound.stepIndex < REJECT_STEP_LABELS.length ? (
        <div className="flex items-center gap-2 px-1">
          <Spinner size="sm" />
          <span className="lyra-body-sm text-lyra-fg-secondary">AI agent is working…</span>
        </div>
      ) : null;

  // Locked once the post-photo question resolves to Approve (see
  // `handlePhotoDecisionConfirm` below) — the approve summary/`AIProcess`
  // then appends BELOW the reject rounds instead of replacing them
  // (`confirmed` deliberately stays `"reject"`; see `approveBlock`'s own
  // render site and the approve effect's guard further down, both of which
  // check this alongside `confirmed === "approve"`).
  const [approvedAfterReject, setApprovedAfterReject] = useState(false);

  // Second question, asked once the photo above arrives — its own
  // pre-confirm selection/note, separate from the top-level `selected`/
  // `customNote` (a different question, answered at a different point).
  const [photoDecisionSelected, setPhotoDecisionSelected] = useState<MarcusWebbNextBestActionSelection | undefined>(
    undefined
  );
  const [photoDecisionNote, setPhotoDecisionNote] = useState("");
  // The reason typed inline for "Reject and provide another reason" —
  // per explicit follow-up, this reject option gets the exact same
  // inline-note treatment (label + `Textarea` inside its own row) as the
  // top-level "Reject the refund" (see `OPTIONS`' own `notes` prop) rather
  // than the old separate "reject-reason" card, which no round reaches
  // anymore. Held here (not on `RejectRound` directly) since the round it
  // belongs to doesn't exist yet until confirm actually appends it.
  const [photoDecisionRejectReason, setPhotoDecisionRejectReason] = useState("");
  // "Something else" here locks in its own "flag for review" process
  // (`FLAG_STEP_LABELS` below) — Approve/Reject don't set any state of
  // their own; they reuse the existing `confirmed`/reject-reason states.
  const [flagConfirmed, setFlagConfirmed] = useState(false);

  const handlePhotoDecisionConfirm = (value: MarcusWebbNextBestActionSelection) => {
    if (value === "approve") {
      // Appends the approve summary/`AIProcess` below the reject rounds
      // already on screen (`approveBlock`) — deliberately does NOT touch
      // `confirmed` (still "reject"), so none of that history disappears.
      setApprovedAfterReject(true);
      logDecision({
        title: CONFIRMED_META.approve.label,
        icon: <CheckCircle2 className="h-4 w-4 text-lyra-status-success-strong" strokeWidth={1.5} aria-hidden="true" />,
        detail: {
          context: "How would you like to proceed?",
          options: PHOTO_DECISION_OPTIONS.map((o) => ({
            title: o.title,
            description: o.description,
            selected: o.value === "approve",
          })),
        },
      });
    } else if (value === "reject") {
      // Appends a fresh round rather than resetting the current one — the
      // previous round's own reason/steps/photo stay exactly as they are.
      // The reason was already typed inline on this same question (see
      // `photoDecisionRejectReason`), so it lands `reasonSubmitted: true`
      // from the moment it's appended — no separate follow-up card. No
      // log entry here either — that round's own follow-up note logs once
      // `reasonSubmitted` is seen true (see `followUpReasonLoggedIndexRef`'s
      // effect), which now fires off this same state update.
      setRejectRounds((rounds) => [
        ...rounds,
        { reason: photoDecisionRejectReason.trim(), reasonSubmitted: true, stepIndex: 0 },
      ]);
      setPhotoDecisionRejectReason("");
      setPhotoDecisionSelected(undefined);
      setPhotoDecisionNote("");
    } else {
      setFlagConfirmed(true);
      logDecision({
        title: "Instruction sent",
        description: photoDecisionNote.trim(),
        icon: <MessageSquareText className="h-4 w-4 text-lyra-fg-secondary" strokeWidth={1.5} aria-hidden="true" />,
        detail: {
          context: "How would you like to proceed?",
          options: PHOTO_DECISION_OPTIONS.map((o) => ({
            title: o.title,
            description: o.description,
            selected: o.value === "something-else",
          })),
        },
      });
    }
  };

  // "Something else" (flag for review) only — advances one step every
  // 1.5s, same shape as `approveStepIndex`/`rejectStepIndex` above. Step 3
  // reuses `onAssignmentClosed` (see this file's own top doc comment).
  const [flagStepIndex, setFlagStepIndex] = useState(0);
  useEffect(() => {
    if (!flagConfirmed) return;
    if (flagStepIndex >= FLAG_STEP_LABELS.length) return;
    const timeout = window.setTimeout(() => {
      const callbacks = [onAccountFlagged, onStatusEscalated, onAssignmentClosed];
      callbacks[flagStepIndex]?.();
      if (flagStepIndex === 1) logMilestone('Status updated to "Escalated"', "Cognigy AI Agent");
      setFlagStepIndex((i) => i + 1);
    }, 1500);
    return () => window.clearTimeout(timeout);
    // Callbacks deliberately excluded from deps — see `rejectStepIndex`'s
    // own effect above for why (fresh inline functions every render would
    // otherwise reset this timeout before it ever fires).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagConfirmed, flagStepIndex]);

  const flagSteps: AIProcessStep[] = FLAG_STEP_LABELS.map((label, i) => ({
    id: String(i),
    label,
    status: i < flagStepIndex ? "done" : i === flagStepIndex ? "active" : "pending",
  }));

  // Auto-collapses once flagging finishes loading — see
  // `collapsedRejectRounds`'s own doc comment above for the "why".
  // `onExpandedChange` still lets the agent manually reopen it after.
  const [flagExpanded, setFlagExpanded] = useState(true);
  useEffect(() => {
    if (flagStepIndex >= FLAG_STEP_LABELS.length) setFlagExpanded(false);
  }, [flagStepIndex]);

  // Fires either from the top-level Approve option OR from
  // `approvedAfterReject` (the post-photo question) — advances one step
  // every 1.5s, firing that step's own callback as it completes (see this
  // file's own top doc comment). Per explicit follow-up, Approve no
  // longer has its own "close/dismiss" step — that step (and its
  // `onAssignmentClosed` call) is gone from this list entirely; the
  // approval simply finishes on the disposition update, with dismissing
  // the assignment left to whatever the agent does next, same as any
  // other resolved conversation.
  const approveTriggered = confirmed === "approve" || approvedAfterReject;
  const [approveStepIndex, setApproveStepIndex] = useState(0);
  useEffect(() => {
    if (!approveTriggered) return;
    if (approveStepIndex >= APPROVE_STEP_LABELS.length) return;
    const timeout = window.setTimeout(() => {
      const callbacks = [onAgentContactedCustomer, onCustomerApprovedResolution, onDispositionUpdated];
      callbacks[approveStepIndex]?.();
      if (approveStepIndex === 2) logMilestone(APPROVE_STEP_LABELS[2], "Cognigy AI Agent");
      setApproveStepIndex((i) => i + 1);
    }, 1500);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveTriggered, approveStepIndex]);

  const approveSteps: AIProcessStep[] = APPROVE_STEP_LABELS.map((label, i) => ({
    id: String(i),
    label,
    status: i < approveStepIndex ? "done" : i === approveStepIndex ? "active" : "pending",
  }));

  // Auto-collapses once the approval finishes loading — see
  // `collapsedRejectRounds`'s own doc comment above for the "why".
  // `onExpandedChange` still lets the agent manually reopen it after.
  const [approveExpanded, setApproveExpanded] = useState(true);
  useEffect(() => {
    if (approveStepIndex >= APPROVE_STEP_LABELS.length) setApproveExpanded(false);
  }, [approveStepIndex]);

  // Shared between the top-level Approve branch and the post-photo
  // "approved after reject" append (see `approvedAfterReject`'s own doc
  // comment) — just the `AIProcess`, rendered at two different points in
  // the tree depending on how Approve was reached. No summary box here —
  // both paths that reach this already log their own "Refund approved"
  // decision immediately (`handleTopLevelConfirm`/`handlePhotoDecisionConfirm`),
  // so a box here would just duplicate that action-log entry (per explicit
  // bug report).
  //
  // Gated on `SHOW_APPROVE_PROCESSING_STEPS` (own doc comment above) —
  // "hide, don't destroy": the underlying simulated process (timers,
  // `onAgentContactedCustomer`/`onCustomerApprovedResolution`/
  // `onDispositionUpdated` callbacks, the eventual "Refund approved" log
  // entry) runs the same regardless of this flag — only this VISUAL
  // treatment is toggled, between the step list and a plain spinner row.
  // The plain-spinner branch only renders while still actually in
  // progress (`approveStepIndex < APPROVE_STEP_LABELS.length`) — once the
  // last step's callback has fired, this simply disappears (same as
  // `AIProcess` would auto-collapse to, just with nothing left to show
  // afterward) and the separate completion bubble elsewhere takes over.
  const approveBlock = SHOW_APPROVE_PROCESSING_STEPS ? (
    <AIProcess
      expanded={approveExpanded}
      onExpandedChange={setApproveExpanded}
      label="Processing the approval"
      steps={approveSteps}
    />
  ) : approveStepIndex < APPROVE_STEP_LABELS.length ? (
    <div className="flex items-center gap-2 px-1">
      <Spinner size="sm" />
      <span className="lyra-body-sm text-lyra-fg-secondary">AI agent is working…</span>
    </div>
  ) : null;

  // Drives `MarcusWebbTaskCard`'s phase for the top-level bubble —
  // `"processing"`/`"completed"` both just tell it to stop showing the
  // row of buttons; the loader itself (`approveBlock`) and the
  // completion bubble render elsewhere (see the "pure history" block's
  // `confirmed === "approve" ? approveBlock : ...`, and
  // `completionTimestamp`'s own render call site, respectively — per
  // explicit follow-up, neither lives inside the original bubble).
  // Reject/Something else don't have their own phases yet ("we will
  // update the reject and something else later") — they stay on
  // `"picking"`, which is exactly what `MarcusWebbTaskCard` already
  // renders for "nothing/still choosing."
  const topLevelPhase: "picking" | "processing" | "completed" =
    confirmed === "approve" ? (approveStepIndex >= APPROVE_STEP_LABELS.length ? "completed" : "processing") : "picking";

  // Shared between the original bubble's own `MarcusWebbTaskCard` and
  // every "Something else" round's follow-up bubble's own — same
  // Approve/Reject/Something-else picker, wherever it's currently live.
  const topLevelNotes = {
    reject: {
      value: lastRejectRound.reason,
      onChange: (value: string) => updateLastRejectRound({ reason: value }),
      placeholder: "e.g. the damage report needs photos before this can be approved...",
      label: "Enter a reason",
    },
    "something-else": {
      value: customNote,
      onChange: setCustomNote,
      placeholder: "Describe what you'd like the AI agent to do instead (e.g. ask for photos of the damage first)...",
    },
  };

  // Per a later explicit follow-up ("put the followup in a new
  // conversation bubble below the refund note and latest actions - keep
  // it like a conversation"), the completion text/buttons (screenshot 3)
  // are their own NEW chat bubble now, not appended inside the original
  // question bubble — `MarcusWebbTaskCard`'s `"completed"` phase renders
  // nothing there anymore (see its own call site below); this timestamp,
  // captured once the moment `topLevelPhase` first reaches `"completed"`
  // (not recomputed every render), is for that SEPARATE bubble, rendered
  // at the very end of this card (after the action log/history), same
  // pattern `askedQuestions` already uses to freeze a timestamp at the
  // moment something first happens.
  //
  // Per a later explicit request ("add another animation before
  // animating in the next Agent comment that shows the Agent thinking
  // (typing)"), `completionTimestamp` (and so the real completion bubble)
  // no longer gets set the SAME instant `topLevelPhase` reaches
  // "completed" — `completionTyping` flips true first, holding
  // `MarcusWebbAiTypingIndicator` (own doc comment above) on screen for
  // `COMPLETION_TYPING_DELAY_MS`, same beat as a real chat: dots first,
  // then the message. `completionTimestamp` (captured only once
  // `completionTyping` itself flips back off) is otherwise unchanged —
  // still frozen once, still drives the same bubble below.
  const [completionTyping, setCompletionTyping] = useState(false);
  const [completionTimestamp, setCompletionTimestamp] = useState<string | null>(null);
  useEffect(() => {
    if (topLevelPhase !== "completed" || completionTimestamp) return;
    setCompletionTyping(true);
    const timeout = window.setTimeout(() => {
      setCompletionTyping(false);
      setCompletionTimestamp(nowTimestamp());
    }, COMPLETION_TYPING_DELAY_MS);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topLevelPhase]);

  // Reject's own mirror of `completionTyping`/`completionTimestamp` just
  // above — see `SHOW_REJECT_PROCESSING_STEPS`'s own doc comment (top of
  // file) for the "why": per explicit request ("since we are not in
  // Guide Mode we should limit the amount of feedback from a reject
  // selection ... just display the attached response from the ai ...
  // show the agent working and agent typing states and animate as you do
  // in the accept condition"), Reject's round 0 now ends the exact same
  // way Approve does — a working spinner (`rejectBlock`, below) while
  // `lastRejectRound.stepIndex < REJECT_STEP_LABELS.length`, then this
  // typing indicator, then ONE completion bubble — instead of the fuller
  // `AIProcess`/photo/photo-decision-question flow `SHOW_REJECT_
  // PROCESSING_STEPS` still gates further down. Scoped to round 0 only
  // (`rejectRounds.length > 1` bails) — same scope
  // `lastRejectRound.stepIndex`'s own advancing effect already limits
  // itself to (see that effect's own doc comment) — since there's no
  // "reject again" round-trip left to reach a second round from while
  // this flag is off anyway.
  const [rejectCompletionTyping, setRejectCompletionTyping] = useState(false);
  const [rejectCompletionTimestamp, setRejectCompletionTimestamp] = useState<string | null>(null);
  useEffect(() => {
    if (
      SHOW_REJECT_PROCESSING_STEPS ||
      confirmed !== "reject" ||
      rejectRounds.length > 1 ||
      lastRejectRound.stepIndex < REJECT_STEP_LABELS.length ||
      rejectCompletionTimestamp
    ) {
      return;
    }
    setRejectCompletionTyping(true);
    const timeout = window.setTimeout(() => {
      setRejectCompletionTyping(false);
      setRejectCompletionTimestamp(nowTimestamp());
    }, COMPLETION_TYPING_DELAY_MS);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed, rejectRounds]);

  // Per explicit request ("any time something else is clicked from an ai
  // chat bubble open the input field and if something is submitted, add
  // a note inline and perform the agent working and then have the agent
  // respond (it can loop forever)"), the "Something Else" button on
  // EITHER completion bubble (Approve's or Reject's — see
  // `MarcusWebbCompletionActions`, below, used by both, and by every
  // round's own follow-up bubble here) opens an inline note field in
  // place of the button row; submitting appends a new
  // `PostCompletionRound`, an append-only list, same shape/convention as
  // `somethingElseRounds`/`rejectRounds`. Each round's own `stepIndex`
  // advances 0 (note just added, working spinner) → 1 (typing indicator)
  // → 2 (done, its own response bubble shown) every
  // `COMPLETION_TYPING_DELAY_MS`, the same two-phase "working then
  // typing" beat Approve/Reject's own completions already use — see
  // their own doc comments. Only the LAST round's response bubble (or,
  // before any round exists, the original completion bubble itself) ever
  // shows live actions — every earlier one freezes once superseded, same
  // "stays visible once answered, only the latest is interactive"
  // pattern this file already establishes for `askedQuestions`/
  // `somethingElseRounds`. Genuinely "loops forever": nothing here ever
  // sets a terminal flag, so the last round's own response bubble always
  // re-offers `MarcusWebbCompletionActions`, ready for another round.
  interface PostCompletionRound {
    note: string;
    timestamp: string;
    date: string;
    // See `SomethingElseRound.showFullTransactions`'s own doc comment —
    // identical field/reasoning, shared across both mechanisms.
    showFullTransactions: boolean;
    stepIndex: number;
  }
  const [postCompletionRounds, setPostCompletionRounds] = useState<PostCompletionRound[]>([]);
  const [postCompletionInputOpen, setPostCompletionInputOpen] = useState(false);
  const [postCompletionNote, setPostCompletionNote] = useState("");
  useEffect(() => {
    const round = postCompletionRounds[postCompletionRounds.length - 1];
    if (!round || round.stepIndex >= 2) return;
    const timeout = window.setTimeout(() => {
      setPostCompletionRounds((rounds) =>
        rounds.map((r, i) => (i === rounds.length - 1 ? { ...r, stepIndex: r.stepIndex + 1 } : r))
      );
    }, COMPLETION_TYPING_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [postCompletionRounds]);
  const handlePostCompletionSubmit = () => {
    const trimmed = postCompletionNote.trim();
    if (!trimmed) return;
    // See `PostCompletionRound.showFullTransactions`'s own doc comment.
    const showFullTransactions = somethingElseRounds.length === 0 && postCompletionRounds.length === 0;
    setPostCompletionRounds((rounds) => [
      ...rounds,
      { note: trimmed, timestamp: nowTimestamp(), date: nowDate(), showFullTransactions, stepIndex: 0 },
    ]);
    setPostCompletionNote("");
    setPostCompletionInputOpen(false);
  };

  // Takeover only — see this file's own top doc comment. Fires the human
  // agent's greeting then the customer's reply once, on a short delay,
  // independently of the remedy question below (same fire-once-on-a-flag
  // pattern as `rejectionNoteFiredRef`).
  const [remedySelected, setRemedySelected] = useState<RemedySelection | undefined>(undefined);
  const [remedyNote, setRemedyNote] = useState("");
  const [remedyConfirmed, setRemedyConfirmed] = useState<RemedySelection | undefined>(undefined);
  // "store-credit"'s own editable amount — defaults to the same $200 the
  // fixed refund amount already is everywhere else in this scenario, but
  // stays a free-typed string (not re-derived from anything) so the agent
  // can genuinely change it. "discount-code"'s own 3-way percentage pick
  // has no sensible default (nothing to default TO among three equally
  // valid options), so it starts unset — see `remedyConfirmDisabled`'s own
  // doc comment for why that keeps "Perform Task" disabled until chosen.
  const [storeCreditAmount, setStoreCreditAmount] = useState("200");
  const [discountAmount, setDiscountAmount] = useState<string | undefined>(undefined);
  const takeoverIntroducedRef = useRef(false);
  // Per explicit request ("show them typing" before the remedies bubble),
  // same two-phase "working then typing" beat Approve/Reject's own
  // completions already use (`completionTyping`/`rejectCompletionTyping`,
  // their own doc comments) — except there's no real "working" step here
  // (nothing is processing), so this skips straight to the typing
  // indicator the instant Takeover fires, then reveals the bubble after
  // `COMPLETION_TYPING_DELAY_MS`. `remedyBubbleReady` (not `takenOver`
  // alone) is what the `activeQuestionItem` "remedies" branch (below)
  // actually gates on, so the bubble itself doesn't appear a beat early.
  const [remedyBubbleTyping, setRemedyBubbleTyping] = useState(false);
  const [remedyBubbleReady, setRemedyBubbleReady] = useState(false);
  useEffect(() => {
    if (!takenOver || takeoverIntroducedRef.current) return;
    takeoverIntroducedRef.current = true;
    logMilestone("Agent Smith has taken over the conversation.");
    const t1 = window.setTimeout(() => onTakeoverGreeting?.(), 1000);
    const t2 = window.setTimeout(() => onCustomerRespondedToTakeover?.(), 3000);
    setRemedyBubbleTyping(true);
    const t3 = window.setTimeout(() => {
      setRemedyBubbleTyping(false);
      setRemedyBubbleReady(true);
    }, COMPLETION_TYPING_DELAY_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takenOver]);

  // Only ever true for `store-credit`/`discount-code` — `something-else`
  // keeps its own pre-existing empty-note check. `Number(...)` on an empty
  // string is `0` (falls into the `<= 0` half already), and on a
  // non-numeric string is `NaN` (fails `> 0` too), so both invalid cases
  // are covered without a separate parse-failure branch.
  const remedyConfirmDisabled =
    (remedySelected === "something-else" && remedyNote.trim().length === 0) ||
    (remedySelected === "store-credit" && !(Number(storeCreditAmount) > 0)) ||
    (remedySelected === "discount-code" && !discountAmount);

  const handleRemedyConfirm = (value: RemedySelection) => {
    setRemedyConfirmed(value);
    onRemedyIssued?.(value, {
      note: value === "something-else" ? remedyNote : undefined,
      storeCreditAmount: value === "store-credit" ? storeCreditAmount.trim() : undefined,
      discountPercent: value === "discount-code" ? discountAmount : undefined,
    });
    logDecision({
      title:
        value === "store-credit" ? "Store credit issued" : value === "discount-code" ? "Discount code sent" : "Instruction sent",
      description:
        value === "something-else"
          ? remedyNote.trim()
          : value === "store-credit"
            ? `$${storeCreditAmount.trim()} store credit`
            : `${discountAmount}% off discount code`,
      icon:
        value === "something-else" ? (
          <MessageSquareText className="h-4 w-4 text-lyra-fg-secondary" strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-lyra-status-success-strong" strokeWidth={1.5} aria-hidden="true" />
        ),
      detail: {
        context: "Suggested remedies",
        options: REMEDY_OPTIONS.map((o) => ({ title: o.title, description: o.description, selected: o.value === value })),
      },
    });
  };

  // "discount-code"'s own 3-way percentage pick — see `remedyExtra`'s own
  // render site for the shared pill-button styling this reuses (matching
  // `MarcusWebbTaskCard`'s own row exactly, just a nested/secondary
  // choice rather than the top-level one).
  const DISCOUNT_PERCENT_OPTIONS = ["10", "20", "30"];

  // `MarcusWebbTaskCard`'s own `extra` slot (its doc comment) for whichever
  // remedy is currently selected — `undefined` for "something-else" (that
  // one already gets the plain `Textarea` via `notes` below, same as
  // before).
  const remedyExtra =
    remedySelected === "store-credit" ? (
      <Input
        label="Credit amount"
        startIcon={<span className="lyra-body-md text-lyra-fg-secondary">$</span>}
        inputMode="decimal"
        value={storeCreditAmount}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStoreCreditAmount(e.target.value)}
      />
    ) : remedySelected === "discount-code" ? (
      <div className="flex flex-col gap-1.5">
        <Label label="Discount amount" />
        <RadioGroup value={discountAmount ?? ""} onValueChange={setDiscountAmount}>
          <div className="flex flex-wrap gap-2">
            {DISCOUNT_PERCENT_OPTIONS.map((percent) => {
              const isSelected = discountAmount === percent;
              return (
                <RadioGroupItem
                  key={percent}
                  value={percent}
                  className={cn(
                    "rounded-lyra-md border px-3 py-2 [&_[role=radio]]:sr-only",
                    "has-[[role=radio]:focus-visible]:ring-2 has-[[role=radio]:focus-visible]:ring-lyra-border-focus",
                    isSelected
                      ? "border-lyra-border-active bg-lyra-bg-active-subtle"
                      : "border-lyra-border-subtle bg-lyra-bg-surface-base hover:border-lyra-state-border-hover-neutral"
                  )}
                  label={
                    <span className="flex items-center gap-1.5 lyra-body-md-emphasis text-lyra-fg-default">
                      {isSelected && (
                        <CheckCircle2
                          className="h-4 w-4 text-lyra-status-success-strong"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      )}
                      {percent}% Off
                    </span>
                  }
                />
              );
            })}
          </div>
        </RadioGroup>
      </div>
    ) : undefined;

  // ── "Do something" command field ──
  // No local LLM wired up yet (the earlier local-Ollama integration was
  // removed since it can't work without a locally-running server; a real
  // client-side LLM replacement, via WebLLM, is a separate, saved-for-
  // later plan). What IS wired up, per explicit request: submitting shows
  // a placeholder "suggested knowledge article" card — see
  // `PLACEHOLDER_KNOWLEDGE_ARTICLE` above and `KnowledgeArticleCard`
  // (agent-next-gen-knowledge-article-card.tsx) — a scaffold to build the
  // real containers against before real per-command content exists.
  const [commandInputValue, setCommandInputValue] = useState("");
  // Append-only, same convention as `actionLog` — each submission adds
  // its own card rather than replacing a single slot. A separate ref
  // counter (not `nextLogId`) since these aren't `actionLog` entries;
  // they render in their own block, right after it (see the render
  // below).
  const [suggestedArticles, setSuggestedArticles] = useState<{ id: string }[]>([]);
  const nextArticleId = useRef(0);

  // Top-level confirm — logs immediately for Approve/Something-else (their
  // own descriptive text already exists at this moment). Reject is
  // different: per explicit request, its reason is now captured inline
  // on this SAME top-level question (see `OPTIONS`' own `notes` prop,
  // below) rather than a separate follow-up card, so confirming it also
  // finalizes that already-typed reason in the same call — logging
  // itself still happens later, off `rejectionNoteFiredRef`'s effect
  // (below), which only cares that `confirmed`/`rejectRounds[0]` both
  // ended up set, not which handler call did it.
  const handleTopLevelConfirm = (value: MarcusWebbNextBestActionSelection) => {
    setConfirmed(value);
    if (value === "reject") {
      updateLastRejectRound({ reasonSubmitted: true });
      return;
    }
    // Per explicit follow-up request ("this way they can keep requesting
    // something else and the approve / reject doesn't go away until one
    // is selected") — Something else no longer goes through the shared
    // `logDecision` (that's approve-only now). Per a LATER explicit
    // follow-up, it no longer logs an instant `actionLog` entry either —
    // it just starts a new `somethingElseRound` (see that state's own
    // doc comment); the round's own step-advance effect is what actually
    // shows the "Instruction sent" card, a few real seconds later, as
    // part of the new animated sequence.
    if (value === "something-else") {
      const note = customNote.trim();
      // See `SomethingElseRound.showFullTransactions`'s own doc comment —
      // true only if NEITHER this array NOR `postCompletionRounds` has any
      // round yet, i.e. this is the very first "something else" ever
      // submitted this session.
      const showFullTransactions = somethingElseRounds.length === 0 && postCompletionRounds.length === 0;
      setSomethingElseRounds((rounds) => [
        ...rounds,
        { note, timestamp: nowTimestamp(), date: nowDate(), showFullTransactions, stepIndex: 0 },
      ]);
      setCustomNote("");
      setSelected(undefined);
      return;
    }
    logDecision({
      title: CONFIRMED_META.approve.label,
      icon: <CheckCircle2 className="h-4 w-4 text-lyra-status-success-strong" strokeWidth={1.5} aria-hidden="true" />,
      detail: {
        context: "How would you like to proceed?",
        options: OPTIONS.map((o) => ({ title: o.title, description: o.description, selected: o.value === value })),
      },
    });
  };

  const confirmDisabled =
    (selected === "something-else" && customNote.trim().length === 0) ||
    (selected === "reject" && lastRejectRound.reason.trim().length === 0);

  // See `questionSlotElement`'s own doc comment above.
  const portalToQuestionSlot = (node: React.ReactNode) =>
    questionSlotElement ? createPortal(node, questionSlotElement) : node;

  const contactOverviewItem = {
    id: "contact-overview",
    title: "Contact Overview",
    content: (
      <ul className="flex flex-col gap-1.5 pl-4 list-disc">
        <li className="lyra-body-md text-lyra-fg-default">
          Marcus Webb — Order #48213 (noise-cancelling headphones, $200), placed last Tuesday. Reported the item
          arrived with a cracked ear cup.
        </li>
        <li className="lyra-body-md text-lyra-fg-default">
          The AI agent confirmed the damage qualifies for a refund, located the order, and calculated the refund
          amount before pausing for approval.
        </li>
        <li className="lyra-body-md text-lyra-fg-default">
          The $200 refund exceeds the AI agent's $100 auto-approval limit, so Marcus was placed on hold pending your
          sign-off.
        </li>
      </ul>
    ),
  };

  // Whichever ONE question is currently awaiting the agent's answer (these
  // are mutually exclusive by construction — never more than one true at
  // once): the top-level question, the post-photo question, or the remedy
  // question. `null` once nothing's pending. There's no separate
  // "reject-reason" branch anymore — every reject option (top-level AND
  // the post-photo "Reject and provide another reason") captures its
  // reason inline on its own question via `notes`, so `reasonSubmitted`
  // is always already true by the time a round exists to check.
  let activeQuestionItem: { id: string; title: React.ReactNode; content: React.ReactNode } | null = null;
  if (takenOver) {
    // Gated on `remedyBubbleReady`, not `takenOver` alone — see that
    // state's own doc comment (near `takeoverIntroducedRef`): the typing
    // indicator shows first, and this bubble (with its live picker) only
    // actually appears once that finishes.
    if (remedyBubbleReady && !remedyConfirmed) {
      activeQuestionItem = {
        id: "remedies",
        // Per explicit request ("update the bubble content to say 'I
        // have transferred the call...'"), replaces the old plain
        // "Suggested remedies" heading — that label moved to
        // `MarcusWebbTaskCard`'s own `heading` prop instead (below),
        // matching the top-level bubble's own "intro paragraph + heading
        // inside the card" shape.
        title: (
          <p className="lyra-body-md text-lyra-fg-default">
            I have transferred the call. You are live with the customer. He is getting irate. Below are some
            suggested remedies for the situation.
          </p>
        ),
        content: (
          <MarcusWebbTaskCard
            heading="Suggested remedies"
            options={REMEDY_OPTIONS}
            selected={remedySelected}
            onSelectedChange={setRemedySelected}
            onConfirm={handleRemedyConfirm}
            confirmDisabled={remedyConfirmDisabled}
            notes={{
              "something-else": {
                value: remedyNote,
                onChange: setRemedyNote,
                placeholder: "Describe what you'd like to do instead...",
              },
            }}
            extra={remedyExtra}
            phase="picking"
          />
        ),
      };
    }
  } else if (confirmed !== "reject") {
    // Per explicit follow-up request ("this way they can keep requesting
    // something else and the approve / reject doesn't go away until one
    // is selected") — "Something else" is the one option that doesn't
    // lock the picker away: `confirmed` still gets set to
    // `"something-else"` (see `handleTopLevelConfirm`, so its own note
    // logs correctly and the eventual `onComplete` reply still fires),
    // but this condition treats that value the same as "nothing answered
    // yet," so the SAME picker below just keeps reappearing after each
    // submission. Reject is the only value that actually falls through
    // past this branch for good (into "photo-decision", below) — Approve
    // now ALSO stays on this branch (condition widened from
    // `!confirmed || confirmed === "something-else"` to `confirmed !==
    // "reject"`), per later explicit request: the bubble needs to stay
    // "live" through Approve's own in-bubble processing/completion
    // phases (`topLevelPhase`, computed above) instead of freezing the
    // instant Approve is picked, the way it used to (and the way Reject
    // still does).
    activeQuestionItem = {
      id: "next-best-action",
      // Per explicit request, Contact Overview's own facts (see
      // `contactOverviewItem`, now hidden via `SHOW_CONTACT_OVERVIEW`)
      // are folded into this intro, rephrased as first-person AI
      // narrative — same underlying facts (order #48213, noise-cancelling
      // headphones, $200 refund vs. $100 auto-approval limit, cracked ear
      // cup), just narrated instead of bulleted. "Marcus Webb" and the
      // order reference are real inline links — same established pattern
      // as `previousAgent.name` in lyra-ui's `contact-overview.tsx` (a
      // bare `<button type="button">`, not the `Button` component,
      // styled `text-lyra-fg-link hover:underline`) — opening the real
      // Customer Information overlay and a new placeholder order-info
      // side panel, respectively (see `onOpenCustomerInfo`/
      // `onOpenOrderInfo` props).
      title: (
        <>
          <p className="lyra-body-md text-lyra-fg-default">
            Hello, I am on a call with{" "}
            <button
              type="button"
              onClick={onOpenCustomerInfo}
              className="lyra-body-md-emphasis text-lyra-fg-link hover:underline focus-visible:outline-none"
            >
              Marcus Webb
            </button>
            . He has an{" "}
            <button
              type="button"
              onClick={onOpenOrderInfo}
              className="lyra-body-md-emphasis text-lyra-fg-link hover:underline focus-visible:outline-none"
            >
              order for noise-cancelling headphones
            </button>{" "}
            that he placed last Tuesday. He reported the item arrived with a cracked ear cup.
          </p>
          <p className="lyra-body-md text-lyra-fg-default">
            I've confirmed the $200 refund qualifies, but it exceeds our $100 auto-approval limit, so I've placed
            Marcus on hold pending your sign-off.
          </p>
        </>
      ),
      // Per explicit follow-up request, this bubble's OWN picker only
      // shows for as long as no "Something else" round has ever started —
      // the moment the first one does, the live picker hands off to that
      // round's own follow-up bubble instead (see the new
      // `somethingElseRounds.map(...)` render block, below the action
      // log), matching the same "earlier bubble freezes once you've
      // moved on" pattern Approve/Reject already established.
      content:
        somethingElseRounds.length === 0 ? (
          <MarcusWebbTaskCard
            heading="How would you like to proceed?"
            options={OPTIONS}
            selected={selected}
            onSelectedChange={setSelected}
            onConfirm={handleTopLevelConfirm}
            confirmDisabled={confirmDisabled}
            notes={topLevelNotes}
            phase={topLevelPhase}
            optionPanels={{ approve: MARCUS_APPROVE_PANEL, reject: MARCUS_REJECT_PANEL }}
            onViewArticle={onViewArticle}
            selectedArticleId={selectedArticleId}
          />
        ) : null,
    };
  } else if (
    SHOW_REJECT_PROCESSING_STEPS &&
    confirmed === "reject" &&
    lastRejectRound.stepIndex >= REJECT_STEP_LABELS.length &&
    !flagConfirmed &&
    !approvedAfterReject
  ) {
    activeQuestionItem = {
      id: "photo-decision",
      title: <p className="lyra-body-md text-lyra-fg-default">How would you like to proceed?</p>,
      content: (
        <NextBestActionOptionPicker
          options={PHOTO_DECISION_OPTIONS}
          selected={photoDecisionSelected}
          onSelectedChange={setPhotoDecisionSelected}
          onConfirm={handlePhotoDecisionConfirm}
          confirmDisabled={
            (photoDecisionSelected === "something-else" && photoDecisionNote.trim().length === 0) ||
            (photoDecisionSelected === "reject" && photoDecisionRejectReason.trim().length === 0)
          }
          notes={{
            reject: {
              value: photoDecisionRejectReason,
              onChange: setPhotoDecisionRejectReason,
              placeholder: "e.g. the damage report needs photos before this can be approved...",
              label: "Enter a reason",
            },
            "something-else": {
              value: photoDecisionNote,
              onChange: setPhotoDecisionNote,
              placeholder: 'e.g. "Flag this account for review"',
            },
          }}
        />
      ),
    };
  }

  // Records each distinct question `id` the moment it first becomes
  // `activeQuestionItem` — see `askedQuestions`'/`MarcusWebbAiChatBubble`'s
  // own doc comments. Repeated "something else" rounds keep the SAME id
  // active (`next-best-action` staying active across rounds, per that
  // branch's own doc comment above) so they never re-append here — the
  // bubble just keeps showing its live picker throughout, unchanged.
  useEffect(() => {
    if (!activeQuestionItem) return;
    const id = activeQuestionItem.id;
    const title = activeQuestionItem.title;
    setAskedQuestions((prev) => (prev.some((q) => q.id === id) ? prev : [...prev, { id, title, timestamp: nowTimestamp() }]));
  }, [activeQuestionItem?.id, activeQuestionItem?.title]);

  // Placeholder in the slot whenever nothing's scripted-pending — no LLM
  // wired up yet (see `commandInputValue`'s own doc comment above), but
  // submitting DOES append a placeholder knowledge-article card (below,
  // rendered inline, never in this fixed slot — same "processing happens
  // inline" precedent as everything else on this card).
  // Per explicit bug report (with a reference screenshot showing an
  // oversized gap below "Disposition updated..."): the "pure history"
  // block below (`!takenOver && confirmed`) used to render its wrapping
  // `<div className="flex flex-col gap-3">` unconditionally, even once
  // `approveBlock`/`rejectBlock` had both already finished (gone `null`
  // — see each one's own doc comment for why) and the "something else"
  // branch (which never has anything to show here at all — see its own
  // comment at that render site) was active. An EMPTY flex item still
  // counts as a sibling for gap purposes, so the surrounding `gap-6`
  // (this file's own "24px between items" change) applied on BOTH sides
  // of that empty div — stacking with the actionLog block's own trailing
  // gap above it and the completion bubble's own leading gap below it
  // into a visibly doubled ~48px gap, exactly as reported. Computed here,
  // once, from the same three sources the render below already reads
  // (`approveBlock`/`rejectBlock`/`flagConfirmed`/`approvedAfterReject`)
  // so the wrapper can be skipped entirely — not just left empty — the
  // moment none of them have anything left to show.
  const pureHistoryHasContent =
    confirmed === "approve"
      ? !!approveBlock
      : confirmed === "reject"
        ? !!(
            (SHOW_REJECT_PROCESSING_STEPS
              ? rejectRounds.some((round, i) => round.reasonSubmitted && i === 0)
              : lastRejectRound.reasonSubmitted && rejectBlock) ||
            flagConfirmed ||
            (approvedAfterReject && approveBlock)
          )
        : // "something-else" never has anything to show in this block —
          // see that branch's own comment at the render site below.
          false;

  const commandSlotContent: React.ReactNode = !activeQuestionItem && SHOW_DO_SOMETHING_INPUT ? (
    <AIInput
      singleLine
      helperText=""
      placeholder="Do something..."
      value={commandInputValue}
      onChange={setCommandInputValue}
      onSubmit={(text: string) => {
        if (!text.trim()) return;
        setCommandInputValue("");
        const id = String(nextArticleId.current++);
        setSuggestedArticles((prev) => [...prev, { id }]);
        // Per explicit request, auto-opens the detail panel the instant
        // this is "processed" — there's no real processing step yet (see
        // this file's own top-of-section doc comment), so that's simply
        // the moment the row itself is created. Once real LLM processing
        // exists, move this call to wherever that processing actually
        // finishes instead.
        onViewArticle?.({ ...PLACEHOLDER_KNOWLEDGE_ARTICLE, id });
      }}
    />
  ) : null;

  // `Contact Overview`'s own card, rendered inline as ordinary (scrolling)
  // transcript content — see the render below — rather than portaled.
  // Per explicit request, `variant="default"` + `shadow-none` gives it a
  // plain white surface with no drop shadow, unlike the floating question
  // card above.
  const buildContactOverviewContainer = () => (
    <Container variant="default" className="shadow-none">
      <Accordion defaultValue={contactOverviewItem.id} items={[contactOverviewItem]} />
    </Container>
  );

  // Copilot interstitial rows: each is placed by whether the call had been taken over when it was asked, so a question
  // asked after takeover lands below the takeover notice / remedy bubble instead of above it.
  const copilotAskedAfterTakeoverRef = useRef<Record<string, boolean>>({});
  const askedAfterTakeover = (id: string) => {
    if (!(id in copilotAskedAfterTakeoverRef.current)) copilotAskedAfterTakeoverRef.current[id] = !!takenOver;
    return copilotAskedAfterTakeoverRef.current[id];
  };
  const copilotRows = copilotRequests ?? [];
  const renderCopilotRow = (r: { id: string; text: string; time: string; performedAt?: number }) => (
    <InstructionInterstitial
      key={r.id}
      id={r.id}
      instruction={{ title: r.text, by: "John Smith", link: r.id }}
      performedAt={r.performedAt}
      timestamp={r.time}
      active={activeCopilotRequestId === r.id}
      onOpen={() => onOpenCopilotRequest?.(r)}
    />
  );
  return (
    // Per explicit follow-up request ("update the gap between chat
    // bubbles and other items to be 24px instead of 12px"): `gap-6`
    // (1.5rem/24px), not the original `gap-3` (0.75rem/12px) — this is
    // the single top-level flex column every item in the whole action
    // log/conversation reads off (Contact Overview, each chat bubble,
    // the action-log block below, the pure-history block, the
    // completion bubbles), so widening it here widens the rhythm
    // between ALL of them at once. `actionLog`'s own inner wrapper
    // (right below) gets the identical change for the same reason, one
    // level down (the gap BETWEEN "Refund approved"/"Disposition
    // updated..." etc, not just around the whole block).
    <div className="flex flex-col gap-6">
      {/* Contact Overview renders inline, in normal flow, permanently —
          per explicit follow-up request, it's no longer hidden after the
          agent's first selection. It's initial context, not something
          awaiting an answer, so it never portals either. */}
      {SHOW_CONTACT_OVERVIEW && buildContactOverviewContainer()}
      {/* The top-level "How would you like to proceed?" question's own
          chat bubble — rendered here, right after Contact Overview, which
          is also where it first appears live. It stays here permanently
          once answered too (text visible, no options) — see
          `askedQuestions`'/`MarcusWebbAiChatBubble`'s own doc comments —
          so `actionLog`'s "Refund rejected"/etc. entry, logged right
          below, correctly reads as happening AFTER this bubble was asked,
          not before it. */}
      {askedQuestions
        .filter((q) => q.id === "next-best-action")
        .map((q) => (
          <ApprovalRequestAccordion
            key={q.id}
            summary={MARCUS_WEBB_APPROVAL_SUMMARY}
            revealKey="marcus-approval"
            revealDelayMs={1400}
            onLink={(key) => key.startsWith("memory:") && onOpenExperienceMemory?.(key.slice(7))}
            timestamp={q.timestamp}
            footer={activeQuestionItem?.id === q.id ? activeQuestionItem.content : undefined}
          />
        ))}
      {/* Each "Something else" round's own animated sequence — per
          explicit follow-up request (with a reference screenshot):
          "AI agent is performing this now…" (no instruction card yet) →
          the "Instruction sent" card appears (animated in) + a SEPARATE
          "AI agent is analyzing…" spinner starts → that analyzing spinner
          is replaced by a brand-new chat bubble with an analysis message
          and a fresh row of buttons. Since a new round can only start
          once the previous one's follow-up bubble has already appeared
          (no buttons exist to submit another round until then), every
          round except possibly the last is always fully at
          `stepIndex >= SOMETHING_ELSE_STEPS` — this is a single ordered
          `.map()`, no interleaving against `actionLog` needed (nothing
          here is logged into `actionLog` at all anymore — see
          `somethingElseRounds`'s own doc comment). Only the LAST round's
          follow-up bubble ever shows a live picker, and only while
          `confirmed !== "reject"` (Approve/Reject can only happen from
          whichever bubble is currently live, so this mirrors the exact
          same gating the original bubble's own `content` above uses). */}
      {somethingElseRounds.map((round, i) => (
        <React.Fragment key={i}>
          <div className="flex items-center gap-2 px-1 animate-in slide-in-from-bottom-4 fade-in-0 duration-200">
            {round.stepIndex >= 1 ? (
              <CheckCircle2 className="h-4 w-4 text-lyra-status-success-strong" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <Spinner size="sm" />
            )}
            <span className="lyra-body-sm text-lyra-fg-secondary">
              {round.stepIndex >= 1 ? "AI agent finished performing this." : "AI agent is performing this now…"}
            </span>
          </div>
          {round.stepIndex >= 1 && (
            <div className="animate-in slide-in-from-bottom-4 fade-in-0 duration-200">
              <ActionLogNoteEntry
                entry={{
                  id: `something-else-${i}`,
                  kind: "note",
                  // Per explicit follow-up request, the instruction ITSELF
                  // is this row's title (truncated by `ActionLogNoteEntry`
                  // if long) instead of a generic "Instruction sent" label
                  // — no separate `description` quote below it, since that
                  // would just repeat this same text a second time.
                  title: round.note,
                  timestamp: round.timestamp,
                  actorName: "John Smith",
                  icon: (
                    <MessageSquareText className="h-4 w-4 text-lyra-fg-secondary" strokeWidth={1.5} aria-hidden="true" />
                  ),
                }}
                selected={selectedTransactionsId === `something-else-${i}`}
                onClick={() =>
                  onOpenTransactions?.({
                    id: `something-else-${i}`,
                    note: round.note,
                    timestamp: round.timestamp,
                    date: round.date,
                    showFullTransactions: round.showFullTransactions,
                  })
                }
              />
            </div>
          )}
          {round.stepIndex === 1 && (
            <div className="flex items-center gap-2 px-1 animate-in slide-in-from-bottom-4 fade-in-0 duration-200">
              <Spinner size="sm" />
              <span className="lyra-body-sm text-lyra-fg-secondary">AI agent is analyzing…</span>
            </div>
          )}
          {round.stepIndex >= SOMETHING_ELSE_STEPS && (
            <MarcusWebbAiChatBubble
              title={
                <>
                  <p className="lyra-body-md text-lyra-fg-default">
                    I have analyzed the order history and it appears Marcus Webb has 5 damaged product claims in the
                    last 10 transactions. This is an alarmingly high amount.
                  </p>
                </>
              }
              timestamp={round.timestamp}
            >
              {i === somethingElseRounds.length - 1 && confirmed !== "reject" && (
                <MarcusWebbTaskCard
                  heading="How would you like to proceed?"
                  options={OPTIONS}
                  selected={selected}
                  onSelectedChange={setSelected}
                  onConfirm={handleTopLevelConfirm}
                  confirmDisabled={confirmDisabled}
                  notes={topLevelNotes}
                  phase={topLevelPhase}
                  optionPanels={{ approve: MARCUS_APPROVE_PANEL, reject: MARCUS_REJECT_PANEL }}
            onViewArticle={onViewArticle}
            selectedArticleId={selectedArticleId}
                />
              )}
            </MarcusWebbAiChatBubble>
          )}
        </React.Fragment>
      ))}
      {/* Copilot questions asked BEFORE takeover sit here; ones asked after takeover render at the very end (chronological). */}
      {copilotRows.filter((r) => !askedAfterTakeover(r.id)).map(renderCopilotRow)}
      {/* Per explicit request ("none of these should be fixed"), NONE of
          the `activeQuestionItem` questions portal into the fixed bottom
          slot anymore — all three render inline as chat bubbles instead
          (see `MarcusWebbAiChatBubble`). This still portals
          `commandSlotContent` (the currently-hidden "Do something"
          `AIInput`) — the only thing left that can occupy the fixed slot
          — which itself only ever renders when `activeQuestionItem` is
          null (see its own definition above), so the slot naturally stays
          empty/collapsed (`empty:hidden`) while any question is pending. */}
      {portalToQuestionSlot(commandSlotContent)}
      {actionLog.length > 0 && (
        // See the outer container's own doc comment above — same
        // gap-3 -> gap-6 change, one level down.
        <div className="flex flex-col gap-6">
          {actionLog.map((entry) =>
            entry.kind === "simple" ? (
              <ActionLogSimpleEntry
                key={entry.id}
                timestamp={entry.timestamp}
                title={entry.title}
                actorName={entry.actorName}
              />
            ) : (
              <ActionLogNoteEntry
                key={entry.id}
                entry={entry}
                selected={entry.id === selectedActionLogEntryId}
                onClick={() => onActionLogEntryOpen?.(entry)}
              />
            )
          )}
        </div>
      )}
      {/* "Do Something" suggested-article rows — inline, never portaled
          into the fixed slot (see `commandSlotContent`'s own doc comment
          above), independent of `takenOver`/`confirmed` like every other
          block tied to the command field. Per explicit follow-up, a
          compact row (matching "Refund approved"'s own weight) rather
          than a fully expanded card — its full content lives in the
          side panel `onViewArticle` opens instead. `data.id` is
          overridden with THIS row's own unique id (not the shared
          placeholder content's own `"tablet-warranty-coverage"` id) so
          multiple submitted rows can be independently selected/toggled —
          see `selectedArticleId`'s own doc comment. */}
      {suggestedArticles.map((a) => (
        <KnowledgeArticleSummaryRow
          key={a.id}
          data={PLACEHOLDER_KNOWLEDGE_ARTICLE}
          selected={a.id === selectedArticleId}
          onClick={() => onViewArticle?.({ ...PLACEHOLDER_KNOWLEDGE_ARTICLE, id: a.id })}
        />
      ))}
      {/* Everything below is pure history — `AIProcess` step lists, the
          photo, the approve summary — none of it is "awaiting an answer,"
          so none of it ever portals. Nothing renders here at all while
          `takenOver` (the remedy question — or nothing, once answered —
          already covers that whole state; see `activeQuestionItem` above),
          or before the top-level question's been answered. */}
      {!takenOver && confirmed && pureHistoryHasContent && (
        <div className="flex flex-col gap-3">
          {confirmed === "approve" ? (
            // Per explicit follow-up ("the processing approval should
            // show after the refund approved note, not inside the AI
            // chat bubble") — `approveBlock` renders HERE, its original
            // spot (after the action log's "Refund approved" entry
            // above), not inside the top-level bubble. An earlier pass
            // moved it into the bubble via `MarcusWebbTaskCard`'s
            // `"processing"` phase; that phase (and `"completed"`) now
            // render nothing there instead — see that component's own
            // doc comment.
            approveBlock
          ) : confirmed === "reject" ? (
            <div className="flex flex-col gap-4">
              {/* Only round 0 ever gets its own `AIProcess`/photo — per
                  explicit follow-up, rejecting again after the photo
                  (round ≥ 1) doesn't simulate another photo request; it's
                  terminal, with only its own follow-up log entry (above,
                  in `actionLog`) to show for it. Gated on
                  `SHOW_REJECT_PROCESSING_STEPS` — own doc comment, top of
                  file — `rejectBlock` (computed above) is round 0's
                  replacement while it's off. */}
              {SHOW_REJECT_PROCESSING_STEPS
                ? rejectRounds.map(
                    (round, i) =>
                      round.reasonSubmitted &&
                      i === 0 && (
                        <div key={i} className="flex flex-col gap-3">
                          <AIProcess
                            expanded={!collapsedRejectRounds.has(i)}
                            onExpandedChange={(next: boolean) => setRejectRoundExpanded(i, next)}
                            label="Requesting additional information"
                            steps={buildRejectSteps(round.stepIndex)}
                          />
                          {round.stepIndex >= REJECT_STEP_LABELS.length && (
                            <div className="flex flex-col gap-2">
                              <p className="lyra-body-sm text-lyra-fg-secondary">
                                The customer provided the attached photo.
                              </p>
                              <AttachmentThumbnail
                                filename="damaged-earcup.jpg"
                                alt="Photo of the damaged headphone ear cup"
                                src={damagedHeadphonesImg}
                                onClick={onPhotoExpand}
                              />
                            </div>
                          )}
                        </div>
                      )
                  )
                : lastRejectRound.reasonSubmitted && rejectBlock}
              {flagConfirmed && (
                <AIProcess
                  expanded={flagExpanded}
                  onExpandedChange={setFlagExpanded}
                  label="Flagging for review"
                  steps={flagSteps}
                />
              )}
              {approvedAfterReject && approveBlock}
            </div>
          ) : (
            // "Something else" — per explicit follow-up, this used to be a
            // plain inline spinner/checkmark row here; it's now the
            // `somethingElseRounds` sequence rendered in its own dedicated
            // block instead (right after the top-level bubble, before this
            // one), so there's nothing left for this branch to show.
            null
          )}
        </div>
      )}
      {/* Per explicit request ("show them typing" when the agent takes
          over), shown for the same `COMPLETION_TYPING_DELAY_MS` window
          `remedyBubbleTyping`'s own doc comment (near
          `takeoverIntroducedRef`) describes, right after the "Agent Smith
          has taken over the conversation." milestone and before the
          remedies bubble itself appears below. */}
      {takenOver && remedyBubbleTyping && <MarcusWebbAiTypingIndicator />}
      {/* The post-takeover "Suggested remedies" and post-photo-decision
          chat bubbles both render here — after the pure-history block
          above — because that's the position each of them first appears
          live in: the remedies question replaces the top-level one
          entirely (`takenOver` short-circuits the history block, so
          nothing renders above this point in that flow), and the
          post-photo decision genuinely needs to read below round 0's own
          `AIProcess`/photo. `.filter(id !== "next-best-action")` covers
          both ids together (they're mutually exclusive in the common
          flow) and, in the rare case an agent takes over mid-reject
          (leaving a still-unanswered photo-decision bubble behind when
          remedies takes over), keeps both in the order they were asked —
          same "stays visible once answered" behavior as the top-level
          bubble above. See `askedQuestions`'/`MarcusWebbAiChatBubble`'s
          own doc comments. */}
      {askedQuestions
        .filter((q) => q.id !== "next-best-action")
        .map((q) => (
          <MarcusWebbAiChatBubble key={q.id} title={q.title} timestamp={q.timestamp}>
            {activeQuestionItem?.id === q.id && activeQuestionItem.content}
          </MarcusWebbAiChatBubble>
        ))}
      {/* Per explicit follow-up request ("put the followup in a new
          conversation bubble below the refund note and latest actions -
          keep it like a conversation"), Approve's completion message
          (screenshot 3) is its OWN new chat bubble, rendered at the very
          end — after the action log's "Refund approved"/"Disposition
          updated..." entries above — rather than appended inside the
          original "How would you like to proceed?" bubble
          (`MarcusWebbTaskCard`'s `"completed"` phase renders nothing, by
          design; see its own doc comment). `completionTimestamp` is
          `null` until `topLevelPhase` first reaches `"completed"`, so
          this simply doesn't render until then. `completionTyping`
          (own doc comment above) covers the gap between that moment and
          this bubble actually appearing — `MarcusWebbAiTypingIndicator`
          instead, for the same brief window. */}
      {completionTyping && <MarcusWebbAiTypingIndicator />}
      {completionTimestamp && (
        <MarcusWebbAiChatBubble
          title={
            <p className="lyra-body-md text-lyra-fg-default">
              Excellent. I have approved the refund and responded to Marcus. I will let you know if there is any
              further issue with this contact.
            </p>
          }
          timestamp={completionTimestamp}
        >
          {postCompletionRounds.length === 0 && (
            <MarcusWebbCompletionActions
              onDismissAndUnassign={onDismissAndUnassign}
              inputOpen={postCompletionInputOpen}
              note={postCompletionNote}
              onNoteChange={setPostCompletionNote}
              onOpenInput={() => setPostCompletionInputOpen(true)}
              onSubmit={handlePostCompletionSubmit}
            />
          )}
        </MarcusWebbAiChatBubble>
      )}
      {/* Reject's own mirror of the completion bubble just above — see
          `rejectCompletionTyping`/`rejectCompletionTimestamp`'s own doc
          comment (near `takeoverIntroducedRef`) and `SHOW_REJECT_
          PROCESSING_STEPS`'s (top of file) for the "why": while that flag
          is off, this is the ONLY thing Reject ends on — no photo, no
          "how would you like to proceed" follow-up question, no further
          round-trip. Same `Dismiss And Unassign`/`Something Else` buttons
          as Approve's own completion bubble, same no-op placeholder on
          the latter (see that button's own call site just above). */}
      {rejectCompletionTyping && <MarcusWebbAiTypingIndicator />}
      {rejectCompletionTimestamp && (
        <MarcusWebbAiChatBubble
          title={
            <p className="lyra-body-md text-lyra-fg-default">
              I have requested the customer provide a photo of the damaged item. This seems to have upset them.
              Their sentiment is detected at slightly negative.
            </p>
          }
          timestamp={rejectCompletionTimestamp}
        >
          {postCompletionRounds.length === 0 && (
            <MarcusWebbCompletionActions
              onDismissAndUnassign={onDismissAndUnassign}
              inputOpen={postCompletionInputOpen}
              note={postCompletionNote}
              onNoteChange={setPostCompletionNote}
              onOpenInput={() => setPostCompletionInputOpen(true)}
              onSubmit={handlePostCompletionSubmit}
            />
          )}
        </MarcusWebbAiChatBubble>
      )}
      {/* Every "Something Else" round submitted from a completion bubble's
          own `MarcusWebbCompletionActions` — see `postCompletionRounds`'
          own doc comment (near `takeoverIntroducedRef`) for the full
          "why"/shape. Genuinely unbounded: nothing here ever stops the
          last round's own response bubble from offering
          `MarcusWebbCompletionActions` again, so this can keep growing
          for as long as the agent keeps submitting. The instruction note
          reuses the exact same `ActionLogNoteEntry` shape/behavior the
          top-level "Something else" rounds already established
          (`somethingElseRounds`, above) — title = the note itself,
          clicking it opens the same transactions side panel. */}
      {postCompletionRounds.map((round, i) => (
        <React.Fragment key={i}>
          <ActionLogNoteEntry
            entry={{
              id: `post-completion-${i}`,
              kind: "note",
              title: round.note,
              timestamp: round.timestamp,
              actorName: "John Smith",
              icon: <MessageSquareText className="h-4 w-4 text-lyra-fg-secondary" strokeWidth={1.5} aria-hidden="true" />,
            }}
            selected={selectedTransactionsId === `post-completion-${i}`}
            onClick={() =>
              onOpenTransactions?.({
                id: `post-completion-${i}`,
                note: round.note,
                timestamp: round.timestamp,
                date: round.date,
                showFullTransactions: round.showFullTransactions,
              })
            }
          />
          {round.stepIndex === 0 && (
            <div className="flex items-center gap-2 px-1 animate-in slide-in-from-bottom-4 fade-in-0 duration-200">
              <Spinner size="sm" />
              <span className="lyra-body-sm text-lyra-fg-secondary">AI agent is working…</span>
            </div>
          )}
          {round.stepIndex === 1 && <MarcusWebbAiTypingIndicator />}
          {round.stepIndex >= 2 && (
            <MarcusWebbAiChatBubble
              title={
                <p className="lyra-body-md text-lyra-fg-default">
                  I've noted your instruction and taken the appropriate action. Let me know if there's anything
                  else I can help with regarding this contact.
                </p>
              }
              timestamp={round.timestamp}
            >
              {i === postCompletionRounds.length - 1 && (
                <MarcusWebbCompletionActions
                  onDismissAndUnassign={onDismissAndUnassign}
                  inputOpen={postCompletionInputOpen}
                  note={postCompletionNote}
                  onNoteChange={setPostCompletionNote}
                  onOpenInput={() => setPostCompletionInputOpen(true)}
                  onSubmit={handlePostCompletionSubmit}
                />
              )}
            </MarcusWebbAiChatBubble>
          )}
        </React.Fragment>
      ))}
      {copilotRows.filter((r) => askedAfterTakeover(r.id)).map(renderCopilotRow)}
    </div>
  );
}
