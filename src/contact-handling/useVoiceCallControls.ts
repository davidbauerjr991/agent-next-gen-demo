import { useMemo } from "react";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import { useCapability, useInteraction, useInteractionProvider } from "@/provider-context";

// The voice bar's in-call controls on the provider (P0.5d.1), shared by both
// pages: the result is spread onto `<VoiceCallControls>`. State comes from the
// store (events), never optimistically from the click. Capabilities the
// provider lacks hide their control. A scripted scenario call (no
// `providerInteractionId`) leaves mute/record/mask uncontrolled, so the bar
// keeps its local behavior, and holds through the page's own local update.

function warn(what: string) {
  return (error: unknown) => {
    if (import.meta.env.DEV) console.warn(`[voice] ${what} failed`, error);
  };
}

export interface VoiceCallControlProps {
  onHold: boolean | undefined;
  onHoldChange: (onHold: boolean) => void;
  muted?: boolean;
  onMuteChange?: (muted: boolean) => void;
  recording?: boolean;
  onRecordingChange?: (recording: boolean) => void;
  masked?: boolean;
  onMaskedChange?: (masked: boolean) => void;
  onSendDtmf?: (digit: string) => void;
  showHold: boolean;
  showMute: boolean;
  showRecord: boolean;
  showMask: boolean;
  showKeypad: boolean;
}

export function useVoiceCallControls(
  thread: Pick<NavCard["threads"][number], "providerInteractionId" | "heldByAgent"> | undefined,
  options: { onScenarioHold: (onHold: boolean) => void },
): VoiceCallControlProps {
  const provider = useInteractionProvider();
  const target = thread?.providerInteractionId;
  const contact = useInteraction(target);
  const showHold = useCapability((c) => c.interaction.hold);
  const showMute = useCapability((c) => c.interaction.mute);
  const showRecord = useCapability((c) => c.interaction.record);
  const showMask = useCapability((c) => c.interaction.mask);
  const showKeypad = useCapability((c) => c.interaction.dtmf);
  const { onScenarioHold } = options;

  return useMemo<VoiceCallControlProps>(() => {
    const flags = { showHold, showMute, showRecord, showMask, showKeypad };
    if (!target) {
      return { ...flags, onHold: thread?.heldByAgent, onHoldChange: onScenarioHold };
    }
    return {
      ...flags,
      onHold: contact?.state === "held",
      onHoldChange: (onHold) => void provider.hold(target, onHold).catch(warn("hold")),
      muted: !!contact?.muted,
      onMuteChange: (muted) => void provider.mute(target, muted).catch(warn("mute")),
      recording: !!contact?.recording,
      onRecordingChange: (recording) => void provider.setRecording(target, recording).catch(warn("setRecording")),
      masked: !!contact?.masked,
      onMaskedChange: (masked) => void provider.setMasked(target, masked).catch(warn("setMasked")),
      onSendDtmf: (digit) => void provider.sendDtmf(target, digit).catch(warn("sendDtmf")),
    };
  }, [target, contact, provider, thread?.heldByAgent, onScenarioHold, showHold, showMute, showRecord, showMask, showKeypad]);
}
