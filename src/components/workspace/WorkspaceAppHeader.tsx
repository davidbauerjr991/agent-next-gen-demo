import {
  ActionIconButton,
  AgentProfile,
  AppHeader,
  AppNameMenu,
  CXoneLogo,
  KebabMenuButton,
  NotificationsBell,
  Separator,
  Tooltip,
} from "@nicecxone/lyra-ui";
import { LayoutGrid, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/BrandMark";
import { ClockTick } from "@/components/agent-next-gen-clock-tick";
import { formatWaitTime } from "@/components/agent-next-gen-shared-utils";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";

/** The workspace's app header (P-EXTRACT C8, from the page): the brand and
 *  app-name menu, the header app icons and "View All Apps", and the agent's
 *  profile and status. */
export function WorkspaceAppHeader() {
  const {
    PANEL_BUTTON_SELECTED_CLASS, PANEL_KEY_METADATA, activePanelKey, agentLegCapable, agentState, agentStatus,
    appDisplayName, appHeaderRef, appMenuGroups, appMenuOpen, appNameMeasureRef, appsMenuItems, appsMenuOpen, darkMode,
    handleAgentLegToggle, handleDarkModeToggle, handlePanelButtonClick, handleStatusChange, headerIconsMeasureRef,
    headerSettings, isCompactHeader, logoSrc, notifications, onNavigate, panelDragHandlers, panelDragOverKey,
    panelOpen, panelOrder, setAppMenuOpen, setAppsMenuOpen, showHeaderIcon, statusSinceTick,
  } = useWorkspace();
  return (
      <AppHeader
        ref={appHeaderRef}
        appName={
          // `appNameMeasureRef` — see "Responsive header icon collapse"
          // above — reads this wrapper's rendered right edge every layout
          // to decide whether the icon row on the other side of the header
          // is crowding it, so icons only hide once there's a real
          // overlap risk instead of a fixed viewport-width guess.
          <div ref={appNameMeasureRef} className="flex items-center">
            {/* The white-label brand (Settings → Appearance). The app-name
                menu shows only while it has items (`APP_MENU_ITEMS`). */}
            {appMenuGroups.length > 0 ? (
              <AppNameMenu
                icon={<img src={logoSrc} alt={appDisplayName} className="h-6 w-6 object-contain" />}
                name={appDisplayName}
                compact={isCompactHeader}
                groups={appMenuGroups}
                menuFooter={<CXoneLogo />}
                open={appMenuOpen}
                onOpenChange={setAppMenuOpen}
              />
            ) : (
              <BrandMark compact={isCompactHeader} />
            )}
          </div>
        }
        actions={
          <>
            {/* Search / Customers / Accounts / Tickets / WEM / Screen Pop /
                Agent Chat / Schedule / Notifications / Ask AI — all ten
                now go through lyra-ui's `ActionIconButton` (`size="xl"`,
                44px), the single canonical AppHeader icon-button shape.
                These used to be hand-rolled `<button>`s (`h-10 w-10
                rounded-lyra-lg`) matching `NotificationsBell`'s own
                trigger, which at the time was also hand-rolled rather than
                built on `ActionIconButton` — lyra-ui has since consolidated
                `NotificationsBell` and `ActionIconButton` onto one shared
                implementation (composing `Button` internally), with
                44px/`rounded-lyra-sm` as the confirmed canonical AppHeader
                size, so this row now matches `Header.tsx`'s (and lyra-ui's
                own `AppHeader.stories.tsx`) icon buttons instead of
                diverging from them. Labeled "Agent Chat" — renamed from
                "Conversations" (itself previously renamed from "Messages"),
                per explicit request tying it to the same click behavior
                Sarah Miller's "New Agent Chat" notification now switches to
                (see `onNotificationClick`'s own doc comment above) — same
                trigger/panel throughout, just the label. Screen Pop sits to
                the left of Agent Chat, using lucide's `MonitorUp` (monitor +
                up arrow) to match the requested icon exactly.

                Customers/Accounts/Tickets/WEM all share the exact same
                single-container panel every other button here does (see
                `handlePanelButtonClick`/`contentByPanelKey` above) — each
                just shows its own blank placeholder body, no bespoke
                content yet since none of the four has a real data source
                in this prototype. Search is the one exception — its body
                is the real `InteractionsListView` (moved in from the old
                "Interactions" desk tab) behind a Contacts/Messages/
                Customers/Threads `TabList` in `headerContent` (see
                `searchContent`'s own doc comment for the full story).
                WEM = Workforce Engagement Management — `UserCog` (a
                person + a settings/management gear) per explicit request
                for "an appropriate Workforce management Lucide icon",
                swapped in for the previous placeholder `Gauge`.

                Trailing "View All Apps" kebab (after Notifications, before
                the AgentProfile divider) lists all nine of these (via
                `appsMenuItems`, built above from `PANEL_KEY_METADATA`) with
                a pin toggle per row — unpinning one wraps its button above
                in `{showHeaderIcon("KEY") && ...}` (`pinnedKeys[key] &&
                !responsivelyHiddenKeys.has(key)`, see the "Responsive
                header icon collapse" block above), hiding the persistent
                header icon while leaving the app reachable from this menu
                (its `onClick` is the same `handlePanelButtonClick` the
                header icon itself uses). That same `showHeaderIcon` check
                is also what auto-hides pinned buttons left-to-right as the
                viewport narrows, so a small screen doesn't squish
                `AppName`. `KebabMenuButton` (not the hand-rolled
                `Menu`) because its rows render as Radix `<div
                role="menuitem">`s rather than `<button>`s — required here
                since each row nests a real `<button>` (`PanelPinButton`) in
                `rightElement`, which would be invalid HTML nested inside
                another button. Wrapped in `Tooltip`+`span` because
                `KebabMenuButton` doesn't spread arbitrary props onto its
                inner trigger, so `Tooltip`'s `asChild` cloning needs that
                intermediate span to attach its hover handlers (same fix
                already used for the "More options" overflow menu in
                lyra-ui's own agent-notifications.tsx). Sized up from its
                24px default to the 44px `ActionIconButton` standard via
                `className` (twMerge dedupes the conflicting h-6/w-6). Uses
                `align="right"` (its default) here since it now sits at the
                right end of the row, matching every other right-aligned
                overflow kebab in this file. */}
            {/* Search through Notifications used to be nine near-identical
                hand-written blocks (one per key); collapsed into a single
                `.map()` over the live, reorderable `panelOrder` (filtered to
                whichever are currently pinned-and-visible via
                `showHeaderIcon`) so drag-to-reorder only has to be wired up
                once. Each icon is wrapped in a plain draggable `<div>`
                rather than teaching `ActionIconButton`/`NotificationsBell`
                themselves about native HTML5 drag — same
                `panelDragHandlers`/`panelDragOverKey` the "View All Apps"
                menu rows below use, so dragging an icon here to reorder it
                moves the very same `panelOrder` array those rows read (and
                a drag in the menu reorders the header right back), rather
                than two independently-drifting orders. "notif" still
                renders the specialized `NotificationsBell` (badge count,
                its own `open`/`onOpenChange`) instead of a generic
                `ActionIconButton` — everything else comes straight out of
                `PANEL_KEY_METADATA`. `headerIconsMeasureRef` wraps just
                this visible row (not the kebab/separator/profile after it)
                — its rendered LEFT edge is the other half of the "Responsive
                header icon collapse" gap measurement above, alongside
                `appNameMeasureRef`. */}
            {/* Per explicit follow-up request ("add the search app icon
                button back to the top right panel") — re-added just the
                Search icon that the broader row-hide below removed, as its
                own always-rendered button rather than folded back into the
                `panelOrder.filter(showHeaderIcon).map(...)` row just below
                (still `false &&`'d out in full), since only Search itself
                was asked back, not the rest of that row or the "View All
                Apps" kebab. Per a LATER explicit request ("hide the search
                icon button in the top right for now - that will not be
                part of phase 1"), this is now itself wrapped in `false &&`
                — same "kept, not deleted, in case it needs to come back"
                treatment as the row below, rather than removing the button
                outright. Same `ActionIconButton`/`handlePanelButtonClick`/
                `PANEL_BUTTON_SELECTED_CLASS` wiring the row uses per-icon,
                so re-enabling this opens the real Search panel exactly like
                it did before. */}
            {false && (
              <ActionIconButton
                size="xl"
                title={PANEL_KEY_METADATA.search.label}
                aria-expanded={panelOpen && activePanelKey === "search"}
                onClick={handlePanelButtonClick("search")}
                className={panelOpen && activePanelKey === "search" ? PANEL_BUTTON_SELECTED_CLASS : undefined}
              >
                <Search className="h-5 w-5" strokeWidth={1.5} />
              </ActionIconButton>
            )}
            {/* Per explicit request ("remove the apps in the top right
                including the app selector to match phase 1") — the app icon
                row (Search / Customers / Accounts / Tickets / WEM / Screen
                Pop / Agent Chat / Schedule / Notifications) and the "View
                All Apps" picker/kebab are both hidden here, mirroring
                AgentNextGenPage.tsx's own identical `false &&` treatment
                (see that file's copy of this exact block for the fuller
                "why" — Phase 2 was left untouched there, same reasoning
                applies here). Wrapped in `false &&` rather than deleted, in
                case it needs to come back. Search itself is exempted above
                per the follow-up request, so this map now effectively covers
                only the remaining eight keys whenever it's re-enabled.
                P-SETTINGS: now gated by Settings → Header → "Show app
                icons" (off in Phase 1, on in Phase 2). Search shows as a
                pin in this row; the standalone Search button above stays
                hidden so it never appears twice. */}
            {headerSettings.showAppIcons && (
              <>
            <div ref={headerIconsMeasureRef} className="flex items-center gap-0">
              {panelOrder.filter(showHeaderIcon).map((key) => {
                const { label, icon: KeyIcon } = PANEL_KEY_METADATA[key];
                const isActive = panelOpen && activePanelKey === key;
                return (
                  <div
                    key={key}
                    draggable
                    onDragStart={(e) => panelDragHandlers.onDragStart(e, key)}
                    onDragOver={(e) => panelDragHandlers.onDragOver(e, key)}
                    onDrop={(e) => panelDragHandlers.onDrop(e, key)}
                    onDragEnd={panelDragHandlers.onDragEnd}
                    onDragLeave={panelDragHandlers.onDragLeave}
                    className={cn(
                      "rounded-lyra-sm cursor-grab active:cursor-grabbing transition-colors",
                      panelDragOverKey === key && "bg-lyra-bg-active-moderate"
                    )}
                  >
                    {key === "notif" ? (
                      <NotificationsBell
                        notifications={notifications}
                        open={isActive}
                        onOpenChange={() => handlePanelButtonClick("notif")()}
                        renderPanel={false}
                      />
                    ) : (
                      <ActionIconButton
                        size="xl"
                        title={label}
                        aria-expanded={isActive}
                        onClick={handlePanelButtonClick(key)}
                        className={isActive ? PANEL_BUTTON_SELECTED_CLASS : undefined}
                      >
                        <KeyIcon className="h-5 w-5" strokeWidth={1.5} />
                      </ActionIconButton>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Separator between the icon-button row and the "View All
                Apps" kebab — same `orientation="vertical"` + `h-auto
                self-stretch` sizing lyra-ui's own vertical Separator usage
                uses elsewhere (see `dashboard-card.tsx`'s metric-row
                divider) so it stretches to match the row's height inside
                AppHeader's `flex items-center` actions container instead of
                a hand-picked fixed height. */}
            {headerSettings.appsGrid && (
              <>
            <Separator orientation="vertical" className="h-auto self-stretch pl-lyra-1 pr-lyra-1" />
            <Tooltip content="View All Apps" placement="bottom" disabled={appsMenuOpen}>
              <span className="inline-flex">
                <KebabMenuButton
                  items={appsMenuItems}
                  ariaLabel="View All Apps"
                  icon={<LayoutGrid className="h-5 w-5" strokeWidth={1.5} />}
                  // Same "outline" treatment as `Button`'s own `variant=
                  // "outline"` (button.tsx) — bordered/`bg-lyra-bg-control`
                  // rather than the plain borderless icon button every
                  // other AppHeader trigger uses, so this one reads as a
                  // distinct "more" control rather than just another app
                  // shortcut. `KebabMenuButton` isn't built on `Button`
                  // (it's its own hand-rolled trigger), so these classes are
                  // reproduced directly rather than passed as a `variant` prop.
                  className="h-11 w-11 rounded-lyra-sm border border-lyra-border-soft bg-lyra-bg-control text-lyra-fg-action hover:bg-lyra-state-hover active:bg-lyra-state-pressed data-[state=open]:bg-lyra-state-hover"
                  onOpenChange={setAppsMenuOpen}
                  // Notifications is unpinnable now (see the `PanelPinButton`
                  // row above) — once it's unpinned (or responsively
                  // auto-hidden, `showHeaderIcon` covers both), its own
                  // `NotificationsBell` badge disappears from the header
                  // along with it. Surface the same unread count here
                  // instead, so an unread notification never goes
                  // completely invisible just because its icon is tucked
                  // away — only shown while the header ISN'T already
                  // showing that count itself, to avoid the same number
                  // appearing on two icons at once.
                  badge={!showHeaderIcon("notif") ? notifications.filter((n) => !n.read).length : undefined}
                />
              </span>
            </Tooltip>
              </>
            )}
              </>
            )}
            {/* Status timer: only `AgentProfile` re-renders each second
                (its `timer` prop is a string, so it can't tick on its own). */}
            <ClockTick>
              {(clockTick) => (
            <AgentProfile
              name="John Smith"
              initials="JS"
              status={agentStatus}
              onStatusChange={handleStatusChange}
              onDarkModeToggle={handleDarkModeToggle}
              isDarkMode={darkMode}
              timer={formatWaitTime(clockTick - statusSinceTick)}
              // Hidden while the provider has no agent leg, and until the
              // first agent snapshot arrives (no fake state before hydrate).
              agentLegStatus={agentState?.leg}
              onAgentLegToggle={handleAgentLegToggle}
              hideAgentLeg={!agentLegCapable || !agentState}
              // Standalone AppHeader "?" icon removed — this app now uses
              // `AgentProfile`'s own conditional "Help" row instead (renders
              // below "Agent Leg Disconnected" whenever `onHelpClick` is
              // passed; see agent-profile.tsx). Same destination/new-tab
              // behavior as the removed icon button.
              onHelpClick={() => window.open("https://help.nicecxone.com/content/agent/cxoneagent/cxoneagent.htm?cshid=CXoneAgent", "_blank", "noopener,noreferrer")}
              onLogOut={() => onNavigate?.("login")}
              // Per explicit request: this prototype has no real
              // integrations to surface here, so the status menu's
              // "Connected Apps" row (which otherwise always renders, even
              // with a permanently-empty "0" badge — see `hideConnectedApps`'s
              // own doc comment, agent-profile.tsx) is hidden outright.
              hideConnectedApps
              className="ml-1"
            />
              )}
            </ClockTick>
          </>
        }
      />
  );
}
