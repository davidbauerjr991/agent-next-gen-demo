// The transcript menu (P-POLISH 3): Download transcript and Email copy to
// customer, each present only when the active TranscriptExportProvider has the
// capability (`transcript.download`, `transcript.emailCopy`). Email copy is
// disabled, with the reason, when the customer has no email on file. The voice
// bar's Transcript button and a digital leg's Transcript tab header both open it.
import type { MenuEntry } from "@nicecxone/lyra-ui";
import { Download, Mail } from "lucide-react";
import { deriveTranscriptSessions } from "@/components/transcript/transcript-sessions";
import type { TranscriptMessage } from "@/components/transcript/transcript-types";
import type { Interaction, Thread } from "@/components/agent-next-gen-interaction-dashboard";
import { useCapability, useTranscriptExportProvider } from "@/provider-context";
import type { TranscriptExportRequest } from "@/providers";
import { t } from "@/i18n";
import { threadKeyOf } from "./channel-thread";

/** The lines the agent sees for a thread: the sessions' logged messages, then the live ones; customer and agent
 *  messages and event lines, not the AI rows. */
export function visibleTranscriptLines(
  interaction: Interaction,
  thread: Thread,
  hideMockFollowUpMessages: boolean,
): TranscriptExportRequest["lines"] {
  const { sessions } = deriveTranscriptSessions({
    channelType: thread.type,
    isFreshLaunch: !!thread.startedFresh,
    contactId: thread.contactId ?? interaction.customerId,
    hideMockFollowUpMessages,
  });
  const messages: readonly TranscriptMessage[] = [
    ...sessions.flatMap((s) => s.messages),
    ...(interaction.liveMessages?.[threadKeyOf(thread)] ?? []),
  ];
  return messages
    .filter((m) => m.text.trim() && !m.summary && !m.instruction && !m.wrapUp && !m.saveAddress && !m.nbaOutcome && !m.nba)
    .map((m) => ({ at: m.timestamp, speaker: m.name, text: m.text }));
}

/** Hands a built file to the browser as a download. */
function saveTextFile({ filename, text }: { filename: string; text: string }) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** The menu's items for a thread, or undefined when neither capability is on (nothing to show). */
export function useTranscriptMenu({
  interaction,
  thread,
  emailAddress,
  hideMockFollowUpMessages = false,
  onEmailed,
}: {
  interaction: Interaction | undefined;
  thread: Thread | undefined;
  /** The customer's email on file. */
  emailAddress: string | undefined;
  /** Mirrors the transcript's own prop, so the file holds what is on screen. */
  hideMockFollowUpMessages?: boolean;
  /** Raised once the copy is sent, with the address it went to (the caller's toast). */
  onEmailed: (address: string) => void;
}): MenuEntry[] | undefined {
  const exporter = useTranscriptExportProvider();
  const canDownload = useCapability((c) => !!c.transcript?.download);
  const canEmail = useCapability((c) => !!c.transcript?.emailCopy);
  if (!exporter || !interaction || !thread || (!canDownload && !canEmail)) return undefined;
  const request = (): TranscriptExportRequest => ({
    assignmentId: interaction.interactionId,
    customerName: interaction.customerName ?? "",
    lines: visibleTranscriptLines(interaction, thread, hideMockFollowUpMessages),
  });
  const items: MenuEntry[] = [];
  if (canDownload) {
    items.push({
      id: "download-transcript",
      label: t("Download transcript"),
      icon: <Download className="h-4 w-4" strokeWidth={1.5} />,
      onClick: () => void exporter.buildTranscript(request()).then(saveTextFile),
    });
  }
  if (canEmail) {
    items.push({
      id: "email-transcript",
      label: t("Email copy to customer"),
      icon: <Mail className="h-4 w-4" strokeWidth={1.5} />,
      disabled: !emailAddress,
      description: emailAddress ? undefined : t("No email on file"),
      onClick: () => {
        if (emailAddress) void exporter.emailCopy({ ...request(), address: emailAddress }).then((sent) => onEmailed(sent.address));
      },
    });
  }
  return items;
}
