import { Button, Tooltip } from "@nicecxone/lyra-ui";
import { PanelRight } from "lucide-react";
import { panelToggleClass } from "@/contact-handling";
import { useCanvasRegions } from "@/contact-handling/useCanvasRegions";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

/** P-CANVAS: the record header's "Summaries" toggle, right of Contact
 *  Details. Shown only under the two-column canvas while the reference
 *  column doesn't fit beside the action area; it opens the column as an
 *  overlay (`ReferenceColumn`). */
export function SummariesToggle() {
  const { twoColumn } = useCanvasRegions();
  const [fits] = useWorkspaceUiField("referenceColumnFits");
  const [open, setOpen] = useWorkspaceUiField("summariesOverlayOpen");
  if (!twoColumn || fits) return null;
  return (
    <Tooltip content={t("Summaries")} placement="bottom">
      <Button
        variant="outline"
        size="md"
        className={cn("w-8 shrink-0 gap-0 px-0 animate-in fade-in-0 duration-200", panelToggleClass({ active: open }))}
        aria-label={t("Summaries")}
        aria-pressed={open}
        data-summaries-toggle=""
        onClick={() => setOpen((v) => !v)}
      >
        <PanelRight className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      </Button>
    </Tooltip>
  );
}
