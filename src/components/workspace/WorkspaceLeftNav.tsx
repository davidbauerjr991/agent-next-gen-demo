import { LeftNav, NavRail } from "@nicecxone/lyra-ui";
import { Inbox } from "lucide-react";
import { HostSlot } from "@/contact-handling/portal-hosts";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { t } from "@/i18n";
import { useAssignmentCards, useChannelChipsShown } from "@/contact-handling/useAssignmentCards";
import { useAssignmentsPanel } from "@/contact-handling/useAssignmentsPanel";
import { AssignmentEntryCard, AssignmentsCaption, AssignmentsEmptyState } from "./AssignmentCardList";
import { LeftNavFooterColumn, LeftNavFooterSpacer, LeftNavSlot } from "./left-nav-parts";

/** The workspace's left nav (P-EXTRACT C8, from the page): the rail, the
 *  Assignments caption and one `NavCardItem` per card. The card `.map` stays
 *  here, in `header`, because LeftNav's overlay mode clones `expanded` onto
 *  `header`'s top-level children only. */
export function WorkspaceLeftNav() {
  const {
    interactions, isNavNarrow, navItemsAtTop, navOpen, navRailItems: workspaceRailItems, newOutboundAtBottom,
    newOutboundLauncher, setNavOpen, setVoiceNavSlotMounted, voiceBarHost, voiceSettings,
  } = useWorkspace();
  // P-PROFILES 0b: the cards' order (Custom drags only while the nav is open).
  const { entries, itemProps } = useAssignmentCards(navOpen && !isNavNarrow);
  const chipsShown = useChannelChipsShown("leftNav");
  // P-PROFILES 0c: with the cards in the interior panel, the rail's first
  // item opens it, badged with the cards that need the agent.
  const panel = useAssignmentsPanel();
  const navRailItems = panel.inPanel
    ? [
        {
          icon: <Inbox className="h-5 w-5" strokeWidth={1.5} />,
          label: t("Assignments"),
          active: panel.open,
          badge: panel.attentionCount,
          onClick: panel.toggle,
        },
        ...workspaceRailItems,
      ]
    : workspaceRailItems;
  return (
        <LeftNav
          // Home and Settings — per explicit request ("move the home button
          // above the settings like in phase 1 left nav (match to phase
          // 1)"): mirrors `AgentNextGenPage.tsx`'s own latest arrangement
          // exactly (see that file's identical comment on this same prop
          // for the fuller history) — `items` no longer holds Home at all;
          // `footer` holds BOTH Home and Settings together, Home first (see
          // `footer`'s own doc comment further down). Used to be one
          // `buildNavItems(...)` array split across `items`/`footer`
          // (`homeNavItem` here, `settingsNavItem` there) — that was itself
          // mirroring an EARLIER shape of 2.0's own left nav, since
          // superseded there by this "both together in footer" arrangement.
          // P-SETTINGS: "Home and Settings at the top" moves them here.
          items={navItemsAtTop ? navRailItems : []}
          open={navOpen}
          onToggle={() => setNavOpen((v) => !v)}
          overlay={isNavNarrow}
          // `itemsFirst` stays truthy solely to keep `stickyCaption` (below)
          // rendering at all — left-nav.tsx's own doc comment: "only
          // meaningful combined with itemsFirst, ... ignored when
          // itemsFirst is falsy" — even though `items` itself is now empty
          // (Home having moved to `footer`, below). The sticky-top box
          // `itemsFirst` creates now holds only the "Assignments" caption.
          itemsFirst
          // Lets `header` (the caption/cards region) grow to fill
          // whatever height Home+"New Outbound" don't use, so the
          // "Your assignment queue is empty" message can be vertically
          // centered in that leftover space instead of sitting flush
          // under the caption — see the centering wrapper around
          // `EmptyState` below, and `headerFillsHeight`'s own doc comment
          // in left-nav.tsx.
          headerFillsHeight
          // "Assignments (N)" caption — per explicit follow-up request
          // ("fix the assignments header under the home button so it
          // doesn't scroll"), mirrored from 2.0 (`AgentNextGenPage.tsx` —
          // see that file's own comment on this same prop for the fuller
          // writeup): rendered via `stickyCaption` now, the same sticky-top
          // box as `items` (Home), so it stays pinned with Home instead of
          // scrolling away with the cards under it.
          // P-PROFILES 0c: under "Show as interior panel" the caption and
          // the cards are the panel's, and the rail gains Assignments.
          stickyCaption={panel.inPanel ? undefined : <AssignmentsCaption expanded={navOpen} mount="leftNav" />}
          // Home + Settings — per explicit request ("move the home button
          // above the settings like in phase 1 left nav (match to phase
          // 1)"), both render together in `footer`, Home first, genuinely
          // pinned to the TRUE bottom of the nav (not just `sticky
          // bottom-0`, which only holds once the card list actually
          // overflows; a short list used to leave a Home-less Settings
          // sitting right after the cards with empty space below). `footer`
          // renders as a sibling AFTER the whole scrollable region entirely
          // — always at the aside's real bottom edge regardless of how much
          // content is above it. `NavRail` (exported from left-nav.tsx)
          // renders both `NavItem`s with the exact same TreeMenu/icon-only
          // styling `items` itself uses — mirrors `AgentNextGenPage.tsx`'s
          // own identical `footer` exactly.
          footer={
            // `expanded={navOpen}` passed explicitly, NOT left to
            // `injectExpanded` — `left-nav.tsx`'s INLINE (non-overlay)
            // mode renders `footer` as `{footer}` directly, with no
            // `injectExpanded` call at all (only the OVERLAY-mode branch
            // auto-injects `expanded`), so `NavRail` would otherwise be
            // stuck on its `expanded = false` default — always the
            // icon-only collapsed button, even with the nav wide open.
            // Same reason `AssignmentsSectionCaption`/`EmptyState` below
            // (in `header`) already take `expanded={navOpen}` explicitly.
            // P-SETTINGS: the rail leaves the footer with "Home and Settings
            // at the top"; "New Outbound at the bottom" puts the launcher
            // under it (v3 f0b13dc).
            // Order: Home, (left-nav apps,) Settings, then New Outbound,
            // full width with the rail's spacing above it.
            // With the launcher at the bottom, a column wrapper stacks it
            // under the rail (lyra's footer slot is a row) and forwards the
            // overlay hover's `expanded` to both.
            newOutboundAtBottom ? (
              <LeftNavFooterColumn>
                {!navItemsAtTop && <NavRail expanded={navOpen} items={navRailItems} />}
                <LeftNavFooterSpacer>{newOutboundLauncher}</LeftNavFooterSpacer>
              </LeftNavFooterColumn>
            ) : !navItemsAtTop ? (
              <NavRail expanded={navOpen} items={navRailItems} />
            ) : undefined
          }
          // "New Outbound" itself has moved several times now: started as
          // this exact `pinnedHeader` (fixed at the very TOP of the whole
          // rail, above the "Assignments" caption); moved to a `beforeItems`
          // slot (left-nav.tsx) pinning it to the STICKY BOTTOM rail
          // alongside Home/Settings (reverted — reported "problematic");
          // moved again to a plain child of `header`, scrolling directly
          // below the caption (reverted per THIS request — "move new
          // outbound back above assignments header"). Landed back here,
          // exactly where it started. `beforeItems` (added to left-nav.tsx
          // for the middle arrangement) was already removed entirely once
          // nothing used it — not re-added for this reversion since
          // `pinnedHeader` covers this exact spot on its own.
          // The New Outbound launcher (`newOutboundLauncher`, above the
          // return), unless Settings moves it to the footer.
          pinnedHeader={newOutboundAtBottom ? undefined : newOutboundLauncher}
          header={
            <>
              {/* Settings → Voice controls location "Top of left nav": the
                  voice bar portals in here (v3's `LeftNavVoiceSlot`). Only
                  while the nav is open; collapsed, the bar falls back to
                  the bottom. */}
              {navOpen && voiceSettings.controlsLocation === "top" && (
                <HostSlot host={voiceBarHost} data-slot="left-nav-voice" onMountedChange={setVoiceNavSlotMounted} />
              )}
              {/* Per explicit request ("add a message and icon into the left
                  nav when there are no assignments indicating that the
                  agent's assignment queue is empty") — only while expanded;
                  the icon-only collapsed rail has no room for text (matches
                  `AssignmentsSectionCaption`'s own "nothing to show" null
                  return in that state, just above).

                  Wrapped in a `flex-1 min-h-0 items-center justify-center`
                  container to vertically center it — this only has real
                  slack to center within because `header` itself now grows
                  to fill the rail's available height (`headerFillsHeight`
                  on `LeftNav`, above); without that, this wrapper's
                  `flex-1` would have nothing to consume and the message
                  would still sit flush under the caption. `EmptyState`'s
                  own `h-full`/`py-8` (meant for a bounded box) is still
                  overridden with `h-auto`/`py-6` — the centering comes
                  from THIS wrapper now, not from `EmptyState` trying to
                  size itself.

                  `animate-in fade-in-0 duration-150 delay-200
                  fill-mode-backwards` — per explicit follow-up ("text
                  growing/shrinking ... have it fade in"), mirrored from
                  AgentNextGenPage.tsx (see that file's own comment on this
                  same block for the full writeup): without it, this message
                  mounts the instant `navOpen` flips true while the `<aside>`
                  is still mid-`transition-all duration-200` on its own
                  width, so it visibly rewraps as the box widens. `delay-200`
                  waits out that same 200ms before the message starts
                  becoming visible; `duration-150 fill-mode-backwards` is the
                  fade-in itself, held at opacity 0 for the whole delay
                  (approximating the requested `display: none` → `display:
                  inline`, since `display` can't be transitioned/faded).
                  Close needs no equivalent — this block unmounts instantly
                  when `navOpen` goes false, before the aside starts
                  collapsing, so nothing is ever visible to reflow. */}
              {!panel.inPanel && interactions.length === 0 && entries.length === 0 && navOpen && (
                <div className="flex flex-1 min-h-0 items-center justify-center animate-in fade-in-0 duration-150 delay-200 fill-mode-backwards">
                  <AssignmentsEmptyState />
                </div>
              )}
              {/* No cards until the agent actually starts one above — each
                  card is one contact (or quick-dialed number), with every
                  channel they're being reached on folded into that same
                  card unless it's a different address on an already-open
                  type, which opens as its own row instead (see
                  handleStartCall's merge-by-type+address logic). Sorted per
                  `assignmentSort` (`AssignmentsSectionCaption`'s own sort
                  button) — `interactions` itself stays in insertion order
                  for everything else that reads it, only this rendering
                  reorders a copy.
                  Each card sits in its own `<ClockTick>`, so a tick
                  re-renders that card (its elapsed/hold/awaiting timers)
                  and not the page. The card body is `NavCardItem`; its
                  wrapper is the drag target (P-PROFILES: Sort → Custom). */}
              {/* Every card, conversations and opened schedule items' kind cards alike, in one sorted list with one
                  drag wiring (P-HOME-1m: Custom order covers both). */}
              {!panel.inPanel && entries.map((entry) => (
                // `LeftNavSlot` is the top-level element LeftNav's overlay
                // mode clones its hover `expanded` onto (`injectExpanded`
                // reaches only top-level children); it hands that value
                // through `ClockTick` to the card, as lyra's "Agent Next
                // Gen Left Nav" story wires its cards. Inline mode injects
                // nothing, so the card falls back to `navOpen`.
                <LeftNavSlot key={entry.key}>
                  {(slotExpanded) => (
                    <AssignmentEntryCard entry={entry} dragProps={itemProps(entry.key)} slotExpanded={slotExpanded} navOpen={navOpen} hideChip={!chipsShown} />
                  )}
                </LeftNavSlot>
              ))}
            </>
          }
        />
  );
}
