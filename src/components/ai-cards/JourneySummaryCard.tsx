import { AgenticAICard, AgenticSection, LineItems, Link, WaitingState } from "@nicecxone/lyra-ui";
import { History, Paperclip } from "lucide-react";
import type { JourneySummaryInfo } from "@/contact-handling/journey-summary";
import { t } from "@/i18n";
import { aiCardIcon as ic } from "./ai-card-icon";
import type { ReferenceAccordionProps } from "./RealTimeSummaryCard";

export interface JourneySummaryCardProps extends ReferenceAccordionProps {
  journey: JourneySummaryInfo | null;
  /** The first moments of a contact, while the lookup runs. */
  lookingUp: boolean;
  onViewExperienceMemory?: () => void;
  /** Side panels the agent opened on this card; each re-opens its panel. */
  artifacts?: readonly { id: string; label: string }[];
  onOpenArtifact?: (id: string) => void;
  /** "View All", shown above 10 artifacts. */
  onViewAllArtifacts?: () => void;
}

/** Journey Summary (P-CANVAS), lyra's Agentic AI card as its story mirrors
 *  it: Looking up → Repeat contact (summary, "Detailed view" rows, View
 *  Experience Memory) or No history. The Artifacts the agent opened are its
 *  last section. */
export function JourneySummaryCard({
  journey,
  lookingUp,
  onViewExperienceMemory,
  artifacts,
  onOpenArtifact,
  onViewAllArtifacts,
  open,
  onOpenChange,
}: JourneySummaryCardProps) {
  const base = { title: t("Journey Summary"), icon: ic(History), forYou: true, open, onOpenChange } as const;
  const artifactsSection = artifacts && artifacts.length > 0 && (
    <AgenticSection label={t("Artifacts")} data-slot="journey-artifacts">
      <ul className="flex flex-col gap-1.5">
        {artifacts.slice(0, 10).map((a) => (
          <li key={a.id} className="flex min-w-0 items-center gap-2">
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-lyra-fg-secondary" strokeWidth={1.5} aria-hidden="true" />
            <Link onClick={() => onOpenArtifact?.(a.id)} className="min-w-0 truncate text-start">
              {a.label}
            </Link>
          </li>
        ))}
      </ul>
      {artifacts.length > 10 && (
        <Link onClick={onViewAllArtifacts} className="self-start">
          {t("View All")}
        </Link>
      )}
    </AgenticSection>
  );

  if (lookingUp) {
    return (
      <div data-slot="journey-summary" data-frame="looking-up">
        <AgenticAICard {...base} status="waiting" statusLabel={t("Looking up")} subhead={t("Start of contact")}>
          <WaitingState message={t("Looking up the customer's interactions from the last 30 days.")} lines={2} />
        </AgenticAICard>
      </div>
    );
  }
  if (!journey) {
    return (
      <div data-slot="journey-summary" data-frame="none">
        <AgenticAICard {...base} status="done" statusLabel={t("No history")} subhead={t("Last 30 days")}>
          <p className="lyra-body-md text-lyra-fg-secondary">{t("No interactions in the last 30 days.")}</p>
          {artifactsSection}
        </AgenticAICard>
      </div>
    );
  }
  const count = journey.rows.length;
  return (
    <div data-slot="journey-summary" data-frame="found">
      <AgenticAICard
        {...base}
        status="changed"
        statusLabel={t("Repeat contact")}
        subhead={count === 1 ? t("1 interaction · last 30 days") : t("{count} interactions · last 30 days", { count })}
      >
        <p className="lyra-body-md text-lyra-fg-default">{journey.summary}</p>
        <AgenticSection label={t("Detailed view")}>
          <LineItems rows={journey.rows} />
        </AgenticSection>
        {onViewExperienceMemory && (
          <Link onClick={onViewExperienceMemory} className="self-start">
            {t("View Experience Memory")}
          </Link>
        )}
        {artifactsSection}
      </AgenticAICard>
    </div>
  );
}
