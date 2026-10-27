// An Assignments row's preview (P-HOME-1h), in Home's detail panel where a
// Contact History entry's opens: the item's title, kind, due, source, the
// seed's detail and its customer, with one primary action that does what the
// row's click did before (it moves to the rail and becomes active). An offer
// keeps Accept and Decline. A completed item (a History row) has no action.
import { Button, MenuItem, Tag } from "@nicecxone/lyra-ui";
import { Check, X } from "lucide-react";
import type { FeedTarget } from "@/contact-handling/home/activity-feed";
import { feedTimeLabel } from "@/contact-handling/home/time";
import { useActivateFeedTarget } from "@/contact-handling/home/useActivityFeed";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useScheduleProvider, useScheduleSnapshot } from "@/provider-context";
import type { ScheduleItem } from "@/providers";
import { t } from "@/i18n";
import { CHANNEL_NAMES } from "@/contact-handling/home/channel-names";
import { KindTag, kindLabel } from "./home-kinds";

/** The seed's detail, one line each: the agenda, the module, the ticket, the callback's reason… */
function detailLines(item: ScheduleItem): string[] {
  const d = item.detail;
  if (d.kind === "meeting") return [t("{count} attendees", { count: d.attendees }), ...d.agenda];
  if (d.kind === "training") return [d.module, ...(d.dueLabel ? [d.dueLabel] : [])];
  if (d.kind === "task") return [d.ticket, d.summary, ...d.actions];
  if (d.kind === "callback") return [d.reason, d.phone];
  if (d.kind === "conversation") return [CHANNEL_NAMES[d.channel], d.summary];
  return [...d.points];
}

/** The primary action's label: Start for a training or meeting, Dial for a callback, else Open. */
function primaryLabel(item: ScheduleItem): string {
  if (item.kind === "training" || item.kind === "meeting") return t("Start");
  if (item.kind === "callback") return t("Dial");
  return t("Open");
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="lyra-label text-lyra-fg-secondary">{label}</span>
      <span className="lyra-body-md text-lyra-fg-default">{value}</span>
    </div>
  );
}

function OfferActions({ onAccept, onDecline }: { onAccept: () => void; onDecline?: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button onClick={onAccept}>
        <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
        {t("Accept")}
      </Button>
      {onDecline && (
        <Button variant="outline" onClick={onDecline}>
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          {t("Decline")}
        </Button>
      )}
    </div>
  );
}

function ScheduleItemPreview({ item }: { item: ScheduleItem }) {
  const activate = useActivateFeedTarget();
  const schedule = useScheduleProvider();
  const [, setPreview] = useWorkspaceUiField("homePreview");
  const target: FeedTarget = { type: "schedule", itemId: item.id };
  const run = (action: () => void) => {
    setPreview(null);
    action();
  };
  return (
    <div className="flex flex-col gap-4 px-4 py-4" data-home-detail="item" data-schedule-item={item.id}>
      <div className="flex flex-wrap items-center gap-2">
        <KindTag kind={item.kind} />
        {item.state === "done" && <Tag shape="pill" variant="neutral" label={t("Completed")} />}
      </div>
      <Field label={item.state === "done" ? t("Completed") : t("Due")} value={feedTimeLabel(item.state === "done" ? (item.completedAt ?? item.dueAt) : item.dueAt, Date.now())} />
      <Field label={t("Source")} value={item.sourceLabel} />
      {item.customer && <Field label={t("Customer")} value={item.customer.name} />}
      <div className="flex flex-col gap-0.5">
        <span className="lyra-label text-lyra-fg-secondary">{t("Details")}</span>
        <div className="-mx-3 flex flex-col">
          {detailLines(item).map((line) => (
            <MenuItem key={line} as="div" static comfortable={false} label={line} />
          ))}
        </div>
      </div>
      {item.state === "offered" ? (
        <OfferActions onAccept={() => run(() => activate(target))} onDecline={() =>
            run(() =>
              schedule?.decline(item.id).catch((err) => {
                if (import.meta.env.DEV) console.warn("[schedule] decline failed", err);
              }),
            )
          }
        />
      ) : (
        item.state === "scheduled" && (
          <div>
            <Button onClick={() => run(() => activate(target))} data-preview-primary="">
              {primaryLabel(item)}
            </Button>
          </div>
        )
      )}
    </div>
  );
}

function OfferPreview({ cardId }: { cardId: string }) {
  const { interactions, incomingOffer } = useWorkspace();
  const activate = useActivateFeedTarget();
  const [, setPreview] = useWorkspaceUiField("homePreview");
  const card = interactions.find((c) => c.id === cardId);
  if (!card) return null;
  const thread = card.threads[0];
  const run = (action: () => void) => {
    setPreview(null);
    action();
  };
  return (
    <div className="flex flex-col gap-4 px-4 py-4" data-home-detail="offer">
      <KindTag kind="conversation" />
      {thread && <Field label={t("Channel")} value={CHANNEL_NAMES[thread.type as keyof typeof CHANNEL_NAMES] ?? thread.type} />}
      {thread?.preview && <Field label={t("Details")} value={thread.preview} />}
      <OfferActions
        onAccept={() => run(() => activate({ type: "card", cardId }))}
        onDecline={incomingOffer.canDecline ? () => run(() => void incomingOffer.decline(card)) : undefined}
      />
    </div>
  );
}

/** The previewed row's header: its title, and its kind as the subhead. */
export function useFeedPreviewHeader(target: FeedTarget | null): { headerTitle: string; headerSubhead?: string } | null {
  const { interactions } = useWorkspace();
  const snapshot = useScheduleSnapshot();
  if (target?.type === "schedule") {
    // Only while it's still a feed row (offered, scheduled, or completed in History): opened into the rail or
    // declined, it has nothing left to preview.
    const item = snapshot?.items.find((i) => i.id === target.itemId && i.state !== "active" && i.state !== "declined");
    return item ? { headerTitle: item.title, headerSubhead: t(kindLabel(item.kind)) } : null;
  }
  if (target?.type === "card") {
    const card = interactions.find((c) => c.id === target.cardId && c.offered);
    return card ? { headerTitle: card.presentedName ?? card.customerName ?? card.customerId, headerSubhead: t("Waiting for you to accept") } : null;
  }
  return null;
}

export function FeedItemPreview({ target }: { target: FeedTarget }) {
  const snapshot = useScheduleSnapshot();
  if (target.type === "card") return <OfferPreview cardId={target.cardId} />;
  if (target.type !== "schedule") return null;
  const item = snapshot?.items.find((i) => i.id === target.itemId);
  return item ? <ScheduleItemPreview item={item} /> : null;
}
