// The built-in canvas cells (P-CANVAS): each wraps the card's one
// implementation and reads the workspace controller, so the registry
// (`src/contact-handling/canvas-registry.ts`) can mount it in either region.
// Panel mode has no canvas: Contact Details' Overview mounts the same
// reference cells (`useReferenceCells`).
import { VoiceWrapUpCard } from "@/contact-handling/VoiceWrapUpCard";
import { useActiveContactSummary, useActiveJourney, useReferenceAccordion } from "@/contact-handling/reference-cards";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { copilotAsksOf } from "@/contact-handling/useCopilotAsk";
import type { CanvasCell } from "@/contact-handling/canvas-registry";
import { CustomerInfoCard } from "@/components/ai-cards/CustomerInfoCard";
import { JourneySummaryCard } from "@/components/ai-cards/JourneySummaryCard";
import { RealTimeSummaryCard } from "@/components/ai-cards/RealTimeSummaryCard";
import { hasCustomerInfo } from "@/components/customer-info/reference-sections";
import { AI_CARD_ENTER } from "@/components/transcript/ai-rows/ai-card-enter";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { KIND_CANVAS_CELLS } from "./kind-cells/kind-canvas-cells";

const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => {});

/** The highlight a card gets when the AI brings it forward: its border turns
 *  the active border colour for a moment (lyra's Agentic AI card has no
 *  highlight of its own). The reference cards enter like the other AI cards. */
function FocusRing({ highlighted, children }: { highlighted: boolean; children: ReactNode }) {
  return (
    // The enter animation on its own box: its duration would merge with the ring's transition. Staggered by the
    // region's `--canvas-enter-delay` (P-HOME-1n), held at its start until then.
    <div className={cn(AI_CARD_ENTER, "fill-mode-backwards [animation-delay:var(--canvas-enter-delay,0ms)]")}>
      <div
        className={cn("rounded-lyra-md border transition-colors duration-500", highlighted ? "border-lyra-border-active" : "border-transparent")}
        data-highlighted={highlighted || undefined}
      >
        {children}
      </div>
    </div>
  );
}

function RealTimeSummaryCell() {
  const { activeInteraction, snapshotLinkHandlerFor } = useWorkspace();
  const { highlighted, ...accordion } = useReferenceAccordion("summary");
  // The contact's Copilot asks as linked lines, each opening (or closing) its result as its row does (P-HOME-1h).
  const asks = activeInteraction
    ? copilotAsksOf(activeInteraction).map((m) => ({
        id: m.id,
        time: m.timestamp,
        text: m.text,
        onOpen: () => snapshotLinkHandlerFor(activeInteraction.id)(m.instruction.link),
      }))
    : undefined;
  return (
    <FocusRing highlighted={highlighted}>
      <RealTimeSummaryCard summary={useActiveContactSummary()} onCopy={copy} asks={asks} {...accordion} />
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
      <CustomerInfoCard
        customerName={p.customerName}
        customerCard={hasCustomerInfo(p) ? p.customerContextOverview?.customerCard : undefined}
        onViewCustomerInfo={p.onViewCustomerInfo}
        onLinkCustomer={p.onLinkCustomer}
        {...accordion}
      />
    </FocusRing>
  );
}

function VoiceWrapUpCell() {
  const { activeInteraction, activeWrapUpThread, outcomeConfigFor } = useWorkspace();
  if (!activeInteraction || !activeWrapUpThread) return null;
  return <VoiceWrapUpCard outcome={outcomeConfigFor(activeInteraction, activeWrapUpThread, "inline")} />;
}

export const DEFAULT_CANVAS_CELLS: readonly CanvasCell[] = [
  // Reference: what the agent consults. The agent opens any number; the AI opens one at a time (reference-cards.ts).
  // P-HOME-1n: a card shows once it has something — the Real-Time Summary with a summary (or a Copilot ask to
  // list), the Journey Summary with at least one earlier interaction; Customer Info always (its "Link to existing
  // customer" is an action).
  { id: "real-time-summary", region: "reference", order: 10, component: RealTimeSummaryCell, hasContent: (_, c) => c.summary || c.asks > 0 },
  { id: "journey-summary", region: "reference", order: 20, component: JourneySummaryCell, hasContent: (_, c) => c.journeyRows > 0 },
  {
    id: "customer-info",
    region: "reference",
    order: 30,
    component: CustomerInfoCell,
    // A customer record, or an unmatched customer's "Link to existing customer".
    applies: ({ referenceCardProps: p }) => !!p && (hasCustomerInfo(p) || !!p.onLinkCustomer),
  },
  // Action: what the agent must do now. (The Next Best Action isn't a cell: it surfaces in the
  // conversation as a row on a pause or the agent's request, next-best-action.ts; a scripted case's decisions too.)
  { id: "conversation", region: "action", order: 30 },
  { id: "voice-wrap-up", region: "action", order: 40, component: VoiceWrapUpCell, applies: (ws) => !!ws.activeWrapUpThread },
  // A non-conversation assignment's kind cell (P-HOME-1f): its own reference cards.
  ...KIND_CANVAS_CELLS,
];
