import type { Interaction, Thread } from "@/components/agent-next-gen-interaction-dashboard";

/** A thread's stable key on its card (`Thread.id`, else its type). */
export const threadKeyOf = (thread: Thread): string => thread.id ?? thread.type;

/** Whether a thread shown outside the main column gets a composer: not email
 *  (no email UI yet), not voice (a call's transcript has none), and not once
 *  the interaction or this thread is closed. */
export function threadAcceptsReplies(interaction: Interaction, thread: Thread): boolean {
  return (
    thread.type !== "email" &&
    thread.type !== "voice" &&
    !interaction.closed &&
    interaction.threadStatuses?.[threadKeyOf(thread)] !== "Closed"
  );
}
