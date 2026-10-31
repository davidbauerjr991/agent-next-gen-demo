// Home's Active assignments section (P-LAYOUT-F1 B, where placement "none"'s rows above Home went; P-LAYOUT fix (b),
// Dave 2026-10-30): one lyra `InlineNotification` per open assignment, stacked, newest first — its avatar (or the
// kind's icon), the name, its channel or kind chip, its status, and View, which opens it in the main column. An offer
// shows Accept / Decline in View's place. Reads the one card list (`useAssignmentCards`), so kind cards and tasks are
// rows too. Mirrors the rail card (`AssignmentEntryCard`); what it reuses and omits is the mirror table in PLAN
// "P-LAYOUT" (b), under the section since P-LAYOUT-F1.
import type { ReactNode } from "react";
import { Avatar, Button, EmptyState, InlineNotification, Tag, Tooltip } from "@nicecxone/lyra-ui";
import { Inbox } from "lucide-react";
import { t } from "@/i18n";
import { useAssignmentCards, useChannelChipsShown, type AssignmentEntry } from "@/contact-handling/useAssignmentCards";
import { IncomingOfferActions } from "@/contact-handling/IncomingOfferActions";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { CHANNEL_NAMES } from "@/contact-handling/home/channel-names";
import { initialsFor } from "@/components/agent-next-gen-shared-utils";
import { kindIconFor, kindLabel } from "@/components/home/home-kinds";

/** When a conversation arrived: its first leg's start. */
const arrivedAt = (entry: AssignmentEntry) =>
  entry.type === "conversation" ? Math.min(...entry.interaction.threads.map((th) => th.startTick), Infinity) : -Infinity;

/** Newest first: conversations by arrival, latest on top; then the kind cards in the card list's order (a schedule
 *  item has no arrival on the same clock). */
function newestFirst(entries: readonly AssignmentEntry[]): AssignmentEntry[] {
  const conversations = entries.filter((e) => e.type === "conversation").sort((a, b) => arrivedAt(b) - arrivedAt(a));
  return [...conversations, ...entries.filter((e) => e.type === "schedule")];
}

/** The rows in the section's card (home-dashboard frames it), the rail's empty state when nothing is open. */
export function AssignmentInlineRows() {
  const { entries } = useAssignmentCards(false);
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="h-8 w-8" strokeWidth={1.5} />}
        message={t("No active assignments")}
        className="h-auto w-full py-6"
        tone="secondary"
      />
    );
  }
  return (
    <div role="list" aria-label={t("Active assignments")} className="flex flex-col gap-2" data-slot="assignment-inline-rows">
      {newestFirst(entries).map((entry) => (
        <AssignmentInlineRow key={entry.key} entry={entry} />
      ))}
    </div>
  );
}

function AssignmentInlineRow({ entry }: { entry: AssignmentEntry }) {
  const { incomingOffer, setPanelFullScreen, switchActiveInteraction } = useWorkspace();
  const chipShown = useChannelChipsShown("homeSection");
  const open = () => {
    switchActiveInteraction(entry.key);
    setPanelFullScreen(false);
  };

  let name: string;
  let chip: string;
  let status: string;
  let avatar: ReactNode;
  let action: ReactNode;
  if (entry.type === "schedule") {
    const { item } = entry;
    name = item.customer?.name ?? item.title;
    chip = t(kindLabel(item.kind));
    // The card list's schedule items are the active ones (a scheduled offer stays a feed row, its preview's Accept).
    status = t("Open");
    avatar = item.customer ? <Avatar size="xs" initials={initialsFor(name)} /> : <Avatar size="xs" icon={kindIconFor(item.kind)} />;
    action = <ViewButton onClick={open} />;
  } else {
    const { interaction } = entry;
    const current = interaction.threads[interaction.threads.length - 1];
    name = interaction.customerName ?? current?.value ?? "";
    chip = [...new Set(interaction.threads.map((th) => t((CHANNEL_NAMES as Record<string, string>)[th.type] ?? th.type)))].join(" · ");
    status = interaction.offered ? t("Offered") : t(interaction.threadStatuses?.[current?.id ?? ""] ?? "Open");
    avatar = <Avatar size="xs" initials={interaction.customerName ? initialsFor(interaction.customerName) : undefined} />;
    action = interaction.offered ? (
      <IncomingOfferActions
        onAccept={() => void incomingOffer.accept(interaction)}
        onDecline={incomingOffer.canDecline ? () => void incomingOffer.decline(interaction) : undefined}
      />
    ) : (
      <ViewButton onClick={open} />
    );
  }

  return (
    <InlineNotification
      // A list of rows, not live notices: `listitem`, not the variant's `status` region.
      role="listitem"
      variant="info"
      icon={avatar}
      heading={
        <span className="flex min-w-0 items-center gap-2">
          <Tooltip content={name} onlyWhenTruncated>
            <span className="min-w-0 truncate">{name}</span>
          </Tooltip>
          {chipShown && chip && <Tag label={chip} />}
        </span>
      }
      actionPlacement="inline"
      action={action}
      data-slot="assignment-inline-row"
      data-assignment-key={entry.key}
    >
      {status}
    </InlineNotification>
  );
}

function ViewButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      {t("View")}
    </Button>
  );
}
