import { NextBestActionCard } from "@/components/ai-cards/NextBestActionCard";
import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";
import { useNextBestActionRow } from "./next-best-action";

/** The Next Best Action as a row in the conversation (P-CANVAS): the
 *  suggestion while it's the contact's showing one, or "Nothing to suggest".
 *  A suggestion that's no longer showing (answered elsewhere, the contact
 *  ended) renders nothing. */
export function NextBestActionRow({ id, nba }: { id: string; nba: NonNullable<TranscriptMessage["nba"]> }) {
  const { suggestion, use, onUse, onCopy, onNotNow, onUseAlternative } = useNextBestActionRow(nba.contactId, id, nba.stepId);
  if (nba.nothing) return <NextBestActionCard />;
  if (!suggestion) return null;
  return (
    <NextBestActionCard
      suggestion={suggestion}
      stepId={nba.stepId}
      use={use}
      onUse={onUse}
      onCopy={onCopy}
      onNotNow={onNotNow}
      onUseAlternative={onUseAlternative}
    />
  );
}
