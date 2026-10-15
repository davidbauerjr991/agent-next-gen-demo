// Conditions a step's `onlyIf` can name (P0.5c). Pure; the scenario player
// evaluates them against the agent's decision.

/** Whether a "something else" instruction tells the bot to say something to
 *  the customer (tell / say / let them know / ask / inform / notify …) and
 *  names the customer as the recipient ("tell Lucas …", "let him know …").
 *  Instructions to the bot itself ("tell me …", "show …", "how old is …")
 *  never get a customer reply. Moved verbatim from the Advanced page's
 *  `asksAiToSpeak`. */
export function noteAddressesCustomer(note: string): boolean {
  return (
    !/^\s*(please\s+)?(tell|show|give|ask)\s+me\b/i.test(note) &&
    /\b(tell|say to|say|let|inform|notify|message|reply to|respond to|ask|apologi[sz]e to|thank|update|confirm with|offer|follow(?:\s|-)?up with|get back to|reach out to|check in with|contact|advise|reassure|explain to)\b[^.?!]{0,40}\b(the customer|customer|lucas|him|her|them|the client|client)\b/i.test(
      note,
    )
  );
}
