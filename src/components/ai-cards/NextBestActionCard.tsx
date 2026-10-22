import { Alternatives, AgenticAICard, Button, SuggestedReply, SuggestionTag } from "@nicecxone/lyra-ui";
import { Compass, Copy, CornerDownLeft, Lightbulb, MessageSquareQuote, Play, Workflow, X } from "lucide-react";
import type { NextBestActionSuggestion } from "@/providers";
import { t } from "@/i18n";
import { aiCardIcon as ic, timeLabel } from "./ai-card-icon";

/** How a Say or Ask is used: into the chat composer, said on the call, or
 *  copied (a thread with no reply composer, e.g. email until P-PARKED). */
export type NextBestActionUse = "insert" | "said" | "copy";

export interface NextBestActionCardProps {
  /** The surfaced suggestion; none reads "Nothing to suggest" (the answer to the agent's request). */
  suggestion?: NextBestActionSuggestion;
  stepId?: string;
  use?: NextBestActionUse;
  onUse?: () => void;
  onCopy?: () => void;
  onNotNow?: () => void;
  onUseAlternative?: (index: number) => void;
}

/** Next Best Action (P-CANVAS), lyra's Agentic AI card as its story mirrors
 *  it (AgenticAICard.shared.tsx): a Say | Ask | Do suggestion, or Nothing to
 *  suggest. A row in the conversation, surfaced on a pause or on request. */
export function NextBestActionCard({ suggestion, stepId, use = "copy", onUse, onCopy, onNotNow, onUseAlternative }: NextBestActionCardProps) {
  const base = { title: t("Next Best Action"), icon: ic(Compass), forYou: true } as const;

  if (!suggestion) {
    return (
      <div data-slot="next-best-action" data-frame="nothing">
        <AgenticAICard {...base} status="waiting" statusLabel={t("On track")}>
          <p className="lyra-body-md text-lyra-fg-secondary">{t("Nothing to suggest right now — the conversation is on track.")}</p>
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
    <div data-slot="next-best-action" data-frame={suggestion.type} data-step={stepId}>
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
            alternatives={suggestion.alt.map((a, i) => ({ type: a.type, text: a.text, onUse: () => onUseAlternative?.(i) }))}
          />
        )}
      </AgenticAICard>
    </div>
  );
}
