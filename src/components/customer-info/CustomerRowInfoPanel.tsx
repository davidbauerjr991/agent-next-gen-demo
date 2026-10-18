import { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import {
  Button,
  TabList,
  Tab,
  ActionIconButton,
  type CreateNewOutboundContact,
  type ChannelType,
  type MenuEntry,
  KebabMenuButton,
  type ToastItem,
  InteriorPanel,
} from "@nicecxone/lyra-ui";
import { ChevronLeft, ChevronRight, SquareArrowOutUpRight, RefreshCw, Trash2, MoreVertical } from "lucide-react";
import { type CustomerListRecord } from "@/components/agent-next-gen-customers-table";
import {
  CUSTOMER_PANEL_TABS,
  buildCustomerInfoFields,
  buildLatestInteraction,
  buildLatestNote,
  buildCopilotSummary,
  type CustomerPanelTabLabel,
} from "./customer-info-seed";
import { CustomerRecordSaveFooter, useCustomerRecordDraft } from "./CustomerDetailTabs";
import { CustomerInformationPanelBody } from "./CustomerInformationPanelBody";

/* ── CustomerRowInfoPanel ──
   Right-docked `InteriorPanel` opened by clicking a row in the Customers
   list view (`CustomersListView`'s `onRowClick`) — reuses the exact same
   "Customer Information" content (`CustomerInformationPanelBody`, and the
   `buildCustomerInfoFields`/`buildLatestInteraction`/`buildLatestNote`
   helpers that feed it) `CustomerInformationSidePanel` already shows for an
   active interaction, rather than a second hand-built copy of that same
   Overview/Detail/Directory content. Two real differences from that
   component, both per explicit request: docked RIGHT via `InteriorPanel`
   (that one is left-docked via `SidePanel`, for an unrelated reason — see
   its own doc comment), and no `AIInput` at all — this panel is read-only
   reference info about whichever customer row was clicked, not the seat
   of an active conversation to ask the AI assistant about. It DOES now
   get its own `footer`, though (per a later explicit request): the same
   Save/Cancel footer `CustomerInformationSidePanel` shows for pending
   Detail/Directory edits — see `useCustomerRecordDraft`'s own doc
   comment. "Read-only reference info" described the panel's own identity
   fields (never editable, no AI assistant), not the Detail/Directory
   forms nested inside it, which were always editable here too.

   `channels: []` passed to `buildCustomerInfoFields` below — that param
   only exists so a real *active* interaction's actually-open voice/email
   channel can override the synthesized phone/email fallback (see that
   function's own doc comment); a Customers-table row was never opened as
   an interaction, so there's no such channel to prefer over the
   synthesized one. */
export function CustomerRowInfoPanel({
  row,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  onStartInteraction,
  tabs,
  onAddToast,
  onOpenFullScreenTab,
  hideFullScreenToggle,
  hidePrevNext,
}: {
  /** The clicked customer row, or `null` when the panel is closed. Kept as
   *  the single source of both "is it open" (`open={row !== null}`) and
   *  "whose info to show" — same pattern the Dashboard's own queue
   *  drill-down `InteriorPanel` already uses (`selectedQueueId`) a bit
   *  further down this file. */
  row: CustomerListRecord | null;
  onClose: () => void;
  /** Step to the previous/next customer in `AgentNextGenPage`'s
   *  `customerSortedRows` — the exact same filtered+sorted order the table
   *  itself is currently showing (see that state's own doc comment) — not
   *  a separate, potentially-different order this panel would otherwise
   *  have to recompute on its own. */
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
  /** Which tabs this panel supports at all, in order — same `tabs` concept
   *  `CustomerInformationSidePanel` takes (see that prop's own doc
   *  comment); Agent Workspace 2.0 passes its own reduced
   *  `AGENT_WORKSPACE_CUSTOMER_PANEL_TABS`, Agent Workspace 2.0 With Desk
   *  passes the full `CUSTOMER_PANEL_TABS`. Unlike that component, though,
   *  "Copilot" is ALWAYS stripped out here regardless of what's passed
   *  (see `visibleTabs` below) — per explicit request, a Customers-table
   *  row is read-only reference info about a customer, never the seat of
   *  an actual conversation, so Copilot never has anything to summarize
   *  here and should never be offered as an option, unlike
   *  `CustomerInformationSidePanel`'s own merely-conditional gating. */
  tabs: readonly CustomerPanelTabLabel[];
  /** Fires a toast into the shared stack the caller owns — same prop/
   *  reasoning as `CustomerInformationSidePanel`'s own `onAddToast` (see
   *  that prop's doc comment); fired on a successful Customer Overview
   *  save below. */
  onAddToast?: (toast: Omit<ToastItem, "id">) => void;
  /**
   * Per explicit request ("in agent workspace 2.0 premium, when an agent
   * clicks the Full Screen [button], instead of toggling to a full screen
   * mode, open a new tab..."): when set, this panel's Full Screen button
   * fires this callback with the currently-open `row` instead of expanding
   * `InteriorPanel`'s own built-in `isFullScreen` overlay — the caller is
   * expected to open/activate a `CustomerFullScreenTabContent` tab
   * elsewhere (see that component's own doc comment) rather than this
   * panel growing in place. Omitted (the default) preserves the original
   * real-fullscreen-toggle behavior verbatim — scoped to whichever
   * consumer explicitly opts in (Agent Workspace 2.0 Premium only, per the
   * request's own wording) rather than changing this panel's default
   * behavior for every tier. */
  onOpenFullScreenTab?: (row: CustomerListRecord) => void;
  /**
   * Per explicit request ("remove the pop out icon to make it a tab") —
   * suppresses `InteriorPanel`'s own built-in full-screen toggle
   * entirely, on top of `onOpenFullScreenTab`'s existing suppression (see
   * that prop's own doc comment): where `onOpenFullScreenTab` swaps the
   * built-in toggle for a custom "Open Tab" button, this instead renders
   * NEITHER — no expand/pop-out affordance of any kind, just a plain
   * docked panel (prev/next/Add Channel/kebab/close). Built for Agent
   * Workspace Advanced's own Search panel Customers sub-tab (see that
   * call site, agent-next-gen-search-panel.tsx) — that tier has no
   * customer full-screen tabs to open (`onOpenFullScreenTab` is Premium-
   * only) and no in-place full-screen mode wanted either, so this row's
   * detail panel should just stay a fixed, right-docked panel. Default
   * `false` — every other existing consumer keeps its current
   * `allowFullScreen={!onOpenFullScreenTab}` behavior unchanged.
   */
  hideFullScreenToggle?: boolean;
  /**
   * Per explicit request ("hide the next/prev in the customer info cards
   * for advanced and premium in the customer table view") — hides the
   * Previous/Next customer chevron buttons in the header actions row
   * below. Originally scoped to just the desk-tab Customers table's own
   * `CustomerRowInfoPanel` call sites in `AgentWorkspace2WithDeskPage.tsx`
   * (Premium) and `AgentWorkspaceAdvancedPage.tsx` (Advanced); per an
   * immediate follow-up ("they are still there in advanced"), also passed
   * from the Search panel's own Customers sub-tab call site (Advanced
   * only, agent-next-gen-search-panel.tsx) — so in practice every
   * `CustomerRowInfoPanel` instance in Advanced now hides prev/next, and
   * Premium's one desk-tab instance does too (Premium's Search panel has
   * no Customers tab at all). Default `false` — every other existing
   * consumer keeps showing prev/next unchanged.
   */
  hidePrevNext?: boolean;
}) {
  const [activeTab, setActiveTab] = useState(() => CUSTOMER_PANEL_TABS.indexOf("Overview"));
  // Hard filter, not conditional like `CustomerInformationSidePanel`'s own
  // `copilotAvailable` gate — see `tabs`'s own doc comment above for why
  // Copilot is unconditionally excluded here no matter what's passed in.
  const visibleTabs = tabs.filter((t) => t !== "Copilot");

  // `InteriorPanel` forwards its own outer wrapper's ref (see interior-
  // panel.tsx — `ref={stableOuterRef}`, whose element's own inline `width`
  // style IS the panel's true current rendered width: 0 while closed,
  // otherwise its resized/default docked width — capped at `maxWidth`
  // (425 here, the default) — or "100%" of the main container while full-
  // screen). Observed here (rather than re-deriving `isFullScreen`/
  // `currentWidth`, both internal/uncontrolled state this component has no
  // access to) so the header's Add Channel/Refresh/Delete actions know
  // whether there's room to stay inline or need to collapse into a kebab —
  // same "measure the real box, don't guess" approach `TableToolbar` uses
  // for its own action-button collapse (table.tsx's `isWide`).
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState(9999);
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    setPanelWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setPanelWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 480px sits comfortably above `InteriorPanel`'s own 425px `maxWidth` (the
  // widest this panel can ever reach while normally docked/resized) and
  // comfortably below any realistic full-screen width (the main content
  // column, easily 800px+) — so this reliably reads "docked" as narrow and
  // "full screen" as wide, with no in-between flapping.
  const isNarrowActions = panelWidth < 480;

  // Back to the Overview tab every time a *different* row is opened — same
  // reasoning `CustomerChannelPopoverButton`'s own reset effects use
  // elsewhere in this file: reopening this panel on the previous row's
  // last-viewed tab would be a mildly confusing default. `row?.contactNumber`
  // (not `row` itself, a fresh object reference every render) is what this
  // actually keys off, so this doesn't also fire on every unrelated re-render
  // while the same row's panel is already open. `CUSTOMER_PANEL_TABS.
  // indexOf("Overview")`, not a hardcoded `0` — confirmed live as a real
  // bug once "Copilot" moved to global index 0 (§73's reorder): this
  // effect kept resetting straight onto Copilot's content on every row
  // open even though `visibleTabs` above always strips "Copilot" from the
  // tab row entirely for this read-only, non-conversational panel — no
  // tab button ever looked selected, but Copilot's info box/Journey
  // Summary rendered anyway.
  useEffect(() => {
    if (row) setActiveTab(CUSTOMER_PANEL_TABS.indexOf("Overview"));
  }, [row?.contactNumber]);

  const customerName = row ? `${row.firstName} ${row.lastName}` : undefined;
  const recordId = row?.contactNumber ?? "";
  const fields = useMemo(() => buildCustomerInfoFields(customerName, recordId, []), [customerName, recordId]);
  const latestInteraction = useMemo(() => buildLatestInteraction(customerName, recordId), [customerName, recordId]);
  const latestNote = useMemo(() => buildLatestNote(customerName, recordId), [customerName, recordId]);
  const copilotSummary = useMemo(() => buildCopilotSummary(customerName, recordId), [customerName, recordId]);
  // Own instance of the Detail/Directory draft — see `useCustomerRecordDraft`'s
  // own doc comment. `isDirty`/`save`/`cancel` drive the Save/Cancel footer
  // rendered in this panel's own `footer` slot below.
  const recordDraft = useCustomerRecordDraft(fields, customerName, recordId);
  // Whether the Overview tab's field list is showing real inputs — owned
  // here for the same reason `CustomerInformationSidePanel` owns its own
  // copy (see that component's own doc comment on its own `overviewEditing`):
  // this panel's `footer` below needs to know about it too, so the
  // Save/Cancel footer can appear the instant the edit button is clicked,
  // not only once a field has actually changed. Reset alongside `activeTab`
  // (same `row?.contactNumber` keying, own effect right below) — unlike
  // `CustomerInformationSidePanel`, this component does NOT remount on a
  // different row (prev/next chevrons reuse the same instance), so this
  // reset is load-bearing here, not just a defensive belt-and-suspenders.
  const [overviewEditing, setOverviewEditing] = useState(false);
  useEffect(() => {
    if (row) setOverviewEditing(false);
  }, [row?.contactNumber]);

  // Refresh/Delete — no `onClick` (no-op stubs), matching this exact
  // prototype's existing precedent for these two actions: the Customers
  // table's own toolbar `actionDefs` ("Refresh"/"Delete", a few hundred
  // lines up in `CustomersListView`) are the same bare label+icon with no
  // handler wired up yet.
  const recordActionItems: MenuEntry[] = [
    { id: "refresh", label: "Refresh Record", icon: <RefreshCw className="h-4 w-4" strokeWidth={1.5} />, disabled: !row },
    { id: "delete", label: "Delete Record", icon: <Trash2 className="h-4 w-4" strokeWidth={1.5} />, disabled: !row, destructive: true },
  ];

  return (
    <InteriorPanel
      ref={panelRef}
      side="right"
      open={row !== null}
      onClose={onClose}
      // Per a LATER explicit follow-up request ("update the toggle close
      // icon for interior panels to be an 'x' icon") — reverts the
      // `PanelRightClose` swap an earlier request (quoted above this
      // comment's own history) made here, back to `InteriorPanel`'s/
      // `ContainerHeader`'s own plain `X` default (simply omitting
      // `closeIcon` now gets that default). `CustomerFullScreenTabContent`
      // (Premium's "open as a desk tab" variant) was never touched by
      // either request either way — its own hand-rolled close button
      // already reads as a plain `X`.
      // Per explicit request ("make the customer info panel z-index
      // higher than the z-index of the launch channel buttons in the
      // rows of the customer tables for both premium and advanced") —
      // `InteriorPanel`'s own built-in outer wrapper is `z-[5]` by
      // default (interior-panel.tsx), which sat BELOW the Customers
      // table row's own hover-reveal launch-channel buttons (Call/Email/
      // WhatsApp — `agent-next-gen-customers-table.tsx`'s `z-10`
      // leading-channel-stack overlay), so that overlay visibly bled on
      // top of this panel once docked open (see the attached screenshot).
      // `className` here is merged via `cn`/`tailwind-merge`, which
      // resolves same-property Tailwind class conflicts by keeping the
      // last one — `z-20` cleanly overrides the built-in `z-[5]` without
      // needing to touch `InteriorPanel` itself, and comfortably clears
      // the row overlay's `z-10` in every tier this panel renders in
      // (both desk-tab Customers tables, Premium and Advanced, plus
      // Advanced's Search panel Customers sub-tab instance).
      className="z-20"
      // Lets the agent manually expand to full screen via `InteriorPanel`'s
      // own built-in toggle button (rendered next to the close button in
      // its header, self-contained `isFullScreen` state — see interior-
      // panel.tsx's own doc comment on `allowFullScreen`) — per explicit
      // request: opens as a normal docked flyout by default, with full
      // screen as an option, not the default.
      //
      // Per a later explicit follow-up request (Agent Workspace 2.0
      // Premium only — see `onOpenFullScreenTab`'s own doc comment), that
      // built-in toggle is suppressed here whenever a caller opts into tab
      // mode — a custom Full Screen button rendered in `headerActions`
      // below takes over instead, since `InteriorPanel`'s own toggle has no
      // way to be told "call this instead of touching your own internal
      // state."
      //
      // Per a further explicit follow-up (see `hideFullScreenToggle`'s own
      // doc comment), that suppression now also covers callers who want NO
      // full-screen affordance at all rather than a swapped-in tab button —
      // `hideFullScreenToggle` short-circuits this to `false` regardless of
      // `onOpenFullScreenTab`.
      allowFullScreen={!onOpenFullScreenTab && !hideFullScreenToggle}
      headerTitle={customerName ?? "Customer"}
      headerSubhead={recordId}
      // Sequential prev/next through the same filtered+sorted order the
      // Customers table itself is showing (`customerSortedRows`, lifted to
      // `AgentNextGenPage` — see that state's own doc comment). Plain
      // `ActionIconButton`s, not `PanelPinButton`: these are momentary
      // one-shot actions with no on/off state to reflect, unlike the
      // pin/full-screen/close buttons elsewhere that reuse `PanelPinButton`.
      // Rendered via `headerActions` so they appear BEFORE `InteriorPanel`'s
      // own automatic full-screen-toggle/close buttons (its `actions={<>
      // {headerActions}{fullScreenToggle}</>}` composition order). Ordered
      // AFTER Refresh/Delete (the "trash icon") rather than leading the
      // cluster, per explicit request.
      headerActions={
        <>
          {/* Add Channel moved out of this header entirely — per explicit
              follow-up request ("move the contact icon buttons into the
              customer overview and put them next to the edit button in a
              row above the other information"), it now lives inside the
              Customer Overview accordion's own top row instead (see
              `CustomerInformationPanelBody`'s `row`/`onStartInteraction`
              props, wired below at this panel's own body call site). This
              header keeps only Refresh/Delete/prev/next/kebab/Open-Tab —
              the momentary record-level actions that were never Add
              Channel's own narrow/wide-mode concern to begin with. */}
          {isNarrowActions ? (
            // `KebabMenuButton`'s own default trigger is a fixed h-6 w-6
            // (24px) — visibly smaller than every other icon button in
            // this row (Add Channel/prev/next/the built-in fullscreen-
            // toggle+close, all 32px+). `className` bumps it up to h-8 w-8
            // (32px, matching prev/next's own `icon-md` and the built-in
            // toggle/close buttons) and the glyph up to the same h-4 w-4
            // every neighboring icon here uses, per explicit request.
            <KebabMenuButton
              items={recordActionItems}
              ariaLabel="Record actions"
              className="h-8 w-8"
              icon={<MoreVertical className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
            />
          ) : (
            <>
              <ActionIconButton title="Refresh record" disabled={!row}>
                <RefreshCw className="h-4 w-4" />
              </ActionIconButton>
              <ActionIconButton title="Delete record" disabled={!row}>
                <Trash2 className="h-4 w-4" />
              </ActionIconButton>
            </>
          )}
          {/* Back in this same header-actions row regardless of width (per
              explicit follow-up request reverting the earlier "own row
              below the title" layout) — `Button variant="ghost"` (was
              `variant="outline"`, reverted per later explicit request) so
              these read as plain quick actions alongside Refresh/Delete/
              Add Channel's own `ActionIconButton`s rather than standing out
              as bordered controls. `size="icon-md"` (32px, one step below
              `ActionIconButton`'s own default "icon-lg"/36px — see
              `ACTION_ICON_BUTTON_SIZE_MAP` in actions.tsx) per earlier
              explicit request to size these down a notch from the rest of
              the cluster — kept as-is, that sizing request is independent
              of the outline→ghost variant change. */}
          {!hidePrevNext && (
            <>
              <Button variant="ghost" size="icon-md" title="Previous customer" disabled={!hasPrevious} onClick={onPrevious}>
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon-md" title="Next customer" disabled={!hasNext} onClick={onNext}>
                <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </Button>
            </>
          )}
          {/* Stand-in for `InteriorPanel`'s own built-in fullScreenToggle
              (suppressed above via `allowFullScreen={!onOpenFullScreenTab}`)
              — same size/tooltip-placement/position (right after prev/next,
              immediately before the panel's own close button) so swapping
              which behavior this fires is visually seamless, but its own
              icon/label per later explicit follow-up request: `Maximize2`
              (this button never toggles an "exit" state of its own the way
              a real fullscreen button would — clicking it hands off to a
              desk tab instead of changing anything about THIS panel, so
              that icon read as misleading) → `SquareArrowOutUpRight`, the
              conventional "open in new tab/window" glyph, matching what
              this button actually does now. Title "Open Tab" (was "Full
              Screen") to match. */}
          {onOpenFullScreenTab && row && (
            <Button
              variant="ghost"
              size="icon-md"
              title="Open Tab"
              onClick={() => onOpenFullScreenTab(row)}
            >
              <SquareArrowOutUpRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </Button>
          )}
        </>
      }
      headerTabs={
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
      }
      // Save/Cancel footer for pending Detail/Directory edits — per a later
      // explicit request, this panel now gets one too (see this component's
      // own top-of-file doc comment for why that doesn't contradict its
      // original "read-only" framing). Stays open regardless of which tab
      // is active, same as `CustomerInformationSidePanel`'s own version —
      // an edit made on Detail shouldn't quietly vanish from view just
      // because the agent clicked over to Notes before saving it.
      footer={
        recordDraft.isDirty || overviewEditing ? (
          <CustomerRecordSaveFooter
            onSave={() => {
              recordDraft.save();
              setOverviewEditing(false);
              onAddToast?.({
                variant: "success",
                title: "Success",
                message: row ? `${row.firstName} ${row.lastName} customer record saved` : "Customer record saved",
                duration: 4000,
              });
            }}
            onCancel={() => {
              recordDraft.cancel();
              setOverviewEditing(false);
            }}
          />
        ) : undefined
      }
    >
      <CustomerInformationPanelBody
        activeTab={activeTab}
        customerName={customerName}
        latestInteraction={latestInteraction}
        latestNote={latestNote}
        copilotSummary={copilotSummary}
        // `recordId`/`channels` — per explicit follow-up request, the
        // Contacts tab now shows real (synthesized) history here too,
        // instead of rendering nothing (see `CustomerInformationPanelBody`'s
        // own `recordId`/`channels` doc comments, which this call site's
        // omission of both used to match — that reasoning is now out of
        // date and updated there too). `channels: []` for the same reason
        // `buildCustomerInfoFields` above already gets it: this row was
        // never opened as a real interaction, so there's no actually-open
        // `Thread[]` to prefer over the synthesized history —
        // `buildCustomerHistoryEntries` (the function this data actually
        // feeds) already treats a missing/empty `channels` as "use the
        // synthesized fallback for everything," which is exactly right
        // here.
        recordId={recordId}
        channels={[]}
        // Conditional per explicit request: this consumer's `tabs` prop
        // may or may not include "Contacts" (Agent Workspace 2.0 hides
        // it here entirely) — jumping to a hidden tab's index would leave
        // no tab visually active while its content still rendered, same
        // reasoning `CustomerInformationSidePanel`/`CustomerInfoHoverPreview`
        // already apply to their own `onViewAllInteractions`.
        onViewAllInteractions={
          visibleTabs.includes("Contacts")
            ? () => setActiveTab(CUSTOMER_PANEL_TABS.indexOf("Contacts"))
            : undefined
        }
        draft={recordDraft.draft}
        onDraftChange={recordDraft.updateDraft}
        onPhoneChange={recordDraft.updatePhone}
        onOverviewFieldChange={recordDraft.updateOverviewField}
        overviewEditing={overviewEditing}
        onOverviewEditingChange={setOverviewEditing}
        // Per explicit request — this is the other real panel, so it also
        // offers the Customer Overview edit button.
        allowOverviewEdit
        // Feeds the Customer Overview accordion's own new top row of
        // channel-launch buttons — see `CustomerInformationPanelBody`'s
        // `row`/`onStartInteraction` doc comments. Was rendered in this
        // panel's OWN header via `CustomerAddChannelButton` before (see
        // `headerActions` above); moved here per explicit follow-up
        // request. Always the "wide" one-button-per-channel shape now
        // (not `isNarrowActions`-dependent like the old header placement
        // was) — the Customer Overview card has its own fixed width
        // regardless of whether this panel itself is docked or full
        // screen, so there's no narrow/wide distinction left to make.
        row={row}
        onStartInteraction={onStartInteraction}
      />
    </InteriorPanel>
  );
}
