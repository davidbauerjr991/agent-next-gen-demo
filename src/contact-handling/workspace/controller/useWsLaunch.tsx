// Workspace controller, slice 4 of 6 (P-EXTRACT C8b): header sizing and
// presence sync, launching and activating contacts (New Outbound, the
// shared outbound dial, reopen, auto-accept), the "View customer info" and
// Session Details content, redial, dismissing a card or a thread, picking
// a thread, and Marcus's card callbacks. The page's body, moved in order
// (hook order unchanged); see `useWorkspaceController`.
import { useState, useEffect, useRef } from "react";
import type { AgentStatus, ChannelType, CreateNewOutboundContact, InteractionChannel } from "@nicecxone/lyra-ui";
import { OUTBOUND_AGENTS } from "@/components/agent-next-gen-outbound-data";
import { type ContactHistoryEntry, buildDismissedContactHistoryEntry } from "@/components/agent-next-gen-contact-history";
import { saveCaseRecord } from "@/components/agent-next-gen-case-database";
import {
  callerOfInteraction,
  alreadyOnCallMessage,
  outcomeDraftKey as outcomeDraftKeyOf,
  useContactActivation,
  useContactReopen,
  useOutboundDial,
  useOutboundSkills,
  useChannelSync,
  omnichannelMainKey,
  routeChannel,
  useAutoAcceptDigital,
  useFollowHeldCall,
  useSaveAddressOffers,
  type Activation,
} from "@/contact-handling";
import { AGENT_WORKSPACE_CUSTOMER_PANEL_TABS, useCustomerDetailsInteriorPanel, useSessionDetailsTabContent } from "@/components/customer-info";
import { cardContactMethods } from "@/contact-handling/card-contact-methods";
import { SCENARIOS } from "@/scenarios";
import type { Interaction } from "@/components/agent-next-gen-interaction-dashboard";
import { usePresenceSync } from "@/contact-handling/usePresenceSync";
import { useThreadCurrentSession } from "@/contact-handling/useThreadCurrentSession";
import { isThreadOnScreen, resolveContactDetailsView, type ContactDetailsTabContext } from "@/contact-handling/contact-details-tabs";
import { transcriptToggleApplies, useTranscriptHidden } from "@/contact-handling/transcript-visibility";
import { useSettings } from "@/settings";
import type { WorkspaceLate } from "./workspace-late";
import type { WsPanels } from "./useWsPanels";

/** Contact Details' tabs that are the customer record's own bodies, and the record panel's tab each shows. */
const CUSTOMER_RECORD_TAB = { "Customer Information": "Overview", Notes: "Notes", Detail: "Detail" } as const;

export function useWsLaunch(prev: WsPanels, late: WorkspaceLate) {
  const {
    LUCAS_THOMAS_PHONE, activeChannel, activeChannelKey, activeChannelStatus, activeCustomerOverviewEditing,
    activeCustomerRecordDraft, activeInteraction, activeInteractionId, addToast, agentStatus, cardIdentityOf, channelPreviewThread,
    channelPreviewThreadKey, clock, containerRef, customerTable, dismissInteractionRef,
    enabledChannels, findDirectoryCustomer, findOpenCard, fireDismissToast, interactions, isNavNarrow, launchLucasCall, lucasCallConfirmRef,
    mainPins, navOpen, omni, omnichannel, outcomeDrafts, panelOpen, panelPlacement, placement,
    scenarioKeyOf, seedOverlay, sessionDetailsPick, setActiveCustomerOverviewEditing, setAgentLegDisconnectedToastOpen,
    setAgentStatus, setDismissedContactHistory, setHistoryConversationTab, setInteractions,
    setNavOpen, setSelectedContactHistoryEntry, setSidePanelOpen, setStatusSinceTick,
    sidePanelStateByAssignmentId, switchActiveInteraction, windowWidth, customerPanelActiveTab, aiInPanel,
    activeInteractionIsRealCustomer, activeChannelType, isHistoryConversationView, panelVoiceThread, contactSubject,
  } = prev;
  // A call's "Hide Transcript" (P-CANVAS; AI display inline, voice), per card.
  const [{ displayLocation }] = useSettings("ai");
  const transcriptToggleShown = transcriptToggleApplies(displayLocation, activeChannelType);
  const [transcriptHidden, setTranscriptHidden] = useTranscriptHidden(activeInteraction?.id, transcriptToggleShown);
  // What Contact Details shows: the tab state resolved for this card and AI display (P-CANVAS). The Transcript tab
  // only when the thread isn't already on screen (`isThreadOnScreen`).
  const contactDetailsTabContext: ContactDetailsTabContext = {
    aiInPanel,
    realCustomer: activeInteractionIsRealCustomer,
    // A kind cell's subject (a schedule item's customer) has no thread: its record's tabs alone.
    hasThread: contactSubject?.hasThread ?? true,
    threadOnScreen: isThreadOnScreen({
      aiInPanel,
      live: !!activeInteraction && !activeInteraction.closed && !isHistoryConversationView,
      transcriptHidden,
      callOffScreen: !!panelVoiceThread,
    }),
  };
  const contactDetailsView = resolveContactDetailsView(customerPanelActiveTab, contactDetailsTabContext);
  const isCompactHeader = windowWidth < 760;

  // Auto-collapse the expanded nav when the container drops below 768px
  useEffect(() => {
    if (isNavNarrow && navOpen) setNavOpen(false);
  }, [isNavNarrow]); // eslint-disable-line react-hooks/exhaustive-deps

  // Below 768px, a DOCKED panel no longer forces itself to float+closed —
  // it now combines with the main container into a single container with
  // two tabs instead (see `isCombinedPanelMode` below, computed once
  // `activePanelContent` exists further down). Floating panels are
  // untouched by this breakpoint; they still float exactly as before.
  // `narrowActiveRegion` is which of those two tabs is currently showing —
  // reset back to "main" whenever the combined layout isn't actually in
  // play (wide viewport, or nothing open), so it can't be left stuck on
  // "panel" from a previous narrow session with nothing to show for it.
  const [narrowActiveRegion, setNarrowActiveRegion] = useState<"main" | "panel">("main");
  useEffect(() => {
    if (!isNavNarrow || !panelOpen) setNarrowActiveRegion("main");
  }, [isNavNarrow, panelOpen]);

  const MAX_PANEL_HEIGHT = 860;
  const BOTTOM_PADDING   = 8;
  // Matches `Draggable`'s own default `maxWidth` (draggable.tsx) — made
  // explicit here (and passed as an explicit prop below) rather than left
  // as an implicit default, since `handleFullScreenToDragMode` below also
  // needs this exact value to size the panel at its true maximum.
  const SHARED_PANEL_MAX_WIDTH = 1024;

  const computePanelHeight = () => {
    if (!containerRef.current) return MAX_PANEL_HEIGHT;
    const top = containerRef.current.getBoundingClientRect().top;
    return Math.min(window.innerHeight - top - BOTTOM_PADDING, MAX_PANEL_HEIGHT);
  };

  const handleStatusChange = (status: AgentStatus) => {
    setAgentStatus(status);
    setStatusSinceTick(clock.now());
  };
  // Routing reads the provider's presence: every status change goes there
  // (the auto-"Working" one included), so a scripted case isn't offered
  // during Lunch.
  usePresenceSync(agentStatus);
  // Routing offers contacts only on the channels that are on.
  useChannelSync(enabledChannels);

  // Auto "Working" status while on a live voice call, per explicit request
  // ("when an agent is in a call the status should change to 'working'").
  // `"working"` (lyra-ui's `AgentStatus`, agent-profile.tsx) is deliberately
  // NOT in that component's own `allStatuses` picker list — an agent never
  // selects it by hand, only this effect ever sets it, exactly the way the
  // request specified ("do not add this as a selectable status").
  // `isOnVoiceCall` — true whenever ANY still-open (`!closed`) interaction
  // has a voice `Thread` whose own `threadStatuses` entry isn't `"Closed"`
  // — not just the interaction currently being VIEWED, so switching over to
  // check on a different customer's chat mid-call doesn't incorrectly clear
  // "Working" the instant the voice call scrolls out of view.
  // `preCallStatusRef` remembers whatever status was active the moment the
  // call started, so hanging up restores it (Available/Unavailable/a
  // specific reason code) instead of always falling back to one hardcoded
  // default — same "restore what was there before" pattern
  // `connectAgentLegSignal`'s own effect (agent-profile.tsx) already uses
  // for a comparable "external signal drives an internal transition"
  // shape. Deliberately keyed only on `isOnVoiceCall` (not `agentStatus`
  // too) — this is an edge-triggered effect reacting to the call actually
  // starting/ending, not something that should re-fire just because
  // `agentStatus` itself changed for some unrelated reason.
  // `!i.voiceCallEnded` (was `i.threadStatuses?.[t.id] !== "Closed"`) — per
  // explicit request, hanging up no longer sets the voice channel's status
  // to "Closed" at all (see `Interaction.voiceCallEnded`'s own doc comment,
  // agent-next-gen-interaction-dashboard.tsx), so the old status check
  // would otherwise have kept reading as "still on a call" forever after
  // hanging up, never letting the agent's auto-"Working" status revert.
  const isOnVoiceCall = interactions.some(
    (i) => !i.closed && !i.voiceCallEnded && !i.offered && i.threads.some((t) => t.type === "voice")
  );
  const preCallStatusRef = useRef<AgentStatus | null>(null);
  useEffect(() => {
    if (isOnVoiceCall) {
      if (agentStatus !== "working") {
        preCallStatusRef.current = agentStatus;
        setAgentStatus("working");
        setStatusSinceTick(clock.now());
      }
    } else if (agentStatus === "working") {
      setAgentStatus(preCallStatusRef.current ?? "unavailable");
      preCallStatusRef.current = null;
      setStatusSinceTick(clock.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnVoiceCall]);

  /* ── Launching interactions from CreateNew ──
     Overrides OUTBOUND_CONFIG's default onStartCall/onQuickDial (which just
     console.log) so this page actually surfaces what gets launched as
     InteractionNavItem cards in the left nav. Used to also force the nav
     open (`setNavOpen(true)`) whenever a new assignment launched — dropped
     per explicit request: starting/reopening an assignment no longer
     expands a collapsed rail on its own. */
  const handleStartCall = (selection: {
    contact: CreateNewOutboundContact;
    channel: ChannelType;
    phone: string;
    skillId: string;
  }) => {
    // Per explicit request: picking "Chat" for an agent contact doesn't
    // start a normal interaction at all — it just opens the existing
    // "Agent Chat" docked panel, exactly like the "New Agent Chat"
    // notification's own `onNotificationClick` handler already does
    // elsewhere in this file (no interaction/card side effects, generic —
    // not wired to which agent was picked, confirmed via follow-up
    // clarification). `OUTBOUND_AGENTS` is the only group whose contacts
    // ever carry `"chat"` among their own `channels`, so this can only ever
    // fire for a real agent pick. Voice for an agent falls through to the
    // normal flow below unchanged — see `activeInteractionIsAgentCall`
    // further up this component for how that resulting interaction then
    // hides Customer Information + the status Select.
    if (selection.channel === "chat" && OUTBOUND_AGENTS.some((a: CreateNewOutboundContact) => a.id === selection.contact.id)) {
      late.handlePanelButtonClick("conversations")();
      return;
    }
    // P0.5b.2: placed through the provider (useOutboundDial). A new contact
    // gets its own card; one with a card open joins its journey, and the new
    // channel opens in the docked channel preview (handleContactActivated) —
    // the main column stays on the active contact.
    outboundDial.startCall(selection);
    // Closes `CustomerRowInfoPanel` (the Customers table's row flyout, which
    // the persistent Search panel can leave open over the new interaction).
    customerTable.setSelectedRow(null);
  };

  // Where a launched contact lands once the provider has it (P0.5b.2,
  // useContactActivation): a newly launched or accepted thread is the visible
  // one (k8 4). "focus" (a new card, a redial, a reopen, a notification) and
  // "added" (a channel added to an open card) make its card active; "select"
  // keeps the selected card. With tabs the thread's tab is selected; under
  // "main" the panel switches to it, a call's transcript included (the voice
  // bar appears as always).
  const handleContactActivated = ({ journeyId, threadKey, mode, isNewCard }: Activation) => {
    const selectThread = () => setInteractions((prev) => prev.map((i) => (i.id === journeyId && i.currentThreadId !== threadKey ? { ...i, currentThreadId: threadKey } : i)));
    // A restarted call starts with an empty Outcome (row 19).
    if (threadKey.startsWith("voice")) outcomeDrafts.clear(outcomeDraftKeyOf(journeyId, threadKey));
    if (mode === "select") return omnichannel ? omni.open(journeyId, threadKey) : selectThread();
    switchActiveInteraction(journeyId);
    if (omnichannel) omni.open(journeyId, threadKey);
    else selectThread();
    // A new card starts with Customer Information closed; an existing one
    // keeps the panel as the agent left it.
    if (isNewCard) setSidePanelOpen(false);
  };
  const { activateWhenReady } = useContactActivation(handleContactActivated, seedOverlay);
  const { allOptions: allOutboundSkills, idForName: skillIdForName } = useOutboundSkills();
  /** A card's contact methods (E2): what Contact Details shows for it, plus added addresses; the "+" picker
   *  and the save-address offer both read it. */
  const cardContactMethodsOf = (card: Interaction) => {
    const known = !!(card.identity ?? cardIdentityOf(card));
    const record = card.entityId ? findDirectoryCustomer(card.entityId) : undefined;
    const key = scenarioKeyOf(card.id);
    const scenarioPhone = key ? SCENARIOS.find((s) => s.id === key || s.entity.key === key)?.entity.phone : undefined;
    return { known, methods: cardContactMethods(card, { record, known, scenarioPhone }) };
  };
  // A launch on an address that isn't among a known card's contact methods offers to save it (k8 8, E2).
  const offerToSaveAddress = useSaveAddressOffers({ cards: interactions, setCards: setInteractions, contactMethodsOf: cardContactMethodsOf });
  const outboundDial = useOutboundDial({
    findOpenCard,
    findCustomer: findDirectoryCustomer,
    activateWhenReady,
    onLegDisconnected: () => setAgentLegDisconnectedToastOpen(true),
    // A redial from the Home tab's Contact History panel closes that panel,
    // so it isn't still open when the agent goes back.
    onRedial: () => setSelectedContactHistoryEntry(null),
    // A second voice call during a call is allowed, as on Desk: the provider
    // holds the first when the second connects (parity row 15, revised
    // 2026-10-14 for the demo).
    secondVoiceCall: "auto-hold",
    // A typed Quick Dial number of a customer the agent is already on a
    // call with (the buttons elsewhere are disabled instead).
    // Names whom: the call's card name, else its presented name or number.
    onAlreadyOnCall: (call) => {
      const caller = callerOfInteraction(call, interactions);
      addToast({ variant: "warning", title: alreadyOnCallMessage(caller.name ?? caller.number), duration: 4000 });
    },
    // Save & Redial: the ended call's wrap-up completes with its saved
    // outcome once the new call is placed, so the card never empties.
    onCardRedialPlaced: (card) => void late.contactCommands.completeEndedCalls(card, late.outcomeFor(card.id)),
    onPlaced: offerToSaveAddress,
  });
  // A live call ends while another is held: its card is selected, the call still held (k8 9).
  useFollowHeldCall(switchActiveInteraction);
  const contactReopen = useContactReopen({ findOpenCard, activateWhenReady, skillIdForName });
  // A digital contact auto-accepted onto an open card: the card's main thread
  // holds (omnichannel) and, on the card the agent is on, the new contact
  // activates "added" — the docked preview or the panel opens with it.
  useAutoAcceptDigital(findOpenCard, {
    onJoin: (cardId) => {
      const card = interactions.find((i) => i.id === cardId);
      const current = card?.currentThreadId ?? card?.threads[card.threads.length - 1]?.id;
      // Omnichannel holds the main thread; with tabs the accepted thread selects its tab (onJoined → "added").
      if (!card || !current || panelPlacement || !omnichannel) return;
      mainPins.pin(cardId, omnichannelMainKey(card.threads, current, mainPins.pinned(cardId)) ?? current);
    },
    // An accepted thread is the visible one on its card (k8 4, superseding k2's async exception): its tab,
    // or the panel's thread under "main"; on another card it waits there, and the selected card stays.
    onJoined: (cardId, id) => activateWhenReady(id, cardId === activeInteractionId ? "added" : "select", false),
  });

  // Per explicit follow-up request ("the content should be the Contact
  // Info stuff (Overview, Details, Notes)"): the "View customer info"
  // overlay (`customerInfoOverlayOpen`, its own render site further down)
  // shows this SAME tabbed Overview/Detail/Notes content
  // `CustomerInformationSidePanel` itself renders — not the
  // `DetailsPanelAccordions` peek the docked "Session Details" panel's own
  // "Details" tab shows — via the same `useCustomerDetailsInteriorPanel`
  // hook AgentNextGenPage.tsx already uses for its own equivalent
  // "Details" `InteriorPanel`. Shares the same lifted
  // `activeCustomerRecordDraft`/`activeCustomerOverviewEditing` as the
  // docked panel (and the record-header hover preview) so an edit made in
  // any of them shows up consistently in the others. Called
  // unconditionally, same as `activeCustomerRecordDraft` itself — its
  // returned pieces are only actually read at the docked
  // `CustomerInformationSidePanel`'s own render site while
  // `customerPanelActiveTab === "Customer Info"` (see that render site's
  // own `headerTitleOverride`/`headerIconOverride`/`headerSubheadOverride`/
  // `headerTabsOverride`/`footerOverride`/`bodyOverride`). No `matchState`
  // passed: "View customer info" only ever renders (and so can only ever
  // open this) for a real-customer interaction
  // (`activeInteractionIsRealCustomer` gates the link itself, at every
  // call site) — the unknown-contact search/create flow can never reach
  // this drill-in, so there's nothing for it to branch on here. `tabs` is
  // likewise the plain full set, not the real-customer-conditional
  // ternary the docked panel's own `tabs` prop needs, for the same
  // reason. This drill-in always opens on its default "Overview" tab.
  // Contact Details' subject: the conversation's customer, or a kind cell's (P-HOME-1m).
  const customerInfoOverlayContent = useCustomerDetailsInteriorPanel({
    customerName: contactSubject?.customerName,
    recordId: contactSubject?.customerId ?? "",
    channels: contactSubject?.threads ?? [],
    tabs: AGENT_WORKSPACE_CUSTOMER_PANEL_TABS,
    recordDraft: activeCustomerRecordDraft,
    overviewEditing: activeCustomerOverviewEditing,
    onOverviewEditingChange: setActiveCustomerOverviewEditing,
    onAddToast: addToast,
    onStartInteraction: (contact, channel, phone, skillId) =>
      handleStartCall({ contact, channel, phone, skillId }),
    onOpenHistoryConversation: (entry) =>
      activeInteraction &&
      setHistoryConversationTab({ interactionId: activeInteraction.id, entry, active: true }),
    // (No `onBack`: the drill-in renders in the Contact Details slide-over, whose own back arrow returns to its
    // first tab, P-HOME-1n.)
    // Contact Details' Customer Information / Notes / Detail tabs drive which body it renders.
    activeTab: CUSTOMER_RECORD_TAB[contactDetailsView as keyof typeof CUSTOMER_RECORD_TAB],
  });

  // Feeds the "Session" tab's body/footer at BOTH of this page's own render
  // sites for it — the docked panel and the hover-preview popover (see each
  // one's own render site further down) — via this ONE shared hook call, so
  // they always agree on the same edit-in-progress state rather than each
  // tracking it independently. `sessionContact` is the same voice/non-voice
  // fallback ternary both render sites already used before this hook
  // existed here. No `onEditClick` since P-HOME-1n: Session Details is its own
  // slide-over (never in the hover preview), so "Edit" is already on the real
  // surface.
  // The thread whose session it shows: the panel's thread under "main" (it follows a switch, k8 3), else the main tab's.
  const detailsThreadKey = activeInteraction ? `${activeInteraction.id}:${(panelPlacement && channelPreviewThreadKey) || activeChannelKey}` : "";
  const detailsFromPanelRow = !!(panelPlacement && channelPreviewThreadKey);
  const detailsCurrentSession = useThreadCurrentSession({
    interaction: activeInteraction,
    thread: detailsFromPanelRow ? channelPreviewThread : activeChannel,
    threadKey: detailsThreadKey,
    fromPanelRow: detailsFromPanelRow,
    mainStatus: activeChannelStatus,
  });
  const sessionDetailsTabContent = useSessionDetailsTabContent({
    sessionContact: (sessionDetailsPick?.key === detailsThreadKey ? sessionDetailsPick.session : detailsCurrentSession) ?? null,
  });

  // App-local only (per "changes to components should only happen locally
  // unless specified") — lyra-ui's shared `CreateNew` intentionally keeps
  // focus on its own trigger button on a normal click-to-open (see that
  // component's own doc comment on `openedViaLaunchRequestRef`), which is
  // the right default for every other app using it. Rather than changing
  // that shared behavior (or adding an opt-in prop to the library, or even
  // wrapping `<CreateNew>` in an extra element — `LeftNav`'s `injectExpanded`
  // clones `pinnedHeader`'s own DIRECT child to push in the hover-driven
  // `expanded` prop in overlay/narrow-nav mode, so a wrapper div here would
  // silently break that and leave the trigger stuck at whatever `expanded`
  // value this file passes instead of expanding on hover), this listens
  // for the trigger's own click at the document level instead, matched by
  // its stable `aria-label` (`title`, i.e. "New Outbound") — no JSX
  // wrapper, `CreateNew` stays `pinnedHeader`'s sole direct child. Once the
  // popover's open transition has settled, it finds the outbound search
  // field by its stable `id` (`#new-outbound-search`, set on lyra-ui's own
  // `CreateNew` — see that component's own doc comment on why it's a fixed
  // id rather than the field's default auto-generated one), suppresses the
  // browser's own autofill suggestions on it (see inline comment), and
  // focuses it directly. A closing click just fails the query harmlessly
  // (nothing to focus once the content's unmounted).
  useEffect(() => {
    const CREATE_NEW_TRIGGER_LABEL = "New Outbound";
    const onDocumentClick = (e: MouseEvent) => {
      const trigger = (e.target as HTMLElement).closest?.(
        `button[aria-label="${CREATE_NEW_TRIGGER_LABEL}"]`
      );
      if (!trigger) return;
      requestAnimationFrame(() => {
        setTimeout(() => {
          const input = document.querySelector<HTMLInputElement>("#new-outbound-search");
          if (!input) return;
          // The field's own label text contains "email" (part of
          // OUTBOUND_CONFIG.searchLabel's own copy, "Enter phone, email or
          // search term" — rendered as a real `<label>`, not placeholder
          // text, but still read by the same autofill heuristics), which
          // is enough for some browsers' autofill heuristics to treat this
          // as a saved-address field and show a suggestions dropdown the
          // moment it's focused. Chrome
          // ignores this plain autocomplete="off" for that category (a
          // stronger readonly-at-focus workaround was tried and reverted —
          // not worth the added complexity), but it's kept because Safari
          // does respect it. Set before `.focus()` (same synchronous tick).
          input.setAttribute("autocomplete", "off");
          input.focus();
        }, 50);
      });
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  // Every dial and redial below goes through the shared `useOutboundDial`
  // (P0.5b.2), identical on both pages: skills from the provider, voice
  // needs the agent leg, Contact History redial matches any of the
  // customer's numbers (row 16). The card appears once the provider's
  // contact reaches the store (handleContactActivated).
  // Contact History's Redial button: opens the Dial Pad pre-filled with the
  // customer's numbers; `handleDialpadSubmit` finishes the redial once a
  // skill is picked (useOutboundDial, row 16).
  const handleRedialButtonClick = (entry: ContactHistoryEntry, anchorEl: HTMLElement | null) =>
    outboundDial.openRedialPad(entry, anchorEl);

  // The single `onQuickDial` handler for New Outbound's dial pad. The Lucas
  // Thomas call-confirm is scenario behavior (P0.5c moves it); everything
  // else is the shared dial-pad submit (pending redial → any of the
  // customer's numbers; Save & Redial → that card; otherwise a quick dial).
  const handleDialpadSubmit = (phoneNumber: string, skillId: string) => {
    if (lucasCallConfirmRef.current) {
      const digits = (raw: string) => raw.replace(/\D/g, "").slice(-10);
      if (digits(phoneNumber) === digits(LUCAS_THOMAS_PHONE)) {
        launchLucasCall(phoneNumber, skillId);
        return;
      }
      lucasCallConfirmRef.current = null;
    }
    outboundDial.dialpadSubmit(phoneNumber, skillId, (id) => interactions.find((i) => i.id === id));
  };

  // Record header's "+" Add Channel fallback (`AddChannelAdHocButton`,
  // agent-next-gen-add-channel-button.tsx) — per explicit follow-up request
  // ("add the '+' to the unknown interactions in premium and advanced"),
  // covers the interactions `getHeaderAction` (below) still can't: it looks
  // up the interaction's own id in the combined `outboundConfig.groups` +
  // `contact-history` group (see `getHeaderAction`'s own call site's doc
  // comment), and returns `null` — no button at all — for any id that isn't
  // registered in EITHER of those (a genuinely ad-hoc/unknown interaction,
  // same "no real customer database" gap Agent Workspace 2.0 has for every
  // single one of its interactions). This is the exact same ad-hoc-only
  // component AND the exact same handler shape 2.0's own copy uses
  // (AgentNextGenPage.tsx) — adds a brand-new, unknown channel directly onto
  // the interaction that's CURRENTLY open, unlike `handleStartCall`, which
  // is keyed by CONTACT id and would start a whole separate new card for a
  // typed address with no real contact record behind it. This builds the
  // simplest correct `Thread` directly — same shape `handleStartCall`'s own
  // `newChannel` builds, minus the fields that only exist because THAT flow
  // goes through a real `CreateNew` contact pick (`reopenedContacts`).
  //
  // `skillId` — per explicit follow-up request ("make sure to include a
  // skill when adding a new channel to non-connected customers"): this
  // ad-hoc flow now resolves an "Outbound Skill" too (see
  // `AddChannelAdHocButton`'s own `skillId` doc comment), so `preview` is
  // set to that skill's label here, same as `handleStartCall`'s own
  // `skillLabel` lookup/assignment above — this is what makes an ad-hoc-
  // added channel's skill actually show up anywhere `Thread.preview` is
  // read, instead of silently staying blank the way it did before this
  // ad-hoc flow had a skill picker of its own at all.
  const handleAddAdHocChannel = (query: string, channel: ChannelType, skillId: string) => {
    if (!activeInteraction) return;
    // Joins the active card's journey through the provider; the new channel
    // opens in the docked channel preview (handleContactActivated, "added").
    outboundDial.addAdHocChannel(activeInteraction, query, channel, skillId);
  };

  /** Fired by the "Re-open" button on a Contact History entry's summary
   *  panel (the shared interior panel's `selectedContactHistoryEntry`
   *  branch, further down) — distinct from that same panel's "Redial"
   *  button, which still starts a fresh voice call via `handleRedial`
   *  above; this one reopens THIS past interaction to view/continue it.
   *  Used to fire directly off the Contact History row's own click, before
   *  that row started opening the summary panel first per explicit
   *  request — see `ContactHistoryCard`'s own doc comment. Builds a single
   *  channel matching `entry.channelType` — "voice"/"chat"/
   *  "email" are already valid `ChannelType` values (Contact History's own
   *  narrower grouping is a subset, not a separate vocabulary needing
   *  translation). `startedFresh` is deliberately left unset either way —
   *  reopening should show the existing (shared mock) conversation, not an
   *  empty "just launched" slate.
   *
   *  MERGES into an already-open Thread of this exact channel type on this
   *  same customer's card, per explicit request — mirrors `handleStartCall`'s
   *  own "same contact already has an interaction open" merge branch
   *  (`existingChannel`/`isReopenOfClosedChannel`/`reopenedContacts` above)
   *  almost exactly, rather than the wholesale `threads: [newChannel]`
   *  replace this used to do. Concretely: a customer with, say, an SMS
   *  thread already open (whether live or itself sitting Closed) who gets
   *  Re-opened from a DIFFERENT SMS-channel Contact History row doesn't get
   *  that whole card blown away and rebuilt from scratch — the reopened
   *  Contact stacks onto the SAME Thread via `reopenedContacts` (a fresh
   *  Contact id, prior messages preserved dimmed under their own session,
   *  same as any other channel reopen), and any OTHER already-open channel
   *  on that same card (an unrelated live Email/WhatsApp thread, say) is
   *  left completely untouched — `threads`/`threadStatuses`/`liveMessages`
   *  all merge in rather than replace wholesale. Only genuinely builds a
   *  brand-new Thread (no `reopenedContacts`, fresh `contactId`) when no
   *  Thread of this channel type is already on the card at all.
   *
   *  `entry.statusLabel` is carried onto `Interaction.threadStatuses`
   *  (keyed by the freshly-built channel's own id, merged alongside
   *  whatever this card's other channels already have) — per explicit
   *  request, reopening a row should pick its current session back up AT
   *  the status it was last logged with (whatever
   *  `buildDismissedContactHistoryEntry` captured, or whatever a
   *  hand-authored `CONTACT_HISTORY`/`EXTENDED_CONTACT_HISTORY` row already
   *  says), not reset to `TRANSCRIPT_SESSIONS`/`_VOICE`/`_EMAIL`'s own
   *  hardcoded default status for that session. Per explicit request,
   *  "Re-open" always hands the agent back a normal, fully reply-able
   *  assignment showing its last known state, never a locked read-only
   *  view: `Interaction.closed` (the flag that would otherwise drive a
   *  "viewing a closed interaction" banner, hidden composer, and hidden
   *  kebabs) is deliberately left unset here, regardless of `entry.closed`.
   *  If the status this reopens at happens to be literally "Closed", the
   *  normal per-channel mechanism already handles that same as it would
   *  for any other channel that closes mid-session: the status pill locks
   *  (a closed session can't be un-closed in place) and the "This channel
   *  is closed. Click Add Channel..." banner points the agent at the one
   *  real way to restart it — clicking that channel's own Add Channel
   *  button merges in a fresh, fully editable session (`reopenedContacts`)
   *  right on top, the exact same mechanism this handler itself now uses.
   *  Either way, the agent decides what to do next AFTER seeing the
   *  reopened card, not before. */
  const handleReopenContactHistoryEntry = (entry: ContactHistoryEntry) => {
    // P0.5b.2: through the provider's `reopen` (useContactReopen). A stored
    // case comes back thread by thread with its live messages; otherwise the
    // row's channel reopens at the row's status, folding into the open
    // card's thread of that channel if there is one (row 18: fresh timers,
    // no stale awaiting state, the clicked channel selected).
    void contactReopen.reopenHistoryEntry(entry);
  };

  /* "Unassign & Dismiss" — `InteractionNavItem` itself decides which of
     these two applies (based on how many channels the card has open when
     it's clicked), so these just need to implement each half:
     `onDismiss` (whole card, only called when just one channel was open —
     nothing would be left of the card otherwise) removes the interaction
     entirely, clearing `activeInteractionId` too if it was the active one so
     the side panel/content area doesn't keep pointing at a card that no
     longer exists. `onDismissChannel` (only called when more than one
     channel was open) drops just that one channel, leaving the rest of the
     card and its other channels open. The `ChannelToggle` bar's own kebab
     wires to the same two handlers (see the `activeInteraction` block
     below), so dismissing from a toggle behaves identically to dismissing
     from the card. */
  const handleDismissInteraction = (id: string) => {
    // Logs this assignment to Contact History before it's gone — an open
    // assignment being unassigned/dismissed is exactly the "completed
    // contact" event this demo has to log one from (see
    // `buildDismissedContactHistoryEntry`'s own doc comment). Looked up
    // from `interactions` (not `remaining` below) since that's the one
    // place the about-to-be-removed interaction's data still exists.
    // Deliberately does NOT change or invent this assignment's status —
    // logged as a normal "Resolved" row (see `buildDismissedContactHistoryEntry`),
    // never a forced "Closed"/read-only one: leaving an assignment (a
    // LeftNav/UI action) must not itself decide or change that
    // assignment's own status. `handleDismissChannel` (ending just one
    // channel of a card that's still otherwise open) does NOT call this —
    // the interaction as a whole isn't actually over yet, so there's
    // nothing to log.
    const dismissed = interactions.find((interaction) => interaction.id === id);
    if (dismissed) {
      // Per explicit request: skip ALL of this logging when the agent
      // never actually sent a message on any channel of this assignment —
      // a genuine, never-launched draft (the exact case the LeftNav card/
      // session row/record header's own red trash "Delete Draft" button
      // now renders for, see `removeVariant`/`isNewThread` at their own
      // call sites). There was never a real customer contact here to log;
      // logging one anyway would leave a phantom "Resolved" row for a
      // conversation the customer never even saw. A dismissed assignment
      // the agent actually worked (even just one message, even if the
      // customer never got a chance to reply yet) still logs normally,
      // same as before this check existed — this only ever suppresses the
      // brand-new, untouched case.
      //
      // Per confirmed bug report ("the contact history doesn't appear to be
      // updating after contacts are closed"): this `liveMessages`-only
      // check was ALSO silently swallowing every closed VOICE contact
      // (quick dial, redial, a fresh outbound/inbound call) — voice has no
      // typed-message flow at all, so `dismissed.liveMessages` never gains
      // an "agent" entry for a voice `Thread` no matter how real the call
      // was, and dismissing it logged nothing. Unlike a chat/email draft, a
      // voice `Thread` only ever exists once the agent has actually
      // dialed/answered — there's no "typed but never sent" equivalent for
      // a call — so any interaction with a voice Thread on it always counts
      // as real, regardless of `liveMessages`. `AgentWorkspace2WithDeskPage
      // .tsx`'s own identical check already carries this exact fix (see
      // that file's own copy of this comment for the fuller history) — this
      // page's copy just never received it.
      const everSentAgentMessage =
        Object.values(dismissed.liveMessages ?? {}).some((messages) => messages.some((m) => m.sender === "agent")) ||
        dismissed.threads.some((t) => t.type === "voice");
      if (everSentAgentMessage) {
        // Explicit save, redundant with the continuous `useEffect` sync above
        // — see that effect's own doc comment in AgentNextGenPage.tsx for why
        // this exact moment can't rely on the effect alone.
        saveCaseRecord(dismissed);
        const entry = buildDismissedContactHistoryEntry(dismissed, clock.now(), outcomeDrafts.drafts);
        // Upsert by `caseId`, not a plain prepend — per explicit bug report:
        // reopening a dismissed case (from Contact History or otherwise),
        // touching it, and dismissing it again used to log a SECOND row for
        // the exact same case, so a customer bounced open/closed a few times
        // piled up one near-duplicate "Contact History" entry per cycle
        // instead of reading as one case whose status just changed. `caseId`
        // (== `Interaction.customerId`) is the right identity to match on —
        // it's stable across the whole life of a card, carried straight
        // through on every reopen (`handleReopenContactHistoryEntry`'s own
        // `customerId: entry.caseId`), unlike this entry's own synthetic
        // `id` (`dismissed-${interaction.id}-${Date.now()}`), which is
        // deliberately unique per dismiss and would never match anything.
        // Only ever collapses entries within `dismissedContactHistory`
        // itself (today's real, agent-generated rows) — the separate
        // hand-authored `CONTACT_HISTORY`/`EXTENDED_CONTACT_HISTORY` fixture
        // rows `buildContactHistory` adds after them
        // are untouched, different (fictional) cases entirely.
        setDismissedContactHistory((prev) => [entry, ...prev.filter((e) => e.caseId !== entry.caseId)]);
      }
      // A provider card is closed through the provider (P0.5b.2): every
      // contact ended and its wrap-up completed with that channel's saved
      // outcome; the card then leaves the nav (and stays gone after a tier
      // switch). The toast waits until the provider accepted it. A scripted
      // scenario card is removed locally, as before.
      if (dismissed.threads.some((t) => t.providerInteractionId)) {
        void late.contactCommands.dismissCard(dismissed, late.outcomeFor(id)).then((ok) => {
          if (ok) fireDismissToast(dismissed, !everSentAgentMessage);
        });
      } else {
        setInteractions((prev) => prev.filter((interaction) => interaction.id !== id));
        fireDismissToast(dismissed, !everSentAgentMessage);
      }
    }
    // Dismissing the active assignment shouldn't strand the agent on an
    // empty dashboard when there's other open work waiting — hand "active"
    // to whichever assignment now sits at the top of the LeftNav list
    // (`interactions` renders top-down, see the `header` block below)
    // instead of clearing to `null`. Only clears to `null` (back to the
    // dashboard) once every assignment is gone.
    const remaining = interactions.filter((interaction) => interaction.id !== id);
    // The dismissed id no longer belongs to any real assignment — drop its
    // Customer Information panel snapshot too (see `switchActiveInteraction`
    // above), so it can't resurface stale open/full-screen values if some
    // future assignment ever happened to reuse the same id.
    sidePanelStateByAssignmentId.current.delete(id);
    // Plain closure read (not a functional updater) — safe here since
    // nothing else in this same handler changes `activeInteractionId`
    // first, and `switchActiveInteraction` itself already needs a real,
    // synchronous "outgoing id" read rather than a queued updater (see its
    // own doc comment for why).
    if (activeInteractionId === id) {
      switchActiveInteraction(remaining[0]?.id ?? null);
    }
  };
  dismissInteractionRef.current = handleDismissInteraction;

  const handleDismissChannel = (id: string, channel: Pick<InteractionChannel, "id" | "type">) => {
    // Match on `id` (falling back to `type`, same as InteractionNavItem's
    // own `channelKey` convention) rather than `type` alone — two open
    // channels can share a `type` (e.g. two SMS threads on different
    // numbers), and filtering by `type` would drop *both* instead of just
    // the one the agent actually dismissed.
    const dismissedKey = channel.id ?? channel.type;
    // Fires the same success toast `handleDismissInteraction` does — every
    // dismissed channel gets its own confirmation, not just the one that
    // happens to empty the card out entirely. Looked up from `interactions`
    // (not `remaining`/the updater below) for the same reason
    // `handleDismissInteraction` does: that's the one place this
    // assignment's current `customerName`/`recordId` still exist before the
    // state update below removes just this one channel from it.
    const interaction = interactions.find((i) => i.id === id);
    if (!interaction) return;
    // Same "genuine, never-launched draft" check `handleDismissInteraction`
    // runs, scoped to just THIS channel — see that handler's own doc
    // comment for the full reasoning. Only affects the toast's wording
    // here (`fireDismissToast`'s own `isDraftDelete` doc comment) — this
    // handler never logs Contact History either way (dismissing one
    // channel of a still-open, multi-channel card was never a "the whole
    // assignment is over" event to log in the first place).
    const everSentAgentMessage = (interaction.liveMessages?.[dismissedKey] ?? []).some(
      (m) => m.sender === "agent"
    );
    // A provider thread is closed through the provider (P0.5b.2) and leaves
    // the card once it has; the toast waits for that. If it was the main
    // column, the card's newest remaining thread takes over.
    const dismissedThread = interaction.threads.find((c) => c.id === dismissedKey);
    if (dismissedThread?.providerInteractionId) {
      void late.contactCommands.dismissThread(interaction, dismissedKey, late.outcomeFor(id)(dismissedKey)).then((ok) => {
        if (!ok) return;
        fireDismissToast(interaction, !everSentAgentMessage);
        setInteractions((prev) =>
          prev.map((i) => {
            if (i.id !== id || i.currentThreadId !== dismissedKey) return i;
            const others = i.threads.filter((c) => c.id !== dismissedKey);
            return { ...i, currentThreadId: others[others.length - 1]?.id };
          })
        );
      });
      return;
    }
    fireDismissToast(interaction, !everSentAgentMessage);
    setInteractions((prev) =>
      prev.map((interaction) => {
        if (interaction.id !== id) return interaction;
        const channels = interaction.threads.filter((c) => (c.id ?? c.type) !== dismissedKey);
        // Dismissing the currently-selected channel needs to hand "current"
        // to another remaining one (the new last channel, same fallback
        // InteractionNavItem itself uses) — otherwise the card/tab bar would
        // keep pointing at a channel that no longer exists.
        const currentThreadId = interaction.currentThreadId === dismissedKey
          ? channels[channels.length - 1]?.id
          : interaction.currentThreadId;
        return { ...interaction, threads: channels, currentThreadId };
      })
    );
  };

  /** Fired by a card row's `onCurrentChannelChange` or a (currently
   *  hidden) `ChannelToggle`'s `onClick`. Per explicit follow-up request
   *  ("toggle between channels [on the left-nav card] - it should stay the
   *  same [main column]"), generalizing the same "no channel switch ever
   *  changes main content" rule already applied to adding/restarting a
   *  channel (`handleStartCall`/`handleAddAdHocChannel`) and to the header's
   *  own channel-preview icons: this NO LONGER writes `currentThreadId` at
   *  all. Selecting a channel on the ACTIVE card instead just opens/toggles
   *  that channel's preview in the shared docked side panel, exactly like
   *  clicking its header icon does (see `channelPreviewThreadKey`) - the
   *  card's own `currentChannelKey` prop is driven by that same state for
   *  the active card (see that render site's own doc comment) so its
   *  highlighted channel still tracks what's showing. Selecting a channel
   *  on a NON-active card switches to that interaction first (mirroring
   *  `handleStartCall`'s own `switchActiveInteraction` call), then opens
   *  that channel's preview the same way.
   *
   *  Per explicit follow-up bug report ("when I launch marcus webb then
   *  launch another interaction, when I go back to marcus and the other
   *  interaction the voice transcript side panel is open - it should not
   *  be"): the actual repro was clicking a card's own channel ROW (this
   *  handler, via `onCurrentChannelChange`) rather than the card header —
   *  every card in this voice-only deployment has exactly one row, its
   *  voice channel, so simply switching between cards by clicking their
   *  channel rows was silently opening/toggling that channel's preview
   *  every time, exactly like clicking any other channel row would. Voice
   *  is now guarded out of the "open/toggle a preview" behavior entirely —
   *  same "always active, never a side-panel toggle" rule the record
   *  header's own voice icon button already follows (its own render site's
   *  `isVoiceChannel` doc comment) — while still switching cards normally
   *  for a click on a non-active card's voice row. */
  const handleChannelSelect = (interactionId: string, channelKey: string) => {
    if (omnichannel) {
      // Chat (or a lone call/async thread) → main column; a call next to a
      // chat → the voice bar only; async → the slide-out (toggles on the
      // active card). From Home, this also opens the card.
      const card = interactions.find((i) => i.id === interactionId);
      const route = card ? routeChannel(card.threads, channelKey, placement) : "main";
      if (interactionId !== activeInteractionId) switchActiveInteraction(interactionId);
      // A held main thread (`mainPins`) stays put on its own row; picking a
      // main-column thread is the agent's own move, so the hold ends.
      if (mainPins.pinned(interactionId) === channelKey) return;
      if (route === "main") {
        mainPins.unpin(interactionId);
        setInteractions((prev) =>
          prev.map((i) => (i.id === interactionId && i.currentThreadId !== channelKey ? { ...i, currentThreadId: channelKey } : i))
        );
      } else if (route === "slideout") {
        if (interactionId === activeInteractionId) omni.toggle(interactionId, channelKey);
        else omni.open(interactionId, channelKey);
      }
      return;
    }
    // Tabs (AI display inline/panel, P-AIFIRST (k), (k3)): a header tab or a nav
    // row swaps the main column to that thread, a call's to its AI workspace
    // (from Home it opens the card too).
    if (interactionId !== activeInteractionId) switchActiveInteraction(interactionId);
    setInteractions((prev) =>
      prev.map((i) => (i.id === interactionId && i.currentThreadId !== channelKey ? { ...i, currentThreadId: channelKey } : i))
    );
  };


  return {
    ...prev,
    isCompactHeader, narrowActiveRegion, setNarrowActiveRegion, MAX_PANEL_HEIGHT, BOTTOM_PADDING, SHARED_PANEL_MAX_WIDTH,
    computePanelHeight, handleStatusChange, isOnVoiceCall, preCallStatusRef, handleStartCall, handleContactActivated,
    activateWhenReady, allOutboundSkills, skillIdForName, findDirectoryCustomer, cardContactMethodsOf, offerToSaveAddress, outboundDial,
    contactReopen, customerInfoOverlayContent, contactDetailsView, contactDetailsTabContext, transcriptToggleShown,
    transcriptHidden, setTranscriptHidden, detailsThreadKey, detailsFromPanelRow, detailsCurrentSession,
    sessionDetailsTabContent, handleRedialButtonClick, handleDialpadSubmit, handleAddAdHocChannel,
    handleReopenContactHistoryEntry, handleDismissInteraction, handleDismissChannel, handleChannelSelect,
  };
}

export type WsLaunch = ReturnType<typeof useWsLaunch>;
