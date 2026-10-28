// A kind card's close (P-HOME-1h): Return to feed. The item goes back to
// Scheduled and leaves the rail with no outcome; the Outcome is how it's
// completed. On the card's kind row (where a conversation row shows End call
// / Dismiss) and in the kind cell's session row, beside Outcome. Settings →
// Assignments: hidden without "Allow Unassign & Dismiss", the Close confirm
// with "Confirm before closing"; disabled, with the reason, while the card's
// call is live.
import { ActionIconButton } from "@nicecxone/lyra-ui";
import { X } from "lucide-react";
import { scheduleCardKey } from "@/domain";
import { DisabledReason } from "@/contact-handling/DisabledReason";
import { LIVE } from "@/contact-handling/already-open";
import { useScheduleLeg } from "@/contact-handling/home/useScheduleCards";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useScheduleProvider } from "@/provider-context";
import type { ScheduleItem } from "@/providers";
import { t } from "@/i18n";

/** The confirm's title, by kind. */
function returnTitle(item: ScheduleItem): string {
  if (item.kind === "callback") return t("Return this callback to the feed?");
  if (item.kind === "meeting") return t("Return this meeting to the feed?");
  if (item.kind === "training") return t("Return this training to the feed?");
  if (item.kind === "task") return t("Return this task to the feed?");
  return t("Return this assignment to the feed?");
}

export function KindCloseButton({ item }: { item: ScheduleItem }) {
  const { activeInteractionId, assignmentsSettings, confirmDismiss, contactStateById, switchActiveInteraction } = useWorkspace();
  const schedule = useScheduleProvider();
  const [, setStarted] = useWorkspaceUiField("kindStarted");
  const leg = useScheduleLeg(item);
  if (!assignmentsSettings.allowUnassignDismiss) return null;
  const key = scheduleCardKey(item.id);
  const callLive = !!leg?.threads.some((th) => th.type === "voice" && LIVE.has(contactStateById.get(th.providerInteractionId ?? "") ?? ""));
  const close = () =>
    confirmDismiss(() => {
      // Leaving the card resets its picked kind row (useResetKindCellOnLeave).
      if (activeInteractionId === key) switchActiveInteraction(null);
      // Back in the feed unstarted: a later Start / Join starts it again.
      setStarted((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      schedule?.release(item.id).catch((err) => {
        if (import.meta.env.DEV) console.warn("[schedule] release failed", err);
      });
    }, {
      title: returnTitle(item),
      description: t("It goes back to Scheduled and leaves your list. No outcome is recorded."),
      confirmLabel: t("Return to feed"),
    });
  return (
    <DisabledReason reason={callLive ? t("End the call first") : undefined}>
      <ActionIconButton
        title={t("Return to feed")}
        size="xs"
        disabled={callLive}
        data-kind-close=""
        onClick={(e) => {
          e.stopPropagation();
          close();
        }}
      >
        <X className="h-4 w-4" strokeWidth={1.5} />
      </ActionIconButton>
    </DisabledReason>
  );
}
