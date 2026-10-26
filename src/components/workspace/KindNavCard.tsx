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
import * as React from "react";
import { Button, ContainerHeader, Popover, SuccessIconSolid, type InteractionChannel } from "@nicecxone/lyra-ui";
import { scheduleCardKey } from "@/domain";
import { feedTimeLabel } from "@/contact-handling/home/time";
import { useScheduleLeg } from "@/contact-handling/home/useScheduleCards";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useScheduleProvider } from "@/provider-context";
import type { ScheduleItem } from "@/providers";
import { ClockTick } from "@/components/agent-next-gen-clock-tick";
import { KindIcon, kindLabel } from "@/components/home/home-kinds";
import { t } from "@/i18n";
import { useKindOutcomeForm } from "./kind-cells/KindOutcomeForm";
import { InteractionNavCard } from "./left-nav-parts";
import { NavCardItem } from "./NavCardItem";

/** The kind row's key among a card's rows. */
export const KIND_ROW_ID = "kind";

/** Keeps a click inside the portaled popover from reaching the card (it would switch cards), as lyra's Outcome popover does. */
const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();

/** The kind's Outcome: anchored to its button and laid out in the popover's header / content / footer slots with the
 *  conversation row's Outcome popover's own spacing (lyra `buildOutcomePopoverSlots`). The card's and the cell's
 *  session row's. */
export function KindOutcomeButton({ item }: { item: ScheduleItem }) {
  const { activeInteractionId, switchActiveInteraction } = useWorkspace();
  const schedule = useScheduleProvider();
  const [open, setOpen] = React.useState(false);
  const form = useKindOutcomeForm(item);
  const save = () => {
    setOpen(false);
    schedule?.complete(item.id, form.outcome()).then(
      () => {
        if (activeInteractionId === scheduleCardKey(item.id)) switchActiveInteraction(null);
      },
      (err) => {
        if (import.meta.env.DEV) console.warn("[schedule] complete failed", err);
      },
    );
  };
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom"
      align="end"
      className="z-[9999] w-80"
      onCloseAutoFocus={(e) => e.preventDefault()}
      header={
        <div onClick={stopBubble}>
          <ContainerHeader title={t("Outcome")} bordered={false} className="px-5 pb-0" onClose={() => setOpen(false)} />
        </div>
      }
      content={
        <div className="flex flex-col gap-4 pb-2 pt-1" onClick={stopBubble}>
          {form.fields}
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2 px-5 pb-4 pt-1" onClick={stopBubble} data-kind-outcome-footer="">
          <Button variant="outline" size="md" onClick={() => setOpen(false)}>
            {t("Cancel")}
          </Button>
          <Button variant="default" size="md" onClick={save} disabled={!form.canSave}>
            {t("Save outcome")}
          </Button>
        </div>
      }
    >
      <Button
        variant="icon"
        size="icon-sm"
        aria-label={t("Outcome")}
        className="shrink-0 text-lyra-fg-secondary"
        data-kind-outcome-trigger=""
        onClick={(e) => e.stopPropagation()}
      >
        <SuccessIconSolid className="h-4 w-4 text-lyra-status-info-strong" />
      </Button>
    </Popover>
  );
}

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
