// Settings → Channels gates (the channels agents contact customers on). A
// channel that's off is hidden everywhere the agent could start or receive
// a contact on it; contacts already open on it stay until they end. The
// seeded lists keyed by channel follow it too (Contact History, the
// Interactions table, the Dashboard's queue tiles, the Journey Summary's
// history rows): a channel turned off drops its rows on the next render, and
// turning it back on restores them.
import type { CreateNewOutboundConfig, CreateNewOutboundContact } from "@nicecxone/lyra-ui";
import type { ChannelsSettings, ContactChannel } from "@/settings";

/** Whether a channel is on. A channel the setting doesn't know (video) isn't gated. */
export const channelOn = (channels: ChannelsSettings, channel: string): boolean => channels[channel as ContactChannel] ?? true;

/** A seeded list's rows on channels that are on. */
export function onEnabledChannels<T>(rows: readonly T[], channels: ChannelsSettings, channelOf: (row: T) => string): T[] {
  return rows.filter((row) => channelOn(channels, channelOf(row)));
}

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
