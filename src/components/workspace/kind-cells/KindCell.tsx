// The main column for a non-conversation assignment (P-HOME-1): a minimal
// per-kind cell — the kind's content as the action area and a reference
// column — until P-HOME-3's kinds registry gives each kind its full cells
// through the canvas registry. The outcome is on the rail card (Outcome, 1d).
import { DashboardCard, LYRA_CARD_MAX_WIDTH, PageHeader, Tag } from "@nicecxone/lyra-ui";
import { KindTag } from "@/components/home/home-kinds";
import { feedTimeLabel } from "@/contact-handling/home/time";
import type { ScheduleItem } from "@/providers";
import { t } from "@/i18n";
import { KindBody } from "./kind-bodies";

export function KindCell({ item }: { item: ScheduleItem }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto" data-kind-cell={item.kind} data-schedule-item={item.id}>
      <PageHeader
        title={item.customer?.name ?? item.title}
        subtitle={item.customer ? item.title : feedTimeLabel(item.dueAt, Date.now())}
        titleSuffix={
          <span className="flex items-center gap-2">
            <KindTag kind={item.kind} />
            <Tag shape="pill" variant="neutral" label={t("Active")} />
          </span>
        }
      />
      <div className="flex min-w-0 items-start gap-6 p-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <KindBody item={item} />
        </div>
        <div className="flex shrink-0 flex-col gap-4" style={{ width: LYRA_CARD_MAX_WIDTH }} data-kind-reference>
          <DashboardCard variant="neutral-subtle" headerTitle={t("Related")}>
            <p className="px-4 pb-4 lyra-body-sm text-lyra-fg-secondary">
              {item.customer ? t("{name}'s record and journey appear here.", { name: item.customer.name }) : item.sourceLabel}
            </p>
          </DashboardCard>
          <DashboardCard variant="neutral-subtle" headerTitle={t("Copilot")}>
            <p className="px-4 pb-4 lyra-body-sm text-lyra-fg-secondary">{t("Assignment-scoped, as on a contact.")}</p>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}
