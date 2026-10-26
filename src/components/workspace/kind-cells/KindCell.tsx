// The main column for a non-conversation assignment (P-HOME-1): a minimal
// per-kind cell — the kind's content as the action area and a reference
// column — until P-HOME-3's kinds registry gives each kind its full cells
// through the canvas registry. P-HOME-1e: its header is a conversation's
// two-line record header — line one the lyra `PageHeader` (the name and the
// subject line), line two the session row (the kind where the channel would
// be, the status, the time, Outcome and the kebab), portaled into the same
// host the record header holds the session row in (`sessionRowHost`).
import { createPortal } from "react-dom";
import { DashboardCard, KebabMenuButton, LYRA_CARD_MAX_WIDTH, PageHeader, Tag } from "@nicecxone/lyra-ui";
import { Clock } from "lucide-react";
import { KindTag } from "@/components/home/home-kinds";
import { feedTimeLabel } from "@/contact-handling/home/time";
import { HostSlot } from "@/contact-handling/portal-hosts";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import type { ScheduleItem } from "@/providers";
import { t } from "@/i18n";
import { KindOutcomeButton } from "../KindNavCard";
import { KindBody } from "./kind-bodies";

/** The subject line under the name: the ticket for a task, else the item's title (when a customer names the header). */
function subjectLine(item: ScheduleItem): string {
  if (item.detail.kind === "task") return `${item.detail.ticket} · ${item.detail.summary}`;
  return item.customer ? item.title : item.subtitle;
}

/** The session row's form for a kind: the record header's second line. */
function KindSessionRow({ item }: { item: ScheduleItem }) {
  const { switchActiveInteraction } = useWorkspace();
  return (
    <div className="bg-lyra-bg-surface-base px-6" data-kind-session-row="">
      <div className="border-b border-lyra-border-subtle">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5 lyra-body-sm text-lyra-fg-secondary">
            <KindTag kind={item.kind} />
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
              {feedTimeLabel(item.dueAt, Date.now())}
            </span>
            <span>· {item.sourceLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <Tag shape="pill" variant="info" label={t("Active")} />
            <KindOutcomeButton item={item} />
            <KebabMenuButton
              ariaLabel={t("More options")}
              align="right"
              items={[{ id: "back-home", label: t("Back to Home"), onClick: () => switchActiveInteraction(null) }]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function KindCell({ item }: { item: ScheduleItem }) {
  const { sessionRowHost } = useWorkspace();
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto" data-kind-cell={item.kind} data-schedule-item={item.id}>
      <div data-slot="record-header" className="shrink-0">
        <PageHeader title={item.customer?.name ?? item.title} subtitle={subjectLine(item)} bordered={false} compact />
        <HostSlot host={sessionRowHost} data-slot="record-session-row" />
      </div>
      {createPortal(<KindSessionRow item={item} />, sessionRowHost)}
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
