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

export function KindCloseButton({ item }: { item: ScheduleItem }) {
  const { activeInteractionId, assignmentsSettings, confirmDismiss, contactStateById, switchActiveInteraction } = useWorkspace();
  const schedule = useScheduleProvider();
  const [kindCellShownFor, setKindCellShownFor] = useWorkspaceUiField("kindCellShownFor");
  const leg = useScheduleLeg(item);
  if (!assignmentsSettings.allowUnassignDismiss) return null;
  const key = scheduleCardKey(item.id);
  const callLive = !!leg?.threads.some((th) => th.type === "voice" && LIVE.has(contactStateById.get(th.providerInteractionId ?? "") ?? ""));
  const close = () =>
    confirmDismiss(() => {
      if (activeInteractionId === key) switchActiveInteraction(null);
      if (kindCellShownFor === key) setKindCellShownFor(null);
      schedule?.release(item.id).catch((err) => {
        if (import.meta.env.DEV) console.warn("[schedule] release failed", err);
      });
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
