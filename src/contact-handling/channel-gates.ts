// Settings → Channels gates (the channels agents contact customers on). A
// channel that's off is hidden everywhere a contact on it could start or
// show up; contacts already open on it stay until they end.
import type { CreateNewOutboundConfig, CreateNewOutboundContact } from "@nicecxone/lyra-ui";
import type { ContactHistoryEntry } from "@/components/agent-next-gen-contact-history";
import type { ChannelsSettings, ContactChannel } from "@/settings";

/** Whether a channel is on. A channel the setting doesn't know (video) isn't gated. */
export const channelOn = (channels: ChannelsSettings, channel: string): boolean => channels[channel as ContactChannel] ?? true;

/** New Outbound's and the add-channel "+"'s channel choices: only the channels that are on. */
export function enabledChannelOptions(
  options: CreateNewOutboundConfig["channelOptions"],
  channels: ChannelsSettings,
): CreateNewOutboundConfig["channelOptions"] {
  return options.filter((option) => channelOn(channels, option.id));
}

/** A launcher contact's own channel list: the channels that are on, and that
 *  the entry has an address for (Email needs an email on file; the phone
 *  channels use its number or the outbound lines). */
export function withEnabledChannels(contact: CreateNewOutboundContact, channels: ChannelsSettings): CreateNewOutboundContact {
  const reachable = (c: string) => channelOn(channels, c) && (c !== "email" || !!contact.email);
  return contact.channels ? { ...contact, channels: contact.channels.filter(reachable) } : contact;
}

/** Contact History rows on the channels that are on (every range). */
export function historyOnChannels<K extends string>(
  byRange: Record<K, ContactHistoryEntry[]>,
  channels: ChannelsSettings,
): Record<K, ContactHistoryEntry[]> {
  const shown = (entry: ContactHistoryEntry) => channels[entry.channelType as ContactChannel] ?? false;
  return Object.fromEntries(Object.entries<ContactHistoryEntry[]>(byRange).map(([range, rows]) => [range, rows.filter(shown)])) as Record<
    K,
    ContactHistoryEntry[]
  >;
}
