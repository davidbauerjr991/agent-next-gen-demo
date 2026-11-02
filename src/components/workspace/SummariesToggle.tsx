import { ActionIconButton } from "@nicecxone/lyra-ui";
import { PanelRight } from "lucide-react";
import { useCanvasRegions } from "@/contact-handling/useCanvasRegions";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";

/** Two-column Home's Cards toggle (P-HOME-1m): lyra's ghost icon button in the feed's toolbar row, shown only while
 *  the right column doesn't fit beside the feed (`referenceColumnFits`, measured by `ReferenceSlotFrame`); it opens
 *  the column as an overlay (`ReferenceColumn`). Docked, there is nothing to toggle. An interaction's or a kind
 *  cell's reference column is toggled from its page header instead (`WorkspacePageHeader`'s right toggle,
 *  P-LAYOUT-F1). */
export function ReferenceOverlayToggle({ label, hidden = false }: { label: string; hidden?: boolean }) {
  const [fits] = useWorkspaceUiField("referenceColumnFits");
  const [open, setOpen] = useWorkspaceUiField("summariesOverlayOpen");
  if (fits || hidden) return null;
  return (
    <ActionIconButton title={label} aria-label={label} aria-pressed={open} data-summaries-toggle="" onClick={() => setOpen((v) => !v)}>
      <PanelRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
    </ActionIconButton>
  );
}

/** P-CANVAS: the interaction has a reference column to toggle — the two-column canvas. The toggle stays while a
 *  detail panel is open over the column: it closes both, and opening it restores both (P-LAYOUT-F4 10). */
export function useRecordReferenceColumn(): boolean {
  const { twoColumn } = useCanvasRegions();
  // AI display "panel": the Copilot panel is the right column (P-LAYOUT-F4 8, 16), on the same toggle.
  const { aiInPanel, activeInteraction } = useWorkspace();
  return twoColumn || (aiInPanel && !!activeInteraction);
}
