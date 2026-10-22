// Workspace controller, slice 6 of 6 (P-EXTRACT C8b): the header apps (the
// Search panel's content, each app's panel content, the shared panel's
// button handler, the "View All Apps" menu, the responsive icon collapse),
// the shared panel itself (docked/float and fullscreen), the left nav's
// rail items, the AI content's link handler and render helpers (the
// Autosummary, the AI overview and feed, Contact Details' tabs), the docked
// Copilot composer's slot, and the New Outbound launcher. The page's body,
// moved in order (hook order unchanged); see `useWorkspaceController`.
import { useState, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import type { ReferenceCardProps } from "@/components/customer-info/reference-sections";
import {
  ActionIconButton,
  Badge,
  ContainerHeader,
  Draggable,
  PanelPinButton,
  Tooltip,
  useColumnReorder,
  type EmbeddablePanelContent,
  type MenuEntry,
} from "@nicecxone/lyra-ui";
import {
  Bell,
  Building2,
  CalendarDays,
  GripVertical,
  Maximize2,
  MessageSquare,
  Minimize2,
  MonitorUp,
  Move,
  Pin,
  Search,
  Ticket,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AiActionsFeed } from "@/components/agent-next-gen-transcript";
import { isAiActionMessage } from "@/components/agent-next-gen-ai-messages";
import { buildNavItems } from "@/components/agent-next-gen-interaction-dashboard";
import { useSearchPanelContent } from "@/components/agent-next-gen-search-panel";
import { AGENT_WORKSPACE_CUSTOMER_PANEL_TABS, DetailsPanelAccordions } from "@/components/agent-next-gen-customer-info-panel";
import { ADDRESS_BOOKS, AutosummaryCard, NewOutboundLauncher } from "@/contact-handling";
import { LUCAS_THOMAS_ID, MARCUS_WEBB_ID } from "@/contact-handling/scenario-cases";
import { leftNavKeysFromHeader, type ExtraHeaderApp } from "@/settings";
import { MARCUS_WEBB_ORDER } from "@/components/agent-next-gen-marcus-webb-next-best-action-card";
import type { LucasThomasMemoryFocus, LucasThomasPanelKey } from "@/components/agent-next-gen-lucas-thomas-panels";
import type { PanelKey } from "@/contact-handling/workspace/workspace-types";
import { HostSlot } from "@/contact-handling/portal-hosts";
import { INTERACTION_MAIN_CONTENT_MIN_WIDTH, SEARCH_PANEL_TABS, SHARED_CONTENT_MIN_VISUAL_WIDTH } from "@/components/workspace/workspace-constants";
import type { WsOutbound } from "./useWsOutbound";

export function useWsHeaderApps(prev: WsOutbound) {
  const {
    SHARED_PANEL_MAX_WIDTH, activeChannelKey, activeInteraction, activeInteractionId, activeInteractionIsRealCustomer,
    activePanelKey, activePreContactSummary, addToast, aiFollowSignal, aiInPanel, aiWorkspaceMain, blankPanelContent,
    bodyContainerWidth, calling, channelPreviewThread, copilotFollows, copilotHost, customerContextOverviewInfo,
    customerInfoPreviewOpen, customerInfoPreviewTimer, contactDetailsView, customerTable, fullScreenRendered,
    fullScreenVisible, handleCopilotAsk, handleDialpadSubmit, handleFullScreenToDragMode, handleLucasApprovalDecision,
    handleLucasCallRequest, handleOpenInteractionRow, handlePanelVariantChange, handleStartCall, headerSettings,
    hoverDockMounted, interactions, isColdCallId, isNavNarrow, journeySummaryUpdatedAtTick, leftNavPage,
    lucasActiveLinkKey, lucasThomasReviewing, marcusCardHost, navOpen, notifContent, notifications,
    openDetailPanelContent, openExperienceMemoryInSidePanel, outboundConfig, outboundDial, outboundSettings,
    panelArtifacts, panelHeight, panelMounted, panelOpen, panelPlacement, panelRef, panelVariant,
    panelWidth, pinnedKeys, reopenPanelArtifact, scenarioCases, scenarioKeyOf, scheduleContent, screenPopContent,
    selectedDetailPanelContent, sessionDetailsTabContent, setActivePanelKey, setCustomerInfoPreviewOpen,
    setCustomerPanelActiveTab, setLeftNavPage, setLinkCustomerPanelOpen, setNarrowActiveRegion, setPanelFullScreen,
    setPanelIsResizing, setPanelOpen, setPanelWidth, setSelectedDetailPanelContent, setShowAllContacts,
    setShowSettings, setSidePanelOpen, showAllContacts, showSettings, switchActiveInteraction,
    togglePinnedKey, focusCustomerPanelTab, handleLinkCustomerFromPreview,
  } = prev;
  // Search — per explicit request, the Interactions table (previously its
  // own top-level desk tab, `InteractionsListView`, agent-next-gen-
  // interactions-table.tsx) has been MOVED here as this panel's body,
  // replacing the old blank "Nothing here yet" placeholder — not
  // duplicated; the desk tab itself is gone (see `deskTabOrder`'s own
  // initial array and the `activeDeskTab` render branch further down,
  // both of which no longer include `"interactions"`).
  //
  // Built via the shared `useSearchPanelContent` hook (agent-next-gen-
  // search-panel.tsx) — per a follow-up explicit request, this Search
  // panel's tab/content system is now shared with
  // `AgentWorkspace2WithDeskPage.tsx` too. `tabs: SEARCH_PANEL_TABS` below
  // is now dead/unused — per the latest explicit request ("in advanced
  // and premium, clear the search panel of content and just have a
  // search bar...") this call site passes `simpleCustomerSearch: true`
  // instead, which makes the hook ignore `tabs` entirely (see that
  // option's own doc comment) — kept only because the hook's own internal
  // `activeTab` state still needs a non-empty array to seed its
  // (unreachable-in-this-mode) `useState` initializer.
  //
  // Customers' body reuses the EXACT SAME lifted state the Home Customers
  // tab uses (`customerTable`, `useCustomerTableState`) rather than a second,
  // independent copy — it's conceptually the SAME customer list/filters/
  // sort/selection either way, just reachable from two different places
  // in the UI, so both should always agree rather than silently drifting
  // apart. `CustomersListView` itself is a fully controlled component (no
  // internal state of its own — every prop is lifted, see its own props
  // doc comments), so mounting a second instance of it here (inside the
  // hook) with those same props/handlers is safe: both instances just
  // render synced views of that one shared state, and acting on either
  // updates it for both.
  //
  // The headerContent wrapper these 3 panel-render call sites already put
  // around EVERY panel's `headerContent` (docked/fullscreen/combined-mode,
  // all `<div className="shrink-0 px-4 pb-3 border-b ...">`) draws its own
  // `border-b` right underneath regardless, so a `TabList` here — which
  // already has its own `border-b` right under the tab row itself — showed
  // two stacked horizontal lines: the tab row's own bottom border (the
  // "tab separator", flush under the labels/active-indicator) AND that
  // wrapper's (the "heading separator", a few pixels further down, below
  // the wrapper's own `pb-3` padding). Per explicit request, it's the
  // WRAPPER's border that's suppressed here (not the TabList's own) — see
  // each of those 3 call sites' own `activePanelKey === "search"` check —
  // so the single remaining divider is the tab row's own, flush underline,
  // not the lower one.
  const searchContent = useSearchPanelContent({
    tabs: SEARCH_PANEL_TABS,
    onAddToast: addToast,
    onOpenInteraction: handleOpenInteractionRow,
    simpleCustomerSearch: true,
    customers: {
      onStartInteraction: (contact, channel, phone, skillId) =>
        handleStartCall({ contact, channel, phone, skillId }),
      ...customerTable,
      // Clicking a row opens `CustomerRowInfoPanel`, or closes it on the
      // open row. The panel's full-screen toggle is suppressed separately
      // (`hideFullScreenToggle`, agent-next-gen-search-panel.tsx).
      onRowClick: customerTable.toggleRow,
      // Per explicit follow-up ("you didn't add the icon to advanced") —
      // the Search panel's own Customers sub-tab only ever renders from
      // this page (see its own `leadingChannelStack` doc comment), so it
      // gets the same eye-icon "is this customer open" check the main
      // Desk-tab table below already uses (no `openCustomerTabs` concept
      // on this tier, same as that call site).
      isRowOpen: (row) => interactions.some((i) => i.customerId === row.contactNumber),
      // Matches this tier's own main desk-tab Customers view's own
      // `CustomerRowInfoPanel` call site (`tabs={AGENT_WORKSPACE_CUSTOMER_
      // PANEL_TABS}`, below) — see `panelTabs`'s own doc comment (agent-
      // next-gen-search-panel.tsx) for why this is now threaded through
      // explicitly instead of hard-coded inside the hook.
      panelTabs: AGENT_WORKSPACE_CUSTOMER_PANEL_TABS,
    },
  });
  const contentByPanelKey: Record<PanelKey, EmbeddablePanelContent> = {
    notif: notifContent,
    conversations: blankPanelContent("Agent Chat"),
    schedule: scheduleContent,
    screenpop: screenPopContent,
    customers: blankPanelContent("Customers"),
    accounts: blankPanelContent("Accounts"),
    tickets: blankPanelContent("Tickets"),
    // WEM = Workforce Engagement Management
    wem: blankPanelContent("WEM"),
    search: searchContent,
  };
  const activePanelContent = activePanelKey ? contentByPanelKey[activePanelKey] : null;

  // Below 768px, a DOCKED (not floating) open panel combines with the main
  // container into a single container with two tabs — one for whatever the
  // main view currently is (Settings/an active interaction/Home), one for
  // the panel — instead of sitting docked beside it. `panelOpen` is
  // required (not just `activePanelContent`, which stays non-null after
  // closing — `handlePanelButtonClick` never clears `activePanelKey`, only
  // `panelOpen`) so this doesn't stay "true" for a panel that's actually
  // closed.
  const isCombinedPanelMode = isNavNarrow && panelOpen && panelVariant === "docked" && !!activePanelContent;
  // `showAllContacts` alone isn't enough once it stops being cleared on
  // interaction start (see that state's own doc comment) — `!activeInteraction`
  // keeps this label matching the ternary branch actually rendered below.
  const mainRegionTabLabel = showSettings
    ? "Settings"
    : showAllContacts && !activeInteraction
      ? "All Contacts"
      : activeInteraction
        ? `${activeInteraction.customerName ?? "Customer"} (${activeInteraction.customerId})`
        : "Home";

  // Clicking a button: re-clicking the CURRENTLY showing one closes the
  // shared container outright. Otherwise, if it's closed, open it in
  // whatever `panelVariant` already is (see that state's own doc comment
  // above); if it's already open showing a DIFFERENT key, only
  // `activePanelKey` changes — the container itself never resizes,
  // repositions, or re-animates open+close, only its title/body content
  // does.
  const handlePanelButtonClick = (key: PanelKey) => () => {
    if (panelOpen && activePanelKey === key) {
      setPanelOpen(false);
      return;
    }
    if (!panelOpen) {
      setPanelOpen(true);
    }
    setActivePanelKey(key);
    // Below 768px, opening a panel switches straight to its tab — otherwise
    // clicking a header icon while narrow would silently open the panel
    // behind whatever the main tab currently shows, with no visible change.
    if (isNavNarrow) setNarrowActiveRegion("panel");
  };

  // Per explicit follow-up request ("detach the contacts table from the
  // search panel and have it exist on its own") — wired to
  // `ContactHistoryCard`'s own `onOpenAllContacts` prop below. The original
  // version of this handler opened the shared right-docked Search panel's
  // own "Contacts" tab, maximized to full screen (see BEHAVIOR.md §134);
  // this follow-up replaces that entirely with the new `showAllContacts`
  // top-level view (declared next to `showSettings` above) — no panel
  // involved at all anymore. Reaches the Contacts table, not "Customers"
  // (the separate customer-database tab this tier alone also has).
  const handleOpenAllContacts = () => {
    setShowAllContacts(true);
  };

  // "Selected" treatment for whichever AppHeader icon button currently owns
  // the shared panel — same `bg-lyra-bg-active-moderate`/`text-lyra-fg-
  // active-strong` "active" idiom `PanelPinButton`/`LeftNav`/`Tabs` already
  // use elsewhere in the design system (also now `NotificationsBell`'s own
  // open state, notifications-bell.tsx), not a plain hover tint. Matches
  // lyra-ui's own "Multiple Containers" Storybook demos (`Draggable.
  // stories.tsx`), which use this exact class for the same purpose.
  const PANEL_BUTTON_SELECTED_CLASS = "bg-lyra-bg-active-moderate text-lyra-fg-active-strong hover:bg-lyra-bg-active-moderate";

  // Per-key label/icon used to build the "View All Apps" menu rows below —
  // same labels/icons as the header buttons' own `title`/child-icon pairs
  // above, just centralized so the menu doesn't hand-duplicate them.
  // "notif" uses `Bell` here (a plain menu row), unlike the header itself,
  // which keeps using the specialized `NotificationsBell` component (badge
  // count, its own portal, etc.) for that one button.
  const PANEL_KEY_METADATA: Record<PanelKey, { label: string; icon: LucideIcon }> = {
    notif: { label: "Notifications", icon: Bell },
    conversations: { label: "Agent Chat", icon: MessageSquare },
    schedule: { label: "Schedule", icon: CalendarDays },
    screenpop: { label: "Screen Pop", icon: MonitorUp },
    customers: { label: "Customers", icon: Users },
    accounts: { label: "Accounts", icon: Building2 },
    tickets: { label: "Tickets", icon: Ticket },
    wem: { label: "WEM", icon: UserCog },
    search: { label: "Search", icon: Search },
  };
  const PANEL_KEY_INITIAL_ORDER: PanelKey[] = [
    "search", "customers", "accounts", "tickets", "wem",
    "screenpop", "conversations", "schedule", "notif",
  ];
  // Live, user-reorderable order for both the header icon row AND the "View
  // All Apps" menu — ONE shared hook instance/state so dragging either
  // surface updates the exact same array the other one reads, rather than
  // two independently-drifting copies. `useColumnReorder` (lyra-ui,
  // table.tsx) already implements exactly this — a generic `K extends
  // string`-keyed array plus native HTML5 drag handlers — for
  // `SortableTableHead`'s column reordering; reused as-is here rather than
  // hand-rolling a second copy of the same splice/dataTransfer logic.
  const {
    columnOrder: panelOrder,
    dragOverKey: panelDragOverKey,
    dragHandlers: panelDragHandlers,
  } = useColumnReorder<PanelKey>(PANEL_KEY_INITIAL_ORDER);
  // Each row: clicking it opens that app in the shared panel (same handler
  // the header icon uses) and closes the menu; the trailing `PanelPinButton`
  // toggles `pinnedKeys` without triggering that — Radix closes the menu on
  // any click inside an item by default, so the pin button's own click is
  // wrapped in a `stopPropagation` span to both keep the menu open and avoid
  // also firing the row's `onClick` (which would open that app's panel too).
  // `draggable`/`onDragStart`/etc. wire this row into the exact same
  // `panelDragHandlers` the header icon buttons below use — dragging a row
  // here to reorder it moves the same underlying `panelOrder` array the
  // header reads, and vice versa.
  //
  // Customers/Accounts/Tickets are hidden from this menu specifically (per
  // explicit request) — `panelOrder`/`pinnedKeys` themselves are untouched,
  // so Accounts/Tickets (unpinned) simply have no way to open them anymore,
  // since this menu was their only entry point; Customers (also unpinned)
  // is the same, but has its Search-panel Customers tab as a real
  // alternative entry point. WEM is deliberately NOT in this list (dropped
  // per a follow-up explicit request, "Add WEM to the top right app area")
  // — it's now pinned (see `pinnedKeys` above) AND listed here, a fully
  // reachable, discoverable app like Notifications/Agent Chat/etc.
  const HIDDEN_FROM_APPS_MENU: PanelKey[] = ["customers", "accounts", "tickets"];
  const appsMenuItems: MenuEntry[] = panelOrder.filter((key: PanelKey) => !HIDDEN_FROM_APPS_MENU.includes(key)).map((key) => {
    const { label, icon: KeyIcon } = PANEL_KEY_METADATA[key];
    return {
      id: key,
      label,
      icon: <KeyIcon className="h-4 w-4" strokeWidth={1.5} />,
      // Mirrors the header icon buttons' own `PANEL_BUTTON_SELECTED_CLASS`
      // condition — whichever app currently owns the shared panel gets the
      // same blue "active" row treatment here (MenuRadixItem's `item.active`
      // branch) that its header icon gets.
      active: panelOpen && activePanelKey === key,
      onClick: handlePanelButtonClick(key),
      // Selecting an app should just switch the shared panel to it, the
      // same way clicking its header icon would — not also close this
      // menu, since a caller might want to pin/unpin or jump between
      // several apps in one pass without it snapping shut after the first.
      closeOnSelect: false,
      draggable: true,
      dragOver: panelDragOverKey === key,
      onDragStart: (e) => panelDragHandlers.onDragStart(e, key),
      onDragOver: (e) => panelDragHandlers.onDragOver(e, key),
      onDrop: (e) => panelDragHandlers.onDrop(e, key),
      onDragEnd: panelDragHandlers.onDragEnd,
      onDragLeave: panelDragHandlers.onDragLeave,
      // Keyboard alternative to the drag reorder above (lyra-ui MenuRadix:
      // Alt+Shift+ArrowUp/Down on a focused row) — same shared order state.
      onKeyboardMove: (direction: -1 | 1) => panelDragHandlers.onKeyboardMove?.(key, direction),
      rightElement: (
        <span className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {/* Same unread count `NotificationsBell`'s own header icon shows
              (`notifications.filter((n) => !n.read).length`) — reused here,
              not recomputed with different criteria, so this row can't tell
              a different story than the icon it's a menu-row stand-in for.
              `Badge`'s own `shape="circle"`/`variant="critical"`/`size="sm"`
              is the exact styling `Button`'s built-in `badge` prop already
              uses for this same count elsewhere (button.tsx) — reused
              directly since a `Menu` row's `rightElement` isn't an
              icon-shaped `Button`/`ActionIconButton` itself, so that prop
              isn't available here the way it is on the header icon. */}
          {key === "notif" && notifications.filter((n) => !n.read).length > 0 && (
            <Badge shape="circle" variant="critical" size="sm" count={notifications.filter((n) => !n.read).length} />
          )}
          <PanelPinButton
            pinned={pinnedKeys[key]}
            onToggle={() => togglePinnedKey(key)}
            pinnedLabel={`Unpin ${label}`}
            unpinnedLabel={`Pin ${label}`}
            // Notifications used to be forced pinned here (`disabled` +
            // hardcoded `pinnedLabel` explaining why) — per explicit
            // request it's unpinnable like every other app now. Unpinning
            // it just stops rendering `NotificationsBell` in the header
            // (same `showHeaderIcon` gate every other key already goes
            // through, see that loop below) — it doesn't lose the count
            // itself, which reappears as a badge on "View All Apps" instead
            // (see that button's own `badge` prop below), so an unread
            // notification is never silently unreachable.
            //
            // Only override the icon/className when PINNED — unpinned rows
            // pass neither prop, so they fall straight through to
            // `PanelPinButton`'s own untouched default rendering (plain gray
            // outline Pin, no rotation since `pinned` is false), exact same
            // as before this change. Pinned rows get a custom solid blue pin
            // (`fill-lyra-fg-active-strong` + matching `text-*`, same
            // "filled + colored icon" idiom `FavoriteButton`'s star already
            // uses) instead of the default's plain 45°-rotated outline Pin.
            // Passing a custom `icon` also opts this into `PanelPinButton`'s
            // "selected button background" treatment — not wanted here,
            // just the icon itself should read as filled/blue — so
            // `className` overrides that back to transparent (twMerge drops
            // the conflicting `bg-*`), also only when pinned.
            icon={
              pinnedKeys[key] ? (
                <Pin className="h-4 w-4 rotate-45 fill-lyra-fg-active-strong text-lyra-fg-active-strong" strokeWidth={1.5} />
              ) : undefined
            }
            className={pinnedKeys[key] ? "bg-transparent hover:bg-lyra-state-hover" : undefined}
          />
        </span>
      ),
    };
  });

  // ── Responsive header icon collapse ──
  // As the viewport narrows, the pinned icon-button row can eventually run
  // out of room and squish/wrap `AppName` ("Agent Next Gen") instead — so
  // rather than letting that happen, buttons drop out of the header one at
  // a time, always starting with the FARTHEST LEFT pinned one in the
  // *current* (user-reorderable) `panelOrder` — since that's the icon
  // nearest `AppName` and the first to collide with it as space runs out,
  // dragging a button further right also moves it further down the "gets
  // hidden first" list. A dropped button isn't gone — same as unpinning it,
  // it just stops rendering in the header and stays reachable via "View All
  // Apps" (`appsMenuItems` above lists every key regardless of pinned/
  // responsively-hidden state).
  //
  // This used to be a table of fixed viewport-width breakpoints, which
  // hid icons well before they actually needed the room (lots of dead space
  // between `AppName` and the icons at widths that were already hiding
  // several of them) and didn't account for anything BUT window width
  // (e.g. a wider/narrower `AppName` — it hardcodes "Agent Next Gen" today,
  // but AppMenu/AppName are generic). Replaced with real geometry: measure
  // the actual gap between `AppName`'s rendered right edge
  // (`appNameMeasureRef`) and the visible icon row's rendered left edge
  // (`headerIconsMeasureRef`) after every layout, and only hide/reveal a
  // icon when that gap actually crosses a threshold — i.e. when they're
  // genuinely about to collide, not on a width guess. A small hysteresis
  // gap (`SHOW_GAP_PX` well above `HIDE_GAP_PX`) keeps this from
  // flapping — hiding an icon frees up roughly one icon's width of gap,
  // which would otherwise immediately clear the "show one back" threshold
  // and re-show it next frame.
  const pinnedKeysInHeaderOrder = panelOrder.filter((key) => pinnedKeys[key]);
  const appHeaderRef = useRef<HTMLElement>(null);
  const appNameMeasureRef = useRef<HTMLDivElement>(null);
  const headerIconsMeasureRef = useRef<HTMLDivElement>(null);
  const [autoHiddenCount, setAutoHiddenCount] = useState(0);
  useLayoutEffect(() => {
    const HIDE_GAP_PX = 16; // start hiding once closer than this
    const SHOW_GAP_PX = 84; // ~44px icon + gap, plus headroom above HIDE_GAP_PX so it doesn't immediately re-show what was just hidden
    const measure = () => {
      const appNameEl = appNameMeasureRef.current;
      const iconsEl = headerIconsMeasureRef.current;
      if (!appNameEl || !iconsEl) return;
      const gap = iconsEl.getBoundingClientRect().left - appNameEl.getBoundingClientRect().right;
      setAutoHiddenCount((prev) => {
        if (gap < HIDE_GAP_PX && prev < pinnedKeysInHeaderOrder.length) return prev + 1;
        if (gap > SHOW_GAP_PX && prev > 0) return prev - 1;
        return prev;
      });
    };
    measure();
    // Widening the window back out doesn't necessarily change either
    // measured element's OWN size — once `AppName` is back to its natural
    // width and the hidden icons are gone, both boxes can sit still while
    // `justify-between` just grows the empty space between them, so a
    // ResizeObserver on only those two elements can miss the "there's now
    // room again" case entirely (this was the bug: icons stayed hidden
    // after growing the window back, even once the gap ,`prev` never
    // re-evaluated because nothing observed had actually changed size). The
    // header's OWN box, and the window itself, reliably do change size on
    // every resize regardless of whether `AppName`/the icon row happen to
    // — observing/listening to those too guarantees at least one
    // `measure()` call per resize either way.
    const ro = new ResizeObserver(measure);
    if (appHeaderRef.current) ro.observe(appHeaderRef.current);
    if (appNameMeasureRef.current) ro.observe(appNameMeasureRef.current);
    if (headerIconsMeasureRef.current) ro.observe(headerIconsMeasureRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // Re-measure whenever the pinned set changes (pinning/unpinning shifts
    // how many icons COULD show) and every time `autoHiddenCount` itself
    // changes — each change nudges the count by exactly one and re-runs
    // this effect, converging step by step rather than jumping straight to
    // a final value in one pass.
  }, [pinnedKeysInHeaderOrder.length, autoHiddenCount]);
  const responsivelyHiddenKeys = new Set(
    pinnedKeysInHeaderOrder.slice(0, Math.min(autoHiddenCount, pinnedKeysInHeaderOrder.length))
  );
  const showHeaderIcon = (key: PanelKey) => pinnedKeys[key] && !responsivelyHiddenKeys.has(key);

  // How much room the DOCKED shared panel can actually claim without
  // pushing `containerRef`'s own `min-w-[374px]` floor (and so the whole
  // row) past the viewport — see `INTERACTION_MAIN_CONTENT_MIN_WIDTH`'s own
  // doc comment for the full reasoning. Computed here (not just down at the
  // docked-panel render block that actually uses it) so it can ALSO feed
  // `Draggable`'s own `maxWidth` prop below — per explicit follow-up
  // report, capping only the RENDERED width (this file's own earlier
  // attempt) still let an active drag visually run the panel off the right
  // edge of the screen while dragging, since that render-width clamp used
  // to explicitly bypass itself while `panelIsResizing`. `Draggable` itself
  // already re-reads `maxWidth` live on every pointer-move during a drag
  // (`draggable.tsx`'s own resize handlers), so feeding it this same,
  // per-render-fresh boundary stops the drag handle itself right at the
  // wall instead of only clipping the box after the fact.
  const leftNavRenderWidth = isNavNarrow ? 0 : navOpen ? 256 : 60;
  const maxDockedWidthForMainFloor = Math.max(
    0,
    bodyContainerWidth - leftNavRenderWidth - INTERACTION_MAIN_CONTENT_MIN_WIDTH - 12
  );

  // The one shared `Draggable` — its header (icon/actions/title) and body
  // swap to whichever button's content is active; the container itself
  // (variant/width/position) never does.
  const sharedPanel = panelMounted && activePanelContent ? (
    <Draggable
      ref={panelRef}
      variant={panelVariant}
      defaultWidth={panelWidth}
      defaultHeight={panelHeight}
      // Shares `containerRef`'s own tested VISUAL content floor
      // (`SHARED_CONTENT_MIN_VISUAL_WIDTH`) rather than a separate,
      // never-validated 280px default — per explicit request to give the
      // main content column and the docked shared panel the same real
      // on-screen minimum size. Deliberately NOT
      // `INTERACTION_MAIN_CONTENT_MIN_WIDTH` (374) — that number already has
      // `containerRef`'s own `pr-3` padding baked in (see that constant's own
      // doc comment), but this outer box carries no equivalent padding of
      // its own, so adding it here would make the panel's floor render 12px
      // WIDER than `containerRef`'s, not the same. Below this the panel's
      // own content (list rows, labels, actions) gets just as cramped as the
      // main column would.
      minWidth={SHARED_CONTENT_MIN_VISUAL_WIDTH}
      // This instance already computes its own precise ceiling from real
      // sibling layout (`maxDockedWidthForMainFloor`, above) — `Draggable`'s
      // generic "below 1440px viewport, tighten to 800px" heuristic
      // (`getResponsiveMaxWidth`) has no visibility into that and was
      // capping the panel below 1024px even while `containerRef` sat
      // comfortably above its own floor with room to spare. Opting out lets
      // the floor-aware ceiling be the only cap, matching the explicit
      // requirement: resizable up to `SHARED_PANEL_MAX_WIDTH` OR until
      // `containerRef` hits its floor, whichever is smaller — nothing else.
      disableResponsiveMaxWidth
      // Deliberately NOT unified with `containerRef`'s max — main stays
      // uncapped (grows to fill whatever's left via `flex-1`) per explicit
      // request; only the DOCKED panel is capped here, to stop it from
      // squeezing `containerRef` under its own floor (see
      // `maxDockedWidthForMainFloor`'s own doc comment just above). No
      // effect on the FLOAT variant (an undocked/dragged float panel
      // doesn't claim any of `containerRef`'s layout space to begin with).
      // Fullscreen bypasses `Draggable` entirely (see
      // `sharedPanelFullScreenOverlay`) and is already uncapped — it fills
      // whatever `containerRef` itself measures, with no width cap of its
      // own, so "uncapped when full screen" falls out for free here.
      maxWidth={panelVariant === "docked" ? Math.min(SHARED_PANEL_MAX_WIDTH, maxDockedWidthForMainFloor) : SHARED_PANEL_MAX_WIDTH}
      minHeight={400}
      onVariantChange={handlePanelVariantChange}
      onWidthChange={setPanelWidth}
      onResizeStateChange={setPanelIsResizing}
      className={cn(
        "rounded-lyra-lg border border-lyra-border-subtle",
        // Floating (undocked/dragged) gets an 0.8 (80%) opacity background
        // per explicit request — plain `bg-lyra-bg-surface-base/80` can't
        // work here since Tailwind can't generate opacity-modified
        // utilities for our `var(--lyra-color-*)` tokens (same root cause
        // as the Modal backdrop's own `color-mix()` override, overlay.tsx/
        // AgentNextGenPage.tsx doc comments), so `color-mix()` directly
        // against the same `--lyra-color-bg-surface-base` variable the
        // plain utility itself resolves to (tailwind-preset.ts) is used
        // instead. Docked keeps the normal fully-opaque background.
        // `backdrop-blur-sm` (4px) — "blur the background slightly" —
        // softens whatever shows through that 20% transparency, same
        // pairing the Modal backdrop's own color-mix()-plus-backdrop-blur-sm
        // treatment already uses (entry-agent-next-gen-v2.tsx).
        panelVariant === "float"
          ? "shadow-lg backdrop-blur-sm bg-[color-mix(in_srgb,var(--lyra-color-bg-surface-base)_80%,transparent)]"
          : "h-full bg-lyra-bg-surface-base"
      )}
      renderHeaderControls={({ gripProps, dockButtonProps, dockIcon, variant: dVariant }) => (
        <>
          <ContainerHeader
            title={activePanelContent.title}
            titleText={activePanelContent.titleText}
            titleBadge={activePanelContent.titleBadge}
            titleClassName={activePanelContent.titleClassName}
            icon={
              dVariant === "float"
                ? <div {...gripProps}><GripVertical className="h-4 w-4" strokeWidth={1.5} /></div>
                : activePanelContent.dockedIcon
            }
            bordered={!activePanelContent.headerContent}
            actions={
              <>
                {activePanelContent.headerActions}
                <Tooltip content="Full Screen" placement="bottom" asLabel>
                  <ActionIconButton
                    aria-label="Full Screen"
                    size="sm"
                    onClick={() => setPanelFullScreen(true)}
                    className="text-lyra-fg-secondary hover:text-lyra-fg-secondary"
                  >
                    <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </ActionIconButton>
                </Tooltip>
                <Tooltip content={dockButtonProps["aria-label"]} placement="bottom" asLabel>
                  <ActionIconButton
                    {...dockButtonProps}
                    size="sm"
                    className="text-lyra-fg-secondary hover:text-lyra-fg-secondary"
                  >
                    {dockIcon}
                  </ActionIconButton>
                </Tooltip>
              </>
            }
            onClose={() => setPanelOpen(false)}
            // Reverted back to `ContainerHeader`'s own generic default `X`
            // — see AgentNextGenPage.tsx's own matching call site for the
            // full doc comment; mirrored here verbatim.
          />
          {activePanelContent.headerContent && (
            // `activePanelKey === "search"` skips this wrapper ENTIRELY
            // (no padding, no border) for the Search panel's tabbed
            // headerContent, per explicit request — its `TabList` is meant
            // to sit flush against the panel's own edges (left/right/
            // bottom), not inset like every other panel's headerContent
            // (Screen Pop's Select, etc.), which still gets the padded,
            // bordered wrapper as before. `TabList` already draws its own
            // "tab separator" underline right under the tabs themselves
            // regardless (see `searchContent`'s own doc comment), so
            // there's still a real divider here even with the wrapper
            // gone.
            activePanelKey === "search" ? (
              activePanelContent.headerContent
            ) : (
              <div className="shrink-0 px-4 pb-3 border-b border-lyra-border-subtle">
                {activePanelContent.headerContent}
              </div>
            )
          )}
        </>
      )}
    >
      {/* Per explicit request ("when the user navigates between apps,
          please have them fade in when transitioning"): `key={activePanelKey}`
          forces a fresh mount on every app switch (Home/Search/Agent Chat/
          Schedule/etc.), which is what lets `animate-in fade-in-0` actually
          replay instead of only firing once ever — same "force a remount to
          replay animate-in" pattern this file's own desk-tab switch and
          active-interaction switch already use elsewhere in this file.
          Applied identically at every render site of `activePanelContent.
          body` (this docked/float `Draggable`, the fullscreen overlay, and
          the combined-mode panel below) so the fade is consistent
          regardless of which layout is currently active. */}
      <div key={activePanelKey} className="flex flex-col flex-1 min-h-0 animate-in fade-in-0 duration-200">
        {activePanelContent.body}
      </div>
    </Draggable>
  ) : null;

  // Fullscreen overlay for the shared panel — see `panelFullScreen`'s own
  // doc comment above for why this bypasses `Draggable` entirely rather
  // than trying to make its "float" variant cover the container. Mirrors
  // the Customer Information panel's header shape (title/icon/actions via
  // `ContainerHeader`, using the same `activePanelContent` the docked/float
  // rendering above uses) plus a `Minimize2` "exit full screen" action.
  // Positioned against `containerRef`'s own div (see where this is
  // rendered, below), which is already `relative` and is exactly the "main
  // content container" (everything right of LeftNav, below AppHeader) this
  // should fill; NOT `fixed`/the viewport, which would also cover LeftNav
  // and AppHeader. Deliberately NOT a plain `inset-0`, either — the
  // containing block for an absolutely positioned element is its
  // ancestor's PADDING box, so `right-0`/`bottom-0` would land flush with
  // containerRef's true outer edge, swallowing its own `pr-3 pb-3` (the
  // same gap the normal docked panel gets via its wrapper's `marginRight:
  // 12`/`pb-3`). Using `right-3 bottom-3` instead (matching `pr-3`/`pb-3`'s
  // 12px) reproduces that same gap so the fullscreen panel lines up with
  // where the docked panel's own right/bottom edges would sit — flush only
  // on top/left, matching the docked panel's own flush-top/flush-left
  // look. `rounded-lyra-lg border ... overflow-hidden` also matches
  // `sharedPanel`'s own docked-variant styling (and `Draggable`'s own
  // docked-branch wrapper, which always applies `overflow-hidden` — see
  // draggable.tsx) rather than the previous full-bleed/borderless look.
  // `z-[9]` sits above the Customer Information panel's `z-[5]` but
  // deliberately BELOW LeftNav's own collapse/expand toggle button
  // (`z-10`, left-nav.tsx) — that button is positioned `absolute -right-3`
  // (poking ~12px past LeftNav's own right edge, i.e. spatially into
  // `containerRef`'s territory), and `containerRef` itself doesn't
  // establish its own stacking context (no z-index of its own), so a
  // descendant's z-index here competes directly against LeftNav's
  // sibling-level z-10, not just against other things inside `containerRef`
  // — going any higher (e.g. the `z-[50]` this used originally) paints
  // over/hides that toggle button, per explicit follow-up request to keep
  // it clickable/visible instead. Doesn't need to compete with the
  // app-header's own menus (`z-[9999]`) — those live in a different row
  // entirely (above `containerRef`, not inside it).
  // Mounted on `fullScreenRendered` (which outlives `panelFullScreen` by
  // 180ms on the way out — see that state's own doc comment) rather than
  // `panelFullScreen` directly, so the fade/scale-out transition below
  // actually gets to play instead of the overlay just disappearing the
  // instant fullscreen is exited. The transition itself keys off
  // `fullScreenVisible`, NOT `panelFullScreen` directly — see that
  // state's own doc comment for why a freshly-mounted node needs a
  // separate "hidden first, visible one frame later" flag to actually
  // animate in, rather than just popping straight to its final opacity/
  // scale with nothing to transition from. CSS transition (not a
  // keyframe animation) per the same reasoning as the float/docked panels
  // just below — avoids compositor fill-mode flash. `scale`'s default
  // center origin reads fine here since this overlay already fills the
  // whole container; a corner-anchored origin would need `transformOrigin`
  // too, but center suits a "settle into place" feel just as well without
  // the extra complexity.
  const sharedPanelFullScreenOverlay = panelMounted && activePanelContent && fullScreenRendered ? (
    <div
      className="absolute top-0 left-0 right-3 bottom-3 z-[9] flex flex-col rounded-lyra-lg border border-lyra-border-subtle bg-lyra-bg-surface-base overflow-hidden"
      style={{
        opacity: fullScreenVisible ? 1 : 0,
        transform: fullScreenVisible ? "scale(1)" : "scale(0.98)",
        transition: fullScreenVisible
          ? "opacity 200ms ease, transform 200ms cubic-bezier(0.4, 0, 0.2, 1)"
          : "opacity 150ms ease, transform 150ms ease",
        pointerEvents: fullScreenVisible ? "auto" : "none",
      }}
    >
      <ContainerHeader
        title={activePanelContent.title}
        titleText={activePanelContent.titleText}
        titleBadge={activePanelContent.titleBadge}
        titleClassName={activePanelContent.titleClassName}
        icon={activePanelContent.dockedIcon}
        bordered={!activePanelContent.headerContent}
        actions={
          <>
            {activePanelContent.headerActions}
            <Tooltip content="Exit Full Screen" placement="bottom" asLabel>
              <ActionIconButton
                aria-label="Exit Full Screen"
                size="sm"
                onClick={() => setPanelFullScreen(false)}
                className="text-lyra-fg-secondary hover:text-lyra-fg-secondary"
              >
                <Minimize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              </ActionIconButton>
            </Tooltip>
            {/* "Drag mode" — see `handleFullScreenToDragMode`'s own doc
                comment for why this (not `Draggable`'s own dock button,
                which isn't mounted while fullscreen) is how fullscreen gets
                to float. Kept in the same relative position `Draggable`'s
                own dock button normally occupies (right after the
                full-screen toggle) so the header's button layout doesn't
                jump around across the transition. */}
            <Tooltip content="Undock" placement="bottom" asLabel>
              <ActionIconButton
                aria-label="Undock"
                size="sm"
                onClick={handleFullScreenToDragMode}
                className="text-lyra-fg-secondary hover:text-lyra-fg-secondary"
              >
                <Move className="h-3.5 w-3.5" strokeWidth={1.5} />
              </ActionIconButton>
            </Tooltip>
          </>
        }
        onClose={() => {
          setPanelFullScreen(false);
          setPanelOpen(false);
        }}
        // Same revert-to-default-`X` as the docked variant's own
        // `ContainerHeader` above — see that call site's own doc comment.
      />
      {activePanelContent.headerContent && (
        // See the docked variant's own matching wrapper (above) for why
        // "search" skips this wrapper entirely.
        (activePanelKey === "search" ? (
          activePanelContent.headerContent
        ) : (
          <div className="shrink-0 px-4 pb-3 border-b border-lyra-border-subtle">
            {activePanelContent.headerContent}
          </div>
        ))
      )}
      {/* Per explicit request ("... fade in when transitioning" — see the
          docked variant's own matching wrapper above for the full doc
          comment): `key={activePanelKey}` forces a remount on every app
          switch so `animate-in fade-in-0` replays each time. */}
      <div key={activePanelKey} className="flex flex-col flex-1 min-h-0 animate-in fade-in-0 duration-200">
        {activePanelContent.body}
      </div>
    </div>
  ) : null;

  // Home + Settings, and the New Outbound launcher: each renders in one of
  // two `LeftNav` slots, per Settings → Assignments ("Home and Settings at
  // the top" → `items`, else the `footer` rail; "New Outbound at the bottom"
  // → `footer`, else `pinnedHeader`).
  // Apps placed in the left nav (Settings → Header → "<App> display" /
  // "Agent chat display") sit between Home and Settings, as in v3. An app
  // opens as a page in the main column; Agent chat, a drawer, opens in the
  // shared panel its header icon would.
  const leftNavKeys = leftNavKeysFromHeader(headerSettings);
  const leftNavPageShown = leftNavPage && !activeInteraction && !showSettings && leftNavKeys.includes(leftNavPage) ? leftNavPage : null;
  const leftNavAppItems = leftNavKeys.map((key) => {
    const { label, icon: KeyIcon } = PANEL_KEY_METADATA[key];
    const isPage = key !== "conversations";
    return {
      icon: <KeyIcon className="h-4 w-4" strokeWidth={1.5} />,
      label,
      active: isPage ? leftNavPageShown === key : panelOpen && activePanelKey === key,
      onClick: isPage
        ? () => {
            setLeftNavPage(key as ExtraHeaderApp);
            setShowSettings(false);
            switchActiveInteraction(null);
          }
        : handlePanelButtonClick(key),
    };
  });
  const [homeNavItem, ...restNavItems] = buildNavItems(
    Boolean(activeInteraction),
    // Per explicit follow-up request, Home no longer resets
    // `showAllContacts`/`selectedAllContactsRecord` — see that state's own
    // doc comment for why "Home" now always resumes whatever was showing
    // there before the agent navigated away (plain dashboard or All
    // Contacts), instead of forcing back to the plain dashboard every time.
    () => { switchActiveInteraction(null); setShowSettings(false); setLeftNavPage(null); },
    showSettings,
    // Same follow-up — opening Settings no longer discards All Contacts' own
    // state either; it just takes visual priority while showing (this
    // ternary branch is checked first), and All Contacts reappears exactly
    // as left once Settings closes.
    () => { setShowSettings(true); setLeftNavPage(null); switchActiveInteraction(null); }
  );
  const navRailItems = [{ ...homeNavItem, active: homeNavItem.active && !leftNavPageShown }, ...leftNavAppItems, ...restNavItems];
  // The links inside an interaction's AI content (Autosummary links,
  // interstitial rows, approval checklists) open the matching side panel.
  // Shared by the inline transcript and the Contact Details panel's AI feed.
  // Every contact, every channel: the row/link whose slide-over is open
  // closes it (toggle); any other swaps the content. A Copilot result row
  // (`instruction:` key) opens the scripted case's instruction panel, or,
  // on a contact with no script, the generic Copilot result.
  const snapshotLinkHandlerFor = (interactionId: string): ((key: string) => void) => {
    const scripted = isColdCallId(interactionId) || scenarioKeyOf(interactionId) === LUCAS_THOMAS_ID;
    return (key) => {
      if (key === lucasActiveLinkKey) return setSelectedDetailPanelContent(null);
      if (key.startsWith("instruction:")) {
        const [, decision, text, time] = key.split(":");
        const request = { text: decodeURIComponent(text ?? ""), time: decodeURIComponent(time ?? "") };
        return openDetailPanelContent(scripted ? { kind: "lucas-instruction", decision, ...request, link: key } : { kind: "copilot-result", ...request, link: key });
      }
      if (isColdCallId(interactionId)) {
        if (key === "order" || key === "card" || key === "void-steps" || key === "maya-order" || key === "maya-card" || key === "maya-refund-steps") {
          openDetailPanelContent({ kind: "tom-call", panel: key });
        }
      } else if (scenarioKeyOf(interactionId) === MARCUS_WEBB_ID) {
        if (key === "order") openDetailPanelContent({ kind: "order", order: MARCUS_WEBB_ORDER });
      } else if (scenarioKeyOf(interactionId) === LUCAS_THOMAS_ID) {
        if (key.startsWith("memory:")) openExperienceMemoryInSidePanel(key.slice("memory:".length) as LucasThomasMemoryFocus);
        else openDetailPanelContent({ kind: "lucas", panel: key as LucasThomasPanelKey });
      }
    };
  };

  // Settings → AI display "In the Contact Details panel" (P-SETTINGS, ported
  // from v3): the Autosummary and the AI rows (interstitials, approval
  // requests, wrap-up cards, event lines) leave the transcript and render as
  // a feed at the bottom of the docked Contact Details panel, with the same
  // handlers the inline transcript uses.
  // The Autosummary card (one `AutosummaryCard` everywhere), when there's a
  // summary to show.
  const renderAutosummary = () =>
    activeInteraction && (activeInteractionIsRealCustomer || activePreContactSummary) && customerContextOverviewInfo ? (
      <AutosummaryCard
        cardKey={activeInteraction.id}
        customerName={activeInteraction.customerName ?? ""}
        snapshot={customerContextOverviewInfo.snapshot ?? []}
        onSnapshotLink={snapshotLinkHandlerFor(activeInteraction.id)}
      />
    ) : undefined;
  // The AI overview, the same in the AI feed (panel and "main") and at the top
  // of the inline main column: the Autosummary, then Marcus's card, whose
  // approval request is its own AI card like Lucas's (no Next Best Action slot).
  const renderAiOverview = () => {
    if (!activeInteraction) return undefined;
    const autosummary = renderAutosummary();
    const marcus = scenarioKeyOf(activeInteraction.id) === MARCUS_WEBB_ID && <HostSlot host={marcusCardHost} />;
    return autosummary || marcus ? (
      <>
        {autosummary}
        {marcus}
      </>
    ) : undefined;
  };
  // `overview` replaces the AI overview at the top of the feed: under AI
  // display "main" the canvas passes the action cells that precede the
  // conversation (P-CANVAS); panel mode keeps `renderAiOverview()`.
  const renderAiPanelFeed = (overview: ReactNode = renderAiOverview()) => {
    if (!activeInteraction) return null;
    const isLucas = scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID;
    return (
      <AiActionsFeed
        messages={Object.values(activeInteraction.liveMessages ?? {}).flat()}
        overview={overview}
        onApprovalDecision={isLucas ? handleLucasApprovalDecision : undefined}
        onApprovalCallRequest={isLucas && calling.elevation ? handleLucasCallRequest : undefined}
        onApprovalSuggestionAsk={isLucas ? (text: string) => handleCopilotAsk(activeInteraction.id, activeChannelKey, text) : undefined}
        approvalTakenOver={isLucas && !lucasThomasReviewing}
        onWrapUpComplete={isLucas ? () => scenarioCases.respond(LUCAS_THOMAS_ID, { value: "complete" }) : undefined}
        onSnapshotLink={snapshotLinkHandlerFor(activeInteraction.id)}
        activeSnapshotLink={lucasActiveLinkKey}
      />
    );
  };
  // Contact Details' Overview and Session tab, one render each: the docked
  // panel and its hover preview mount the same thing (the preview only also
  // closes itself when it hands off to the panel).
  // What the reference cards (Customer Info, Journey Summary, Artifacts) read,
  // wherever they mount: Contact Details' tabs, its hover preview, the canvas.
  const referenceCardPropsFor = (inPreview: boolean): ReferenceCardProps | undefined => {
    if (!activeInteraction) return undefined;
    const closePreview = () => {
      clearTimeout(customerInfoPreviewTimer.current);
      setCustomerInfoPreviewOpen(false);
    };
    return {
      artifacts: panelArtifacts,
      onOpenArtifact: (id: string) => {
        if (inPreview) closePreview();
        reopenPanelArtifact(id);
      },
      onViewAllArtifacts: () => setCustomerPanelActiveTab("Artifacts"),
      onViewExperienceMemory:
        scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID || scenarioKeyOf(activeInteraction.id) === MARCUS_WEBB_ID || isColdCallId(activeInteraction.id)
          ? () => openExperienceMemoryInSidePanel()
          : undefined,
      customerName: activeInteraction.customerName,
      customerContextOverview: customerContextOverviewInfo,
      showJourneySummary: true,
      journeySummaryUpdatedAtTick,
      onViewCustomerInfo: activeInteractionIsRealCustomer ? focusCustomerPanelTab : undefined,
      // The on-demand search/create-new overlay (`linkCustomerPanelOpen`); nothing to link once matched.
      onLinkCustomer: activeInteractionIsRealCustomer ? undefined : inPreview ? handleLinkCustomerFromPreview : () => setLinkCustomerPanelOpen(true),
    };
  };
  const referenceCardProps = referenceCardPropsFor(false);
  const renderContactDetailsTab = (tab: "Overview" | "Session", inPreview = false) => {
    if (!activeInteraction) return null;
    const { onViewCustomerInfo, onLinkCustomer, ...shared } = referenceCardPropsFor(inPreview)!;
    if (tab === "Session") {
      // AI display "panel": the Session tab also holds the Journey Summary and Artifacts.
      return aiInPanel ? (
        <>
          <DetailsPanelAccordions show={PANEL_SESSION_SECTIONS} {...shared} />
          {sessionDetailsTabContent.body}
        </>
      ) : (
        sessionDetailsTabContent.body
      );
    }
    const overview = (
      <DetailsPanelAccordions
        {...shared}
        show={aiInPanel ? PANEL_OVERVIEW_SECTIONS : undefined}
        aiFeed={aiInPanel && !aiWorkspaceMain ? renderAiPanelFeed() : undefined}
        aiFeedCount={aiFeedCount}
        followSignal={inPreview ? undefined : aiFollowSignal}
        onViewCustomerInfo={onViewCustomerInfo}
        onLinkCustomer={onLinkCustomer}
      />
    );
    // In the hover preview, `ContactDetailsTabBody` hands an action off to the docked panel (k5 G), for every tab.
    return overview;
  };
  // How many AI items the panel feed holds (the overview counts as one); a
  // change scrolls the panel to the newest when the agent is at the bottom.
  const aiFeedCount = activeInteraction
    ? Object.values(activeInteraction.liveMessages ?? {}).flat().filter(isAiActionMessage).length
    : 0;
  // "AI in panel": the docked Copilot composer shows only on the Details
  // overview (the AI feed): not on Session Details, Customer Info,
  // Experience Memory or Artifacts, not over a channel preview, and not
  // while a card link's sub-page is open.
  const copilotDockShown = aiInPanel && contactDetailsView === "Details" && !channelPreviewThread;
  // While a card link's slide-over is open over the Overview, the composer is
  // hidden but keeps its place (`invisible` + `inert`): unmounting it would
  // grow the body and move its scroll position behind the slide-over.
  const copilotDockConcealed = !!selectedDetailPanelContent;
  // One Copilot composer on screen: the main column ("main"), the docked
  // panel's footer, or the Contact Details hover preview's footer while it's
  // open (panel mode; the preview only opens while the panel isn't showing
  // Contact Details).
  const copilotSlot: "main" | "panel-footer" | "hover-footer" | null = aiWorkspaceMain
    ? "main"
    : aiInPanel
      ? customerInfoPreviewOpen && hoverDockMounted ? "hover-footer" : copilotDockShown ? "panel-footer" : null
      : null;
  copilotFollows.current = copilotSlot === "main" || copilotSlot === "panel-footer";
  // The composer always portals into the same host while docked; no slot holding it hides it without unmounting it.
  const copilotDock = aiWorkspaceMain || aiInPanel ? { mount: copilotHost } : undefined;
  // A thread outside the main column (the panel, the header icon's hover
  // preview) is the thread view only: its transcript with the Autosummary
  // (AI display inline; elsewhere the AI feed holds it) and its composer.
  // Customer Info, the Next Best Action text and the rest of Contact Details
  // belong to the Contact Details preview alone.
  const threadOverview = !aiInPanel && !panelPlacement ? renderAutosummary() : undefined;
  // "AI in panel": Overview holds Customer Info (plus the AI feed: the
  // Autosummary, approvals, Next Best Action); the Session tab holds the
  // Journey Summary and Artifacts. Inline mode shows everything on Overview.
  const PANEL_OVERVIEW_SECTIONS = { customerInfo: true, journeySummary: false, artifacts: false };
  const PANEL_SESSION_SECTIONS = { customerInfo: false, journeySummary: true, artifacts: true };
  // "AI in panel": the Contact Details panel opens on Details whenever an
  // interaction becomes active. Declared after the interaction-switch panel
  // save/restore effects so it wins (v3).
  useEffect(() => {
    if (aiInPanel && activeInteractionId) {
      setCustomerPanelActiveTab("Details");
      setSidePanelOpen(true);
    }
  }, [aiInPanel, activeInteractionId]);

  /* The shared New Outbound launcher (P0.5b.2). Its tabs follow Settings →
     New Outbound (Phase 1: the Dial Pad only, no group picker). It stays
     enabled during a call; a second call holds the first (row 15, revised
     2026-10-14). `handleDialpadSubmit` tells a completed redial apart from
     an ordinary dial. */
  const newOutboundLauncher = (
    <NewOutboundLauncher
      outboundConfig={outboundConfig}
      tabs={outboundSettings.launcher}
      adHoc={calling.adHoc}
      addressBooks={ADDRESS_BOOKS}
      expanded={navOpen}
      onStartCall={handleStartCall}
      onQuickDial={handleDialpadSubmit}
      dialpadRequest={outboundDial.dialpadRequest}
      onDialpadRequestHandled={outboundDial.clearDialpadRequest}
    />
  );

  return {
    ...prev,
    searchContent, contentByPanelKey, activePanelContent, isCombinedPanelMode, mainRegionTabLabel,
    handlePanelButtonClick, handleOpenAllContacts, PANEL_BUTTON_SELECTED_CLASS, PANEL_KEY_METADATA,
    PANEL_KEY_INITIAL_ORDER, panelOrder, panelDragOverKey, panelDragHandlers, HIDDEN_FROM_APPS_MENU, appsMenuItems,
    pinnedKeysInHeaderOrder, appHeaderRef, appNameMeasureRef, headerIconsMeasureRef, autoHiddenCount,
    setAutoHiddenCount, responsivelyHiddenKeys, showHeaderIcon, leftNavRenderWidth, maxDockedWidthForMainFloor,
    sharedPanel, sharedPanelFullScreenOverlay, leftNavKeys, leftNavPageShown, leftNavAppItems, homeNavItem,
    restNavItems, navRailItems, snapshotLinkHandlerFor, renderAutosummary, renderAiOverview, renderAiPanelFeed, referenceCardProps,
    renderContactDetailsTab, aiFeedCount, copilotDockShown, copilotDockConcealed, copilotSlot, copilotDock,
    threadOverview, PANEL_OVERVIEW_SECTIONS, PANEL_SESSION_SECTIONS, newOutboundLauncher,
  };
}

export type WsHeaderApps = ReturnType<typeof useWsHeaderApps>;
