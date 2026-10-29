import { useState, useMemo, useEffect, useRef } from "react";
import {
  Button,
  TabList,
  Tab,
  ActionIconButton,
  PanelFooter,
  AIInput,
  SidePanel,
  PanelPinButton,
  Tooltip,
  type CreateNewOutboundContact,
  type ChannelType,
  type ToastItem,
} from "@nicecxone/lyra-ui";
import { type CreateNewCustomerRecord } from "@nicecxone/lyra-ui/customers-data";
import { ArrowLeft, Minimize2, Maximize2, PanelRightClose } from "lucide-react";
import { type Thread } from "@/components/agent-next-gen-interaction-dashboard";
import {
  CUSTOMER_PANEL_TABS,
  SHOW_CUSTOMER_INFO_AI_INPUT,
  buildLatestInteraction,
  buildLatestNote,
  buildCopilotSummary,
  resolveCustomerListRecord,
  type CustomerPanelTabLabel,
  type CustomerHistorySessionEntry,
} from "./customer-info-seed";
import { CustomerDetailTabContent, CustomerRecordSaveFooter, type useCustomerRecordDraft } from "./CustomerDetailTabs";
import { CustomerInformationPanelBody } from "./CustomerInformationPanelBody";
import { buildCustomerMatchSubhead, CustomerMatchSearchBody } from "./customer-match";

/* ── CustomerInformationSidePanel ──
   Owns `activeTab` — the one piece of state both the header's `TabList`
   (via `SidePanel`'s `headerTabs`) and the scrolling body below it
   (`CustomerInformationPanelBody`) need, which is why this wraps both
   instead of `CustomerInformationPanelBody` owning that state itself the
   way it used to when the tabs still lived inside it.

   Also where the field list and Latest Interaction summary are actually
   computed (`buildCustomerInfoFields`/`buildLatestInteraction`, each
   memoized on `customerName`/`recordId`/`channels`) — takes the raw
   interaction fields instead of a pre-joined `headerSubhead` string so it
   has what it needs to build the header text and both panel-body pieces
   from the same source, rather than the caller assembling one string this
   component has to parse back apart.

   Docked via the generic `SidePanel` primitive (originally LEFT, matching
   an early reference screenshot; now RIGHT — `side="right"` below — per a
   later explicit request to move it, alongside the render site's own move
   to the row's other end) rather than the right-docked `InteriorPanel` this
   was previously built on — pin/hover-preview state lives in the parent
   (mirrors `AgentNextGenTemplate.stories.tsx`'s own `CustomerInformation-
   Panel` usage), since that's a `SidePanel`-only concept `InteriorPanel`
   never had. `allowFullScreen`/`exitFullScreenSignal`/`onOverlayModeChange`
   don't carry over — `SidePanel` has no "full screen" or "floating
   overlay" concept of its own; an unpinned panel simply shows/hides on
   hover instead.

   Full-screen (per explicit follow-up request) is built entirely here,
   without adding a real "full screen" concept to `SidePanel` itself: the
   caller passes `pinned={false}` (always an unpinned/floating overlay
   while full-screen — pushing the main column over via docked/pinned mode
   wouldn't read as "overlay full screen within its parent container") and
   `width` equal to the parent `Container`'s own measured width
   (`sidePanelContainerWidth`, already tracked for the narrow-container
   guard) instead of the normal drag-resized width, so the panel's own
   existing unpinned/absolute rendering branch (side-panel.tsx) covers the
   whole container edge to edge — animated by the same CSS width
   transition every other resize already uses, so expanding/collapsing
   full-screen isn't an instant jump cut. That animation needed one small
   fix in the shared `usePanelDragResize` hook (use-panel-drag-resize.ts):
   it used to latch onto whatever width a manual drag last set and ignore
   further external `width` prop changes afterward, which (a) silently
   broke this full-screen toggle for a panel that had been manually
   resized even once before, and (b) meant this component used to have to
   force a full remount on every full-screen toggle just to reset that
   stale internal state, which skipped the transition entirely (a fresh
   DOM node has no prior frame to animate from). The hook now resets its
   own internal drag state whenever its `initialWidth` prop changes, so it
   stays properly reactive to external width changes and no remount is
   needed here anymore. */
export function CustomerInformationSidePanel({
  open,
  pinned,
  onClose,
  fullScreen,
  onToggleFullScreen,
  onMouseEnter,
  onMouseLeave,
  customerName,
  recordId,
  channels,
  startedFresh,
  tabs,
  width,
  containerWidth,
  maxWidthRatio,
  onWidthChange,
  onResizeStateChange,
  onOpenHistoryConversation,
  onAddToast,
  recordDraft,
  overviewEditing,
  onOverviewEditingChange,
  matchState,
  matchStateOnBack,
  copilotExtra,
  onStartInteraction,
  bodyOverride,
  footerOverride,
  headerTitleOverride,
  headerTabsOverride,
  headerIconOverride,
  headerSubheadOverride,
  onViewCustomerInfo,
}: {
  open: boolean;
  pinned: boolean;
  /** Forwarded to `CustomerInformationPanelBody`'s `onOpenConversation` —
   *  see that prop's own doc comment. */
  onOpenHistoryConversation?: (entry: CustomerHistorySessionEntry) => void;
  /** Hides the panel WITHOUT unpinning it — rendered as a `PanelLeftClose`-
   *  iconed `PanelPinButton` in the header via `headerActions` below, NOT
   *  `SidePanel`'s own built-in pin button (that one has no way to
   *  override its default `Pin` icon, and this is a real close action now,
   *  not a pin/unpin toggle — see `handleSidePanelClose`'s own doc
   *  comment). `SidePanel`'s `onPinToggle` prop is deliberately left unset
   *  below so its internal default button doesn't also render. */
  onClose?: () => void;
  /** Whether the panel is currently overlaying the whole parent Container
   *  edge to edge — purely a rendering choice the caller makes (see this
   *  component's own doc comment above); only used here to pick the
   *  Maximize2/Minimize2 icon and label on the toggle button below. */
  fullScreen?: boolean;
  onToggleFullScreen?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  customerName?: string;
  recordId: string;
  channels: Thread[];
  /** This interaction's own `Interaction.startedFresh` — see that
   *  field's own doc comment (agent-next-gen-interaction-dashboard.tsx).
   *  Previously fed the now-removed `copilotAvailable` gate ("hasn't the
   *  customer said anything yet, so Copilot has nothing to summarize") —
   *  Copilot itself is unconditionally hidden now (per explicit request,
   *  see `visibleTabs`' own doc comment below), so this prop currently has
   *  no live consumer in this component; kept as-is (not removed) since
   *  every call site already passes it and it costs nothing to keep. */
  startedFresh?: boolean;
  /**
   * Which tabs this panel supports at all, in order — per explicit
   * request, Agent Workspace 2.0 passes `AGENT_WORKSPACE_CUSTOMER_PANEL_TABS`
   * (Overview/Copilot/Detail/Notes only); Agent Workspace 2.0 With Desk
   * passes the full `CUSTOMER_PANEL_TABS` unchanged. "Copilot" being
   * listed here only means this consumer supports it AT ALL — whether it
   * actually renders as a tab button also depends on `copilotAvailable`
   * below (see `visibleTabs`), so a consumer that includes "Copilot" here
   * still won't show it until the conversation has actually started.
   */
  tabs: readonly CustomerPanelTabLabel[];
  width: number;
  /** The parent Container's own currently measured width
   *  (`sidePanelContainerWidth`, already tracked for the narrow-container
   *  guard) — per explicit request, this panel must never render wider
   *  than that, docked or full-screen, so both `width` and `maxWidth`
   *  below are clamped against it. */
  containerWidth: number;
  /** Caps the drag-resize max width at this fraction of `containerWidth`
   *  instead of the flat 425px every other consumer still gets — see
   *  `clampedMaxWidth`'s own doc comment for the full "why". Optional;
   *  omit to keep the old flat-425px cap. */
  maxWidthRatio?: number;
  onWidthChange: (width: number) => void;
  onResizeStateChange?: (isResizing: boolean) => void;
  /** Fires a toast into the shared stack `AgentNextGenPage` (or whichever
   *  page owns this instance) owns via `useToast`/`<ToastContainer>` — same
   *  "lift the toast call up, don't spin up a second independent toast
   *  stack" reasoning `InteractionsListView`'s own `onAddToast` uses (see
   *  that prop's doc comment). Fired on a successful Customer Overview
   *  save below (`recordDraft.save()`). Optional so this panel still
   *  renders standalone without a crash if some future caller omits it. */
  /** The Detail/Directory/Customer Overview draft for this interaction's
   *  customer — LIFTED to the caller (previously this component's own
   *  `useCustomerRecordDraft` instance) per explicit request: an agent who
   *  starts an edit, hovers off the record header's `CustomerInfoHoverPreview`
   *  (which used to own a totally separate, Popover-unmounted-on-close
   *  instance), or toggles this docked panel closed and back open should
   *  still see the exact same pending edit, not a freshly reset one. The
   *  caller (`AgentNextGenPage`/`AgentWorkspace2WithDeskPage`) now owns ONE
   *  `useCustomerRecordDraft` instance per active interaction and passes it
   *  to BOTH this panel and `CustomerInfoHoverPreview`, so the two also stay
   *  in sync with each other — an edit started in one shows up in the
   *  other. Still resets to a fresh draft when `recordId` changes (that
   *  reset lives inside `useCustomerRecordDraft` itself, unchanged) and is
   *  discarded entirely once the interaction is actually dismissed (the
   *  caller's own instance goes away with it) — only those two things
   *  clear it, not merely closing/hovering off this panel. */
  recordDraft: ReturnType<typeof useCustomerRecordDraft>;
  /** Whether the Overview tab's field list is showing real inputs — also
   *  lifted to the caller alongside `recordDraft` above, for the identical
   *  "must survive hover-off/panel-close, not just field-level edits"
   *  reason. */
  overviewEditing: boolean;
  onOverviewEditingChange: (editing: boolean) => void;
  onAddToast?: (toast: Omit<ToastItem, "id">) => void;
  /** When set, this panel shows the unknown-contact customer-matching UI
   *  (see the doc comment above `findPossibleCustomerMatches`/
   *  `CustomerMatchSearchBody`) INSTEAD of its normal tabs+body — header
   *  title/subhead/tabs, body, and footer below all branch on this being
   *  present rather than on `tabs`/`recordDraft` alone. `undefined` for
   *  every other consumer (`CustomerRowInfoPanel`/`CustomerInfoHoverPreview`
   *  never pass this) and for a real-customer interaction on Premium/
   *  Advanced — only an unknown-contact interaction on those two tiers
   *  ever sets this (see each page file's own render call site). */
  matchState?: {
    step: "search" | "create";
    query: string;
    onQueryChange: (query: string) => void;
    /** Shown instead of `searchResults` whenever `query` is empty — see
     *  `findPossibleCustomerMatches`'s own doc comment. */
    possibleMatches: CreateNewCustomerRecord[];
    /** Shown instead of `possibleMatches` the moment `query` has anything
     *  typed into it — see `filterCustomersByQuery`'s own doc comment. */
    searchResults: CreateNewCustomerRecord[];
    onLinkRecord: (customer: CreateNewCustomerRecord) => void;
    onStartCreate: () => void;
    onBackToSearch: () => void;
    onSaveNewCustomer: () => void;
  };
  /** Passed straight through to `CustomerInformationPanelBody`'s own same-
   *  named prop — see that prop's own doc comment. `undefined` for every
   *  interaction except the Marcus Webb scripted scenario. */
  copilotExtra?: React.ReactNode;
  /** Per explicit request ("put the customer available channels in the
   *  Customer Overview in the same row as the edit... for all Customer
   *  Information panels") — feeds `CustomerInformationPanelBody`'s own
   *  `row`/`onStartInteraction` props (see `resolveCustomerListRecord`'s own
   *  doc comment above for how `row` itself gets derived from `recordId`
   *  right below). Every real page-file call site already has a working
   *  `handleStartCall`-backed handler of this exact shape — see
   *  `CustomerRowInfoPanel`'s own identically-named, non-optional prop for
   *  the established wiring pattern this mirrors. */
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
  /**
   * When set, replaces this panel's normal tabbed body
   * (`CustomerInformationPanelBody`) with this element instead, AND hides
   * `headerTabs` entirely (there's nothing for a tab row to switch
   * between once the body isn't tab content anymore) — used by
   * `AgentWorkspaceAdvancedPage.tsx`'s docked "Customer Information"
   * panel to show the same Customer Profile/Contact Snapshot/Files
   * accordion content (`DetailsPanelAccordions`, below) the voice
   * "Details" panel used to show exclusively, per explicit request
   * ("swap the actual content rendered inside each panel" — see that
   * panel's own render site doc comment, and `CustomerInfoHoverPreview`'s
   * identical prop, for the fuller "why"). Checked AFTER `matchState` — an
   * unknown-contact interaction still gets the customer-matching UI, never
   * the accordions — but INSTEAD of the normal tab body otherwise.
   * `undefined` for every other consumer (Phase 1/Premium never pass this,
   * so their own instances of this panel are completely unaffected).
   */
  bodyOverride?: React.ReactNode;
  /**
   * Replaces this panel's normal footer chain (the record Save/Cancel
   * footer, the Copilot/Overview `AIInput`, or nothing) with this element
   * instead — same "override" idea as `bodyOverride` just above, and
   * checked at the same priority (right after `matchState`'s own footer,
   * ahead of everything else), since a `bodyOverride`'d body (e.g. the
   * Session tab's editable content, `useSessionDetailsTabContent`) needs
   * its OWN Save/Cancel footer to win regardless of whatever the normal
   * Overview tab's record-edit state happens to be. `undefined` (the
   * default) leaves the existing footer chain completely unaffected.
   */
  footerOverride?: React.ReactNode;
  /**
   * Replaces the fixed "Customer Information" header title (used whenever
   * `matchState` isn't set) — per later explicit request ("put the
   * transcript and session tabs into the new customer information side
   * panel and rename the side panel Session Details"), Advanced's own
   * instance of this panel now reads "Session Details" instead, since it
   * shows more than just customer info once `bodyOverride`/`headerTabsOverride`
   * are also in play. `undefined` for every other consumer, which keeps
   * the original "Customer Information" title unchanged.
   */
  headerTitleOverride?: string;
  /**
   * Replaces the normal Overview/Detail/Notes `headerTabs` row with this
   * instead (still hidden entirely while `matchState` is set, same as
   * always) — per the same later explicit request as `headerTitleOverride`
   * above: Advanced's own instance shows a Details/Transcript/Session
   * Details row here instead, since `bodyOverride` now switches on that
   * same external tab state rather than this component's own internal
   * `activeTab`. Checked BEFORE the `bodyOverride`-implies-"no tabs" rule
   * `headerTabs` otherwise follows — passing this is how a caller gets
   * tabs back while ALSO using `bodyOverride`. `undefined` for every other
   * consumer, unaffected.
   */
  headerTabsOverride?: React.ReactNode;
  /**
   * Replaces the normal back-arrow-or-nothing `headerIcon` (only ever
   * rendered today during the `matchState` search/create flow) — lets a
   * caller show its own back arrow for a DIFFERENT drill-in view that
   * isn't `matchState` (e.g. the "Customer Info" view `bodyOverride`/
   * `headerTabsOverride`/`headerTitleOverride`/`headerSubheadOverride`
   * switch this panel into — see `AgentWorkspaceAdvancedPage.tsx`'s own
   * call site). Checked AFTER `matchState`'s own back arrow (unaffected,
   * still takes priority), so the two can never collide — an agent is
   * never in both flows on the same panel instance at once. `undefined`
   * for every other consumer, unaffected.
   */
  headerIconOverride?: React.ReactNode;
  /**
   * Replaces the normal `headerSubhead` (the customer's name, or the
   * clickable-name link below once `onViewCustomerInfo` is passed — see
   * that prop's own doc comment) — same "override" idea as
   * `headerTitleOverride` just above, for the SAME "Customer Info"
   * drill-in view (shows the record id there instead of the name).
   * `undefined` leaves the normal name/link subhead untouched.
   */
  headerSubheadOverride?: string;
  /**
   * Per explicit request ("the view customer info button can be the
   * customer name in the Contact Details subhead as a link with a
   * tooltip"): while set (and neither `matchState` nor
   * `headerSubheadOverride` is in play), the normal `headerSubhead` is no
   * longer plain text — it becomes the customer's name rendered as a
   * clickable link, wrapped in a "View Customer Info" `Tooltip`, calling
   * this. Reuses the exact link styling (`text-lyra-fg-link hover:underline
   * focus-visible:outline-none`) Marcus Webb's own clickable-name link
   * already uses (agent-next-gen-marcus-webb-next-best-action-card.tsx) for
   * visual consistency, rather than adding a new, separate button. The
   * caller is expected to open its own "Customer Info" drill-in view (same
   * one `headerIconOverride`'s back arrow returns out of) — `undefined`
   * (every other consumer) leaves `headerSubhead` as plain, non-interactive
   * text exactly as before.
   */
  onViewCustomerInfo?: () => void;
  /**
   * Per explicit request ("add a button above auto summary that says link
   * to existing customer and then when that is clicked slide in a panel
   * with the search customer / create new customer panel content") — when
   * set, the match flow's "search" step (this panel's own `matchState.step
   * === "search"`) gets a back arrow in `headerIcon`, same slot/treatment
   * the "create" step's own back-to-search arrow already uses, except this
   * one calls the caller's own handler instead of `matchState.onBackToSearch`
   * — Advanced's own docked panel call site uses it to close the on-demand
   * search/create overlay it opens from a button, back to its normal
   * `DetailsPanelAccordions` `bodyOverride` content. `undefined` for every
   * other consumer (unaffected — matches the search step's long-standing
   * no-back-arrow look exactly as before).
   */
  matchStateOnBack?: () => void;
}) {
  const latestInteraction = useMemo(
    () => buildLatestInteraction(customerName, recordId),
    [customerName, recordId]
  );
  const latestNote = useMemo(
    () => buildLatestNote(customerName, recordId),
    [customerName, recordId]
  );
  // See `resolveCustomerListRecord`'s own doc comment above for why this
  // panel — an already-open interaction, never fed a `row` from a
  // Customers-table row click — still has one to look up.
  const row = useMemo(() => resolveCustomerListRecord(recordId), [recordId]);
  const copilotSummary = useMemo(() => buildCopilotSummary(customerName, recordId), [customerName, recordId]);
  // Per explicit request ("stop launching copilot - hide it completely"):
  // Copilot is now unconditionally excluded below (`visibleTabs`), same
  // treatment `CustomerRowInfoPanel`/`AllContactsProfileView` already give
  // it (see either one's own `visibleTabs` doc comment) — this panel was
  // the last of the three still showing it conditionally
  // (`copilotAvailable`, previously). `copilotSummary`/`buildCopilotSummary`
  // above stay computed regardless — `ContactOverview`'s own
  // `journeySummary` prop (this file's page-level callers, not this
  // component) now reuses that exact same deterministic recap in its new
  // home, so the underlying data still has a real consumer even with the
  // Copilot tab itself gone.
  const [activeTab, setActiveTab] = useState(() => CUSTOMER_PANEL_TABS.indexOf("Overview"));
  // `tabs` (this consumer's configured support list) minus "Copilot"
  // unconditionally now — see this block's own top comment.
  const visibleTabs = tabs.filter((t) => t !== "Copilot");

  // Per explicit follow-up request ("I want the session details side panel
  // to still animate in and out when docked on toggle, just not animate
  // when it goes full screen") — this component fakes "full screen" by
  // flipping `pinned`/`width` together at the call site (AgentWorkspace*
  // Page.tsx's own `pinned={fullScreen ? false : ...}`/`width={fullScreen ?
  // containerWidth : ...}`), rather than `InteriorPanel`'s own dedicated
  // `allowFullScreen` toggle — so `SidePanel` itself (side-panel.tsx) has no
  // way to tell "entering/exiting full screen" apart from a normal `open`
  // toggle on its own. Same `prevRef`/`justToggled` ref-comparison pattern
  // `InteriorPanel` uses for its own `fullScreenJustToggled` (see that
  // component's own doc comment) — computed with a plain assignment during
  // render (not `useEffect`) is what that fix settled on for InteriorPanel,
  // but THIS ref update needs to happen strictly AFTER the render that
  // reads `fullScreenJustToggled`, same reasoning as `InteriorPanel`'s own
  // `useEffect`-based update (not `useLayoutEffect`) — otherwise the ref
  // would already reflect the NEW value by the time this same render
  // computes `fullScreenJustToggled`, and the instant-transition render
  // would never actually fire.
  const prevFullScreenRef = useRef(fullScreen);
  const fullScreenJustToggled = prevFullScreenRef.current !== fullScreen;
  useEffect(() => {
    prevFullScreenRef.current = fullScreen;
  }, [fullScreen]);

  // Never render wider than the parent Container actually is, docked or
  // full-screen — see `containerWidth`'s own doc comment. `Math.max(0, ...)`
  // guards the pathological case of a container narrower than any usable
  // width at all; `SidePanel` itself already treats a 0/near-0 width
  // sanely (see its own `open ? currentWidth : 0` branches).
  const clampedWidth = Math.max(0, Math.min(width, containerWidth));
  // `maxWidthRatio` — per explicit request ("allow the interior panel to
  // have a max-width 50% when dragging resize"), Agent Workspace 2.0/2.0
  // With Desk now pass `0.5` here so a manual drag can't exceed half the
  // parent Container's own width, not the flat 425px every OTHER consumer
  // (Advanced) still gets — optional, defaulting to `undefined` so a
  // caller that doesn't pass it keeps the exact old flat-425px behavior
  // unchanged.
  const clampedMaxWidth =
    maxWidthRatio != null
      ? Math.max(0, Math.min(containerWidth * maxWidthRatio, containerWidth))
      : Math.max(0, Math.min(425, containerWidth));

  // See `buildCustomerMatchSubhead`'s own doc comment — shared with
  // `CustomerInfoHoverPreview` so the docked panel and its hover preview
  // never disagree on the match count/wording or which list is showing.
  const { subhead: matchSubhead, visibleList: matchVisibleList } = matchState
    ? buildCustomerMatchSubhead(matchState.query, matchState.possibleMatches, matchState.searchResults)
    : { subhead: "", visibleList: [] };

  return (
    <SidePanel
      // Docks on the RIGHT now (was "left") — per explicit request, moved
      // alongside relocating this component's own wrapper to render AFTER
      // the main content column instead of before it (see the render
      // site's own doc comment). `SidePanel`'s `side` prop drives its
      // border (`border-l` instead of `border-r`), unpinned/floating
      // position (`right-0` instead of `left-0`), and drag-resize handle
      // side — all three flip correctly just from this one prop (side-
      // panel.tsx), no other changes needed inside `SidePanel` itself.
      side="right"
      open={open}
      pinned={pinned}
      // See `fullScreenJustToggled`'s own doc comment above — instant only
      // for the render(s) where `fullScreen` itself just flipped; a normal
      // `open` toggle (still docked, not entering/exiting full screen)
      // keeps `SidePanel`'s own default animated width transition.
      instantWidthChange={fullScreenJustToggled}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      // Static "Customer Information" title (was the customer's own name +
      // record id in the TITLE, `headerSubhead={recordId}` below) — per
      // explicit request. The name/id already show again in the page
      // header above this panel (see `PageHeader`'s own `title`/`subtitle`
      // at the record header render site) and in this panel's own
      // Overview tab, so the TITLE doesn't need to repeat them a third
      // time.
      //
      // Per a later explicit follow-up request ("add a subhead to the
      // customer information panel in an interaction that is {Firstname
      // Lastname} of the customer"), the subhead itself is back — just the
      // plain name this time, not name+id the way it briefly was before
      // this got flattened to static text. Only for the ordinary case
      // (real customer, no `matchState` search/create flow in progress):
      // `matchState`'s own two steps keep their own subhead treatment
      // exactly as before (`matchSubhead` mid-search; none at all while
      // creating a brand-new record, since there's no confirmed customer
      // yet for a name to describe).
      //
      // While `matchState` is set (see that prop's own doc comment), this
      // whole header instead reads either "Customer Information" (search
      // step — matches every other consumer) or "Create New Customer"
      // (create step, per explicit request) with a back arrow ahead of it
      // (`headerIcon` below) instead of a normal `TabList` (`headerTabs`
      // below is `undefined` in both match steps — neither reference
      // screenshot shows any tabs).
      headerTitle={matchState?.step === "create" ? "Create New Customer" : headerTitleOverride ?? "Customer Information"}
      headerSubhead={
        matchState?.step === "search"
          ? matchSubhead
          : matchState?.step === "create"
            ? undefined
            : headerSubheadOverride !== undefined
              ? headerSubheadOverride
              : onViewCustomerInfo && customerName
                ? (
                  <Tooltip content="View Customer Info" placement="bottom">
                    <button
                      type="button"
                      onClick={onViewCustomerInfo}
                      className="lyra-body-sm text-lyra-fg-link hover:underline focus-visible:outline-none"
                    >
                      {customerName}
                    </button>
                  </Tooltip>
                )
                : customerName
      }
      headerIcon={
        matchState?.step === "create" ? (
          <ActionIconButton aria-label="Back to search" title="Back" onClick={matchState.onBackToSearch}>
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </ActionIconButton>
        ) : matchState?.step === "search" && matchStateOnBack ? (
          <ActionIconButton aria-label="Back" title="Back" onClick={matchStateOnBack}>
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </ActionIconButton>
        ) : headerIconOverride
      }
      // `PanelLeftClose`-iconed `PanelPinButton`, standing in for
      // `SidePanel`'s own default `Pin`-iconed one (suppressed by leaving
      // `onPinToggle` unset above) — same shared atom, just a different
      // icon/labels/handler, per explicit request. `pinned` is hardcoded
      // `false` here (NOT this panel's real `pinned` prop) — per explicit
      // follow-up request to drop the "currently active" highlighted
      // background `PanelPinButton` normally shows while pinned (see its
      // own `icon && pinned` branch): this is a momentary close action, not
      // a toggle with a persistent on/off state to reflect.
      headerActions={
        <>
          {/* Full-screen toggle — same `PanelPinButton` atom as the close
              button below (just another icon/label/handler over the shared
              "small icon button in a panel header" shape), per explicit
              request. `pinned={false}` here too, for the same reason the
              close button hardcodes it: this toggles between two distinct
              states (full-screen on/off) but isn't a pin, so it shouldn't
              wear `PanelPinButton`'s "currently active" highlight either. */}
          {onToggleFullScreen && (
            <PanelPinButton
              pinned={false}
              onToggle={onToggleFullScreen}
              icon={
                fullScreen ? (
                  <Minimize2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <Maximize2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                )
              }
              pinnedLabel={fullScreen ? "Exit Full Screen" : "Full Screen"}
              unpinnedLabel={fullScreen ? "Exit Full Screen" : "Full Screen"}
            />
          )}
          {onClose && (
            <PanelPinButton
              pinned={false}
              onToggle={onClose}
              // `PanelRightClose` (was `PanelLeftClose`) — matches the
              // panel's own new right-side dock (see `SidePanel`'s own
              // `side="right"` above); the glyph itself depicts which edge
              // the panel collapses toward, so it needs to flip along with
              // the panel's actual position.
              icon={<PanelRightClose className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
              pinnedLabel="Close Customer Information"
              unpinnedLabel="Close Customer Information"
            />
          )}
        </>
      }
      // Plain default `"wide"` mode (no `overflowBreakpoint` override) —
      // same behavior as every other `TabList` in the app; see the
      // previous `InteriorPanel`-based version's identical reasoning for
      // why `"wide"` (not `"compact"`) is the deliberate choice here.
      // `undefined` entirely while `matchState` is set — neither match
      // step has a tab list (see `headerTitle`'s own doc comment above).
      headerTabs={
        matchState
          ? undefined
          : headerTabsOverride !== undefined
          ? headerTabsOverride
          : bodyOverride
          ? undefined
          : (
            <TabList className="px-4" overflowMenu>
              {visibleTabs.map((label) => (
                <Tab
                  key={label}
                  active={activeTab === CUSTOMER_PANEL_TABS.indexOf(label)}
                  onClick={() => setActiveTab(CUSTOMER_PANEL_TABS.indexOf(label))}
                >
                  {label}
                </Tab>
              ))}
            </TabList>
          )
      }
      width={clampedWidth}
      // Hides the drag-resize handle while full-screen — its width is
      // fully caller-controlled in that state (see this component's own
      // doc comment), not something the agent should be able to drag.
      resizable={!fullScreen}
      // 325 — explicit min-width for this panel's drag-resize handle, per
      // explicit request. `SidePanel`'s own default (`minWidth = 200`,
      // side-panel.tsx) is too narrow for this panel's own content
      // (field labels/values, Latest Interaction card, etc.) to stay
      // legible once dragged all the way down.
      minWidth={325}
      // 425 was `SidePanel`'s own implicit default max-width (never passed
      // explicitly before) — now clamped against `containerWidth` too, so
      // a manual drag can't resize past the parent Container's own current
      // width either (see `clampedMaxWidth`'s own doc comment above).
      maxWidth={clampedMaxWidth}
      onWidthChange={onWidthChange}
      onResizeStateChange={onResizeStateChange}
      // AI Input pinned to the bottom of the Overview tab only — `footer`
      // renders as a `shrink-0` sibling AFTER `PanelContent` (see
      // side-panel.tsx), so it's already outside the scroll region and
      // naturally stays fixed to the bottom without any extra CSS.
      // Temporarily hidden — see `SHOW_CUSTOMER_INFO_AI_INPUT`'s own doc
      // comment, which now also covers Copilot's own `AIInput` just below
      // (per a later explicit follow-up — "hide the ask anything input in
      // copilot for now"), uses this exact same "shrink-0 sibling after
      // PanelContent" mechanism for its own fixed-to-bottom placement,
      // checked FIRST since the Save/Cancel footer below needs to outrank
      // it whenever the record is actually dirty. The Save/Cancel footer
      // (`recordDraft.isDirty || overviewEditing` — appears the instant
      // EITHER a field actually changes OR the Customer Overview edit
      // button is clicked, per explicit request) is checked BEFORE either
      // of those — per explicit request it stays open regardless of which
      // tab is active, so it needs to outrank both the Copilot- and
      // Overview-scoped footers rather than only showing while Detail/
      // Directory happens to be the active tab.
      footer={
        // While `matchState` is set, this footer is EITHER the search
        // step's full-width "Create New Customer" button or the create
        // step's Cancel/Save pair — checked first, ahead of even the
        // generic Save/Cancel footer below, since the create step's own
        // `recordDraft` is very likely dirty too (the agent is actively
        // typing a new record's fields) but needs the match-aware Save
        // handler (`onSaveNewCustomer`, which also promotes this
        // interaction to a real customer — see the page file's own
        // doc comment on that handler), not the generic one.
        matchState ? (
          matchState.step === "search" ? (
            <PanelFooter>
              {/* No `variant` — `Button`'s own default IS the filled
                  primary style (`bg-lyra-bg-primary`, button.tsx); this
                  design system has no separate `"primary"` variant name
                  (that was this button's original, incorrect value — it
                  silently fell back to the base, unstyled classes since
                  `cva` has no matching entry for it, per explicit bug
                  report). Same "just omit variant" convention
                  `CustomerRecordSaveFooter`'s own Save button already
                  uses, just below. */}
              <Button className="w-full" onClick={matchState.onStartCreate}>
                Create New Customer
              </Button>
            </PanelFooter>
          ) : (
            <CustomerRecordSaveFooter
              onSave={matchState.onSaveNewCustomer}
              onCancel={() => {
                recordDraft.cancel();
                matchState.onBackToSearch();
              }}
            />
          )
        ) : footerOverride !== undefined ? (
          footerOverride
        ) : recordDraft.isDirty || overviewEditing ? (
          <CustomerRecordSaveFooter
            onSave={() => {
              recordDraft.save();
              onOverviewEditingChange(false);
              onAddToast?.({
                variant: "success",
                title: "Success",
                message: customerName ? `${customerName} customer record saved` : "Customer record saved",
                duration: 4000,
              });
            }}
            onCancel={() => {
              recordDraft.cancel();
              onOverviewEditingChange(false);
            }}
          />
        ) : SHOW_CUSTOMER_INFO_AI_INPUT && activeTab === CUSTOMER_PANEL_TABS.indexOf("Copilot") ? (
          <PanelFooter className="justify-start">
            <AIInput singleLine helperText="" className="w-full" />
          </PanelFooter>
        ) : SHOW_CUSTOMER_INFO_AI_INPUT && activeTab === CUSTOMER_PANEL_TABS.indexOf("Overview") ? (
          <PanelFooter className="relative justify-start">
            {/* Soft fade instead of a hard border-top — same treatment as
                `InteractionComposer`'s transcript-to-composer transition
                (see that component's own comment above) — reads as the
                Overview content scrolling *under* the input rather than
                stopping at a line. Positioned outside this div's own box
                (negative top), overlaying the last ~32px of the scrollable
                content sitting directly above it. */}
            <div
              className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-b from-transparent to-lyra-bg-surface-container-subtle"
              aria-hidden="true"
            />
            <AIInput placeholder="Ask about this customer..." showAttach={false} className="w-full" />
          </PanelFooter>
        ) : undefined
      }
    >
      {matchState ? (
        matchState.step === "search" ? (
          <CustomerMatchSearchBody
            query={matchState.query}
            onQueryChange={matchState.onQueryChange}
            matches={matchVisibleList}
            onLinkRecord={matchState.onLinkRecord}
          />
        ) : (
          // The create step's own form — literally the same "Detail" tab
          // content/draft this panel already shows for an unknown-contact
          // interaction today (fields seeded from the interaction's own
          // case number/dialed identifier — see `CustomerDetailTabContent`'s
          // own doc comment), just reached via the search step instead of
          // a tab click, and saved via `matchState.onSaveNewCustomer`
          // (footer above) instead of the generic Save/Cancel footer.
          <CustomerDetailTabContent
            fields={recordDraft.draft.overviewFields}
            draft={recordDraft.draft}
            onDraftChange={recordDraft.updateDraft}
          />
        )
      ) : bodyOverride ? (
        bodyOverride
      ) : (
        <CustomerInformationPanelBody
          activeTab={activeTab}
          customerName={customerName}
          latestInteraction={latestInteraction}
          latestNote={latestNote}
          copilotSummary={copilotSummary}
          copilotExtra={copilotExtra}
          recordId={recordId}
          channels={channels}
          onOpenConversation={onOpenHistoryConversation}
          // `undefined` (no button at all) when "Contacts" isn't one of
          // this panel's configured `tabs` — see `visibleTabs`'s own doc
          // comment above for why: without this gate, Overview's "View All
          // Contacts" button would jump `activeTab` to a tab that isn't
          // in the header at all (Agent Workspace 2.0's own reduced tab set).
          onViewAllInteractions={
            tabs.includes("Contacts")
              ? () => setActiveTab(CUSTOMER_PANEL_TABS.indexOf("Contacts"))
              : undefined
          }
          draft={recordDraft.draft}
          onDraftChange={recordDraft.updateDraft}
          onPhoneChange={recordDraft.updatePhone}
          onOverviewFieldChange={recordDraft.updateOverviewField}
          overviewEditing={overviewEditing}
          onOverviewEditingChange={onOverviewEditingChange}
          // Per explicit request — this is one of the two real panels, so it
          // offers the Customer Overview edit button.
          allowOverviewEdit
          // Per explicit request ("put the customer available channels in
          // the Customer Overview in the same row as the edit... for all
          // Customer Information panels") — `row` (derived above, see
          // `resolveCustomerListRecord`'s own doc comment) feeds the same
          // `CustomerAddChannelButton` channel-icon row `CustomerRowInfoPanel`/
          // `CustomerFullScreenTabContent` already show; `null` (an ad-hoc/
          // unknown contact) simply renders no channel icons, same as those
          // two consumers already do for their own `row`-less case.
          row={row}
          onStartInteraction={onStartInteraction}
        />
      )}
    </SidePanel>
  );
}
