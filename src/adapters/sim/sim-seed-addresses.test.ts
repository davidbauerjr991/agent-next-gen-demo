// @vitest-environment jsdom
// (jsdom: Contact History's module loads lyra's barrel, which the node environment can't resolve; see Known gaps.)
// Seeds don't share addresses (CLAUDE.md, the 1h–1m retro): every seeded
// schedule item of every persona, every scenario contact, every demo seed
// contact and every seeded Contact History row is checked together. No two customers share a phone number or an
// email; a seed that names a directory record uses only that record's
// addresses; and an address with no record of its own is on no directory
// record (Priya's callback once carried Maya Chen's scenario number, so a dial
// to Priya matched Maya's call; P-HOME-1m).
import { describe, expect, it } from "vitest";
import { normalizePhone, type EpochMs } from "../../domain";
import type { ScheduleRole } from "../../providers";
import { SCENARIOS } from "../../scenarios";
import { SIM_DEMO_DIRECTORY } from "./sim-demo-directory";
import { SIM_DEMO_SEED } from "./sim-fixtures";
import { seedScheduleDay } from "./sim-schedule-seeds";
import { buildContactHistory } from "../../components/agent-next-gen-contact-history";

const ROLES: readonly ScheduleRole[] = ["agent", "supervisor", "sales"];

/** One seeded customer: who it is (its directory record, else its own key), where it came from, and its addresses. */
interface SeededContact {
  source: string;
  owner: string;
  recordId?: string;
  phones: string[];
  emails: string[];
}

const present = (values: readonly (string | undefined)[]) => values.filter((v): v is string => !!v);

function seededContacts(): SeededContact[] {
  const inDirectory = new Set<string>(SIM_DEMO_DIRECTORY.map((r) => r.entityId));
  const contacts: SeededContact[] = [];
  for (const role of ROLES) {
    for (const item of seedScheduleDay(role, 0 as EpochMs)) {
      const detailPhone = "phone" in item.detail ? (item.detail as { phone?: string }).phone : undefined;
      const phones = present([item.customer?.phone, detailPhone]);
      if (!item.customer && phones.length === 0) continue;
      contacts.push({
        source: `${role} seed ${item.id}`,
        owner: item.customer?.entityId ?? item.customer?.name ?? item.id,
        recordId: item.customer?.entityId,
        phones,
        emails: [],
      });
    }
  }
  for (const script of SCENARIOS) {
    const { entity } = script;
    contacts.push({
      source: `scenario ${script.id}`,
      owner: entity.directoryId ?? entity.key,
      recordId: entity.directoryId,
      phones: present([entity.phone]),
      emails: present([entity.email]),
    });
  }
  for (const seed of SIM_DEMO_SEED) {
    const isEmail = !!seed.address?.includes("@");
    contacts.push({
      source: `demo seed ${seed.id}`,
      owner: seed.entityId ?? seed.id,
      // Today's demo seeds are their own pseudo-entities (`seed:<name>`); one that names a real record is checked against it.
      recordId: seed.entityId && inDirectory.has(seed.entityId) ? seed.entityId : undefined,
      phones: seed.address && !isEmail ? [seed.address] : [],
      emails: seed.address && isEmail ? [seed.address] : [],
    });
  }
  // Contact History's seeded rows (nothing dismissed yet): a row with a record is that record; an unknown caller's
  // row (no entityId) is its own case and keeps its raw number.
  for (const entry of buildContactHistory([])) {
    contacts.push({
      source: `contact history ${entry.id}`,
      owner: entry.entityId ?? `history:${entry.caseId}`,
      recordId: entry.entityId,
      phones: present([entry.phone]),
      emails: present([entry.email]),
    });
  }
  return contacts;
}

const phoneKey = (phone: string) => `phone:${normalizePhone(phone)}`;
const emailKey = (email: string) => `email:${email.trim().toLowerCase()}`;
const keysOf = (c: { phones: readonly string[]; emails: readonly string[] }) => [...c.phones.map(phoneKey), ...c.emails.map(emailKey)];

describe("seeded addresses", () => {
  const contacts = seededContacts();
  const directory = new Map(SIM_DEMO_DIRECTORY.map((r) => [r.entityId as string, r]));

  it("covers every persona's schedule seeds, every scenario and the demo seeds", () => {
    for (const role of ROLES) expect(contacts.some((c) => c.source.startsWith(`${role} seed`))).toBe(true);
    expect(contacts.filter((c) => c.source.startsWith("scenario")).length).toBe(SCENARIOS.length);
    expect(contacts.filter((c) => c.source.startsWith("demo seed")).length).toBe(SIM_DEMO_SEED.length);
    expect(contacts.filter((c) => c.source.startsWith("contact history")).length).toBe(buildContactHistory([]).length);
  });

  it("every seeded Contact History row resolves to its directory record (entityId)", () => {
    expect(buildContactHistory([]).filter((entry) => !entry.entityId || !directory.has(entry.entityId)).map((entry) => entry.id)).toEqual([]);
  });

  it("no two customers share a phone number or an email", () => {
    const owners = new Map<string, Set<string>>();
    for (const contact of contacts) {
      for (const key of keysOf(contact)) owners.set(key, (owners.get(key) ?? new Set()).add(contact.owner));
    }
    const shared = [...owners].filter(([, who]) => who.size > 1).map(([key, who]) => `${key}: ${[...who].join(", ")}`);
    expect(shared).toEqual([]);
  });

  it("a seed that names a directory record resolves to it and uses only that record's addresses", () => {
    const wrong: string[] = [];
    for (const contact of contacts.filter((c) => c.recordId)) {
      const record = directory.get(contact.recordId!);
      if (!record) {
        wrong.push(`${contact.source}: no directory record ${contact.recordId}`);
        continue;
      }
      const own = new Set(keysOf({ phones: [...record.phones], emails: [...record.emails] }));
      for (const key of keysOf(contact)) if (!own.has(key)) wrong.push(`${contact.source}: ${key} isn't on ${contact.recordId}`);
    }
    expect(wrong).toEqual([]);
  });

  it("an address with no record of its own is on no directory record (it would resolve to someone else)", () => {
    const recordOf = new Map<string, string>();
    for (const record of SIM_DEMO_DIRECTORY) for (const key of keysOf({ phones: [...record.phones], emails: [...record.emails] })) recordOf.set(key, record.entityId);
    const stray = contacts
      .filter((c) => !c.recordId)
      .flatMap((c) => keysOf(c).filter((key) => recordOf.has(key)).map((key) => `${c.source}: ${key} is ${recordOf.get(key)}'s`));
    expect(stray).toEqual([]);
  });
});
