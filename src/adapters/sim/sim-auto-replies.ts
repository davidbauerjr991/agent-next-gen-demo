// The simulated customer's canned replies (P-EXTRACT: moved here from agent-next-gen-transcript.tsx — this is
// simulation content, not UI). The page still fakes a reply after the agent sends a message
// (`handleSendMessage`, via `resolveCustomerAutoReply` in contact-handling); P2.2 moves that to the sim customer.

// Canned replies drawn from for the simulated customer response
// `handleSendMessage` schedules after the agent sends a message — this demo
// has no real customer on the other end, so a short, generic pool stands in
// for one, same "randomly draw from a fixed pool" pattern already used for
// synthesized Customer Information data (`CUSTOMER_LATEST_NOTE_POOL`, etc.).
export const CUSTOMER_AUTO_REPLY_POOL = [
  "Thanks, got it!",
  "Okay, that makes sense.",
  "Appreciate the quick response.",
  "Got it, thank you!",
  "Sounds good, thanks for the help.",
  "Perfect, that answers my question.",
];

/** Per explicit request ("when that quick reply is typed make sure Marcus
 *  responds with 'That's great! Thanks for the quick reply'"), the
 *  "Acknowledge" quick reply gets its own scripted simulated-customer
 *  response instead of a random `CUSTOMER_AUTO_REPLY_POOL` pick — reads as a
 *  direct reaction to the agent's specific message rather than a generic
 *  one. Not actually Marcus-specific (the request's own screenshot just
 *  happened to be an interaction with a customer named Marcus Webb) — this
 *  applies to every simulated customer reply, in every interaction, exactly
 *  like `CUSTOMER_AUTO_REPLY_POOL` itself already does. */
export const ACKNOWLEDGE_QUICK_REPLY_RESPONSE = "That's great! Thanks for the quick reply";

/** The simulated customer's reply to the agent's message: the scripted
 *  response when the agent sent the "Acknowledge" quick reply's text
 *  (`acknowledgeTemplate`, passed in so this fixture needs nothing from the
 *  UI), else a random pick from the pool. */
export function simCustomerAutoReply(agentMessageText: string, acknowledgeTemplate: string | undefined): string {
  if (acknowledgeTemplate && agentMessageText === acknowledgeTemplate) {
    return ACKNOWLEDGE_QUICK_REPLY_RESPONSE;
  }
  return CUSTOMER_AUTO_REPLY_POOL[Math.floor(Math.random() * CUSTOMER_AUTO_REPLY_POOL.length)];
}

/** The simulated caller's lines on an unscripted call (P-CANVAS), per skill,
 *  said in order — one after each Next Best Action the agent answers, or on a
 *  pause with nothing to suggest — until the pool runs out and the caller
 *  goes quiet. Voice's counterpart of `CUSTOMER_AUTO_REPLY_POOL` (TTS waits
 *  for Phase 3: the lines are transcript utterances only). */
const VOICE_CUSTOMER_LINE_POOLS: Readonly<Record<string, readonly string[]>> = {
  general: [
    "Hi, thanks. I'm calling about my account.",
    "I got a notice about a change and I'm not sure what it means.",
    "Okay. Can you check that for me?",
    "Great, that's all I needed. Thanks.",
  ],
  technical: [
    "Hi. My device stopped connecting this morning.",
    "I've already tried restarting it twice.",
    "Okay, I'll try that now.",
    "That worked. Thanks for the help.",
  ],
  billing: [
    "Hi, thanks. I have a question about my last bill.",
    "There's a charge on it I don't recognise.",
    "Okay, can you take that off?",
    "Perfect, thank you.",
  ],
  sales: [
    "Hi. I'm looking at upgrading my plan.",
    "What would that cost each month?",
    "Okay, let's go ahead with that.",
    "Great, thanks.",
  ],
};

/** The caller's lines for a call on `skillId` (General Support's for a skill with no pool of its own). */
export function simVoiceCustomerLines(skillId: string | undefined): readonly string[] {
  return (skillId && VOICE_CUSTOMER_LINE_POOLS[skillId]) || VOICE_CUSTOMER_LINE_POOLS.general;
}
