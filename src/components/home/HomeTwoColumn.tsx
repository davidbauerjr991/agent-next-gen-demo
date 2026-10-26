// Two-column Home (P-HOME-1c): the welcome header fixed at the top; below
// it the feed and the right column scroll on their own, built like the
// interaction's action area + reference column. The right column is the
// same `ReferenceColumn`, measured the same way (`useReferenceColumnFit`):
// docked beside the feed (pushing it narrower) while it fits and isn't
// collapsed, else the Summaries-style overlay, whose pin docks it again.
import * as React from "react";
import { Button, Tooltip } from "@nicecxone/lyra-ui";
import { PanelRight } from "lucide-react";
import { panelToggleClass } from "@/contact-handling";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { ReferenceColumn } from "@/components/workspace/ReferenceColumn";
import { useReferenceColumnFit } from "@/components/workspace/ReferenceSlot";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

/** The header's toggle for the right column: collapses it while docked, else opens or closes the overlay. */
export function HomeSideToggle() {
  const [fits] = useWorkspaceUiField("referenceColumnFits");
  const [collapsed, setCollapsed] = useWorkspaceUiField("homeSideCollapsed");
  const [overlayOpen, setOverlayOpen] = useWorkspaceUiField("summariesOverlayOpen");
  const docked = fits && !collapsed;
  return (
    <Tooltip content={docked ? t("Collapse cards") : t("Cards")} placement="bottom">
      <Button
        variant="outline"
        size="md"
        className={cn("w-8 shrink-0 gap-0 px-0", panelToggleClass({ active: docked || overlayOpen }))}
        aria-label={docked ? t("Collapse cards") : t("Cards")}
        aria-pressed={docked || overlayOpen}
        data-summaries-toggle=""
        data-home-side-toggle=""
        onClick={() => (docked ? setCollapsed(true) : setOverlayOpen((v) => !v))}
      >
        <PanelRight className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      </Button>
    </Tooltip>
  );
}

export function HomeTwoColumn({ header, feed, side }: { header: React.ReactNode; feed: React.ReactNode; side: React.ReactNode[] }) {
  const anchorRef = React.useRef<HTMLSpanElement>(null);
  useReferenceColumnFit(anchorRef);
  const [collapsed, setCollapsed] = useWorkspaceUiField("homeSideCollapsed");
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden animate-in fade-in-0 duration-200" data-home-layout="twoColumn">
      <div className="shrink-0 px-6 pt-6" data-home-header>
        {header}
      </div>
      {/* `relative`: the overlay positions against this row (as in ReferenceSlot). */}
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto px-6 pb-6" data-home-section="activity" data-home-scroll="feed">
          {feed}
        </div>
        {side.length > 0 && (
          <ReferenceColumn collapsed={collapsed} onPin={() => setCollapsed(false)} title={t("Cards")}>
            <div className="flex flex-col gap-6" data-home-column="side">
              {side}
            </div>
          </ReferenceColumn>
        )}
        <span ref={anchorRef} className="hidden" aria-hidden="true" />
      </div>
    </div>
  );
}
