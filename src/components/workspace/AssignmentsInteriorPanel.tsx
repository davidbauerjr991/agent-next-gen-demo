// Settings → Assignments "Show as interior panel" (P-PROFILES 0c): the
// assignment cards in lyra's left `InteriorPanel`, the first child of the
// content card's row, beside the main column (action area + reference column):
// three columns at wide widths. It docks while the three fit
// (`assignmentsPanelDocks`, counting the reference slot, which widens with an
// open slide-over) and the agent has it pinned; otherwise it's lyra's overlay,
// opened from the left nav's Assignments rail item.
import * as React from "react";
import { EmptyState, InteriorPanel, LYRA_CARD_MAX_WIDTH, PanelPinButton } from "@nicecxone/lyra-ui";
import { Inbox } from "lucide-react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { useSettings } from "@/settings";
import { ClockTick } from "@/components/agent-next-gen-clock-tick";
import { assignmentsPanelDocks, availableForAssignmentsPanel } from "@/contact-handling/assignments-panel-placement";
import { useAssignmentCards, useChannelChipsShown } from "@/contact-handling/useAssignmentCards";
import { useScheduleCards } from "@/contact-handling/home/useScheduleCards";
import { KindNavCard } from "./KindNavCard";
import { useAssignmentsPanel } from "@/contact-handling/useAssignmentsPanel";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { AssignmentsCaption, DraggableAssignment } from "./AssignmentCardList";
import { NavCardItem } from "./NavCardItem";

/** The content card's row. Under "Show as interior panel" it's `relative`
 *  (the panel's overlay positions against it) and holds the panel first. */
export function AssignmentsPanelRow({ children }: { children: React.ReactNode }) {
  const [{ placement }] = useSettings("assignments");
  const inPanel = placement === "interiorPanel";
  return (
    <div className={cn("flex flex-1 overflow-hidden min-h-0", inPanel && "relative")}>
      {inPanel && <AssignmentsInteriorPanel />}
      {children}
    </div>
  );
}

function AssignmentsInteriorPanel() {
  const panel = useAssignmentsPanel();
  const { cards, itemProps } = useAssignmentCards(true);
  const scheduleCards = useScheduleCards();
  const chipsShown = useChannelChipsShown("interiorPanel");
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const contentRowWidth = useParentWidth(anchorRef);
  const [panelWidth, setPanelWidth] = React.useState(LYRA_CARD_MAX_WIDTH);
  const [regionsRowWidth] = useWorkspaceUiField("regionsRowWidth");
  const [referenceSlotWidth] = useWorkspaceUiField("referenceSlotWidth");
  const [, setDocks] = useWorkspaceUiField("assignmentsPanelDocks");

  const docks = assignmentsPanelDocks({
    available: availableForAssignmentsPanel({
      regionsRowWidth,
      referenceSlotMounted: referenceSlotWidth !== null,
      contentRowWidth,
      panelDocked: panel.docked,
      panelWidth,
    }),
    panelWidth,
    referenceSlotWidth: referenceSlotWidth ?? 0,
  });
  React.useEffect(() => {
    setDocks(docks);
  }, [docks, setDocks]);

  return (
    <>
      {/* Measures the content card's row (a hidden child, so the row is its parent). */}
      <div ref={anchorRef} hidden aria-hidden="true" />
      <InteriorPanel
        side="left"
        open={panel.open}
        onClose={panel.close}
        headerTitle={t("Assignments")}
        headerActions={
          <PanelPinButton
            pinned={panel.docked}
            onToggle={() => panel.setPinned(!panel.docked)}
            pinnedLabel={t("Unpin Assignments")}
            unpinnedLabel={t("Pin Assignments")}
          />
        }
        width={LYRA_CARD_MAX_WIDTH}
        minWidth={LYRA_CARD_MAX_WIDTH}
        onWidthChange={setPanelWidth}
        resizable
        // Docked or overlay is this panel's own rule, not lyra's breakpoint.
        absoluteBreakpoint={panel.docked ? 0 : Number.POSITIVE_INFINITY}
        storageKey="workspace.assignmentsPanel"
        data-slot="assignments-panel"
        data-docked={panel.docked || undefined}
      >
        <div className="flex flex-col gap-2 px-3 pb-3">
          <AssignmentsCaption expanded mount="interiorPanel" />
          {cards.length === 0 && scheduleCards.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-8 w-8" strokeWidth={1.5} />}
              message={t("Your assignment queue is empty")}
              description={t("New assignments will appear here.")}
              className="h-auto w-full py-6"
              tone="secondary"
            />
          ) : (
            cards.map((interaction) => (
              <DraggableAssignment key={interaction.id} props={itemProps(interaction.id)}>
                <ClockTick>
                  {(clockTick) => <NavCardItem interaction={interaction} slotExpanded clockTick={clockTick} hideChip={!chipsShown} />}
                </ClockTick>
              </DraggableAssignment>
            )).concat(scheduleCards.map((item) => <KindNavCard key={item.id} item={item} expanded />))
          )}
        </div>
      </InteriorPanel>
    </>
  );
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
