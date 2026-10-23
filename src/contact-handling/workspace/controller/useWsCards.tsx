// Workspace controller, slice 1 of 6 (P-EXTRACT C8b): the cards, toasts, the
// agent leg, the Outcome drafts, the layout settings and portal hosts, the
// active card and its channel, and the card's known-customer identity. The
// page's body, moved in order (hook order unchanged); see
// `useWorkspaceController`.
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useToast, type CreateNewOutboundContact } from "@nicecxone/lyra-ui";
import { CREATE_NEW_CUSTOMERS, type CreateNewCustomerRecord } from "@nicecxone/lyra-ui/customers-data";
import { buildCustomerContextOverviewInfo } from "@/components/agent-next-gen-shared-utils";
import type { TranscriptMessage } from "@/components/transcript/InteractionTranscript";
import { isAiActionMessage } from "@/components/agent-next-gen-ai-messages";
import { OUTBOUND_AGENTS } from "@/components/agent-next-gen-outbound-data";
import type { Thread, Interaction, AssignmentSortDirection } from "@/components/agent-next-gen-interaction-dashboard";
import type { AssignmentSortMode } from "@/settings";
import { DEFAULT_SORT_DIRECTION } from "@/contact-handling/assignment-sort";
import { usePageClockSource } from "@/components/agent-next-gen-page-clock";
import { type ContactHistoryEntry, buildContactHistoryByRange } from "@/components/agent-next-gen-contact-history";
import { saveCaseRecord } from "@/components/agent-next-gen-case-database";
import { useAgentLegTransitions, useAgentState, useCapability, useInteractionProvider, useInteractions } from "@/provider-context";
import {
  directoryDisplayName,
  tabMainKey,
  useChannelOutcomeDrafts,
  useNavCards,
  useNewAssignments,
  useVoiceBarCall,
  voiceWrapUpThread,
  isDraftThread,
  omnichannelMainKey,
  panelDefaultKey,
  useOmnichannelLayout,
  useConversationPlacement,
  useMainPins,
  useAnswerSla,
  deriveCardIdentity,
  useStampCardIdentity,
  type OutcomeDraft,
} from "@/contact-handling";
import { useCustomerTableState } from "@/components/customer-table-state";
import { type CustomerHistorySessionEntry, buildCustomerInfoFields, useCustomerRecordDraft } from "@/components/customer-info";
import { MARCUS_WEBB_ID, LUCAS_THOMAS_ID, TOM_LEWIS_CALL_ID, MAYA_CHEN_CALL_ID, mergeRows, useScenarioCases } from "@/contact-handling/scenario-cases";
import { CONTACT_CHANNELS, useSettings } from "@/settings";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { usePortalHost } from "@/contact-handling/portal-hosts";
import { findContactHistoryMatch, extractPriorContactInfo } from "@/contact-handling/workspace/active-channel-labels";
import { TOM_LEWIS_CALL_OVERVIEW, MAYA_CHEN_CALL_OVERVIEW, LUCAS_THOMAS_OVERVIEW } from "@/components/workspace/workspace-constants";
import type { WorkspaceControllerProps, WorkspaceLate } from "./workspace-late";

export function useWsCards(props: WorkspaceControllerProps, late: WorkspaceLate) {
  const { initialInteraction } = props;
  // Open by default on load again — per yet another explicit follow-up
  // request, reverting the previous "default the assignment panel closed
  // when the app launches" change back to open. Not gated on
  // `initialInteraction` either way — the rail's initial state is the same
  // regardless of whether the agent is seeded mid-call. `handleResize`'s
  // narrow-viewport auto-collapse (a few lines down) still applies after
  // that first paint.
  const [navOpen, setNavOpen] = useState(true);
  // No interactions exist until the agent launches one from the CreateNew
  // menu (Start Interaction / quick dial) — see handleStartCall/handleQuick
  // Dial below. Click any resulting InteractionNavItem card to make it the
  // active one. `initialInteraction` (see above) seeds this instead, for
  // callers that want to start already mid-call.
  // Marcus's card and his active question portal into stable hosts (`portal-hosts.tsx`), moved by `HostSlot`s.
  const marcusCardHost = usePortalHost("contents");
  const marcusQuestionHost = usePortalHost(
    "mx-auto flex w-full max-w-[768px] shrink-0 flex-col gap-3 overflow-y-auto px-6 pb-3 empty:hidden max-h-[50vh]",
  );
  // The page clock (agent-next-gen-page-clock.ts) is created here, ahead of
  // the cards, because store cards measure their timers from its anchor.
  // Handlers and timeouts read the current tick with `clock.now()`; only the
  // `<ClockTick>`/`<ClockValue>` wrappers re-render each second.
  const clock = usePageClockSource();
  /** Customer directory records created THIS session via "Create New
   *  Customer" — there's no backend to persist into the static
   *  `CREATE_NEW_CUSTOMERS`, so they live here for the session and are
   *  checked alongside it wherever a real-customer test or the match pool
   *  is built. Declared before the cards, which name linked contacts from it. */
  const [createdCustomerRecords, setCreatedCustomerRecords] = useState<CreateNewCustomerRecord[]>([]);
  const navCardDisplayName = useMemo(
    () =>
      directoryDisplayName(
        (entityId) =>
          createdCustomerRecords.find((c) => c.id === entityId) ?? CREATE_NEW_CUSTOMERS.find((c) => c.id === entityId)
      ),
    [createdCustomerRecords]
  );
  // Left-nav cards (P0.5b.2): every card is a provider contact from the
  // interaction store (one card per journey, `card.id` = `journeyId`),
  // scripted cases included (P0.5c). `setInteractions` keeps the old
  // updater shape — see useNavCards for what it keeps and drops.
  const {
    cards: navCards,
    setCards: setInteractions,
    findOpenCard,
    seedOverlay,
  } = useNavCards({
    anchorMs: clock.anchorMs,
    displayName: navCardDisplayName,
  });
  // The scripted cases among them. `scenarioKeyOf(card.id)` is the case key
  // (`LUCAS_THOMAS_ID`, …) of a scripted case's card, `scenarioCardId(key)`
  // the card of a case. Their transcripts come from the store; the page's own
  // rows for the same thread (Ask Copilot interstitials, typed lines) are
  // merged in by time.
  // Each provider contact's connection state, for rules that depend on
  // whether a channel's contact has ended (the row's dismiss icon).
  const storeContacts = useInteractions();
  const contactStateById = useMemo(() => new Map(storeContacts.map((i) => [i.id as string, i.state])), [storeContacts]);
  const scenarioCases = useScenarioCases(navCards);
  const { keyOf: scenarioKeyOf, cardIdOf: scenarioCardId } = scenarioCases;
  /** The scripted case playing on this card's thread, if any. */
  const scenarioThreadOf = (cardId: string | undefined, threadKey: string | undefined) => {
    const key = scenarioKeyOf(cardId);
    const scenario = key ? scenarioCases.byKey[key] : undefined;
    return scenario && scenario.threadKey === threadKey ? scenario : undefined;
  };
  const interactions = useMemo(
    () =>
      navCards.map((card) => {
        const key = scenarioKeyOf(card.id);
        const scenario = key ? scenarioCases.byKey[key] : undefined;
        if (!scenario?.threadKey) return card;
        return {
          ...card,
          // The case's own thread is the card's main thread until the agent
          // picks another (a channel added later, like Lucas's call, joins
          // as a second row instead of taking over the main column).
          currentThreadId: card.currentThreadId ?? scenario.threadKey,
          liveMessages: { ...card.liveMessages, [scenario.threadKey]: mergeRows(scenario.rows, card.liveMessages?.[scenario.threadKey]) },
        };
      }),
    [navCards, scenarioCases, scenarioKeyOf]
  );
  // Real "Assignments resolved today" count — previously read by the
  // dashboard header's own `SHOW_RESOLVED_TODAY_CHIP`-gated Badge (see
  // that flag's own doc comment, agent-next-gen-shared-utils.ts, and the
  // `PageHeader` `actions` slot below, now showing the "{N} Active
  // Assignments" chip instead). That Badge was already hidden behind the
  // flag before this change; now nothing reads the value at all, so only
  // the setter is destructured — `handleInteractionStatusChange` below
  // still increments it live on every real Resolved transition, so
  // re-enabling the old badge later only needs this destructure changed
  // back, not the tracking logic itself.
  const [, setResolvedTodayCount] = useState(0);
  // Keeps `agent-next-gen-case-database.ts`'s own local "database" in sync
  // with every live interaction's TRUE current state — see this same
  // effect's own doc comment in AgentNextGenPage.tsx for the full
  // reasoning (mirrored here per this file's own established convention of
  // mirroring bug fixes/behavior changes across all 3 page components).
  useEffect(() => {
    interactions.forEach((interaction) => saveCaseRecord(interaction));
  }, [interactions]);
  // Real "Today" Contact History rows — starts empty (nothing to show on
  // login, there's no backend here to have loaded anything from) and grows
  // as the agent actually dismisses whole assignments (`handleDismissInteraction`
  // below, via `buildDismissedContactHistoryEntry`) — see `ContactHistoryCard`'s
  // own doc comment for the full picture.
  const [dismissedContactHistory, setDismissedContactHistory] = useState<ContactHistoryEntry[]>([]);
  // Toast fired by both `handleDismissInteraction` (whole assignment) and
  // `handleDismissChannel` (one of several open channels) below, via
  // `fireDismissToast` — `useToast` just tracks the list; `<ToastContainer>`
  // actually renders it, near the end of this component's JSX.
  const { toasts, addToast, dismissToast, dismissAllToasts } = useToast();
  // Shared by both dismiss paths so the toast's own shape only lives in one
  // place. `title` is just "Success" — matching `Toast`'s own convention
  // (see toast.tsx's Storybook demos: a short status word as the bold
  // title, the specifics as body copy underneath) — with the
  // "{Name} {Record ID} Successfully Dismissed" text moved into `message`
  // (the body) instead of previously being crammed into `title` itself.
  // `customerName` falls back to "Customer" the same way the main
  // interaction header does (see `mainRegionTabLabel`) — an ad-hoc (typed
  // number/email, no matched customer) interaction still has *some* value
  // here (the raw address itself, see `customerIdentified`'s own doc
  // comment in lyra-ui's interaction-nav-item.tsx), so this fallback is
  // just defensive, not the common case.
  const fireDismissToast = (
    interaction: Pick<Interaction, "customerName" | "customerId">,
    // Per explicit request: a genuine, never-launched draft being deleted
    // (see `handleDismissInteraction`/`handleDismissChannel`'s own
    // `everSentAgentMessage` check) reads as "Draft Deleted" instead of
    // "Successfully Dismissed" — there was never a real assignment to
    // dismiss, just an untouched draft to discard. Default `false` — every
    // existing call site (a real, worked assignment) is unaffected.
    isDraftDelete = false
  ) => {
    addToast({
      variant: "success",
      title: "Success",
      message: isDraftDelete
        ? `${interaction.customerName ?? "Customer"} Draft Deleted`
        : `${interaction.customerName ?? "Customer"} ${interaction.customerId} Successfully Dismissed`,
      duration: 4000,
    });
  };
  // Agent leg (P0.5a): the interaction provider owns it. `AgentProfile`
  // displays the store's `agent.leg` (controlled) and reports clicks through
  // `onAgentLegToggle`; the resulting state arrives back as a `stateChanged`
  // event. The provider set outlives page mounts (ProviderRoot sits above
  // App's router), so the leg carries across tier switches on its own.
  const interactionProvider = useInteractionProvider();
  const agentState = useAgentState();
  const agentLegCapable = useCapability((c) => c.interaction.agentLeg);
  const handleAgentLegToggle = (action: "connect" | "disconnect") => {
    const command = action === "connect" ? interactionProvider.connectAgentLeg() : interactionProvider.disconnectAgentLeg();
    command.catch((error: unknown) => {
      if (import.meta.env.DEV) console.warn(`[agent-leg] ${action} failed`, error);
    });
  };
  // Whether the dedicated `AgentLegDisconnectedToast` (lyra-ui) is currently
  // showing — same "presence controls mounting" idiom `useToast`'s own
  // `toasts` array already uses for every other toast, just a plain
  // boolean since there's only ever one of these at a time (see that
  // component's own top-of-file doc comment). Set `true` on a real
  // "disconnected" event, `false` on a real "connected" event OR the
  // toast's own `onDismiss` (its "×", or its "Connect" button — see
  // `handleConnectAgentLeg` below) — per explicit request: "keep the alert
  // open until the agent connects the agent leg or clicks the close
  // button."
  const [agentLegDisconnectedToastOpen, setAgentLegDisconnectedToastOpen] = useState(false);
  // Fired (via `fireAgentLegStatusToast` below) once the agent leg actually
  // finishes connecting/disconnecting — never for the in-between
  // "connecting" state, and never for the leg's state on load or on a tier
  // switch (see `useAgentLegTransitions`). `success`/`warning` rather than always
  // `success` — landing back on "disconnected" isn't a positive event the
  // way finishing a connect is, same reasoning the SLA banner elsewhere in
  // this file reserves warning/critical for something actually needing
  // attention rather than defaulting every toast to green.
  //
  // "Disconnected" no longer goes through the plain `addToast`/`toasts`
  // list at all — it's the dedicated `AgentLegDisconnectedToast` (lyra-ui)
  // instead, toggled via `agentLegDisconnectedToastOpen` above, since that
  // one needs its own persistent (no-auto-dismiss)/"Connect"-button
  // behavior no other toast in this app has. "Connected" is still a plain,
  // ordinary 4000ms-auto-dismiss toast exactly as before.
  const showAgentLegToast = (agentLegConnectionStatus: "disconnected" | "connected") => {
    if (agentLegConnectionStatus === "disconnected") {
      setAgentLegDisconnectedToastOpen(true);
      return;
    }
    setAgentLegDisconnectedToastOpen(false);
    addToast({
      variant: "success",
      title: "Agent Leg Connected",
      message: "Your agent leg is now connected.",
      duration: 4000,
    });
  };
  // Wired to `AgentLegDisconnectedToast`'s own `onConnect` — starts the
  // real connect. Closing the toast itself is `onDismiss`'s job (wired
  // separately below, right where the component is rendered), not this
  // function's — `AgentLegDisconnectedToast` already calls both in the
  // right order on a "Connect" click (see its own doc comment).
  const handleConnectAgentLeg = () => handleAgentLegToggle("connect");
  // Last agent-leg status that arrived while the welcome modal was still
  // open — a ref (not state) since holding it shouldn't itself trigger a
  // re-render; the effect below is what actually flushes it once the modal
  // closes.
  const pendingAgentLegToastRef = useRef<"disconnected" | "connected" | null>(null);
  // Deferred, not dropped, while the welcome modal (`showWelcomeModal`) is
  // still open, per explicit request — the agent hasn't chosen Available/
  // Start Offline yet at that point, so a toast landing behind (or fighting
  // for attention with) the modal's own forced-choice UI reads as premature.
  // The agent leg's own status still updates normally underneath either way
  // (the store's `agent.leg`) — this just holds the notification about it
  // until right after the modal's been answered, instead of showing it
  // immediately or losing it entirely.
  const fireAgentLegStatusToast = (agentLegConnectionStatus: "disconnected" | "connected") => {
    if (late.showWelcomeModal) {
      pendingAgentLegToastRef.current = agentLegConnectionStatus;
      return;
    }
    showAgentLegToast(agentLegConnectionStatus);
  };
  useAgentLegTransitions(fireAgentLegStatusToast);
  // "Outcome" popover (`ChannelRow`'s own `outcome` prop, channel-row.tsx) —
  // logs Resolution/Tags/Disposition code/Summary for whichever channel's
  // Outcome button was clicked. Only one can be open across the entire left
  // nav at a time, same "one popover at a time" convention the session-
  // status popover already uses (`statusMenuOpenId`) — identified by
  // `${interactionId}:${channelKey}` since a channel's own `id`/`type` alone
  // isn't unique across DIFFERENT interactions, only within one card.
  // Note: no `resolution` field here — unlike Tags/Disposition/Summary
  // (which really are per-draft scratch state with no backend to persist
  // to), Resolution now reads/writes that specific channel's own entry in
  // `interaction.channelStatuses` directly (see `channels` below), the same
  // already-lifted piece of state the session-status pill itself reads/
  // writes via `handleInteractionStatusChange` — so there's nothing left
  // for a local draft to own for that field.
  // The open one is the store's `outcomeOpenFor` (P-EXTRACT, Bug 1): one
  // entry keyed by the channel, no record of which kind of trigger opened
  // it. Every trigger for a channel (its nav row, its session rows) keys off
  // the same `${interactionId}:${channelKey}` so they share one draft; which
  // one shows the popover is that trigger's own claim (`useOutcomeClaim`), so
  // two rows showing the same thread (the bug: a second, hidden session row
  // under AI display "main") can never both open it.
  const [outcomeDraftKey, setOutcomeDraftKey] = useWorkspaceUiField("outcomeOpenFor");
  // One Outcome draft per channel (`${cardId}:${threadKey}`, shared hook,
  // P0.5d.1): every Outcome popover and the inline voice wrap-up card read
  // and write the same draft for a channel. It starts empty, is kept across
  // reopenings, and is what wrap-up completes with (`outcomeFor`, Contact
  // History). `outcomeDraft`/`setOutcomeDraft` are the open popover's draft.
  const outcomeDrafts = useChannelOutcomeDrafts();
  const outcomeDraft = outcomeDrafts.draftFor(outcomeDraftKey);
  const setOutcomeDraft = (change: (draft: OutcomeDraft) => OutcomeDraft) => outcomeDrafts.update(outcomeDraftKey, change);
  // Duplicated verbatim from AgentNextGenPage.tsx (Agent Workspace 2.0) per
  // this codebase's "no shared sync" convention — records, per
  // `${interactionId}:${channelKey}`, the real wall-clock moment a
  // brand-new text-channel thread's first-ever LIVE agent message actually
  // went out (captured once inside `handleSendMessage`, below). Used only
  // by `resolveActiveChannelDateTimeLabel` (above) so a fresh outbound
  // chat/SMS/WhatsApp thread's unknown-contact subtitle shows the literal
  // string "Draft" until that first message is sent, then freezes on the
  // real send time instead of ticking with `new Date()` forever.
  const [threadLaunchTimestamps, setThreadLaunchTimestamps] = useState<Record<string, string>>({});
  /** Per explicit request ("add a customer typing animation when a customer
   *  is responding to a sms/chat/whatsapp") — duplicated verbatim from
   *  AgentNextGenPage.tsx per this codebase's "no shared sync" convention:
   *  `true` while a simulated customer reply is in flight on a given
   *  channel, keyed `${interactionId}:${channelKey}`. */
  const [customerTyping, setCustomerTyping] = useState<Record<string, boolean>>({});
  /* ── Unknown-contact customer matching (per explicit request) ──
     When the docked Customer Information panel is showing an unknown-
     contact interaction (`!activeInteractionIsRealCustomer`, below), it now
     runs a simulated "does this look like anyone in the directory" check
     instead of just a blank Detail-tab form — these three pieces of state
     back that flow. See `handleLinkCustomerRecord`/`handleCreateNewCustomer`
     (below `handleOutcomeOpenChange`) for what actually consumes them, and
     `findPossibleCustomerMatches`/`CustomerMatchSearchBody`'s own doc
     comments (agent-next-gen-customer-info-panel.tsx) for the check itself. */
  /** Which step of the flow is showing — "search" (possible matches / 0
   *  matches / manual search) or "create" (the "Create New Customer"
   *  form). Reset to "search" whenever a DIFFERENT interaction becomes
   *  active (see the reset effect a bit further down, once
   *  `activeInteraction` itself is in scope) — an agent shouldn't land
   *  back on the create form for interaction B just because they'd
   *  clicked into it for interaction A. */
  const [customerMatchStep, setCustomerMatchStep] = useState<"search" | "create">("search");
  /** The "Search Customers" box's own typed value — reset alongside
   *  `customerMatchStep` for the same reason. */
  const [customerMatchQuery, setCustomerMatchQuery] = useState("");
  const handleOutcomeOpenChange = (key: string, open: boolean) => {
    if (open) {
      // The channel's own draft (`outcomeDrafts`) shows as-is: whatever was
      // already picked for it, or empty the first time.
      setOutcomeDraftKey(key);
    } else {
      // Only if it's still this channel's: another channel may have opened in the same click.
      setOutcomeDraftKey((current) => (current === key ? null : current));
    }
  };
  // The open popover's Tags/Disposition handlers (session row, record tab).
  const handleOutcomeTagsChange = (tags: string[]) => setOutcomeDraft((d) => ({ ...d, tags }));
  const handleOutcomeDispositionChange = (value: string) => setOutcomeDraft((d) => ({ ...d, dispositionCode: value }));
  // "Approve & Save"/"Cancel" both just close the popover — there's no real
  // backend here to persist an outcome to, same no-op placeholder state
  // every other not-yet-wired action in this file starts from (e.g. Consult
  // / Transfer — see rule #30's own note in CLAUDE.md).
  const handleOutcomeSave = () => {
    // Saving an outcome is what makes a live chat dismissable by hand (its
    // row's Unassign & Dismiss icon, below).
    outcomeDrafts.markSaved(outcomeDraftKey);
    setOutcomeDraftKey(null);
  };
  const handleOutcomeCancel = () => {
    setOutcomeDraftKey(null);
  };
  // "Save & Redial"/"Save & Dismiss" — the Outcome popover's own footer
  // once `callEnded` is true (`ChannelOutcomeConfig`, outcome-panel.tsx).
  // Per explicit request: ending a call folds "wrap this call up" entirely
  // into this popover instead of leaving it split across a separate
  // standalone Unassign & Dismiss icon (now hidden once a call ends — see
  // `showDismissButton`/`onDismissChannel` below). "Save & Dismiss" is a
  // FULL dismiss — same as clicking that icon used to be (removes the
  // card, logs Contact History via the existing `handleDismissInteraction`).
  const handleOutcomeSaveAndDismiss = (interactionId: string) => {
    setOutcomeDraftKey(null);
    late.handleDismissInteraction(interactionId);
  };
  // "Save & Redial" opens the exact same "Redial Contact" dial-pad popover
  // Contact History's own Redial button uses (`handleRedialButtonClick`) —
  // reusing the same `dialpadRequest` mechanism rather than a second,
  // hand-rolled popover. `redialActiveInteraction` (below) is what lets
  // `handleDialpadSubmit` recognize a matching submission as "finish
  // redialing THIS interaction" rather than an unrelated new quick dial.
  const handleOutcomeSaveAndRedial = (interactionId: string, phoneNumber: string, anchorEl: HTMLElement | null) => {
    setOutcomeDraftKey(null);
    late.outboundDial.openCardRedialPad(interactionId, phoneNumber, anchorEl);
  };
  // Formerly drove the record header's own icon-button-cluster Outcome
  // popover and status chip (Consult/Transfer, Outcome, kebab, status
  // chip) — that header cluster no longer exists (see the channel-
  // controls-always-in-session-row change); dead state/handlers removed
  // rather than left unused. `InteractionTranscript`'s own session-row
  // status popover (`statusMenuOpenId`/`statusMenuView`) is the only copy
  // of this left.
  // Settings → Channels: the channels agents contact customers on. It gates
  // what the agent can start or receive, and the seeded lists keyed by channel.
  const [channelSettings] = useSettings("channels");
  // Contact History: only contacts on channels that are on (a channel turned off drops its rows).
  const contactHistoryByRange = useMemo(
    () => buildContactHistoryByRange(dismissedContactHistory, channelSettings),
    [dismissedContactHistory, channelSettings],
  );
  // Drives `AssignmentsExpandCollapseAllButton` — see that component's own
  // doc comment for why this is a one-shot "which direction does the NEXT
  // click bulk-apply" toggle (`channelsAllExpanded`) plus a version nonce
  // (`channelsExpandedOverrideVersion`, bumped on every click) rather than
  // a plain controlled boolean threaded straight into every card: each
  // `InteractionNavItem`'s own channel list still needs to keep toggling
  // independently after a bulk action, not stay permanently locked to this
  // one shared value. Both passed down as one `channelsExpandedOverride`
  // object (interaction-nav-item.tsx) at each card's own call site below.
  const [channelsAllExpanded, setChannelsAllExpanded] = useState(true);
  const [channelsExpandedOverrideVersion, setChannelsExpandedOverrideVersion] = useState(0);
  const handleToggleAllChannelsExpanded = () => {
    setChannelsAllExpanded((v) => !v);
    setChannelsExpandedOverrideVersion((v) => v + 1);
  };
  // Settings → Assignments (P-SETTINGS, ported from v3 f0b13dc): the
  // left-nav layout toggles. Turning "Don't allow interactions to collapse"
  // on also expands every card once, so that turning it back off later
  // returns every card expanded rather than restoring stale collapsed ones.
  const [assignmentsSettings, updateAssignmentsSettings] = useSettings("assignments");
  // The nav's sort (P-PROFILES: a setting, `assignments.sort`, so profiles
  // carry it; was page state). Ordering happens where the cards render
  // (`sortAssignmentCards`), leaving `interactions` itself in insertion order
  // for everything else that reads it. Picking a mode also picks its natural
  // direction (newest first; A–Z for Channel); Custom's dragged order is
  // per-browser working state (`useAssignmentsWorkingState`).
  const assignmentSort: AssignmentSortMode = assignmentsSettings.sort.mode;
  const assignmentSortDirection: AssignmentSortDirection = assignmentsSettings.sort.direction;
  const setAssignmentSort = (mode: AssignmentSortMode) =>
    updateAssignmentsSettings({ sort: { mode, direction: DEFAULT_SORT_DIRECTION[mode] } });
  const setAssignmentSortDirection = (direction: AssignmentSortDirection) =>
    updateAssignmentsSettings((a) => ({ sort: { ...a.sort, direction } }));
  // New Outbound's tabs and the Outbound Calling behaviors (CXone's names);
  // a behavior that's off hides its control.
  const [outboundSettings] = useSettings("outbound");
  // Voice off (Settings → Channels) also hides the voice-only behaviors
  // (Dial Pad, Redial).
  const enabledChannels = useMemo(() => CONTACT_CHANNELS.filter((c) => channelSettings[c]), [channelSettings]);
  const calling = {
    ...outboundSettings.calling,
    adHoc: outboundSettings.calling.adHoc && channelSettings.voice,
    redial: outboundSettings.calling.redial && channelSettings.voice,
    saveAndRedial: outboundSettings.calling.saveAndRedial && channelSettings.voice,
  };
  // Settings → Assignments → "Confirm before closing": an agent's dismiss
  // waits for the confirm dialog (ConfirmCloseDialog, mounted with the modals).
  const [pendingClose, setPendingClose] = useState<(() => void) | null>(null);
  const confirmDismiss = (dismiss: () => void) => (assignmentsSettings.confirmClose ? setPendingClose(() => dismiss) : dismiss());
  const [voiceSettings] = useSettings("voice");
  // Settings → AI display "panel" moves the AI content out of the transcript
  // into the docked Contact Details panel (`renderAiPanelFeed`). AI display
  // "main" (AI-first) makes it the main column instead (`AiWorkspaceColumn`),
  // every thread opens in the panel, and it implies the omnichannel routing.
  const { panelPlacement, placement, aiInPanel, asyncPlacement, aiWorkspaceInMain } = useConversationPlacement();
  // AI display inline / panel: the header channel icons are tabs for the main column (P-AIFIRST (k), (k3)).
  const tabs = asyncPlacement === "tabs";
  // Threads open in the docked panel, one that moves: AI display "main" only since (k3) (no omnichannel setting).
  const omnichannel = !tabs;
  // AI display "panel" (or a panel thread's Session Details): the interior slide-over portals into the Contact
  // Details panel's element (a ref, so lyra's InteriorPanel measures the panel itself). Only whether the panel is
  // in the page is state; the slide-over opens there once it is.
  const rightPanelEl = useRef<HTMLDivElement | null>(null);
  const [rightPanelSlotMounted, setRightPanelSlotMounted] = useState(false);
  const rightPanelRef = useCallback((el: HTMLDivElement | null) => {
    rightPanelEl.current = el;
    setRightPanelSlotMounted(!!el);
  }, []);
  const portalInto = (mount: HTMLElement | null, node: React.ReactElement) => (mount ? createPortal(node, mount) : node);
  const stripAiInPanel = (messages: TranscriptMessage[]) =>
    aiInPanel ? messages.filter((m) => !isAiActionMessage(m)) : messages;
  // The docked Copilot composer portals into one stable host for the page's life (`portal-hosts.tsx`); the slot that
  // holds it is the main column's dock ("main"), the panel footer, or the hover preview's footer (`copilotSlot`,
  // below). Moving the host never remounts the composer, so its draft, tab and chips survive a layout switch.
  const copilotHost = usePortalHost("contents");
  const [hoverDockMounted, setHoverDockMounted] = useState(false);
  // Bumped by an agent action in the docked composer; the Overview body then
  // scrolls to the bottom whatever its position (`DetailsPanelAccordions`).
  const [aiFollowSignal, setAiFollowSignal] = useState(0);
  // Only the panel footer and the main column's dock follow (not the hover preview's footer).
  const copilotFollows = useRef(false);
  // An agent action in the docked composer (a chip, Takeover, sending a
  // question) makes the Overview follow its result. Native listeners: the
  // composer is portaled into the host, so React events from it bubble
  // through the main column's composer, not through the host element.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (copilotFollows.current && (e.target as Element).closest("button, [role=button]")) setAiFollowSignal((s) => s + 1);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (copilotFollows.current && e.key === "Enter" && !e.shiftKey) setAiFollowSignal((s) => s + 1);
    };
    copilotHost.addEventListener("click", onClick, true);
    copilotHost.addEventListener("keydown", onKeyDown, true);
    return () => {
      copilotHost.removeEventListener("click", onClick, true);
      copilotHost.removeEventListener("keydown", onKeyDown, true);
    };
  }, [copilotHost]);
  // The voice bar portals into this host; its slot is the top of the left nav or the bottom (`VoiceBar`).
  const voiceBarHost = usePortalHost("shrink-0 empty:hidden");
  // The main transcript's current session row portals into this host, the record header's second line
  // (`sessionRowPortalTarget`; AI display inline and panel, P-CANVAS browser pass).
  const sessionRowHost = usePortalHost();
  // The left nav's slot renders only while the nav is open (and the setting is "top"); otherwise the bar sits at the bottom.
  const [voiceNavSlotMounted, setVoiceNavSlotMounted] = useState(false);
  const { newOutboundAtBottom, navItemsAtTop, noInteractionCollapse } = assignmentsSettings;
  useEffect(() => {
    if (!noInteractionCollapse) return;
    setChannelsAllExpanded(true);
    setChannelsExpandedOverrideVersion((v) => v + 1);
  }, [noInteractionCollapse]);
  // Each card's own current channel-list expanded/collapsed state, reported
  // via `InteractionNavItem`'s `onChannelsExpandedChange` (its own doc
  // comment explains why — the card owns that state internally, this is
  // just a read-only mirror of it). Keyed by `interaction.id`, NOT reset or
  // pruned when a card unmounts — a stale entry for a since-dismissed
  // interaction is harmless (the "every card agrees" check below only ever
  // looks up ids that are still in `interactions`).
  const [channelsExpandedById, setChannelsExpandedById] = useState<Record<string, boolean>>({});
  // Per explicit request: if the agent manually toggles individual cards'
  // chevrons by hand until every one happens to already agree with one
  // direction, `AssignmentsExpandCollapseAllButton`'s own `allExpanded`
  // should catch up to match — e.g. hand-expanding the one remaining
  // collapsed card should flip the button to "Collapse all" on its own,
  // without waiting for another bulk click. Deliberately does NOT bump
  // `channelsExpandedOverrideVersion` — this only updates the button's own
  // label/icon to reflect reality, it never re-applies an override onto
  // cards that already got there by hand.
  useEffect(() => {
    if (interactions.length === 0) return;
    const states = interactions.map((i) => channelsExpandedById[i.id]);
    if (states.some((s) => s === undefined)) return;
    if (states.every((s) => s === true) && !channelsAllExpanded) {
      setChannelsAllExpanded(true);
    } else if (states.every((s) => s === false) && channelsAllExpanded) {
      setChannelsAllExpanded(false);
    }
  }, [channelsExpandedById, interactions, channelsAllExpanded]);
  const [activeInteractionId, setActiveInteractionId] = useState<string | null>(
    () => initialInteraction?.id ?? null
  );
  /** Per explicit request ("add the new badge to any unread assignments
   *  (assignments that haven't been clicked on yet)"): a card is "New" until
   *  it has become the active one by any path (a card click, the Marcus
   *  Webb toast's Review/Takeover, a launched call landing on itself, ...).
   *  Shared with Desk since P0.5b.2 (`useNewAssignments`). */
  const isNewAssignment = useNewAssignments(activeInteractionId);
  // The incoming tile's answer SLA thresholds (the active profile's).
  const answerSla = useAnswerSla();
  // The Customers table's search, filters, sort and selection, shared by the
  // Home Customers tab and the Search panel's Customers sub-tab.
  const customerTable = useCustomerTableState();
  // Drives the main content area: whenever an interaction is active, the
  // Desk dashboard is replaced by that interaction's blank detail page (see
  // the PageHeader "record header" mode below) — starting/quick-dialing/
  // redialing a new assignment always sets this, so the screen switches
  // over automatically the moment one is added.
  const activeInteraction = interactions.find((i) => i.id === activeInteractionId) ?? null;
  /** The scripted case key of the active card (`LUCAS_THOMAS_ID`, …), if any. */
  const activeScenarioKey = scenarioKeyOf(activeInteraction?.id);

  // Single, shared Customer Overview/Detail/Directory draft for whichever
  // interaction is currently active — owned HERE (not inside
  // `CustomerInformationSidePanel`/`CustomerInfoHoverPreview` themselves,
  // which used to each build their own independent instance) per explicit
  // request: an agent who starts an edit, then hovers off the record
  // header's hover preview (which unmounts its content every time the mouse
  // leaves — Radix `Popover.Content` has no `forceMount`) or toggles the
  // docked panel closed and back open, should still see that exact same
  // pending edit rather than a freshly reset one. Passing this ONE instance
  // to both consumers below also means an edit started in one shows up in
  // the other, since they're now genuinely the same state rather than two
  // disconnected copies of "the same customer's" data.
  //
  // `useCustomerRecordDraft` already resets itself whenever `recordId`
  // changes (see that hook's own effect) — switching to a genuinely
  // different active interaction (or having none at all) naturally starts a
  // fresh draft, and dismissing an assignment removes it from `interactions`
  // entirely, which is exactly the ONE thing per explicit request that
  // should actually discard pending edits — not merely closing the panel or
  // hovering away from it.
  const activeCustomerFields = useMemo(
    () =>
      activeInteraction
        ? buildCustomerInfoFields(activeInteraction.customerName, activeInteraction.customerId, activeInteraction.threads)
        : [],
    [activeInteraction?.customerName, activeInteraction?.customerId, activeInteraction?.threads]
  );
  const activeCustomerRecordDraft = useCustomerRecordDraft(
    activeCustomerFields,
    activeInteraction?.customerName,
    activeInteraction?.customerId
  );
  // Same lift as `activeCustomerRecordDraft` above, for the identical
  // reason — see that state's own doc comment.
  const [activeCustomerOverviewEditing, setActiveCustomerOverviewEditing] = useState(false);
  useEffect(() => {
    setActiveCustomerOverviewEditing(false);
  }, [activeInteraction?.customerId]);
  // Keyed on `activeInteraction?.id` (the left-nav slot key — this flips
  // the instant `handleLinkCustomerRecord`/`handleCreateNewCustomer`
  // succeed too, since both reassign it), not `customerId` like the effect
  // above: switching to a genuinely DIFFERENT card should always land back
  // on the search step, but resolving THIS SAME card's own unknown-contact
  // flow (which also changes `id`) should too — the panel stops rendering
  // this UI at all the instant `activeInteractionIsRealCustomer` flips
  // true, so there's nothing wrong with also quietly resetting `step` back
  // to "search" under it as this fires.
  useEffect(() => {
    setCustomerMatchStep("search");
    setCustomerMatchQuery("");
  }, [activeInteraction?.id]);
  /** Per explicit request ("contact details panel for unmatched customers
   *  should match the hover popover. add a button above auto summary that
   *  says link to existing customer and then when that is clicked slide in
   *  a panel with the search customer / create new customer panel
   *  content") — the docked Customer Information panel now shows the same
   *  `DetailsPanelAccordions` content the hover popover always shows
   *  (`bodyOverride`, unconditionally) instead of jumping straight to the
   *  `matchState` search/create flow for an unmatched customer; this flag
   *  is what that flow now gates on instead (see the docked panel's own
   *  `matchState`/`onLinkCustomer` render-site doc comments further down).
   *  Reset alongside `customerMatchStep`/`customerMatchQuery` above, same
   *  "genuinely different card, or this same card's own flow just
   *  resolved" reasoning as that effect's own doc comment. */
  const [linkCustomerPanelOpen, setLinkCustomerPanelOpen] = useState(false);
  useEffect(() => {
    setLinkCustomerPanelOpen(false);
  }, [activeInteraction?.id]);

  /* A past session's conversation opened as a TAB in the interaction space
     (record header), via the Customer Information panel's Overview "Open
     Conversation" deep link. One at a time; opening another replaces it.
     `active` mirrors the channel tabs' selection model: clicking a channel
     tab deactivates this tab (but keeps it in the strip); clicking it
     re-activates it; its kebab's "Close Tab" removes it. Cleared when
     switching to a DIFFERENT interaction (see `switchActiveInteraction`). */
  const [historyConversationTab, setHistoryConversationTab] = useState<{
    interactionId: string;
    entry: CustomerHistorySessionEntry;
    active: boolean;
  } | null>(null);
  const historyConversationForActive =
    activeInteraction && historyConversationTab && historyConversationTab.interactionId === activeInteraction.id
      ? historyConversationTab
      : null;
  const isHistoryConversationView = Boolean(historyConversationForActive?.active);
  // Which channel type `InteractionTranscript` (below) should render content
  // for — the same "current" channel the record header's own
  // `ChannelToggleGroup` highlights (see its `active={... === key}` a few
  // hundred lines down) and `InteractionNavItem`'s `currentChannelKey` both
  // derive from, recomputed here rather than threading a shared value down
  // from either of those since neither is an ancestor of
  // `InteractionTranscript` in the tree. Falls back to the most recently
  // added channel when nothing's been explicitly selected yet, same as
  // everywhere else this "current channel" concept appears.
  // Omnichannel layout: the main column only ever shows a thread that
  // belongs there (`omnichannelMainKey`); async threads open in the slide-out.
  // With placement "panel" `mainKey` is only the card's context thread and
  // every thread, the chat included, opens in the panel.
  const requestedMainKey = activeInteraction
    ? activeInteraction.currentThreadId ?? activeInteraction.threads[activeInteraction.threads.length - 1]?.id
    : undefined;
  const mainPins = useMainPins();
  const mainKey = !activeInteraction
    ? undefined
    : omnichannel
      ? omnichannelMainKey(activeInteraction.threads, requestedMainKey, mainPins.pinned(activeInteraction.id))
      : tabMainKey(activeInteraction.threads, requestedMainKey);
  const activeChannel = activeInteraction?.threads.find((c) => (c.id ?? c.type) === mainKey);
  // The panel's thread (under "main") and, in every mode, the unread counts of threads not on screen (k5).
  const omni = useOmnichannelLayout(activeInteraction, panelPlacement ? undefined : mainKey, {
    defaultKey: panelPlacement && activeInteraction ? panelDefaultKey(activeInteraction.threads) : undefined,
  });
  const activeChannelType = activeChannel?.type;
  // The main column is the AI workspace (Autosummary, AI feed, Copilot
  // composer, wrap-up card) under "main" only. A call's tab follows AI
  // display like every other thread (k5): its transcript in the main column.
  const aiWorkspaceMain = aiWorkspaceInMain(activeChannelType);
  // The selected card's call in wrap-up, if any (its inline wrap-up card).
  const activeWrapUpThread = voiceWrapUpThread(activeInteraction);
  // A call whose transcript isn't on screen as a thread gets Contact Details' Transcript tab: (Lucas) a live
  // call John placed from the escalation card while the chat stays on screen. Every other call is a tab or a panel thread.
  const panelVoiceThread: Thread | undefined =
    activeInteraction && activeChannelType !== "voice" && scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID && !activeInteraction.closed && !activeInteraction.voiceCallEnded
      ? activeInteraction.threads.find((t) => t.type === "voice")
      : undefined;
  // Per explicit follow-up request ("leave the active badge visible if the
  // agent switches between chat/other channels"): whether the interaction
  // has a chat thread open ANYWHERE among its threads, not just whether the
  // currently-selected tab (`activeChannelType`) happens to be it — see the
  // record-header `badge` call site's own doc comment further down for the
  // full reasoning. `false` (not `undefined`) while there's no active
  // interaction at all, matching every other boolean derived here.
  const hasOpenChatThread = !!activeInteraction?.threads.some((c) => c.type === "chat");
  // The bare channel-key half of `activeChannelOutcomeKey` below — used on
  // its own to resolve this channel's own entry out of
  // `Interaction.liveMessages` (see that field's own doc comment for
  // why it's keyed per-channel) at the `InteractionTranscript` render call
  // site further down, so a freshly opened/different channel never shows
  // another channel's own live messages.
  const activeChannelKey = activeChannel?.id ?? activeChannel?.type ?? "channel";
  // Same `${interactionId}:${channelKey}` scheme the LeftNav's own
  // `ChannelRow` Outcome button keys `outcomeDraftKey` with (a few hundred
  // lines down) — computed here too so `InteractionTranscript`'s current-
  // session Outcome popover (`TranscriptSessionSeparator`) reads/writes the
  // exact same shared draft for this channel, not a second, disconnected
  // one. `activeInteraction`-less renders (Desk dashboard) never actually
  // use this — it's just always in scope for the JSX below.
  const activeChannelOutcomeKey = activeInteraction
    ? `${activeInteraction.id}:${activeChannel?.id ?? activeChannel?.type ?? "channel"}`
    : undefined;
  // This active channel's own status (see `Interaction.channelStatuses`'s
  // doc comment for why status has to be tracked per-channel rather than as
  // one flat interaction-wide value) — undefined until the agent actually
  // assigns one for THIS channel specifically. Drives both the transcript's
  // status pill/Outcome "Resolution" field and whether the composer shows
  // (hidden once this specific channel reads "Closed" — see the render call
  // site below) without touching any sibling channel's own status.
  const activeChannelStatus = activeChannel ? activeInteraction?.threadStatuses?.[activeChannel.id] : undefined;
  // Resolves an interaction's own live (not hung-up) voice thread —
  // deliberately NOT scoped to `activeInteraction`/`activeChannel` above,
  // which only ever resolve whichever interaction/tab the agent happens to
  // be LOOKING at right now. Mirrors `AgentNextGenPage.tsx`'s own identical
  // helper (see that file's doc comment on it for the fuller history —
  // it's what lets Phase 1's LeftNav show an "On Hold" badge on a card for
  // a live call the agent has switched away from, via `isOnHold`-style
  // checks not yet ported here). Added to THIS file per later explicit
  // follow-up request ("move the call controls below the main container so
  // if a user navigates to home/settings while on a call the controls of
  // the current call stay visible"): finding a live voice thread by
  // scanning `interactions` directly (not `activeInteraction`) is what lets
  // `liveVoiceCallInteraction`/`liveVoiceCallThread` below keep resolving
  // to the right call even after `switchActiveInteraction(null)` clears
  // `activeInteractionId` entirely (every Home/Settings nav click does
  // this — see that helper's own doc comment). `undefined` once the
  // interaction is closed, has no voice thread, or the agent has already
  // hung up (`voiceCallEnded`).
  // Cold inbound calls with no AI agent (Tom rings and needs Accept; Maya is answered automatically).
  const isColdCallId = (id: string | undefined) => {
    const key = scenarioKeyOf(id);
    return key === TOM_LEWIS_CALL_ID || key === MAYA_CHEN_CALL_ID;
  };
  const findLiveVoiceThread = (interaction: Interaction) => {
    // A ringing offer (Tom's included) isn't a call yet.
    if (interaction.closed || interaction.voiceCallEnded || interaction.offered) return undefined;
    return interaction.threads.find((c) => c.type === "voice");
  };
  // Whether Marcus's / Lucas's contact is still with the bot (in review):
  // engine state since P0.5c (`Interaction.review`), cleared by `takeOver`.
  const marcusWebbReviewing = !!scenarioCases.byKey[MARCUS_WEBB_ID]?.reviewing;
  const lucasThomasReviewing = !!scenarioCases.byKey[LUCAS_THOMAS_ID]?.reviewing;
  // Per explicit follow-up request ("when the agent clicks review from the
  // toast display an action bar component in place of the call controls"):
  // this is the split the toast's own `onReview`/`onTakeover` doc comment
  // (below, at their render site) already anticipated — "Review" and
  // "Takeover" both commit Marcus's interaction and navigate to it, but only
  // "Review" leaves the agent in a reduced, review-only mode. While this is
  // true, the live-call bar (gated on `liveVoiceCallInteraction` just below)
  // renders lyra-ui's `ActionBar` ("Reviewing this conversation" + Guide
  // Conversation/Transfer/Takeover) instead of `VoiceCallControls` — this
  // action bar's own "Takeover" button flips it back to `false`, which is
  // the only way out of review mode (mirrors the toast's "Review"/"Takeover"
  // pair one level down the flow). Reset to `false` on hang-up too (see
  // `onHangUp` below) so a call that's ended never leaves this stuck `true`.
  // Moved up from its original spot right after the "New Contact" toast's
  // own auto-close effect (see git history) to right here, because
  // `liveVoiceCallInteraction` immediately below now needs to read it —
  // see that const's own doc comment for why. The ActionBar has since been
  // replaced by the composer's Takeover Call button.
  // The single call this page currently has any UI for. Used to be a
  // plain `.find()` first match with no Marcus-awareness — per explicit
  // bug report ("when I launched Marcus Webb's inbound but didn't go to
  // the interaction and dialed a new outbound, the call controls didn't
  // appear in the new outbound and the new outbound button didn't become
  // disabled" + "when I went to the Marcus Webb interaction the takeover
  // button was not disabled - it should be if the agent is on another
  // active call"): Marcus's own scripted call is deliberately allowed to
  // stay "live" (a real voice thread, not ended) at the same time as a
  // genuinely new agent-dialed call — that's the whole point of
  // `agentOnActiveVoiceCall` below not treating Marcus-under-review alone
  // as "the agent is on a call," so the agent CAN dial a new outbound
  // while Marcus is still just being reviewed. But once they actually do,
  // plain `.find()` still returned Marcus's thread every time (his was
  // created first) — never the new call. Every consumer downstream reads
  // THIS const (`agentOnActiveVoiceCall` just below, the live-call bar's
  // `VoiceCallControls` vs. "Reviewing" `ActionBar` switch, and that
  // "Reviewing" bar's own "Takeover" `disabled` check, both further down),
  // so that one wrong pick cascaded into all three symptoms reported at
  // once — none of them were separately broken, they were all trusting
  // the same wrong answer.
  //
  // Fixed by preferring any OTHER live voice thread over Marcus's own
  // while `marcusWebbReviewing` is still true: Marcus's thread being
  // "live" was never the same thing as the AGENT being on a call (exactly
  // what `agentOnActiveVoiceCall` already established), so once a real
  // second call exists it's always the right pick; falls back to Marcus's
  // own thread only when it's genuinely the sole live call — or once the
  // agent actually clicks "Takeover", at which point `marcusWebbReviewing`
  // is `false` and this reduces back to a plain `.find()`. If more than
  // one NON-Marcus interaction ever has a live voice thread at once, which
  // one wins is still just a plain "for now" `.find()` pick — this fix
  // only teaches it about the one specific always-live-alongside-a-real-
  // call case (Marcus's own scripted thread) the app can actually put it
  // in; the general "auto hold and call display when multiple calls are
  // visible" redesign remains the separate, explicitly deferred project
  // this comment originally called out.
  // The bar's call (shared `useVoiceBarCall`, P0.5d.1): the selected card's
  // call (held or live) in its own state; else the call it last showed;
  // else the live call, else a held one. Selecting never changes hold state.
  // Marcus's call under AI review only counts when his card is selected
  // (the review bar replaces the voice bar there).
  const voiceBarCallOf = (card: Interaction) =>
    marcusWebbReviewing && scenarioKeyOf(card.id) === MARCUS_WEBB_ID && card.id !== activeInteractionId ? undefined : findLiveVoiceThread(card);
  const voiceBarCall = useVoiceBarCall(interactions, activeInteractionId, voiceBarCallOf);
  const liveVoiceCallInteraction = voiceBarCall?.card ?? null;
  const liveVoiceCallThread = voiceBarCall?.thread;
  /** Same "real, matched customer vs. a raw unidentified address" gate
   *  `activeInteractionIsRealCustomer` (above) already establishes, scoped
   *  to `liveVoiceCallInteraction` instead of `activeInteraction` since a
   *  live call and the page's currently-viewed interaction can be two
   *  different interactions (see this call's own `VoiceCallControls` doc
   *  comment below). Feeds `customerInitials` there — per explicit request
   *  ("avatars within the contact and call details should be the initials
   *  of the customer OR a customer avatar if no customer name is known"),
   *  the same `hasCustomerName ? initials : <User />` split
   *  `interaction-nav-item.tsx`'s own collapsed-tile avatar already uses. */
  const liveVoiceCallInteractionIsRealCustomer = liveVoiceCallInteraction
    ? CREATE_NEW_CUSTOMERS.some((c) => c.id === liveVoiceCallInteraction.entityId) ||
      createdCustomerRecords.some((c) => c.id === liveVoiceCallInteraction.entityId) ||
      !!liveVoiceCallInteraction.entityId?.startsWith("history:")
    : false;
  // Whether the call-controls bar below is showing for whichever
  // interaction is ALSO the one currently on screen — `onToggleTranscript`/
  // `onToggleVideo` below only make sense against that one interaction's
  // own `sidePanelOpen`/video-window state, both of which are page-level UI
  // tied to whatever `activeInteractionId` currently is, not to
  // `liveVoiceCallInteraction` itself. Neither button is wired at all
  // (`undefined` — hides them, same pattern every other optional callback
  // on this shared component already follows) once the agent has navigated
  // away from that interaction, rather than silently doing nothing or
  // acting on the wrong interaction's panel.
  const isViewingLiveVoiceCallInteraction =
    !!liveVoiceCallInteraction && liveVoiceCallInteraction.id === activeInteractionId;
  // The main tab is a draft (agent-initiated digital, nothing sent; `isDraftThread`, k6 9): the
  // session row's `isNewThread` — "Discard draft" and no Outcome/Transfer/status pill.
  const activeChannelIsNewOutboundThread = !!activeInteraction && isDraftThread(activeInteraction, activeChannel);
  // Per explicit request: true when the active interaction's own `id` is
  // one of `OUTBOUND_AGENTS`'s ids — i.e. this is an agent-to-agent voice
  // call, not a customer interaction (an agent's own outbound "Chat" pick
  // never reaches this state at all — `handleStartCall`'s own agent+chat
  // branch, below, returns early before ever creating one). Gates BOTH
  // Customer Information (the docked panel + its header toggle/hover-
  // preview — an agent-to-agent call has no real customer record behind it
  // any more meaningfully than the existing "unknown contact" case does,
  // but per explicit follow-up request this hides it outright rather than
  // falling back to the Detail-only tab set that case still gets) AND the
  // header's own status chip (`ChannelStatusTag`, further down — an agent
  // call has no real Open/Pending/Resolved/Closed disposition to log
  // against a colleague the way a genuine customer contact does).
  const activeInteractionIsAgentCall = !!activeInteraction && OUTBOUND_AGENTS.some((a: CreateNewOutboundContact) => a.id === activeInteraction.entityId);
  // Per explicit request: true when the active interaction is genuinely
  // backed by a real `CREATE_NEW_CUSTOMERS` directory record — every
  // creation path either reuses that real `customer-N` id verbatim
  // (`handleStartCall`'s directory pick, `handleOpenAssignmentFromNotification`,
  // `handleOpenInteractionRow`, a `handleRedial` with a real
  // `entry.customerId`) or falls back to a synthetic, namespaced one with
  // no backing record (`quickdial:`, a `redial:` with no real customerId,
  // lyra-ui's `adhoc:` "Continue with" flow, a hand-authored Contact
  // History-only entry) — so this membership check is the precise,
  // general "is this a real customer" signal, not just a prefix check on
  // one specific synthetic namespace. `true` when there's no active
  // interaction at all — harmless default, nothing reads it in that case.
  // ALSO true when `id` matches a `createdCustomerRecords` entry (above) —
  // per explicit request, an interaction the agent just ran "Create New
  // Customer" or "Link To Record" on (`handleCreateNewCustomer`/
  // `handleLinkCustomerRecord`, below) must immediately read as a real
  // customer too, promoting it straight into every OTHER tier of this same
  // "real customer" treatment (full channel tab row, full Customer
  // Information tab set, plain customer-ID subtitle — see
  // `showChannelTabRow` right below) the instant either action resolves,
  // not just at the customer directory's own static, build-time contents.
  // Per explicit follow-up bug report — see AgentWorkspace2WithDeskPage.tsx's
  // identical fix for the full reasoning: a Contact History entry with no
  // `customerId` of its own reopens under a synthetic `history:${entry.id}`
  // id (`handleReopenContactHistoryEntry`, below); that id used to read as
  // NOT a real customer here, wrongly hiding Contact Overview for a
  // genuine past contact. `startsWith("history:")` covers only that case,
  // not the genuinely-unknown `adhoc:`/`quickdial:`/`redial:` ones.
  // A known customer is a fact on the card (P-EXTRACT, Bug 3): stamped the first time it holds, so a
  // scripted case (Lucas arrives linked to an existing customer; the cold calls are known callers) stays
  // one after its scripted contact ends.
  const cardIdentityOf = (card: Interaction) =>
    deriveCardIdentity(card, {
      isDirectoryEntity: (entityId) => CREATE_NEW_CUSTOMERS.some((c) => c.id === entityId),
      isCreatedEntity: (entityId) => createdCustomerRecords.some((c) => c.id === entityId),
      isKnownScenario: (cardId) => scenarioKeyOf(cardId) === LUCAS_THOMAS_ID || isColdCallId(cardId),
    });
  useStampCardIdentity(interactions, setInteractions, cardIdentityOf);
  const activeInteractionIsRealCustomer = activeInteraction
    ? !!(activeInteraction.identity ?? cardIdentityOf(activeInteraction))
    : true;
  // Feeds the Customer Context Overview accordion (`customerContextOverview`
  // prop, below) that now renders in place of the old plain `ContactOverview`
  // block — per explicit request to mirror `AgentNextGenPage.tsx`'s ("Phase
  // 1") Customer Context Overview functionality here. `buildCustomerContext
  // OverviewInfo` (agent-next-gen-shared-utils.ts) is fully deterministic/
  // hash-seeded — no real LLM call is involved anywhere in this app for this
  // feature (see that function's own doc comment) — so "tie the content to
  // an LLM... or use the customer database information, whichever's
  // easiest" resolves to the database-grounded path Phase 1 already uses:
  // `findContactHistoryMatch`/`extractPriorContactInfo` (top of this file)
  // ground it in the customer's real Contact History case when one matches.
  //
  // Reuses this same `activeInteractionIsRealCustomer` for BOTH the
  // `isKnownCustomer` and `identified` arguments — Advanced (unlike Phase 1)
  // has no separate chat-only "identified" nuance; this is already the one
  // signal this file uses elsewhere (e.g. `customerIdentified`, below) to
  // distinguish a real customer from an unknown one.
  const customerContextOverviewBase = useMemo(() => {
    if (!activeInteraction) return undefined;
    const base = buildCustomerContextOverviewInfo(
      // Hash-seeded: a scripted case seeds by its key (its old card id), so
      // its generic profile is the same as before it came from the engine.
      activeScenarioKey ?? activeInteraction.id,
      activeInteraction.customerName,
      activeInteractionIsRealCustomer,
      activeInteractionIsRealCustomer,
      extractPriorContactInfo(
        findContactHistoryMatch(activeInteraction.customerName, activeInteraction.customerId)
      )
    );
    // Marcus Webb's own scripted refund scenario (see
    // `MarcusWebbIncomingCallNotice`'s top-of-file doc comment) — per
    // explicit request, only Contact Snapshot/Next Best Action are
    // overridden here with copy grounded in THIS call's own refund story
    // (matching the incoming-call notice's own Case Summary), so the two
    // don't disagree once the agent navigates in via Review/Takeover.
    // `customerCard`/`detailedSummary` are deliberately left as `base`
    // computed them (the generic hashed "Customer Profile" card) — per
    // explicit follow-up correction, that section stays untouched; only
    // the accordion CONTENT below it changes.
    if (activeScenarioKey === MARCUS_WEBB_ID) {
      return {
        ...base,
        snapshot: [
          "Calling about a refund on a $200 order.",
          "Order for [noise-cancelling headphones](order) placed last Tuesday arrived with a cracked ear cup.",
          "Refund exceeds the AI agent's $100 auto-approval limit — escalated for human approval.",
        ],
        journeySummary:
          "Marcus is on hold while the Cognigy AI Agent waits for sign-off on a $200 refund for order #48213 (noise-cancelling headphones, cracked ear cup). The refund qualifies but exceeds the AI agent's $100 auto-approval limit. Approve or reject the refund, or give the AI agent another instruction.",
        nextBestAction:
          "Review the order and approve the $200 refund so the AI agent can complete the request and take the customer off hold.",
      };
    }
    if (activeScenarioKey === MAYA_CHEN_CALL_ID) {
      return {
        ...base,
        customerCard: {
          ...base.customerCard,
          avatarInitials: "MC",
          subtitle: MAYA_CHEN_CALL_OVERVIEW.subtitle,
          tags: MAYA_CHEN_CALL_OVERVIEW.tags,
          sentiment: { value: "Disappointed" },
        },
        detailedSummary: MAYA_CHEN_CALL_OVERVIEW.detailedSummary,
        journeySummary: MAYA_CHEN_CALL_OVERVIEW.journeySummary,
        snapshot: MAYA_CHEN_CALL_OVERVIEW.snapshot,
        nextBestAction: MAYA_CHEN_CALL_OVERVIEW.nextBestAction,
      };
    }
    if (activeScenarioKey === TOM_LEWIS_CALL_ID) {
      return {
        ...base,
        customerCard: {
          ...base.customerCard,
          avatarInitials: "TL",
          subtitle: TOM_LEWIS_CALL_OVERVIEW.subtitle,
          tags: TOM_LEWIS_CALL_OVERVIEW.tags,
          sentiment: { value: "Annoyed" },
        },
        detailedSummary: TOM_LEWIS_CALL_OVERVIEW.detailedSummary,
        journeySummary: TOM_LEWIS_CALL_OVERVIEW.journeySummary,
        snapshot: TOM_LEWIS_CALL_OVERVIEW.snapshot,
        nextBestAction: TOM_LEWIS_CALL_OVERVIEW.nextBestAction,
      };
    }
    if (activeScenarioKey === LUCAS_THOMAS_ID) {
      // Customer card + summaries reflect Lucas's own assignment (CASE-30418), from his script.
      return {
        ...base,
        customerCard: {
          ...base.customerCard,
          avatarInitials: "LT",
          subtitle: LUCAS_THOMAS_OVERVIEW.subtitle,
          tags: LUCAS_THOMAS_OVERVIEW.tags,
          sentiment: { value: "Frustrated" },
        },
        detailedSummary: LUCAS_THOMAS_OVERVIEW.detailedSummary,
        journeySummary: LUCAS_THOMAS_OVERVIEW.journeySummary,
        snapshot: LUCAS_THOMAS_OVERVIEW.snapshot,
        nextBestAction: LUCAS_THOMAS_OVERVIEW.nextBestAction,
      };
    }
    return base;
  }, [activeInteraction?.id, activeInteraction?.customerName, activeInteraction?.customerId, activeInteractionIsRealCustomer, activeScenarioKey]);

  return {
    ...props,
    navOpen, setNavOpen, marcusCardHost, marcusQuestionHost, clock, createdCustomerRecords, setCreatedCustomerRecords,
    navCardDisplayName, navCards, setInteractions, findOpenCard, seedOverlay, storeContacts, contactStateById,
    scenarioCases, scenarioKeyOf, scenarioCardId, scenarioThreadOf, interactions, setResolvedTodayCount,
    dismissedContactHistory, setDismissedContactHistory, toasts, addToast, dismissToast, dismissAllToasts,
    fireDismissToast, interactionProvider, agentState, agentLegCapable, handleAgentLegToggle,
    agentLegDisconnectedToastOpen, setAgentLegDisconnectedToastOpen, showAgentLegToast, handleConnectAgentLeg,
    pendingAgentLegToastRef, fireAgentLegStatusToast, outcomeDraftKey, setOutcomeDraftKey, outcomeDrafts,
    outcomeDraft, setOutcomeDraft, threadLaunchTimestamps, setThreadLaunchTimestamps, customerTyping,
    setCustomerTyping, customerMatchStep, setCustomerMatchStep, customerMatchQuery, setCustomerMatchQuery,
    handleOutcomeOpenChange, handleOutcomeTagsChange, handleOutcomeDispositionChange, handleOutcomeSave,
    handleOutcomeCancel, handleOutcomeSaveAndDismiss, handleOutcomeSaveAndRedial, channelSettings,
    contactHistoryByRange, assignmentSort, setAssignmentSort, assignmentSortDirection, setAssignmentSortDirection,
    channelsAllExpanded, setChannelsAllExpanded, channelsExpandedOverrideVersion, setChannelsExpandedOverrideVersion,
    handleToggleAllChannelsExpanded, assignmentsSettings, outboundSettings, enabledChannels, calling, pendingClose,
    setPendingClose, confirmDismiss, voiceSettings, panelPlacement, placement, aiInPanel, asyncPlacement,
    aiWorkspaceInMain, tabs, omnichannel, rightPanelEl, rightPanelSlotMounted, setRightPanelSlotMounted,
    rightPanelRef, portalInto, stripAiInPanel, copilotHost, hoverDockMounted, setHoverDockMounted, aiFollowSignal,
    setAiFollowSignal, copilotFollows, voiceBarHost, sessionRowHost, voiceNavSlotMounted, setVoiceNavSlotMounted,
    newOutboundAtBottom, navItemsAtTop, noInteractionCollapse, channelsExpandedById, setChannelsExpandedById,
    activeInteractionId, setActiveInteractionId, isNewAssignment, answerSla, customerTable, activeInteraction,
    activeScenarioKey, activeCustomerFields, activeCustomerRecordDraft, activeCustomerOverviewEditing,
    setActiveCustomerOverviewEditing, linkCustomerPanelOpen, setLinkCustomerPanelOpen, historyConversationTab,
    setHistoryConversationTab, historyConversationForActive, isHistoryConversationView, requestedMainKey, mainPins,
    mainKey, activeChannel, omni, activeChannelType, aiWorkspaceMain, activeWrapUpThread, panelVoiceThread,
    hasOpenChatThread, activeChannelKey, activeChannelOutcomeKey, activeChannelStatus, isColdCallId,
    findLiveVoiceThread, marcusWebbReviewing, lucasThomasReviewing, voiceBarCallOf, voiceBarCall,
    liveVoiceCallInteraction, liveVoiceCallThread, liveVoiceCallInteractionIsRealCustomer,
    isViewingLiveVoiceCallInteraction, activeChannelIsNewOutboundThread, activeInteractionIsAgentCall,
    cardIdentityOf, activeInteractionIsRealCustomer, customerContextOverviewBase,
  };
}

export type WsCards = ReturnType<typeof useWsCards>;
