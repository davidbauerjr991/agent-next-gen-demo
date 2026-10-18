import { CopilotComposer } from "@/components/copilot-composer";
import React, { useState, useRef, useLayoutEffect, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  AccordionHeadless,
  AccordionHeadlessItem,
  AccordionHeadlessContent,
  ContactOverview,
  ActionIconButton,
  InlineNotification,
  Button,
  Textarea,
  ToggleGroup,
  Switch,
  Badge,
  QuickReplyVariableForm,
  QuickReplyMenu,
  type QuickReplyField,
  type QuickReplyMenuItem,
} from "@nicecxone/lyra-ui";
import {
  ChevronDown,
  ArrowDown,
  Paperclip,
  Bold,
  Italic,
  Smile,
  Zap,
  FileText,
  Send,
} from "lucide-react";
import {
  initialsFor,
  quickReplyFieldDisplayValue,
} from "@/components/agent-next-gen-shared-utils";
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
import type {
  TranscriptApprovalSummary,
  TranscriptMessage,
  TranscriptSession,
  TranscriptSessionFingerprint,
  TranscriptTag,
} from "@/components/transcript/transcript-types";
import {
  OUTCOME_DEFAULT_SUMMARY,
  OUTCOME_DISPOSITION_OPTIONS,
  OUTCOME_TAG_OPTIONS,
  TRANSCRIPT_SESSION_FINGERPRINT,
  TRANSCRIPT_SESSION_FINGERPRINT_EMAIL,
  TRANSCRIPT_SESSION_FINGERPRINT_VOICE,
  TRANSCRIPT_SESSION_STATUS_OPTIONS,
  TRANSCRIPT_SESSION_STATUS_VARIANT,
  TRANSCRIPT_SESSIONS,
  TRANSCRIPT_SESSIONS_EMAIL,
  TRANSCRIPT_SESSIONS_VOICE,
} from "@/components/transcript/transcript-fixtures";
export type { TranscriptApprovalSummary, TranscriptMessage, TranscriptSession, TranscriptSessionFingerprint, TranscriptTag };
export {
  OUTCOME_DEFAULT_SUMMARY,
  OUTCOME_DISPOSITION_OPTIONS,
  OUTCOME_TAG_OPTIONS,
  TRANSCRIPT_SESSION_FINGERPRINT,
  TRANSCRIPT_SESSION_FINGERPRINT_EMAIL,
  TRANSCRIPT_SESSION_FINGERPRINT_VOICE,
  TRANSCRIPT_SESSION_STATUS_OPTIONS,
  TRANSCRIPT_SESSION_STATUS_VARIANT,
  TRANSCRIPT_SESSIONS,
  TRANSCRIPT_SESSIONS_EMAIL,
  TRANSCRIPT_SESSIONS_VOICE,
};

// P-EXTRACT: the AI rows (feed, cards, instruction row) live in ./ai-rows/.
import { AiActionCard, AiActionCollapse, AiActionsFeed, ApprovalDecision, ApprovalRequestAccordion, type AiActionCardHandlers } from "./ai-rows/ai-action-cards";
import { InstructionInterstitial } from "./ai-rows/InstructionInterstitial";
export { AiActionCard, AiActionsFeed, ApprovalDecision, ApprovalRequestAccordion, InstructionInterstitial };
export type { AiActionCardHandlers };

// P-EXTRACT: the message rows (bubbles, plain lines, typing indicator) live in ./message-list/.
import { QUICK_TAG_OPTIONS, TranscriptMessageBubble } from "./message-list/transcript-bubbles";
export { QUICK_TAG_OPTIONS, TranscriptMessageBubble };

// Canned replies drawn from for the simulated customer response
// `handleSendMessage` schedules after the agent sends a message — this demo
// has no real customer on the other end, so a short, generic pool stands in
// for one, same "randomly draw from a fixed pool" pattern already used for
// synthesized Customer Information data (`CUSTOMER_LATEST_NOTE_POOL`, etc.).
export const CUSTOMER_AUTO_REPLY_POOL = [
  "Thanks, got it!",
  "Okay, that makes sense.",
  "Appreciate the quick response.",
  "Got it, thank you!",
  "Sounds good, thanks for the help.",
  "Perfect, that answers my question.",
];

/** Per explicit request ("when that quick reply is typed make sure Marcus
 *  responds with 'That's great! Thanks for the quick reply'"), the
 *  "Acknowledge" quick reply (`QUICK_REPLIES` above) gets its own scripted
 *  simulated-customer response instead of a random `CUSTOMER_AUTO_REPLY_POOL`
 *  pick — reads as a direct reaction to the agent's specific message rather
 *  than a generic one. Not actually Marcus-specific (the request's own
 *  screenshot just happened to be an interaction with a customer named
 *  Marcus Webb) — this applies to every simulated customer reply, in every
 *  interaction, on every tier, exactly like `CUSTOMER_AUTO_REPLY_POOL`
 *  itself already does. */
export const ACKNOWLEDGE_QUICK_REPLY_RESPONSE = "That's great! Thanks for the quick reply";

/** Resolves the canned simulated-customer reply text for a given
 *  `handleSendMessage` call — the single place all 3 tiers' own
 *  `window.setTimeout` simulated-reply callbacks should call instead of
 *  reading `CUSTOMER_AUTO_REPLY_POOL` directly, so the "Acknowledge" special
 *  case (and any future one like it) only needs to be taught here once. */
export function resolveCustomerAutoReply(agentMessageText: string): string {
  const acknowledgeTemplate = QUICK_REPLIES.find((reply) => reply.id === "acknowledge")?.template;
  if (acknowledgeTemplate && agentMessageText === acknowledgeTemplate) {
    return ACKNOWLEDGE_QUICK_REPLY_RESPONSE;
  }
  return CUSTOMER_AUTO_REPLY_POOL[Math.floor(Math.random() * CUSTOMER_AUTO_REPLY_POOL.length)];
}


import { deriveTranscriptSessions } from "@/components/transcript/transcript-sessions";
// P-EXTRACT: the session row lives in ./transcript/session-row/ now.
import { ChannelStatusTag, TransferIcon, TranscriptSessionDetails } from "@/components/transcript/session-row/session-row-parts";
import { TranscriptSessionSeparator } from "@/components/transcript/session-row/TranscriptSessionSeparator";
export { ChannelStatusTag, TransferIcon, TranscriptSessionDetails, TranscriptSessionSeparator };


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
                {messages.length > 0 && (
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
                  <div className="flex items-center justify-center pt-8 pb-12">
                    <p className="lyra-body-md text-lyra-fg-secondary">
                      Coming Soon Email Content
                    </p>
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

/* ── Quick replies ──
   Canned-response data for `InteractionComposer`'s "/trigger" picker
   (`QuickReplyMenu`/`QuickReplyVariableForm`, both lyra-ui exports) — app-
   local business content, same "reusable UI in lyra-ui, real data in the
   app" split as `CONTACT_HISTORY`/`CREATE_NEW_CUSTOMERS` and everything
   else in this file that isn't generic across every lyra-ui consumer.

   `rich`/`fields` items need a value chosen for each `{token}` in their
   `template` before they make sense to send (a business-day range, a
   department, a date/time) — `InteractionComposer` swaps the matching
   list for `QuickReplyVariableForm` to collect those, keyed by each
   field's own `key`, which must match a `{key}` token in `template`
   exactly (see `fillQuickReplyTemplate` below). Plain (non-`rich`) items
   have no `fields` at all and insert `template` verbatim. */
export interface QuickReplyItem {
  /** The id typed after `QUICK_REPLY_TRIGGER_CHAR` to reach this item */
  id: string;
  title: string;
  /** May contain `{key}` tokens matching `fields[].key`, for a `rich` item */
  template: string;
  rich?: boolean;
  fields?: QuickReplyField[];
}

export const QUICK_REPLIES: QuickReplyItem[] = [
  { id: "greeting", title: "Greeting", template: "Thank you for contacting us. How can I assist you today?" },
  { id: "acknowledge", title: "Acknowledge", template: "Hello. Thank you for contacting us.  I would be happy to look into that for you." },
  { id: "account", title: "Request Account #", template: "Could you please provide me with your account number?" },
  { id: "reviewed", title: "Account Reviewed", template: "I've reviewed your account and I can see the issue." },
  { id: "escalate", title: "Escalate", template: "I'm escalating this to our specialist team right away." },
  {
    id: "timeline",
    title: "Processing Time",
    template: "Please allow {days} business days for this to take effect.",
    rich: true,
    fields: [
      {
        key: "days",
        label: "Business Days",
        type: "select",
        options: [
          { value: "1–2", label: "1–2" },
          { value: "3–5", label: "3–5" },
          { value: "5–7", label: "5–7" },
          { value: "7–10", label: "7–10" },
        ],
      },
    ],
  },
  { id: "closing", title: "Closing", template: "Is there anything else I can help you with today?" },
  {
    id: "success",
    title: "Request Success",
    template: "Your {requestType} has been processed successfully.",
    rich: true,
    fields: [{ key: "requestType", label: "Request Type", type: "text", placeholder: "e.g. refund request" }],
  },
  {
    id: "callback",
    title: "Schedule Callback",
    template: "I'll arrange a callback on {date} at {time} for you.",
    rich: true,
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "time", label: "Time", type: "time" },
    ],
  },
  {
    id: "transfer",
    title: "Transfer Notice",
    template: "I'm transferring you to {department}. Please hold for a moment.",
    rich: true,
    fields: [
      {
        key: "department",
        label: "Department",
        type: "select",
        options: [
          { value: "Billing", label: "Billing" },
          { value: "Technical Support", label: "Technical Support" },
          { value: "Retention", label: "Retention" },
          { value: "Escalations", label: "Escalations" },
          { value: "Account Management", label: "Account Management" },
        ],
      },
    ],
  },
  { id: "thankyou", title: "Thank You", template: "Thank you so much for your patience. We really appreciate it!" },
  { id: "sorry", title: "Apology", template: "I sincerely apologize for the inconvenience this has caused you." },
];


/** Fills a `rich` item's `template` from its current field values —
 *  `bracket` wraps each filled-in value in `[...]` (matching the reference
 *  mockup's own preview treatment, e.g. "Please allow [1–2] business
 *  days...") for the live preview shown while still editing; the final
 *  text actually inserted into the composer (`bracket: false`) has no
 *  brackets, since those were only ever a preview affordance marking which
 *  parts of the sentence came from a field. Plain (non-`rich`) items never
 *  reach this — their `template` has no `fields`/tokens to fill and is
 *  used as-is. */
export function fillQuickReplyTemplate(
  item: QuickReplyItem,
  values: Record<string, string | Date | undefined>,
  bracket: boolean
): string {
  if (!item.fields) return item.template;
  return item.fields.reduce((text, field) => {
    const display = quickReplyFieldDisplayValue(field, values[field.key]);
    const shown = bracket && display !== `{${field.key}}` ? `[${display}]` : display;
    return text.split(`{${field.key}}`).join(shown);
  }, item.template);
}

/* ── InteractionComposer ──
   The message-input bar fixed to the bottom of an active interaction's
   detail page — a sibling rendered right after `InteractionTranscript`
   rather than living inside it, so it's a `shrink-0` row in the same flex
   column instead of scrolling away with the transcript above it (which is
   the `flex-1 overflow-y-auto` element doing all the scrolling).

   Composed from existing lyra-ui exports (`Textarea`, `Button`,
   `ActionIconButton`) plus the two new `QuickReplyMenu`/
   `QuickReplyVariableForm` exports for the "/trigger" quick-reply picker
   (see the "Quick replies" data block above this component). The "Send ▾"
   control is hand-built from two adjacent `Button`s (rounded-r-none /
   rounded-l-none, a hairline divider between) since lyra-ui has no
   dedicated split-button component; same reasoning as everywhere else in
   this file that composes existing atoms rather than waiting on a new
   lyra-ui primitive.

   Quick-reply mechanics: typing `/` (`QUICK_REPLY_TRIGGER_CHAR` below —
   `/` rather than `#`, per explicit request: it's the near-universal
   chat-command convention, e.g. Slack/Discord/Front/Intercom/Zendesk,
   where `#` almost always means a hashtag/channel instead) followed by
   any run of word characters with the caret still immediately after them
   (`QUICK_REPLY_TRIGGER_PATTERN` below, re-tested against the text up to
   the caret on every keystroke) opens the menu, filtered to items whose
   `id`/`title` contains what's typed so far; the (existing, previously
   unwired) "Quick replies" toolbar button opens the same menu at the
   current caret with no filter instead, for agents who'd rather browse
   than type a shortcut from memory. `quickReplyTriggerStart` records
   where the inserted/replaced range begins — either the `/`'s own
   position (typed trigger) or the bare caret (toolbar button, nothing to
   replace, pure insert). The menu itself owns no keyboard state (see
   `QuickReplyMenu`'s own doc comment) — arrow keys/Enter/Escape are all
   handled by this component's `onKeyDown` on the `Textarea` itself, so
   the textarea never loses focus/caret position while browsing. Selecting
   a plain item inserts `template` immediately; selecting a `rich` one
   swaps the same on-screen spot to `QuickReplyVariableForm` instead of
   closing, so the agent can fill in its field(s) — see
   `fillQuickReplyTemplate`'s own doc comment for the bracketed-preview-
   vs-final-insert distinction — before either inserting or cancelling
   back out (Cancel closes the whole picker rather than returning to the
   list, same "start over from `/`" flow either way).

   `onSend` hands the typed text up to `handleSendMessage` (the main
   component, where `interactions`/`setInteractions` actually live — this
   component has no access to that state itself) — that's what pushes the
   message into the active interaction's `liveMessages` and schedules the
   simulated customer reply. This component still owns nothing but the
   input's own text (and now the quick-reply picker's transient state);
   it doesn't know or care what happens to a message once sent. */
export const QUICK_REPLY_TRIGGER_CHAR = "/";
export const QUICK_REPLY_TRIGGER_PATTERN = /\/(\w*)$/;
/**
 * The composer's soft top fade instead of a hard border-top — reads as the
 * content scrolling *under* the composer rather than stopping at a line.
 * Positioned outside its parent's box (negative top, the parent must be
 * `relative`), so it overlays the last 32px of the scrolling content above.
 * Used by the inline composer and by the docked panel composer's footer;
 * `toClassName` is the background it fades into (the surface behind it).
 */
/** The AI cards' shared enter animation (AI messages, approvals, the
 *  Autosummary): on mount, and on a card switch where the caller keys it. */
export const AI_CARD_ENTER = "animate-in slide-in-from-bottom-4 fade-in-0 duration-200";

export function ComposerFade({ toClassName = "to-lyra-bg-surface-base" }: { toClassName?: string }) {
  return (
    <div
      data-slot="composer-fade"
      className={cn("pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-b from-transparent", toClassName)}
      aria-hidden="true"
    />
  );
}

export function InteractionComposer({
  onSend,
  prefill,
  onPrefillConsumed,
  copilotSuggestions,
  copilotSuggestionLinks,
  copilotSuggestionReplacements,
  onCopilotSuggestionLink,
  onCopilotAsk,
  copilotOnly,
  onTakeover,
  takeoverLabel = "Takeover Chat",
  takeoverDisabled,
  takeoverDisabledReason,
  hideAiActions,
  onHideAiActionsChange,
  copilotDock,
  floatingMenus = false,
  replyBlockedReason,
}: {
  /** Set while the agent's own state blocks replying (presence): the chat
   *  input, Send and the quick-reply trigger stay visible but disabled, under
   *  an InlineNotification reading this. The transcript stays readable. */
  replyBlockedReason?: string;
  /** The quick-reply menu (and its variable form) float on the document's
   *  top layer, anchored above the composer, instead of in its flow: for a
   *  composer inside a size-limited surface (a header hover preview) that
   *  would clip it. The layer is tagged `data-floating-layer`. */
  floatingMenus?: boolean;
  /** Settings → AI display "In the Contact Details panel": the Ask Copilot
   *  part (chips, input, Takeover) renders as the panel's docked footer
   *  (portaled into `mount`) instead of here; this composer keeps only the
   *  chat input. While `mount` is null (the panel isn't showing its Overview)
   *  the Copilot part isn't rendered anywhere. */
  copilotDock?: { mount: HTMLElement | null };
  /** Shows a "Hide AI Actions" switch at the right of the mode toggle row. */
  hideAiActions?: boolean;
  onHideAiActionsChange?: (hide: boolean) => void;
  takeoverLabel?: string;
  takeoverDisabled?: boolean;
  takeoverDisabledReason?: string;
  /** Show only the Ask Copilot input (no Chat with Customer toggle) — used while the agent is reviewing an AI-led chat. */
  copilotOnly?: boolean;
  /** With `copilotOnly`: shows a "Take over" button in place of the toggle. */
  onTakeover?: () => void;
  /** Suggestion chips shown under the "Ask Copilot" input; clicking one fills the question. */
  copilotSuggestions?: string[];
  /** label → link key for chips that open a side panel (after a brief spinner) instead of filling the input. */
  copilotSuggestionLinks?: Record<string, string>;
  /** A used link chip is swapped for this replacement (label → replacement label). */
  copilotSuggestionReplacements?: Record<string, string>;
  onCopilotSuggestionLink?: (link: string) => void;
  /** Fired whenever the agent asks Copilot something (submits a question, or uses a chip that runs a lookup) —
   *  the caller adds a matching interstitial row to the chat. */
  onCopilotAsk?: (text: string) => void;
  onSend: (text: string) => void;
  /** Populates the composer's own text WITHOUT sending it — per explicit
   *  request ("When one is clicked it should populate into the input but
   *  not send until the agent clicks send"), for Copilot's suggested-reply
   *  cards (currently only Marcus Webb's scripted scenario,
   *  `AgentWorkspace2WithDeskPage.tsx`). This component still owns its own
   *  `message` state (unchanged, uncontrolled) — `prefill` is a one-shot
   *  injection into that state via the `useEffect` below, not a switch to a
   *  fully controlled input: the agent can still freely edit/clear the
   *  populated text afterward like anything else they typed themselves.
   *  Left `undefined` by every OTHER caller (no behavior change for them). */
  prefill?: string;
  /** Fired the instant `prefill` is consumed (copied into `message`) — the
   *  caller's cue to reset its own `prefill` value back to `undefined`.
   *  Required so a SECOND, later `prefill` call can ever take effect at
   *  all: the effect below is keyed on `[prefill]`, so if the caller left
   *  its own prefill value sitting non-`undefined` after the first one
   *  landed, setting the exact same string again wouldn't change that
   *  dependency and the effect simply wouldn't refire. Resetting to
   *  `undefined` in between means every distinct suggestion the agent
   *  clicks — even if it happens to be identical text — reliably re-fires
   *  this effect. */
  onPrefillConsumed?: () => void;
}) {
  const [composerTabState, setComposerTab] = useState<"chat" | "copilot">("chat");
  const copilotDocked = !!copilotDock;
  const composerTab = copilotDocked ? "chat" : copilotOnly ? "copilot" : composerTabState;
  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [copilotLoading, setCopilotLoading] = useState<string | null>(null);
  // Switching modes puts the caret straight into that mode's input so the agent can just start typing
  // (skipped on first mount so the composer doesn't steal focus when it appears).
  const copilotPaneRef = useRef<HTMLDivElement>(null);
  // Focus only when the agent actually switches modes with the toggle: compare against the previous tab so mount
  // (and dev double-invoked effects) never steal focus.
  const prevComposerTab = useRef(composerTab);
  useEffect(() => {
    if (prevComposerTab.current === composerTab) return;
    prevComposerTab.current = composerTab;
    if (composerTab === "chat") {
      textareaRef.current?.focus();
    } else {
      copilotPaneRef.current?.querySelector<HTMLElement>("textarea, input")?.focus();
    }
  }, [composerTab]);
  const [copilotUsed, setCopilotUsed] = useState<string[]>([]);
  const activateCopilotSuggestion = (suggestion: string) => {
    const link = copilotSuggestionLinks?.[suggestion];
    if (!link) {
      setCopilotQuestion(suggestion);
      return;
    }
    if (copilotLoading) return;
    setCopilotLoading(suggestion);
    onCopilotAsk?.(suggestion);
    window.setTimeout(() => {
      setCopilotLoading(null);
      setCopilotUsed((prev) => [...prev, suggestion]);
      onCopilotSuggestionLink?.(link);
    }, 1400);
  };
  const [message, setMessage] = useState("");
  const canSend = message.trim().length > 0;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // See `prefill`'s own doc comment above for the full "why" — this just
  // performs the one-shot injection + focus, then immediately hands control
  // back to the caller to reset `prefill` to `undefined` again.
  useEffect(() => {
    if (prefill === undefined) return;
    setMessage(prefill);
    setComposerTab("chat");
    onPrefillConsumed?.();
    // The textarea's own auto-grow (further down this component, if any)
    // and caret placement both need the DOM to have actually committed
    // `message`'s new value first.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      el?.focus();
      el?.setSelectionRange(prefill.length, prefill.length);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);
  // Per explicit request: tabbing out of the message textarea should land
  // on the Send button first — not the toolbar's Attach/Bold/Italic/etc.
  // icon buttons, which sit BEFORE Send in visual/DOM order (see the render
  // below) and so would otherwise be next in line for a plain, un-messed-
  // with browser Tab order. `handleComposerKeyDown` intercepts Tab on the
  // textarea itself and focuses this directly instead of letting the
  // browser's default order run.
  const sendButtonRef = useRef<HTMLButtonElement>(null);

  // ── Quick-reply picker state ──
  // `quickReplyTriggerStart` is the message-text index the eventually-
  // inserted text replaces through to the caret at insert time — either
  // where the typed trigger character itself sits (so "/time" gets
  // replaced outright),
  // or the bare caret position when opened via the toolbar button instead
  // (nothing typed to replace, a pure insert at that point). `null` means
  // closed. See this component's own doc comment above for the full flow.
  const [quickReplyTriggerStart, setQuickReplyTriggerStart] = useState<number | null>(null);
  const [quickReplyQuery, setQuickReplyQuery] = useState("");
  const [quickReplyActiveIndex, setQuickReplyActiveIndex] = useState(0);
  // Non-null while showing `QuickReplyVariableForm` for a `rich` item
  // instead of the plain matching list — same overlay slot, different
  // content (see the render below).
  const [quickReplyConfiguring, setQuickReplyConfiguring] = useState<QuickReplyItem | null>(null);
  const [quickReplyFieldValues, setQuickReplyFieldValues] = useState<Record<string, string | Date | undefined>>({});
  const quickReplyOpen = quickReplyTriggerStart !== null;
  const quickReplyContainerRef = useRef<HTMLDivElement>(null);

  const quickReplyMatches = useMemo(() => {
    const q = quickReplyQuery.trim().toLowerCase();
    if (!q) return QUICK_REPLIES;
    return QUICK_REPLIES.filter(
      (item) => item.id.toLowerCase().includes(q) || item.title.toLowerCase().includes(q)
    );
  }, [quickReplyQuery]);

  const closeQuickReplyMenu = () => {
    setQuickReplyTriggerStart(null);
    setQuickReplyQuery("");
    setQuickReplyActiveIndex(0);
    setQuickReplyConfiguring(null);
    setQuickReplyFieldValues({});
  };

  // Dismiss on outside click — this menu is a plain absolutely-positioned
  // overlay, not a `Popover` (see this component's own doc comment for
  // why: the `Textarea` itself must keep focus/caret while browsing, which
  // rules out a focus-trapping Radix popover). `mousedown` (not `click`)
  // so this fires before a menu-row's own `onClick` — the row's click
  // handler still runs normally afterward since it's inside
  // `quickReplyContainerRef` and skipped here.
  //
  // The `[data-radix-popper-content-wrapper]` check covers
  // `QuickReplyVariableForm`'s own `Select`/`DatePicker`/`TimePicker`
  // fields — Radix always portals THEIR dropdown/calendar content
  // straight to `document.body`, outside `quickReplyContainerRef`'s own
  // DOM subtree, no matter how deeply nested those fields are inside it.
  // Without this, picking e.g. a Business Days option registered as an
  // "outside" click and closed the whole rich form before the selection
  // even landed — confirmed live. Every Radix popper-positioned surface
  // (`Popover`/`Select`/`DropdownMenu`/etc., all built on
  // `@radix-ui/react-popper`) tags its own wrapper with this attribute,
  // so this isn't specific to any one field type.
  useEffect(() => {
    if (!quickReplyOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (quickReplyContainerRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-radix-popper-content-wrapper], [data-floating-layer]")) return;
      closeQuickReplyMenu();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [quickReplyOpen]);
  // `floatingMenus`: where the floating menu sits (above the composer, as
  // wide as it or wider, up to the viewport's top).
  const composerRootRef = useRef<HTMLDivElement>(null);
  const [floatingMenuBox, setFloatingMenuBox] = useState<React.CSSProperties | null>(null);
  useLayoutEffect(() => {
    if (!floatingMenus || !quickReplyOpen || !composerRootRef.current) {
      setFloatingMenuBox(null);
      return;
    }
    const rect = composerRootRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 440);
    setFloatingMenuBox({
      position: "fixed",
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      bottom: window.innerHeight - rect.top + 8,
      width,
      maxHeight: Math.max(160, rect.top - 16),
      overflowY: "auto",
      zIndex: 60,
    });
  }, [floatingMenus, quickReplyOpen]);
  const placeMenu = (menu: React.ReactElement) =>
    floatingMenus
      ? floatingMenuBox &&
        createPortal(
          <div data-floating-layer="" style={floatingMenuBox} className="rounded-lyra-lg shadow-lg">
            {menu}
          </div>,
          document.body,
        )
      : menu;

  // Replaces `[quickReplyTriggerStart, caret)` — the typed "/query" (or,
  // for the toolbar-button path, a zero-length range right at the caret)
  // — with `text`, then restores focus with the caret placed right after
  // the newly-inserted text. `requestAnimationFrame` — the caret can only
  // be repositioned after React actually commits the new `value` to the
  // DOM `<textarea>`, which hasn't happened yet inside this same handler.
  const insertQuickReplyText = (text: string) => {
    const el = textareaRef.current;
    const start = quickReplyTriggerStart ?? el?.selectionStart ?? message.length;
    const end = el?.selectionStart ?? message.length;
    const next = message.slice(0, start) + text + message.slice(end);
    setMessage(next);
    const caret = start + text.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const handleSelectQuickReply = (item: QuickReplyItem) => {
    if (item.rich) {
      setQuickReplyConfiguring(item);
      setQuickReplyFieldValues({});
      return;
    }
    insertQuickReplyText(item.template);
    closeQuickReplyMenu();
  };

  const handleInsertRichQuickReply = () => {
    if (!quickReplyConfiguring) return;
    insertQuickReplyText(fillQuickReplyTemplate(quickReplyConfiguring, quickReplyFieldValues, false));
    closeQuickReplyMenu();
  };

  const openQuickReplyMenuAtCaret = () => {
    const el = textareaRef.current;
    setQuickReplyTriggerStart(el?.selectionStart ?? message.length);
    setQuickReplyQuery("");
    setQuickReplyActiveIndex(0);
    el?.focus();
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    const caret = e.target.selectionStart ?? value.length;
    const match = QUICK_REPLY_TRIGGER_PATTERN.exec(value.slice(0, caret));
    if (match) {
      setQuickReplyTriggerStart(caret - match[0].length);
      setQuickReplyQuery(match[1]);
      setQuickReplyActiveIndex(0);
    } else if (quickReplyOpen && !quickReplyConfiguring) {
      // Only auto-closes the plain matching list on a non-matching edit —
      // once `quickReplyConfiguring` is set the agent's focus has moved
      // into the variable form's own fields, so further edits (there
      // shouldn't be any — the textarea isn't part of that flow anymore)
      // shouldn't tear down the form out from under them.
      closeQuickReplyMenu();
    }
  };

  // Arrow keys/Enter/Escape all handled here, not inside `QuickReplyMenu`
  // itself — see this component's own doc comment for why the textarea
  // must keep owning focus/caret the whole time the menu is open.
  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (quickReplyOpen && !quickReplyConfiguring) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setQuickReplyActiveIndex((i) => Math.min(i + 1, Math.max(quickReplyMatches.length - 1, 0)));
          break;
        case "ArrowUp":
          e.preventDefault();
          setQuickReplyActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          if (quickReplyMatches[quickReplyActiveIndex]) {
            e.preventDefault();
            handleSelectQuickReply(quickReplyMatches[quickReplyActiveIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          closeQuickReplyMenu();
          break;
      }
      return;
    }
    // Per explicit request — ordinary typing (the quick-reply picker isn't
    // up): plain Enter sends the message, same as most chat composers
    // (Slack/Intercom/etc.); Shift+Enter still inserts a real newline,
    // since the textarea is multi-line (`rows={3}`) and losing that would
    // make a multi-paragraph reply impossible to type. `handleSend` itself
    // already no-ops on an empty/whitespace-only message (`canSend`), so
    // this is safe to fire unconditionally on a bare Enter.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    // Same request, other half: Tab out of the textarea goes straight to
    // Send, not into the Attach/Bold/Italic/Emoji/Quick replies/Templates
    // toolbar row that sits before it in DOM order (see the render below) —
    // those would otherwise be next in a plain, un-intercepted Tab order.
    // Shift+Tab (backing OUT of the textarea) is left alone, same reasoning
    // `Enter` above leaves Shift+Enter alone.
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      sendButtonRef.current?.focus();
    }
  };

  const handleSend = () => {
    if (!canSend || replyBlockedReason) return;
    onSend(message);
    setMessage("");
  };

  const submitCopilot = (text: string) => {
    const q = (text ?? copilotQuestion).trim();
    if (q) onCopilotAsk?.(q);
    setCopilotQuestion("");
  };
  // A used link chip is swapped for its replacement, if any.
  const activeCopilotSuggestions = (copilotSuggestions ?? [])
    .map((sg) => (copilotUsed.includes(sg) ? copilotSuggestionReplacements?.[sg] : sg))
    .filter((sg): sg is string => !!sg && !copilotUsed.includes(sg));
  const takeover =
    copilotOnly && onTakeover
      ? { label: takeoverLabel, onClick: onTakeover, disabled: takeoverDisabled, disabledReason: takeoverDisabledReason }
      : undefined;
  const copilotComposer = (placement: "inline" | "panel") => (
    <CopilotComposer
      placement={placement}
      value={copilotQuestion}
      onChange={setCopilotQuestion}
      onSubmit={submitCopilot}
      suggestions={activeCopilotSuggestions}
      onActivateSuggestion={activateCopilotSuggestion}
      takeover={takeover}
      focusable={placement === "panel" || composerTab === "copilot"}
      paneRef={placement === "inline" ? copilotPaneRef : undefined}
      className={
        placement === "inline"
          ? `col-start-1 row-start-1 ${composerTab === "copilot" ? "animate-in fade-in-0 duration-200" : "invisible pointer-events-none"}`
          : undefined
      }
      aria-hidden={placement === "inline" ? composerTab !== "copilot" : undefined}
    />
  );

  // Docked (AI in the Contact Details panel): the same composer, portaled
  // into the panel's footer.
  const dockedCopilot = copilotDock?.mount
    ? createPortal(
        copilotComposer("panel"),
        copilotDock.mount,
      )
    : null;
  // Copilot-only and docked: nothing stays inline.
  if (copilotDocked && copilotOnly) return dockedCopilot;

  return (
    <div ref={composerRootRef} className="relative shrink-0 bg-lyra-bg-surface-base px-6 py-4">
      {dockedCopilot}
      <ComposerFade />
      {/* `max-w-[768px]` — kept in sync with the message-column wrapper's
          own matching width above (originally narrowed together from
          1200px to 1024px; later narrowed again, together with that
          wrapper and `VoiceCallControls`' own floating card in
          agent-next-gen-voice-call-controls.tsx, from 1024px to 768px per
          explicit request), so the composer stays the same width as the
          transcript content sitting above it. */}
      <div className="w-full max-w-[768px] mx-auto">
        {quickReplyOpen && (
          // Normal flow, NOT `absolute` — this used to float over the
          // transcript above (a sibling `flex-1 overflow-y-auto` box, not
          // a descendant this composer can resize directly), which
          // visually buried the last few messages behind an opaque panel
          // the agent couldn't scroll past. Sitting in-flow instead grows
          // this composer's own (`shrink-0`) height, which — same flexbox
          // math that already keeps the composer pinned to the bottom at
          // its natural size — shrinks the transcript's available height
          // to make room rather than covering any of it, so its own
          // scrolling keeps working exactly as before, just over a
          // shorter viewport while this is open.
          placeMenu(<div ref={quickReplyContainerRef} className={floatingMenus ? undefined : "mb-2"}>
            {quickReplyConfiguring ? (
              <QuickReplyVariableForm
                title={quickReplyConfiguring.title}
                hashtagId={quickReplyConfiguring.id}
                triggerChar={QUICK_REPLY_TRIGGER_CHAR}
                fields={quickReplyConfiguring.fields ?? []}
                values={quickReplyFieldValues}
                onValueChange={(key, value) => setQuickReplyFieldValues((prev) => ({ ...prev, [key]: value }))}
                preview={fillQuickReplyTemplate(quickReplyConfiguring, quickReplyFieldValues, true)}
                onCancel={closeQuickReplyMenu}
                onClose={closeQuickReplyMenu}
                onInsert={handleInsertRichQuickReply}
              />
            ) : (
              <QuickReplyMenu
                query={quickReplyQuery}
                triggerChar={QUICK_REPLY_TRIGGER_CHAR}
                items={quickReplyMatches.map((item): QuickReplyMenuItem => ({
                  id: item.id,
                  title: item.title,
                  preview: item.template,
                  rich: item.rich,
                }))}
                activeIndex={quickReplyActiveIndex}
                onHoverItem={setQuickReplyActiveIndex}
                onSelect={(menuItem) => {
                  const item = QUICK_REPLIES.find((r) => r.id === menuItem.id);
                  if (item) handleSelectQuickReply(item);
                }}
                onClose={closeQuickReplyMenu}
              />
            )}
          </div>)
        )}
        {/* "Chat with Customer" / "Ask Copilot" tabs: the chat input stays mounted (just hidden) while Copilot is showing so a draft is kept. */}
        {/* Docked Copilot: no mode toggle here, the chat input stands alone. */}
        {copilotDocked ? null : copilotOnly ? (
          // Copilot-only (agent reviewing an AI-led chat): no mode toggle, just the switch at the right.
          onHideAiActionsChange && (
            <div className="mb-3 flex justify-end">
              <Switch size="sm" label="Hide AI Actions" checked={!!hideAiActions} onCheckedChange={onHideAiActionsChange} />
            </div>
          )
        ) : (
        <div className="mb-3 flex items-center justify-between gap-3">
        <ToggleGroup
          ariaLabel="Composer mode"
          allowDeselect={false}
          items={[
            { value: "chat", label: "Chat with Customer" },
            { value: "copilot", label: "Ask Copilot" },
          ]}
          value={composerTab}
          onValueChange={(next: string) => {
            // Always exactly one mode active: ignore the empty value a re-click may emit.
            if (next === "chat" || next === "copilot") setComposerTab(next);
          }}
        />
        {onHideAiActionsChange && (
          <Switch
            size="sm"
            label="Hide AI Actions"
            checked={!!hideAiActions}
            onCheckedChange={onHideAiActionsChange}
          />
        )}
        </div>
        )}
        {/* Both panes share one grid cell so the area keeps the taller (chat) height on either tab.
            `minmax(0,1fr)`: the cell is the column's width, never a pane's min-content. */}
        <div className="grid grid-cols-[minmax(0,1fr)]">
        {!copilotDocked && copilotComposer("inline")}
        <div className={`col-start-1 row-start-1 ${composerTab === "chat" ? "" : "invisible pointer-events-none"}`} aria-hidden={composerTab !== "chat"}>
        {replyBlockedReason && (
          <InlineNotification variant="warning" className="mb-2" data-slot="reply-blocked">
            {replyBlockedReason}
          </InlineNotification>
        )}
        <Textarea
          ref={textareaRef}
          placeholder="Type a message... or / for quick replies"
          rows={3}
          value={message}
          onChange={handleMessageChange}
          onKeyDown={handleComposerKeyDown}
          disabled={!!replyBlockedReason}
        />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <ActionIconButton size="sm" title="Attach file">
              <Paperclip className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
            <ActionIconButton size="sm" title="Bold">
              <Bold className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
            <ActionIconButton size="sm" title="Italic">
              <Italic className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
            <ActionIconButton size="sm" title="Emoji">
              <Smile className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
            <ActionIconButton size="sm" title="Quick replies" onClick={openQuickReplyMenuAtCaret} disabled={!!replyBlockedReason}>
              <Zap className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
            <ActionIconButton size="sm" title="Templates">
              <FileText className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
          </div>
          <div className="inline-flex items-center">
            <Button
              ref={sendButtonRef}
              variant="default"
              size="lg"
              className="gap-1.5 rounded-r-none"
              disabled={!canSend || !!replyBlockedReason}
              onClick={handleSend}
            >
              <Send className="h-4 w-4" strokeWidth={1.5} />
              Send
            </Button>
            <Button
              variant="default"
              size="icon-lg"
              className="rounded-l-none border-l border-white/25"
              disabled={!canSend || !!replyBlockedReason}
              title="More send options"
            >
              <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}