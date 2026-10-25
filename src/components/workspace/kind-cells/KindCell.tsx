// The main column for a non-conversation assignment (P-HOME-1): a minimal
// per-kind cell — the kind's content as the action area, a placeholder
// outcome form, and a reference column — until P-HOME-3's kinds registry
// gives each kind its full cells through the canvas registry.
import { DashboardCard, LYRA_CARD_MAX_WIDTH, PageHeader, Tag } from "@nicecxone/lyra-ui";
import { KindTag } from "@/components/home/home-kinds";
import { feedTimeLabel } from "@/components/home/ActivityRow";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useScheduleProvider } from "@/provider-context";
import type { ScheduleItem, ScheduleOutcome } from "@/providers";
import { t } from "@/i18n";
import { KindBody } from "./kind-bodies";
import { OutcomePlaceholder } from "./OutcomePlaceholder";

export function KindCell({ item }: { item: ScheduleItem }) {
  const schedule = useScheduleProvider();
  const { switchActiveInteraction } = useWorkspace();
  const complete = (outcome: ScheduleOutcome) => {
    schedule?.complete(item.id, outcome).then(
      () => switchActiveInteraction(null),
      (err) => {
        if (import.meta.env.DEV) console.warn("[schedule] complete failed", err);
      },
    );
  };
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
          <KindBody item={item} onDialed={() => complete({ note: t("Dialed") })} />
          {item.kind !== "callback" && <OutcomePlaceholder item={item} onSave={complete} />}
        </div>
        <div className="flex shrink-0 flex-col gap-4" style={{ width: LYRA_CARD_MAX_WIDTH }} data-kind-reference>
          <DashboardCard variant="neutral-subtle" headerTitle={t("Related")}>
            <p className="lyra-body-sm text-lyra-fg-secondary">
              {item.customer ? t("{name}'s record and journey appear here.", { name: item.customer.name }) : item.sourceLabel}
            </p>
          </DashboardCard>
          <DashboardCard variant="neutral-subtle" headerTitle={t("Copilot")}>
            <p className="lyra-body-sm text-lyra-fg-secondary">{t("Assignment-scoped, as on a contact.")}</p>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}
