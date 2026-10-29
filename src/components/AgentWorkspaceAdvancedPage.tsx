// AgentWorkspaceAdvancedPage — the agent workspace (#/agent-advanced). Its
// title is the white-label app name (Settings → Appearance, P-AIFIRST); its
// layout varies by settings and workspace profiles only (P0.5d.2 deleted
// Desk, the "Phase 2" page this file was once duplicated alongside).
//
// P-EXTRACT C8: the page is the layout shell. Its state and handlers are the
// workspace controller (`useWorkspaceController`, src/contact-handling/
// workspace/controller/), and its regions are components in
// src/components/workspace/ that read the controller through `useWorkspace()`.
import { cn } from "@/lib/utils";
import { ActionIconButton, Container, ContainerHeader, ToggleGroup, Tooltip } from "@nicecxone/lyra-ui";
import { Move } from "lucide-react";
import { SaveAddressLinkContext } from "@/contact-handling";
import { WorkspaceContext } from "@/contact-handling/workspace/WorkspaceContext";
import { useWorkspaceController } from "@/contact-handling/workspace/controller/useWorkspaceController";
import type { WorkspacePageProps } from "@/contact-handling/workspace/controller/workspace-late";
import { PageClockContext } from "@/components/agent-next-gen-page-clock";
import { QueueSimContext } from "@/components/agent-next-gen-queue-sim";
import { AppTabBody, CustomersPage, LeftNavAppPage } from "@/components/home-tabs";
import { SettingsView } from "@/components/settings/SettingsView";
import { WorkspaceAppHeader } from "@/components/workspace/WorkspaceAppHeader";
import { WorkspaceLeftNav } from "@/components/workspace/WorkspaceLeftNav";
import { AllContactsView } from "@/components/workspace/AllContactsView";
import { RecordHeader } from "@/components/workspace/RecordHeader";
import { InteractionBody } from "@/components/workspace/InteractionBody";
import { WorkspaceHome } from "@/components/workspace/WorkspaceHome";
import { WorkspaceRightPanel } from "@/components/workspace/WorkspaceRightPanel";
import { AssignmentsPanelRow } from "@/components/workspace/AssignmentsInteriorPanel";
import { DetailSlideOver } from "@/components/workspace/DetailSlideOver";
import { WorkspaceVoiceBar } from "@/components/workspace/WorkspaceVoiceBar";
import { WorkspaceModals } from "@/components/workspace/WorkspaceModals";

export function AgentWorkspaceAdvancedPage({
  showPageHeader = false,
  showPanelToggle = false,
  showInteriorPanel = true,
  onNavigate,
  initialInteraction,
  sidePanelToggleLabel,
}: WorkspacePageProps) {
  const workspace = useWorkspaceController({
    showPageHeader,
    showPanelToggle,
    showInteriorPanel,
    onNavigate,
    initialInteraction,
    sidePanelToggleLabel,
  });
  const {
    PANEL_KEY_METADATA, activeInteraction, activePanelContent, activePanelKey, addToast, bodyContainerRef, clock,
    containerRef, contentByPanelKey, customerTable, customersPageTabs, getPanelFloatStyle,
    handleLinkCustomerFromPreview, handlePanelVariantChange, handleStartCall, interactions, isCombinedPanelMode,
    leftNavPageShown, mainRegionTabLabel, maxDockedWidthForMainFloor, narrowActiveRegion, panelFullScreen,
    panelIsResizing, panelMounted, panelState, panelVariant, panelWidth, queueSim, setNarrowActiveRegion,
    setPanelOpen, sharedPanel, sharedPanelFullScreenOverlay, showAllContacts, showSettings,
  } = workspace;
  return (
    <WorkspaceContext.Provider value={workspace}>
    <PageClockContext.Provider value={clock}>
    <QueueSimContext.Provider value={queueSim}>
    {/* A save-address offer on a card that isn't a known customer also opens the Link flow (Bug 3). */}
    <SaveAddressLinkContext.Provider value={handleLinkCustomerFromPreview}>
    <div className="flex flex-col h-screen bg-lyra-bg-surface-shell overflow-hidden animate-in fade-in-0 duration-500">
      {/* ── App Header ── */}
      <WorkspaceAppHeader />

      {/* ── Body: LeftNav + Content ── */}
      {/* overflow-hidden ensures docked panels never push layout past the viewport.
          ref measured by `bodyContainerRef` (see its own doc comment) — this
          row's own width drives `isNavNarrow`'s container query. */}
      <div ref={bodyContainerRef} className="flex flex-1 min-h-0 overflow-hidden">
        <WorkspaceLeftNav />
        {/* The interior-panel slot (P-HOME-1n): the assignments panel between the left nav and the content. */}
        <AssignmentsPanelRow>

        {/* Content area — flex-1 shrinks to give space to docked panels,
            down to `INTERACTION_MAIN_CONTENT_MIN_WIDTH` (350px) — below
            that, the docked shared panel's own render width clamps down
            instead (see `dockedPanelRenderWidth`'s own doc comment,
            further down) so THIS floor never has to fight it for space and
            push the whole row past the viewport. ref used to position
            float panels.

            `flex-col` (was a plain `flex` row — `Container` used to be its
            only normal-flow child, so row-vs-column made no visible
            difference) — per later explicit follow-up request ("move the
            call controls below the main container..."), the persistent
            voice call-controls bar now renders as `Container`'s own
            sibling right below it (see that render site's own doc comment
            further down), so this box needs to actually stack them
            vertically now instead of sitting them side by side. The
            floated/full-screen shared-panel overlays further down are
            `position: fixed`/`absolute` either way — out of normal flow,
            so this direction change doesn't move either of them. */}
        <div ref={containerRef} className="relative flex flex-col flex-1 min-w-[374px] overflow-hidden pr-3 pb-3">

          {/* Main Container — flex column so `isCombinedPanelMode`'s tab row
              can stack above the content instead of sitting beside it. The
              Customer Information `SidePanel` docks left of that entire
              column (tab row included) via the nested flex-row wrapper just
              inside — same "panel beside column" shape as
              `AgentNextGenTemplate.stories.tsx`'s reference layout, just
              with `isCombinedPanelMode`'s own stacking preserved unchanged
              one level in. */}
          <Container className="flex flex-col flex-1 overflow-hidden relative" data-slot="content-card">

            {/* Row: the content column + the docked right panel. Not flattened into Container:
                `isCombinedPanelMode`'s tab row stays outside the panels' reach. */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

                {/* Below 768px with a docked panel open: a second region
                    (`PANEL_KEY_METADATA[activePanelKey].label`, e.g. "Notifications") sits
                    alongside this main region, and this whole container
                    becomes the shared surface both toggle inside of instead
                    of the panel docking beside it. Per explicit follow-up
                    request ("use toggle buttons instead of tabs for the
                    combined panels"): switched from the `TabList`/`Tab`
                    composition (still used everywhere else in this file,
                    e.g. the Dashboard's own tab row below) to `ToggleGroup`
                    — a two-item single-select segmented control reads more
                    like "which surface is showing" (a view switch) than
                    "which sub-page am I on" (what tabs usually mean), and
                    it visually sets this switch apart from the record
                    header's OWN channel `TabList` that can render directly
                    underneath it once `narrowActiveRegion === "main"`
                    lands on an active interaction — two adjacent real tab
                    rows would have read as one continuous 3+-tab strip. */}
                {isCombinedPanelMode && (
                  <div className="bg-lyra-bg-surface-base p-2 shrink-0 border-b border-lyra-border-subtle">
                    <ToggleGroup
                      fullWidth
                      items={[
                        { value: "main", label: mainRegionTabLabel },
                        { value: "panel", label: activePanelKey ? PANEL_KEY_METADATA[activePanelKey].label : "" },
                      ]}
                      value={narrowActiveRegion}
                      // `ToggleGroup`'s single-select mode deselects on
                      // re-click of the already-active item (empty string)
                      // — this switch should always have exactly one side
                      // active, so an empty next value is ignored rather
                      // than passed through (same guard lyra-ui schedule-panel's
                      // own Day/Week `ToggleGroup` already uses).
                      onValueChange={(next) => {
                        if (next === "main" || next === "panel") setNarrowActiveRegion(next);
                      }}
                    />
                  </div>
                )}

                {/* Content column: PageHeader + page body */}
                <div
                  className={cn(
                    "flex flex-1 flex-col min-w-0 overflow-hidden",
                    isCombinedPanelMode && narrowActiveRegion !== "main" && "hidden"
                  )}
                >
              {showSettings ? (
                // ── Settings (P-SETTINGS: `SettingsView`, reading and
                // writing the settings store). Takes priority over both Desk and an active
                // interaction — see the `showSettings` state's own doc
                // comment for how the three views stay mutually exclusive.
                // `key="settings"` (here and on the other two branches
                // below) forces a fresh mount every time the agent switches
                // between Settings/an interaction/the Desk dashboard, which
                // is what makes `animate-in fade-in-0` actually replay on
                // every switch — without a distinct key, React just patches
                // the existing tree in place (same position, same type where
                // it happens to coincide) and the "enter" animation only
                // fires once, on this whole page's very first mount. Plain
                // `div` instead of the bare `<>...</>` these three branches
                // used to be — a Fragment contributes no box of its own for
                // an animation/opacity class to apply to; classes here match
                // the parent "Content column" div's own
                // `flex flex-1 flex-col min-w-0 overflow-hidden` exactly, so
                // this extra nesting level is layout-inert.
                <div key="settings" className="flex flex-1 flex-col min-w-0 overflow-hidden animate-in fade-in-0 duration-200">
                  <SettingsView showPageHeader={showPageHeader} />
                </div>
              ) : leftNavPageShown ? (
                // An app placed in the left nav, as a page.
                <LeftNavAppPage key={`app-${leftNavPageShown}`} title={PANEL_KEY_METADATA[leftNavPageShown].label} showHeader={showPageHeader}>
                  {leftNavPageShown === "customers" ? (
                    <CustomersPage
                      tabs={customersPageTabs}
                      table={customerTable}
                      onStartInteraction={(contact, channel, phone, skillId) => handleStartCall({ contact, channel, phone, skillId })}
                      onAddToast={addToast}
                      isRowOpen={(row) => interactions.some((i) => i.customerId === row.contactNumber)}
                    />
                  ) : (
                    <AppTabBody content={contentByPanelKey[leftNavPageShown]} />
                  )}
                </LeftNavAppPage>
              ) : showAllContacts && !activeInteraction ? (
                // ── All Contacts — standalone, detached view. Per explicit
                // follow-up request ("detach the contacts table from the
                // search panel and have it exist on its own"), this is a
                // 4th mutually-exclusive top-level view (see
                // `showAllContacts` state's own doc comment), independent
                // of the shared Search panel/`Draggable`/`activePanelKey`
                // machinery §134 originally used. `InteractionsListView` is
                // `&& !activeInteraction` — per a further follow-up ("keep
                // home page (all contacts) at the last state before
                // navigating away"), `showAllContacts` is no longer cleared
                // when an interaction starts, so this guard is what actually
                // lets the active-interaction branch above take priority
                // instead of this one (see `showAllContacts`'s own doc
                // comment for the full rationale).
                // mounted directly with NO wrapping scroll/padding div — it
                // manages its own internal scrolling and fills its parent
                // (confirmed via its own root className), same as how it's
                // already mounted inside the Search panel's Contacts tab.
                // The breadcrumb reads "Dashboard / All Contacts"; clicking
                // "Dashboard" returns to the Home dashboard view.
                <AllContactsView key="all-contacts" />
              ) : activeInteraction ? (
                // ── Active interaction's detail page — replaces the Desk
                // dashboard the moment a new assignment is started/quick-
                // dialed/redialed (see `activeInteraction` above). Just the
                // record header for now; the blank body below is where a
                // real case/contact detail view will go. Reverts back to
                // the dashboard automatically once the interaction is
                // dismissed (`activeInteractionId` clears). Keyed on the
                // interaction's own `id` (not a static string, unlike the
                // Settings/dashboard branches) — switching directly between
                // two different active interactions (redial/quick-dial while
                // one's already open) should still remount and replay the
                // fade-in, not just re-render the same subtree with new
                // props, the way a static key would.
                //
                // `delay-150 fill-mode-backwards` added to the plain
                // `animate-in fade-in-0` above (per explicit request — a
                // switch between assignments should read as one clean soft
                // fade, not a flash of whatever this specific assignment's
                // own content happens to animate on mount). A fresh remount
                // isn't actually blank underneath: things like an open-by-
                // default `Accordion` (Customer Information's Overview
                // cards) run their own `animate-accordion-down` height
                // grow-in the INSTANT they're painted, regardless of
                // whether the surrounding wrapper is still fading up from
                // opacity 0 — CSS animations tied to a class/data-attribute
                // that's already true at first paint still play from their
                // first frame, they don't wait for an ancestor's opacity to
                // reach 1 first. With only a plain fade before, that meant
                // briefly seeing pieces of the new assignment (cards
                // growing open, etc.) settle into place THROUGH the fade
                // rather than after it — every switch showing a flicker of
                // its own internals assembling.
                //
                // `fill-mode-backwards` (tailwindcss-animate's own utility
                // for `animation-fill-mode`) holds the fade-in animation's
                // FIRST frame — opacity 0 — for the entire `delay-150`
                // window before the animation itself starts, keeping this
                // whole subtree invisible while those nested mount-time
                // animations run their course out of sight. 150ms
                // comfortably covers the accordion height animation's own
                // 200ms duration by the time the fade-in itself finishes
                // (150ms delay + 200ms fade ≈ 350ms total), so by the time
                // anything here actually becomes visible, the new
                // assignment has already finished assembling underneath —
                // the agent just sees one soft fade to the fully-settled
                // page, never the assembly itself. `duration-200` (below)
                // is unchanged — this only changes WHEN the fade starts and
                // HOW it looks the moment it does, not how long the actual
                // fade takes once it begins.
                <div key={`interaction-${activeInteraction.id}`} className="flex flex-1 flex-col min-w-0 overflow-hidden animate-in fade-in-0 duration-200 delay-150 fill-mode-backwards">
                  {showPageHeader && <RecordHeader />}
                  {/* Body row: transcript+composer column. Customer
                      Information now renders as a `SidePanel` docked left of
                      the whole outer Container (see above), not inside this
                      row — so this is just the transcript/composer column
                      now, no docked panel sibling here anymore. (Used to
                      also conditionally show the "Customer History" tab's
                      list + right-docked detail panel here instead, when
                      that tab was selected — moved into the Customer
                      Information panel itself as an "Interactions" tab per
                      explicit request (later renamed "Contacts" — see
                      `CUSTOMER_PANEL_TABS`), so this is unconditional
                      again.) */}
                  <InteractionBody />
                </div>
              ) : (
                <WorkspaceHome key="dashboard" />
              )}
            </div>

            {/* The docked panel's own content, inline as this container's
                second tab — `Draggable`'s own grip/resize plumbing is
                skipped (nothing to drag-position or resize-into once this
                pane spans the container's full width), but the real
                `ContainerHeader` (title/icon/actions/close) is NOT — same
                shape `sharedPanel`'s `renderHeaderControls` below renders,
                just with the dock button wired directly to
                `handlePanelVariantChange` instead of `Draggable`'s own
                internal toggle (there's no mounted `Draggable` instance
                here to own that state while this pane is showing). Always
                shows the "docked" dock icon/label (`Move`/"Undock") since
                this pane only ever renders while `panelVariant === "docked"`
                — clicking it hands off to the exact same float rendering
                below (untouched), which is what makes the tabs disappear;
                re-docking from there flips `panelVariant` back to "docked"
                and `isCombinedPanelMode` brings the tabs right back. Also
                guarded on `!panelFullScreen` — if the nav narrows into
                combined mode while the shared panel happens to be
                fullscreen, `sharedPanelFullScreenOverlay` (rendered as
                `containerRef`'s own last child, further down) already
                covers this content; skip this copy so
                `activePanelContent.body` isn't mounted twice at once. */}
            {isCombinedPanelMode && activePanelContent && !panelFullScreen && (
              <div
                className={cn(
                  "flex flex-1 flex-col min-w-0 overflow-hidden",
                  narrowActiveRegion !== "panel" && "hidden"
                )}
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
                      <Tooltip content="Undock" placement="bottom" asLabel>
                        <ActionIconButton
                          aria-label="Undock"
                          size="sm"
                          onClick={() => handlePanelVariantChange("float")}
                          className="text-lyra-fg-secondary hover:text-lyra-fg-secondary"
                        >
                          <Move className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </ActionIconButton>
                      </Tooltip>
                    </>
                  }
                  onClose={() => setPanelOpen(false)}
                />
                {activePanelContent.headerContent && (
                  // See the docked variant's own matching wrapper (above)
                  // for why "search" skips this wrapper entirely.
                  (activePanelKey === "search" ? (
                    activePanelContent.headerContent
                  ) : (
                    <div className="shrink-0 px-4 pb-3 border-b border-lyra-border-subtle">
                      {activePanelContent.headerContent}
                    </div>
                  ))
                )}
                {/* Per explicit request ("... fade in when transitioning" —
                    see the docked variant's own matching wrapper above for
                    the full doc comment): `key={activePanelKey}` forces a
                    remount on every app switch so `animate-in fade-in-0`
                    replays each time. */}
                <div key={activePanelKey} className="flex flex-col flex-1 min-h-0 animate-in fade-in-0 duration-200">
                  {activePanelContent.body}
                </div>
              </div>
            )}

              </div>
              {/* Customer Information now docks on the RIGHT of the main
                  content column (per explicit request — was on the left) —
                  this block itself is unchanged from its old position
                  (still this exact same conditional/wrapper/`SidePanel`
                  usage), just moved to render AFTER the content column
                  instead of before it, so it's the row's LAST flex child
                  instead of its first. `SidePanel`'s own `side="right"`
                  prop (set on the `SidePanel` inside
                  `CustomerInformationSidePanel` itself, not here) is what
                  actually flips its border/resize-handle/slide-direction to
                  match — this DOM move alone only changes which edge of the
                  ROW it renders against. Per explicit request, also gated
                  on `!activeInteractionIsAgentCall` — an agent-to-agent
                  call hides this docked panel outright (see that const's
                  own doc comment above), not just its Detail-only
                  "unknown contact" fallback. */}
              <WorkspaceRightPanel />

            </div>

            {/* The "View customer info" floating overlay that used to
                render here is gone — per explicit request ("move the
                customer information content back to the side panel"),
                that content now shows INSIDE the docked
                `CustomerInformationSidePanel` above instead (its own
                "Customer Info" `customerPanelActiveTab` value), via
                `headerTitleOverride`/`headerIconOverride`/
                `headerSubheadOverride`/`headerTabsOverride`/
                `footerOverride`/`bodyOverride` on that render site — see
                each override's own doc comment there. */}

            {/* Marcus Webb action-log detail / "Do Something" knowledge-
                article detail — ONE shared floating panel, rendered via
                the same `InContactInteriorPanel` wrapper the "View
                customer info" overlay just above uses (per explicit
                request, "the same overlay type of panel as when customer
                info is clicked from the details panel" — later
                formalized into that shared wrapper once an audit found
                the two had drifted on `maxWidth`, see that file's own
                doc comment). Per a LATER explicit follow-up
                ("toggling between refund approved and tablet warranty
                coverage should change the content of the container —
                like how the home page works"), this used to be TWO
                separate overlays (one per content kind) — now it's one,
                switching between `DetailPanelContent`'s three "views"
                (see that type's own doc comment). `onBack` (new on
                `InteriorPanel`/`ContainerHeader` — see interior-panel.tsx/
                container-header.tsx) renders a back arrow to the left of
                the title, shown only for the `"article-link"` view, to
                return to the article without a second nested panel
                (nesting isn't supported).

                Per explicit bug report (on the original single-purpose
                version of this panel), this used to gate the WHOLE
                `InteriorPanel` on its own nullable selection state — the
                same value also driving `open` — so the instant it
                closed, that state became `null` and React unmounted the
                panel in that same render, skipping its slide/fade
                animation entirely (that animation depends on the
                component staying mounted across an `open=true` →
                `open=false` transition — see `interior-panel.tsx`'s own
                width/opacity transition logic). Gating on
                `activeInteraction` instead keeps it mounted for the
                interaction's whole lifetime; `lastDetailPanelContent`
                (never nulled) keeps its content from going blank
                mid-close.
                AI display inline: it covers this whole content card, from
                its top (over the record header) to its bottom edge. Panel:
                it's portaled into the Contact Details panel, where the AI
                rows live (the card while the panel isn't up). Keyed by
                where it shows, so a layout switch remounts it once with a
                fresh measure of its new parent; the selection is the card's
                (the workspace UI store), so it comes back open. */}
            <DetailSlideOver />

          </Container>

          {/* Voice call controls — per explicit follow-up request ("move
              the call controls below the main container so if a user
              navigates to home/settings while on a call the controls of
              the current call stay visible"): used to render nested inside
              the active-interaction branch's own content column, in the
              same `shrink-0` slot `InteractionComposer` occupies for a chat
              channel (see that branch's own doc comment for where this
              used to live) — that whole branch (and everything inside it)
              unmounts the instant the agent navigates to Settings/Home,
              which is exactly the reported bug. Rendered here instead, as
              `Container`'s own sibling, this bar no longer lives or dies
              with whichever top-level view (Settings/All Contacts/an
              active interaction/the Desk dashboard — the mutually-
              exclusive branches `Container` switches between) happens to
              be showing, so a live call now stays visible under all of
              them.

              Gated on `liveVoiceCallThread` (see its own doc comment
              above) instead of `activeInteraction`/`activeChannelType` —
              this is the one substantive behavior change that comes with
              the reposition, not just a cosmetic move: `activeInteraction`
              itself goes `null` on every Home/Settings nav click
              (`switchActiveInteraction(null)`, LeftNav's own `footer`
              items below), so gating on it here would have made the
              reposition a no-op — the bar would still have vanished the
              moment the agent actually navigated away, just from a
              different-looking spot. `liveVoiceCallThread` is derived
              straight from `interactions` itself, which `switchActive-
              Interaction` never touches, so it keeps resolving to the
              right call regardless of which interaction (if any) is
              currently "active."

              Per explicit follow-up request, this ONLY repositions the
              existing single-call bar — it does NOT add any hold/multi-
              call handling. `onHangUp`/`callStartTick` below now read off
              `liveVoiceCallInteraction`/`liveVoiceCallThread` rather than
              `activeInteraction`/`activeChannel` (so hanging up or the
              running timer still target the right call once it's no
              longer the active one); `onToggleVideo`
              stays wired to the video window exactly as
              before, but ONLY while `isViewingLiveVoiceCallInteraction` —
              both are page-level UI that belongs to whichever interaction
              is currently ON SCREEN, not to whichever one happens to have
              the live call, and those can now be two different
              interactions. Left `undefined` (hides each button outright,
              same pattern every other optional callback on this shared
              component already follows) rather than wiring them to act on
              the wrong interaction's panel/video window, or against no
              interaction at all.

              While `marcusWebbReviewing` is on, this whole page-level bar
              is hidden outright (no `VoiceCallControls`, and no substitute
              either) — per explicit follow-up request ("we need to move
              the action bar to inside the container b/c it should not be
              viewable when the user in on other pages"): the "Reviewing
              this conversation" `ActionBar` used to render right here, as
              this same page-level sibling, which meant it kept showing no
              matter which interaction (or Settings/Home) the agent had
              actually navigated to — exactly the persistence this comment
              praises for a real live call is wrong for "reviewing," which
              should only be visible while actually looking at that one
              interaction. It's moved to that interaction's own content
              column instead (`scenarioKeyOf(activeInteraction.id) === MARCUS_WEBB_ID &&
              marcusWebbReviewing`, right where `InteractionComposer` would
              sit for a chat channel — see that composer's own doc comment
              for the "why nothing renders there for voice today" this
              reuses). */}
          <WorkspaceVoiceBar />
          {/* Shared single-container panel — float (CSS transitions, not
              keyframe animations — avoids compositor fill-mode flash).
              Was five near-identical blocks (one per panel); with only one
              physical container now, there's only one. */}
          {panelVariant === "float" && panelMounted && !panelFullScreen && (
            <div
              style={{
                ...getPanelFloatStyle(),
                pointerEvents: "none",
                visibility: panelState === "closed" ? "hidden" : "visible",
                opacity: panelState === "open" ? 1 : 0,
                transform: panelState === "open" ? "translateY(0)" : "translateY(-8px)",
                transition: panelState === "open"
                  ? "opacity 150ms ease, transform 150ms ease"
                  : "opacity 100ms ease, transform 100ms ease",
              }}
            >
              {sharedPanel}
            </div>
          )}

          {/* Shared single-container panel — fullscreen. Rendered here, as
              the last child of `containerRef`'s own div (which is already
              `relative`), so the `absolute inset-0` overlay fills exactly
              this container — LeftNav and AppHeader (both outside this
              div entirely) stay visible/untouched. See
              `sharedPanelFullScreenOverlay`'s own doc comment (near
              `sharedPanel`, above) for why this bypasses `Draggable`
              entirely instead of trying to stretch its "float" variant to
              cover the container. */}
          {sharedPanelFullScreenOverlay}
        </div>
        </AssignmentsPanelRow>

        {/* Shared single-container panel — docked (sibling of containerRef
            so flex layout keeps it in-bounds). Was five near-identical
            blocks (one per panel); with only one physical container now,
            there's only one. Skipped in `isCombinedPanelMode` — below
            768px the panel's content renders inline as the main
            container's second tab instead (see above), not as this
            separate docked-width column beside it. Also skipped while
            `panelFullScreen` is on — `sharedPanelFullScreenOverlay` (an
            `absolute inset-0` overlay rendered as `containerRef`'s own last
            child, just above) takes over instead.

            `dockedPanelRenderWidth` (below), not the raw `panelWidth`
            state, drives this block's own two `width` styles —
            `maxDockedWidthForMainFloor` (computed once, alongside
            `sharedPanel` above, so `Draggable`'s own `maxWidth` prop there
            can use the exact same boundary) is `containerRef`'s own
            `min-w-[374px]` floor's other half: without SOMETHING here
            actively shrinking to make room, that floor has nowhere to
            borrow space from on its own — once this panel's width plus
            that floor plus LeftNav's own width exceed what
            `bodyContainerWidth` actually has, plain CSS has no way to
            shrink one flex sibling to free up room for another's min-width,
            so the ROW just grows past the viewport instead (confirmed live
            as the actual failure mode of an earlier, simpler attempt at
            this same min-width — and, separately, of an even earlier
            version of THIS fix that only capped the render width while
            NOT actively dragging, which still let a live drag visually run
            the panel off the right edge of the screen; feeding the same
            boundary into `Draggable`'s own `maxWidth` above closes that
            gap too, so this now applies unconditionally, drag or not).
            `panelWidth` itself (the drag-resized value `Draggable`'s own
            `onWidthChange` writes) is left untouched everywhere else —
            float-mode sizing, `Draggable`'s own `defaultWidth`, the
            reset-on-close effect, etc. — so this only clamps what actually
            PAINTS while docked; the size the agent actually dragged to is
            still exactly what they get back the moment there's room for it
            again (window widened, LeftNav collapsed, panel re-opened after
            being closed). */}
        {panelVariant === "docked" && !isCombinedPanelMode && !panelFullScreen && (() => {
          const dockedPanelRenderWidth = Math.min(panelWidth, maxDockedWidthForMainFloor);
          return (
        <div className="flex h-full pb-3" style={{
            width: panelState === "open" ? dockedPanelRenderWidth : 0,
            height: "100%",
            marginRight: panelState === "open" ? 12 : 0,
            overflow: "hidden",
            flexShrink: 0,
            transition: panelIsResizing ? "none" : "width 250ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}>
            <div
              className="flex flex-col h-full animate-in fade-in-0 duration-150"
              style={{
                width: dockedPanelRenderWidth,
                height: "100%",
                display: panelState === "open" ? "flex" : "none",
              }}
            >
              {sharedPanel}
            </div>
        </div>
          );
        })()}

      </div>

      <WorkspaceModals />
    </div>
    </SaveAddressLinkContext.Provider>
    </QueueSimContext.Provider>
    </PageClockContext.Provider>
    </WorkspaceContext.Provider>
  );
}
