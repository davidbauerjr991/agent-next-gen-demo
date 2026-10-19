import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import { buildCustomerInfoFields } from "@/components/customer-info/customer-info-seed";
import { customerChannelAddresses, type CustomerAddresses } from "./already-open";
import { linkedAddresses } from "./contact-methods";

// A card's contact methods (E2): one source for the "+" picker and the save-address offer, the same
// addresses Contact Details renders. A card with a record (directory, or created this session) reads the
// record; a known card without one (a scripted case, a history contact) reads what Contact Details shows for
// it (`buildCustomerInfoFields`: the call's number, its email) plus its script's number; a card with no
// identity has none. Addresses the agent added (`linkContactMethod`) join them, keyed like the offer keys
// them: the entity, else the card.

export interface CardContactMethods {
  /** Every phone channel's numbers (voice, SMS, WhatsApp). */
  phones: string[];
  emails: string[];
}

export interface CardContactMethodsSource {
  /** The card's directory or created record. */
  record?: CustomerAddresses;
  /** Whether the card is a known customer (`identity`, or what would stamp it). */
  known: boolean;
  /** A scripted case's own number (its script's entity). */
  scenarioPhone?: string;
}

/** Whose contact methods a card's added addresses join: its entity, else the card. */
export const contactMethodsOwnerOf = (card: Pick<NavCard, "id" | "entityId">): string => card.entityId ?? card.id;

const digits = (s: string) => s.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
const sameAddress = (a: string, b: string) => {
  const da = digits(a);
  const db = digits(b);
  return da !== "" && db !== "" ? da === db : a.trim().toLowerCase() === b.trim().toLowerCase();
};
const unique = (list: string[]) => list.filter((a, i) => a && list.findIndex((b) => sameAddress(a, b)) === i);

export function cardContactMethods(card: NavCard, source: CardContactMethodsSource): CardContactMethods {
  const owner = contactMethodsOwnerOf(card);
  let phones: string[] = [];
  let emails: string[] = [];
  if (source.record) {
    phones = customerChannelAddresses(source.record, "sms");
    emails = customerChannelAddresses(source.record, "email");
  } else if (source.known) {
    const fields = buildCustomerInfoFields(card.customerName, card.customerId, card.threads);
    const field = (label: string) => fields.find((f) => f.label === label)?.value;
    phones = [source.scenarioPhone ?? "", field("Phone #") ?? ""];
    emails = [field("Email") ?? ""];
  }
  return {
    phones: unique([...phones, ...linkedAddresses(owner, "sms")]),
    emails: unique([...emails, ...linkedAddresses(owner, "email")]),
  };
}

/** Whether `address` is one of the card's contact methods. */
export function isCardContactMethod(methods: CardContactMethods, channel: string, address: string): boolean {
  return (channel === "email" ? methods.emails : methods.phones).some((a) => sameAddress(a, address));
}
