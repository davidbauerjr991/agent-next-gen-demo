// Workspace controller, slice 5 of 6 (P-EXTRACT C8b): sending a message (and
// the simulated reply), case status and the per-channel Outcome config, the
// incoming offer and the voice bar's controls, New Outbound's config and the
// card "+" pickers, the welcome modal's choices, the shared panel's open /
// fullscreen animation and float position, notifications, and the Schedule,
// Agent Chat and Screen Pop contents. The page's body, moved in order (hook
// order unchanged); see `useWorkspaceController`.
import React, { useEffect, useMemo } from "react";
import {
  Select,
  useAgentNotificationsContent,
  useScheduleContent,
  type AgentNotification,
  type ChannelOutcomeConfig,
  type CreateNewOutboundConfig,
  type CreateNewOutboundContact,
  type DraggableVariant,
  type EmbeddablePanelContent,
} from "@nicecxone/lyra-ui";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { CURRENT_AGENT_FIRST_NAME, CURRENT_AGENT_LAST_NAME, SHOW_ADD_CHANNEL_HEADER_BUTTON, initialsFor, synthesizeChannelAddress } from "@/components/agent-next-gen-shared-utils";
import { type TranscriptMessage, TRANSCRIPT_SESSION_STATUS_OPTIONS, OUTCOME_TAG_OPTIONS, OUTCOME_DISPOSITION_OPTIONS } from "@/components/transcript/InteractionTranscript";
import {
  OUTBOUND_TEAMS,
  OUTBOUND_TEAM_MEMBERS,
  OUTBOUND_CONFIG,
  CONTACT_HISTORY_OUTBOUND_CONTACTS,
  buildContactHistoryOutboundContacts,
} from "@/components/agent-next-gen-outbound-data";
import type { Interaction } from "@/components/agent-next-gen-interaction-dashboard";
import { buildDismissedContactHistoryEntry } from "@/components/agent-next-gen-contact-history";
import { useCapability } from "@/provider-context";
import {
  buildOpenChannelTagger,
  navCardAddChannelAction,
  showsSessionControls,
  outcomeDraftKey as outcomeDraftKeyOf,
  useContactCommands,
  useIncomingOffer,
  useVoiceCallControls,
  callerOfCard,
  declinedOfferToast,
  enabledChannelOptions,
  withEnabledChannels,
  useCardAddChannel,
  useCardOwnAddChannel,
  alreadyOpenReasons,
  liveAddressesFor,
  markAlreadyOpen,
  useChannelDisabledReasons,
  type OutcomeDraft,
} from "@/contact-handling";
import type { InteractionHistoryRecord } from "@/components/agent-next-gen-interactions-table";
import { resolveCustomerAutoReply } from "@/contact-handling/customer-auto-reply";
import { useTypedTurnRelease } from "@/contact-handling/next-best-action";
import { SCREEN_POP_APPS, SHARED_PANEL_DEFAULT_WIDTH } from "@/components/workspace/workspace-constants";
import { MockLoginCard } from "@/components/workspace/left-nav-parts";
import type { WorkspaceLate } from "./workspace-late";
import type { WsLaunch } from "./useWsLaunch";
import { useTouchThread } from "@/contact-handling/touched-threads";

export function useWsOutbound(prev: WsLaunch, late: WorkspaceLate) {
  const {
    SHARED_PANEL_MAX_WIDTH, activateWhenReady, activeInteractionId, addToast, allOutboundSkills, calling, cardContactMethodsOf, channelSettings,
    clock, computePanelHeight, confirmDismiss, contactReopen, containerRef, findDirectoryCustomer,
    dismissedContactHistory, enabledChannels, findOpenCard, fullScreenAnimTimer, handleDismissChannel, handleDismissInteraction,
    handleOutcomeCancel, handleOutcomeOpenChange, handleOutcomeSave, handleOutcomeSaveAndRedial, handleStartCall,
    handleStatusChange, interactions, liveVoiceCallThread, notifications, outboundDial, outcomeDraftKey, outcomeDrafts,
    panelAnimTimer, panelFloatLeft, panelFloatTop, panelFullScreen, panelOpen, panelRef, panelWidth, screenPopApp,
    selectedOutboundTeamId, setCustomerTyping, setDismissedContactHistory, setFullScreenRendered, setFullScreenVisible,
    setInteractions, setNavOpen, setNotifications, setOutcomeDraftKey, setPanelFullScreen, setPanelHeight,
    setPanelMounted, setPanelState, setPanelVariant, setPanelWidth, setResolvedTodayCount, setScreenPopApp,
    setSelectedOutboundTeamId, setShowWelcomeModal, setThreadLaunchTimestamps, storeContacts, switchActiveInteraction,
  } = prev;
  /** Fired by `InteractionComposer`'s Send button — appends the agent's
   *  typed message to this interaction's `liveMessages` (see that field's
   *  own doc comment), clears the awaiting-response flag on whichever
   *  channel is currently open (the agent just replied), then — since
   *  there's no real backend here for an actual customer to respond from —
   *  simulates one coming back a couple seconds later: appends a canned
   *  customer reply and flips that same channel's `awaitingResponse` back
   *  on. That flag is what feeds `InteractionNavItem.awaitingResponse`
   *  (both the card-level prop and each channel row's own), so the customer
   *  "replying" is what puts the red badge on this interaction's nav item —
   *  exactly the treatment `InteractionNavItem.stories.tsx`'s "Active,
   *  Awaiting Response" story already documents, not a new visual invented
   *  for this feature. */
  /** An outbound email draft's temporary Send (E2): marks the thread sent, which makes it live (Outcome, the
   *  status pill, Unassign & Dismiss). P-PARKED's email composer replaces it. */
  const handleSendEmailDraft = (interactionId: string, threadKey: string) =>
    setInteractions((prev) =>
      prev.map((i) =>
        i.id === interactionId
          ? { ...i, threads: i.threads.map((t) => ((t.id ?? t.type) === threadKey ? { ...t, draftSent: true } : t)) }
          : i
      )
    );
  // Sending touches the thread (touched-threads.ts): it stays when its channel goes off.
  const touchThread = useTouchThread();
  const releaseTypedTurn = useTypedTurnRelease();
  const handleSendMessage = (interactionId: string, text: string, channelKeyOverride?: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const agentMessage: TranscriptMessage = {
      id: `live-${Date.now()}-agent`,
      sender: "agent",
      name: `${CURRENT_AGENT_FIRST_NAME} ${CURRENT_AGENT_LAST_NAME}`,
      initials: initialsFor(`${CURRENT_AGENT_FIRST_NAME} ${CURRENT_AGENT_LAST_NAME}`),
      timestamp: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      text: trimmed,
    };

    // Captured once, here, from whichever channel is current on THIS
    // interaction right now — `InteractionComposer` (which fired this) is
    // always scoped to the currently active channel, so this is genuinely
    // "the channel this message was sent on." NOT recomputed separately
    // inside `applyToChannel` at both the immediate-send and delayed-reply
    // moments below: the agent is free to switch to a different channel tab
    // (or away and back) during the 2.5s before the simulated customer
    // reply lands, and re-deriving "current" at that later point would
    // misattribute the reply (and the `liveMessages` entry it's appended
    // to) to whatever channel happens to be active THEN instead of the one
    // this whole exchange actually started on.
    const interactionAtSend = interactions.find((i) => i.id === interactionId);
    // `channelKeyOverride` — per explicit request ("add an icon ... and
    // open a side panel ... with the channel content"): the new channel-
    // preview panel's own `InteractionComposer` (its own render site
    // further down) sends on a SPECIFIC, possibly non-active thread, not
    // whichever one happens to be `currentThreadId` right now — every
    // other caller (the main composer, always scoped to the active
    // channel) omits this and keeps the original derivation.
    const channelKeyAtSend =
      channelKeyOverride ??
      interactionAtSend?.currentThreadId ??
      (interactionAtSend?.threads[interactionAtSend.threads.length - 1]
        ? interactionAtSend.threads[interactionAtSend.threads.length - 1].id ??
          interactionAtSend.threads[interactionAtSend.threads.length - 1].type
        : undefined) ??
      "channel";
    touchThread(interactionId, channelKeyAtSend);
    // Same key `applyToChannel`/`customerTyping` below share — see
    // `customerTyping`'s own doc comment. Only chat/SMS/WhatsApp ever gets a
    // "customer is typing" bubble (`InteractionTranscript`'s own
    // `isTextChannel` render gate covers this too, but resolving the type
    // here as well avoids ever setting the flag for voice/email in the
    // first place).
    const channelTypeAtSend = interactionAtSend?.threads.find((c) => (c.id ?? c.type) === channelKeyAtSend)?.type;
    const isTextChannelAtSend =
      channelTypeAtSend === "chat" || channelTypeAtSend === "sms" || channelTypeAtSend === "whatsapp";
    const typingKey = `${interactionId}:${channelKeyAtSend}`;

    // Duplicated verbatim from AgentNextGenPage.tsx (Agent Workspace 2.0)
    // per this codebase's "no shared sync" convention — captures the real
    // send time of a brand-new thread's first-ever LIVE agent message
    // (guarded on no prior `liveMessages` for this channel key), once, into
    // `threadLaunchTimestamps` (see that state's own doc comment above).
    if (!interactionAtSend?.liveMessages?.[channelKeyAtSend]?.length) {
      const launchKey = `${interactionId}:${channelKeyAtSend}`;
      setThreadLaunchTimestamps((prev) => (prev[launchKey] ? prev : { ...prev, [launchKey]: new Date().toISOString() }));
    }

    const applyToChannel = (
      interaction: Interaction,
      message: TranscriptMessage,
      awaitingResponse: boolean,
      // Only ever passed on the customer-reply branch below — the moment
      // that reply actually lands is exactly what `lastCustomerMessageTick`
      // needs to record (see that field's own doc comment). Omitted (not
      // just `undefined`-valued) on the agent-send branch so it doesn't
      // overwrite the channel's existing value with `undefined` there.
      lastCustomerMessageTick?: number
    ): Interaction => ({
      ...interaction,
      // Keyed by `channelKeyAtSend` — see `Interaction.liveMessages`'s
      // own doc comment for why this can't be one flat array shared across
      // every channel on the card.
      liveMessages: {
        ...interaction.liveMessages,
        [channelKeyAtSend]: [...(interaction.liveMessages?.[channelKeyAtSend] ?? []), message],
      },
      threads: interaction.threads.map((c) =>
        (c.id ?? c.type) === channelKeyAtSend
          ? { ...c, awaitingResponse, ...(lastCustomerMessageTick !== undefined ? { lastCustomerMessageTick } : {}) }
          : c
      ),
    });

    setInteractions((prev) =>
      prev.map((interaction) =>
        interaction.id === interactionId ? applyToChannel(interaction, agentMessage, false) : interaction
      )
    );

    // P-CANVAS: the send is a scripted agent turn the agent inserted: the script goes on from it (its own customer
    // turn follows), so there's no simulated reply.
    if (releaseTypedTurn(interactionId, channelKeyAtSend)) return;

    // "Customer is typing" — see `customerTyping`'s own doc comment. Per
    // explicit follow-up request ("do not display the typing indicator
    // until 2s after the agent message is sent"), no longer set the
    // instant the agent's own message goes out — behind its own 2000ms
    // `window.setTimeout` instead, so the bubble only appears starting 2s
    // after the agent sends a message, not immediately. Still cleared (and
    // the actual reply lands) at the original 2500ms mark below — this
    // narrows the indicator's own visible window to the LAST 500ms before
    // the reply lands, rather than changing the total reply delay itself
    // (a separate, unrelated earlier misreading of this same request —
    // reverted).
    if (isTextChannelAtSend) {
      window.setTimeout(() => {
        setCustomerTyping((prev) => ({ ...prev, [typingKey]: true }));
      }, 2000);
    }

    // Simulated customer reply — canned text, not a real conversation
    // engine. "Customer"/"C" here are placeholders: `InteractionTranscript`
    // already swaps every customer-sender message's name/initials for this
    // interaction's real customer at render time (see its own doc comment),
    // so this reads correctly without needing the real name threaded
    // through here too.
    window.setTimeout(() => {
      if (isTextChannelAtSend) {
        setCustomerTyping((prev) => ({ ...prev, [typingKey]: false }));
      }
      const customerMessage: TranscriptMessage = {
        id: `live-${Date.now()}-customer`,
        sender: "customer",
        name: "Customer",
        initials: "C",
        timestamp: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        text: resolveCustomerAutoReply(trimmed),
      };
      setInteractions((prev) =>
        prev.map((interaction) =>
          interaction.id === interactionId
            // `clock.now()` reads the tick at the moment this callback
            // fires (2.5s after `handleSendMessage` was called), not the
            // tick from when it was scheduled.
            ? applyToChannel(interaction, customerMessage, true, clock.now())
            : interaction
        )
      );
    }, 2500);
  };

  /** Fired by `InteractionTranscript`'s `onCurrentStatusChange` (for the
   *  active channel) and the LeftNav `ChannelRow` Outcome popover's own
   *  Resolution field (for any channel) — the agent changed a specific
   *  channel's status via the status popover (a plain pick, or confirming
   *  "Close"). Writes it onto that one channel's own entry in
   *  `Interaction.channelStatuses` (see that field's own doc comment
   *  for why status has to be tracked per-channel, and why it has to live
   *  here rather than purely in `InteractionTranscript`'s own state) —
   *  leaving every sibling channel's own status untouched. Read back by
   *  `buildDismissedContactHistoryEntry` when this interaction is later
   *  dismissed, so the logged Contact History row reflects whatever status
   *  was actually last assigned instead of always "Resolved". */
  // Per explicit follow-up request, no longer fires a toast on every status
  // change — the confirming toast (added per an earlier request) turned out
  // to be more noise than signal once every status-pill/Outcome-Resolution
  // trigger for the current channel started funneling through here (see
  // this function's own three real call sites) — a toast firing on nearly
  // every status click read as excessive rather than helpful.
  // A card's status goes through `setCaseStatus` (useContactCommands,
  // P0.5b.2) and comes back as an event — scripted cases too since P0.5c.
  const contactCommands = useContactCommands({ cards: interactions });
  /** The outcome a channel's wrap-up completes with: its Outcome draft
   *  (tags, disposition, summary notes; row 19). */
  const outcomeFor = (cardId: string) => (threadKey: string) => outcomeDrafts.outcomeOf(outcomeDraftKeyOf(cardId, threadKey));
  const handleInteractionStatusChange = (interactionId: string, channelId: string, status: string) => {
    // Live "Assignments resolved today" count — increments only on the actual
    // whatever→Resolved transition, not on re-selecting Resolved.
    const current = interactions.find((i) => i.id === interactionId)?.threadStatuses?.[channelId];
    if (status === "Resolved" && current !== "Resolved") setResolvedTodayCount((n) => n + 1);
    contactCommands.setStatus(interactionId, channelId, status);
  };
  const caseStatusCapable = useCapability((c) => c.interaction.caseStatus);
  /** Outcome's Save & Dismiss for one channel, from the nav row or the
   *  inline wrap-up card (P0.5d.1): closes only that channel's contact, so
   *  a card with other channels stays. When it's the card's only channel,
   *  it's the whole-card dismiss, which also logs Contact History. */
  const handleOutcomeSaveAndDismissChannel = (interaction: Interaction, c: Interaction["threads"][number]) => {
    setOutcomeDraftKey(null);
    if (interaction.threads.length <= 1) handleDismissInteraction(interaction.id);
    else handleDismissChannel(interaction.id, c);
  };
  /** One channel's Outcome config: the nav row's popover ("popover": open
   *  while the store names this channel, shown by the row that claimed it,
   *  `useOutcomeClaims` in `InteractionNavCard`) or the inline voice wrap-up
   *  card ("inline", always open). Both edit the channel's own draft
   *  (`outcomeDrafts`). */
  const outcomeConfigFor = (
    interaction: Interaction,
    c: Interaction["threads"][number],
    surface: "popover" | "inline"
  ): ChannelOutcomeConfig => {
    const outcomeKey = outcomeDraftKeyOf(interaction.id, c.id ?? c.type);
    const draft = outcomeDrafts.draftFor(outcomeKey);
    const edit = (change: (d: OutcomeDraft) => OutcomeDraft) => outcomeDrafts.update(outcomeKey, change);
    return {
      open: surface === "inline" || outcomeDraftKey === outcomeKey,
      onOpenChange: (open: boolean) => {
        if (surface === "popover") handleOutcomeOpenChange(outcomeKey, open);
      },
      // Same options list AND same underlying value as the session-status
      // pill's own dropdown (rule #29), so changing status from either
      // surface changes it in both, without touching any sibling channel's
      // status. Fallback is "Open": a channel with no status yet is fresh.
      resolutionOptions: TRANSCRIPT_SESSION_STATUS_OPTIONS,
      resolution: interaction.threadStatuses?.[c.id] ?? "Open",
      onResolutionChange: (value: string) => handleInteractionStatusChange(interaction.id, c.id, value),
      // Voice has no Open/Pending/Resolved/Closed disposition to log, so
      // the Status field is hidden for voice — and for a provider that
      // doesn't store case status (hide, don't disable).
      voice: c.type === "voice" || !caseStatusCapable,
      tagOptions: OUTCOME_TAG_OPTIONS,
      selectedTags: draft.tags,
      onTagsChange: (tags: string[]) => edit((d) => ({ ...d, tags })),
      dispositionOptions: OUTCOME_DISPOSITION_OPTIONS,
      dispositionCode: draft.dispositionCode,
      onDispositionChange: (value: string) => edit((d) => ({ ...d, dispositionCode: value })),
      summary: draft.summary,
      onSummaryChange: (value: string) => edit((d) => ({ ...d, summary: value })),
      onSave: handleOutcomeSave,
      onCancel: handleOutcomeCancel,
      // Once the call has ended the footer becomes Save & Redial / Save &
      // Dismiss (outcome-panel.tsx). `anchorEl` is the Outcome trigger's own
      // node (or the wrap-up card), so the Redial pad opens right there.
      // A live digital thread's footer is Save & Dismiss too (k6 9): outcoming it dismisses it, in every mode.
      callEnded: c.type !== "voice" || !!(interaction.closed || interaction.voiceCallEnded),
      // Outbound Calling → Save and Redial (off, or voice off, leaves Save & Dismiss); a digital thread never redials.
      showSaveAndRedial: c.type === "voice" && calling.saveAndRedial,
      onSaveAndRedial: (anchorEl) =>
        handleOutcomeSaveAndRedial(
          interaction.id,
          c.value ?? c.addressLabel ?? synthesizeChannelAddress("voice", interaction.customerId ?? interaction.id, interaction.customerName),
          anchorEl
        ),
      onSaveAndDismiss: () => confirmDismiss(() => handleOutcomeSaveAndDismissChannel(interaction, c)),
    };
  };
  const incomingOffer = useIncomingOffer({
    findOpenCard,
    activateWhenReady,
    // Names the caller, and logs the declined call in Contact History.
    onDeclined: (offer) => {
      addToast({ variant: "info", ...declinedOfferToast(callerOfCard(offer), offer.threads[0]?.type), duration: 4000 });
      const entry = buildDismissedContactHistoryEntry(offer, clock.now());
      setDismissedContactHistory((prev) => [
        { ...entry, statusLabel: "Declined", statusVariant: "critical", dispositionLabel: "Declined" },
        ...prev.filter((e) => e.caseId !== entry.caseId),
      ]);
    },
  });
  // The bar's call: Hold/Mute/Record/Mask/Keypad on the provider.
  const liveVoiceCallControls = useVoiceCallControls(liveVoiceCallThread);
  /** The nav row's hold chip (P0.5d.1): resumes a held call (the provider
   *  holds the live one, and the card is selected so the bar and main column
   *  land on it) or holds the live call. */
  const handleCallHoldChip = (card: Interaction, thread: Interaction["threads"][number]) => {
    const resume = !!thread.heldByAgent;
    contactCommands.setHold(thread, !resume);
    if (resume && card.id !== activeInteractionId) switchActiveInteraction(card.id);
  };

  /* ── Preventing duplicate channels from the CreateNew picker ──
     A contact already reachable via a currently-open channel (e.g. Jamie
     Torres has an SMS interaction open on a specific number) still shows
     that channel in "Select Channel" and every address in the detail
     screen's second field ("Select Phone" for voice, SMS and WhatsApp, or
     "Select Email Address") — except whichever exact address(es) are
     already in use, which are disabled so starting another interaction on one of them
     wouldn't just duplicate the one already running (a different outbound
     line for the same channel — or a second, still-unused one, even when
     one SMS number is already open — stays selectable). Voice is the one
     exception to "disable by address, not by channel" — see
     `openChannelTypes`/`isChannelBlockedForContact`'s own doc comments
     (create-new.tsx) for why a call has no per-address concept to key off
     of at all.
     `CreateNewOutboundContact.openChannelAddresses`/`openChannelTypes` are
     exactly the mechanisms `CreateNew` exposes for this (see each one's own
     doc comment), so rather than adding new disabling logic to that shared
     component, this derives a per-render copy of OUTBOUND_CONFIG that tags
     each contact with every address in use (`openChannelAddresses`) AND
     every channel *type* currently open regardless of address
     (`openChannelTypes`) for whichever channels they already have open in
     `interactions` (read off each `Thread.type`/`.value`, set at
     start-call time — a contact can have more than one channel of the same
     type open at once, e.g. two SMS threads on different numbers, so
     addresses are a list per channel type, not a single value), across
     every group (Agents/Teams/Skills/Customers — Favorites is derived from
     these same records, so it inherits the tagging automatically).
     Recomputed whenever `interactions` changes so an address/channel
     re-enables the moment its interaction is dismissed. */
  const presenceChannelReasons = useChannelDisabledReasons();
  const outboundConfig = useMemo<CreateNewOutboundConfig>(() => {
    // Settings → Channels hides what's off; presence disables voice, with its reason (New Outbound and the "+").
    const tagChannels = buildOpenChannelTagger(interactions, storeContacts);
    // A channel open on every one of the customer's addresses is disabled here too (k6 2; no tooltip in lyra's CreateNew).
    const tagOpenChannels = (contact: CreateNewOutboundContact) =>
      markAlreadyOpen(withEnabledChannels(tagChannels(contact), channelSettings), alreadyOpenReasons(CREATE_NEW_CUSTOMERS.find((c) => c.id === contact.id), liveAddressesFor(storeContacts, contact.id)), OUTBOUND_CONFIG.phoneOptions);
    // Skills come from the provider (`listOutboundSkills`, P0.5b.2); the
    // static list only fills in until they load.
    const providerSkills = allOutboundSkills();
    return {
      ...OUTBOUND_CONFIG,
      channelOptions: enabledChannelOptions(OUTBOUND_CONFIG.channelOptions, channelSettings),
      channelDisabledReasons: presenceChannelReasons,
      // A typed address is an ad-hoc dial (Outbound Calling → Ad-hoc); lyra narrows these to the channel options above.
      adHocChannels: calling.adHoc ? OUTBOUND_CONFIG.adHocChannels : { phone: [], email: [] },
      skillOptions: providerSkills.length > 0 ? providerSkills : OUTBOUND_CONFIG.skillOptions,
      groups: OUTBOUND_CONFIG.groups.map((group) => {
        // Teams' own "Choose team" sub-picker — per explicit request,
        // picking a team here swaps this group's `contacts` from the
        // (now-unused-as-a-list) team records over to that team's real
        // member agents (`OUTBOUND_TEAM_MEMBERS`), so the existing search
        // box then filters those members exactly like it already does for
        // every other group — `contactMatchesSearch`/`activeGroupContacts`
        // (create-new.tsx) need no changes for this. With no team picked
        // yet, `contacts` is empty and `emptyMessage` prompts the agent to
        // pick one above instead of showing "No favorited teams yet",
        // which would be misleading before any team is even chosen.
        if (group.id === "teams") {
          const members = selectedOutboundTeamId ? OUTBOUND_TEAM_MEMBERS[selectedOutboundTeamId] ?? [] : [];
          return {
            ...group,
            contacts: members.map(tagOpenChannels),
            emptyMessage: selectedOutboundTeamId
              ? "No favorited agents in this team yet"
              : "Choose a team above to see its agents",
            subFilter: {
              ariaLabel: "Choose team",
              placeholder: "Choose a team",
              value: selectedOutboundTeamId,
              options: OUTBOUND_TEAMS.map((team) => ({ value: team.id, label: team.name })),
              onChange: setSelectedOutboundTeamId,
            },
          };
        }
        if (!group.contacts) return group;
        return {
          ...group,
          contacts: group.contacts.map(tagOpenChannels),
        };
      }),
    };
  }, [interactions, storeContacts, selectedOutboundTeamId, allOutboundSkills, channelSettings, calling.adHoc, presenceChannelReasons]);

  // `CONTACT_HISTORY_OUTBOUND_CONTACTS` (the 5 hand-authored rows) PLUS a
  // live-rebuilt contact for every row in `dismissedContactHistory` (see
  // `buildContactHistoryOutboundContacts`'s own doc comment for why the
  // latter needs the exact same treatment — a freshly dismissed interaction
  // logs its own brand-new `ContactHistoryEntry` with a fresh id, so it hits
  // the identical "nothing registered under this synthetic id" gap the 5
  // original rows had), all run through the exact same `buildOpenChannelTagger`
  // as every group inside `outboundConfig` above — see that function's own
  // doc comment for why these can't just be folded into `outboundConfig.groups`
  // directly. Recomputed off `interactions`/`dismissedContactHistory` so a
  // reopened/redialed Contact History card's already-open channels disable
  // themselves the same way a real customer's would, re-enable the moment
  // that interaction is dismissed, and a newly-dismissed customer's own
  // card gets a working "+" (Add Channel) row the very next time it's
  // reopened, not just the 5 rows that happened to be hand-authored ahead
  // of time.
  const contactHistoryOutboundContacts = useMemo(
    () =>
      [...CONTACT_HISTORY_OUTBOUND_CONTACTS, ...buildContactHistoryOutboundContacts(dismissedContactHistory)].map(
        buildOpenChannelTagger(interactions, storeContacts)
      ),
    [interactions, storeContacts, dismissedContactHistory]
  );

  // Every "Agent Next Gen" consumer (this app, AgentNextGenTemplate.
  // stories.tsx, LeftNav.stories.tsx's "Agent Next Gen Left Nav" story,
  // InteractionNavItem.stories.tsx) wants the exact same "+" behavior on
  // each InteractionNavItem card — look up that interaction's underlying
  // outbound contact and scope the flyout to whatever channels it actually
  // supports. That's `useAddChannelButton` (lyra-ui) — a single shared
  // implementation instead of hand-copied ones that could (and did) quietly
  // drift out of sync.
  //
  // No more `launchRequest`/`onLaunchRequestHandled` here — `AddChannelButton`
  // is fully self-contained now (per explicit request: adding a channel from
  // an already-open interaction's own "+" was popping the detail form up
  // next to the LeftNav's separate "New Outbound" trigger instead of right
  // where the "+" was clicked). The picked channel's whole detail form
  // (Select Channel/Select Address/Outbound Skill/Start Interaction) now
  // renders in that same small popover, and `onStartCall` fires directly —
  // no hand-off to the LeftNav's own `CreateNew` instance for this flow.
  //
  // `onStartCall: handleStartCall` override is required here, same as the
  // LeftNav's own `<CreateNew outbound={{...outboundConfig, onStartCall:
  // handleStartCall, ...}}>` wiring below — `outboundConfig` itself still
  // carries `OUTBOUND_CONFIG`'s placeholder `onStartCall` (just a
  // console.log, see its own definition), not the real handler. Passing
  // the bare `outboundConfig` here was a real, shipped bug: pressing
  // "Start Interaction" from this button silently logged instead of
  // actually opening a card, since `useAddChannelButton`'s `getHeaderAction`
  // calls `outboundConfig.onStartCall?.(selection)` directly (create-new.tsx).
  //
  // `groups` gets one extra entry here, ON TOP OF `outboundConfig.groups` —
  // `contactHistoryOutboundContacts` (tagged copy of
  // `CONTACT_HISTORY_OUTBOUND_CONTACTS`, agent-next-gen-outbound-data.tsx,
  // computed above), keyed under the exact synthetic `history:${id}`/
  // `redial:${id}` ids `handleReopenContactHistoryEntry`/`handleRedial` fall
  // back to for the 5 hand-authored `CONTACT_HISTORY` rows with no real
  // `CREATE_NEW_CUSTOMERS` record behind them. Per explicit request:
  // reopening/redialing one of those rows used to leave the record header's
  // own "+" (Add Channel) row completely empty — `useAddChannelButton`'s
  // `contactsById` had nothing to find under either synthetic id, so
  // `getAvailableChannels` always came back `[]` even for a customer with
  // other channels genuinely on file (`ContactHistoryEntry.channels`).
  // Deliberately appended ONLY here, not folded into `outboundConfig`
  // itself — `outboundConfig` is the exact same object the LeftNav's own
  // `<CreateNew outbound={{...outboundConfig, ...}}>` picker below reads for
  // its "Choose group" dropdown AND its typed-search results
  // (`hideContactList` only suppresses the idle browse list, not a real
  // search match — see that prop's own doc comment, create-new.tsx), so
  // adding it there would make these fictional, non-real "customers"
  // wrongly searchable/dialable from New Outbound. This hook's own
  // `contactsById`, by contrast, is never rendered as a browsable/searchable
  // list anywhere — it only ever resolves ONE already-known interaction id
  // at a time (`getAvailableChannels(activeInteraction.id)`/
  // `getHeaderAction(interaction.id)`), so there's nothing for this extra
  // group to leak into. Per explicit follow-up request, this group's own
  // contacts still need the exact same already-open-channel disabling as
  // every other group gets — that's why `contactHistoryOutboundContacts`
  // (run through `buildOpenChannelTagger`, same as `outboundConfig`'s own
  // groups above) is used here instead of the raw, untagged
  // `CONTACT_HISTORY_OUTBOUND_CONTACTS` constant.
  // The card "+" picker: lyra's AddChannelButton per card, with "Already open" and the customer's own numbers (k6 2).
  const getHeaderAction = useCardAddChannel({
    outboundConfig: {
      ...outboundConfig,
      groups: [...outboundConfig.groups, { id: "contact-history", label: "Contact History", contacts: contactHistoryOutboundContacts }],
      onStartCall: handleStartCall,
    },
    findCustomer: findDirectoryCustomer,
  });
  // A card with no directory entity, once an address was saved for it: the picker over its own addresses (Bug 3).
  // E2: a known card without a directory contact (a scripted case, a created or history customer) gets the
  // picker over its contact methods, the addresses Contact Details shows.
  const getCardAction = useCardOwnAddChannel({ outboundConfig, onAddToCard: outboundDial.addAdHocChannel, contactMethodsOf: cardContactMethodsOf });
  /** A card's "+" (add channel): the nav card's and the record header's, one control (k6 1); its picker is
   *  gated like New Outbound (Settings → Channels, presence, threads already open). None while ringing or closed,
   *  and none with a single channel on (Settings → Channels): there's nothing to add (P-POLISH 2). */
  const addChannelActionFor = (card: Interaction) =>
    SHOW_ADD_CHANNEL_HEADER_BUTTON &&
    enabledChannels.length > 1 &&
    showsSessionControls(card) &&
    navCardAddChannelAction(card, { getHeaderAction, getCardAction, onAddAdHocChannel: outboundDial.addAdHocChannel, skillOptions: OUTBOUND_CONFIG.skillOptions, contacts: storeContacts });

  /* Welcome modal — shown once on page load; "Go Available" flips the agent
     to Available, "Start Offline" (button label — see the AgentWelcomeMessage
     call site's own doc comment for why the label reads "Offline" while this
     handler is still named/keyed "Unavailable") keeps them Unavailable (the
     default state). lyra-ui's `AgentStatus` dropped "offline" (just
     Available/Unavailable now), so this no longer keeps the agent
     "Offline" as a real status — Unavailable is the closest equivalent
     starting state; the button's own label was renamed back to "Start
     Offline" per explicit request, but the underlying status is still
     "unavailable". */
  const handleGoAvailable = () => {
    handleStatusChange("available");
    setShowWelcomeModal(false);
  };
  const handleStartUnavailable = () => {
    handleStatusChange("unavailable");
    setShowWelcomeModal(false);
  };

  // Open/close animation state machine for the single shared panel — mounts
  // on open, transitions through the shared fade/slide animation on close,
  // then unmounts. Previously a generic `usePanelOpenEffect` factory called
  // once per panel (five times); with only one physical container now,
  // there's only one caller, so it's inlined rather than kept as a
  // factory-of-one.
  useEffect(() => {
    clearTimeout(panelAnimTimer.current);
    if (panelOpen) {
      if (containerRef.current && panelFloatLeft.current === null) {
        const r = containerRef.current.getBoundingClientRect();
        panelFloatLeft.current = r.left + containerRef.current.offsetWidth - panelWidth - 16;
      }
      setPanelHeight(computePanelHeight());
      setPanelMounted(true);
      setPanelState("open");
    } else {
      setPanelState("closing");
      setPanelFullScreen(false);
      panelAnimTimer.current = setTimeout(() => setPanelState("closed"), 150);
    }
    return () => clearTimeout(panelAnimTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  // Shrink panel height with viewport when open
  useEffect(() => {
    if (!panelOpen) return;
    const onResize = () => setPanelHeight(computePanelHeight());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  // Same "outlive the boolean so the exit transition can play" shape as
  // the `panelOpen`/`panelState` effect above, scoped to fullscreen alone
  // — per explicit request for an animation on the fullscreen
  // expand/collapse toggle. Entering: mount immediately (still at the
  // "hidden" style, `fullScreenVisible` starts false) then flip
  // `fullScreenVisible` true one frame later, so the fade/scale-in CSS
  // transition (`sharedPanelFullScreenOverlay`'s own styles, below) has a
  // real prior frame to animate from — see `fullScreenVisible`'s own doc
  // comment for why that two-step is needed. Exiting: flip
  // `fullScreenVisible` false right away (starts the fade/scale-out
  // immediately) and only unmount (`fullScreenRendered` false) 180ms
  // later, once that transition has actually finished playing.
  useEffect(() => {
    if (panelFullScreen) {
      clearTimeout(fullScreenAnimTimer.current);
      setFullScreenRendered(true);
      // Double rAF, not a single one — the classic gotcha here is that a
      // single `requestAnimationFrame` callback can still land in the SAME
      // frame as the commit that mounted the "hidden" style (browsers run
      // due rAF callbacks before that frame's own layout/paint), so the
      // "hidden" style never actually gets painted and there's nothing
      // for the transition to visibly animate from — the element just
      // pops straight to visible instead. Waiting for a second frame
      // guarantees the first one (with `fullScreenVisible` still false)
      // has genuinely been painted before flipping it to true.
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setFullScreenVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setFullScreenVisible(false);
    clearTimeout(fullScreenAnimTimer.current);
    fullScreenAnimTimer.current = setTimeout(() => setFullScreenRendered(false), 180);
    return () => clearTimeout(fullScreenAnimTimer.current);
  }, [panelFullScreen]);

  // When docking: capture actual rendered position (includes CSS transform
  // drag offset) before the float wrapper unmounts — restored when
  // undocking. The old "only one of five may be docked" exclusivity check
  // (`dockPanelExclusively`) is gone — with a single shared container
  // there's only ever one panel to dock in the first place.
  //
  // Width works the other direction: docking (float -> docked) always
  // resets to `SHARED_PANEL_DEFAULT_WIDTH`, full stop — per explicit
  // request, re-docking should land on the panel's true starting width
  // "regardless of how wide they've been dragged." An earlier version of
  // this only reset to whatever width the panel had at the MOMENT it was
  // last undocked (captured in a `panelDockedWidthBeforeUndock` ref) — that
  // covered a resize while floating, but not a resize that happened while
  // DOCKED: `Draggable`'s own `onWidthChange` (wired to `setPanelWidth`
  // below, near `sharedPanel`) fires the same way regardless of variant, so
  // dragging the panel's edge while it's already docked also changes
  // `panelWidth` directly — and that resized value would then get
  // snapshotted as the "restore to" target on the NEXT undock, quietly
  // leaking a docked-resize into a later re-dock. Hardcoding the true
  // default here instead of snapshotting "whatever it was" closes that gap
  // — there's no state left to leak from either direction.
  const handlePanelVariantChange = (v: DraggableVariant) => {
    if (v === "docked") {
      if (panelRef.current) {
        const r = panelRef.current.getBoundingClientRect();
        panelFloatLeft.current = r.left;
        panelFloatTop.current  = r.top;
      }
      setPanelWidth(SHARED_PANEL_DEFAULT_WIDTH);
    }
    setPanelVariant(v);
  };

  // The fullscreen overlay's own "drag mode" toggle (see
  // `sharedPanelFullScreenOverlay` below) — fullscreen bypasses `Draggable`
  // entirely, so it never receives `Draggable`'s own built-in dock button;
  // this is the equivalent action for getting from fullscreen straight into
  // float, at its MAXIMUM size (`SHARED_PANEL_MAX_WIDTH`/`computePanelHeight()`
  // — already "as tall as the viewport allows, capped at `MAX_PANEL_HEIGHT`")
  // rather than resuming whatever size the panel happened to be before
  // entering fullscreen, per explicit request. Safe to just set
  // `panelWidth`/`panelHeight` directly (unlike a live prop update to an
  // already-mounted `Draggable`, which wouldn't actually resize it — see
  // `SHARED_PANEL_MAX_WIDTH`'s own doc comment on `Draggable` never
  // resyncing its internal `width` from `defaultWidth` after mount): the
  // docked/float wrapper blocks below are both gated on `!panelFullScreen`,
  // so `Draggable` is always fully unmounted while fullscreen is active —
  // switching out of it always mounts a FRESH instance, which reads these
  // as its own `defaultWidth`/`defaultHeight` at that fresh mount. Toggling
  // back out of float from here works exactly like any other float panel —
  // `Draggable`'s own built-in dock button re-docks it to the side, same as
  // always (`handlePanelVariantChange`, above), which now always resets to
  // `SHARED_PANEL_DEFAULT_WIDTH` on its own — nothing needs capturing here
  // first, unlike before.
  const handleFullScreenToDragMode = () => {
    setPanelWidth(SHARED_PANEL_MAX_WIDTH);
    setPanelHeight(computePanelHeight());
    setPanelFullScreen(false);
    setPanelVariant("float");
  };

  // Float position — absolute viewport coordinates, anchored via
  // `panelFloatLeft`/`panelFloatTop` once set. No more per-panel z-index
  // "bring to front" competition (`topPanel`) — there's only ever one
  // floating panel now, so it's always topmost.
  const getPanelFloatStyle = (): React.CSSProperties => {
    const rect = containerRef.current?.getBoundingClientRect();
    const left = panelFloatLeft.current !== null
      ? panelFloatLeft.current
      : containerRef.current
        ? (rect?.left ?? 0) + containerRef.current.offsetWidth - panelWidth - 16
        : 0;
    const top = panelFloatTop.current !== null
      ? panelFloatTop.current
      : (rect?.top ?? 0);
    // Below the app-header menus' own `z-[9999]` (the "View All Apps" kebab
    // dropdown, menu-radix.tsx; the app-switcher popover a few hundred
    // lines up) — this used to be `10000`, one higher, so a floated panel
    // rendered ON TOP of either menu instead of under it (confirmed via
    // screenshot: the Customers panel covering the open kebab dropdown).
    // Still comfortably above the rest of the page's own z-index tiers
    // (AppHeader/Draggable's internal chrome top out around `z-20`).
    return { position: "fixed", top, left, zIndex: 40 };
  };

  // ── Content for each button ──
  /* "New Assignment"/"Escalation" notification click — opens (or re-focuses)
     a real assignment card in the LeftNav, same merge-by-id + "expand the
     nav, open the Customer Information panel" pattern `handleQuickDial`/
     `handleRedial` already use. Channel comes from `NOTIFICATION_CHANNEL`
     (falling back to "email" for any id not listed there) — see that map's
     own doc comment for why this stays a small app-local lookup rather
     than a field on `AgentNotification` itself.

     Keyed by a REAL `CREATE_NEW_CUSTOMERS` id — deterministically picked
     from the notification's own id (`Number(notification.id) % ...length`,
     not random, so re-clicking the same notification always resolves to the
     same card) — rather than a synthetic `notif:${id}` one. This is the
     exact same case `handleRedial`'s own doc comment above describes:
     `useAddChannelButton`'s `getHeaderAction` looks up an interaction's id
     in `outboundConfig.groups` to resolve its "+" Add Channel button — a
     synthetic id never matches, so `getHeaderAction` returns no button at
     all for it. Using a real customer id here means notification-opened
     assignments get a working Add Channel button just like any other
     assignment, while still displaying the notification's own name
     (`customerName` below), since the merge branch further down never
     overwrites an existing card's `customerName`. */
  const handleOpenAssignmentFromNotification = (notification: AgentNotification) => {
    // A row an assignment toast logged (P-HOME-1) opens what the toast was about.
    if (late.viewToastNotification?.(notification.id)) return;
    // P0.5b.2: the notification stands for a provider contact
    // (NOTIFICATION_INTERACTION_ID): a waiting offer is accepted, a live one
    // is switched to, a dismissed one is reopened (useContactReopen). The
    // card opens with Customer Information closed (handleContactActivated).
    void contactReopen.openNotification(notification).then((isNewCard) => {
      // A new inbound arrival expands the left nav if it's collapsed (row
      // 21; agent-initiated launches deliberately don't).
      if (isNewCard) setNavOpen(true);
    });
    setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
  };

  // Wired to the Search panel's Interactions tab (`InteractionsListView`'s
  // own `onOpenInteraction`, via `useSearchPanelContent` below) — per
  // explicit request, clicking a row there opens it as a real, active
  // assignment in the left nav, same shape `handleOpenAssignmentFromNotification`
  // just above already builds from a notification click: NOT `startedFresh`
  // (a row in this table represents an already-existing, already-routed
  // conversation with real prior history, not a blank-slate outbound
  // interaction the agent is originating), wholesale-replaces `channels`/
  // clears `liveMessages` when the same contact already has a card open
  // (same reasoning as that handler's own comment on that branch). The
  // matching `CreateNewOutboundContact`/customer record is looked up by
  // `record.caseId`, which `buildInteractionHistory` (this file — actually
  // agent-next-gen-interactions-table.tsx) sets to that customer's own
  // `customerId` in the first place, so this reliably finds the same
  // record every row was built from without a second, parallel id scheme.
  const handleOpenInteractionRow = (record: InteractionHistoryRecord) => {
    // P0.5b.2: a provider `reopen` of the row's case (useContactReopen),
    // joining the customer's open card if there is one.
    void contactReopen.reopenSearchRow(record);
  };

  // Notifications' real content — same `useAgentNotificationsContent`
  // hook `AgentNotifications` calls internally (agent-notifications.tsx
  // in lyra-ui) — so this app gets its actual body, not a reimplemented
  // copy. Called unconditionally every render (Rules of Hooks) regardless
  // of whether that content is the one currently showing.
  const notifContent = useAgentNotificationsContent({
    notifications,
    // Only the ones the bell shows: one hidden by Settings → Channels comes back unread when its channel is on.
    onMarkAllRead: () => {
      const shown = new Set(notifications.map((n) => n.id));
      setNotifications((prev) => prev.map((n) => (shown.has(n.id) ? { ...n, read: true } : n)));
    },
    onClearAll: () => {
      const shown = new Set(notifications.map((n) => n.id));
      setNotifications((prev) => prev.filter((n) => !shown.has(n.id)));
    },
    onDismiss: (id: string) => setNotifications((prev) => prev.filter((n) => n.id !== id)),
    // "New Assignment" (`type: "new-case"`) and "Escalation" notifications
    // both open a real assignment. "New Agent Chat" (`type:
    // "new-agent-chat"`, e.g. Sarah Miller) is different from either —
    // per explicit request, clicking it doesn't open an assignment card at
    // all, it switches the shared header panel straight from Notifications
    // to Agent Chat (the renamed "Conversations" panel — see
    // `PANEL_KEY_METADATA.conversations`), since an agent-to-agent chat
    // lives there, not in the interaction list. The rest (New Chat/Missed
    // Call) keep the original "just mark it read" behavior, since they
    // don't represent anything this app actually models opening.
    onNotificationClick: (n: AgentNotification) => {
      if (n.type === "new-case" || n.type === "escalation") {
        handleOpenAssignmentFromNotification(n);
        return;
      }
      if (n.type === "new-agent-chat") {
        late.handlePanelButtonClick("conversations")();
        setNotifications((prev) => prev.map((i) => i.id === n.id ? { ...i, read: true } : i));
        return;
      }
      setNotifications((prev) => prev.map((i) => i.id === n.id ? { ...i, read: true } : i));
    },
  });
  // Schedule — basic Day/Week calendar shell (lyra-ui schedule-panel, new this
  // session, app-only — not added to lyra-ui). Called unconditionally here
  // (a real hook, own local view/anchorDate state), same as any other
  // panel-content builder in this block.
  const scheduleContent = useScheduleContent();
  // Agent Chat — no bespoke component (same blank empty-state
  // `DraggablePanel` itself defaults to when given no children).
  const blankPanelContent = (title: string): EmbeddablePanelContent => ({
    title,
    body: (
      <div className="overflow-y-auto flex-1 flex items-center justify-center p-4">
        <p className="lyra-body-md text-lyra-fg-disabled text-center">Nothing here yet.</p>
      </div>
    ),
  });
  // Screen Pop — same blank body, plus a Select (which external app to pop
  // the current contact/record into) in `headerContent` (fixed above the
  // divider, alongside the title row) rather than the scrollable body, so
  // it stays put — no `label` since the field sits in the header, not a
  // body form, where a label would be redundant.
  const screenPopContent: EmbeddablePanelContent = {
    title: "Screen Pop",
    headerContent: (
      <Select
        placeholder="Select an app..."
        options={SCREEN_POP_APPS}
        value={screenPopApp}
        onValueChange={setScreenPopApp}
      />
    ),
    // "Salesforce"/"Zendesk" are mocked in place, not actually embedded —
    // see `MockLoginCard`'s own doc comment (near `SCREEN_POP_APPS`) for
    // why a real iframe of either login page isn't possible.
    body:
      screenPopApp === "salesforce" ? (
        <MockLoginCard
          appName="Salesforce"
          accent="#0176d3"
          logo={
            <svg viewBox="0 0 48 30" className="w-24 h-auto mb-4" aria-hidden="true">
              <path
                fill="#00A1E0"
                d="M19.5 6.6c1.5-1.6 3.6-2.6 6-2.6 3.1 0 5.8 1.7 7.3 4.3.9-.4 1.9-.6 3-.6 3.9 0 7.1 3.2 7.1 7.1s-3.2 7.1-7.1 7.1c-.5 0-.9 0-1.4-.1-.9 1.6-2.6 2.7-4.5 2.7-.8 0-1.6-.2-2.3-.5-.9 2.1-3 3.6-5.5 3.6-2.6 0-4.8-1.6-5.7-3.9-.4.1-.8.1-1.2.1-3.3 0-6-2.7-6-6 0-2.2 1.2-4.2 3-5.2-.1-.4-.1-.8-.1-1.2 0-3.6 2.9-6.5 6.5-6.5 1.4 0 2.7.4 3.9 1.2"
              />
            </svg>
          }
        />
      ) : screenPopApp === "zendesk" ? (
        <MockLoginCard
          appName="Zendesk"
          accent="#03363d"
          usernameLabel="Email"
          usernamePlaceholder="you@company.com"
          buttonLabel="Sign in"
          footerLink="Forgot my password"
          logo={
            <div className="flex flex-col items-center gap-2 mb-5">
              <svg viewBox="0 0 40 40" className="w-10 h-10" aria-hidden="true">
                <rect x="4" y="4" width="14" height="14" rx="3" fill="#03363D" />
                <circle cx="29" cy="11" r="7" fill="#03363D" />
                <rect x="4" y="22" width="14" height="14" rx="7" fill="#03363D" />
                <rect x="22" y="22" width="14" height="14" rx="3" fill="#03363D" />
              </svg>
              <span className="text-lg font-bold text-[#03363D] tracking-tight lowercase">Zendesk</span>
            </div>
          }
        />
      ) : (
        <div className="overflow-y-auto flex-1 flex items-center justify-center p-4">
          <p className="lyra-body-md text-lyra-fg-disabled text-center">Nothing here yet.</p>
        </div>
      ),
  };

  return {
    ...prev,
    handleSendMessage, handleSendEmailDraft, contactCommands, outcomeFor, handleInteractionStatusChange, caseStatusCapable,
    handleOutcomeSaveAndDismissChannel, outcomeConfigFor, incomingOffer, liveVoiceCallControls, handleCallHoldChip,
    presenceChannelReasons, outboundConfig, contactHistoryOutboundContacts, getHeaderAction, getCardAction,
    addChannelActionFor, handleGoAvailable, handleStartUnavailable, handlePanelVariantChange,
    handleFullScreenToDragMode, getPanelFloatStyle, handleOpenAssignmentFromNotification, handleOpenInteractionRow,
    notifContent, scheduleContent, blankPanelContent, screenPopContent,
  };
}

export type WsOutbound = ReturnType<typeof useWsOutbound>;
