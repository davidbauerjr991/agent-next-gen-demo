import type { InteractionCapabilities } from "../../providers";
import type { SimCommand } from "./sim-protocol";

/** A fresh id like `int-3f2a…`. Cast to the branded type at the call site. */
export function simId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

/** A uniform sample from `[minMs, maxMs]`. */
export function sampleMs(range: { minMs: number; maxMs: number }): number {
  const min = Math.max(0, range.minMs);
  return min + Math.random() * Math.max(0, range.maxMs - min);
}

/** Why `command` isn't supported under `capabilities`, or `null` if it is.
 *  Shared by the provider (rejects before sending) and the engine (backstop). */
export function unsupportedReason(command: SimCommand, capabilities: InteractionCapabilities): string | null {
  const off = (flag: boolean, what: string) => (flag ? null : `${what} is not supported`);
  switch (command.name) {
    case "decline":
      return off(capabilities.decline, "decline");
    case "hold":
      return off(capabilities.hold, "hold");
    case "mute":
      return off(capabilities.mute, "mute");
    case "setRecording":
      return off(capabilities.record, "recording");
    case "setMasked":
      return off(capabilities.mask, "masking");
    case "sendDtmf":
      return off(capabilities.dtmf, "keypad tones");
    case "transfer":
      return off(capabilities.transfer[command.mode], `${command.mode} transfer`);
    case "setTyping":
      return off(capabilities.typing, "typing indicators");
    case "setCaseStatus":
      return off(capabilities.caseStatus, "case status");
    case "connectAgentLeg":
    case "disconnectAgentLeg":
      return off(capabilities.agentLeg, "the agent leg");
    case "dial":
      return off(capabilities.channels.outbound.includes(command.request.channel), `outbound ${command.request.channel}`);
    default:
      return null;
  }
}
