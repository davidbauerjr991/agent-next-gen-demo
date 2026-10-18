// Workspace controller, slice 2 of 6 (P-EXTRACT C8b): Contact Details'
// context and customer matching, the clock-derived SLA tiers, the top-level
// views, Copilot asks and the scripted cases' handlers, the welcome modal
// and appearance, the header panel state, and the interior slide-over's
// selection and artifacts. The page's body, moved in order (hook order
// unchanged); see `useWorkspaceController`.
import { useState, useEffect, useMemo, useRef } from "react";
import { CHANNEL_TYPE_META, getHoldSeverity } from "@nicecxone/lyra-ui";
import { CREATE_NEW_CUSTOMERS, type CreateNewCustomerRecord } from "@nicecxone/lyra-ui/customers-data";
import { getAwaitingSeverity, CURRENT_AGENT_FIRST_NAME, CURRENT_AGENT_LAST_NAME, synthesizeChannelAddress } from "@/components/agent-next-gen-shared-utils";
import { APP_MENU_ITEMS, buildAppMenuGroups } from "@/components/agent-next-gen-outbound-data";
import { type Thread, type Interaction, interactionHasBreachedSla, INITIAL_NOTIFICATIONS } from "@/components/agent-next-gen-interaction-dashboard";
import { useClockValue } from "@/components/agent-next-gen-page-clock";
import { useQueueSimSource } from "@/components/agent-next-gen-queue-sim";
import { preContactSummaryOf, withPreContactSummary } from "@/contact-handling";
import type { AgentStatus } from "@nicecxone/lyra-ui";
import type { InteractionHistoryRecord } from "@/components/agent-next-gen-interactions-table";
import { filterCustomersByQuery, findPossibleCustomerMatches } from "@/components/agent-next-gen-customer-info-panel";
import { MARCUS_WEBB_ID, LUCAS_THOMAS_ID, TOM_LEWIS_CALL_ID, MAYA_CHEN_CALL_ID } from "@/contact-handling/scenario-cases";
import { useCopilotAsk, useCopilotResultTimer } from "@/contact-handling/useCopilotAsk";
import { useBrand, useSettings, type ExtraHeaderApp } from "@/settings";
import { LUCAS_THOMAS_PANEL_TITLES, LUCAS_THOMAS_ORDER_DETAILS, TOM_LEWIS_CALL_PANEL_TITLES } from "@/components/agent-next-gen-lucas-thomas-panels";
import type { DetailPanelContent } from "@/contact-handling/workspace/workspace-types";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { AI_PERFORM_MS } from "@/contact-handling/ai-perform";
import { resolveActiveChannelDateTimeLabel, resolveInteractionLastCustomerResponseLabel } from "@/contact-handling/workspace/active-channel-labels";
import { LUCAS_THOMAS_COPILOT_SUGGESTION_LINKS, TOM_LEWIS_CALL_COPILOT_LINKS, MAYA_CHEN_CALL_COPILOT_LINKS } from "@/components/workspace/workspace-constants";
import type { WorkspaceLate } from "./workspace-late";
import type { WsCards } from "./useWsCards";

export function useWsDetails(prev: WsCards, late: WorkspaceLate) {
  const {
    activeChannel, activeChannelType, activeCustomerRecordDraft, activeInteraction, activeInteractionId, activeScenarioKey,
    addToast, aiInPanel, calling, clock, confirmDismiss, createdCustomerRecords, customerContextOverviewBase,
    customerMatchQuery, handleOutcomeCancel, handleOutcomeDispositionChange, handleOutcomeOpenChange, handleOutcomeSave,
    handleOutcomeSaveAndDismiss, handleOutcomeSaveAndRedial, handleOutcomeTagsChange, interactions, isColdCallId, omni,
    omnichannel, outcomeDraft, outcomeDraftKey, pendingAgentLegToastRef, scenarioCardId, scenarioCases, scenarioKeyOf,
    setCreatedCustomerRecords, setCustomerMatchStep, setInteractions, setNavOpen, setOutcomeDraft, showAgentLegToast,
    threadLaunchTimestamps,
  } = prev;
  // An inbound call's pre-contact summary (P0.5d.1) replaces the Autosummary
  // lines, for a known customer or an unknown caller alike. A scripted
  // case's own overview wins over it (P0.5c).
  const activePreContactSummary = scenarioKeyOf(activeInteraction?.id) ? undefined : preContactSummaryOf(activeInteraction);
  const customerContextOverviewInfo = useMemo(
    () => (customerContextOverviewBase ? withPreContactSummary(customerContextOverviewBase, activePreContactSummary) : undefined),
    [customerContextOverviewBase, activePreContactSummary],
  );
  // Per explicit follow-up request (superseding the customer-identity
  // version this used to be — see git history for that prior condition):
  // now keyed purely on how many channels/threads this interaction
  // actually has open, for EVERY customer interaction, real or unknown.
  // With only one channel open there's nothing for a tab row to
  // disambiguate between, so this tier collapses to the same compact,
  // no-tab-row header treatment Agent Workspace 2.0 always uses (that
  // file's own `showChannelTabRow` doc comment) — this only affects the
  // tab row itself now. Per explicit follow-up request ("let's update the
  // channel controls to always be in the session row..."), the record-
  // header's own former action cluster (Consult/Transfer, Outcome, kebab,
  // status chip, Unassign & Dismiss/Delete Draft) no longer exists at
  // all — that cluster lives permanently in `TranscriptSessionSeparator`'s
  // own session-row cluster now (`showSessionActionCluster`, unconditional
  // at the `<InteractionTranscript>` call site below), regardless of
  // channel count.
  // `activeInteractionIsRealCustomer` (above) is now a fully independent
  // signal — it no longer feeds this at all, and continues to gate ONLY
  // Customer Information's own tab set / customer-matching UI, per
  // explicit request.
  // Was `!activeInteraction || activeInteraction.threads.length >= 2` —
  // hid this row outright for a single-channel interaction. Per explicit
  // follow-up request ("if only one interaction tab is open, display the
  // tab instead of removing it"), now always shows whenever there's a real
  // active interaction — a single open channel renders as its own one-tab
  // row instead of disappearing. Safe to widen this far: the ONLY other
  // consumer this constant used to also gate, `showSessionActionCluster`
  // at the `<InteractionTranscript>` call site below, is already
  // unconditional regardless of channel count (see the comment right
  // above this one) — it no longer reads this constant at all.
  const showChannelTabRow = !!activeInteraction;
  // Per explicit request ("hide the subhead from the interaction header
  // under the user's name for now - I may bring it back") — mirrors Agent
  // Workspace 2.0's identical flag (AgentNextGenPage.tsx, see that file's
  // own doc comment for the full reasoning): gates the record-header
  // `PageHeader`'s own `subtitle` prop, below. The underlying derivation is
  // left completely untouched — flipping this back to `true` restores the
  // exact same subtitle with no other changes needed.
  const SHOW_RECORD_HEADER_SUBTITLE = false;
  // Per explicit request ("hide the guide conversation and transfer
  // buttons for now") — gates the two inert placeholder buttons on the
  // "Reviewing this conversation" `ActionBar`, below. "Takeover" (the only
  // wired action there) is unaffected. Flip back to `true` to restore both
  // exactly as they were, no other changes needed.
  const SHOW_MARCUS_REVIEW_GUIDE_AND_TRANSFER = false;
  // Captured once, this component's real mount instant — lets
  // `resolveInteractionLastCustomerResponseLabel` (below) convert a
  // `lastCustomerMessageTick` value (real elapsed seconds since mount,
  // since the page clock (`clock`, declared further down) ticks once per
  // real second — see its own doc comment) back into an exact real `Date`,
  // rather than a mock/relative string. Declared here (ahead of `clock`
  // itself) purely so it's available before `lastCustomerResponseLabel`
  // reads it a few lines below — it doesn't actually depend on the clock.
  const pageMountTimeRef = useRef(Date.now());
  // Duplicated verbatim from AgentNextGenPage.tsx (Agent Workspace 2.0) per
  // this codebase's "no shared sync" convention — the launch timestamp
  // (see `threadLaunchTimestamps`'s own doc comment above) for THIS active
  // channel specifically, and the resolved date/time (or "Draft") label
  // built from it. Used ONLY by the unknown-contact `PageHeader` subtitle
  // further down this file — a real-customer interaction's plain
  // customer-ID subtitle never reads either of these.
  const activeChannelLaunchedAt = activeInteraction
    ? threadLaunchTimestamps[`${activeInteraction.id}:${activeChannel?.id ?? activeChannel?.type ?? ""}`]
    : undefined;
  const activeChannelDateTime = resolveActiveChannelDateTimeLabel(
    activeChannelType,
    // Per-Thread, same reasoning as `activeChannelIsNewOutboundThread` above
    // — see `Thread.startedFresh`'s own doc comment.
    !!activeChannel?.startedFresh,
    activeChannel,
    activeChannelLaunchedAt
  );
  // Per explicit follow-up request: once 2+ channels are open
  // (`showChannelTabRow`), the record-header subtitle switches from the
  // single active channel's own "{icon} {label} | {date}" line (still used
  // for the 1-channel case above) to "{N} channels open | Last Customer
  // Response: {date/time}" instead — see
  // `resolveInteractionLastCustomerResponseLabel`'s own doc comment for the
  // full per-thread resolution order.
  const lastCustomerResponseLabel = activeInteraction
    ? resolveInteractionLastCustomerResponseLabel(activeInteraction, pageMountTimeRef.current)
    : undefined;
  // The full pool the unknown-contact matching flow (below) checks against
  // — the static directory plus anything `createdCustomerRecords` has
  // added this session (see that state's own doc comment for why a
  // created customer belongs in the pool too).
  const customerDirectoryPool = useMemo(
    () => [...CREATE_NEW_CUSTOMERS, ...createdCustomerRecords],
    [createdCustomerRecords]
  );
  // The raw dialed/typed identifier this unknown channel was reached on —
  // `Thread.value` (e.g. `handleQuickDial`'s own dialed `phoneNumber`) when
  // set, falling back to its own display label, then to whatever this
  // interaction's own card is titled, then its id — there's always SOME
  // stable string by the last fallback, which is all
  // `findPossibleCustomerMatches` actually needs (see that function's own
  // doc comment for why the exact string barely matters — it's a
  // deterministic seed, not something the check parses for meaning).
  const activeUnknownContactIdentifier =
    activeChannel?.value ?? activeChannel?.addressLabel ?? activeInteraction?.customerName ?? activeInteraction?.id;
  // Per explicit request: the automatic "does this look like anyone in the
  // directory" check for the active unknown-contact interaction — see
  // `findPossibleCustomerMatches`'s own doc comment
  // (agent-next-gen-customer-info-panel.tsx) for what it actually does.
  // Computed unconditionally (harmless for a real-customer interaction —
  // nothing reads it in that case, since the panel never sets `matchState`
  // for one) rather than gated behind `!activeInteractionIsRealCustomer`
  // here, so the `useMemo` dependency list stays simple.
  const possibleCustomerMatches = useMemo(
    () => findPossibleCustomerMatches(activeUnknownContactIdentifier, customerDirectoryPool),
    [activeUnknownContactIdentifier, customerDirectoryPool]
  );
  // The "Search Customers" box's own manual results — see
  // `filterCustomersByQuery`'s own doc comment. Empty (and therefore never
  // shown — see `CustomerInformationSidePanel`'s own `matchState` render
  // branch) until the agent actually types something.
  const customerSearchResults = useMemo(
    () => filterCustomersByQuery(customerMatchQuery, customerDirectoryPool),
    [customerMatchQuery, customerDirectoryPool]
  );
  /** Per explicit request: promotes the active unknown-contact interaction
   *  to a REAL customer by pointing it at an EXISTING directory record the
   *  agent picked from the "Possible Matches"/search list (`onLinkRecord`,
   *  wired into `CustomerMatchSearchBody`'s own "Link To Record" button —
   *  see that component's doc comment). Reassigns this interaction's own
   *  identity fields to the matched record's — `id` (so
   *  `activeInteractionIsRealCustomer` above reads `true` from the very
   *  next render, cascading into every other "real customer" surface:
   *  `showChannelTabRow`, the full Customer Information tab set, the plain
   *  customer-ID subtitle — see each of those consts' own doc comments),
   *  `customerId`, and `customerName`. Changing `customerId` also resets
   *  `activeCustomerRecordDraft` (that hook's own reset-on-recordId-change
   *  effect — see `useCustomerRecordDraft`'s own doc comment) to a FRESH
   *  draft synthesized from the matched record, discarding whatever was
   *  pending in the unknown-contact Detail form — correct here, since this
   *  interaction is now a totally different, already-real customer, not a
   *  continuation of the blank one. Deliberately updates `interactions`/
   *  `activeInteractionId` directly rather than going through
   *  `switchActiveInteraction` — this isn't switching to a DIFFERENT card,
   *  it's the same card being recognized as someone real, so none of that
   *  helper's "leaving one assignment for another" side-panel bookkeeping
   *  applies. */
  const handleLinkCustomerRecord = (customer: CreateNewCustomerRecord) => {
    if (!activeInteraction) return;
    const cardId = activeInteraction.id;
    // P0.5b.2: the card's contacts join the record through the provider
    // (`associateEntity`); the card keeps its journey id, and its name comes
    // from the directory (`directoryDisplayName`). `customerId` — the record
    // id Customer Information looks up — is page overlay state.
    const linked = late.contactCommands.linkEntity(activeInteraction, customer.id);
    setInteractions((prev) =>
      prev.map((interaction) =>
        interaction.id === cardId
          ? { ...interaction, customerId: customer.customerId, ...(linked ? {} : { customerName: customer.name }) }
          : interaction
      )
    );
    addToast({
      variant: "success",
      title: "Linked to record",
      message: `Linked to ${customer.name}'s customer record`,
      duration: 4000,
    });
  };
  /** Advances the unknown-contact matching flow to its "Create New
   *  Customer" step (`CustomerMatchSearchBody`'s footer button) — see
   *  `customerMatchStep`'s own doc comment. */
  const handleStartCreateCustomer = () => setCustomerMatchStep("create");
  /** Returns to the search step WITHOUT discarding anything — the header's
   *  own back-arrow button (`CustomerInformationSidePanel`'s
   *  `matchState.onBackToSearch`) uses this directly; the create step's
   *  own Cancel button calls `activeCustomerRecordDraft.cancel()` first,
   *  THEN this — see that render call site. */
  const handleBackToCustomerSearch = () => setCustomerMatchStep("search");
  /** Per explicit request: promotes the active unknown-contact interaction
   *  to a real customer by minting a brand-new directory record from
   *  whatever the agent typed into the "Create New Customer" form
   *  (`activeCustomerRecordDraft.draft` — the SAME Detail-tab draft this
   *  panel already showed for this interaction; see
   *  `CustomerInformationSidePanel`'s own `matchState` body branch for why
   *  no separate draft/hook is needed for this step). Deliberately does
   *  NOT reassign `customerId` (unlike `handleLinkCustomerRecord` above) —
   *  keeping the interaction's own existing case number means
   *  `activeCustomerRecordDraft` never resets (its own reset effect is
   *  keyed on `customerId`, unchanged here), so every field the agent just
   *  typed stays showing, unbroken, the instant this flips the panel over
   *  to the full "known customer" Detail tab — genuinely "the new customer
   *  information populated," per the request, not a fresh resynthesis.
   *  Only `id` (so `activeInteractionIsRealCustomer` flips true) and
   *  `customerName` (built from the typed name, so the record header's
   *  title updates too) change. */
  const handleSaveNewCustomer = () => {
    if (!activeInteraction) return;
    const firstName = activeCustomerRecordDraft.draft.firstName.trim();
    const lastName = activeCustomerRecordDraft.draft.lastName.trim();
    const name = [firstName, lastName].filter(Boolean).join(" ") || activeInteraction.customerName || "New Customer";
    const newId = `created-customer:${activeInteraction.id}`;
    const newCustomerFirstPhone = activeChannelType === "voice" ? (activeChannel?.value ?? "") : "";
    const newRecord: CreateNewCustomerRecord = {
      id: newId,
      name,
      customerId: activeInteraction.customerId,
      channels: activeChannelType ? [activeChannelType] : [],
      avatarClassName: "bg-lyra-accent-blue-soft text-lyra-accent-blue-strong",
      firstName: firstName || name,
      lastName,
      group: activeCustomerRecordDraft.draft.group || "Standard",
      firstPhone: newCustomerFirstPhone,
      // lyra's `phones[0].value` must equal `firstPhone` (create-new-customers-data.ts).
      phones: newCustomerFirstPhone ? [{ label: "Mobile", value: newCustomerFirstPhone }] : [],
      emailAddress: activeChannelType === "email" ? (activeChannel?.value ?? "") : "",
      address1: "",
      city: "",
      state: "",
      postalCode: "",
      originalCustomerId: activeCustomerRecordDraft.draft.originalContactNumber || activeInteraction.customerId,
      dateOfBirth: "",
      agent: `${CURRENT_AGENT_FIRST_NAME} ${CURRENT_AGENT_LAST_NAME}`,
      agentTeam: "",
      paymentBalance: activeCustomerRecordDraft.draft.balanceDue || "$0.00",
    };
    const cardId = activeInteraction.id;
    setCreatedCustomerRecords((prev) => [...prev, newRecord]);
    // Same as linking (P0.5b.2): the card's contacts join the new record.
    const linked = late.contactCommands.linkEntity(activeInteraction, newId);
    if (!linked) {
      setInteractions((prev) =>
        prev.map((interaction) => (interaction.id === cardId ? { ...interaction, customerName: name } : interaction))
      );
    }
    addToast({
      variant: "success",
      title: "Customer created",
      message: `${name} added to the customer directory`,
      duration: 4000,
    });
  };
  // Shared clock powering every open channel's live "MM:SS since it
  // started" elapsed display, and the agent's status timer
  // (`statusSinceTick` below). Not page state: a tick re-renders only the
  // `<ClockTick>`/`<ClockValue>` wrappers that show a live time, so the page
  // itself doesn't re-render every second (agent-next-gen-page-clock.ts).
  // Handlers and timeouts read the current tick with `clock.now()`. (The
  // clock itself is created up with the cards.)
  // Same idea for the home tab's live queue widgets (4s random walk):
  // only `<QueueSubItems>` readers re-render (agent-next-gen-queue-sim.ts).
  const queueSim = useQueueSimSource();
  // The Contact Details "Journey Summary" card's "Updated X ago" caption
  // (`DetailsPanelAccordions`, through lyra `CustomerContextOverview`'s
  // `realTimeSummaryUpdatedLabel` prop) needs a reference point to
  // measure elapsed time FROM. Captured once per contact (reset whenever
  // `activeInteractionId` changes, in the effect right below) rather than
  // tracking every individual fact change that actually feeds the summary
  // — this is a "freshness since you opened this contact's Details" clock,
  // the same practical signal the reference screenshot's own ticking
  // seconds counter conveys, not a literal per-field last-write timestamp
  // (this app has no such timestamp to read for any of `snapshot`'s
  // underlying facts). The page clock (just above) is what actually ticks
  // every real second; this only stores WHICH tick to measure from.
  // `DetailsPanelAccordions` turns it into the "Updated 8 seconds ago"
  // caption itself (`formatJourneySummaryUpdatedLabel`, inside a
  // `<ClockValue>`), so only that card re-renders as it ticks.
  const [journeySummaryUpdatedAtTick, setJourneySummaryUpdatedAtTick] = useState(0);
  useEffect(() => {
    setJourneySummaryUpdatedAtTick(clock.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInteractionId]);
  // Whether ANY assignment in the whole Personal Queue has a channel that's
  // actually breached SLA (red/"critical", not just "warning") — drives the
  // home header's "Personal Queue" chip color per explicit request ("make
  // the personal queue chip success when empty and warn when there are
  // assignments, make it red when an sla is breached in an assignment and
  // add a ! icon"). See `interactionHasBreachedSla`'s own doc comment
  // (agent-next-gen-interaction-dashboard.tsx) for why this re-derives the
  // same per-channel severity check each LeftNav card's own render loop
  // already applies, rather than importing that inline logic directly.
  // A boolean via `useClockValue`, so the page re-renders only when it flips.
  const hasBreachedSlaAssignment = useClockValue(clock, (clockTick) =>
    interactions.some((i) => interactionHasBreachedSla(i, clockTick))
  );
  // Same "how urgently is this channel awaiting a reply" signal the record-
  // header tab bar's own `<ChannelTab awaitingSeverity=...>` call site
  // computes per-channel (render return, further down) — resolved once
  // more, here, for the ACTIVE channel specifically so the "nearing SLA
  // breach"/"breached SLA" `InlineNotification` banner (also in the render
  // return, directly above the transcript) reflects the exact same tier as
  // that channel's own tab, rather than re-deriving it a third time at the
  // banner's own JSX. `undefined` whenever the active channel isn't
  // awaiting at all (mirrors `awaitingSeverity` being omitted for that case
  // everywhere else) — that's what tells the banner to render nothing.
  // Read through `useClockValue`, so the page re-renders only when the tier
  // changes, not every second.
  const activeChannelAwaitingSeverity: "success" | "warning" | "critical" | undefined = useClockValue(clock, (clockTick) =>
    activeChannel?.awaitingResponse
      ? getAwaitingSeverity(clockTick - (activeChannel.lastCustomerMessageTick ?? activeChannel.startTick))
      : undefined
  );
  // Hold SLA for the ACTIVE voice channel: a held call escalates to "warning"
  // at 15s and "critical" at 30s (lyra-ui's `getHoldSeverity`, same
  // thresholds as every hold-time badge). Drives the inline alert banner
  // below, same style as the chat awaiting-SLA banner. `undefined` unless
  // the active channel is a voice call currently on hold.
  const activeChannelHoldSeverity: "success" | "warning" | "critical" | undefined = useClockValue(clock, (clockTick) =>
    activeChannel?.type === "voice" && activeChannel.heldByAgent && activeChannel.heldSinceTick !== undefined
      ? getHoldSeverity(clockTick - activeChannel.heldSinceTick)
      : undefined
  );
  /* Settings — a third top-level view alongside Desk/interaction-record,
     shown in place of both in the content column when the Settings rail
     item is clicked. Mutually exclusive with an active interaction: opening
     one closes the other. Interaction → Settings is enforced below via an
     effect (selecting/starting any interaction always takes over the
     content column, same "one primary view at a time" rule Desk already
     follows per `buildNavItems`'s `active: !hasActiveInteraction`); Settings
     → interaction is enforced the other way, directly in the `LeftNav`
     `onSettingsClick` handler, since there's only that one call site
     (unlike `setActiveInteractionId`, which has several). */
  const [showSettings, setShowSettings] = useState(false);

  // Per explicit follow-up request ("detach the contacts table from the
  // search panel and have it exist on its own") — a fourth top-level view
  // alongside Desk/interaction-record/Settings, shown in place of all
  // three when the Home dashboard's "All Contacts" button (`ContactHistoryCard`'s
  // own `headerTitleBadge`) is clicked. Previously this button opened the
  // shared right-docked Search panel's own "Contacts" tab, maximized to
  // full screen (see BEHAVIOR.md §134) — that panel-based approach is
  // superseded here; `InteractionsListView` now also renders directly in
  // the content column below, completely independent of `Draggable`/
  // `ContainerHeader`/`activePanelKey`/`panelFullScreen`. Mutually
  // exclusive with Settings/an active interaction the same way those two
  // already are with each other while they're showing — enforced by the
  // ternary's own `showAllContacts && !activeInteraction` condition further
  // down (not by resetting this flag).
  //
  // Per a further explicit follow-up ("if the agent has all contacts open
  // and navigates away from home, keep home page (all contacts) at the
  // last state before navigating away") — this flag is NO LONGER cleared
  // just because Settings opens or an interaction starts; it only gets
  // cleared by the All Contacts view's own breadcrumb ("Dashboard" →
  // explicitly leaving All Contacts for the plain dashboard). Once Settings
  // closes or the interaction ends, whichever of them was active before
  // (plain dashboard vs. All Contacts) is exactly what reappears.
  // `selectedAllContactsRecord` (this view's own selected-row summary
  // panel, below) is preserved the same way, for the same reason — the
  // whole point is that "Home" always resumes right where the agent left
  // it.
  const [showAllContacts, setShowAllContacts] = useState(false);

  /* Which row (if any) is selected in the standalone "All Contacts" view's
     own `InteractionsListView` — per explicit follow-up request ("in the
     dashboard / contacts table - when one of the rows is clicked, open an
     interior panel like the ones in My Contact History"), clicking a row
     there opens a summary panel of its own (a second, independent
     `InteriorPanel`/`selectedContactHistoryEntry`-style pair, NOT the
     dashboard's shared one further down — the "All Contacts" view is a
     fully standalone view with no dashboard content mounted alongside it
     to share that docked slot with), instead of immediately opening the
     row as a live assignment the way it used to (`handleOpenInteractionRow`,
     still what the panel's own "Re-open"/"Redial" footer button calls).
     `InteractionHistoryRecord` has no `ContactHistoryEntry`-shaped summary
     of its own — `buildContactHistoryEntryFromInteractionRecord` (agent-
     next-gen-interactions-table.tsx) adapts one on the fly so this reuses
     `ContactHistoryEntryDetail` unchanged, same "Duration"/"Chat Summary"/
     "Conversation" layout the My Contact History card's own row-click panel
     already renders. */
  const [selectedAllContactsRecord, setSelectedAllContactsRecord] = useState<InteractionHistoryRecord | null>(null);

  // Per explicit follow-up request ("below the dashboard / all contacts
  // page header at tabs for Contacts (Active), Messages and Threads") — a
  // "(Active)" was dropped from the tab label per a follow-up ("Remove
  // (Active) from the contacts tab") — the tab is just "Contacts" now.
  // `TabList` row inside the All Contacts view itself, below its
  // `PageHeader`, same `TabList`/`Tab`/`activeTab`-string pattern already
  // used elsewhere in this app (e.g. the Customer Information panel's own
  // `CUSTOMER_PANEL_TABS`). Only "Contacts" has real content (the
  // existing `InteractionsListView` table + its own `InteriorPanel`,
  // below) — "Messages" and "Threads" are placeholders for now (same empty
  // `<div className="flex-1 overflow-y-auto" />` the Settings view already
  // uses as its own placeholder body), pending a real data model for
  // per-message/per-thread rows.
  const ALL_CONTACTS_TABS = ["Contacts", "Messages", "Threads"] as const;
  const [allContactsTab, setAllContactsTab] = useState<(typeof ALL_CONTACTS_TABS)[number]>("Contacts");

  // Effect rather than touching every `setActiveInteractionId` call site
  // individually. Only closes Settings — does NOT touch `showAllContacts`/
  // `selectedAllContactsRecord` (see that state's own doc comment above for
  // why): an active interaction still visually pre-empts All Contacts via
  // the content-column ternary's own `!activeInteraction` guard, without
  // discarding All Contacts' own state for when the interaction ends.
  useEffect(() => {
    if (activeInteractionId) {
      setShowSettings(false);
      setLeftNavPage(null);
    }
  }, [activeInteractionId]);
  // An app placed in the left nav opens as a page in the main column, like
  // Home and Settings (Agent chat stays a drawer). Selecting a card, Home or
  // Settings leaves it.
  const [leftNavPage, setLeftNavPage] = useState<ExtraHeaderApp | null>(null);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("unavailable");
  // The scripted cases (Marcus "L", Lucas "A", Tom "C", Maya "B") are
  // launched by the sim's dev hotkeys and played by its engine (P0.5c,
  // src/adapters/sim/sim-scenario-hotkeys.ts); routing offers them only
  // while the agent is available or working. They arrive as provider
  // contacts, so this page builds no card and runs no scenario timer.
  // Whether the Reject flow's customer-provided photo (rendered inline in
  // `MarcusWebbNextBestActionCard`, never in the transcript — see that
  // file's own top doc comment) is taking over the MAIN interaction
  // column, the same "takes over" mechanic `voiceVideoFullScreen`/
  // `VideoCallFullScreen` already uses below. Reset whenever the active
  // interaction changes away from Marcus (see the effect right below) so a
  // stale overlay can't bleed into a different interaction after switching
  // away and back.
  const [marcusWebbPhotoExpanded, setMarcusWebbPhotoExpanded] = useState(false);
  useEffect(() => {
    if (activeScenarioKey !== MARCUS_WEBB_ID) setMarcusWebbPhotoExpanded(false);
  }, [activeScenarioKey]);
  // "Hide AI Actions" switch in the composer: transcript shows only chat bubbles.
  const [hideAiActions, setHideAiActions] = useState(false);
  // Always points at the latest `handleDismissInteraction`, for the engine's
  // dismiss of a scripted case (below).
  const dismissInteractionRef = useRef<((id: string) => void) | null>(null);
  // Anything the agent asks Copilot is logged in the chat as the same "AI agent finished performing this." + clickable
  // instruction row used for approval decisions; the row reopens the question in the side panel (shared `useCopilotAsk`).
  const handleCopilotAsk = useCopilotAsk({
    setCards: setInteractions,
    onAsk: () => setHideAiActions(false),
    linkFor: (cardId, text) => {
      const key = scenarioKeyOf(cardId);
      return key === LUCAS_THOMAS_ID
        ? LUCAS_THOMAS_COPILOT_SUGGESTION_LINKS[text]
        : key === TOM_LEWIS_CALL_ID
          ? TOM_LEWIS_CALL_COPILOT_LINKS[text]
          : key === MAYA_CHEN_CALL_ID
            ? MAYA_CHEN_CALL_COPILOT_LINKS[text]
            : undefined;
    },
    autoOpensResult: (cardId) => scenarioKeyOf(cardId) === LUCAS_THOMAS_ID || isColdCallId(cardId),
    openResult: (cardId, { text, time, link }) =>
      setDetailPanelByInteraction((prev) => ({ ...prev, [cardId]: { kind: "lucas-instruction", decision: "copilot", text, time, link } })),
  });
  const copilotResultTimer = useCopilotResultTimer();
  // Plays out the chat follow-up (events + AI replying to the customer) after the agent decides on Lucas's approval card.
  // Distinct id per run so a repeated "Something else" instruction never reuses a message id.
  const [marcusCopilotRequests, setMarcusCopilotRequests] = useState<{ id: string; text: string; time: string; performedAt?: number }[]>([]);
  const marcusCopilotRequestsRef = useRef<{ id: string; text: string; time: string; performedAt?: number }[]>([]);
  const handleMarcusCopilotAsk = (text: string, openAfterMs?: number) => {
    // Asking Copilot produces an AI action row, so reveal AI actions if they were hidden.
    setHideAiActions(false);
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const req = { id: `marcus-copilot-${Date.now()}`, text, time, performedAt: Date.now() + AI_PERFORM_MS };
    marcusCopilotRequestsRef.current = [...marcusCopilotRequestsRef.current, req];
    setMarcusCopilotRequests((prev) => [...prev, req]);
    // Free-form questions open their result once Copilot "finishes"; chips open their own panel after their spinner.
    const cardId = scenarioCardId(MARCUS_WEBB_ID);
    if (openAfterMs !== undefined && cardId) {
      copilotResultTimer(
        () => setDetailPanelByInteraction((prev) => ({ ...prev, [cardId]: { kind: "marcus-copilot", ...req } })),
        openAfterMs
      );
    }
  };
  // "Call now" on Lucas's escalation card: opens the outbound popover on the button; `confirm` marks the card decided once launched.
  const lucasCallConfirmRef = useRef<(() => void) | null>(null);
  const LUCAS_THOMAS_PHONE = "(415) 555-0142";
  const handleLucasCallRequest = (req: { value: string; anchorEl: HTMLElement; confirm: () => void }) => {
    lucasCallConfirmRef.current = req.confirm;
    late.outboundDial.requestDialpad({ phoneNumber: LUCAS_THOMAS_PHONE, anchorEl: req.anchorEl, customerName: "Call Lucas Thomas" });
  };
  const launchLucasCall = (phoneNumber: string, skillId: string) => {
    const confirm = lucasCallConfirmRef.current;
    lucasCallConfirmRef.current = null;
    // `confirm()` submits the card: its decision makes the engine play the
    // `upset-call` steps (calling event, the bot's heads-up, connected).
    confirm?.();
    // Launching the call hands the chat off to John, without the bot's
    // handoff line: Takeover Chat goes away.
    scenarioCases.takeOver(LUCAS_THOMAS_ID, { handoff: false });
    // A real outbound call into Lucas's journey: it connects after the sim's
    // ring delay, which is what brings up the call controls. It joins the
    // card like any second channel ("none": no preview, no switch) — the chat
    // stays the card's main thread.
    const card = interactions.find((c) => scenarioKeyOf(c.id) === LUCAS_THOMAS_ID);
    if (card) late.outboundDial.addAdHocChannel(card, phoneNumber, "voice", skillId, "none");
  };
  // The agent's decision on one of Lucas's approval cards, or Complete
  // wrap-up ("ship-wrapup"): the engine plays the branch it starts.
  const handleLucasApprovalDecision = (value: string, note: string) => {
    scenarioCases.respond(LUCAS_THOMAS_ID, { value, ...(note ? { note } : {}) });
  };
  // A scripted call answered automatically (Maya) opens like an accepted
  // offer: the nav opens and the side panel closes, as her hotkey used to.
  // A scripted chat the bot ended (Lucas wrapped up without a takeover)
  // leaves the nav the way Unassign & Dismiss does, Contact History row
  // included. Each happens once per contact.
  const scenarioReactions = useRef(new Set<string>());
  useEffect(() => {
    for (const scenario of Object.values(scenarioCases.byKey)) {
      if (!scenario?.cardId) continue;
      const { contact, cardId } = scenario;
      if (contact.autoAnswered && contact.state === "active" && !scenarioReactions.current.has(`open:${contact.id}`)) {
        scenarioReactions.current.add(`open:${contact.id}`);
        setNavOpen(true);
        late.switchActiveInteraction(cardId);
        late.setSidePanelOpen(false);
      }
      // Still the bot's (`review`): the agent's own dismiss after a takeover
      // also passes through wrap-up, and must not run twice.
      if (contact.review && contact.state === "wrap-up" && !scenarioReactions.current.has(`dismiss:${contact.id}`)) {
        scenarioReactions.current.add(`dismiss:${contact.id}`);
        dismissInteractionRef.current?.(cardId);
      }
    }
    // switchActiveInteraction is a plain function redefined every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioCases.byKey]);
  // Escape closes the open side panel: the slide-out detail panel first (article, order, Copilot answer...), otherwise the docked
  // Contact Details panel. Skipped while another overlay (popover, menu, dialog) is open so Escape still closes that first.
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[data-radix-popper-content-wrapper], [role="dialog"], [role="menu"], [role="listbox"]')) return;
      if (selectedDetailPanelContent) {
        setSelectedDetailPanelContent(null);
      } else if (late.sidePanelOpen) {
        late.setSidePanelOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  });
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  // Flushes whatever `fireAgentLegStatusToast` deferred (further up this
  // component) the moment the welcome modal actually closes (Go Available /
  // Start Offline), so the agent still sees that toast — just after, not
  // during, the modal. Has to live down here, after `showWelcomeModal`
  // itself is declared — `useEffect`'s dependency array is evaluated
  // immediately as part of this call (unlike a plain function body, which
  // only reads `showWelcomeModal` once actually invoked later), so putting
  // this up near `fireAgentLegStatusToast` referenced `showWelcomeModal`
  // before its own `const` had run, which crashed the whole page on every
  // render (temporal dead zone) — that's why the welcome modal stopped
  // opening at all just now. Deliberately keyed only on `showWelcomeModal`
  // — `showAgentLegToast` is a plain function redefined every render (not
  // memoized), so including it would rerun this on every render instead of
  // only on the open→closed transition this is meant to catch.
  useEffect(() => {
    if (!showWelcomeModal && pendingAgentLegToastRef.current) {
      showAgentLegToast(pendingAgentLegToastRef.current);
      pendingAgentLegToastRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWelcomeModal]);
  // Page-clock tick the agent's current status started at. The header's
  // HH:MM:SS status timer is the page clock minus this, ticking inside
  // `<ClockTick>` around `AgentProfile` only; a status change resets it.
  const [statusSinceTick, setStatusSinceTick] = useState(0);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  // Theme comes from the settings store (`appearance`); `useApplyTheme` at
  // the app root writes `<html data-theme>`.
  const [appearance, updateAppearance] = useSettings("appearance");
  const darkMode = appearance.theme === "dark";
  const handleDarkModeToggle = () => updateAppearance({ theme: darkMode ? "light" : "dark" });
  // White-label brand (Settings → Appearance); profiles are picked in Settings.
  const { appName: appDisplayName, logoSrc } = useBrand();
  const appMenuGroups = buildAppMenuGroups(APP_MENU_ITEMS, () => setAppMenuOpen(false));

  /* Panel animation state machine — see AgentNextGenTemplate.stories.tsx for full comment */
  // `PanelState`/`PanelKey`: workspace-types.ts (the single-container app-header panel).
  const [panelOpen,      setPanelOpen]      = useState(false);
  // Per explicit request ("go back to auto-closing the app panels when a
  // new interaction is launched") — see AgentNextGenPage.tsx's identical
  // effect (same `[activeInteractionId]` dependency, mirroring the
  // `setShowSettings(false)` effect above) for the full rationale.
  useEffect(() => {
    if (activeInteractionId) {
      setPanelOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInteractionId]);
  // Floating video window — see AgentNextGenPage.tsx's identical state for
  // the full rationale.
  const [voiceVideoWindowOpen, setVoiceVideoWindowOpen] = useState(false);
  // Whether the video window is currently the full-screen variant vs. the
  // small floating one — see AgentNextGenPage.tsx's identical state for
  // the full rationale.
  const [voiceVideoFullScreen, setVoiceVideoFullScreen] = useState(false);
  // Which tab the docked `CustomerInformationSidePanel` below is showing —
  // per later explicit request ("put the transcript and session tabs into
  // the new customer information side panel and rename the side panel
  // Session Details"): this panel used to ONLY show the Customer Profile/
  // Contact Snapshot/Files accordions (`bodyOverride`, see that panel's own
  // render site's doc comment); Transcript (voice only) and Session
  // Details moved INTO it from what used to be a totally separate
  // "Session Details" `InteriorPanel` overlay (removed — see this state's
  // own render site for what replaced it). One shared tab state now,
  // regardless of channel type, since there's only ONE panel left to have
  // a tab at all — `headerTabsOverride` (that panel's own render site)
  // simply offers fewer tabs (no "Transcript") for a non-voice interaction
  // rather than needing a second, parallel piece of state. Reset to
  // "Details" whenever the panel closes or the active interaction changes,
  // same as the two separate pieces of state this replaced used to reset.
  // "Customer Info" — a 4th value, per explicit request ("move the
  // customer information content back to the side panel"): not a normal
  // tab the agent picks from the header's own tab row (that row is
  // entirely replaced by a back arrow + the drill-in's own content while
  // this is active — see the `CustomerInformationSidePanel` render site's
  // own overrides further down) — only reached via `focusCustomerPanelTab`
  // (its own doc comment) and left via that same back arrow, which lands
  // back on "Details".
  const [customerPanelActiveTab, setCustomerPanelActiveTab] = useState<
    "Details" | "Transcript" | "Session Details" | "Customer Info" | "Artifacts" | "Experience Memory"
  >("Details");
  // Per explicit request ("when the agent confirms navigating away to view
  // the transcript, it should display the Transcript tab once it
  // transitions to the contact"): the interaction-switch effect just below
  // unconditionally resets `customerPanelActiveTab` back to "Details" on
  // EVERY `activeInteractionId` change, including the one
  // `onConfirmViewTranscript` triggers via `switchActiveInteraction` — that
  // reset is a `useEffect`, so it always runs AFTER this handler's own
  // synchronous `setCustomerPanelActiveTab("Transcript")` call, silently
  // clobbering it back to "Details" a render later. A plain ref (not
  // state) that the reset effect itself checks and clears: set right
  // before calling `switchActiveInteraction`, so it survives until that
  // effect actually runs, without needing to touch every other existing
  // "switch interaction" call site that's fine with the normal "Details"
  // reset.
  const restoredCustomerPanelTabRef = useRef<typeof customerPanelActiveTab | null>(null);
  const pendingCustomerPanelTabRef = useRef<"Transcript" | null>(null);
  // The Marcus Webb action-log detail panel and the "Do Something"
  // knowledge-article panel used to be two SEPARATE floating
  // `InteriorPanel` overlays with two separate pieces of state — per
  // explicit follow-up request ("toggling between refund approved and
  // tablet warranty coverage should change the content of the container
  // — like how the home page works"), they're now ONE shared overlay
  // (own render site further down) showing exactly one of three "views"
  // at a time. `DetailPanelContent` is that union; `article-link` is the
  // "drilled into one of an article's web links" view — reached by
  // navigating WITHIN this one panel (via its new `onBack`, see
  // `interior-panel.tsx`) rather than opening a second, nested panel
  // (nesting isn't supported anywhere in this app).
  // Panel content is native to each customer/interaction: it only shows while
  // that interaction is active, is hidden when switching to another one, and
  // comes back when returning to it. Kept in the workspace UI store by card id, so it survives a remount of
  // whatever shows it (a layout switch).
  const [detailPanelByInteraction, setDetailPanelByInteraction] = useWorkspaceUiField("detailPanelByCard");
  const selectedDetailPanelContent: DetailPanelContent | null = activeInteractionId
    ? detailPanelByInteraction[activeInteractionId] ?? null
    : null;
  const setSelectedDetailPanelContent = (
    updater: DetailPanelContent | null | ((current: DetailPanelContent | null) => DetailPanelContent | null)
  ) => {
    if (!activeInteractionId) return;
    setDetailPanelByInteraction((prev) => {
      const current = prev[activeInteractionId] ?? null;
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [activeInteractionId]: next };
    });
  };
  // Every side panel the agent opens on an interaction is remembered here and
  // listed as a link in the Contact Details "Artifacts" card; clicking one
  // re-opens it (not a toggle).
  const detailPanelArtifactKey = (c: DetailPanelContent): string => {
    switch (c.kind) {
      case "action-log": return `action-log:${c.entry.id}`;
      case "article": return `article:${c.article.id}`;
      case "article-link": return `article-link:${c.article.id}:${c.link.copyValue}`;
      case "order": return `order:${c.order.orderId}`;
      case "lucas": return `lucas:${c.panel}`;
      case "lucas-memory": return "lucas-memory";
      case "lucas-instruction": return `lucas-instruction:${c.link ?? c.text}`;
      case "copilot-result": return `copilot-result:${c.link ?? `${c.text}:${c.time}`}`;
      case "marcus-copilot": return `marcus-copilot:${c.id}`;
      case "tom-call": return `tom-call:${c.panel}`;
      case "lucas-order": return `lucas-order:${c.orderId}`;
      case "transactions": return `transactions:${c.id}`;
      case "session": return "session";
    }
  };
  const detailPanelArtifactLabel = (c: DetailPanelContent): string => {
    switch (c.kind) {
      case "action-log": return c.entry.title;
      case "article": return c.article.title;
      case "article-link": return c.link.title;
      case "order": return `Order ${c.order.orderId} · ${c.order.itemName}`;
      case "lucas": return LUCAS_THOMAS_PANEL_TITLES[c.panel].title;
      case "lucas-memory": return "Experience Memory";
      case "lucas-instruction": return c.text;
      case "copilot-result": return c.text;
      case "marcus-copilot": return c.text;
      case "tom-call": return TOM_LEWIS_CALL_PANEL_TITLES[c.panel].title;
      case "lucas-order": return `Order ${LUCAS_THOMAS_ORDER_DETAILS[c.orderId].item}`;
      case "transactions": return "Transactions";
      case "session": return "Session Details";
    }
  };
  const [panelArtifactsByInteraction, setPanelArtifactsByInteraction] = useWorkspaceUiField("artifactsByCard");
  useEffect(() => {
    if (!activeInteractionId || !selectedDetailPanelContent) return;
    // Experience Memory lives in the docked side panel, so it is never listed as an artifact.
    if (selectedDetailPanelContent.kind === "lucas-memory" || selectedDetailPanelContent.kind === "session") return;
    const content = selectedDetailPanelContent;
    const id = detailPanelArtifactKey(content);
    setPanelArtifactsByInteraction((prev) => {
      const list = prev[activeInteractionId] ?? [];
      const entry = { id, label: detailPanelArtifactLabel(content), content };
      const idx = list.findIndex((a) => a.id === id);
      const nextList = idx === -1 ? [...list, entry] : list.map((a, i) => (i === idx ? entry : a));
      return { ...prev, [activeInteractionId]: nextList };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDetailPanelContent, activeInteractionId]);
  const lucasActiveLinkKey: string | undefined =
    selectedDetailPanelContent?.kind === "lucas"
      ? selectedDetailPanelContent.panel
      : selectedDetailPanelContent?.kind === "lucas-instruction"
      ? selectedDetailPanelContent.link ?? `instruction:${selectedDetailPanelContent.decision}:${encodeURIComponent(selectedDetailPanelContent.text)}:${encodeURIComponent(selectedDetailPanelContent.time)}`
      : selectedDetailPanelContent?.kind === "copilot-result"
      ? selectedDetailPanelContent.link ?? `instruction:copilot:${encodeURIComponent(selectedDetailPanelContent.text)}:${encodeURIComponent(selectedDetailPanelContent.time)}`
      : selectedDetailPanelContent?.kind === "tom-call"
      ? selectedDetailPanelContent.panel
      : undefined;
  const panelArtifacts = activeInteractionId ? panelArtifactsByInteraction[activeInteractionId] ?? [] : [];
  const reopenPanelArtifact = (id: string) => {
    const found = panelArtifacts.find((a) => a.id === id);
    if (found) setSelectedDetailPanelContent(found.content);
  };
  // Mirrors `selectedDetailPanelContent` but never resets to `null` — per
  // explicit bug report (on the original single-purpose version of this
  // panel), it used to go blank the instant it started closing (content
  // was driven directly off the nullable selection state). This keeps
  // showing the last real content throughout the close animation; `open`
  // itself still tracks `selectedDetailPanelContent` directly.
  const [lastDetailPanelContent, setLastDetailPanelContent] = useState<DetailPanelContent | null>(null);
  // The interior slide-over lives in the docked panel: AI display "panel", or a panel thread's Session Details under "main".
  // Derived from this render's selection (the last one while closing), so a placement never lags its content.
  const slideOverInPanel = aiInPanel || (selectedDetailPanelContent ?? lastDetailPanelContent)?.kind === "session";
  useEffect(() => {
    if (selectedDetailPanelContent) setLastDetailPanelContent(selectedDetailPanelContent);
  }, [selectedDetailPanelContent]);
  // The thread the docked Contact Details panel shows instead of Contact
  // Details: the omnichannel slide-out's (one panel implementation). With
  // tabs (omnichannel off, P-AIFIRST (k)) the panel never shows a thread:
  // the header icons swap the main column instead, so this is always null.
  const channelPreviewThreadKey = omnichannel ? omni.slideOutKey : null;
  // Looked up once here (rather than inline at the
  // `CustomerInformationSidePanel` render call site) since it now feeds
  // several of that single docked panel's own override props — see each
  // prop's own doc comment at that render site for how each one branches
  // on it. Looks the key back up fresh every render (rather than storing
  // the whole `Thread` in state) so its content — `liveMessages`,
  // `awaitingResponse`, etc. — always reflects the live `interactions`
  // array, same reasoning `activeChannel`'s own derivation (above)
  // already follows.
  const channelPreviewThread = activeInteraction?.threads.find(
    (c) => (c.id ?? c.type) === channelPreviewThreadKey
  );
  const channelPreviewThreadStableKey = channelPreviewThread
    ? channelPreviewThread.id ?? channelPreviewThread.type
    : null;
  const channelPreviewMeta = channelPreviewThread ? CHANNEL_TYPE_META[channelPreviewThread.type] : undefined;
  // Toggle-open: clicking whatever's ALREADY showing closes the panel
  // (same semantics `selectedActionLogEntryId`'s own doc comment already
  // established); clicking something else just swaps this one panel's
  // content, per the "like the home page" request above.
  const openDetailPanelContent = (next: DetailPanelContent) => {
    setSelectedDetailPanelContent((current) => {
      if (!current) return next;
      if (current.kind === "action-log" && next.kind === "action-log" && current.entry.id === next.entry.id) {
        return null;
      }
      if (current.kind === "article" && next.kind === "article" && current.article.id === next.article.id) {
        return null;
      }
      // Per explicit request ("clicking Marcus Webb when Marcus Webb is
      // open should close the panel — same with the order link"), this
      // gets the same toggle-off treatment as action-log/article above.
      // ("customer" used to be handled here too, until a later explicit
      // request moved it off this shared floating panel entirely onto the
      // docked `CustomerInformationSidePanel` instead — see
      // `focusCustomerPanelTab`'s own doc comment.)
      if (current.kind === "order" && next.kind === "order" && current.order.orderId === next.order.orderId) {
        return null;
      }
      if (current.kind === "transactions" && next.kind === "transactions" && current.id === next.id) {
        return null;
      }
      if (current.kind === "marcus-copilot" && next.kind === "marcus-copilot" && current.id === next.id) {
        return null;
      }
      // Any link whose panel is already open closes it (toggle), whatever the panel kind.
      if (detailPanelArtifactKey(current) === detailPanelArtifactKey(next)) return null;
      return next;
    });
  };
  /** A composer's Copilot chips and ask, for one thread: the chips follow the
   *  thread's channel (Lucas has his own). */
  /** A thread's session-row Outcome (the main column's transcript, and the docked panel's header row under
   *  "main"): the shared `outcomeDraft` keyed `${interactionId}:${threadKey}`, as the LeftNav's `ChannelRow`.
   *  Once a call has ended the footer is Save & Redial / Save & Dismiss; Redial anchors on the Outcome button. */
  const threadOutcomeProps = (interaction: Interaction, thread: Thread | undefined) => {
    const key = `${interaction.id}:${thread?.id ?? thread?.type ?? "channel"}`;
    return {
      // Open for this channel; the session row that opened it shows it (its claim, `useOutcomeClaim`).
      outcomeOpen: outcomeDraftKey === key,
      onOutcomeOpenChange: (open: boolean) => handleOutcomeOpenChange(key, open),
      outcomeTags: outcomeDraft.tags,
      onOutcomeTagsChange: handleOutcomeTagsChange,
      outcomeDispositionCode: outcomeDraft.dispositionCode,
      onOutcomeDispositionChange: handleOutcomeDispositionChange,
      outcomeSummary: outcomeDraft.summary,
      onOutcomeSummaryChange: (value: string) => setOutcomeDraft((d) => ({ ...d, summary: value })),
      onOutcomeSave: handleOutcomeSave,
      onOutcomeCancel: handleOutcomeCancel,
      // A live digital thread: Save & Dismiss dismisses just it (k6 9), as the nav row's Outcome.
      outcomeCallEnded: thread?.type !== "voice" || !!(interaction.closed || interaction.voiceCallEnded),
      outcomeShowSaveAndRedial: thread?.type === "voice" && calling.saveAndRedial,
      onOutcomeSaveAndRedial: (anchorEl: HTMLElement | null) =>
        handleOutcomeSaveAndRedial(
          interaction.id,
          thread?.value ?? thread?.addressLabel ?? synthesizeChannelAddress("voice", interaction.customerId ?? interaction.id, interaction.customerName),
          anchorEl
        ),
      onOutcomeSaveAndDismiss: () =>
        thread && thread.type !== "voice" ? confirmDismiss(() => late.handleOutcomeSaveAndDismissChannel(interaction, thread)) : handleOutcomeSaveAndDismiss(interaction.id),
    };
  };

  return {
    ...prev,
    activePreContactSummary, customerContextOverviewInfo, showChannelTabRow, SHOW_RECORD_HEADER_SUBTITLE,
    SHOW_MARCUS_REVIEW_GUIDE_AND_TRANSFER, pageMountTimeRef, activeChannelLaunchedAt, activeChannelDateTime,
    lastCustomerResponseLabel, customerDirectoryPool, activeUnknownContactIdentifier, possibleCustomerMatches,
    customerSearchResults, handleLinkCustomerRecord, handleStartCreateCustomer, handleBackToCustomerSearch,
    handleSaveNewCustomer, queueSim, journeySummaryUpdatedAtTick, setJourneySummaryUpdatedAtTick,
    hasBreachedSlaAssignment, activeChannelAwaitingSeverity, activeChannelHoldSeverity, showSettings, setShowSettings,
    showAllContacts, setShowAllContacts, selectedAllContactsRecord, setSelectedAllContactsRecord, ALL_CONTACTS_TABS,
    allContactsTab, setAllContactsTab, leftNavPage, setLeftNavPage, windowWidth, setWindowWidth, notifications,
    setNotifications, agentStatus, setAgentStatus, marcusWebbPhotoExpanded, setMarcusWebbPhotoExpanded, hideAiActions,
    setHideAiActions, dismissInteractionRef, handleCopilotAsk, copilotResultTimer, marcusCopilotRequests,
    setMarcusCopilotRequests, marcusCopilotRequestsRef, handleMarcusCopilotAsk, lucasCallConfirmRef,
    LUCAS_THOMAS_PHONE, handleLucasCallRequest, launchLucasCall, handleLucasApprovalDecision, scenarioReactions,
    showWelcomeModal, setShowWelcomeModal, statusSinceTick, setStatusSinceTick, appMenuOpen, setAppMenuOpen,
    appearance, updateAppearance, darkMode, handleDarkModeToggle, appDisplayName, logoSrc, appMenuGroups, panelOpen,
    setPanelOpen, voiceVideoWindowOpen, setVoiceVideoWindowOpen, voiceVideoFullScreen, setVoiceVideoFullScreen,
    customerPanelActiveTab, setCustomerPanelActiveTab, restoredCustomerPanelTabRef, pendingCustomerPanelTabRef,
    detailPanelByInteraction, setDetailPanelByInteraction, selectedDetailPanelContent, setSelectedDetailPanelContent,
    detailPanelArtifactKey, detailPanelArtifactLabel, panelArtifactsByInteraction, setPanelArtifactsByInteraction,
    lucasActiveLinkKey, panelArtifacts, reopenPanelArtifact, lastDetailPanelContent, setLastDetailPanelContent,
    slideOverInPanel, channelPreviewThreadKey, channelPreviewThread, channelPreviewThreadStableKey, channelPreviewMeta,
    openDetailPanelContent, threadOutcomeProps,
  };
}

export type WsDetails = ReturnType<typeof useWsDetails>;
