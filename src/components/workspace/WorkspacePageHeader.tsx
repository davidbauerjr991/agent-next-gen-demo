// Every page header in the content card (P-LAYOUT-F1 A1): lyra's PageHeader with its panel toggles applied once —
// the left one for the assignments panel (while the assignments are in the interior-panel slot), and, where a page
// opts in with `rightPanel`, the right one for the reference column's overlay or the docked panel
// (`rightPanelTarget`). The toggles, their hover reveal and preview are lyra's (PageHeader `panelToggle`,
// `useSidePanelToggle`, through `PanelTogglesProvider`); callers pass PageHeader's own props unchanged.
import * as React from "react";
import { PageHeader, type PageHeaderProps } from "@nicecxone/lyra-ui";
import { rightPanelTarget, usePanelToggles } from "@/contact-handling/panel-toggles";
import { t } from "@/i18n";

export interface WorkspacePageHeaderProps extends PageHeaderProps {
  /** This page has a right toggle: the reference column's overlay when `referenceColumn` doesn't fit, else the
   *  docked panel. */
  rightPanel?: boolean;
  /** The page shows a reference column (the canvas's two columns, a kind cell's). */
  referenceColumn?: boolean;
}

export const WorkspacePageHeader = React.forwardRef<HTMLDivElement, WorkspacePageHeaderProps>(function WorkspacePageHeader(
  { rightPanel = false, referenceColumn = false, ...props },
  ref,
) {
  const toggles = usePanelToggles();
  const left = toggles?.assignments ?? null;
  const target =
    toggles && rightPanel
      ? rightPanelTarget({ referenceColumn, referenceColumnFits: toggles.referenceColumnFits, dockedPanel: toggles.dockedPanel })
      : null;
  const right = target === "reference" ? toggles!.reference : target === "docked" ? toggles!.docked : null;
  const panelToggle = left && right ? "both" : left ? "left" : right ? "right" : undefined;
  return (
    <PageHeader
      ref={ref}
      {...props}
      panelToggle={panelToggle}
      {...(left && { ...left.pageHeaderProps, panelToggleLabel: t("Assignments") })}
      {...(right && {
        ...right.pageHeaderProps,
        innerPanelToggleLabel: target === "reference" ? t("Summaries") : t("Details panel"),
      })}
    />
  );
});
