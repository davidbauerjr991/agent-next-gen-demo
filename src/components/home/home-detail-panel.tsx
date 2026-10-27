// Home's detail panel (moved out of WorkspaceHome for P-HOME-1e): one slot
// for four jobs — the queue drill-down, a Contact History entry's preview,
// an Assignments row's preview (P-HOME-1h) and the "Case Details" form —
// since only one detail view is ever relevant at a time. `selectedQueueId`
// takes priority over the entry, then the row's preview, then
// `interiorPanelOpen`. One column mounts it as Home's docked
// `InteriorPanel`; two columns mount it over the right column through the
// interaction's reference slot (`ReferenceSlotFrame`), so it pushes the feed.
import { useRef } from "react";
import { Button, Icon, Input, Tooltip } from "@nicecxone/lyra-ui";
import { CheckCircle2, CircleDot, Clock, MinusCircle, PhoneOutgoing, RotateCcw } from "lucide-react";
import { DisabledReason } from "@/contact-handling";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { ContactHistoryEntryDetail, type ContactHistoryEntry } from "@/components/agent-next-gen-contact-history";
import { INITIAL_QUEUE_SUB_ITEMS, LATEST_CONTACTS_STATIC } from "@/components/agent-next-gen-interaction-dashboard";
import { QueueSubItems } from "@/components/agent-next-gen-clock-tick";
import type { ReferenceSlotPanel } from "@/components/workspace/ReferenceSlot";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { FeedItemPreview, useFeedPreviewHeader } from "./FeedItemPreview";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/** One queue's skills: in-queue count, longest wait, and the agents by state. */
function QueueDrillDown({ queueId }: { queueId: string }) {
  return (
    <div className="flex flex-col" data-home-detail="queue">
      {/* Only these rows re-render on the queue simulation's 4s beat ("N In Queue"). */}
      <QueueSubItems>
        {(queueSubItems) => (
          <>
            {(queueSubItems[queueId] ?? []).map((item, i) => (
              <div key={item.id} className={cn("flex flex-col gap-2 px-4 py-4", i > 0 && "border-t border-lyra-border-subtle")}>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 lyra-body-md-emphasis text-lyra-fg-default">
                    <item.icon className="h-4 w-4 text-lyra-fg-secondary" strokeWidth={1.5} />
                    {item.label}
                  </span>
                  <span className="lyra-body-sm text-lyra-fg-secondary whitespace-nowrap">{t("{count} In Queue", { count: item.inQueueCount })}</span>
                </div>
                <span className="inline-flex items-center gap-1 lyra-body-sm text-lyra-fg-secondary">
                  <Clock className="h-3 w-3" strokeWidth={1.5} />
                  {t("Longest Wait Time: {wait}", { wait: item.wait })}
                </span>
                {/* Available / Working / Unavailable agents, the Productivity card's icons and colors. */}
                <div className="flex items-center gap-3">
                  <Tooltip content={t("Available Agents")} placement="top">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon icon={CheckCircle2} size="sm" background="success" shape="circle" decorative />
                      <span className="lyra-body-sm-emphasis text-lyra-fg-default">{item.available}</span>
                    </span>
                  </Tooltip>
                  <Tooltip content={t("Working Agents")} placement="top">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon icon={CircleDot} size="sm" background="warning" shape="circle" decorative />
                      <span className="lyra-body-sm-emphasis text-lyra-fg-default">{item.working}</span>
                    </span>
                  </Tooltip>
                  <Tooltip content={t("Unavailable Agents")} placement="top">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon icon={MinusCircle} size="sm" background="critical" shape="circle" decorative />
                      <span className="lyra-body-sm-emphasis text-lyra-fg-default">{item.unavailable}</span>
                    </span>
                  </Tooltip>
                </div>
              </div>
            ))}
          </>
        )}
      </QueueSubItems>
    </div>
  );
}

/** A Contact History entry's preview, with Redial (voice) or Takeover Assignment (every other channel) under the gray card. */
function HistoryEntryDetail({ entry }: { entry: ContactHistoryEntry }) {
  const { calling, handleRedialButtonClick, handleReopenContactHistoryEntry, outboundDial, setSelectedContactHistoryEntry } = useWorkspace();
  return (
    <div data-home-detail="history">
      <ContactHistoryEntryDetail
        entry={entry}
        actionButton={
          entry.redial && !calling.redial ? undefined : entry.redial ? (
            // Disabled with the reason while Unavailable or on a call with this customer (another call holds, row 15).
            <DisabledReason reason={outboundDial.redialBlockedReason(entry)}>
              <Button
                variant="outline"
                disabled={!!outboundDial.redialBlockedReason(entry)}
                // Opens the Dial Pad anchored on this button; the redial happens on its submit.
                onClick={(e) => handleRedialButtonClick(entry, e.currentTarget)}
              >
                <PhoneOutgoing className="h-3.5 w-3.5" strokeWidth={1.5} />
                {t("Redial")}
              </Button>
            </DisabledReason>
          ) : (
            <Button
              onClick={() => {
                handleReopenContactHistoryEntry(entry);
                setSelectedContactHistoryEntry(null);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
              {t("Takeover Assignment")}
            </Button>
          )
        }
      />
    </div>
  );
}

/** Home's detail panel parts: whether it's wanted open, its header and its body.
 *  The last job shown stays in the panel through its close transition. */
export function useHomeDetailPanel(): ReferenceSlotPanel {
  const { interiorPanelOpen, selectedContactHistoryEntry, selectedQueueId, setInteriorPanelOpen, setSelectedContactHistoryEntry, setSelectedQueueId } =
    useWorkspace();
  const [homePreview, setHomePreview] = useWorkspaceUiField("homePreview");
  // A previewed row that has left (opened elsewhere, completed) has nothing to show.
  const previewHeader = useFeedPreviewHeader(homePreview);
  const preview = previewHeader ? homePreview : null;
  const wanted = interiorPanelOpen || Boolean(selectedQueueId) || Boolean(selectedContactHistoryEntry) || Boolean(preview);
  const last = useRef({ queueId: selectedQueueId, entry: selectedContactHistoryEntry, preview, previewHeader });
  if (wanted) last.current = { queueId: selectedQueueId, entry: selectedContactHistoryEntry, preview, previewHeader };
  const { queueId, entry } = last.current;
  const shownPreview = !queueId && !entry ? last.current.preview : null;
  const shownPreviewHeader = shownPreview ? last.current.previewHeader : null;
  return {
    wanted,
    onClose: () => {
      setInteriorPanelOpen(false);
      setSelectedQueueId(null);
      setSelectedContactHistoryEntry(null);
      setHomePreview(null);
    },
    header: shownPreviewHeader ?? {
      headerTitle: queueId ? LATEST_CONTACTS_STATIC.find((c) => c.id === queueId)?.name ?? t("Queue") : entry ? entry.name : t("Case Details"),
      // The queue's skill count (list lengths never change, only counts), or the entry's routing skill.
      headerSubhead: queueId ? t("{count} Skills", { count: (INITIAL_QUEUE_SUB_ITEMS[queueId] ?? []).length }) : entry?.skillName,
    },
    body: queueId ? (
      <QueueDrillDown queueId={queueId} />
    ) : entry ? (
      <HistoryEntryDetail entry={entry} />
    ) : shownPreview ? (
      <FeedItemPreview target={shownPreview} />
    ) : (
      <div className="flex flex-col gap-4 px-4 py-4">
        <Input label={t("Subject")} placeholder={t("Enter subject")} />
        <Input label={t("Priority")} placeholder={t("Select priority")} />
        <Input label={t("Assignee")} placeholder={t("Search agents")} />
        <Input label={t("Tags")} placeholder={t("Add tags")} />
      </div>
    ),
    storageKey: "home.detailPanel",
    slot: "home-detail-panel",
  };
}
