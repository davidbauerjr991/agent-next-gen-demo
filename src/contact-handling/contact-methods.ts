import { useSyncExternalStore } from "react";
import type { CustomerAddresses } from "./already-open";

// Addresses the agent added to a customer's contact methods (P-AIFIRST (k8)
// 8). The seam is `linkContactMethod`; until P1.4 the CustomerDataProvider
// is a placeholder, so they live here, keyed by entity id, for the page's
// lifetime only (lost on reload). P1.4 swaps `linkContactMethod` for the
// provider's and reads the record from it instead of `withLinkedContactMethods`.

export type ContactMethodKind = "phone" | "email";

interface Linked {
  phones: string[];
  emails: string[];
}

let linked = new Map<string, Linked>();
/** Save-address offers already answered (message id → the answer). */
let answered = new Map<string, "added" | "dismissed">();
let version = 0;
const listeners = new Set<() => void>();

function changed() {
  version += 1;
  for (const listener of listeners) listener();
}

/** Adds an address to the customer's contact methods. */
export function linkContactMethod(entityId: string, kind: ContactMethodKind, value: string) {
  const entry = linked.get(entityId) ?? { phones: [], emails: [] };
  const list = kind === "phone" ? entry.phones : entry.emails;
  if (list.includes(value)) return;
  linked.set(entityId, kind === "phone" ? { ...entry, phones: [...list, value] } : { ...entry, emails: [...list, value] });
  changed();
}

/** The addresses added to a customer, by channel (phones for every phone channel). */
export function linkedAddresses(entityId: string | undefined, channel: string): string[] {
  const extra = entityId ? linked.get(entityId) : undefined;
  if (!extra) return [];
  return channel === "email" ? extra.emails : extra.phones;
}

/** A directory record with the addresses added since (phones after the
 *  record's own; an added email when the record has none). */
export function withLinkedContactMethods<R extends CustomerAddresses>(entityId: string | undefined, record: R | undefined): R | undefined {
  const extra = entityId ? linked.get(entityId) : undefined;
  if (!extra) return record;
  const own = record?.phones ?? (record?.firstPhone ? [{ value: record.firstPhone }] : []);
  return {
    ...(record ?? ({} as R)),
    phones: [...own, ...extra.phones.map((value) => ({ value }))],
    ...(record?.emailAddress || extra.emails.length === 0 ? {} : { emailAddress: extra.emails[0] }),
  };
}

/** Whether `value` is one of the customer's addresses, added ones included. */
export function isKnownAddress(entityId: string, record: CustomerAddresses | undefined, value: string): boolean {
  const full = withLinkedContactMethods(entityId, record);
  const digits = (s: string) => s.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  const target = digits(value);
  if (full?.emailAddress && full.emailAddress.toLowerCase() === value.trim().toLowerCase()) return true;
  const phones = [...(full?.phones?.map((p) => p.value) ?? []), ...(full?.firstPhone ? [full.firstPhone] : [])];
  return target !== "" && phones.some((p) => digits(p) === target);
}

export function answerSaveAddressOffer(messageId: string, answer: "added" | "dismissed") {
  answered.set(messageId, answer);
  changed();
}

export function saveAddressOfferAnswer(messageId: string): "added" | "dismissed" | undefined {
  return answered.get(messageId);
}

/** Re-renders on any change (an added address, an answered offer). */
export function useContactMethodsVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );
}

export function resetContactMethodsForTests() {
  linked = new Map();
  answered = new Map();
  changed();
}
