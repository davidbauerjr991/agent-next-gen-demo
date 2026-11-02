import type { ReactNode } from "react";
import { DetailsPanelAccordions } from "@/components/customer-info";
import { ComposerFade } from "@/components/transcript/InteractionTranscript";
import { CenteredColumn } from "@/layout/CenteredColumn";

export interface AiWorkspaceColumnProps {
  /** The AI feed (the page's `renderAiPanelFeed`, its top being the canvas's
   *  action cells before the conversation: Marcus's card), then AI cards,
   *  approvals, interstitials. (Under "stacked" the reference cards are pinned
   *  above it, outside its scroll: InteractionBody's canvas-pinned band,
   *  P-LAYOUT-F1 D.) */
  feed: ReactNode;
  feedCount: number;
  /** Bumped by an agent action in the composer: scroll to the newest. */
  followSignal: number;
  /** After the feed: the canvas's action cells after the conversation (the voice wrap-up card). */
  trailing?: ReactNode;
  /** The Copilot composer's slot (a `HostSlot` for the page's stable
   *  Copilot host, as in the panel footer). */
  dock: ReactNode;
}

/** The main column under AI display "main" (AI-first,
 *  P-AIFIRST): what AI display "panel" shows in the docked Contact Details
 *  panel — the AI feed and its Copilot composer — moved to the main column.
 *  Every conversation thread opens in the panel instead. It is the canvas's
 *  action area under "main" (P-CANVAS); the reference cards are pinned above
 *  it ("stacked", P-LAYOUT-F1 D) or in the reference column beside it
 *  ("twoColumn"). */
export function AiWorkspaceColumn({
  feed,
  feedCount,
  followSignal,
  trailing,
  dock,
}: AiWorkspaceColumnProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-slot="ai-workspace">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <CenteredColumn width="action" className="pb-8">
          <DetailsPanelAccordions aiFeed={feed ?? <div />} aiFeedCount={feedCount} followSignal={followSignal} />
          {trailing && <div className="px-4">{trailing}</div>}
        </CenteredColumn>
      </div>
      <div className="relative shrink-0">
        <ComposerFade />
        <CenteredColumn width="action" data-slot="copilot-dock" className="px-6 pb-4">
          {dock}
        </CenteredColumn>
      </div>
    </div>
  );
}
