// A non-conversation assignment's rail card (P-HOME-1, 1d): a schedule item
// the agent opened — a meeting, training, task, callback… — on lyra's
// `InteractionNavItem`, formatted like a conversation card: the title row,
// then a row with the kind chip (with its icon) and Outcome, then the detail
// line with the due time where a channel's skill line would be. Collapsed,
// the kind's icon takes the tile's top-left corner (`kindIcon`). Outcome
// opens the kind's outcome form; saving completes the item into History.
// P-HOME-1e: a call placed from the item joins this card as its voice leg
// (the leg's journey is the item's assignment): the card is then the
// conversation card's own (NavCardItem) with the Voice row, its timer and End
// call, and the call's Outcome is the card's one Outcome until the leg is done.
// P-HOME-3 gives each kind its own nav-card row through the kinds registry.
import * as React from "react";
import { Button, Popover, SuccessIconSolid } from "@nicecxone/lyra-ui";
import { Clock } from "lucide-react";
import { scheduleCardKey } from "@/domain";
import { feedTimeLabel } from "@/contact-handling/home/time";
import { useScheduleLeg } from "@/contact-handling/home/useScheduleCards";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useScheduleProvider } from "@/provider-context";
import type { ScheduleItem, ScheduleOutcome } from "@/providers";
import { ClockTick } from "@/components/agent-next-gen-clock-tick";
import { KindIcon, KindTag } from "@/components/home/home-kinds";
import { t } from "@/i18n";
import { KindOutcomeForm } from "./kind-cells/KindOutcomeForm";
import { InteractionNavCard } from "./left-nav-parts";
import { NavCardItem } from "./NavCardItem";

/** The kind's Outcome, anchored to its button as a conversation row's Outcome popover is (lyra `ChannelRow`);
 *  the card's and the cell's session row's. */
export function KindOutcomeButton({ item }: { item: ScheduleItem }) {
  const { activeInteractionId, switchActiveInteraction } = useWorkspace();
  const schedule = useScheduleProvider();
  const [open, setOpen] = React.useState(false);
  const save = (outcome: ScheduleOutcome) => {
    setOpen(false);
    schedule?.complete(item.id, outcome).then(
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
      title={t("Outcome")}
      content={<KindOutcomeForm item={item} onSave={save} onCancel={() => setOpen(false)} />}
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

/** The kind row: the kind chip and (with no call on the card) Outcome, then the detail line and the due time. */
function KindRow({ item, outcome }: { item: ScheduleItem; outcome: boolean }) {
  return (
    <div className="flex flex-col gap-1" data-kind-card-body>
      <div className="flex min-h-6 items-center justify-between gap-2">
        <KindTag kind={item.kind} />
        {outcome && <KindOutcomeButton item={item} />}
      </div>
      <div className="flex items-center gap-2 lyra-body-xs text-lyra-fg-secondary">
        <span className="min-w-0 flex-1 truncate">{item.subtitle}</span>
        <span className="inline-flex shrink-0 items-center gap-1" data-kind-card-due>
          <Clock className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
          {feedTimeLabel(item.dueAt, Date.now())}
        </span>
      </div>
    </div>
  );
}

export function KindNavCard({ item, expanded }: { item: ScheduleItem; expanded: boolean }) {
  const { activeInteractionId, switchActiveInteraction } = useWorkspace();
  const leg = useScheduleLeg(item);
  const key = scheduleCardKey(item.id);
  const name = item.customer?.name ?? item.title;

  if (leg) {
    return (
      <div data-kind-nav-card={item.id} data-kind-leg={leg.id}>
        <ClockTick>
          {(clockTick) => (
            <NavCardItem
              interaction={leg}
              slotExpanded={expanded}
              clockTick={clockTick}
              kind={{ name, identified: !!item.customer, row: <KindRow item={item} outcome={false} /> }}
            />
          )}
        </ClockTick>
      </div>
    );
  }

  const due = feedTimeLabel(item.dueAt, Date.now());
  return (
    <div data-kind-nav-card={item.id}>
      <InteractionNavCard
        expanded={expanded}
        showChannelBadge={false}
        customerName={name}
        customerIdentified={!!item.customer}
        elapsed={due}
        active={activeInteractionId === key}
        onClick={() => switchActiveInteraction(key)}
        kindIcon={<KindIcon kind={item.kind} />}
        footerAction={<KindRow item={item} outcome />}
        channels={[]}
      />
    </div>
  );
}
