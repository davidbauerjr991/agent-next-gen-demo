import type { ReactNode } from "react";
import { DetailsPanelAccordions } from "@/components/agent-next-gen-customer-info-panel";
import type { OverviewInfo } from "@/components/agent-next-gen-shared-utils";
import { ComposerFade } from "@/components/agent-next-gen-transcript";

const NO_DETAILS_SECTIONS = { customerInfo: false, journeySummary: false, artifacts: false };

export interface AiWorkspaceColumnProps {
  /** The AI feed (the page's `renderAiPanelFeed`, its top being the canvas's
   *  action cells before the conversation: the Autosummary, Marcus's card,
   *  and under "stacked" the reference cards), then AI cards, approvals,
   *  interstitials. */
  feed: ReactNode;
  feedCount: number;
  /** Bumped by an agent action in the composer: scroll to the newest. */
  followSignal: number;
  customerName?: string;
  customerContextOverview?: OverviewInfo;
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
 *  action area under "main" (P-CANVAS); the reference cards are in the feed's
 *  top ("stacked") or the reference column beside it ("twoColumn"). */
export function AiWorkspaceColumn({
  feed,
  feedCount,
  followSignal,
  customerName,
  customerContextOverview,
  trailing,
  dock,
}: AiWorkspaceColumnProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-slot="ai-workspace">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[768px] pb-8">
          <DetailsPanelAccordions
            show={NO_DETAILS_SECTIONS}
            aiFeed={feed ?? <div />}
            aiFeedCount={feedCount}
            followSignal={followSignal}
            customerName={customerName}
            customerContextOverview={customerContextOverview}
          />
          {trailing && <div className="px-4">{trailing}</div>}
        </div>
      </div>
      <div className="relative shrink-0">
        <ComposerFade />
        <div data-slot="copilot-dock" className="mx-auto w-full max-w-[768px] px-6 pb-4">
          {dock}
        </div>
      </div>
    </div>
  );
}
