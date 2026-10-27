import { AgenticAICard, AgenticSection, Button, Link, StreamedText, WaitingState } from "@nicecxone/lyra-ui";
import { Activity, Copy, Sparkles } from "lucide-react";
import type { RealTimeSummaryState } from "@/provider-context";
import { t } from "@/i18n";
import { aiCardIcon as ic, timeLabel } from "./ai-card-icon";

export interface ReferenceAccordionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** One Copilot ask, as the summary lists it ("8:31 AM · Quiz me on it"); the line opens its result. */
export interface SummaryAsk {
  id: string;
  time: string;
  text: string;
  onOpen: () => void;
}

/** The assignment's Copilot asks, each a link to its result (P-HOME-1h). */
function AsksSection({ asks }: { asks?: readonly SummaryAsk[] }) {
  if (!asks?.length) return null;
  return (
    <AgenticSection label={t("Asked Copilot")} data-slot="summary-asks">
      <ul className="flex flex-col gap-1">
        {asks.map((ask) => (
          <li key={ask.id} className="flex min-w-0 items-center gap-2 lyra-body-md">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-lyra-fg-secondary" strokeWidth={1.5} aria-hidden="true" />
            <Link onClick={ask.onOpen} className="min-w-0 truncate text-start">
              {t("{time} · {question}", { time: ask.time, question: ask.text })}
            </Link>
          </li>
        ))}
      </ul>
    </AgenticSection>
  );
}

/** Real-Time Summary (P-CANVAS), lyra's Agentic AI card as its story mirrors
 *  it: Waiting until the contact has turns, then Live (what's new marked),
 *  then Up to date once the contact is over. The assignment's Copilot asks
 *  follow as linked lines. */
export function RealTimeSummaryCard({ summary, open, onOpenChange, onCopy, asks }: ReferenceAccordionProps & {
  summary?: RealTimeSummaryState;
  onCopy: (text: string) => void;
  asks?: readonly SummaryAsk[];
}) {
  const base = { title: t("Real-Time Summary"), icon: ic(Activity), forYou: true, open, onOpenChange } as const;
  if (!summary) {
    return (
      <div data-slot="real-time-summary" data-frame="waiting">
        <AgenticAICard {...base} status="waiting" subhead={t("Every turn")}>
          <WaitingState message={t("Nothing to summarise yet. A running summary builds here as the contact goes on.")} lines={2} />
          <AsksSection asks={asks} />
        </AgenticAICard>
      </div>
    );
  }
  const { card, previous, updatedAt } = summary;
  const done = card.status === "complete";
  const words = card.text.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div data-slot="real-time-summary" data-frame={done ? "done" : "live"} data-words={words}>
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
        <AsksSection asks={asks} />
      </AgenticAICard>
    </div>
  );
}
