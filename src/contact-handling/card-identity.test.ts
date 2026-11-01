// P-LAYOUT-F3 7: one avatar rule. `isIdentifiedContact` is true when a name is on file — the card is linked to a
// customer record (stamped or derivable now) — and never for a raw address, whatever the card's display name.
import { describe, expect, it } from "vitest";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import { isIdentifiedContact, isIdentifiedWorkItem, type CardIdentityFacts } from "./card-identity";

const facts: CardIdentityFacts = {
  isDirectoryEntity: (id) => id === "cust-1",
  isCreatedEntity: (id) => id === "created-1",
  isKnownScenario: (id) => id === "maya-chen-refund-call",
};
const card = (over: Partial<NavCard>) => ({ id: "c", customerName: "Someone", threads: [], ...over }) as unknown as NavCard;

describe("isIdentifiedContact", () => {
  it("a card linked to a directory, created, seeded or history record is identified", () => {
    expect(isIdentifiedContact(card({ entityId: "cust-1" }), facts)).toBe(true);
    expect(isIdentifiedContact(card({ entityId: "created-1" }), facts)).toBe(true);
    expect(isIdentifiedContact(card({ entityId: "seed:noah" }), facts)).toBe(true);
    expect(isIdentifiedContact(card({ entityId: "history:42" }), facts)).toBe(true);
  });

  it("a scripted known caller is identified, before and after its identity is stamped", () => {
    expect(isIdentifiedContact(card({ id: "maya-chen-refund-call" }), facts)).toBe(true);
    expect(isIdentifiedContact(card({ id: "other", identity: "scenario" }), facts)).toBe(true);
  });

  it("an unknown number is not identified, though its display name is the number", () => {
    expect(isIdentifiedContact(card({ id: "quickdial:1", customerName: "(212) 555-0177" }), facts)).toBe(false);
    expect(isIdentifiedContact(card({ id: "redial:1", customerName: "(212) 555-0177", entityId: "unknown-9" }), facts)).toBe(false);
  });

  it("a work item is identified by its resolved customer (its own, or one the agent linked), else not", () => {
    expect(isIdentifiedWorkItem({ name: "Maya Chen" })).toBe(true);
    expect(isIdentifiedWorkItem(undefined)).toBe(false);
  });
});
