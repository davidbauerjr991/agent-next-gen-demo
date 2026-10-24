import React, { useRef } from "react";
import { cn } from "@/lib/utils";
import {
  AccordionHeadless,
  AccordionHeadlessItem,
  AccordionHeadlessContent,
  ContactOverview,
  Button,
  Badge,
} from "@nicecxone/lyra-ui";
import { ArrowDown } from "lucide-react";
import { initialsFor } from "@/components/agent-next-gen-shared-utils";
import { useCapability } from "@/provider-context";
import { useSetting } from "@/settings";

/* ── Transcript + Composer ──
   Split out of AgentNextGenPage.tsx (which had grown past Babel's 500KB
   code-generator threshold — see that file's own top-of-file note): every
   message-bubble/session/transcript/composer piece that renders an
   interaction's actual conversation, plus the mock session/message data
   that seeds it. Genuinely self-contained — per a dependency-graph script
   run before the split, nothing here references any OTHER
   AgentNextGenPage-specific type/component/mock-data by name (only
   `agent-next-gen-shared-utils.ts`'s pure helpers) — so this file sits at
   the same "no incoming feature-file dependencies" tier as that one, just
   one level up. `AgentNextGenPage` itself imports `InteractionTranscript`/
   `InteractionComposer` (the two real render entry points) plus a handful
   of types/constants (`TranscriptMessage`, `OUTCOME_TAG_OPTIONS`, etc.)
   still referenced from its own outcome-popover/notification code. */

// P-EXTRACT: the view-model types and the fixed option lists / mock
// sessions live in ./transcript/ now; re-exported here for existing importers.
import type { TranscriptApprovalSummary, TranscriptMessage, TranscriptSession } from "@/components/transcript/transcript-types";
import {
  OUTCOME_DEFAULT_SUMMARY,
  OUTCOME_DISPOSITION_OPTIONS,
  OUTCOME_TAG_OPTIONS,
  TRANSCRIPT_SESSION_STATUS_OPTIONS,
} from "@/components/transcript/transcript-fixtures";
export type { TranscriptApprovalSummary, TranscriptMessage, TranscriptSession };
export { OUTCOME_DISPOSITION_OPTIONS, OUTCOME_TAG_OPTIONS, TRANSCRIPT_SESSION_STATUS_OPTIONS };

// P-EXTRACT: the AI rows (feed, cards, instruction row) live in ./ai-rows/.
import { AiActionCollapse, AiActionsFeed, ApprovalDecision, ApprovalRequestAccordion } from "./ai-rows/ai-action-cards";
import { InstructionInterstitial } from "./ai-rows/InstructionInterstitial";
export { AiActionsFeed, ApprovalDecision, ApprovalRequestAccordion, InstructionInterstitial };

// P-EXTRACT: the message rows (bubbles, plain lines, typing indicator) live in ./message-list/.
import { TranscriptMessageBubble } from "./message-list/transcript-bubbles";

// P-EXTRACT: the composer and its quick replies live in ./composer/; the simulated customer's canned replies are
// simulation content (src/adapters/sim/sim-auto-replies.ts, resolved by contact-handling/customer-auto-reply.ts).
import { InteractionComposer } from "./composer/InteractionComposer";
import { ComposerFade } from "./composer/ComposerFade";
import { AI_CARD_ENTER } from "./ai-rows/ai-card-enter";
export { AI_CARD_ENTER, ComposerFade, InteractionComposer };

import { deriveTranscriptSessions } from "@/components/transcript/transcript-sessions";
// P-EXTRACT: the session row lives in ./transcript/session-row/ now.
import { TranscriptSessionSeparator } from "@/components/transcript/session-row/TranscriptSessionSeparator";

import type { InteractionTranscriptProps } from "./interaction-transcript-props";
import { useTranscriptScrollFollow } from "./useTranscriptScrollFollow";
import { useSessionControls } from "./useSessionControls";
import { TranscriptLiveMessages } from "./message-list/TranscriptLiveMessages";
export type { InteractionTranscriptProps };

// `ContactOverview` and its `ContactOverviewInfo` type used to live here as
// a bespoke, hand-rolled block — promoted to lyra-ui (see this file's own
// import from "@nicecxone/lyra-ui" above) per explicit request, both so
// other consumers get the same component and so its expand/collapse gets a
// real height animation (built on the same Radix accordion primitive/
// `accordion-down`/`accordion-up` keyframes every other accordion in that
// package already uses) instead of this file's old plain conditional
// render. See that component's own doc comment (lyra-ui's
// contact-overview.tsx) for the full reasoning.

export function InteractionTranscript({
  channelType,
  direction,
  customerName,
  customerIdentified = true,
  hideMockFollowUpMessages = false,
  hideAllMessages = false,
  sessionRowOnly = false,
  hideCurrentSessionRow = false,
  contactId,
  channelAddressLabel,
  skillLabel,
  isFreshLaunch,
  contactOverview: contactOverviewIn,
  overview: overviewIn,
  hideAiActions = false,
  hideTranscript = false,
  contactOverviewPosition,
  onViewCustomerInfo,
  onViewInteractionHistory,
  onLaunchPreviousAgentInteraction,
  reopenedContacts,
  liveMessages: liveMessagesIn,
  currentStatus,
  onCurrentStatusChange,
  outcomeOpen,
  onOutcomeOpenChange,
  outcomeTags,
  onOutcomeTagsChange,
  outcomeDispositionCode,
  onOutcomeDispositionChange,
  outcomeSummary,
  onOutcomeSummaryChange,
  onOutcomeSave,
  onOutcomeCancel,
  outcomeCallEnded,
  outcomeShowSaveAndRedial,
  onOutcomeSaveAndRedial,
  onOutcomeSaveAndDismiss,
  onDismissChannel,
  dimmed,
  showSessionActionCluster = true,
  showSessionConsultTransferAndAddParticipant = true,
  showSessionKebabMenu = true,
  sessionOutcomeAfterStatus = false,
  showSessionAddParticipant = true,
  sessionTransferInKebabMenu = false,
  sessionStatusAndKebabBeforeOutcome = false,
  sessionControlsReadOnly = false,
  showSessionStatus: showSessionStatusProp,
  trailingContent,
  trailingContentKey,
  isNewThread = false,
  onSendDraft,
  isCustomerTyping = false,
  isAiTyping = false,
  onApprovalDecision,
  onApprovalCallRequest,
  onApprovalSuggestionAsk,
  approvalTakenOver,
  activeSnapshotLink,
  onWrapUpComplete,
  onSnapshotLink,
  onViewSessionDetails,
  onToggleDetailsPanel,
  detailsPanelOpen = false,
  detailsPanelPreviewContent,
  detailsPanelPreviewOpen = false,
  onDetailsPanelPreviewHoverStart,
  onDetailsPanelPreviewHoverEnd,
  showViewDetails = true,
  viewDetailsLabel = "View Details",
  sessionRowPortalTarget,
  hideSessionSeparatorFade = false,
}: InteractionTranscriptProps) {
  const caseStatusCapable = useCapability((c) => c.interaction.caseStatus);
  // Settings → Assignments → "Show status chip in the session row" (k6 3): every mode; Outcome keeps its own status control.
  const [showStatusChip] = useSetting("assignments", "showStatusChip");
  const showSessionStatus = (showSessionStatusProp ?? caseStatusCapable) && showStatusChip;
  const contactOverview = contactOverviewIn;
  const customerContextOverview = overviewIn;
  const liveMessages = liveMessagesIn;
  // Which sessions this thread shows (a fresh launch's synthesized one, the
  // mock log, the reopens) and which is current: `deriveTranscriptSessions`
  // (transcript/transcript-sessions.ts), a pure function of these props, so
  // the page derives the same current session without mounting this. Computed
  // up here, before any hooks below, purely so `sessionsToRender`
  // (specifically its LAST entry's id) is available to `getSessionStatus`/
  // `selectSessionStatus`/`handleConfirmCloseSession` further down without
  // reordering those — this is a plain computation from props, not a hook
  // itself, so moving it earlier doesn't affect hook call order/count.
  const {
    isTextChannel,
    baseSessions: baseSessionsToRender,
    reopenedSessions: reopenedSessionsToRender,
    sessions: sessionsToRender,
    lastSessionId,
  } = deriveTranscriptSessions({
    channelType,
    isFreshLaunch,
    contactId,
    channelAddressLabel,
    skillLabel,
    hideMockFollowUpMessages,
    reopenedContacts,
  });

  // Slices the one flat `liveMessages` array back into per-session chunks,
  // keyed by session id — per explicit correction, reopening a closed
  // channel must NOT wipe its prior messages; they need to keep rendering
  // (dimmed) under their ORIGINAL session, with only the messages sent
  // since the reopen landing under the new one. Each `reopenedContacts`
  // entry's own `messagesBeforeReopen` (see that field's own doc comment)
  // is the exact index boundary: everything before the first reopen's
  // boundary belongs to `baseSessionsToRender`'s own last id (the session
  // `liveMessages` always attached to before reopens existed at all);
  // everything between one reopen's boundary and the next belongs to that
  // reopen's own session id; everything after the last boundary belongs to
  // the most recent reopen. Plain computation (not a memo) — cheap, and
  // `sessionsToRender` right above it isn't memoized either.
  const baseLiveMessageSessionId = baseSessionsToRender[baseSessionsToRender.length - 1]?.id;
  const liveMessagesBySessionId: Record<string, TranscriptMessage[]> = {};
  if (isTextChannel) {
    const boundaries = reopenedSessionsToRender.map(
      (_, idx) => reopenedContacts?.[idx]?.messagesBeforeReopen ?? liveMessages.length
    );
    let start = 0;
    if (baseLiveMessageSessionId) {
      const end = boundaries[0] ?? liveMessages.length;
      liveMessagesBySessionId[baseLiveMessageSessionId] = liveMessages.slice(0, end);
      start = end;
    }
    reopenedSessionsToRender.forEach((session, idx) => {
      const end = boundaries[idx + 1] ?? liveMessages.length;
      liveMessagesBySessionId[session.id] = liveMessages.slice(start, end);
      start = end;
    });
  } else if (baseLiveMessageSessionId) {
    // Voice/Email — no reopen concept at all (see `isTextChannel`'s own
    // gate above); the whole flat array still attaches to the single base
    // session's id, same as before this per-session slicing existed.
    liveMessagesBySessionId[baseLiveMessageSessionId] = liveMessages;
  }

  // Which of the two `ContactOverview` spots below actually renders it —
  // see `contactOverviewPosition`'s own doc comment for why this isn't
  // simply `isFreshLaunch` itself for every caller.
  const contactOverviewAtBottom = contactOverviewPosition
    ? contactOverviewPosition === "bottom"
    : !isFreshLaunch;
  // Once an approval request is in the conversation, the Autosummary sits directly above it (for quick access) instead of at the top.
  const overviewBeforeApproval =
    contactOverviewPosition === "top" && !!(contactOverview || customerContextOverview) && liveMessages.some((m) => !!m.summary);

  // Per explicit follow-up bug report ("you put it above the latest
  // interaction bubbles - it should be at the bottom"): for the transfer/
  // existing-conversation `ContactOverview` spot (`contactOverviewAtBottom`,
  // below), this session's own `liveMessagesBySessionId` entry can ALREADY contain
  // pre-existing conversation content when the transcript first renders
  // (a Contact History resume seeds its whole prior conversation through
  // `liveMessages`, not the fixed `messages` array) — rendering
  // `ContactOverview` before ALL of those put it above messages that were
  // already there before the agent even opened this contact, not "at the
  // bottom." This ref captures, once per `contactId`, exactly how many of
  // `lastSessionId`'s live messages already existed at that first render —
  // everything up to that count renders ABOVE `ContactOverview` (a
  // continuation of the existing conversation), everything past it renders
  // BELOW (genuinely new, sent/received after this pickup). Applied during
  // render (compare against the last-seen `contactId`, same "adjust a ref
  // when a tracked key changes" pattern `InteractionNavItem`'s own
  // `channelsExpandedOverride` uses) rather than inside a `useEffect`, so
  // the very first render after a contact loads already has the correct
  // split — a `useEffect` would run one render late, letting messages that
  // were already there sneak in below the line for one frame.
  const lastContactOverviewBoundaryContactIdRef = useRef<string | undefined>(undefined);
  const contactOverviewLiveMessageBoundaryRef = useRef(0);
  if (lastContactOverviewBoundaryContactIdRef.current !== contactId) {
    lastContactOverviewBoundaryContactIdRef.current = contactId;
    contactOverviewLiveMessageBoundaryRef.current = (liveMessagesBySessionId[lastSessionId ?? ""] ?? []).length;
  }

  // Renders whichever of the two overview blocks this call actually wants
  // — the newer `CustomerContextOverview` when a caller supplies
  // `customerContextOverview` (see that prop's own doc comment above), else
  // the original `ContactOverview` when a caller supplies `contactOverview`
  // — shared by both of the two render spots below so neither has to
  // duplicate this branch.
  // Hiding AI actions collapses (fade + slide up) rather than unmounting, mirroring the entrance animation.
  // The cards in the caller's `overview` (`AutosummaryCard`) carry their own enter animation.
  // `inStack`: a block of the session's content stack, which owns the top spacing; each
  // block owns only the space below it (`pb-4`), inside the collapse so hiding drops it too.
  const renderContactOverviewBlock = (inStack = false) => (
    <AiActionCollapse hidden={hideAiActions}>
      <div className={cn(inStack && "pb-4")}>{renderContactOverviewBlockInner()}</div>
    </AiActionCollapse>
  );
  const renderContactOverviewBlockInner = () =>
    customerContextOverview ? (
      <div className="flex flex-col gap-3">{customerContextOverview}</div>
    ) : (
      contactOverview && (
        <ContactOverview
          customerName={displayName}
          previousAgent={contactOverview.previousAgent}
          snapshot={contactOverview.snapshot}
          journeySummary={contactOverview.journeySummary}
          onViewCustomerInfo={onViewCustomerInfo}
          onViewInteractionHistory={onViewInteractionHistory}
          onLaunchPreviousAgentInteraction={onLaunchPreviousAgentInteraction}
        />
      )
    );

  // Message/tag state, collapsed sessions and the status popover: `useSessionControls`.
  const {
    sessionMessages,
    initialMessageIdsRef,
    tagPickerOpenId,
    setTagPickerOpenId,
    collapsedSessionIds,
    toggleSessionCollapsed,
    getSessionStatus,
    statusMenuOpenId,
    statusMenuView,
    handleStatusMenuOpenChange,
    selectSessionStatus,
    handleConfirmCloseSession,
    handleCancelCloseSession,
    removeTag,
    clearTags,
    addTag,
    copyMessage,
    liveMessageTags,
    addLiveTag,
    removeLiveTag,
    clearLiveTags,
  } = useSessionControls({ contactId, sessionsToRender, lastSessionId, currentStatus, onCurrentStatusChange, liveMessages });
  // Scroll-follow (land on the newest message, follow new content, the "N new" count) and the bubbles' width
  // breakpoints: `useTranscriptScrollFollow`.
  const {
    scrollContainerRef,
    trailingContentRef,
    bottomSentinelRef,
    contentWrapperRef,
    transcriptNarrow,
    transcriptBubbleFullWidth,
    isAtBottom,
    newMessageCount,
    scrollToLatest,
  } = useTranscriptScrollFollow({ contactId, trailingContentKey, liveMessages, sessionMessages });

  // SMS/WhatsApp (and no active channel yet) — the existing mock chat log,
  // with every customer-sender message's hardcoded mock name/initials
  // ("Liam Davis"/"LD") swapped for this interaction's real customer (see
  // this component's own doc comment above). Only `TranscriptMessageBubble`
  // sees the substituted copy — `sessionMessages` itself (and its tag
  // mutations, keyed by the mock message ids) stays untouched.
  const displayName = customerName?.trim() || "Liam Davis";
  const displayInitials = initialsFor(displayName);

  return (
    // `min-w-0` here — this ROOT div is a flex item of its own
    // `flex flex-1 flex-col min-w-0 overflow-hidden` parent (the record
    // body column, this component's own call site) and was missing
    // `min-w-0` itself. A flex item's default `min-width: auto` applies
    // the browser's "automatic minimum size" floor — the width of
    // whatever's widest UN-WRAPPABLE content anywhere in this subtree —
    // to ANY auto-sized box, not just main-axis flex-grow/shrink
    // distribution; a column-direction parent's cross-axis
    // `align-items: stretch` still respects that floor. Found while
    // chasing a reported width-collapse regression; a real, independent
    // correctness fix kept regardless of how `transcriptNarrow` below
    // ended up being measured.
    // A flex column with the scroller as its `min-h-0 flex-1` child (not
    // `h-full`), so it's the scroller wherever it sits: the main column
    // (a definite height) or a hover preview (only a max height).
    <div className={sessionRowOnly ? "relative shrink-0 min-w-0" : "relative flex min-h-0 min-w-0 flex-1 flex-col"}>
      <div
        ref={scrollContainerRef}
        className={sessionRowOnly ? undefined : "min-h-0 flex-1 overflow-y-auto"}
      >
        {/* Per explicit follow-up request, un-reverting the max-width-back
            change just above it ("dang - revert that last change - go back
            to full screen width"): back to full width again — no
            `max-w`/`mx-auto`/`px-6` on this outer wrapper. The
            `TranscriptSessionSeparator` row (the sticky "N Messages |
            #contactId · date" bar) renders edge-to-edge across the full
            scrollable width instead of being boxed into the same centered
            1024px column as the message bubbles below it — that row picked
            its own `px-6` back up directly on its root (see that
            component's own doc comment) since it no longer inherits an
            inset from this now-unconstrained parent. The 1024px-centered
            column lives on a new wrapper around just the message content,
            per session (see `sessionContentDimmed`'s own wrapper div
            further down) — message bubbles are unaffected visually, still
            centered at the same width as before; only the separator row
            above them is full width. Sticky-STACKING behavior is
            unaffected either way — `position: sticky` resolves against the
            nearest scrolling ancestor (the `overflow-y-auto` div above),
            not against this width constraint. */}
        <div ref={contentWrapperRef} className="w-full">
          {/* Per explicit request ("let's not have multiple threads in a
              chat anymore - simply hide the ones in the existing
              assignments"): only the CURRENT session (`lastSessionId`)
              ever renders here now — every historical session (a past
              `TRANSCRIPT_SESSIONS`/`_VOICE`/`_EMAIL` entry, or an earlier
              `reopenedContacts` entry) is filtered out of the scrollable
              transcript entirely, not just collapsed (the previous
              behavior — see `collapsedSessionIds`' own doc comment above,
              now dead code left in place rather than ripped out: reopening
              a channel still needs its own fresh `Contact` object with a
              new id for `currentStatus`/`onCurrentStatusChange` to attach
              to, and Contact History/session-count bookkeeping elsewhere
              still reads the full un-filtered `sessionsToRender`/
              `liveMessagesBySessionId`, so removing the underlying
              multi-session data model itself would be a much bigger,
              riskier change than what was actually asked for here — a
              purely visual hide). A single still-visible session with no
              other one to distinguish it from reads a little oddly with a
              full "N Messages | #contactId · date" separator bar of its
              own still on screen, but that bar is also this session's only
              home for its status pill/Consult/Transfer/Outcome/Unassign
              cluster, so it stays. */}
          {sessionsToRender
            .filter((session) => session.id === lastSessionId)
            .map((session) => {
            // Falls back to `[]` for the synthetic "just launched" session
            // (not seeded into `sessionMessages` at mount, since it isn't
            // part of the fixed `TRANSCRIPT_SESSIONS` array that seeds that
            // state) — genuinely empty there, not a bug.
            const messages =
              hideAllMessages || (hideMockFollowUpMessages && session.id === "session-2")
                ? []
                : sessionMessages[session.id] ?? [];
            // Patches this session's own current status (which may have
            // been changed via the status popover) onto the otherwise-
            // static session object — `TranscriptSessionSeparator`'s chip
            // and `TranscriptSessionDetails`' "Status" row both read
            // straight off `session.status`, so this one patch keeps both
            // in sync without either needing a separate status prop.
            const sessionWithCurrentStatus: TranscriptSession = {
              ...session,
              status: getSessionStatus(session),
            };
            // Per explicit request: the session detail row itself
            // (`TranscriptSessionSeparator` — the sticky "customerName |
            // address | N Messages | #contactId · date" header, plus its
            // status tag/Consult/Transfer/Outcome cluster) no longer dims
            // when a session reads as closed/historical — only the actual
            // conversation content under it (the mock/live message bubbles,
            // and the Voice/Email "Coming Soon" placeholder) still fades to
            // 50% opacity. Was one `opacity-50` on the whole per-session
            // wrapper (separator included) — moved down onto a new inner
            // wrapper around just the content below the separator instead;
            // see that inner div further down.
            const sessionContentDimmed = session.id !== lastSessionId || dimmed;
            return (
              <div key={session.id} className="flex flex-col">
                {/* No wrapping div around this root — per explicit bug fix
                    ("not sticky at the top anymore"), this must stay a
                    DIRECT child of the per-session `<div key={session.id}>`
                    below, a sibling of the message content div further
                    down, so its containing block has real height to
                    "stick" through as the page scrolls. Its own `px-6` (and
                    full-width, no `max-w`) is applied directly on its root
                    className now instead — see that component's own doc
                    comment. */}
                {/* `hideCurrentSessionRow`: the caller shows the current session's row elsewhere (the docked panel's header, k5 B). */}
                {!(hideCurrentSessionRow && session.id === lastSessionId) && (
                <TranscriptSessionSeparator
                  // Per explicit bug fix — this separator's own trailing
                  // fade otherwise paints straight over the `ContactOverview`
                  // block's heading when it's the first thing rendered
                  // right underneath, OR over the fullscreen video overlay
                  // sitting behind this same session (see `hideFade`'s own
                  // doc comment, and `hideSessionSeparatorFade`'s own doc
                  // comment on this component's own props for the latter).
                  hideFade={
                    (!!(contactOverview || customerContextOverview) && session.id === lastSessionId) ||
                    (hideSessionSeparatorFade && session.id === lastSessionId)
                  }
                  session={sessionWithCurrentStatus}
                  onViewDetails={() => onViewSessionDetails?.(sessionWithCurrentStatus)}
                  onToggleDetailsPanel={onToggleDetailsPanel}
                  detailsPanelOpen={detailsPanelOpen}
                  detailsPanelPreviewContent={detailsPanelPreviewContent}
                  detailsPanelPreviewOpen={detailsPanelPreviewOpen}
                  onDetailsPanelPreviewHoverStart={onDetailsPanelPreviewHoverStart}
                  onDetailsPanelPreviewHoverEnd={onDetailsPanelPreviewHoverEnd}
                  showViewDetails={showViewDetails}
                  viewDetailsLabel={viewDetailsLabel}
                  // See `sessionRowPortalTarget`'s own doc comment above —
                  // only the CURRENT session's row ever relocates into the
                  // record header; a historical session (if one somehow
                  // renders) keeps rendering inline.
                  portalTarget={session.id === lastSessionId ? sessionRowPortalTarget : undefined}
                  // Only a real, meaningful count for chat/SMS/WhatsApp —
                  // see this prop's own doc comment on `Contact
                  // Separator` for why Voice/Email (`messages: []`
                  // placeholders) are left `undefined` instead of `0`. Adds
                  // in this session's own slice of live messages
                  // (`liveMessagesBySessionId`) on top of the static mock
                  // count — a fresh/reopened synthetic session always has
                  // `messages: []` (nothing seeded into `sessionMessages`
                  // for it), so without this its header would always read
                  // "0 Messages" even once real messages exist under it.
                  messageCount={
                    isTextChannel
                      ? messages.length + (liveMessagesBySessionId[session.id]?.length ?? 0)
                      : undefined
                  }
                  statusMenuOpen={statusMenuOpenId === session.id}
                  statusMenuView={statusMenuView}
                  onStatusMenuOpenChange={(nextOpen) => handleStatusMenuOpenChange(session.id, nextOpen)}
                  onSelectStatus={selectSessionStatus}
                  onConfirmClose={handleConfirmCloseSession}
                  onCancelClose={handleCancelCloseSession}
                  // Real Outcome popover only for the CURRENT session (see
                  // this prop's own doc comment) — reuses `currentStatus`/
                  // `onCurrentStatusChange` (this component's own props)
                  // for the "Status" field, same as the LeftNav's
                  // `ChannelRow` Outcome button does for this same channel's
                  // own `interaction.channelStatuses` entry/`handleInteractionStatusChange`.
                  outcome={
                    session.id === lastSessionId && outcomeOpen !== undefined
                      ? {
                          open: outcomeOpen,
                          onOpenChange: onOutcomeOpenChange!,
                          resolutionOptions: TRANSCRIPT_SESSION_STATUS_OPTIONS,
                          // Per explicit bug fix — was `?? "Resolved"`: a
                          // channel with no status set yet (the common case
                          // for a just-launched thread, before the agent's
                          // ever touched the status pill) was reading as
                          // already wrapped up before anything happened.
                          // "Open" is the correct fallback for genuinely
                          // untouched status — matches the same options
                          // list's own first entry (`TRANSCRIPT_SESSION_STATUS_OPTIONS`).
                          resolution: currentStatus ?? "Open",
                          onResolutionChange: (value: string) => onCurrentStatusChange(value),
                          voice: channelType === "voice",
                          tagOptions: OUTCOME_TAG_OPTIONS,
                          selectedTags: outcomeTags ?? [],
                          onTagsChange: onOutcomeTagsChange!,
                          dispositionOptions: OUTCOME_DISPOSITION_OPTIONS,
                          dispositionCode: outcomeDispositionCode ?? OUTCOME_DISPOSITION_OPTIONS[0].value,
                          onDispositionChange: onOutcomeDispositionChange!,
                          summary: outcomeSummary ?? OUTCOME_DEFAULT_SUMMARY,
                          onSummaryChange: onOutcomeSummaryChange!,
                          onSave: onOutcomeSave!,
                          onCancel: onOutcomeCancel!,
                          callEnded: outcomeCallEnded,
                          showSaveAndRedial: outcomeShowSaveAndRedial,
                          onSaveAndRedial: onOutcomeSaveAndRedial,
                          onSaveAndDismiss: onOutcomeSaveAndDismiss,
                        }
                      : undefined
                  }
                  // Same "current session only" gate as `outcome` above —
                  // see `onDismissChannel`'s own doc comment for why.
                  onDismiss={session.id === lastSessionId ? onDismissChannel : undefined}
                  // Same "whole conversation is read-only" signal `dimmed`
                  // (this component's own prop, see its doc comment) already
                  // is — reused as-is rather than re-derived, so the CURRENT
                  // session's own controls additionally lock down whenever
                  // the whole channel/interaction reads closed, in lockstep
                  // with the exact same condition that already fades this
                  // session's own message content and drives the "closed
                  // interaction"/"channel is closed" banners above.
                  channelClosed={dimmed}
                  // Per explicit bug fix — see `TranscriptSessionSeparator`'s
                  // own `isCurrentSession` doc comment for the full
                  // reasoning: `isClosed` there now derives from THIS
                  // (position), not `session.status`, so there's never more
                  // than one non-Closed-looking session in a Thread.
                  isCurrentSession={session.id === lastSessionId}
                  showActionCluster={showSessionActionCluster}
                  showConsultTransferAndAddParticipant={showSessionConsultTransferAndAddParticipant}
                  showKebabMenu={showSessionKebabMenu}
                  outcomeAfterStatus={sessionOutcomeAfterStatus}
                  showAddParticipant={showSessionAddParticipant}
                  transferInKebabMenu={sessionTransferInKebabMenu}
                  statusAndKebabBeforeOutcome={sessionStatusAndKebabBeforeOutcome}
                  controlsReadOnly={sessionControlsReadOnly}
                  showStatus={showSessionStatus}
                  // Voice/SMS direction-aware icon — see this component's
                  // own doc comment above for the `direction`/`channelType`
                  // props feeding it.
                  channelType={channelType}
                  direction={direction}
                  // Same "current session only" gate as `outcome`/
                  // `onDismiss` above — see this component's own
                  // `isNewThread` prop doc comment for how the caller
                  // resolves it.
                  isNewThread={session.id === lastSessionId && isNewThread}
                  collapsed={collapsedSessionIds.has(session.id)}
                  // Per explicit request, the collapse/expand chevron next
                  // to the "Closed" status tag is hidden for now — not
                  // removed: `collapsedSessionIds`/`toggleSessionCollapsed`
                  // (this component's own state, above) are left fully
                  // intact, and `TranscriptSessionSeparator` itself still
                  // only renders the icon at all when `onToggleCollapsed`
                  // is passed (see that prop's own doc comment) — simply
                  // never passing it here is enough to hide it without
                  // touching either. Restore by reinstating the commented-
                  // out conditional below whenever this comes back.
                  // onToggleCollapsed={
                  //   sessionWithCurrentStatus.status === "Closed"
                  //     ? () => toggleSessionCollapsed(session.id)
                  //     : undefined
                  // }
                  // Reuses the SAME `<768px` reading `transcriptBubbleFullWidth`
                  // already measures off this scroll container (see that
                  // state's own doc comment) rather than a second
                  // ResizeObserver — see `compactHeader`'s own doc comment
                  // on why 768px specifically, and what it does.
                  compactHeader={transcriptBubbleFullWidth}
                />
                )}
                {/* Everything below the separator (mock/live message
                    bubbles, the Voice/Email placeholder) is what actually
                    dims — see `sessionContentDimmed`'s own doc comment
                    above for why this moved off the whole per-session
                    wrapper. Plain wrapper div, not an ancestor of
                    `TranscriptSessionSeparator` above (a SIBLING of this
                    div, same as before) — so its own `sticky top-0` keeps
                    working exactly as already documented there.
                    `w-full max-w-[768px] mx-auto px-6` — per the
                    un-revert back to full width (see the outer scroll
                    container's own doc comment above), the centered
                    column (768px, was 1024px until a later explicit
                    request — "make the max-width of the interaction
                    content 768px instead of 1024px" — narrowed it, along
                    with its two synced siblings below and in
                    agent-next-gen-voice-call-controls.tsx) moved back
                    down onto THIS wrapper, around just the message
                    content — message bubbles are unaffected visually,
                    still centered at the same width and alignment as
                    before; only the separator row above them is full
                    width again.
                    `pb-9` (36px), LAST session only — per explicit follow-up
                    request ("increase the padding-bottom of the
                    conversation container... so the bottom comments are not
                    covered by the fade"): the composer's own soft fade
                    overlay (`-top-8 h-8`, 32px, see that div's own doc
                    comment further down) paints OVER the last ~32px of
                    whichever content is scrolled to the very bottom of the
                    transcript — with only the message blocks' own `py-4`
                    (16px) below the last bubble, the fade's 32px reached up
                    into the actual text of the last message once scrolled
                    all the way down. 36px (a touch more than the fade's own
                    32px) clears it with a little room to spare. Scoped to
                    `session.id === lastSessionId` specifically — every
                    OLDER session already has real content (this session's
                    own separator, or the next session's) sitting below it
                    in the scroll, so only the truly last block in the
                    document needs the extra clearance; adding it to every
                    session would just insert an oversized, unexplained gap
                    above each one's own separator instead. Whichever
                    sub-block actually renders last for this session (canned
                    `messages`, the Voice/Email placeholder, or live
                    messages — see the three blocks below) is covered
                    either way, since this padding lives on their shared
                    parent, not on any one of them individually. */}
                {/* Collapses this session's own message content (below)
                    away as one animated block whenever this session is in
                    `collapsedSessionIds` — same `data-[state=open]:animate-
                    accordion-down`/`data-[state=closed]:animate-accordion-up`
                    mechanism `TranscriptSessionSeparator`'s own Session
                    Details panel already uses, a wholly separate/independent
                    `AccordionHeadless` instance from that one (this session's
                    "Session Details" open/closed state and its "message
                    content collapsed" state are unrelated flags — see
                    `TranscriptSessionSeparator`'s own `collapsed` prop doc
                    comment). Wraps the div below rather than replacing it, so
                    every existing class on that div (the 768px-centered
                    column — see that div's own doc comment for its own
                    history, was 1024px — the dim/opacity transition, the
                    last-session `pb-9`) is untouched — this only adds a
                    height animation around it. Still a DOM descendant of the
                    outer `<div key={session.id}>` either way, so
                    `TranscriptSessionSeparator`'s own `sticky top-0` keeps
                    working exactly as already documented there (a fully
                    collapsed session legitimately has nothing left to stick
                    through, which is the correct behavior here). */}
                <AccordionHeadless
                  type="single"
                  collapsible
                  value={sessionRowOnly || collapsedSessionIds.has(session.id) ? "" : session.id}
                  onValueChange={() => {}}
                >
                <AccordionHeadlessItem value={session.id} className="border-none">
                <AccordionHeadlessContent>
                <div
                  // The session's content stack. `pt-4`: the stack owns the space under the
                  // session row, whatever comes first (the Autosummary, an approval, the
                  // transcript); its blocks own only the space below them (`pb-4`).
                  data-slot="content-stack"
                  // `max-w-[768px]` — per explicit request ("make the
                  // max-width of the interaction content 768px instead of
                  // 1024px"), narrowed from 1024px, itself narrowed down
                  // from the previous 1200px (see this wrapper's own
                  // top-of-block doc comment above for the full "why 1200px
                  // lived here at all" history). The composer's own matching
                  // wrapper (`InteractionComposer`, further down this file)
                  // and `VoiceCallControls`' own floating card
                  // (agent-next-gen-voice-call-controls.tsx) are kept in
                  // sync at the same 768px so the message column, the input
                  // box below it, and the voice controls bar all stay the
                  // same width.
                  className={cn(
                    "w-full max-w-[768px] mx-auto px-6 pt-4",
                    sessionContentDimmed && "opacity-50 transition-opacity",
                    session.id === lastSessionId && "pb-9"
                  )}
                >
                {/* Only on the CURRENT session — see `contactOverview`'s own
                    doc comment above; a reopened/historical session under
                    this same channel already has real messages of its own,
                    not a fresh-launch moment to summarize.
                    `contactOverviewAtBottom` additionally gates WHICH of the
                    two spots below actually renders it (per explicit
                    request): a genuinely brand-new, empty conversation
                    shows it up here, first thing the agent reads before
                    anything else exists to read. A channel that was picked
                    up already carrying a conversation — a transfer, or any
                    other "existing conversation" case the bottom spot
                    covers (this app has no separate transferred flag; a
                    transferred-in channel looks identical to a resumed
                    one, some pre-existing messages already sitting on it —
                    see `contactOverviewPosition`'s own doc comment for the
                    one scripted exception, Marcus Webb, that still needs
                    the bottom spot despite `isFreshLaunch` reading `true`
                    for him) — shows it at the OTHER spot instead, just
                    above the live-messages block below, so the agent reads
                    the existing history first and this summary lands right
                    where their own new messages are about to continue
                    from. */}
                {(contactOverview || customerContextOverview) &&
                  session.id === lastSessionId &&
                  !contactOverviewAtBottom &&
                  !overviewBeforeApproval &&
                  renderContactOverviewBlock(true)}
                {messages.length > 0 && !hideTranscript && (
                  <div className="flex min-w-0 flex-col gap-5 pb-4">
                    {messages.map((message) => (
                      <TranscriptMessageBubble
                        key={message.id}
                        message={
                          message.sender === "customer"
                            ? { ...message, name: displayName, initials: displayInitials }
                            : message
                        }
                        customerIdentified={customerIdentified}
                        tagPickerOpen={tagPickerOpenId === message.id}
                        onTagPickerOpenChange={(open) => setTagPickerOpenId(open ? message.id : null)}
                        onAddTag={(option) => addTag(session.id, message.id, option)}
                        onRemoveTag={(tagId) => removeTag(session.id, message.id, tagId)}
                        onClearTags={() => clearTags(session.id, message.id)}
                        onCopy={() => copyMessage(message.text)}
                        narrow={transcriptNarrow}
                      />
                    ))}
                  </div>
                )}
                {/* Email has no designed message-by-message transcript
                    content yet (an email thread UI) — a plain placeholder
                    stands in for it under this session's own separator,
                    same as before this session info was added for this
                    channel, just no longer replacing the separator/Session
                    Details too (see `TRANSCRIPT_SESSIONS_EMAIL`'s own doc
                    comment). Keyed off `messages.length === 0` rather than
                    unconditionally for this channel type so a future
                    session that *does* get real messages seeded onto it
                    (e.g. once an email transcript is designed) stops
                    showing this the moment it has any. Voice no longer
                    shows this placeholder — a live call now renders the
                    real `VoiceCallControls` bar below the transcript
                    instead of an empty "Coming Soon" body, per explicit
                    request. */}
                {messages.length === 0 && channelType === "email" && (
                  <div className="flex flex-col items-center justify-center gap-3 pt-8 pb-12">
                    <p className="lyra-body-md text-lyra-fg-secondary">
                      Coming Soon Email Content
                    </p>
                    {/* An outbound email draft's temporary Send (E2; P-PARKED's composer replaces it). */}
                    {isNewThread && onSendDraft && session.id === lastSessionId && (
                      <Button data-slot="email-draft-send" onClick={onSendDraft}>Send</Button>
                    )}
                  </div>
                )}
                {/* Live messages — this interaction's own sent/received
                    messages (see `Interaction.liveMessages`'s own doc
                    comment) — rendered here, INSIDE this session's own
                    per-session block, not as a separate block after this
                    whole `.map()` (where it used to live). Sliced per-
                    session via `liveMessagesBySessionId` (see that const's
                    own doc comment) rather than always attaching the whole
                    flat array to `lastSessionId` — per explicit correction,
                    reopening a closed channel keeps its PRIOR messages
                    visible under their original session (dimmed, above),
                    with only newly-sent messages landing under the current
                    one. Still no separator of its own — it's a continuation
                    of the same session's conversation, not a new session —
                    but it has to be a DOM descendant of this same
                    `<div key={session.id}>` for `TranscriptSessionSeparator`'s
                    `sticky top-0` above to actually work once live messages
                    are what's overflowing: a `position: sticky` element can
                    only stick for as long as its OWN containing block still
                    has height below it to scroll through. With live
                    messages rendered as a sibling of this whole block
                    instead of inside it, the fresh-launch session's own
                    container held nothing but the separator itself (its
                    real `messages` array is empty — the conversation is
                    entirely live), so that container's height was
                    essentially zero and the separator unstuck itself almost
                    immediately — sticky worked for the fixed mock sessions
                    (separator + real messages sharing one container) but
                    not for a brand-new conversation (per explicit report:
                    "sticky for existing conversations but new conversations
                    ... when the conversation reaches an overflow-y it is
                    not sticky"). */}
                {/* The OTHER `ContactOverview` spot — see the doc comment on
                    its sibling occurrence above this session's `messages`
                    block for the full "which of the two spots" reasoning.
                    This one covers a transfer/existing-conversation pickup
                    (`contactOverviewAtBottom`): it renders AFTER this session's own
                    existing message history — the `messages.map(...)`/
                    Voice-Email-placeholder blocks above AND the "already
                    existed" slice of live messages just below (see
                    `contactOverviewLiveMessageBoundaryRef`'s own doc
                    comment for why live messages need their own split
                    here too) — and BEFORE the "new" slice, so it reads as
                    the boundary between "what already happened on this
                    conversation" and "what the agent sends from here." */}
                {(() => {
                  const sessionLiveMessages = liveMessagesBySessionId[session.id] ?? [];
                  const isNonFreshOverviewSession =
                    !!(contactOverview || customerContextOverview) && session.id === lastSessionId && contactOverviewAtBottom;
                  const isCurrent = session.id === lastSessionId;
                  // Only the CURRENT session's own trailing edge — see
                  // `isCustomerTyping`'s own doc comment for the full
                  // `lastSessionId`/`isTextChannel` scoping reasoning.
                  return (
                    <TranscriptLiveMessages
                      existingLiveMessages={isNonFreshOverviewSession ? sessionLiveMessages.slice(0, contactOverviewLiveMessageBoundaryRef.current) : sessionLiveMessages}
                      newLiveMessages={isNonFreshOverviewSession ? sessionLiveMessages.slice(contactOverviewLiveMessageBoundaryRef.current) : []}
                      overviewBlock={isNonFreshOverviewSession ? renderContactOverviewBlock(true) : undefined}
                      approvalOverview={
                        overviewBeforeApproval && isCurrent
                          ? { messageId: liveMessages.find((m) => !!m.summary)?.id ?? "", node: renderContactOverviewBlock() }
                          : undefined
                      }
                      showTypingIndicator={isCurrent && isTextChannel && isCustomerTyping}
                      showAiTypingIndicator={isCurrent && isTextChannel && isAiTyping}
                      channelType={channelType}
                      displayName={displayName}
                      displayInitials={displayInitials}
                      customerIdentified={customerIdentified}
                      liveMessageTags={liveMessageTags}
                      tagPickerOpenId={tagPickerOpenId}
                      onTagPickerOpenIdChange={setTagPickerOpenId}
                      onAddTag={addLiveTag}
                      onRemoveTag={removeLiveTag}
                      onClearTags={clearLiveTags}
                      onCopy={copyMessage}
                      narrow={transcriptNarrow}
                      bubbleFullWidth={transcriptBubbleFullWidth}
                      initialMessageIds={initialMessageIdsRef.current}
                      hideAiActions={hideAiActions}
                      hideTranscript={hideTranscript}
                      aiCardHandlers={{ onApprovalDecision, onApprovalCallRequest, onApprovalSuggestionAsk, approvalTakenOver, onWrapUpComplete, onSnapshotLink, activeSnapshotLink }}
                    />
                  );
                })()}
                </div>
                </AccordionHeadlessContent>
                </AccordionHeadlessItem>
                </AccordionHeadless>
              </div>
            );
          })}
          {/* Content after the conversation, scrolling with it (e.g. the
              voice wrap-up card, P0.5d.1) — see `trailingContent`. */}
          {trailingContent && !sessionRowOnly && (
            <div ref={trailingContentRef} className="w-full max-w-[768px] mx-auto px-6 pt-2 pb-4">
              {trailingContent}
            </div>
          )}
          {/* See `bottomSentinelRef`'s own declaration (above) — the
              scroll-to-bottom-on-open effect's `scrollIntoView` target.
              Zero-size, purely a scroll anchor — must stay the LAST node
              in this column so "the bottom" always means the true end of
              the rendered content, not wherever the last session/message
              happened to end. */}
          <div ref={bottomSentinelRef} />
        </div>
      </div>
      {/* Per explicit request ("if you scroll up in the transcript, add a
          sync to live button that scrolls to the bottom of the transcript
          (match the lyra style)"): voice gets its own floating scroll-to-
          bottom affordance here — originally its own "Sync to Live" label
          in a solid `variant="default"` button, later corrected per
          explicit follow-up to read "Scroll To Latest" in the same
          `outline` style the non-voice button below uses, for consistency
          across channels. Still no "N New" badge (voice's live transcript
          has no per-message unread count to show — see `newMessageCount`'s
          own doc comment, which is chat/SMS/WhatsApp-specific). Same
          `scrollToBottom` the "Scroll To Latest" button below calls — see
          that function's own doc comment.
          `sticky`, NOT `absolute` like the "Scroll To Latest" version
          below — per explicit bug report ("the button should not scroll -
          it is currently scrolling"). `absolute` anchors to the nearest
          `position`-ed ancestor, which for the main record column (the
          "Scroll To Latest" button's only real-world context — see
          `channelType`'s own gate on the docked-panel "Transcript" tab,
          voice-only) is a `relative` wrapper that ITSELF never scrolls
          (only `scrollContainerRef`, ITS un-ancestor sibling, does) — so
          anchoring to it correctly reads as "pinned to the viewport while
          content scrolls underneath." Voice's OWN real-world context is
          the opposite: this whole subtree (the `relative` wrapper AND
          `scrollContainerRef`) sits INSIDE an ancestor that's already
          scrollable itself (lyra-ui's `PanelContent`, or this file's own
          hand-rolled preview wrapper — see `scrollToBottom`'s own doc
          comment for the full "why" `scrollContainerRef` isn't the real
          scroll container there), so `absolute` there anchors to a box
          that scrolls right along with everything else — reading as "this
          button is scrolling," exactly the bug reported. `sticky bottom-4`
          instead resolves against whichever ancestor genuinely has
          `overflow` set (walking straight past this `relative`/`overflow-
          hidden`-only wrapper to `PanelContent`/the preview wrapper,
          `scrollContainerRef`'s `overflow-y-auto` never entering into it
          since it's a sibling, not an ancestor, of this button) — so it
          correctly stays pinned to the panel's own bottom edge instead.
          `-mb-9` cancels out the height `sticky` (unlike `absolute`) adds
          back into the document's normal flow — exactly this button's own
          rendered height (`size="lg"` → `h-9`) — so it still floats over
          the last message rather than pushing it up and leaving a gap. */}
      {!isAtBottom && channelType === "voice" && (
        <div className="pointer-events-none sticky bottom-4 z-[2] -mb-9 flex justify-center">
          <Button
            variant="outline"
            size="lg"
            onClick={scrollToLatest}
            className="pointer-events-auto rounded-full bg-lyra-bg-surface-base text-lyra-fg-default shadow-lg"
          >
            <ArrowDown className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Scroll To Latest
          </Button>
        </div>
      )}
      {!isAtBottom && channelType !== "voice" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <Button
            variant="outline"
            size="lg"
            onClick={scrollToLatest}
            className="pointer-events-auto rounded-full bg-lyra-bg-surface-base text-lyra-fg-default shadow-lg"
          >
            <ArrowDown className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Scroll To Latest
            {newMessageCount > 0 && (
              <Badge color="slate" variant="solid">
                {newMessageCount} New
              </Badge>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

