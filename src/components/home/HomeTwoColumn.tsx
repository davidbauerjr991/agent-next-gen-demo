// Two-column Home (P-HOME-1c, -1e): under the page header and the Home tabs
// (HomePageHeader, P-HOME-1m), the feed and the right column scroll on their own, laid out as
// the interaction's action area and reference slot (`ReferenceSlotFrame`):
// the right column docks beside the feed while it fits and is the
// Summaries-style overlay only when it doesn't (its toggle shows only then);
// Home's detail panel (the queue drill-down, the History preview) opens over
// the right column and pushes the feed narrower, as the interaction's
// slide-over does.
import * as React from "react";
import { ReferenceSlotFrame } from "@/components/workspace/ReferenceSlot";
import { ReferenceOverlayToggle } from "@/components/workspace/SummariesToggle";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useHomeDetailPanel } from "./home-detail-panel";
import { cn } from "@/lib/utils";
import { useSettings } from "@/settings";
import { t } from "@/i18n";

/** The right column's overlay toggle, a ghost icon button in the feed's switcher row (P-HOME-1m: moved out of the
 *  page header); shown only while the column doesn't fit. */
export function HomeCardsToggle() {
  const { wanted } = useHomeDetailPanel();
  return <ReferenceOverlayToggle label={t("Cards")} hidden={wanted} ghost />;
}

export function HomeTwoColumn({ feed, side }: { feed: React.ReactNode; side: React.ReactNode[] }) {
  const { showInteriorPanel } = useWorkspace();
  const panel = useHomeDetailPanel();
  const [home] = useSettings("home");
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden animate-in fade-in-0 duration-200" data-home-layout="twoColumn">
      {/* `relative`: the overlay and the detail panel position against this row (ReferenceSlotFrame). */}
      <div className="relative flex min-h-0 min-w-0 flex-1">
        {/* `pt-4`: the docked right column's own inset (ReferenceColumn), so both columns start at the same y. */}
        {/* Table mode (`home.activityView`): the table fills this area and scrolls inside itself, so the area doesn't. */}
        <div
          className={cn("min-w-0 flex-1 px-6 pb-6 pt-4", home.activityView === "table" ? "flex flex-col overflow-hidden" : "overflow-y-auto")}
          data-home-section="activity"
          data-home-scroll="feed"
        >
          {feed}
        </div>
        <ReferenceSlotFrame
          referenceTitle={t("Cards")}
          reference={
            side.length > 0 && (
              <div className="flex flex-col gap-6" data-home-column="side">
                {side}
              </div>
            )
          }
          panel={{ ...panel, wanted: showInteriorPanel && panel.wanted }}
        />
      </div>
    </div>
  );
}
