// The interior-panel slot (P-PROFILES 0c; P-HOME-1n; P-LAYOUT fix (a); P-LAYOUT-F1 A1): the assignments part in
// lyra's left `SidePanel` inside the content card, its first flex child, before the record header, body, Home and
// Settings — the "Side Panel — Left" story's shape. Its toggle is the page header's own (lyra PageHeader
// `panelToggle`, through `WorkspacePageHeader`), and the two share lyra `useSidePanelToggle`'s state
// (`PanelTogglesProvider`): pinned, a click on the toggle opens and closes it (no hover preview: it would cover the
// toggle, `withoutPinnedPreview`); unpinned, it's a hover flyout. Pinned, it pushes the content while it, the action area and the reference slot
// fit (`assignmentsPanelDocks`, counting the reference slot, which widens with an open slide-over); where they don't,
// it renders unpinned (lyra's `pinDisabled`). Its header is SidePanel's: "Assignments", the count, the caption's
// controls and the pin; no close (P-LAYOUT-F2 1b). Open, pinned (both on by default) and its dragged width (the
// minimum until dragged, P-LAYOUT-F2 1a) are per-browser working state.
import * as React from "react";
import { LEFT_NAV_EXPANDED_WIDTH, SidePanel } from "@nicecxone/lyra-ui";
import { t } from "@/i18n";
import { Slot } from "@/layout/Slot";
import { useSlotHas } from "@/layout/useSlot";
import { assignmentsPanelDocks, availableForAssignmentsPanel } from "@/contact-handling/assignments-panel-placement";
import { useRailAssignmentCount } from "@/contact-handling/home/useScheduleCards";
import { PanelTogglesProvider, usePanelToggles } from "@/contact-handling/panel-toggles";
import { setAssignmentsWorkingState, useAssignmentsWorkingState } from "@/contact-handling/assignments-working-state";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { PageRightHostRow } from "./page-right-host";
import { AssignmentsHeaderActions, AssignmentsStack } from "./AssignmentCardList";

/** The content card's row of the content column and its side panels (the page's, P-LAYOUT-F1): the panels' toggle
 *  state for every page header in it (`PanelTogglesProvider`), then the interior-panel slot, then the page's
 *  children (the content column and the docked right panel), then the page's right host (P-LAYOUT-F3 4: where a
 *  docking right panel mounts, beside the whole page column). */
export function PanelToggleRow({ children }: { children: React.ReactNode }) {
  return (
    <PanelTogglesProvider>
      <PageRightHostRow>
        <AssignmentsInteriorPanel />
        {children}
      </PageRightHostRow>
    </PanelTogglesProvider>
  );
}

/** The assignments part in the interior-panel slot. */
function AssignmentsInteriorPanel() {
  return useSlotHas("interior-panel", "assignments") ? <AssignmentsSidePanel /> : null;
}

function AssignmentsSidePanel() {
  const toggle = usePanelToggles()?.assignments;
  const count = useRailAssignmentCount();
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const contentRowWidth = useParentWidth(anchorRef);
  // The dragged width, kept per browser (the working state; clamped to the panel's bounds on read). Live while
  // dragging, saved once the drag settles.
  const { panelWidth: savedWidth } = useAssignmentsWorkingState();
  const [panelWidth, setPanelWidth] = React.useState(() => clampPanelWidth(savedWidth));
  const pendingWidth = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (panelWidth === clampPanelWidth(savedWidth)) return;
    pendingWidth.current = panelWidth;
    const id = window.setTimeout(() => {
      pendingWidth.current = null;
      setAssignmentsWorkingState({ panelWidth });
    }, SAVE_WIDTH_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [panelWidth, savedWidth]);
  // Unmounted before a drag settled (e.g. a placement switch): its width is still saved.
  React.useEffect(
    () => () => {
      if (pendingWidth.current !== null) setAssignmentsWorkingState({ panelWidth: pendingWidth.current });
    },
    [],
  );
  const [regionsRowWidth] = useWorkspaceUiField("regionsRowWidth");
  const [referenceSlotWidth] = useWorkspaceUiField("referenceSlotWidth");
  const [, setDocks] = useWorkspaceUiField("assignmentsPanelDocks");
  const docked = !!toggle && toggle.pinned && toggle.open;

  const docks = assignmentsPanelDocks({
    available: availableForAssignmentsPanel({
      regionsRowWidth,
      referenceSlotMounted: referenceSlotWidth !== null,
      contentRowWidth,
      panelDocked: docked,
      panelWidth,
    }),
    panelWidth,
    referenceSlotWidth: referenceSlotWidth ?? 0,
  });
  React.useEffect(() => setDocks(docks), [docks, setDocks]);

  if (!toggle) return null;
  return (
    <>
      {/* Measures the panel-and-content row (a hidden child, so the row is its parent). */}
      <div ref={anchorRef} hidden aria-hidden="true" />
      <SidePanel
        side="left"
        {...toggle.sidePanelProps}
        // No close button of its own: the page header's toggle is the one open/close control, as in AdminShell
        // (P-LAYOUT-F2 1b).
        // The page has its own skip link; a left SidePanel would add a second, identical one.
        skipToMain={false}
        headerTitle={t("Assignments")}
        headerTitleBadge={<span className="lyra-body-md text-lyra-fg-secondary">{t("({count})", { count })}</span>}
        headerActions={<AssignmentsHeaderActions />}
        // No narrower than the left nav's expanded width, which the cards are sized for (lyra's
        // `LEFT_NAV_EXPANDED_WIDTH`, P-LAYOUT-F1 A2); SidePanel's own 200 would crush them. Its own 425 max.
        minWidth={LEFT_NAV_EXPANDED_WIDTH}
        maxWidth={PANEL_MAX_WIDTH}
        width={panelWidth}
        onWidthChange={setPanelWidth}
        resizable
        className="focus:outline-none"
        data-slot="assignments-panel"
        data-docked={docked || undefined}
      >
        {/* Voice controls at the top of the assignments list (P-LAYOUT-F1 A3). */}
        <Slot id="interior-panel" region="top" />
        <AssignmentsStack mount="interiorPanel" className="px-3 pb-3" />
      </SidePanel>
    </>
  );
}

/** SidePanel's own default maximum, passed explicitly so the saved width clamps to the same bound. */
const PANEL_MAX_WIDTH = 425;
/** A drag fires a width per frame: the saved width waits for it to settle. */
const SAVE_WIDTH_AFTER_MS = 250;

/** A saved width within the panel's bounds (the nav's expanded width to SidePanel's max); the minimum, the nav's
 *  expanded width, when there's none (P-LAYOUT-F2 1a). */
function clampPanelWidth(width: number | null): number {
  return Math.min(PANEL_MAX_WIDTH, Math.max(LEFT_NAV_EXPANDED_WIDTH, width ?? LEFT_NAV_EXPANDED_WIDTH));
}

/** The width of `ref`'s parent, tracked; 0 until laid out (jsdom). */
function useParentWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    setWidth(parent.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(parent);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}
