import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import type { EntityId } from "../../domain";
import type { SimDirectoryEntry } from "./sim-fixtures";

/** Each customer's last contact before the session: the agent UI's Contact
 *  History rows (CONTACT_HISTORY, agent-next-gen-contact-history.tsx), keyed
 *  by the record they point at. Plain data on purpose; `demo-seed.test.ts`
 *  guards against drift. */
const LAST_CONTACTS: Readonly<Record<string, NonNullable<SimDirectoryEntry["lastContact"]>>> = {
  "nathan-cole-history": { channel: "voice", ageMinutes: 8, caseId: "CST-22841", caseStatus: "Resolved", topic: "Account lockout, credentials reset" },
  "priya-shah-history": { channel: "chat", ageMinutes: 34, caseId: "CST-30164", caseStatus: "Resolved", topic: "Duplicate charge dispute, $89.99 refund issued" },
  "omar-farooq-history": { channel: "email", ageMinutes: 120, caseId: "CST-16823", caseStatus: "Resolved", topic: "Plan upgrade confirmation" },
  "lauren-briggs-history": { channel: "voice", ageMinutes: 300, caseId: "CST-27760", caseStatus: "Escalated", topic: "Fraud investigation, 4 suspicious transactions" },
  "mei-tanaka-history": { channel: "chat", ageMinutes: 1440, caseId: "CST-31045", caseStatus: "Resolved", topic: "Shipping delay, replacement dispatched" },
};

/** The demo's customer directory for routing's address match: every record
 *  in the shared customer fixture, with all its phone numbers and its email.
 *  P1's generated databases replace this. */
export const SIM_DEMO_DIRECTORY: readonly SimDirectoryEntry[] = CREATE_NEW_CUSTOMERS.map((customer) => ({
  entityId: customer.id as EntityId,
  name: customer.name,
  phones: [customer.firstPhone, ...customer.phones.map((p) => p.value)],
  emails: customer.emailAddress ? [customer.emailAddress] : [],
  ...(LAST_CONTACTS[customer.id] ? { lastContact: LAST_CONTACTS[customer.id] } : {}),
}));

export const SIM_DEMO_LAST_CONTACT_IDS = Object.keys(LAST_CONTACTS);
