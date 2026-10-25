// The role cards on Home (P-HOME-1): Reminders for agents; Team queues, Team
// today and Needs you for supervisors; Pipeline, Campaign today and
// Follow-ups for sales. Their figures come from the schedule source's day
// until P-REPORTING supplies them; Reminders is the next items of the day.
import { DashboardCard, MenuItem } from "@nicecxone/lyra-ui";
import { cn } from "@/lib/utils";
import { useScheduleSnapshot } from "@/provider-context";
import type { ScheduleCardMetric, ScheduleItem } from "@/providers";
import type { HomeSectionKey } from "@/settings";
import { t } from "@/i18n";
import { feedTimeLabel } from "@/contact-handling/home/time";
import { KindIcon } from "./home-kinds";

export type MetricSectionKey = Extract<HomeSectionKey, "teamQueues" | "teamToday" | "needsYou" | "pipeline" | "campaignToday" | "followUps">;

const METRIC_CARD_TITLES:Record<MetricSectionKey, string> = {
  teamQueues: "Team queues",
  teamToday: "Team today",
  needsYou: "Needs you",
  pipeline: "Pipeline",
  campaignToday: "Campaign today",
  followUps: "Follow-ups",
};

const TONE_CLASS: Record<NonNullable<ScheduleCardMetric["tone"]>, string> = {
  critical: "text-lyra-status-critical-strong",
  warning: "text-lyra-status-warning-strong",
};

/** A role card: one row per figure. */
export function MetricCard({ section }: { section: MetricSectionKey }) {
  const metrics = useScheduleSnapshot()?.cards[section] ?? [];
  return (
    <DashboardCard variant="neutral-subtle" headerTitle={t(METRIC_CARD_TITLES[section])} data-home-card={section}>
      {metrics.length === 0 ? (
        <p className="px-4 pb-4 lyra-body-sm text-lyra-fg-secondary">{t("Nothing to show yet.")}</p>
      ) : (
        <div className="flex flex-col px-1 pb-2">
          {metrics.map((m) => (
            <MenuItem
              key={m.label}
              as="div"
              static
              comfortable={false}
              label={m.label}
              description={m.hint}
              rightElement={<span className={cn("lyra-label shrink-0", m.tone && TONE_CLASS[m.tone])}>{m.value}</span>}
            />
          ))}
        </div>
      )}
    </DashboardCard>
  );
}

/** The next scheduled item of each of these kinds. */
const REMINDER_KINDS: readonly ScheduleItem["kind"][] = ["training", "callback", "meeting"];

/** Reminders: the day's next training, callback and meeting. */
export function RemindersCard() {
  const items = useScheduleSnapshot()?.items ?? [];
  const now = Date.now();
  const next = REMINDER_KINDS.flatMap((kind) => {
    const first = items.filter((i) => i.kind === kind && i.state === "scheduled").sort((a, b) => a.dueAt - b.dueAt)[0];
    return first ? [first] : [];
  });
  return (
    <DashboardCard variant="neutral-subtle" headerTitle={t("Reminders")} data-home-card="reminders">
      {next.length === 0 ? (
        <p className="px-4 pb-4 lyra-body-sm text-lyra-fg-secondary">{t("Nothing to remind you of.")}</p>
      ) : (
        <div className="flex flex-col px-1 pb-2">
          {next.map((item) => (
            <MenuItem
              key={item.id}
              as="div"
              static
              comfortable={false}
              icon={<KindIcon kind={item.kind} />}
              label={item.title}
              description={item.detail.kind === "training" && item.detail.dueLabel ? item.detail.dueLabel : feedTimeLabel(item.dueAt, now)}
            />
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
