// A non-conversation assignment's rail card (P-HOME-1): a schedule item the
// agent opened — a meeting, training, task, callback… — on lyra's
// `InteractionNavItem` with no channel rows and the kind's chip. P-HOME-3
// gives each kind its own nav-card row through the kinds registry.
import { scheduleCardKey } from "@/domain";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import type { ScheduleItem } from "@/providers";
import { feedTimeLabel } from "@/contact-handling/home/time";
import { KindTag } from "@/components/home/home-kinds";
import { InteractionNavCard } from "./left-nav-parts";

export function KindNavCard({ item, expanded }: { item: ScheduleItem; expanded: boolean }) {
  const { activeInteractionId, switchActiveInteraction, navOpen } = useWorkspace();
  const key = scheduleCardKey(item.id);
  return (
    <div data-kind-nav-card={item.id}>
      <InteractionNavCard
        expanded={expanded ?? navOpen}
        showChannelBadge={false}
        customerName={item.customer?.name ?? item.title}
        customerIdentified={!!item.customer}
        elapsed={feedTimeLabel(item.dueAt, Date.now())}
        active={activeInteractionId === key}
        onClick={() => switchActiveInteraction(key)}
        headerAction={<KindTag kind={item.kind} />}
        channels={[]}
      />
    </div>
  );
}
