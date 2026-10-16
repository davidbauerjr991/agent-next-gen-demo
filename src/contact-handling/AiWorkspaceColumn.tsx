import type { ReactNode } from "react";
import { DetailsPanelAccordions } from "@/components/agent-next-gen-customer-info-panel";
import type { OverviewInfo } from "@/components/agent-next-gen-shared-utils";
import { ComposerFade } from "@/components/agent-next-gen-transcript";

const NO_DETAILS_SECTIONS = { customerInfo: false, journeySummary: false, artifacts: false };

export interface AiWorkspaceColumnProps {
  /** The AI feed the panel shows in AI display "panel" mode (the page's
   *  `renderAiPanelFeed`): the Autosummary, AI cards, approvals, interstitials. */
  feed: ReactNode;
  feedCount: number;
  /** Bumped by an agent action in the composer: scroll to the newest. */
  followSignal: number;
  customerName?: string;
  customerContextOverview?: OverviewInfo;
  /** After the feed: the voice wrap-up card while the card's call is in wrap-up. */
  trailing?: ReactNode;
  /** The Copilot composer's slot (`copilotDock`'s mount): the page's
   *  composer portals into it, as it does into the panel footer. */
  dockRef: (el: HTMLDivElement | null) => void;
}

/** The main column under AI display "main" (AI-first,
 *  P-AIFIRST): what AI display "panel" shows in the docked Contact Details
 *  panel — the AI feed and its Copilot composer — moved to the main column.
 *  Every conversation thread opens in the panel instead. Customer Info,
 *  Journey Summary and Artifacts stay in Contact Details. */
export function AiWorkspaceColumn({
  feed,
  feedCount,
  followSignal,
  customerName,
  customerContextOverview,
  trailing,
  dockRef,
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
        <div ref={dockRef} data-slot="copilot-dock" className="mx-auto w-full max-w-[768px] px-6 pb-4" />
      </div>
    </div>
  );
}
