// The main column for a non-conversation assignment (P-HOME-1): a minimal
// per-kind cell — the kind's content as the action area and a reference
// column — until P-HOME-3's kinds registry gives each kind its full cells.
// P-HOME-1e: its header is a conversation's two-line record header — line
// one the lyra `PageHeader` (the name and the subject line), line two the
// session row (the kind where the channel would be, the time, the source and
// Outcome), portaled into the host the record header holds the session row
// in (`sessionRowHost`); the PageHeader's leading slot is the customer's
// avatar (P-HOME-1m removed 1f's back arrow). The reference column is the canvas registry's kind
// cells (`canvas.cells` overrides apply) in the interaction's reference slot,
// with its slide-over; the action area ends with the Copilot input, whose
// answers are scoped to the item (src/scenarios/schedule-copilot.ts).
import { createPortal } from "react-dom";
import { Avatar, PageHeader, Tag } from "@nicecxone/lyra-ui";
import { Clock } from "lucide-react";
import { initialsFor } from "@/components/agent-next-gen-shared-utils";
import { KindTag } from "@/components/home/home-kinds";
import { useScheduleItemCustomer } from "@/contact-handling/home/useScheduleCards";
import { useDetailSlideOverPanel } from "@/components/workspace/detail-slide-over-parts";
import { ContactDetailsControl } from "@/components/workspace/ContactDetailsControl";
import { ReferenceSlotFrame } from "@/components/workspace/ReferenceSlot";
import { ReferenceOverlayToggle } from "@/components/workspace/SummariesToggle";
import { scheduleCardKey } from "@/domain";
import { feedTimeLabel } from "@/contact-handling/home/time";
import { HostSlot } from "@/contact-handling/portal-hosts";
import { useKindCanvasRegions } from "@/contact-handling/useCanvasRegions";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import type { ScheduleItem } from "@/providers";
import { t } from "@/i18n";
import { KindCloseButton } from "./KindCloseButton";
import { KindCopilot, KindCopilotRows } from "./KindCopilot";
import { KindOutcomeButton } from "./KindOutcomeButton";
import { KindBody } from "./kind-bodies";

/** The subject line under the name: the ticket for a task, else the item's title (when a customer names the header). */
function subjectLine(item: ScheduleItem): string {
  if (item.detail.kind === "task") return `${item.detail.ticket} · ${item.detail.summary}`;
  return item.customer ? item.title : item.subtitle;
}

/** The item's status when it isn't the default (an open assignment): Scheduled before it's opened, Completed after. */
function statusLabel(item: ScheduleItem): string | null {
  if (item.state === "scheduled" || item.state === "offered") return t("Scheduled");
  if (item.state === "done") return t("Completed");
  return null;
}

/** The session row's form for a kind: the record header's second line. No kebab: a kind has no row actions yet. */
function KindSessionRow({ item }: { item: ScheduleItem }) {
  const status = statusLabel(item);
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
            <span>{t("· {source}", { source: item.sourceLabel })}</span>
          </div>
          <div className="flex items-center gap-1">
            {status && <Tag shape="pill" variant="neutral" label={status} data-kind-status="" />}
            <KindOutcomeButton item={item} labeled />
            <KindCloseButton item={item} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The customer's header pieces (P-HOME-1m), for any item with a customer on file: the "+" add-channel picker (on a
 *  working item — not a supervisor's escalation, a review surface like Lucas's) and Contact Details, the
 *  conversation's own control (its hover preview and the docked panel, the item's customer its subject). */
function KindCustomerActions({ item }: { item: ScheduleItem }) {
  const { getHeaderAction } = useWorkspace();
  const customer = useScheduleItemCustomer(item);
  if (!customer?.entityId) return null;
  return (
    <>
      {item.kind !== "conversation" && <span data-slot="header-add-channel" className="inline-flex">{getHeaderAction(customer.entityId)}</span>}
      <ContactDetailsControl />
    </>
  );
}

export function KindCell({ item }: { item: ScheduleItem }) {
  const { sessionRowHost, selectedDetailPanelContent } = useWorkspace();
  const customer = useScheduleItemCustomer(item);
  const regions = useKindCanvasRegions();
  // Always the reference slot: a kind cell has no docked Contact Details for the slide-over to open in instead.
  const slideOver = useDetailSlideOverPanel({ wanted: !!selectedDetailPanelContent, assignmentKey: scheduleCardKey(item.id) });
  return (
    // P-HOME-1g: the main column's enter fade (the interaction body's, Home's and Settings' `animate-in fade-in-0
    // duration-200`); WorkspaceHome keys the cell on its item, so it replays per item.
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden animate-in fade-in-0 duration-200"
      data-kind-cell={item.kind}
      data-schedule-item={item.id}
    >
      <div data-slot="record-header" className="shrink-0">
        <PageHeader
          title={customer?.name ?? item.title}
          subtitle={subjectLine(item)}
          bordered={false}
          compact
          // The customer's avatar, as a conversation's record header shows it (P-HOME-1m). No back arrow: Home is the
          // left nav's, and the X / Return to feed's.
          icon={
            customer && (
              <span className="inline-flex" data-kind-avatar="">
                <Avatar initials={customer.entityId ? initialsFor(customer.name) : undefined} color={customer.entityId ? "primary" : "shell"} size="md" />
              </span>
            )
          }
          iconDivider={false}
          actions={
            <div className="flex items-center gap-1">
              <KindCustomerActions item={item} />
              <ReferenceOverlayToggle label={t("Summaries")} hidden={!!selectedDetailPanelContent} />
            </div>
          }
        />
        <HostSlot host={sessionRowHost} data-slot="record-session-row" />
      </div>
      {createPortal(<KindSessionRow item={item} />, sessionRowHost)}
      {/* `relative`: the reference column's overlay and its slide-over position against this row. */}
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col" data-kind-action-area="">
          {/* The conversation action area's column (the transcript's and composer's `max-w-[768px] mx-auto px-6`), so
              the kind's card and the Copilot input don't stretch the full width. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-6">
            <div className="mx-auto flex w-full max-w-[768px] flex-col gap-4 px-6" data-kind-action-column="">
              <KindBody item={item} />
              <KindCopilotRows item={item} />
              {regions.action}
            </div>
          </div>
          <KindCopilot item={item} />
        </div>
        <ReferenceSlotFrame
          reference={regions.reference && <div className="contents" data-kind-reference="">{regions.reference}</div>}
          panel={slideOver}
        />
      </div>
    </div>
  );
}
