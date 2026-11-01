// @vitest-environment jsdom
// (jsdom: lyra's barrel, for getHoldSeverity, doesn't load in node — PROGRESS Known gaps, lyra's local install.)
// P-LAYOUT-F2 8: a nav card re-renders on the page clock only when `cardTimeTiers` changes, so the key has to change
// whenever a tier the card shows does — an offered card's answer SLA, a reply's awaiting tier, a hold's — and not on
// the ticks in between.
import { describe, expect, it } from "vitest";
import type { Interaction } from "@/components/agent-next-gen-interaction-dashboard";
import { cardTimeTiers } from "./nav-card-ticks";

const SLA = { warningSeconds: 10, criticalSeconds: 20 };
type Card = Pick<Interaction, "offered" | "threads">;
const card = (offered: boolean, thread: Partial<Interaction["threads"][number]>): Card =>
  ({ offered, threads: [{ id: "t1", type: "voice", startTick: 0, ...thread }] }) as Card;

/** The ticks in [from, to) where the key changes. */
const changes = (c: Card, from: number, to: number) => {
  const at: number[] = [];
  for (let t = from + 1; t < to; t++) if (cardTimeTiers(c, t, SLA) !== cardTimeTiers(c, t - 1, SLA)) at.push(t);
  return at;
};

describe("cardTimeTiers", () => {
  it("an offered card: changes exactly at the answer SLA's warning and critical", () => {
    expect(changes(card(true, {}), 0, 40)).toEqual([10, 20]);
  });

  it("an awaiting reply: changes exactly at 5 and 10 minutes since the customer last wrote", () => {
    expect(changes(card(false, { type: "chat", awaitingResponse: true, lastCustomerMessageTick: 100 }), 100, 800)).toEqual([400, 700]);
  });

  it("a hold: changes exactly at 15 s and 30 s on hold", () => {
    expect(changes(card(false, { heldSinceTick: 50 }), 50, 120)).toEqual([65, 80]);
  });

  it("nothing timed (answered, not awaiting, not held): never changes", () => {
    expect(changes(card(false, { type: "chat" }), 0, 2000)).toEqual([]);
  });
});
