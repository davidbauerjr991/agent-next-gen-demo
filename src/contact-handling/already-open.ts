import type { ChannelType } from "@nicecxone/lyra-ui";
import type { Interaction as DomainInteraction } from "@/domain";
import { normalizePhone } from "@/domain";

/** The reason an add-channel picker gives a channel whose every address for
 *  this customer already has a live thread (P-AIFIRST (k6) 2). */
export const ALREADY_OPEN_REASON = "Already open";

/** A directory record's addresses, as far as these rules need them. */
export interface CustomerAddresses {
  phones?: readonly { value: string }[];
  firstPhone?: string;
  emailAddress?: string;
}

/** A thread that holds its address: live, not ringing, not over. */
const LIVE = new Set(["connecting", "active", "held"]);

const sameAddress = (a: string, b: string) => {
  const pa = normalizePhone(a);
  const pb = normalizePhone(b);
  return pa !== "" && pb !== "" ? pa === pb : a.trim().toLowerCase() === b.trim().toLowerCase();
};

/** The customer's own addresses on a channel: the email for email, their
 *  phones for every phone channel (voice, SMS, WhatsApp). Each number once:
 *  a record that lists one number several times would give a picker
 *  several options with the same value, which lyra's Select draws on top of
 *  each other in its field (k8 1). */
export function customerChannelAddresses(record: CustomerAddresses | undefined, channel: ChannelType): string[] {
  if (!record) return [];
  if (channel === "email") return record.emailAddress ? [record.emailAddress] : [];
  const phones = record.phones?.map((p) => p.value) ?? [];
  const all = phones.length > 0 ? phones : record.firstPhone ? [record.firstPhone] : [];
  return all.filter((a, i) => all.findIndex((b) => sameAddress(a, b)) === i);
}

/** The reason Voice is disabled while the customer has a call (k8 6). */
export const ON_A_CALL_REASON = "Already on a call";

/** A call the agent is on with someone: ringing (either way), live or held. */
const ON_CALL = new Set(["offered", "connecting", "active", "held"]);

/** `{ voice: "Already on a call" }` while the customer has a ringing, live
 *  or held call: the same entity, the same card (a customer with no
 *  directory record, e.g. a scripted case), or the same number. One call
 *  per customer, on every launch path (k8 6). */
export function onCallReasons(
  contacts: readonly DomainInteraction[],
  customer: { entityId?: string; journeyId?: string; addresses?: readonly string[] },
): Partial<Record<ChannelType, string>> {
  const onCall = contacts.some(
    (c) =>
      c.channel === "voice" &&
      ON_CALL.has(c.state) &&
      ((!!customer.entityId && c.entityId === customer.entityId) ||
        (!!customer.journeyId && c.journeyId === customer.journeyId) ||
        (!!c.address?.value && (customer.addresses ?? []).some((a) => sameAddress(a, c.address!.value)))),
  );
  return onCall ? { voice: ON_A_CALL_REASON } : {};
}

/** Each channel's addresses that have a live thread for this entity (a call
 *  only counts while on it, as `buildOpenChannelTagger`). */
export function liveAddressesFor(contacts: readonly DomainInteraction[], entityId: string | undefined): Partial<Record<ChannelType, string[]>> {
  const open: Partial<Record<ChannelType, string[]>> = {};
  if (!entityId) return open;
  for (const c of contacts) {
    if (c.entityId !== entityId || !LIVE.has(c.state) || !c.address?.value) continue;
    (open[c.channel as ChannelType] ??= []).push(c.address.value);
  }
  return open;
}

/** A card's live addresses per channel, by its journey (a card with no
 *  directory entity: a scripted case, a history or ad-hoc contact; E3). */
export function liveAddressesForJourney(contacts: readonly DomainInteraction[], journeyId: string): Partial<Record<ChannelType, string[]>> {
  const open: Partial<Record<ChannelType, string[]>> = {};
  for (const c of contacts) {
    if (c.journeyId !== journeyId || !LIVE.has(c.state) || !c.address?.value) continue;
    (open[c.channel as ChannelType] ??= []).push(c.address.value);
  }
  return open;
}

/** The customer's unused addresses on a channel (theirs, minus live ones). */
export function unusedAddresses(record: CustomerAddresses | undefined, channel: ChannelType, open: Partial<Record<ChannelType, string[]>>): string[] {
  const live = open[channel] ?? [];
  return customerChannelAddresses(record, channel).filter((a) => !live.some((o) => sameAddress(o, a)));
}

type TaggableContact = {
  id: string;
  name: string;
  email?: string;
  primaryPhone?: { value: string };
  openChannelAddresses?: Partial<Record<ChannelType, string[]>>;
  openAddressReason?: string;
};

/** New Outbound (lyra `CreateNew`) disables a channel once every address it
 *  would offer is open, and can't take a reason per contact. So a channel
 *  that's "Already open" for this customer gets every address lyra could
 *  offer marked open: disabled there too, without the tooltip. Any open
 *  address stays listed in "Select Phone"/"Select Email Address", disabled
 *  "Already open" (`openAddressReason`, E3), so the agent sees the channel
 *  is active there. */
export function markAlreadyOpen<C extends TaggableContact>(contact: C, reasons: Partial<Record<ChannelType, string>>, phoneOptions: readonly { value: string }[]): C {
  const channels = Object.keys(reasons) as ChannelType[];
  const listed = (c: C): C => (c.openChannelAddresses ? { ...c, openAddressReason: ALREADY_OPEN_REASON } : c);
  if (channels.length === 0) return listed(contact);
  // Every address lyra could offer: the phone lines (voice, SMS, WhatsApp; E4) and the email.
  const every = [contact.primaryPhone?.value, ...phoneOptions.map((o) => o.value), contact.email].filter((v): v is string => !!v);
  const openChannelAddresses = { ...contact.openChannelAddresses };
  for (const channel of channels) openChannelAddresses[channel] = every;
  return listed({ ...contact, openChannelAddresses });
}

/** `{ [channel]: "Already open" }` for every channel with a live thread and
 *  no unused address of the customer's for it (an unknown customer: any
 *  live thread). Voice is left to the call rules (one call per customer,
 *  `isOnCallWith`). */
export function alreadyOpenReasons(record: CustomerAddresses | undefined, open: Partial<Record<ChannelType, string[]>>): Partial<Record<ChannelType, string>> {
  const reasons: Partial<Record<ChannelType, string>> = {};
  for (const channel of Object.keys(open) as ChannelType[]) {
    if (channel === "voice" || !(open[channel]?.length)) continue;
    if (unusedAddresses(record, channel, open).length === 0) reasons[channel] = ALREADY_OPEN_REASON;
  }
  return reasons;
}
