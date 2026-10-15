import { describe, expect, it } from "vitest";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import { pickVoiceBarCall } from "./useVoiceBarCall";

// Which call the voice bar shows (P0.5d.1): the selected card's call, else
// the last one shown, else the live call, else a held one.

type Thread = NavCard["threads"][number];

function card(id: string, voice?: { held?: boolean }): NavCard {
  const threads: Thread[] = [{ id: "chat", type: "chat", startTick: 0, contactId: `${id}-chat` }];
  if (voice) threads.push({ id: "voice", type: "voice", startTick: 0, contactId: `${id}-voice`, heldByAgent: voice.held });
  return { id, interactionId: id, customerId: id, threads } as NavCard;
}

const callOf = (c: NavCard) => c.threads.find((t) => t.type === "voice");
const pickedCard = (cards: NavCard[], activeId: string | null, last?: string) => pickVoiceBarCall(cards, activeId, callOf, last)?.card.id;

describe("pickVoiceBarCall", () => {
  const alice = card("alice", { held: true });
  const bob = card("bob", { held: false });
  const chatOnly = card("carol");

  it("shows the selected card's call, held or live, over the live call elsewhere", () => {
    expect(pickedCard([alice, bob, chatOnly], "alice")).toBe("alice");
    expect(pickedCard([alice, bob, chatOnly], "bob")).toBe("bob");
  });

  it("keeps the last call shown when the selected card has no call", () => {
    expect(pickedCard([alice, bob, chatOnly], "carol", "alice:voice")).toBe("alice");
    expect(pickedCard([alice, bob, chatOnly], null, "alice:voice")).toBe("alice");
  });

  it("falls back to the live call, then to a held one, when the last call is gone", () => {
    expect(pickedCard([alice, bob, chatOnly], "carol", "gone:voice")).toBe("bob");
    expect(pickedCard([alice, chatOnly], "carol", "gone:voice")).toBe("alice");
  });

  it("shows nothing when there's no call", () => {
    expect(pickedCard([chatOnly], "carol", "alice:voice")).toBeUndefined();
  });
});
