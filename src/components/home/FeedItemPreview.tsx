// An Assignments row's preview (P-HOME-1h), in Home's detail panel where a
// Contact History entry's opens: the item's title, kind, due, source, the
// seed's detail and its customer, with one primary action that does what the
// row's click did before (it moves to the rail and becomes active). P-HOME-1i:
// that's Open, the secondary on every one, beside the kind's own action as
// the primary (Dial / Start / Join), which does the thing. An offer keeps
// Accept and Decline. A completed item (a History row) has no action.
import { Button, MenuItem, Tag } from "@nicecxone/lyra-ui";
import { Check, X } from "lucide-react";
import type { FeedTarget } from "@/contact-handling/home/activity-feed";
import { feedTimeLabel } from "@/contact-handling/home/time";
import { useActivateFeedTarget } from "@/contact-handling/home/useActivityFeed";
import { useScheduleDial, useStartScheduleItem } from "@/contact-handling/home/useScheduleCalls";
import { DisabledReason } from "@/contact-handling/DisabledReason";
import { UNAVAILABLE_CALL_TOOLTIP, useAgentAvailable } from "@/contact-handling/presence-gates";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useScheduleProvider, useScheduleSnapshot } from "@/provider-context";
import type { ScheduleItem } from "@/providers";
import { t } from "@/i18n";
import { CHANNEL_NAMES } from "@/contact-handling/home/channel-names";
import { FeedRowActions } from "./FeedRowActions";
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

/** The kind's own action (P-HOME-1i), the preview's primary: it does the thing — a callback's Dial (the dial pad
 *  beneath it; confirming opens the item and places the call as its voice leg), a training's Start, a meeting's Join.
 *  None for the other kinds: Open is then the only action. Open, beside it, only opens. */
function KindAction({ item, run }: { item: ScheduleItem; run: (action: () => void) => void }) {
  const dial = useScheduleDial();
  const start = useStartScheduleItem();
  const available = useAgentAvailable();
  const d = item.detail;
  if (d.kind === "callback") {
    return (
      <DisabledReason reason={available ? undefined : UNAVAILABLE_CALL_TOOLTIP}>
        <Button disabled={!available} data-preview-primary="" onClick={(e) => dial(item, e.currentTarget, { openFirst: true })}>
          {t("Dial")}
        </Button>
      </DisabledReason>
    );
  }
  if (d.kind === "training" || d.kind === "meeting") {
    return (
      <Button data-preview-primary="" onClick={() => run(() => start(item))}>
        {d.kind === "meeting" ? t("Join") : t("Start")}
      </Button>
    );
  }
  return null;
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
      {/* Park / Unpark / Delete as on the row: the icons left of the kind's chip (P-HOME-1m). */}
      <div className="flex flex-wrap items-center gap-2">
        <FeedRowActions item={item} after={() => setPreview(null)} />
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
        (item.state === "scheduled" || item.state === "parked") && (
          // The kind's action is the primary; Open, the secondary, moves it to the rail and makes it active, nothing
          // else. A parked item keeps both (P-HOME-1m): opening it unparks it on the way (Unpark alone is its icon).
          <div className="flex flex-wrap items-center gap-2">
            <KindAction item={item} run={run} />
            <Button variant="outline" onClick={() => run(() => activate(target))} data-preview-open="">
              {t("Open")}
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
