import type { Interaction, Thread } from "@/components/agent-next-gen-interaction-dashboard";

/** A thread's stable key on its card (`Thread.id`, else its type). */
export const threadKeyOf = (thread: Thread): string => thread.id ?? thread.type;

/** A draft (P-AIFIRST (k6) 9): an agent-initiated digital thread with nothing
 *  sent yet. The nav row shows its delete icon and the session row "Discard
 *  draft" (no Outcome, Transfer or status pill); once the agent sends a
 *  message it's a live thread on both. A call is never a draft. An outbound
 *  email is one too (E2) until its temporary Send (`draftSent`; P-PARKED's
 *  composer replaces it). One derivation, read by the nav card and the
 *  session row in every mode. */
export function isDraftThread(interaction: Pick<Interaction, "liveMessages">, thread: Thread | undefined): boolean {
  if (!thread || thread.type === "voice" || !thread.startedFresh || thread.draftSent) return false;
  return !(interaction.liveMessages?.[threadKeyOf(thread)] ?? []).some((m) => m.sender === "agent");
}

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
