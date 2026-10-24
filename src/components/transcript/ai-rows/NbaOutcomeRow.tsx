import { CircleCheck, CircleSlash } from "lucide-react";
import { t } from "@/i18n";
import type { TranscriptMessage } from "../transcript-types";

/** A Next Best Action the agent used or put aside, as one compact AI row
 *  (P-CANVAS), in the transcript (inline) or the AI feed ("main"). */
export function NbaOutcomeRow({ outcome }: { outcome: NonNullable<TranscriptMessage["nbaOutcome"]> }) {
  const used = outcome.outcome === "used";
  const Icon = used ? CircleCheck : CircleSlash;
  return (
    <div className="flex min-w-0 items-center gap-1.5 lyra-body-sm text-lyra-fg-secondary" data-slot="nba-outcome" data-outcome={outcome.outcome}>
      <Icon
        className={used ? "h-3.5 w-3.5 shrink-0 text-lyra-status-success-strong" : "h-3.5 w-3.5 shrink-0"}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <span className="min-w-0 truncate">
        {used
          ? outcome.note
            ? t("Used at {time} — {title} · {label}: {value}", {
                time: outcome.at,
                title: outcome.title,
                label: outcome.note.label.toLocaleLowerCase(),
                value: outcome.note.value,
              })
            : t("Used at {time} — {title}", { time: outcome.at, title: outcome.title })
          : t("Dismissed at {time} — {title}", { time: outcome.at, title: outcome.title })}
      </span>
    </div>
  );
}
