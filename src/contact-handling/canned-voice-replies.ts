import { useCallback, useEffect, useRef } from "react";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import { simVoiceCustomerLines } from "@/adapters/sim/sim-auto-replies";
import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";
import { timeLabel } from "@/components/ai-cards/ai-card-icon";
import { initialsFor } from "@/components/agent-next-gen-shared-utils";
import { useInteractions } from "@/provider-context";

// An unscripted call's canned caller (P-CANVAS), page-side like unscripted
// chat's faked replies (`handleSendMessage`): after each Next Best Action the
// agent answers (a Used/Dismissed row), and on a pause with nothing to
// suggest (`useNbaPause`'s `onQuietPause`), the caller says the next line
// from the skill's pool 1.5–3s later, as a customer row in the thread. A new
// row is a turn, so it restarts the pause clock. Once the pool is used up
// the caller goes quiet. P2.2 moves this to the sim customer; TTS waits for
// Phase 3.

type Cards = readonly NavCard[];
type SetCards = (update: (prev: NavCard[]) => NavCard[]) => void;

const MIN_DELAY_MS = 1500;
const MAX_DELAY_MS = 3000;

/** Mounted once, by the workspace controller. Returns the quiet-pause handler for `useNbaPause`. */
export function useCannedVoiceReplies(cards: Cards, setCards: SetCards, scriptedContactIds: ReadonlySet<string>) {
  const contacts = useInteractions();
  const latest = useRef({ cards, contacts, scriptedContactIds });
  latest.current = { cards, contacts, scriptedContactIds };
  /** Per contact: lines said so far, and the pending line's timer. */
  const said = useRef(new Map<string, number>());
  const pending = useRef(new Map<string, number>());
  /** Per contact: answered suggestions seen so far. */
  const answered = useRef(new Map<string, number>());

  /** The live unscripted call `contactId` is, and where its thread is. */
  const locateCall = (contactId: string) => {
    const { cards: now, contacts: live, scriptedContactIds: scripted } = latest.current;
    const contact = live.find((c) => c.id === contactId);
    if (!contact || contact.channel !== "voice" || contact.state !== "active" || scripted.has(contactId)) return undefined;
    for (const card of now) {
      const thread = card.threads.find((t) => t.providerInteractionId === contactId);
      if (thread) return { card, threadKey: thread.id ?? thread.type, contact };
    }
    return undefined;
  };

  const speakSoon = useCallback(
    (contactId: string) => {
      const call = locateCall(contactId);
      if (!call || pending.current.has(contactId)) return;
      const lines = simVoiceCustomerLines(call.contact.skill?.id);
      if ((said.current.get(contactId) ?? 0) >= lines.length) return;
      const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
      pending.current.set(
        contactId,
        window.setTimeout(() => {
          pending.current.delete(contactId);
          const where = locateCall(contactId);
          const index = said.current.get(contactId) ?? 0;
          const text = lines[index];
          if (!where || text === undefined) return;
          said.current.set(contactId, index + 1);
          const name = where.card.customerName ?? "Customer";
          const message: TranscriptMessage = {
            id: `canned-${contactId}-${index}`,
            sender: "customer",
            name,
            initials: initialsFor(name),
            timestamp: timeLabel(Date.now()),
            text,
          };
          setCards((prev) =>
            prev.map((c) =>
              c.id === where.card.id
                ? { ...c, liveMessages: { ...c.liveMessages, [where.threadKey]: [...(c.liveMessages?.[where.threadKey] ?? []), message] } }
                : c,
            ),
          );
        }, delay),
      );
    },
    // `locateCall` reads `latest`; `setCards` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setCards],
  );

  // Each newly answered suggestion on a call gets the caller's next line.
  useEffect(() => {
    for (const card of cards) {
      for (const thread of card.threads) {
        const contactId = thread.providerInteractionId;
        if (!contactId || thread.type !== "voice") continue;
        const count = (card.liveMessages?.[thread.id ?? thread.type] ?? []).filter((m) => m.nbaOutcome).length;
        const seen = answered.current.get(contactId) ?? 0;
        answered.current.set(contactId, count);
        if (count > seen) speakSoon(contactId);
      }
    }
  }, [cards, speakSoon]);

  useEffect(() => {
    const timers = pending.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
    };
  }, []);

  return speakSoon;
}
