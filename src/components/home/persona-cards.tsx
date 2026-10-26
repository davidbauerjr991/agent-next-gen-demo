// The role cards on Home (P-HOME-1): Due soon for agents; Team queues, Team
// today and Needs you for supervisors; Pipeline, Campaign today and
// Follow-ups for sales. Their figures come from the schedule source's day
// until P-REPORTING supplies them; Due soon is the day's next items.
import { DashboardCard, MenuItem } from "@nicecxone/lyra-ui";
import { cn } from "@/lib/utils";
import { useScheduleSnapshot } from "@/provider-context";
import type { ScheduleCardMetric } from "@/providers";
import { useSettings, type HomeSectionKey } from "@/settings";
import { t } from "@/i18n";
import { PERSONA_KINDS } from "@/contact-handling/home/persona-kinds";
import { feedTimeLabel } from "@/contact-handling/home/time";
import { useOpenScheduleItem } from "@/contact-handling/home/useActivityFeed";
import { KindIcon } from "./home-kinds";

export type MetricSectionKey = Extract<HomeSectionKey, "teamQueues" | "teamToday" | "needsYou" | "pipeline" | "campaignToday" | "followUps">;

const METRIC_CARD_TITLES: Record<MetricSectionKey, string> = {
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

/** How many items Due soon lists. */
const DUE_SOON_COUNT = 3;

/** Due soon: the next three scheduled items (of the persona's kinds) by due
 *  date; a row opens its item, exactly as the feed's row does. */
export function DueSoonCard() {
  const items = useScheduleSnapshot()?.items ?? [];
  const [{ persona }] = useSettings("workspace");
  const openScheduleItem = useOpenScheduleItem();
  const now = Date.now();
  const next = items
    .filter((i) => i.state === "scheduled" && PERSONA_KINDS[persona].includes(i.kind))
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, DUE_SOON_COUNT);
  return (
    <DashboardCard variant="neutral-subtle" headerTitle={t("Due soon")} data-home-card="dueSoon">
      {next.length === 0 ? (
        <p className="px-4 pb-4 lyra-body-sm text-lyra-fg-secondary">{t("Nothing due.")}</p>
      ) : (
        <div className="flex flex-col px-1 pb-2">
          {next.map((item) => (
            <MenuItem
              key={item.id}
              as="div"
              comfortable={false}
              data-due-soon-row={item.id}
              icon={<KindIcon kind={item.kind} />}
              label={item.title}
              description={feedTimeLabel(item.dueAt, now)}
              onClick={() => openScheduleItem(item.id)}
            />
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
