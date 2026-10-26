// The kind cells' reference cards (P-HOME-1f): the canvas registry's cells
// for a non-conversation assignment's main column (`context: "kind"`), so
// `canvas.cells` overrides apply to them as to a conversation's. Each reads
// the open schedule item: a Real-Time Summary built from the item's own
// detail, what it's related to, and the customer's journey where there is a
// customer. P-HOME-3's kinds registry gives each kind its own cells.
import { useState } from "react";
import { AgenticAICard, AgenticSection } from "@nicecxone/lyra-ui";
import { Link2 } from "lucide-react";
import { journeySummaryFor } from "@/contact-handling/journey-summary";
import { feedTimeLabel } from "@/contact-handling/home/time";
import { useActiveScheduleItem } from "@/contact-handling/home/useScheduleCards";
import type { CanvasCell } from "@/contact-handling/canvas-registry";
import type { ScheduleItem } from "@/providers";
import { JourneySummaryCard } from "@/components/ai-cards/JourneySummaryCard";
import { RealTimeSummaryCard } from "@/components/ai-cards/RealTimeSummaryCard";
import { aiCardIcon as ic } from "@/components/ai-cards/ai-card-icon";
import { useSettings } from "@/settings";
import { t } from "@/i18n";

const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => {});

/** The item's summary, from its own detail (the seed's content) and any notes added while it's open. */
export function kindSummaryText(item: ScheduleItem): string {
  const d = item.detail;
  const body =
    d.kind === "callback"
      ? `${item.customer?.name ?? item.title} asked for a callback: ${d.reason}.`
      : d.kind === "meeting"
        ? `${d.attendees} attendees. Agenda: ${d.agenda.join("; ")}.`
        : d.kind === "training"
          ? `${d.module}${d.dueLabel ? ` · ${d.dueLabel}` : ""}.`
          : d.kind === "task"
            ? `${d.ticket}: ${d.summary}. Next: ${d.actions.join("; ")}.`
            : d.kind === "conversation"
              ? d.summary
              : d.points.join(" ");
  return item.notes?.length ? `${body} Notes: ${item.notes.join(" ")}` : body;
}

/** An Agentic AI card's open state, the agent's own (a kind cell has no AI focus to follow yet). */
function useOpen() {
  const [open, onOpenChange] = useState(true);
  return { open, onOpenChange };
}

function KindSummaryCell() {
  const item = useActiveScheduleItem();
  const accordion = useOpen();
  if (!item) return null;
  const text = kindSummaryText(item);
  return (
    <RealTimeSummaryCard
      summary={{
        card: { id: `kind-summary:${item.id}`, kind: "text", title: t("Real-Time Summary"), status: "complete", provenance: { tier: 1, collections: ["schedule"] }, text },
        updatedAt: Date.now(),
      }}
      onCopy={copy}
      {...accordion}
    />
  );
}

function KindRelatedCell() {
  const item = useActiveScheduleItem();
  const accordion = useOpen();
  if (!item) return null;
  return (
    <div data-slot="kind-related">
      <AgenticAICard title={t("Related")} icon={ic(Link2)} status="done" subhead={item.sourceLabel} {...accordion}>
        <AgenticSection label={t("This assignment")}>
          <ul className="flex flex-col gap-1 lyra-body-md text-lyra-fg-default">
            {item.customer && <li>{t("Customer: {name}", { name: item.customer.name })}</li>}
            <li>{t("Due: {time}", { time: feedTimeLabel(item.dueAt, Date.now()) })}</li>
            <li>{item.subtitle}</li>
          </ul>
        </AgenticSection>
      </AgenticAICard>
    </div>
  );
}

function KindJourneyCell() {
  const item = useActiveScheduleItem();
  const accordion = useOpen();
  const [channels] = useSettings("channels");
  if (!item?.customer) return null;
  const journey = journeySummaryFor({ customerName: item.customer.name, customerId: item.customer.entityId, channels });
  return <JourneySummaryCard journey={journey} lookingUp={false} {...accordion} />;
}

export const KIND_CANVAS_CELLS: readonly CanvasCell[] = [
  { id: "kind-summary", region: "reference", order: 10, component: KindSummaryCell, context: "kind" },
  { id: "kind-related", region: "reference", order: 20, component: KindRelatedCell, context: "kind" },
  { id: "kind-journey", region: "reference", order: 30, component: KindJourneyCell, context: "kind" },
];
