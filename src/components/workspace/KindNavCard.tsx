// A non-conversation assignment's rail card (P-HOME-1, 1d): a schedule item
// the agent opened — a meeting, training, task, callback… — on lyra's
// `InteractionNavItem`, formatted like a conversation card: the title row,
// then a row with the kind chip (with its icon) and Outcome, then the detail
// line with the due time where a channel's skill line would be. Collapsed,
// the kind's icon takes the tile's top-left corner (`kindIcon`). Outcome
// opens the kind's outcome form; saving completes the item into History.
// P-HOME-3 gives each kind its own nav-card row through the kinds registry.
import * as React from "react";
import { ActionIconButton, Popover } from "@nicecxone/lyra-ui";
import { CircleCheck, Clock } from "lucide-react";
import { scheduleCardKey } from "@/domain";
import { feedTimeLabel } from "@/contact-handling/home/time";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useScheduleProvider } from "@/provider-context";
import type { ScheduleItem, ScheduleOutcome } from "@/providers";
import { KindIcon, KindTag } from "@/components/home/home-kinds";
import { t } from "@/i18n";
import { KindOutcomeForm } from "./kind-cells/KindOutcomeForm";
import { InteractionNavCard } from "./left-nav-parts";

export function KindNavCard({ item, expanded }: { item: ScheduleItem; expanded: boolean }) {
  const { activeInteractionId, switchActiveInteraction, navOpen } = useWorkspace();
  const schedule = useScheduleProvider();
  const [outcomeOpen, setOutcomeOpen] = React.useState(false);
  const key = scheduleCardKey(item.id);
  const due = feedTimeLabel(item.dueAt, Date.now());

  const save = (outcome: ScheduleOutcome) => {
    setOutcomeOpen(false);
    schedule?.complete(item.id, outcome).then(
      () => {
        if (activeInteractionId === key) switchActiveInteraction(null);
      },
      (err) => {
        if (import.meta.env.DEV) console.warn("[schedule] complete failed", err);
      },
    );
  };

  const body = (
    <div className="flex flex-col gap-1" data-kind-card-body>
      <div className="flex items-center justify-between gap-2">
        <KindTag kind={item.kind} />
        <Popover
          open={outcomeOpen}
          onOpenChange={setOutcomeOpen}
          placement="right"
          align="start"
          title={t("Outcome")}
          content={<KindOutcomeForm item={item} onSave={save} onCancel={() => setOutcomeOpen(false)} />}
        >
          <ActionIconButton size="sm" title={t("Outcome")} data-kind-outcome-trigger="" onClick={(e) => e.stopPropagation()}>
            <CircleCheck className="h-4 w-4" strokeWidth={1.5} />
          </ActionIconButton>
        </Popover>
      </div>
      <div className="flex items-center gap-2 lyra-body-xs text-lyra-fg-secondary">
        <span className="min-w-0 flex-1 truncate">{item.subtitle}</span>
        <span className="inline-flex shrink-0 items-center gap-1" data-kind-card-due>
          <Clock className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
          {due}
        </span>
      </div>
    </div>
  );

  return (
    <div data-kind-nav-card={item.id}>
      <InteractionNavCard
        expanded={expanded ?? navOpen}
        showChannelBadge={false}
        customerName={item.customer?.name ?? item.title}
        customerIdentified={!!item.customer}
        elapsed={due}
        active={activeInteractionId === key}
        onClick={() => switchActiveInteraction(key)}
        kindIcon={<KindIcon kind={item.kind} />}
        footerAction={body}
        channels={[]}
      />
    </div>
  );
}
