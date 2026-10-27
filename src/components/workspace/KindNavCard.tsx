// A non-conversation assignment's rail card (P-HOME-1, 1d): a schedule item
// the agent opened — a meeting, training, task, callback… — on lyra's
// `InteractionNavItem`, formatted like a conversation card. Its kind is a row
// of the card (lyra's kind row, `InteractionChannel.kind`, P-HOME-1f): the
// kind chip with its icon, the detail line, the due time and the kind's
// Outcome, with a row's hover cluster and highlight. Collapsed, the kind's
// icon takes the tile's top-left corner (`kindIcon`). Saving the Outcome
// completes the item into History.
// P-HOME-1e: a call placed from the item joins this card as its voice leg
// (the leg's journey is the item's assignment): the card is then the
// conversation card's own (NavCardItem), its rows in the order they were
// opened — the kind row, then the Voice row. The main column follows the
// selected row: the kind row shows the kind's cell, the Voice row the call.
// P-HOME-3 gives each kind its own nav-card row through the kinds registry.
import type { InteractionChannel } from "@nicecxone/lyra-ui";
import { scheduleCardKey } from "@/domain";
import { feedTimeLabel } from "@/contact-handling/home/time";
import { useScheduleLeg } from "@/contact-handling/home/useScheduleCards";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import type { ScheduleItem } from "@/providers";
import { ClockTick } from "@/components/agent-next-gen-clock-tick";
import { KindIcon, kindLabel } from "@/components/home/home-kinds";
import { t } from "@/i18n";
import { KindOutcomeButton } from "./kind-cells/KindOutcomeButton";
import { InteractionNavCard } from "./left-nav-parts";
import { NavCardItem } from "./NavCardItem";

/** The kind row's key among a card's rows. */
const KIND_ROW_ID = "kind";

/** The kind's row on its card: the kind chip, the due time, the detail line and the kind's Outcome; no kebab (a kind has
 *  no row actions yet). */
function kindRow(item: ScheduleItem): InteractionChannel {
  return {
    id: KIND_ROW_ID,
    type: "chat",
    kind: { label: t(kindLabel(item.kind)), icon: <KindIcon kind={item.kind} />, outcome: <KindOutcomeButton item={item} /> },
    elapsed: feedTimeLabel(item.dueAt, Date.now()),
    preview: item.subtitle,
    showConsultTransfer: false,
    showKebab: false,
  };
}

export function KindNavCard({ item, expanded }: { item: ScheduleItem; expanded: boolean }) {
  const { activeInteractionId, isNewAssignment, noInteractionCollapse, switchActiveInteraction } = useWorkspace();
  const [kindCellShownFor, setKindCellShownFor] = useWorkspaceUiField("kindCellShownFor");
  const leg = useScheduleLeg(item);
  const key = scheduleCardKey(item.id);
  const name = item.customer?.name ?? item.title;
  const row = kindRow(item);

  if (leg) {
    return (
      <div data-kind-nav-card={item.id} data-kind-leg={leg.id}>
        <ClockTick>
          {(clockTick) => (
            <NavCardItem
              interaction={leg}
              slotExpanded={expanded}
              clockTick={clockTick}
              kind={{
                name,
                identified: !!item.customer,
                row,
                selected: kindCellShownFor === key,
                onSelectRow: (kindRowPicked) => {
                  setKindCellShownFor(kindRowPicked ? key : null);
                  switchActiveInteraction(key);
                },
              }}
            />
          )}
        </ClockTick>
      </div>
    );
  }

  return (
    <div data-kind-nav-card={item.id}>
      <InteractionNavCard
        expanded={expanded}
        showChannelBadge={false}
        customerName={name}
        customerIdentified={!!item.customer}
        elapsed={row.elapsed}
        active={activeInteractionId === key}
        isNewAssignment={isNewAssignment(key)}
        newOutline={isNewAssignment(key)}
        newAssignmentSeverity="success"
        onClick={() => switchActiveInteraction(key)}
        kindIcon={<KindIcon kind={item.kind} />}
        channels={[row]}
        currentChannelKey={KIND_ROW_ID}
        onCurrentChannelChange={() => switchActiveInteraction(key)}
        collapsible={!noInteractionCollapse}
      />
    </div>
  );
}
