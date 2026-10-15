import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import { DEFAULT_SLA, type SlaThresholds } from "@/profiles/contact-center-profile";
import { useActiveProfile } from "@/provider-context";

/** The SLA tier of a ringing offer that has waited `waitSeconds` unanswered:
 *  the same success / warning / critical ladder as an awaiting reply, on the
 *  profile's answer thresholds. */
export function answerSeverity(waitSeconds: number, sla: SlaThresholds): "success" | "warning" | "critical" {
  if (waitSeconds >= sla.criticalSeconds) return "critical";
  if (waitSeconds >= sla.warningSeconds) return "warning";
  return "success";
}

/** A ringing offer's channel row: its answer SLA tier, counted from the
 *  offer's start whether or not the card is selected. The row (chip and
 *  timer) is where an unselected card shows a tier; lyra colors the card
 *  border only on the active card. Undefined for any other row. */
export function offerRowAnswerSeverity(
  card: Pick<NavCard, "offered">,
  thread: Pick<NavCard["threads"][number], "type" | "startTick">,
  clockTick: number,
  sla: SlaThresholds,
): "success" | "warning" | "critical" | undefined {
  if (!card.offered || thread.type !== "voice") return undefined;
  return answerSeverity(clockTick - thread.startTick, sla);
}

/** The active profile's answer thresholds (incoming tile), shared by both pages. */
export function useAnswerSla(): SlaThresholds {
  return useActiveProfile().sla?.answer ?? DEFAULT_SLA.answer;
}
