// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  CONTACT_HISTORY,
  EXTENDED_CONTACT_HISTORY,
  contactHistoryDisplayIdentity,
  type ContactHistoryEntry,
} from "@/components/agent-next-gen-contact-history";
import { addressOptionsForChannel, customerChannelAddress } from "@/components/agent-next-gen-customers-table";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { knownOrSynthesizedAddress } from "./contact-identity";
import { markAlreadyOpen } from "./already-open";

// E4: WhatsApp reaches a phone number, not a handle (WhatsApp Business routes by number). A WhatsApp
// thread's address is the customer's phone number, in the format voice and SMS use.

const isPhone = (s: string | undefined) => !!s && !s.includes("@") && /\d{3}.*\d{4}/.test(s);
const SEEDED: ContactHistoryEntry[] = [...CONTACT_HISTORY, ...EXTENDED_CONTACT_HISTORY];

describe("E4: WhatsApp addresses are phone numbers", () => {
  it("seeded Contact History rows carry no @handle; a WhatsApp reopen or redial gets the row's number", () => {
    for (const row of SEEDED) {
      expect(JSON.stringify(row), row.name).not.toMatch(/"@[A-Z]/);
      const whatsapp = knownOrSynthesizedAddress(row, "whatsapp");
      expect(isPhone(whatsapp), `${row.name}: ${whatsapp}`).toBe(true);
      if (row.phone) expect(whatsapp).toBe(row.phone);
    }
  });

  it("a row with no number on file synthesizes the same number for WhatsApp as for SMS and voice", () => {
    const row = { ...SEEDED[0], phone: undefined, caseId: "CASE-E4", name: "Dana Reyes" } as ContactHistoryEntry;
    const whatsapp = knownOrSynthesizedAddress(row, "whatsapp");
    expect(isPhone(whatsapp)).toBe(true);
    expect(whatsapp).toBe(knownOrSynthesizedAddress(row, "sms"));
    expect(whatsapp).toBe(knownOrSynthesizedAddress(row, "voice"));
  });

  it("a WhatsApp row's display identity is its number", () => {
    const row = { ...SEEDED[0], channelType: "whatsapp", phone: "(212) 555-0193" } as ContactHistoryEntry;
    expect(contactHistoryDisplayIdentity(row)).toMatch(/212.*555.*0193/);
  });

  it("the Customers table's WhatsApp field is Select Phone over the customer's own numbers only", () => {
    const record = CREATE_NEW_CUSTOMERS.find((c) => c.channels.includes("whatsapp") && new Set(c.phones.map((p) => p.value)).size >= 2)!;
    const row = { contactNumber: record.customerId, firstPhone: record.firstPhone, emailAddress: record.emailAddress, firstName: record.firstName, lastName: record.lastName } as Parameters<typeof customerChannelAddress>[0];
    expect(customerChannelAddress(row, "whatsapp").label).toBe("Select Phone");
    const values = addressOptionsForChannel(row, "whatsapp").map((o) => o.value);
    expect(values.sort()).toEqual([...new Set(record.phones.map((p) => p.value))].sort());
    expect(values.every(isPhone)).toBe(true);
  });

  it("a channel open on every address marks no @handle open", () => {
    const contact: Parameters<typeof markAlreadyOpen>[0] = { id: "x", name: "Alex Miller", email: "alex@example.com", primaryPhone: { value: "(200) 200-1000" } };
    const tagged = markAlreadyOpen(contact, { whatsapp: "Already open" }, []);
    expect(tagged.openChannelAddresses?.whatsapp).toEqual(["(200) 200-1000", "alex@example.com"]);
  });
});
