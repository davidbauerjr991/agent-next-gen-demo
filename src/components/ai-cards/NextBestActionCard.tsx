import { Alternatives, AgenticAICard, Button, SuggestedReply, SuggestionTag, WaitingState } from "@nicecxone/lyra-ui";
import { CircleCheck, Compass, Copy, CornerDownLeft, Lightbulb, MessageSquareQuote, Play, Workflow, X } from "lucide-react";
import type { NextBestActionCard as NbaCard } from "@/provider-context";
import { t } from "@/i18n";
import { aiCardIcon as ic, timeLabel } from "./ai-card-icon";

/** How a Say or Ask is used: into the chat composer, said on the call, or
 *  copied (a thread with no reply composer, e.g. email until P-PARKED). */
export type NextBestActionUse = "insert" | "said" | "copy";

export interface NextBestActionCardProps {
  /** The contact's nba card; none yet reads as listening. */
  card?: NbaCard;
  /** The suggestion the agent last used, shown until the next one arrives. */
  used?: { title: string; at: string };
  use: NextBestActionUse;
  onUse: () => void;
  onCopy: () => void;
  onNotNow: () => void;
  onUseAlternative: (index: number) => void;
}

/** Next Best Action (P-CANVAS), lyra's Agentic AI card as its story mirrors
 *  it (AgenticAICard.shared.tsx): Listening → Say | Ask | Do → Used →
 *  Nothing to suggest. Pinned first in the action area. */
export function NextBestActionCard({ card, used, use, onUse, onCopy, onNotNow, onUseAlternative }: NextBestActionCardProps) {
  const base = { title: t("Next Best Action"), icon: ic(Compass), forYou: true } as const;
  const suggestion = card?.frame === "suggestion" ? card.suggestion : undefined;

  if (card?.frame === "nothing") {
    return (
      <div data-slot="next-best-action" data-frame="nothing">
        <AgenticAICard {...base} status="waiting" statusLabel={t("On track")}>
          <p className="lyra-body-md text-lyra-fg-secondary">{t("Nothing to suggest right now — the conversation is on track.")}</p>
        </AgenticAICard>
      </div>
    );
  }

  if (!suggestion && used) {
    return (
      <div data-slot="next-best-action" data-frame="used">
        <AgenticAICard
          {...base}
          status="done"
          statusLabel={t("Used")}
          subhead={t("From a flow · {time}", { time: used.at })}
          footer={
            <span className="inline-flex items-center gap-1.5 lyra-body-sm text-lyra-status-success-strong">
              {ic(CircleCheck)}
              {t("Used at {time} — the next suggestion comes after the customer's next turn", { time: used.at })}
            </span>
          }
        >
          <p className="lyra-body-md-emphasis text-lyra-fg-default">{used.title}</p>
        </AgenticAICard>
      </div>
    );
  }

  if (!suggestion) {
    return (
      <div data-slot="next-best-action" data-frame="listening">
        <AgenticAICard {...base} status="waiting" statusLabel={t("Listening")} subhead={t("After each customer turn")}>
          <WaitingState message={t("A suggestion appears once the conversation gives enough to go on.")} lines={2} />
        </AgenticAICard>
      </div>
    );
  }

  const at = timeLabel(suggestion.at);
  const isDo = suggestion.type === "do";
  const footer = isDo ? (
    <>
      <Button size="sm" onClick={onUse}>
        {ic(Play)}
        {t("Run it")}
      </Button>
      <span className="flex-1" />
      <Button variant="ghost" size="sm" onClick={onNotNow}>
        {ic(X)}
        {t("Not now")}
      </Button>
    </>
  ) : (
    <>
      {use === "insert" && (
        <Button size="sm" onClick={onUse}>
          {ic(CornerDownLeft)}
          {t("Insert into reply")}
        </Button>
      )}
      {use === "said" && (
        <Button size="sm" onClick={onUse}>
          {ic(MessageSquareQuote)}
          {t("Said it")}
        </Button>
      )}
      <Button variant={use === "copy" ? "default" : "outline"} size="sm" onClick={onCopy}>
        {ic(Copy)}
        {t("Copy")}
      </Button>
      <span className="flex-1" />
      <Button variant="ghost" size="sm" onClick={onNotNow}>
        {ic(X)}
        {t("Not now")}
      </Button>
    </>
  );

  return (
    <div data-slot="next-best-action" data-frame={suggestion.type} data-step={card?.stepId}>
      <AgenticAICard
        {...base}
        status={isDo ? "needs-you" : "suggested"}
        statusLabel={isDo ? undefined : t("1 suggestion")}
        subhead={t("From a flow · {time}", { time: at })}
        footer={footer}
      >
        <div className="flex flex-col gap-2">
          <SuggestionTag type={suggestion.type} />
          <p className="lyra-body-md-emphasis text-lyra-fg-default">{suggestion.title}</p>
          <p className="flex gap-1.5 lyra-body-sm text-lyra-fg-secondary">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lyra-status-warning-strong" strokeWidth={1.5} aria-hidden="true" />
            {suggestion.why}
          </p>
          {suggestion.text ? (
            <SuggestedReply>{suggestion.text}</SuggestedReply>
          ) : (
            <p className="flex items-center gap-1.5 lyra-body-sm text-lyra-fg-secondary">
              <Workflow className="h-3.5 w-3.5 shrink-0 text-lyra-fg-active-strong" strokeWidth={1.5} aria-hidden="true" />
              {suggestion.action}
            </p>
          )}
        </div>
        {suggestion.alt.length > 0 && (
          <Alternatives
            label={t("Also consider")}
            alternatives={suggestion.alt.map((a, i) => ({ type: a.type, text: a.text, onUse: () => onUseAlternative(i) }))}
          />
        )}
      </AgenticAICard>
    </div>
  );
}
