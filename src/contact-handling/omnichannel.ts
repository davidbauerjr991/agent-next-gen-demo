// Omnichannel layout (P0.5d.2, PLAN.md "Omnichannel layout"; Settings →
// Assignments → Omnichannel layout). Channels split by tempo: sync channels
// (voice, chat) live in the main column, async ones (email, SMS, WhatsApp)
// open in a slide-out over the right side. Voice has no content view of its
// own: it's the voice bar, and only fills the main column when the card has
// no chat. An async thread fills the main column when the card has no sync
// channel at all. (WhatsApp is always async here; "sync while the customer
// is replying" is a P2.2 refinement.)
import type { ChannelType } from "@nicecxone/lyra-ui";
import type { Thread } from "@/components/agent-next-gen-interaction-dashboard";
import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";
import { threadKeyOf } from "./channel-thread";

/** Where conversation threads open: "main" is the tempo rule below; "panel"
 *  (AI display "main", the AI-first layout) puts every thread in the panel. */
export type ConversationPlacement = "main" | "panel";

export type ChannelTempo = "sync" | "async";
/** Where a channel shows: the main column, only the voice bar, or the slide-out. */
export type ChannelRoute = "main" | "bar" | "slideout";

export const channelTempo = (type: ChannelType): ChannelTempo => (type === "voice" || type === "chat" ? "sync" : "async");

/** The card's main-column thread: its chat, else its call, else its first async thread. */
export function mainThreadKey(threads: readonly Thread[]): string | undefined {
  const pick = threads.find((t) => t.type === "chat") ?? threads.find((t) => t.type === "voice") ?? threads[0];
  return pick ? threadKeyOf(pick) : undefined;
}

/** Where activating `key` on a card with these threads puts it. With
 *  placement "panel" (AI display "main", AI-first, P-AIFIRST) no thread takes the
 *  main column: voice is the bar and every other thread opens in the panel. */
export function routeChannel(threads: readonly Thread[], key: string, placement: ConversationPlacement = "main"): ChannelRoute {
  const thread = threads.find((t) => threadKeyOf(t) === key);
  if (placement === "panel") return thread?.type === "voice" ? "bar" : "slideout";
  if (!thread) return "main";
  if (thread.type === "chat") return "main";
  if (thread.type === "voice") return threads.some((t) => t.type === "chat") ? "bar" : "main";
  return threads.some((t) => channelTempo(t.type) === "sync") ? "slideout" : "main";
}

/** The main column's thread: the requested one if it belongs there, else the
 *  card's main thread. (With placement "panel" the main column is the AI
 *  workspace, and this is only the card's context thread: the one the record
 *  header, Outcome and Copilot follow.) */
export function omnichannelMainKey(threads: readonly Thread[], requested: string | undefined, pinned?: string): string | undefined {
  // A pinned main thread (`useMainPins`: an auto-accepted chat joined the
  // card) stays main while the card still has it.
  if (pinned !== undefined && threads.some((t) => threadKeyOf(t) === pinned)) return pinned;
  return requested !== undefined && routeChannel(threads, requested) === "main" ? requested : mainThreadKey(threads);
}

/** With placement "panel": the thread the panel shows before the agent
 *  picks one — the card's chat, else its first thread that isn't voice. */
export function panelDefaultKey(threads: readonly Thread[]): string | undefined {
  const pick = threads.find((t) => t.type === "chat") ?? threads.find((t) => t.type !== "voice");
  return pick ? threadKeyOf(pick) : undefined;
}

/** The record header's toggle group: one entry per channel on the card, in
 *  order of first appearance, never one per thread. `thread` is the
 *  channel's most recent thread (what the icon selects); `count` how many
 *  threads the channel has (a badge when more than one; the nav rows switch
 *  between them, and a thread picker arrives with P2.2/P-PARKED); `keys`
 *  every thread of the channel (any selected selects the icon). */
export function channelHeaderEntries(threads: readonly Thread[]): { thread: Thread; count: number; keys: string[] }[] {
  const byType = new Map<Thread["type"], Thread[]>();
  for (const t of threads) byType.set(t.type, [...(byType.get(t.type) ?? []), t]);
  return [...byType.values()].map((group) => ({
    thread: group.reduce((latest, t) => ((t.startTick ?? 0) >= (latest.startTick ?? 0) ? t : latest)),
    count: group.length,
    keys: group.map(threadKeyOf),
  }));
}

/** Customer messages on a thread (its live messages until P2.2). */
export const customerMessageCount = (messages: readonly TranscriptMessage[] | undefined): number =>
  messages?.filter((m) => m.sender === "customer").length ?? 0;
