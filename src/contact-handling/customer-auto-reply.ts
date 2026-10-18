import { simCustomerAutoReply } from "@/adapters/sim/sim-auto-replies";
import { QUICK_REPLIES } from "@/components/transcript/composer/quick-replies";

/** Resolves the canned simulated-customer reply text for a given
 *  `handleSendMessage` call — the single place the page's simulated-reply
 *  callback calls, so the "Acknowledge" special case (and any future one
 *  like it) only needs to be taught here once. The reply content is the
 *  sim's (`sim-auto-replies.ts`); P2.2 moves the reply itself to the sim
 *  customer and retires this. */
export function resolveCustomerAutoReply(agentMessageText: string): string {
  const acknowledgeTemplate = QUICK_REPLIES.find((reply) => reply.id === "acknowledge")?.template;
  return simCustomerAutoReply(agentMessageText, acknowledgeTemplate);
}
