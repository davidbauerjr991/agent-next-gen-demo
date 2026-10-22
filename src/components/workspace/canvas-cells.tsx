// The built-in canvas cells (P-CANVAS): each wraps the card's one
// implementation and reads the workspace controller, so the registry
// (`src/contact-handling/canvas-registry.ts`) can mount it in either region.
// Panel mode doesn't use the registry: Contact Details keeps its own cards.
import { VoiceWrapUpCard } from "@/contact-handling/VoiceWrapUpCard";
import { HostSlot } from "@/contact-handling/portal-hosts";
import { MARCUS_WEBB_ID } from "@/contact-handling/scenario-cases";
import { useNextBestAction } from "@/contact-handling/next-best-action";
import { useActiveContactSummary, useActiveJourney, useReferenceAccordion } from "@/contact-handling/reference-cards";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import type { CanvasCell } from "@/contact-handling/canvas-registry";
import type { Workspace } from "@/contact-handling/workspace/controller/useWorkspaceController";
import { CustomerInfoCard } from "@/components/ai-cards/CustomerInfoCard";
import { JourneySummaryCard } from "@/components/ai-cards/JourneySummaryCard";
import { NextBestActionCard } from "@/components/ai-cards/NextBestActionCard";
import { RealTimeSummaryCard } from "@/components/ai-cards/RealTimeSummaryCard";
import { hasCustomerInfo } from "@/components/customer-info/reference-sections";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => {});

/** The highlight a card gets when the AI brings it forward: its border turns
 *  the active border colour for a moment (lyra's Agentic AI card has no
 *  highlight of its own). */
function FocusRing({ highlighted, children }: { highlighted: boolean; children: ReactNode }) {
  return (
    <div
      className={cn("rounded-lyra-md border transition-colors duration-500", highlighted ? "border-lyra-border-active" : "border-transparent")}
      data-highlighted={highlighted || undefined}
    >
      {children}
    </div>
  );
}

function RealTimeSummaryCell() {
  const { highlighted, ...accordion } = useReferenceAccordion("summary");
  return (
    <FocusRing highlighted={highlighted}>
      <RealTimeSummaryCard summary={useActiveContactSummary()} onCopy={copy} {...accordion} />
    </FocusRing>
  );
}

function JourneySummaryCell() {
  const { referenceCardProps: p } = useWorkspace();
  const { journey, lookingUp } = useActiveJourney();
  const { highlighted, ...accordion } = useReferenceAccordion("journey");
  return (
    <FocusRing highlighted={highlighted}>
      <JourneySummaryCard
        journey={journey}
        lookingUp={lookingUp}
        onViewExperienceMemory={p?.onViewExperienceMemory}
        artifacts={p?.artifacts}
        onOpenArtifact={p?.onOpenArtifact}
        onViewAllArtifacts={p?.onViewAllArtifacts}
        {...accordion}
      />
    </FocusRing>
  );
}

function CustomerInfoCell() {
  const { referenceCardProps: p } = useWorkspace();
  const { highlighted, ...accordion } = useReferenceAccordion("customer");
  if (!p) return null;
  return (
    <FocusRing highlighted={highlighted}>
      <CustomerInfoCard known={hasCustomerInfo(p)} onViewCustomerInfo={p.onViewCustomerInfo} onLinkCustomer={p.onLinkCustomer} {...accordion} />
    </FocusRing>
  );
}

function NextBestActionCell() {
  const { card, used, use, onUse, onCopy, onNotNow, onUseAlternative } = useNextBestAction();
  return (
    <NextBestActionCard
      card={card}
      used={used}
      use={use}
      onUse={onUse}
      onCopy={onCopy}
      onNotNow={onNotNow}
      onUseAlternative={onUseAlternative}
    />
  );
}

function MarcusCardCell() {
  return <HostSlot host={useWorkspace().marcusCardHost} />;
}

function VoiceWrapUpCell() {
  const { activeInteraction, activeWrapUpThread, outcomeConfigFor } = useWorkspace();
  if (!activeInteraction || !activeWrapUpThread) return null;
  return <VoiceWrapUpCard outcome={outcomeConfigFor(activeInteraction, activeWrapUpThread, "inline")} />;
}

/** A case with its own scripted card (Marcus Webb's) shows that card, not the generic Next Best Action. */
const hasCustomCaseCard = (ws: Workspace) => !!ws.activeInteraction && ws.scenarioKeyOf(ws.activeInteraction.id) === MARCUS_WEBB_ID;

export const DEFAULT_CANVAS_CELLS: readonly CanvasCell[] = [
  // Reference: what the agent consults, a single-open accordion.
  { id: "real-time-summary", region: "reference", order: 10, component: RealTimeSummaryCell },
  { id: "journey-summary", region: "reference", order: 20, component: JourneySummaryCell },
  {
    id: "customer-info",
    region: "reference",
    order: 30,
    component: CustomerInfoCell,
    // A customer record, or an unmatched customer's "Link to existing customer".
    applies: ({ referenceCardProps: p }) => !!p && (hasCustomerInfo(p) || !!p.onLinkCustomer),
  },
  // Action: what the agent must do now. The Next Best Action is pinned first, above the thread.
  {
    id: "next-best-action",
    region: "action",
    order: 0,
    pinned: true,
    component: NextBestActionCell,
    applies: (ws) => !!ws.activeChannel?.providerInteractionId && !hasCustomCaseCard(ws),
  },
  { id: "marcus-card", region: "action", order: 20, component: MarcusCardCell, applies: hasCustomCaseCard },
  { id: "conversation", region: "action", order: 30 },
  { id: "voice-wrap-up", region: "action", order: 40, component: VoiceWrapUpCell, applies: (ws) => !!ws.activeWrapUpThread },
];
