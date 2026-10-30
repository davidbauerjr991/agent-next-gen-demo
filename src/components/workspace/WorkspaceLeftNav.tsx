import { LeftNav, NavRail } from "@nicecxone/lyra-ui";
import { Inbox } from "lucide-react";
import { Slot, useSlotFilled } from "@/layout/Slot";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { t } from "@/i18n";
import { useAssignmentsPanel } from "@/contact-handling/useAssignmentsPanel";
import { LeftNavFooterColumn, LeftNavFooterSpacer } from "./left-nav-parts";

/** The workspace's left nav (P-EXTRACT C8, from the page): the rail and the left-nav slot's parts (P-LAYOUT: the
 *  Assignments caption and cards, the voice bar's host). */
export function WorkspaceLeftNav() {
  const {
    isNavNarrow, navItemsAtTop, navOpen, navRailItems: workspaceRailItems, newOutboundAtBottom, newOutboundLauncher, setNavOpen,
  } = useWorkspace();
  // P-PROFILES 0c / P-HOME-1n: when the interior panel doesn't fit (an overlay), the rail's first item opens it,
  // badged with the cards that need the agent.
  const panel = useAssignmentsPanel();
  // The sticky caption box renders only while a part fills it (the assignments in the left nav).
  const captionFilled = useSlotFilled("left-nav", "caption");
  const navRailItems = panel.overlaid
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
          // The caption and cards show only in the left-nav slot (Assignments
          // placement → Left nav; P-HOME-1n).
          stickyCaption={captionFilled ? <Slot id="left-nav" region="caption" /> : undefined}
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
          // The left-nav slot's parts (P-LAYOUT, `layout.parts`): its top (the voice bar's host, voice controls "Top
          // of left nav"), then the rest in order (the assignments' cards, or their empty message). Each `<Slot>` is
          // a top-level `header` child, so LeftNav's overlay mode clones its hover `expanded` onto it (`injectExpanded`
          // reaches only top-level children) and the slot hands it to the cards, as lyra's "Agent Next Gen Left Nav"
          // story wires them. The rail's app items are the rail's own (`navRailItems`).
          header={
            <>
              <Slot id="left-nav" region="top" />
              <Slot id="left-nav" />
            </>
          }
        />
  );
}
