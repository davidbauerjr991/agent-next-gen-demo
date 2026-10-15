import type { ChannelType } from "@nicecxone/lyra-ui";

/** The Copilot composer's suggestion chips for a thread's channel: one
 *  composer everywhere, channel-aware chips. */
export function copilotSuggestionsFor(channel: ChannelType | undefined): string[] {
  switch (channel) {
    case "voice":
      return ["Summarize this call", "Suggest next steps", "What is the customer's history?"];
    case "email":
      return ["Draft a reply", "Summarize this email thread", "What is the customer's history?"];
    case "sms":
    case "whatsapp":
      return ["Suggest a reply", "Summarize this conversation", "What is the customer's history?"];
    default:
      return ["Summarize this conversation", "Suggest a reply", "What is the customer's history?"];
  }
}
