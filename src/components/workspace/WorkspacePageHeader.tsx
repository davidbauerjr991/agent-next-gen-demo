// Every page header in the content card (P-LAYOUT-F1 A1): lyra's PageHeader with its panel toggles applied once —
// the left one for the assignments panel (while the assignments are in the interior-panel slot), and, where a page
// opts in with `rightPanel`, the right one for the reference column's overlay or the docked panel
// (`rightPanelTarget`). The toggles and their hover flyout are lyra's (PageHeader `panelToggle`,
// `useSidePanelToggle`, through `PanelTogglesProvider`); a pinned panel has no hover preview (`withoutPinnedPreview`).
// Callers pass PageHeader's own props unchanged.
import * as React from "react";
import { PageHeader, type PageHeaderProps, type UseSidePanelToggleReturn } from "@nicecxone/lyra-ui";
import { rightPanelTarget, usePanelToggles } from "@/contact-handling/panel-toggles";
import { t } from "@/i18n";

export interface WorkspacePageHeaderProps extends PageHeaderProps {
  /** This page has a right toggle: the reference column's overlay when `referenceColumn` doesn't fit, else the
   *  docked panel. */
  rightPanel?: boolean;
  /** The page shows a reference column (the canvas's two columns, a kind cell's). */
  referenceColumn?: boolean;
  /** The reference toggle's name (default "Summaries"): "Copilot" where the right column is the Copilot panel. */
  referenceLabel?: string;
}

export const WorkspacePageHeader = React.forwardRef<HTMLDivElement, WorkspacePageHeaderProps>(function WorkspacePageHeader(
  { rightPanel = false, referenceColumn = false, referenceLabel, ...props },
  ref,
) {
  const toggles = usePanelToggles();
  const left = toggles?.assignments ?? null;
  // A2: the left toggle's badge is every active assignment, the panel's own "Assignments (n)" (none at zero). The
  // badge is hidden from assistive tech (lyra F1-L2), so the count is in the name: "Assignments, n active".
  const assignmentCount = toggles?.assignmentCount ?? 0;
  const target =
    toggles && rightPanel
      ? rightPanelTarget({ referenceColumn, dockedPanel: toggles.dockedPanel })
      : null;
  const right = target === "reference" ? toggles!.reference : target === "docked" ? toggles!.docked : null;
  const panelToggle = left && right ? "both" : left ? "left" : right ? "right" : undefined;
  return (
    <PageHeader
      ref={ref}
      {...props}
      panelToggle={panelToggle}
      {...(left && {
        ...withoutPinnedPreview(left),
        panelToggleBadge: assignmentCount,
        panelToggleLabel: assignmentCount > 0 ? t("Assignments, {count} active", { count: assignmentCount }) : t("Assignments"),
      })}
      {...(right && {
        ...withoutPinnedPreview(right),
        innerPanelToggleLabel: target === "reference" ? t(referenceLabel ?? "Summaries") : t("Details panel"),
      })}
    />
  );
});

/** The toggle's props with no hover while its panel is pinned (Dave, 2026-10-31): a pinned, closed panel opens on a
 *  click only. lyra's hover preview (SidePanel `preview`) slides the panel in over the page header's toggle that
 *  triggered it (side-panel.tsx's preview layer, z-[5] over the content), so the click that would dock it can't reach
 *  the toggle. Unpinned, hover is the flyout, as lyra has it. */
function withoutPinnedPreview(toggle: UseSidePanelToggleReturn): Partial<PageHeaderProps> {
  if (!toggle.pinned) return toggle.pageHeaderProps;
  const { onPanelHoverStart: _ps, onPanelHoverEnd: _pe, onInnerPanelHoverStart: _is, onInnerPanelHoverEnd: _ie, ...props } =
    toggle.pageHeaderProps;
  return props;
}
