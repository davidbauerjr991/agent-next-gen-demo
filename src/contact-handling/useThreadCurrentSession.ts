import { useMemo } from "react";
import type { Interaction, Thread } from "@/components/agent-next-gen-interaction-dashboard";
import { currentSessionOf } from "@/components/transcript/transcript-sessions";
import type { TranscriptSession } from "@/components/transcript/transcript-types";

/** The current session of the thread Contact Details' Session tab shows
 *  (P-EXTRACT, Bug 1), derived from what that thread's session row renders:
 *  the panel header's row (`fromPanelRow`: no reopens, the thread's own
 *  status) or the main tab's transcript. It used to be reported up by the
 *  mounted transcript, which under AI display "main" needed a hidden copy of
 *  the main column's. Memoized on the thread's identity and status, so a fresh
 *  launch's synthesized date stays the one first shown. */
export function useThreadCurrentSession({
  interaction,
  thread,
  threadKey,
  fromPanelRow,
  mainStatus,
}: {
  interaction: Interaction | null | undefined;
  thread: Thread | undefined;
  /** `${cardId}:${threadKey}`: which thread this is. */
  threadKey: string;
  fromPanelRow: boolean;
  /** The main tab's status (the transcript's `currentStatus`). */
  mainStatus: string | undefined;
}): TranscriptSession | null {
  const status = fromPanelRow ? thread && interaction?.threadStatuses?.[thread.id ?? thread.type] : mainStatus;
  const reopened = fromPanelRow ? undefined : thread?.reopenedContacts;
  return useMemo(
    () =>
      interaction
        ? currentSessionOf({
            channelType: thread?.type,
            isFreshLaunch: !!thread?.startedFresh,
            contactId: thread?.contactId ?? interaction.customerId,
            channelAddressLabel: thread?.addressLabel,
            skillLabel: thread?.preview,
            reopenedContacts: reopened,
            currentStatus: status,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [threadKey, thread?.type, thread?.startedFresh, thread?.contactId, thread?.addressLabel, thread?.preview, reopened?.length, status],
  );
}
