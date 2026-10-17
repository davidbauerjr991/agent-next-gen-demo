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
 *  phones for every phone channel (voice, SMS, WhatsApp). */
export function customerChannelAddresses(record: CustomerAddresses | undefined, channel: ChannelType): string[] {
  if (!record) return [];
  if (channel === "email") return record.emailAddress ? [record.emailAddress] : [];
  const phones = record.phones?.map((p) => p.value) ?? [];
  return phones.length > 0 ? phones : record.firstPhone ? [record.firstPhone] : [];
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
};

/** New Outbound (lyra `CreateNew`) disables a channel once every address it
 *  would offer is open, and can't take a reason per contact. So a channel
 *  that's "Already open" for this customer gets every address lyra could
 *  offer marked open: disabled there too, without the tooltip. */
export function markAlreadyOpen<C extends TaggableContact>(contact: C, reasons: Partial<Record<ChannelType, string>>, phoneOptions: readonly { value: string }[]): C {
  const channels = Object.keys(reasons) as ChannelType[];
  if (channels.length === 0) return contact;
  const every = [contact.primaryPhone?.value, ...phoneOptions.map((o) => o.value), contact.email, `@${contact.name}`].filter((v): v is string => !!v);
  const openChannelAddresses = { ...contact.openChannelAddresses };
  for (const channel of channels) openChannelAddresses[channel] = every;
  return { ...contact, openChannelAddresses };
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
