import { AgenticAICard, Button, StreamedText, WaitingState } from "@nicecxone/lyra-ui";
import { Activity, Copy } from "lucide-react";
import type { RealTimeSummaryState } from "@/provider-context";
import { t } from "@/i18n";
import { aiCardIcon as ic, timeLabel } from "./ai-card-icon";

export interface ReferenceAccordionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Real-Time Summary (P-CANVAS), lyra's Agentic AI card as its story mirrors
 *  it: Waiting until the contact has turns, then Live (what's new marked),
 *  then Up to date once the contact is over. */
export function RealTimeSummaryCard({ summary, open, onOpenChange, onCopy }: ReferenceAccordionProps & {
  summary?: RealTimeSummaryState;
  onCopy: (text: string) => void;
}) {
  const base = { title: t("Real-Time Summary"), icon: ic(Activity), forYou: true, open, onOpenChange } as const;
  if (!summary) {
    return (
      <div data-slot="real-time-summary" data-frame="waiting">
        <AgenticAICard {...base} status="waiting" subhead={t("Every turn")}>
          <WaitingState message={t("Nothing to summarise yet. A running summary builds here as the contact goes on.")} lines={2} />
        </AgenticAICard>
      </div>
    );
  }
  const { card, previous, updatedAt } = summary;
  const done = card.status === "complete";
  const words = card.text.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div data-slot="real-time-summary" data-frame={done ? "done" : "live"}>
      <AgenticAICard
        {...base}
        status={done ? "done" : "live"}
        statusLabel={done ? t("Up to date") : undefined}
        subhead={t("Updated {time}", { time: timeLabel(updatedAt) })}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => onCopy(card.text)}>
              {ic(Copy)}
              {t("Copy")}
            </Button>
            <span className="lyra-body-sm text-lyra-fg-secondary">{t("{count} words", { count: new Intl.NumberFormat().format(words) })}</span>
          </>
        }
      >
        <StreamedText text={card.text} previous={previous} />
      </AgenticAICard>
    </div>
  );
}
