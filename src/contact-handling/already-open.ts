import type { ChannelType } from "@nicecxone/lyra-ui";
import type { Interaction as DomainInteraction } from "@/domain";
import { normalizePhone } from "@/domain";
import { callerOfInteraction } from "./contact-identity";

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
export const LIVE = new Set(["connecting", "active", "held"]);

/** A voice contact the agent is on in any way: ringing (either way), live or held (the "refuse" second-call policy). */
export const ON_CALL_STATES = new Set(["offered", ...LIVE]);

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

/** Who a voice launch would call: the directory entity, if known, and the
 *  numbers it could dial. */
export interface CallTarget {
  entityId?: string;
  addresses?: readonly string[];
  /** The card it would join: a customer with no directory record is its card (k8 6). */
  journeyId?: string;
}

/** A voice contact that blocks another call with the same customer: ringing (either way) or live. A held call
 *  doesn't (auto-hold: the agent may call while others are held, P0.5d.1 row 15; P-HOME-1m). */
const BLOCKING_CALL_STATES = new Set(["offered", "connecting", "active"]);

/** The one-call-per-customer guard (k8 6), for every launch path — the dial
 *  (Quick Dial, Redial, the dial pad) and the "+" pickers alike: a ringing or
 *  live (not held) voice call with the target, if any — the same entity, the
 *  same card (a customer with no directory record, e.g. a scripted case), or
 *  the same number. A held call or one in wrap-up doesn't count, and neither
 *  do digital contacts. */
export function findCallWith<T extends { channel: string; state: string; entityId?: string; journeyId?: string; address?: { value: string } }>(
  interactions: readonly T[],
  target: CallTarget,
): T | undefined {
  const numbers = new Set((target.addresses ?? []).map(normalizePhone).filter((n) => n !== ""));
  return interactions.find(
    (i) =>
      i.channel === "voice" &&
      BLOCKING_CALL_STATES.has(i.state) &&
      ((!!target.entityId && i.entityId === target.entityId) ||
        (!!target.journeyId && i.journeyId === target.journeyId) ||
        (!!i.address && numbers.has(normalizePhone(i.address.value)))),
  );
}

/** The guard's message, naming the call that blocked: "Already on a call with Maya Chen" (the dial's warning toast
 *  and the "+" pickers' Voice reason alike). */
export function alreadyOnCallMessage(name: string | undefined): string {
  return name ? `Already on a call with ${name}` : "Already on a call with this customer";
}

/** `{ voice: "Already on a call with …" }` while `findCallWith` finds a call for the customer, naming that call's
 *  contact (its name, else its number): the "+" pickers' Voice reason. */
export function onCallReasons(contacts: readonly DomainInteraction[], customer: CallTarget): Partial<Record<ChannelType, string>> {
  const call = findCallWith(contacts, customer);
  if (!call) return {};
  const caller = callerOfInteraction(call, []);
  return { voice: alreadyOnCallMessage(caller.name ?? caller.number) };
}

/** Each channel's addresses that have a live thread for this entity. Voice
 *  isn't listed: whether a call may start is the one-call guard's
 *  (`findCallWith`, `onCallReasons`), never lyra's "every address open" rule
 *  (P-HOME-1m: a held call's number disabled Voice there with no reason). */
export function liveAddressesFor(contacts: readonly DomainInteraction[], entityId: string | undefined): Partial<Record<ChannelType, string[]>> {
  const open: Partial<Record<ChannelType, string[]>> = {};
  if (!entityId) return open;
  for (const c of contacts) {
    if (c.entityId !== entityId || c.channel === "voice" || !LIVE.has(c.state) || !c.address?.value) continue;
    (open[c.channel as ChannelType] ??= []).push(c.address.value);
  }
  return open;
}

/** A card's live addresses per channel, by its journey (a card with no
 *  directory entity: a scripted case, a history or ad-hoc contact; E3). Voice
 *  isn't listed, as in `liveAddressesFor`. */
export function liveAddressesForJourney(contacts: readonly DomainInteraction[], journeyId: string): Partial<Record<ChannelType, string[]>> {
  const open: Partial<Record<ChannelType, string[]>> = {};
  for (const c of contacts) {
    if (c.journeyId !== journeyId || c.channel === "voice" || !LIVE.has(c.state) || !c.address?.value) continue;
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
 *  `findCallWith`). */
export function alreadyOpenReasons(record: CustomerAddresses | undefined, open: Partial<Record<ChannelType, string[]>>): Partial<Record<ChannelType, string>> {
  const reasons: Partial<Record<ChannelType, string>> = {};
  for (const channel of Object.keys(open) as ChannelType[]) {
    if (channel === "voice" || !(open[channel]?.length)) continue;
    if (unusedAddresses(record, channel, open).length === 0) reasons[channel] = ALREADY_OPEN_REASON;
  }
  return reasons;
}
