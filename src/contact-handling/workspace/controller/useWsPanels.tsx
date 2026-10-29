// Workspace controller, slice 3 of 6 (P-EXTRACT C8b): Copilot composer props
// and Session Details, the shared header panel's state and the layout
// measurements, the header pins and home tabs, the docked Contact Details
// panel's state, switching the active card, the panel's one selection path,
// and the hover previews. The page's body, moved in order (hook order
// unchanged); see `useWorkspaceController`.
import React, { useState, useEffect, useRef, useCallback } from "react";
import type { DraggableVariant } from "@nicecxone/lyra-ui";
import type { TranscriptSession } from "@/components/transcript/InteractionTranscript";
import type { ContactHistoryEntry } from "@/components/agent-next-gen-contact-history";
import { useReplyBlockedReason, copilotSuggestionsFor, useChannelThreadMenu, type CopilotComposerProps } from "@/contact-handling";
import type { CustomerPanelTabLabel } from "@/components/customer-info";
import { LUCAS_THOMAS_ID } from "@/contact-handling/scenario-cases";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { copilotChipsFor, useRequestNextBestAction } from "@/contact-handling/next-best-action";
import { headerPatchForPin, homeTabApps, pinnedKeysFromHeader, useSettings } from "@/settings";
import { useHomeTabs } from "@/components/home-tabs-state";
import type { LucasThomasPanelKey, LucasThomasMemoryFocus } from "@/components/agent-next-gen-lucas-thomas-panels";
import type { PanelKey, PanelState } from "@/contact-handling/workspace/workspace-types";
import {
  HOVER_PREVIEW_OPEN_DELAY_MS,
  SHARED_PANEL_DEFAULT_WIDTH,
  CUSTOMERS_ONLY,
  LUCAS_THOMAS_COPILOT_SUGGESTIONS,
  LUCAS_THOMAS_COPILOT_SUGGESTION_LINKS,
  LUCAS_THOMAS_COPILOT_SUGGESTION_REPLACEMENTS,
} from "@/components/workspace/workspace-constants";
import { useMeasuredWidth } from "@/contact-handling/useMeasuredWidth";
import type { WorkspaceLate } from "./workspace-late";
import type { WsDetails } from "./useWsDetails";

/** The breakpoints the measured widths' readers branch on (`useMeasuredWidth`): the narrow layout (768), and the
 *  side panel's max-width and minimal thresholds (425, 350). */
const NARROW_BANDS = [(w: number) => w < 768] as const;
const SIDE_PANEL_CONTAINER_BANDS = [(w: number) => w < 768, (w: number) => w <= 425, (w: number) => w <= 350] as const;

export function useWsPanels(prev: WsDetails, late: WorkspaceLate) {
  const {
    activeChannelKey, activeInteraction, activeInteractionId, aiInPanel, channelPreviewThreadKey, customerPanelActiveTab,
    handleCopilotAsk, interactions, omni, openDetailPanelContent, panelPlacement,
    restoredCustomerPanelTabRef, scenarioCases, scenarioKeyOf, setActiveInteractionId, setCustomerPanelActiveTab,
    setHistoryConversationTab, setSelectedDetailPanelContent, setVoiceVideoFullScreen,
    setVoiceVideoWindowOpen, setWindowWidth, showSettings,
  } = prev;
  const replyBlockedReason = useReplyBlockedReason();
  // A Next Best Action's "Insert into reply" (P-CANVAS): the thread's chat composer takes it once.
  const [composerPrefill, setComposerPrefill] = useWorkspaceUiField("composerPrefill");
  // The Next Best Action on request (P-CANVAS; every AI display): the "What should I do next?" chip.
  const requestNextBestAction = useRequestNextBestAction(interactions);
  const copilotComposerProps = (interactionId: string, threadKey: string): CopilotComposerProps =>
    copilotChipsFor(baseCopilotComposerProps(interactionId, threadKey), prev.botHolds(interactionId), () =>
      requestNextBestAction(interactionId, threadKey),
    );
  const baseCopilotComposerProps = (interactionId: string, threadKey: string): CopilotComposerProps => {
    const isLucas = scenarioKeyOf(interactionId) === LUCAS_THOMAS_ID;
    const channel = interactions.find((i) => i.id === interactionId)?.threads.find((t) => (t.id ?? t.type) === threadKey)?.type;
    const prefillKey = `${interactionId}:${threadKey}`;
    return {
      prefill: composerPrefill[prefillKey],
      onPrefillConsumed: () =>
        setComposerPrefill((prev) => {
          if (!(prefillKey in prev)) return prev;
          const { [prefillKey]: _taken, ...rest } = prev;
          return rest;
        }),
      copilotSuggestions: isLucas ? LUCAS_THOMAS_COPILOT_SUGGESTIONS : copilotSuggestionsFor(channel),
      copilotSuggestionLinks: isLucas ? LUCAS_THOMAS_COPILOT_SUGGESTION_LINKS : undefined,
      copilotSuggestionReplacements: isLucas ? LUCAS_THOMAS_COPILOT_SUGGESTION_REPLACEMENTS : undefined,
      onCopilotSuggestionLink: (key: string) => openDetailPanelContent({ kind: "lucas", panel: key as LucasThomasPanelKey }),
      onCopilotAsk: (text: string) => handleCopilotAsk(interactionId, threadKey, text),
      replyBlockedReason: replyBlockedReason(channel),
    };
  };
  // Session Details is per thread (P-AIFIRST (k5) B): the session "View
  // Details" picked, keyed `${cardId}:${threadKey}`, and each thread's
  // current session, derived (`detailsCurrentSession`, below). The Session tab shows the
  // pick for the thread it's showing, else that thread's current session,
  // so it never reads "Select 'View Details' on a session…" and never shows
  // another tab's session.
  const [sessionDetailsPick, setSessionDetailsPick] = useState<{ key: string; session: TranscriptSession } | null>(null);
  /** A session row's Session Details (P-HOME-1n: the sessionDetails part, the reference slide-over under every AI
   *  display; it left Contact Details' tabs). Clicking the same session again closes it. It shows the thread whose
   *  row opened it: switching thread switches its session (k8 3). */
  const viewSessionDetails = (threadKey: string, session: TranscriptSession) => {
    if (!activeInteractionId) return;
    const key = `${activeInteractionId}:${threadKey}`;
    const showing =
      prev.selectedDetailPanelContent?.kind === "session" && sessionDetailsPick?.key === key && sessionDetailsPick.session.id === session.id;
    if (showing) return setSelectedDetailPanelContent(null);
    setSessionDetailsPick({ key, session });
    setSelectedDetailPanelContent({ kind: "session" });
  };
  useEffect(() => {
    if (activeInteractionId) {
      setVoiceVideoWindowOpen(false);
      setVoiceVideoFullScreen(false);
      // Per a LATER explicit follow-up request ("Marcus Webb shouldn't
      // default to Transcript on first open, show the Overview tab like
      // other contacts") — this reverses the earlier "the transcript
      // should be open when the contact moves to review" decision: `onReview`
      // (the incoming-call notice's own render site, far below) no longer
      // calls `setCustomerPanelActiveTab("Transcript")` at all, so this
      // effect's own unconditional reset below now applies to Marcus
      // exactly like every other interaction switch — no special-case
      // guard needed any more. (The reset itself displays as the
      // "Overview" tab — see this file's own
      // `label === "Details" ? "Overview" : label` render sites.) Per a
      // later explicit request, a restored tab overrides this default once.
      if (restoredCustomerPanelTabRef.current) {
        setCustomerPanelActiveTab(restoredCustomerPanelTabRef.current);
        restoredCustomerPanelTabRef.current = null;
      } else {
        setCustomerPanelActiveTab("Details");
      }
      setSessionDetailsPick(null);
      // Backstop reset for the restored hover-preview (`customerInfoPreview
      // Open`, see that state's own doc comment) — same "clear it on every
      // interaction switch" reset `AgentNextGenPage.tsx`'s own copy of this
      // state uses, so a preview left open (hovered, not yet dismissed) on
      // the outgoing interaction never carries over onto the incoming one.
      setCustomerInfoPreviewOpen(false);
    }
  }, [activeInteractionId]);
  const [panelMounted,   setPanelMounted]   = useState(false);
  const [panelState,     setPanelState]     = useState<PanelState>("closed");
  const [activePanelKey, setActivePanelKey] = useState<PanelKey | null>(null);
  // Defaults to "float" per explicit follow-up request — see 2.0's own
  // copy of this comment (AgentNextGenPage.tsx) for the full writeup on
  // reverting the earlier "docked" default and why no separate
  // remembered-preference flag is needed for "if docked then closed,
  // keep it docked on next open" — `panelVariant` itself already
  // persists across a close/reopen, `handlePanelButtonClick` just no
  // longer overwrites it.
  const [panelVariant,    setPanelVariant]    = useState<DraggableVariant>("float");
  const [panelWidth,      setPanelWidth]      = useState(SHARED_PANEL_DEFAULT_WIDTH);
  const [panelHeight,     setPanelHeight]     = useState(860);
  const [panelIsResizing, setPanelIsResizing] = useState(false);
  // Fullscreen toggle for the shared panel (AI/Notifications/Apps/
  // Calendar/etc.) — distinct from `panelVariant`'s "float"/"docked" (which
  // is `Draggable`'s own concept and stays within/beside the interaction
  // container). This instead expands the panel to fill the ENTIRE main
  // content container (`containerRef` — everything right of LeftNav, below
  // AppHeader; the same box the Customer Information panel/main interaction
  // `Container` live in), covering that area only — LeftNav and AppHeader
  // stay visible, unlike a real page-covering modal. Implemented as a
  // separate `position: absolute; inset: 0` overlay (`sharedPanelFullScreenOverlay`
  // below), positioned against `containerRef` (which is already `relative`)
  // rather than the viewport, reusing the same header/body content but
  // rendered independently of `Draggable` entirely — `Draggable` has no
  // fullscreen concept of its own (only float/docked), and coercing its
  // "float" variant into spanning the container would mean fighting its
  // internal width/height/offset state and its own
  // `clampOffsetIntoViewport` containment logic (viewport-based, not
  // container-based, and not easily repurposed). Whichever of
  // `panelVariant`'s two states was active before entering fullscreen is
  // preserved (untouched) and simply resumes when fullscreen exits.
  const [panelFullScreen, setPanelFullScreen] = useState(false);
  // Keeps `sharedPanelFullScreenOverlay` mounted for a beat after
  // `panelFullScreen` flips back to false, so the exit transition (see
  // that overlay's own doc comment, and `fullScreenAnimTimer` below) can
  // actually play instead of the overlay disappearing instantly — same
  // "state machine outlives the boolean it's animating" shape as
  // `panelState`/`panelOpen` above, just scoped to fullscreen alone
  // rather than the whole panel's mount lifecycle.
  const [fullScreenRendered, setFullScreenRendered] = useState(false);
  // The actual opacity/scale target for the fullscreen overlay's CSS
  // transition — deliberately a SEPARATE flag from `panelFullScreen`
  // itself. A freshly-mounted DOM node that starts life with `opacity: 1`
  // has no earlier frame at `opacity: 0` for the browser to transition
  // FROM, so it would just pop in instantly with no visible animation.
  // Mounting at the "hidden" values first, then flipping this to `true`
  // one frame later (`requestAnimationFrame`, see the effect below) gives
  // the browser a real prior frame to interpolate from. Exiting doesn't
  // need this two-step dance — it's already mounted/visible, so setting
  // this straight to `false` immediately starts the fade/scale-out.
  const [fullScreenVisible, setFullScreenVisible] = useState(false);
  // Which team is picked in the "New Outbound" Teams group's own "Choose
  // team" sub-picker (see `outboundConfig` below, and `OUTBOUND_TEAM_
  // MEMBERS`/`CreateNewOutboundGroup.subFilter`'s own doc comments) — ""
  // means no team picked yet. Lives here (not inside create-new.tsx) since
  // that component has no concept of "team," only of a generic per-group
  // `subFilter` control it renders and reports picks from.
  const [selectedOutboundTeamId, setSelectedOutboundTeamId] = useState("");
  // Exit the shared panel's fullscreen whenever the agent navigates away
  // from the current main-content context — clicking a different
  // assignment card, Home, or Settings (and starting/selecting any new
  // interaction, e.g. via CreateNew/Outbound) all funnel through
  // `activeInteractionId`/`showSettings` changing, so one effect here
  // covers every one of those call sites instead of threading
  // `setPanelFullScreen(false)` through each of them individually — same
  // "effect rather than touching every call site" approach `showSettings`'s
  // own reset (right above, near `activeInteractionId`'s own declaration)
  // already uses. `panelVariant` itself is untouched, so the panel simply
  // resumes whichever of "docked"/"float" it was in before fullscreen,
  // exactly like exiting via the toggle button itself. NOTE: this alone
  // doesn't cover clicking the card that's ALREADY the active one — that
  // sets the same `activeInteractionId`, no value change, so this effect
  // doesn't fire — see the assignment card's own `onClick` (further down),
  // which calls `setPanelFullScreen(false)` directly for that reason.
  useEffect(() => {
    setPanelFullScreen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInteractionId, showSettings]);
  // `containerRef` is the CONTENT container — everything to the right of
  // LeftNav (its own JSX comment further down calls it "Content area"),
  // also used elsewhere for AI/Notifications float positioning. This is
  // the real, scoped "interaction container" a container query should
  // react to — NOT the whole page/viewport: measuring the full "Body:
  // LeftNav + Content" row (an earlier version of this guard did, via a
  // since-removed `bodyContainerRef`) is indistinguishable from a plain
  // page-width media query, since that row spans edge-to-edge with
  // nothing else constraining it. `containerRef`'s own width, by
  // contrast, genuinely shrinks/grows independently of the page (e.g. as
  // LeftNav's own rail width changes between its 52px/256px states) —
  // per explicit follow-up request, the Customer Information panel's own
  // narrow guard below (`isSidePanelContainerNarrow`) reads THIS
  // measurement, not a page-wide one. Safe from feedback loops: this div
  // is a flex-1 item sized by ITS OWN PARENT (the Body row), not by its
  // children — so whether the docked panel INSIDE it is pinned or
  // floating doesn't change this box's own measured width.
  const containerRef  = useRef<HTMLDivElement>(null);
  // Its readers' breakpoints commit at once; other changes once the size settles (no render per frame of the rail's
  // or the panel's width animation, P-HOME-1m).
  // A full-screen panel sizes itself to this width, so it follows every frame while full screen (set below).
  const sidePanelFullScreenRef = useRef(false);
  const sidePanelContainerWidth = useMeasuredWidth(containerRef, SIDE_PANEL_CONTAINER_BANDS, () => sidePanelFullScreenRef.current);
  // The "Body: LeftNav + Content" row (both the nav and everything to its
  // right sit inside this one div, see its own JSX comment further down) —
  // measured via ResizeObserver so `isNavNarrow` below reacts to this row's
  // own box width, a real container query, rather than the whole browser
  // viewport (`window.innerWidth`), which it used before this was pointed
  // out as a mismatch. Deliberately NOT `containerRef` above — the side
  // nav's own auto-collapse/overlay decision needs a measurement that
  // doesn't depend on the nav's own current rail width (52px vs 256px),
  // which `containerRef` (content area, i.e. "everything right of
  // LeftNav") does; this row includes LeftNav itself, so its width is
  // unaffected by the nav's own open/collapsed state.
  const bodyContainerRef = useRef<HTMLDivElement>(null);
  const bodyContainerWidth = useMeasuredWidth(bodyContainerRef, NARROW_BANDS);
  // Record header's own measured width — drives the Add Channel/Customer
  // Information buttons' icon-only collapse (`recordHeaderWidth < 768`,
  // render site further down). Used to just reuse `sidePanelContainerWidth`
  // (`containerRef` above) instead of a dedicated measurement here — see
  // that old reasoning in git history — but that only held up while the
  // Customer Information toggle button was gated to the panel being
  // CLOSED (`showPanelToggle`), so `containerRef` (the docked panel's own
  // sibling) never had the panel competing with it for width whenever the
  // button was actually on screen. Once the button moved into `PageHeader`
  // and started rendering unconditionally (open or closed, per explicit
  // request), that assumption broke: `containerRef` spans BOTH the main
  // content column and the docked panel, so dragging the panel wider
  // visibly squeezes this header (and its buttons) while
  // `sidePanelContainerWidth` — measuring the pair's combined width, which
  // the drag doesn't change — stays flat, letting the buttons run out of
  // real room well before the (never-firing) breakpoint. Confirmed live:
  // resizing the docked panel wider shifted the header's own buttons left
  // with no icon-collapse ever kicking in. A dedicated measurement of just
  // the header itself (via `PageHeader`'s own forwarded ref, no extra
  // wrapper div needed) reacts to the ACTUAL space this row has, docked
  // panel or not. Safe to measure directly now, unlike the row this button
  // used to live in (see that old attempt's own note about a nested
  // `TabList`'s `container-type: inline-size` interfering) — the channel
  // tabs live in their own separate row below `PageHeader` now, so this
  // one has no such nested container query to fight.
  // A callback ref (not `useRef` + a mount-once `useEffect`, like
  // `containerRef`/`bodyContainerRef` above) — this is deliberate, not a
  // stylistic swap: those two both measure elements that exist for the
  // entire lifetime of this component, so a `[]`-deps effect reading
  // `.current` once on mount always finds them already attached.
  // `PageHeader` itself only exists conditionally (`showPageHeader &&
  // activeInteraction && ...`, several branches deep) — on any render
  // where it isn't mounted yet (e.g. the agent's on the Desk dashboard
  // when this component first mounts), that same mount-once effect would
  // find `recordHeaderRef.current` still `null`, bail out via its own
  // early return, and never run again (empty deps array), permanently
  // leaving `recordHeaderWidth` stuck at its initial `9999` — confirmed
  // live as exactly this: the buttons never collapsed at all, no matter
  // how narrow the header actually got, because the `ResizeObserver` never
  // got attached to the real element in the first place. A callback ref
  // fires on every actual mount/unmount of the node it's attached to,
  // however many times that happens over this component's lifetime, so
  // the observer below gets (re)attached correctly the moment `PageHeader`
  // itself first mounts, not just once at this component's own mount.
  const [recordHeaderNode, setRecordHeaderNode] = useState<HTMLDivElement | null>(null);
  const recordHeaderRef = useCallback((node: HTMLDivElement | null) => {
    setRecordHeaderNode(node);
  }, []);
  const recordHeaderWidth = useMeasuredWidth(recordHeaderNode, NARROW_BANDS);
  const panelFloatLeft = useRef<number | null>(null);
  const panelFloatTop  = useRef<number | null>(null);
  const panelRef       = useRef<HTMLDivElement>(null);
  const panelAnimTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fullScreenAnimTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Defaults to "salesforce" (per explicit request) rather than starting
  // unselected — Screen Pop should open straight into the mocked
  // Salesforce login instead of an empty picker the agent has to act on
  // first.
  const [screenPopApp, setScreenPopApp] = useState("salesforce");
  // "View All Apps" kebab menu — lists every app-header panel button
  // regardless of pinned state, with a `PanelPinButton` per row so any app
  // can be pinned/unpinned right from the menu. All nine start pinned
  // (matching today's always-visible header row); unpinning one just hides
  // its persistent header icon — the app's still reachable by clicking its
  // row in this menu, which opens the shared panel exactly like the header
  // icon would.
  // Default pinned set — header shows (right to left) Notifications,
  // Agent Chat, Search; Schedule/Customers/Accounts/Tickets/WEM/Screen Pop
  // start unpinned. Customers/Accounts/Tickets are also filtered out of the
  // "View All Apps" menu itself (see `HIDDEN_FROM_APPS_MENU` below), making
  // them fully unreachable from the app header; Schedule/Screen Pop/WEM
  // aren't in that list, so unpinning them just hides their header icon —
  // all three stay reachable via "View All Apps". WEM starts unpinned again
  // per a follow-up explicit request ("unpin WEM when the app loads") —
  // still dropped from `HIDDEN_FROM_APPS_MENU` (unlike Customers/Accounts/
  // Tickets), so it's a real, clickable row in "View All Apps" (with its
  // own `PanelPinButton` to re-pin it) rather than fully unreachable like
  // those three; it just no longer shows a persistent header icon BY
  // DEFAULT on load — an agent can still pin it back from that menu, which
  // then persists for the rest of the session same as any other app.
  // P-SETTINGS: the pins live in the settings store's `header` section
  // (Search/Agent Chat/Calendar/Notifications are header flags, the rest are
  // extra pins), so the apps menu's pin buttons and the Settings page edit
  // the same persisted values. Defaults are unchanged: Notifications, Agent
  // Chat, Schedule and Search pinned.
  const [headerSettings, updateHeaderSettings] = useSettings("header");
  const pinnedKeys: Record<PanelKey, boolean> = pinnedKeysFromHeader(headerSettings);
  const togglePinnedKey = (key: PanelKey) => updateHeaderSettings((prev) => headerPatchForPin(prev, key, !pinnedKeysFromHeader(prev)[key]));
  // Home tabs: Dashboard plus the apps placed as "tab" (none on Phase 1, so no tab bar).
  const tabApps = homeTabApps(headerSettings);
  const homeTabs = useHomeTabs(tabApps);
  // The Customers left-nav page's own customer tabs.
  const customersPageTabs = useHomeTabs(CUSTOMERS_ONLY);
  const activeDeskTab = homeTabs.activeTab;
  const [appsMenuOpen, setAppsMenuOpen] = useState(false);

  /* Interior panel (right) */
  const [interiorPanelOpen, setInteriorPanelOpen] = useState(false);
  /* Which home-tab queue widget (if any) is selected — reuses the same
     interior panel slot as Case Details, swapping its content instead of
     stacking a second right-docked panel. */
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  /* Which Contact History row (if any) is selected — a THIRD job for that
     same shared interior panel slot, per explicit request: clicking a row
     now opens its summary here (Duration + Call Notes, via
     `ContactHistoryEntryDetail`) with Redial/Re-open buttons, instead of
     reopening the contact directly. See the panel's own `open`/
     `headerTitle`/content wiring further down for how the three jobs
     (Case Details default, Queue drill-down, this) take priority over one
     another. */
  const [selectedContactHistoryEntry, setSelectedContactHistoryEntry] = useState<ContactHistoryEntry | null>(null);

  // The Dial Pad request (Redial, Save & Redial, the Lucas call confirm) and
  // the pending redial it completes live in the shared `useOutboundDial`
  // (P0.5b.2): `outboundDial.dialpadRequest`, `openRedialPad`,
  // `openCardRedialPad`, `requestDialpad`. Redial pre-fills the customer's
  // name and a picker of their numbers on file, as Desk always did — this
  // page used to keep a plain single-number pad; the picker is kept here
  // by the row 16 parity ruling (confirmed 2026-10-14).


  /* Customer Information panel — a left-docked `SidePanel` (per explicit
     request to move this content into a left side panel, matching a
     reference screenshot), built via the local `CustomerInformationSide-
     Panel` wrapper. State/wiring below mirrors `AgentNextGenTemplate
     .stories.tsx`'s own `CustomerInformationPanel` usage — the current
     reference for a left-docked side panel in this exact spot — rather
     than the plain open/closed boolean the right-docked `InteriorPanel`
     version this replaces got away with: a `SidePanel` needs pinned vs.
     hover-preview state and its own narrow-container guard, since (unlike
     `InteriorPanel`) it has no such handling built in. */
  // Closed by default again (per yet another explicit follow-up request —
  // "start every conversation with the contact details panel closed" —
  // reversing the "open by default, even Marcus Webb" decision this
  // comment used to describe, which itself had reversed an earlier
  // "closed by default"/"I changed my mind" decision before that). A fresh
  // interaction's Customer Information panel now starts CLOSED once more;
  // every `isNewInteraction`-gated launch-path call site that had been
  // flipped to `setSidePanelOpen(true)` is back to `setSidePanelOpen(false)`
  // — including Marcus Webb's own "Review"/"Takeover" handlers — see each
  // of those call sites' own doc comments for the fuller "why" history of
  // this flip-flopping back and forth. Manual/derived toggles (the hover-
  // preview timer, the panel's own close button, the session row's panel-
  // toggle icon, the per-assignment state restore, the Session tab's
  // "Edit" button, the "View Details"/live-call-transcript collapse-if-
  // already-showing toggles) are deliberately untouched — this only
  // governs what a NEW/reopened interaction starts at, not any of those
  // user-initiated actions.
  const [sidePanelOpen,     setSidePanelOpen]     = useState(false);
  // Drives the "Open Details Panel" toggle's own hover-preview `Popover` —
  // this button (and this state) has moved around this file's history a
  // few times: record header `actions` → session row
  // (`TranscriptSessionSeparator`'s own `onToggleDetailsPanel`) → back to
  // the record header `actions` again (per the latest explicit request,
  // "move the details side panel toggle to above the session row..." —
  // see that `actions` block's own doc comment). The state/handlers
  // themselves were never tied to any one of those locations — only the
  // JSX rendering the button+`Popover` moved. Same "parent owns the hover
  // timer, the trigger just reports hover in/out" split `AgentNextGenPage
  // .tsx`'s still-live `CustomerInfoHoverPreview` call site uses.
  const [customerInfoPreviewOpen, setCustomerInfoPreviewOpen] = useState(false);
  const customerInfoPreviewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The channel icon being hover-previewed (one at a time), like `customerInfoPreviewOpen`.
  const [channelHoverPreviewKey, setChannelHoverPreviewKey] = useState<string | null>(null);
  // A multi-thread channel icon's thread menu (k6 4, k8 7/10): open on hover or click.
  const threadMenu = useChannelThreadMenu();
  const channelHoverPreviewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const channelHoverOpenTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Backstop for `customerInfoPreviewOpen` — per explicit bug report ("when
  // the session details panel is closed the hover panel is displayed even
  // if I don't hover on the panel icon... doesn't go away until I hover
  // back over the panel icon"). The toggle button (and the `Popover` around
  // it, currently rendered in the record header's own `actions` block) only
  // exists in the DOM while `!sidePanelOpen` — see that render site's own
  // gate. Opening the real panel unmounts it without ever running a
  // `mouseleave`/`blur` on the trigger, so `customerInfoPreviewOpen` was
  // left stuck at whatever it was the instant before (often `true`,
  // mid-hover) — invisible while `sidePanelOpen` is true (the `open=
  // {customerInfoPreviewOpen && !sidePanelOpen}` multiply at the render
  // site zeroes it out), but the raw state itself never actually got
  // reset, so the moment the panel closes again the preview pops back
  // open with no fresh hover to have caused it — and since it never really
  // "opened" via a hover this time, there's no matching hover-out to
  // schedule its close either, until the agent happens to hover the icon
  // and leave again. Mirrors `AgentNextGenPage.tsx`'s own identical
  // backstop (`[activeInteraction?.id, sidePanelOpen]` effect) exactly,
  // just against this page's own `activeInteractionId`. (Has to live here,
  // after `sidePanelOpen` is declared above — a copy of this effect placed
  // earlier in the file, before that declaration, is a TDZ error:
  // `sidePanelOpen` used in a dependency array before its own `useState`
  // line runs.)
  useEffect(() => {
    setCustomerInfoPreviewOpen(false);
  }, [activeInteractionId, sidePanelOpen]);
  // Same backstop as `customerInfoPreviewOpen`'s own, just above, for the
  // channel icons' hover preview — also cleared whenever a channel
  // preview actually opens (clicking an icon, or the "Contact Details"
  // button switching away from one), so a lingering hover-preview never
  // shows stale on top of the real panel now genuinely showing that
  // content.
  useEffect(() => {
    setChannelHoverPreviewKey(null);
  }, [activeInteractionId, sidePanelOpen, channelPreviewThreadKey]);
  // Drives `CustomerInformationSidePanel`'s own `focusTabOverride` prop —
  // see that prop's doc comment (agent-next-gen-customer-info-panel.tsx).
  // Fed by the Contact Overview's own "View customer info" link
  // (`focusCustomerPanelTab` below) via `InteractionTranscript`'s
  // `onViewCustomerInfo`.
  const [customerPanelFocusTab, setCustomerPanelFocusTab] = useState<
    { tab: CustomerPanelTabLabel; version: number } | undefined
  >(undefined);
  const customerPanelFocusTabVersionRef = useRef(0);
  // Per a later explicit request ("move the customer information content
  // back to the side panel"): "View customer info" (from the main
  // transcript's Contact Overview, the docked panel/hover preview's own
  // embedded accordion, or Marcus Webb's clickable name link) now opens/
  // focuses the DOCKED `CustomerInformationSidePanel` itself, switching it
  // into the "Customer Info" drill-in view (`customerPanelActiveTab`),
  // rather than the separate floating `InteriorPanel` overlay this used to
  // open (removed — see git history/this state's own former doc comment).
  // Still bumps `customerPanelFocusTabVersionRef`/`customerPanelFocusTab`
  // for `focusTabOverride` (see that prop's own doc comment, agent-next-
  // gen-customer-info-panel.tsx) — harmless, since `bodyOverride`/
  // `headerTabsOverride` already bypass the docked panel's internal tab
  // system entirely; kept rather than removed for the same minimal-
  // footprint reasoning documented elsewhere in this file. No longer
  // takes a `tab` argument — every call site always wants "Overview" (the
  // only tab `useCustomerDetailsInteriorPanel`'s own `activeTab` resets to
  // per new `recordId`), so there's nothing left to vary.
  // Which Experience Memory event the docked "Experience Memory" view opens expanded (set by the approval card's checklist links).
  const [marcusMemoryFocus, setMarcusMemoryFocus] = useState<string>("refund-escalated");
  const [experienceMemoryFocus, setExperienceMemoryFocus] = useState<LucasThomasMemoryFocus>("card-declined");
  const openExperienceMemoryInSidePanel = (focus: LucasThomasMemoryFocus = "card-declined") => {
    setExperienceMemoryFocus(focus);
    setCustomerPanelActiveTab("Experience Memory");
    showContactDetails();
  };
  /** The Artifacts list ("View All"): Contact Details' sub-page, in its slide-over (P-HOME-1n). */
  const openArtifactsList = () => {
    setCustomerPanelActiveTab("Artifacts");
    showContactDetails();
  };
  const focusCustomerPanelTab = () => {
    customerPanelFocusTabVersionRef.current += 1;
    setCustomerPanelFocusTab({ tab: "Overview", version: customerPanelFocusTabVersionRef.current });
    setCustomerPanelActiveTab("Customer Info");
    // Through the panel's one selection path (`showContactDetails`): the
    // thread is released, the hover preview closes.
    showContactDetails();
  };
  // No setter — always pinned. `onPinToggle` is deliberately left unset on
  // the real `SidePanel` below (see its own doc comment), so there's no
  // path that ever actually unpins this; kept as `useState` rather than a
  // plain `const` only so a future unpin path can be wired back in without
  // re-threading every `sidePanelPinned` read site.
  const [sidePanelPinned] = useState(true);
  const [sidePanelResizing, setSidePanelResizing] = useState(false);
  // 340 — explicit starting width for the SidePanel version (was 425,
  // matching the old InteriorPanel's `maxWidth` default) — per explicit
  // request.
  const [sidePanelWidth, setSidePanelWidth] = useState(340);
  // Full-screen toggle (per explicit request) — see
  // `CustomerInformationSidePanel`'s own doc comment for how this actually
  // renders (an unpinned overlay sized to the parent Container's own
  // measured width, `sidePanelContainerWidth`, rather than the normal
  // drag-resized `sidePanelWidth`). Reset to `false` whenever the panel is
  // explicitly closed (`handleSidePanelClose` below) — a freshly reopened
  // panel shouldn't silently reopen full-screen from a previous session.
  const [sidePanelFullScreen, setSidePanelFullScreen] = useState(false);
  sidePanelFullScreenRef.current = sidePanelFullScreen;
  const sidePanelHoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Per the MOST RECENT explicit follow-up request ("start every
  // conversation with the contact details panel closed") — reverses yet
  // again. The immediately prior request ("every interaction should open
  // the contact details when loaded and display the overview tab, even
  // Marcus Webb") had hardcoded `setSidePanelOpen(true)` on every "new
  // interaction" launch path below; that in turn had reversed a request
  // before that ("have session details closed for new interactions - I
  // changed my mind"), which had itself reversed an even earlier request
  // ("let's have the session details open when interactions launch"),
  // which had reversed a request before THAT ("keep the customer
  // information panel closed when a new assignment is opened"), which
  // itself had reversed the original feature (every freshly started/
  // quick-dialed/redialed/reopened interaction's panel open in whichever
  // state the agent last picked — see this file's own git history for that
  // version's `lastSidePanelOpenChoice` ref, removed along with every call
  // site that read it, back when that earliest reversal landed). Every
  // "new interaction" launch path below now hardcodes
  // `setSidePanelOpen(false)` again instead — a brand-new assignment's
  // Customer Information/"Session Details" panel always starts CLOSED,
  // full stop, regardless of what the agent did on any other assignment
  // (this is a plain hardcoded value again, not a revival of the old
  // `lastSidePanelOpenChoice` "remember last choice" mechanism). Switching
  // between two ALREADY-active assignments is a separate mechanism
  // (`sidePanelStateByAssignmentId`, just below) and is
  // untouched by this — an assignment the agent already closed the panel on
  // still shows it closed again when switched back to.

  // Container-width pin guard — `SidePanel` has no built-in "too narrow,
  // force an overlay" handling of its own (unlike `InteriorPanel`), so this
  // reproduces it: reads `sidePanelContainerWidth` (`containerRef` — the
  // real content-area container, see its own doc comment above) to force
  // the panel unpinned below 768px of THAT container's width, so it
  // renders as a floating overlay instead of pushing the main content
  // column over. Deliberately a real container query on the content area,
  // not on the whole page/viewport — see `containerRef`'s own doc comment
  // for why that distinction matters.
  //
  // Per explicit request, this no longer force-CLOSES the panel when the
  // container narrows (it used to: `setSidePanelOpen(false)`) — an agent
  // who had it open keeps it open, just as a floating overlay instead of
  // docked, once `effectiveSidePanelPinned` below goes false. Only
  // `sidePanelPinned`'s effective value changes here; `sidePanelOpen` is
  // untouched by width and only ever changes via an explicit agent action
  // (the panel's own close button, the header icon toggle, or a new
  // interaction launching — which always starts it CLOSED now, per the doc
  // comment a few lines above).
  const isSidePanelContainerNarrow = sidePanelContainerWidth < 768;
  const effectiveSidePanelPinned = isSidePanelContainerNarrow ? false : sidePanelPinned;

  // Auto full-screen — per explicit request, an OPEN panel automatically
  // goes full-screen once the container narrows down to 425px (the
  // panel's own normal max width — see `CustomerInformationSidePanel`'s
  // `maxWidth`), rather than staying docked/overlaid at a width that no
  // longer comfortably fits its own content next to the interaction
  // column. Only forces full-screen ON when this crosses that threshold
  // (or when the panel opens while already at/under it) — does NOT force
  // it back OFF on its own when the container widens back out past 425,
  // and does nothing at all if the agent has already manually exited
  // full-screen since the last such crossing (the effect only re-fires
  // when one of its own two dependencies actually changes value, not on
  // every render), so a manual "Exit Full Screen" click while still
  // narrow isn't immediately fought and re-applied. (The narrower 350px
  // threshold below DOES force it back off, but only on its own specific
  // crossing — see that effect's own doc comment.)
  const isSidePanelAtMaxWidthBreakpoint = sidePanelContainerWidth <= 425;
  useEffect(() => {
    if (isSidePanelAtMaxWidthBreakpoint && sidePanelOpen) {
      setSidePanelFullScreen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSidePanelAtMaxWidthBreakpoint, sidePanelOpen]);

  // Below 350px of the same container width, per explicit follow-up
  // request: hide the full-screen toggle button entirely (see
  // `onToggleFullScreen` at the render call site below — passing
  // `undefined` there hides it, same "no prop, no button" pattern
  // `onClose` already uses) rather than leaving a control on-screen with
  // no room left to usefully act on. Crossing back up over 350px both
  // restores that button AND explicitly exits full-screen — unlike the
  // 425px threshold above (which never forces an exit on its own), this
  // one always does, since the button being hidden below 350px means the
  // agent had no way to have manually exited full-screen in the meantime
  // anyway, so there's nothing to preserve/avoid fighting here. Only
  // fires on the actual crossing (dependency array), not continuously.
  const isSidePanelAtMinimalThreshold = sidePanelContainerWidth <= 350;
  useEffect(() => {
    if (!isSidePanelAtMinimalThreshold) {
      setSidePanelFullScreen(false);
    }
  }, [isSidePanelAtMinimalThreshold]);

  // Used to force-close (and reset pinned) whenever the agent left the
  // interaction view entirely (dismissing it, or navigating to Desk/
  // Settings/another tab) — removed per explicit request: the panel now
  // just keeps whatever open/closed state the agent last left it in for
  // an EXISTING assignment (a NEW one always starts closed regardless —
  // see the "keep the customer information panel closed when a new
  // assignment is opened" doc comment above), rather than being force-
  // closed by navigating away and force-reopened for every new one. Only
  // an explicit close (the
  // panel's own close button, or the header icon toggle while pinned)
  // changes it now.

  // Hover-preview handlers — guarded on `sidePanelPinned` (not the
  // narrow-adjusted `effectiveSidePanelPinned`): once pinned, hover does
  // nothing at all in either direction, open/closed is controlled solely by
  // the click toggle while pinned, same as every other `SidePanel` consumer.
  const onSidePanelHoverStart = () => {
    if (sidePanelPinned) return;
    clearTimeout(sidePanelHoverTimer.current);
    setSidePanelOpen(true);
  };
  const onSidePanelHoverEnd = () => {
    if (sidePanelPinned) return;
    sidePanelHoverTimer.current = setTimeout(() => setSidePanelOpen(false), 300);
  };
  // Fired by the panel's own header button (a `PanelPinButton` wearing a
  // `PanelLeftClose` icon instead of the default `Pin` glyph, per explicit
  // request) — just hides the panel, per explicit follow-up request;
  // leaves `sidePanelPinned` untouched (still pinned if it was), so the
  // session row's own "Open Details Panel" toggle
  // (`handleSidePanelIconToggle`, wired via `onToggleDetailsPanel` — see
  // that call site) still reopens it in the same pinned state rather than
  // this having quietly unpinned it first.
  const handleSidePanelClose = () => {
    setSidePanelOpen(false);
    setSidePanelFullScreen(false);
    // The slide-out's thread lives in this same panel, so closing the panel
    // clears it too: the next open lands on Contact Details.
    if (activeInteractionId) omni.close(activeInteractionId);
    // Per later explicit request ("put the transcript and session tabs
    // into the new customer information side panel"): a closed-then-
    // reopened panel always lands back on "Details" (the accordions),
    // same as a freshly switched-to interaction — see
    // `customerPanelActiveTab`'s own doc comment.
    setCustomerPanelActiveTab("Details");
  };

  /* Per-assignment memory for the Customer Information panel's full-screen
     state only — per explicit request: switching between two already-
     active assignments (e.g. clicking a different LeftNav assignment card)
     must not let one assignment's full-screen choice leak onto another.
     Leaving the panel full-screen on assignment B, then switching to A,
     should show A's panel at its normal (non-full-screen) width — not
     full-screen just because that's wherever the shared
     `sidePanelFullScreen` state happened to land last.

     `sidePanelOpen` itself is deliberately NOT remembered per-assignment
     anymore — per later explicit bug report ("when I launch marcus webb
     then launch another interaction, when I go back to marcus and the
     other interaction the voice transcript side panel is open - it should
     not be"): every switch now closes the panel unconditionally (see the
     plain `setSidePanelOpen(false)` below, no `saved.open` branch), same
     as a genuinely first-ever open already did. An assignment whose panel
     the agent had open (say, the live call's own "Transcript" toggle) goes
     back to closed the moment they navigate away — reopening it again is
     always a fresh, deliberate action on return, never something this
     page silently restores on their behalf.

     Deliberately a small helper called from every place `activeInteractionId`
     changes, rather than a `useEffect` keyed on it (the "effect instead of
     touching every call site" pattern this file otherwise prefers — see
     `panelFullScreen`'s own reset effect above). An effect can't do this
     correctly here: several of the switch call sites below also set
     `sidePanelOpen` themselves (their own `isNewInteraction` branches) in
     the SAME batch as `setActiveInteractionId`. React applies every
     setState in that batch together in one render, so by the time any
     effect watching `activeInteractionId` could run, `sidePanelOpen`
     already reflects the NEW assignment's value — there's no render left
     in which the OUTGOING assignment's actual value is still visible to
     read. This helper instead reads `sidePanelOpen`/`sidePanelFullScreen`
     synchronously, via plain closure, at the moment it's called — BEFORE
     any state update from this switch has been applied — which is exactly
     the outgoing assignment's real last value every time.

     Only covers open/full-screen, per explicit request — `sidePanelPinned`/
     `sidePanelWidth` stay shared across assignments (read more like a
     general layout preference than something tied to one specific
     assignment, and weren't asked for); extend the same way if that's ever
     requested too.

     A never-before-seen assignment id (no snapshot yet) always gets
     `fullScreen: false` — a fresh assignment should never silently inherit
     full-screen from whatever was active before.

     Restoring a different assignment's own full-screen value here
     used to still visibly play `SidePanel`'s own width/opacity transitions
     (side-panel.tsx — `transition: "width 250ms cubic-bezier(...)"` on
     open/close, `"opacity 150ms ease 30ms"` on its inner content) exactly
     as if the agent had just clicked the toggle themselves — switching TO
     an assignment whose panel happens to be closed (or full-screen)
     visibly slid the panel shut (or expanded it) on every single switch,
     read as "disorienting" per explicit report, since none of that was an
     actual open/close ACTION, just this assignment's panel already having
     been left that way. A first attempt suppressed that transition
     outright (a `!important` CSS class toggled on briefly via this
     helper), which fixed the sliding but traded it for a different
     problem, also reported live: the panel then just snapped into view
     with no animation at all, while the content column beside it (see
     `key={`interaction-${activeInteraction.id}`}` below) was still doing
     its own soft `animate-in fade-in-0` — the panel read as "not fading,
     just appearing," out of sync with everything else on the same switch.

     Fixed properly at the render site instead (not here): the panel is
     now wrapped in a `key`ed div using `activeInteraction.id`, the exact
     same "force a full remount on every genuine switch" technique the
     content column already uses for its own fade-in — see that div's own
     doc comment further down for why this solves BOTH problems at once
     without any transition-suppression trickery. This helper's own job
     stays exactly what it says above: decide WHAT `sidePanelFullScreen`
     should be for the incoming assignment (`sidePanelOpen` is now always
     just closed — see this helper's own top doc comment), not HOW that
     change gets animated. */
  const sidePanelStateByAssignmentId = useRef(new Map<string, { open: boolean; fullScreen: boolean; tab: typeof customerPanelActiveTab }>());
  const switchActiveInteraction = (nextId: string | null) => {
    const outgoingId = activeInteractionId;
    if (outgoingId !== nextId) setHistoryConversationTab(null);
    if (outgoingId && outgoingId !== nextId) {
      sidePanelStateByAssignmentId.current.set(outgoingId, {
        open: sidePanelOpen,
        fullScreen: sidePanelFullScreen,
        tab: customerPanelActiveTab,
      });
    }
    setActiveInteractionId(nextId);
    if (nextId && nextId !== outgoingId) {
      const saved = sidePanelStateByAssignmentId.current.get(nextId);
      // Per explicit bug report ("when I go back to marcus and the other
      // interaction the voice transcript side panel is open - it should
      // not be"): `sidePanelOpen` is always force-closed on every switch
      // now, whether or not a saved entry exists — only `sidePanelFullScreen`
      // still reads from `saved` (see this helper's own top doc comment for
      // the full "why"). Every "new interaction" launch path's own
      // hardcoded `setSidePanelOpen(false)` right after calling this is
      // now redundant with this line, but harmless alongside it.
      // Per latest request: the docked panel's open state AND the last view visited (Customer Info,
      // Experience Memory, Artifacts…) are remembered per assignment and restored when the agent returns.
      setSidePanelOpen(saved ? saved.open : false);
      setSidePanelFullScreen(saved ? saved.fullScreen : false);
      restoredCustomerPanelTabRef.current = saved ? saved.tab : null;
    }
  };

  // Agent takes over the AI-led Lucas chat (the composer's "Take over chat" button). The engine withdraws an unfinished
  // wrap-up card, starts the SLA clock and plays the bot's warm handoff (typing, the transfer message, Lucas's reply).
  const handleLucasTakeover = () => scenarioCases.takeOver(LUCAS_THOMAS_ID);
  // Toggles the Customer Information/"Session Details" panel — this
  // button's location has moved a few times across this file's history
  // (record header `actions` → `TranscriptSessionSeparator`'s own session
  // row → back to the record header `actions` again, per the latest
  // explicit request "move the details side panel toggle to above the
  // session row to the right of the voice + button group" — see that
  // `actions` block's own doc comment for the full history/reasoning).
  // This function's click half has stayed the same throughout every move.
  // The right panel's one selection path (browser check, 2026-10-16). The
  // header toggle group (Contact Details and the thread icons), the hover
  // previews' actions (View customer info, Link to existing customer,
  // Experience Memory) and the nav rows all choose what the panel shows
  // here, so its header, selected toggle and body change together, in every
  // AI display mode. Since P-HOME-1n Contact Details (the slide-over) and a
  // panel thread (under "main") are on screen together, each its own toggle;
  // picking a thread is `handleChannelSelect`.
  // P-HOME-1n: Contact Details is a layout part in the reference slide-over (`{ kind: "contactDetails" }`), not the
  // docked panel; the docked panel keeps the thread (main) and panel mode's AI Overview.
  const contactDetailsShowing = prev.selectedDetailPanelContent?.kind === "contactDetails";
  // With Contact Details gone from it, the docked panel has nothing to show outside panel mode but a thread: it
  // closes rather than sit empty.
  useEffect(() => {
    if (!aiInPanel && sidePanelOpen && !channelPreviewThreadKey) setSidePanelOpen(false);
  }, [aiInPanel, sidePanelOpen, channelPreviewThreadKey]);
  function showContactDetails() {
    setSelectedDetailPanelContent({ kind: "contactDetails" });
    clearTimeout(customerInfoPreviewTimer.current);
    setCustomerInfoPreviewOpen(false);
  }
  const selectPanel = (target: { kind: "details" } | { kind: "thread"; cardId: string; key: string }) => {
    // Any toggle closes any open hover preview at once.
    clearTimeout(channelHoverPreviewTimer.current);
    setChannelHoverPreviewKey(null);
    if (target.kind === "thread") {
      clearTimeout(customerInfoPreviewTimer.current);
      setCustomerInfoPreviewOpen(false);
      // The main column's own thread is already on screen: not a selection.
      if (!panelPlacement && target.cardId === activeInteractionId && target.key === activeChannelKey) return;
      return late.handleChannelSelect(target.cardId, target.key);
    }
    // Contact Details already showing: the toggle closes the slide-over.
    if (contactDetailsShowing) {
      setSelectedDetailPanelContent(null);
      clearTimeout(customerInfoPreviewTimer.current);
      setCustomerInfoPreviewOpen(false);
      return;
    }
    // The button opens on the tabs, not a sub-page left open before.
    if (customerPanelActiveTab === "Customer Info" || customerPanelActiveTab === "Experience Memory" || customerPanelActiveTab === "Artifacts") {
      setCustomerPanelActiveTab("Customer Information");
    }
    showContactDetails();
  };
  // The hover preview's "Link to existing customer" (P-HOME-1n): the preview can't hold the search/create flow, so
  // it closes and the link picker opens as the slide-over's own content.
  const handleLinkCustomerFromPreview = () => {
    // The link picker is its own slide-over content (P-HOME-1m), where Contact Details now opens too.
    clearTimeout(customerInfoPreviewTimer.current);
    setCustomerInfoPreviewOpen(false);
    setSelectedDetailPanelContent({ kind: "link-customer" });
  };
  // Opens the restored hover-preview (`customerInfoPreviewOpen`, see that
  // state's own doc comment) — mirrors `AgentNextGenPage.tsx`'s own
  // still-live `openCustomerInfoPreview` exactly, including the same guard:
  // never preview while the REAL panel is already open (nothing to peek at
  // that isn't already fully visible — and the button/Popover this feeds
  // doesn't even render then, per `TranscriptSessionSeparator`'s own
  // `!detailsPanelOpen` gate, so this is mostly a belt-and-suspenders
  // check).
  const openCustomerInfoPreview = () => {
    // Per explicit follow-up request ("if a panel is open the inactive
    // channel icon and contact details should retain their hover actions
    // so agents can preview other channels while on a current channel"):
    // only suppressed when Contact Details itself is what's already
    // showing in the docked panel (`sidePanelOpen && !channelPreviewThreadKey`)
    // - nothing to peek at there that isn't already fully visible. While a
    // CHANNEL's preview is open instead (`channelPreviewThreadKey` set),
    // Contact Details is not the visible content, so hovering it should
    // still offer its own peek.
    // P-HOME-1n: Contact Details shows in the reference slide-over, so that's what suppresses its peek.
    if (contactDetailsShowing) return;
    clearTimeout(customerInfoPreviewTimer.current);
    setCustomerInfoPreviewOpen(true);
  };
  // Schedules the preview closed on a short delay — same 150ms
  // hover-intent grace period `AgentNextGenPage.tsx`'s own
  // `scheduleCloseCustomerInfoPreview` uses, so the pointer can cross from
  // the trigger button into the popover's own (portaled) content without
  // it flickering shut, and the same `data-radix-popper-content-wrapper`
  // guard so leaving the trigger for the preview's own nested overflow menu
  // (its tab list, if it ever grows one) doesn't close it either.
  const scheduleCloseCustomerInfoPreview = (e?: React.MouseEvent<Element> | React.FocusEvent<Element>) => {
    const related = e?.relatedTarget as Element | null | undefined;
    if (related?.closest?.("[data-radix-popper-content-wrapper], [data-floating-layer]")) return;
    clearTimeout(customerInfoPreviewTimer.current);
    customerInfoPreviewTimer.current = setTimeout(() => setCustomerInfoPreviewOpen(false), 150);
  };
  // Same pair, generalized to a key, for the channel icons' own hover
  // preview (own render site further down) — see
  // `channelHoverPreviewKey`'s own doc comment above for the full "why".
  // Same guard as `openCustomerInfoPreview`: never preview while the real
  // panel is already open, whether showing Contact Details or another
  // channel's own preview — nothing to peek at that isn't already fully
  // visible.
  const openChannelHoverPreview = (key: string) => {
    // Suppressed in two cases now: (1) the ONE icon whose own content is
    // already the docked panel's visible content right now (unchanged from
    // before); and (2) per explicit follow-up request ("the chat should
    // only be displaying in the chat panel - not the main content area
    // anymore"), the channel that's already THIS interaction's main
    // content (`activeChannelKey`/`currentThreadId`) - hovering that one's
    // own icon would otherwise pop open a floating preview showing the
    // exact same transcript that's already sitting right behind it in the
    // main column, which is pure visual duplication, not an actual peek at
    // something new. Every other icon (and Contact Details, guarded
    // separately by `openCustomerInfoPreview`) still offers its own hover
    // peek regardless of whether some other channel or Contact Details
    // happens to be open already.
    // AI display "main": no thread is in the main column, so only the one in
    // the panel goes without a preview.
    if (channelPreviewThreadKey === key || (!panelPlacement && key === activeChannelKey)) return;
    clearTimeout(channelHoverPreviewTimer.current);
    if (channelHoverPreviewKey === key) return;
    // A short open delay: a glancing hover never opens it (or counts as reading it).
    clearTimeout(channelHoverOpenTimer.current);
    channelHoverOpenTimer.current = setTimeout(() => setChannelHoverPreviewKey(key), HOVER_PREVIEW_OPEN_DELAY_MS);
  };
  const scheduleCloseChannelHoverPreview = (e?: React.MouseEvent<Element> | React.FocusEvent<Element>) => {
    const related = e?.relatedTarget as Element | null | undefined;
    if (related?.closest?.("[data-radix-popper-content-wrapper], [data-floating-layer]")) return;
    clearTimeout(channelHoverOpenTimer.current);
    clearTimeout(channelHoverPreviewTimer.current);
    channelHoverPreviewTimer.current = setTimeout(() => setChannelHoverPreviewKey(null), 150);
  };
  // A preview that was open counts as reading its thread: closing it clears
  // the thread's unread count (the page's live-message overlay until P2.2).
  const lastPreviewKey = useRef<string | null>(null);
  useEffect(() => {
    const closed = lastPreviewKey.current;
    lastPreviewKey.current = channelHoverPreviewKey;
    if (closed && closed !== channelHoverPreviewKey && activeInteraction)
      omni.markSeen(activeInteraction.id, closed, activeInteraction.liveMessages?.[closed]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelHoverPreviewKey]);

  // Track window width — still drives `isCompactHeader` below.
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Nav overlay breakpoint — `bodyContainerWidth` (see `bodyContainerRef`'s
  // own doc comment up by `containerRef`), not the browser viewport.
  const isNavNarrow = bodyContainerWidth < 768;

  return {
    ...prev,
    replyBlockedReason, copilotComposerProps, requestNextBestAction, sessionDetailsPick, setSessionDetailsPick, viewSessionDetails,
    panelMounted, setPanelMounted, panelState, setPanelState, activePanelKey, setActivePanelKey, panelVariant,
    setPanelVariant, panelWidth, setPanelWidth, panelHeight, setPanelHeight, panelIsResizing, setPanelIsResizing,
    panelFullScreen, setPanelFullScreen, fullScreenRendered, setFullScreenRendered, fullScreenVisible,
    setFullScreenVisible, selectedOutboundTeamId, setSelectedOutboundTeamId, containerRef, sidePanelContainerWidth,
    bodyContainerRef, bodyContainerWidth, recordHeaderNode,
    setRecordHeaderNode, recordHeaderRef, recordHeaderWidth, panelFloatLeft, panelFloatTop,
    panelRef, panelAnimTimer, fullScreenAnimTimer, screenPopApp, setScreenPopApp, headerSettings,
    updateHeaderSettings, pinnedKeys, togglePinnedKey, tabApps, homeTabs, customersPageTabs, activeDeskTab,
    appsMenuOpen, setAppsMenuOpen, interiorPanelOpen, setInteriorPanelOpen, selectedQueueId, setSelectedQueueId,
    selectedContactHistoryEntry, setSelectedContactHistoryEntry, sidePanelOpen, setSidePanelOpen,
    customerInfoPreviewOpen, setCustomerInfoPreviewOpen, customerInfoPreviewTimer, channelHoverPreviewKey,
    setChannelHoverPreviewKey, threadMenu, channelHoverPreviewTimer, channelHoverOpenTimer, customerPanelFocusTab,
    setCustomerPanelFocusTab, customerPanelFocusTabVersionRef, marcusMemoryFocus, setMarcusMemoryFocus,
    experienceMemoryFocus, setExperienceMemoryFocus, openExperienceMemoryInSidePanel, openArtifactsList, focusCustomerPanelTab,
    sidePanelPinned, sidePanelResizing, setSidePanelResizing, sidePanelWidth, setSidePanelWidth, sidePanelFullScreen,
    setSidePanelFullScreen, sidePanelHoverTimer, isSidePanelContainerNarrow, effectiveSidePanelPinned,
    isSidePanelAtMaxWidthBreakpoint, isSidePanelAtMinimalThreshold, onSidePanelHoverStart, onSidePanelHoverEnd,
    handleSidePanelClose, sidePanelStateByAssignmentId, switchActiveInteraction, handleLucasTakeover,
    contactDetailsShowing, showContactDetails, selectPanel, handleLinkCustomerFromPreview, openCustomerInfoPreview,
    scheduleCloseCustomerInfoPreview, openChannelHoverPreview, scheduleCloseChannelHoverPreview, lastPreviewKey,
    isNavNarrow,
  };
}

export type WsPanels = ReturnType<typeof useWsPanels>;
