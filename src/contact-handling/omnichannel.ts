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

export type ChannelTempo = "sync" | "async";
/** Where a channel shows: the main column, only the voice bar, or the slide-out. */
export type ChannelRoute = "main" | "bar" | "slideout";

export const channelTempo = (type: ChannelType): ChannelTempo => (type === "voice" || type === "chat" ? "sync" : "async");

/** The card's main-column thread: its chat, else its call, else its first async thread. */
export function mainThreadKey(threads: readonly Thread[]): string | undefined {
  const pick = threads.find((t) => t.type === "chat") ?? threads.find((t) => t.type === "voice") ?? threads[0];
  return pick ? threadKeyOf(pick) : undefined;
}

/** Where activating `key` on a card with these threads puts it. */
export function routeChannel(threads: readonly Thread[], key: string): ChannelRoute {
  const thread = threads.find((t) => threadKeyOf(t) === key);
  if (!thread) return "main";
  if (thread.type === "chat") return "main";
  if (thread.type === "voice") return threads.some((t) => t.type === "chat") ? "bar" : "main";
  return threads.some((t) => channelTempo(t.type) === "sync") ? "slideout" : "main";
}

/** The main column's thread: the requested one if it belongs there, else the card's main thread. */
export function omnichannelMainKey(threads: readonly Thread[], requested: string | undefined): string | undefined {
  return requested !== undefined && routeChannel(threads, requested) === "main" ? requested : mainThreadKey(threads);
}

/** Customer messages on a thread (its live messages until P2.2). */
export const customerMessageCount = (messages: readonly TranscriptMessage[] | undefined): number =>
  messages?.filter((m) => m.sender === "customer").length ?? 0;
