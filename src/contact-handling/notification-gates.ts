import type { AgentNotification } from "@nicecxone/lyra-ui";
import type { Interaction as DomainInteraction } from "@/domain";
import { NOTIFICATION_INTERACTION_ID } from "./seed-notification-ids";

/** Settings → Channels and the bell (P-POLISH 1): an unread notification for
 *  an offer still waiting on a channel that's off is hidden, from the list and
 *  the count, like the offer's card; it's back once the channel is on. So is
 *  one for a seed that went back to waiting (`parked`, touched-threads.ts). A
 *  read notification, or one whose thread the agent has, always shows. */
export function visibleNotifications(
  notifications: readonly AgentNotification[],
  contacts: readonly DomainInteraction[],
  enabledChannels: readonly string[],
  parked: ReadonlySet<string> = new Set(),
): AgentNotification[] {
  const hidden = new Set<string>();
  for (const n of notifications) {
    if (n.read) continue;
    const contactId = NOTIFICATION_INTERACTION_ID[n.id];
    const contact = contactId ? contacts.find((c) => c.id === contactId) : undefined;
    if (!contact) continue;
    if (parked.has(contact.id) || (contact.state === "offered" && !enabledChannels.includes(contact.channel))) hidden.add(n.id);
  }
  return hidden.size === 0 ? (notifications as AgentNotification[]) : notifications.filter((n) => !hidden.has(n.id));
}
