// A schedule item's Park, Unpark and Delete (P-HOME-1k), on a feed row's
// hover cluster and in its preview. Park sets it aside (out of the feed and
// the rail, no due) until Unpark returns it at its original due, or now if
// that has passed. Delete is only for an item the agent created
// (`deletable`), after a confirm; anything else has no Delete (it parks
// instead): hidden, never greyed.
import { useState } from "react";
import { ActionIconButton } from "@nicecxone/lyra-ui";
import { ArchiveRestore, Archive, Trash2 } from "lucide-react";
import { ConfirmCloseDialog } from "@/contact-handling/ConfirmCloseDialog";
import { useScheduleProvider } from "@/provider-context";
import type { ScheduleItem } from "@/providers";
import { t } from "@/i18n";
import { kindNoun } from "./home-kinds";

type Item = Pick<ScheduleItem, "id" | "kind" | "state" | "deletable">;

const warn = (what: string) => (err: unknown) => {
  if (import.meta.env.DEV) console.warn(`[schedule] ${what} failed`, err);
};

/** The item's actions as icons, left of its kind chip on a row and in the preview (P-HOME-1m). `after` runs once one
 *  is chosen. */
export function FeedRowActions({ item, after }: { item: Item; after?: () => void }) {
  const schedule = useScheduleProvider();
  const [confirming, setConfirming] = useState(false);
  if (!schedule) return null;
  const noun = kindNoun(item.kind);
  const run = (action: () => Promise<void>, what: string) => {
    after?.();
    action().catch(warn(what));
  };
  const actions: { key: string; label: string; icon: typeof Archive; onClick: () => void }[] = [];
  if (item.state === "scheduled") {
    actions.push({ key: "park", label: t("Park this {kind}", { kind: noun }), icon: Archive, onClick: () => run(() => schedule.park(item.id), "park") });
  }
  if (item.state === "parked") {
    actions.push({ key: "unpark", label: t("Unpark"), icon: ArchiveRestore, onClick: () => run(() => schedule.unpark(item.id), "unpark") });
  }
  if (item.deletable && (item.state === "scheduled" || item.state === "parked")) {
    actions.push({ key: "delete", label: t("Delete this {kind}", { kind: noun }), icon: Trash2, onClick: () => setConfirming(true) });
  }
  if (actions.length === 0) return null;
  return (
    <span className="flex items-center gap-2" data-feed-row-actions="" onClick={(e) => e.stopPropagation()}>
      {actions.map(({ key, label, icon: Icon, onClick }) => (
        <ActionIconButton key={key} size="xs" title={label} data-feed-action={key} onClick={onClick}>
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </ActionIconButton>
      ))}
      <ConfirmCloseDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          run(() => schedule.remove(item.id), "remove");
        }}
        copy={{
          title: t("Delete this {kind}?", { kind: noun }),
          description: t("It won't come back."),
          confirmLabel: t("Delete"),
        }}
      />
    </span>
  );
}
